import { EventEmitter } from 'events';
import BrowserSession from '../browser/BrowserSession.js';
import PageContextExtractor from '../context/PageContextExtractor.js';
import ActionExecutor from '../executor/ActionExecutor.js';
import ActionPlanner from '../planner/ActionPlanner.js';
import config from '../config.js';
import logger from '../logger.js';

/**
 * Orchestrates the observe → plan → act loop.
 * Extends EventEmitter so the API layer can stream progress in real-time.
 *
 * Improvements inspired by surf.new's browser_use agent:
 * - Configurable step delay to avoid overwhelming pages
 * - Retry logic for transient LLM errors
 * - Better error classification and recovery
 * - Session uptime enforcement
 *
 * Events emitted:
 *   'step:start'    — { step, maxSteps }
 *   'step:observe'  — { step, pageContext }
 *   'step:plan'     — { step, thinking, actions, done, result }
 *   'step:act'      — { step, results }
 *   'task:complete'  — { report }
 *   'task:error'     — { error }
 */
export default class AgentLoop extends EventEmitter {
    constructor() {
        super();
        this.session = new BrowserSession();
        this.planner = new ActionPlanner();
        this.executor = null;
        this.contextExtractor = null;
        this.stepCount = 0;
        this.history = [];
        this.status = 'idle';
        this.aborted = false;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 3;
    }

    async run(taskDescription, startUrl) {
        this.status = 'running';
        logger.info('Agent starting', { task: taskDescription, startUrl });

        try {
            const page = await this.session.launch();
            this.executor = new ActionExecutor(page);
            this.contextExtractor = new PageContextExtractor(page);
            this.planner.setTask(taskDescription);

            if (startUrl) {
                await page.goto(startUrl, {
                    waitUntil: 'domcontentloaded',
                    timeout: config.browser.timeout,
                });
            }

            const report = await this.loop();
            this.status = 'complete';
            this.emit('task:complete', { report });
            return report;
        } catch (error) {
            this.status = 'error';
            const classified = this.classifyError(error);
            this.emit('task:error', { error: classified.message, type: classified.type });
            throw error;
        } finally {
            await this.session.close();
        }
    }

    async loop() {
        const maxSteps = config.agent.maxSteps;
        const stepDelay = config.agent.stepDelayMs;

        while (this.stepCount < maxSteps) {
            if (this.aborted) {
                logger.info('Agent aborted by user');
                return this.buildReport('Task aborted by user.');
            }

            this.stepCount++;
            logger.info(`── Step ${this.stepCount}/${maxSteps} ──`);
            this.emit('step:start', { step: this.stepCount, maxSteps });

            // --- OBSERVE ---
            let pageContext;
            try {
                pageContext = await this.contextExtractor.extract();
                this.emit('step:observe', { step: this.stepCount, pageContext });
            } catch (err) {
                logger.error('Failed to extract page context', { error: err.message });
                // Page might have crashed or navigated unexpectedly — give it a beat
                await this.sleep(1000);
                continue;
            }

            // --- PLAN ---
            const previousResults = this.getLastResults();
            let plan;
            try {
                plan = await this.planner.planNextActions(
                    pageContext,
                    this.stepCount,
                    previousResults
                );
                // Successful plan resets the error counter
                this.consecutiveErrors = 0;
            } catch (err) {
                this.consecutiveErrors++;
                const classified = this.classifyError(err);
                logger.error('Planner error', {
                    type: classified.type,
                    message: classified.message,
                    attempt: this.consecutiveErrors,
                });

                if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                    logger.error('Too many consecutive planner errors — aborting');
                    return this.buildReport(
                        `Agent stopped: ${this.consecutiveErrors} consecutive planner errors. Last: ${classified.message}`
                    );
                }

                // Wait and retry the step
                await this.sleep(2000);
                this.stepCount--; // Don't count the failed attempt
                continue;
            }

            this.emit('step:plan', {
                step: this.stepCount,
                thinking: plan.thinking,
                actions: plan.actions,
                done: plan.done,
                result: plan.result,
            });

            if (plan.thinking) {
                logger.info('LLM thinking', { thought: plan.thinking });
            }

            if (plan.done) {
                logger.info('Task complete', { result: plan.result });
                return this.buildReport(plan.result);
            }

            if (plan.actions.length === 0) {
                logger.warn('LLM returned no actions — requesting retry');
                continue;
            }

            // --- ACT ---
            const results = await this.executor.executeBatch(plan.actions);
            this.history.push({ step: this.stepCount, plan, results });
            this.emit('step:act', { step: this.stepCount, results });

            this.planner.trimHistory();

            // Step delay to let the page settle (inspired by surf.new's wait_time_between_steps)
            if (stepDelay > 0) {
                await this.sleep(stepDelay);
            }
        }

        logger.warn('Max steps reached without completion');
        return this.buildReport('Max steps reached. Task may be incomplete.');
    }

    stop() {
        this.aborted = true;
        this.status = 'stopping';
        logger.info('Stop requested');
    }

    getLastResults() {
        if (this.history.length === 0) return null;
        return this.history[this.history.length - 1].results;
    }

    buildReport(finalResult) {
        return {
            task: 'complete',
            totalSteps: this.stepCount,
            maxSteps: config.agent.maxSteps,
            result: finalResult,
            history: this.history,
            browserUptime: this.session.getUptimeSeconds(),
        };
    }

    /**
     * Classifies errors into categories (inspired by surf.new's error handling).
     * Helps the frontend display appropriate messages and the agent decide whether to retry.
     */
    classifyError(error) {
        const message = error.message || String(error);

        if (message.includes('429') || message.includes('rate limit') || message.includes('quota')) {
            return { type: 'RATE_LIMIT', message: `Rate limited: ${message}`, retryable: true };
        }
        if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
            return { type: 'TIMEOUT', message: `Request timed out: ${message}`, retryable: true };
        }
        if (message.includes('ECONNREFUSED') || message.includes('network')) {
            return { type: 'NETWORK', message: `Network error: ${message}`, retryable: true };
        }
        if (message.includes('Invalid JSON') || message.includes('parse')) {
            return { type: 'PARSE_ERROR', message: `Invalid response: ${message}`, retryable: true };
        }
        if (message.includes('API key') || message.includes('auth') || message.includes('401')) {
            return { type: 'AUTH_ERROR', message: `Authentication error: ${message}`, retryable: false };
        }

        return { type: 'UNKNOWN', message, retryable: false };
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    toJSON() {
        return {
            status: this.status,
            stepCount: this.stepCount,
            maxSteps: config.agent.maxSteps,
            historyLength: this.history.length,
            consecutiveErrors: this.consecutiveErrors,
        };
    }
}
