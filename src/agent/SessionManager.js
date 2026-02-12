import { v4 as uuidv4 } from 'uuid';
import AgentLoop from './AgentLoop.js';
import config from '../config.js';
import logger from '../logger.js';

/**
 * Tracks all active and completed agent sessions.
 *
 * Improvements inspired by surf.new:
 * - Session timeout cleanup (prevents zombie sessions)
 * - Structured session metadata with duration tracking
 * - Periodic reaper to purge expired/completed sessions
 */
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.sessionTimeouts = new Map();
        this.maxSessionAge = config.agent.sessionTimeoutMinutes * 60 * 1000;

        // Periodic cleanup every 60s — removes sessions that are completed
        // and older than 10 minutes to free memory.
        this.reaperInterval = setInterval(() => this.reapStaleSessions(), 60_000);
    }

    createSession(taskDescription, startUrl) {
        const sessionId = uuidv4();
        const agent = new AgentLoop();

        const session = {
            id: sessionId,
            task: taskDescription,
            startUrl,
            agent,
            createdAt: new Date().toISOString(),
            completedAt: null,
            report: null,
            error: null,
            steps: [],
            metrics: {
                totalSteps: 0,
                planLatencies: [],
                actionLatencies: [],
                startedAt: Date.now(),
                endedAt: null,
            },
        };

        this.sessions.set(sessionId, session);
        this.attachListeners(session);

        // Add session timeout — auto-stop if running too long
        const timeout = setTimeout(() => {
            if (session.agent.status === 'running') {
                logger.warn('Session timed out — auto-stopping', { sessionId });
                session.agent.stop();
                session.error = `Session timed out after ${config.agent.sessionTimeoutMinutes} minutes`;
                session.completedAt = new Date().toISOString();
                session.metrics.endedAt = Date.now();
            }
        }, this.maxSessionAge);

        this.sessionTimeouts.set(sessionId, timeout);

        logger.info('Session created', { sessionId, task: taskDescription });
        return session;
    }

    attachListeners(session) {
        const { agent, metrics } = session;

        agent.on('step:start', (data) => {
            session.steps.push({ phase: 'start', ...data, timestamp: Date.now() });
            metrics.totalSteps = data.step || metrics.totalSteps + 1;
        });

        agent.on('step:observe', (data) => {
            session.steps.push({ phase: 'observe', ...data, timestamp: Date.now() });
        });

        let planStartTime = 0;
        agent.on('step:plan', (data) => {
            const now = Date.now();
            // Use the last observe timestamp as plan start
            const lastObserve = session.steps
                .filter((s) => s.phase === 'observe')
                .pop();
            if (lastObserve) {
                metrics.planLatencies.push(now - lastObserve.timestamp);
            }
            session.steps.push({ phase: 'plan', ...data, timestamp: now });
        });

        agent.on('step:act', (data) => {
            const now = Date.now();
            const lastPlan = session.steps
                .filter((s) => s.phase === 'plan')
                .pop();
            if (lastPlan) {
                metrics.actionLatencies.push(now - lastPlan.timestamp);
            }
            session.steps.push({ phase: 'act', ...data, timestamp: now });
        });

        agent.on('task:complete', ({ report }) => {
            session.report = report;
            session.completedAt = new Date().toISOString();
            session.metrics.endedAt = Date.now();
        });

        agent.on('task:error', ({ error }) => {
            session.error = error;
            session.completedAt = new Date().toISOString();
            session.metrics.endedAt = Date.now();
        });
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    stopSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        session.agent.stop();

        // Clear the session timeout
        const timeout = this.sessionTimeouts.get(sessionId);
        if (timeout) {
            clearTimeout(timeout);
            this.sessionTimeouts.delete(sessionId);
        }

        return true;
    }

    listSessions() {
        return [...this.sessions.values()].map((session) => ({
            id: session.id,
            task: session.task,
            status: session.agent.status,
            createdAt: session.createdAt,
            completedAt: session.completedAt,
            stepCount: session.agent.stepCount,
            durationMs: session.metrics.endedAt
                ? session.metrics.endedAt - session.metrics.startedAt
                : Date.now() - session.metrics.startedAt,
        }));
    }

    deleteSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        if (session.agent.status === 'running') {
            session.agent.stop();
        }

        // Clear timeout
        const timeout = this.sessionTimeouts.get(sessionId);
        if (timeout) {
            clearTimeout(timeout);
            this.sessionTimeouts.delete(sessionId);
        }

        this.sessions.delete(sessionId);
        logger.info('Session deleted', { sessionId });
        return true;
    }

    /**
     * Get detailed session metrics for the status endpoint.
     */
    getSessionMetrics(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        const { metrics } = session;
        const avgPlanLatency =
            metrics.planLatencies.length > 0
                ? (metrics.planLatencies.reduce((a, b) => a + b, 0) / metrics.planLatencies.length).toFixed(0)
                : 0;
        const avgActionLatency =
            metrics.actionLatencies.length > 0
                ? (metrics.actionLatencies.reduce((a, b) => a + b, 0) / metrics.actionLatencies.length).toFixed(0)
                : 0;

        return {
            totalSteps: metrics.totalSteps,
            avgPlanLatencyMs: Number(avgPlanLatency),
            avgActionLatencyMs: Number(avgActionLatency),
            durationMs: (metrics.endedAt || Date.now()) - metrics.startedAt,
        };
    }

    /**
     * Purge completed/errored sessions older than 10 minutes.
     * Prevents memory leaks from accumulating finished sessions.
     */
    reapStaleSessions() {
        const cutoff = Date.now() - 10 * 60 * 1000;
        let reaped = 0;

        for (const [id, session] of this.sessions) {
            if (
                (session.agent.status === 'complete' || session.agent.status === 'error') &&
                session.metrics.endedAt &&
                session.metrics.endedAt < cutoff
            ) {
                this.deleteSession(id);
                reaped++;
            }
        }

        if (reaped > 0) {
            logger.info(`Reaped ${reaped} stale session(s)`);
        }
    }

    destroy() {
        clearInterval(this.reaperInterval);
        for (const timeout of this.sessionTimeouts.values()) {
            clearTimeout(timeout);
        }
    }
}

const sessionManager = new SessionManager();
export default sessionManager;
