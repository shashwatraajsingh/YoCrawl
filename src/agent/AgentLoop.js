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
                    timeout: 15_000,
                });
            }

            const report = await this.loop();
            this.status = 'complete';
            this.emit('task:complete', { report });
            return report;
        } catch (error) {
            this.status = 'error';
            this.emit('task:error', { error: error.message });
            throw error;
        } finally {
            await this.session.close();
        }
    }

    async loop() {
        const maxSteps = config.agent.maxSteps;

        while (this.stepCount < maxSteps) {
            if (this.aborted) {
                logger.info('Agent aborted by user');
                return this.buildReport('Task aborted by user.');
            }

            this.stepCount++;
            logger.info(`── Step ${this.stepCount}/${maxSteps} ──`);
            this.emit('step:start', { step: this.stepCount, maxSteps });

            const pageContext = await this.contextExtractor.extract();
            this.emit('step:observe', { step: this.stepCount, pageContext });

            const previousResults = this.getLastResults();

            const plan = await this.planner.planNextActions(
                pageContext,
                this.stepCount,
                previousResults
            );

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

            const results = await this.executor.executeBatch(plan.actions);
            this.history.push({ step: this.stepCount, plan, results });
            this.emit('step:act', { step: this.stepCount, results });

            this.planner.trimHistory();
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
            result: finalResult,
            history: this.history,
        };
    }

    toJSON() {
        return {
            status: this.status,
            stepCount: this.stepCount,
            maxSteps: config.agent.maxSteps,
            historyLength: this.history.length,
        };
    }
}
