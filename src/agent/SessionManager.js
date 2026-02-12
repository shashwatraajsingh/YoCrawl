import { v4 as uuidv4 } from 'uuid';
import AgentLoop from './AgentLoop.js';
import logger from '../logger.js';

/**
 * Tracks all active and completed agent sessions.
 * Each session gets a unique ID that the frontend uses to interact with it.
 */
class SessionManager {
    constructor() {
        this.sessions = new Map();
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
        };

        this.sessions.set(sessionId, session);
        this.attachListeners(session);

        logger.info('Session created', { sessionId, task: taskDescription });
        return session;
    }

    attachListeners(session) {
        const { agent } = session;

        agent.on('step:start', (data) => {
            session.steps.push({ phase: 'start', ...data, timestamp: Date.now() });
        });

        agent.on('step:observe', (data) => {
            session.steps.push({ phase: 'observe', ...data, timestamp: Date.now() });
        });

        agent.on('step:plan', (data) => {
            session.steps.push({ phase: 'plan', ...data, timestamp: Date.now() });
        });

        agent.on('step:act', (data) => {
            session.steps.push({ phase: 'act', ...data, timestamp: Date.now() });
        });

        agent.on('task:complete', ({ report }) => {
            session.report = report;
            session.completedAt = new Date().toISOString();
        });

        agent.on('task:error', ({ error }) => {
            session.error = error;
            session.completedAt = new Date().toISOString();
        });
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId) || null;
    }

    stopSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        session.agent.stop();
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
        }));
    }

    deleteSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        if (session.agent.status === 'running') {
            session.agent.stop();
        }

        this.sessions.delete(sessionId);
        logger.info('Session deleted', { sessionId });
        return true;
    }
}

const sessionManager = new SessionManager();
export default sessionManager;
