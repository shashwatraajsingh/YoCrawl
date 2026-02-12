import { Router } from 'express';
import sessionManager from '../agent/SessionManager.js';
import ActionExecutor from '../executor/ActionExecutor.js';
import logger from '../logger.js';

const router = Router();

/**
 * POST /api/agent/start
 * Body: { task: string, startUrl?: string }
 * Starts a new agent session and returns the session ID immediately.
 */
router.post('/start', (req, res) => {
    const { task, startUrl } = req.body;

    if (!task || typeof task !== 'string') {
        return res.status(400).json({
            error: {
                message: 'Missing required field: "task" (string)',
                type: 'ValidationError',
                code: 400,
            },
        });
    }

    const session = sessionManager.createSession(task, startUrl);

    // Fire and forget — the agent runs in the background
    session.agent
        .run(task, startUrl || 'https://www.google.com')
        .catch((error) => {
            logger.error('Agent session crashed', {
                sessionId: session.id,
                error: error.message,
            });
        });

    res.status(201).json({
        sessionId: session.id,
        task: session.task,
        status: 'running',
        createdAt: session.createdAt,
    });
});

/**
 * GET /api/agent/:sessionId
 * Returns the full status and step history of a session.
 */
router.get('/:sessionId', (req, res) => {
    const session = sessionManager.getSession(req.params.sessionId);

    if (!session) {
        return res.status(404).json({
            error: {
                message: 'Session not found',
                type: 'NotFoundError',
                code: 404,
            },
        });
    }

    const metrics = sessionManager.getSessionMetrics(req.params.sessionId);

    res.json({
        id: session.id,
        task: session.task,
        status: session.agent.status,
        stepCount: session.agent.stepCount,
        maxSteps: session.agent.toJSON().maxSteps,
        createdAt: session.createdAt,
        completedAt: session.completedAt,
        steps: session.steps,
        report: session.report,
        error: session.error,
        metrics,
    });
});

/**
 * GET /api/agent/:sessionId/metrics
 * Returns just the performance metrics for a session.
 */
router.get('/:sessionId/metrics', (req, res) => {
    const metrics = sessionManager.getSessionMetrics(req.params.sessionId);

    if (!metrics) {
        return res.status(404).json({
            error: {
                message: 'Session not found',
                type: 'NotFoundError',
                code: 404,
            },
        });
    }

    res.json(metrics);
});

/**
 * POST /api/agent/:sessionId/stop
 * Gracefully stops a running agent session.
 */
router.post('/:sessionId/stop', (req, res) => {
    const stopped = sessionManager.stopSession(req.params.sessionId);

    if (!stopped) {
        return res.status(404).json({
            error: {
                message: 'Session not found',
                type: 'NotFoundError',
                code: 404,
            },
        });
    }

    res.json({ status: 'stopping', sessionId: req.params.sessionId });
});

/**
 * DELETE /api/agent/:sessionId
 * Removes a session from the session manager (similar to surf.new's release endpoint).
 */
router.delete('/:sessionId', (req, res) => {
    const deleted = sessionManager.deleteSession(req.params.sessionId);

    if (!deleted) {
        return res.status(404).json({
            error: {
                message: 'Session not found',
                type: 'NotFoundError',
                code: 404,
            },
        });
    }

    res.json({ deleted: true, sessionId: req.params.sessionId });
});

/**
 * GET /api/agent
 * Lists all sessions (active and completed) with duration.
 */
router.get('/', (_req, res) => {
    res.json({ sessions: sessionManager.listSessions() });
});

/**
 * GET /api/agent/actions/supported
 * Returns the list of supported browser actions.
 */
router.get('/actions/supported', (_req, res) => {
    res.json({ actions: ActionExecutor.listSupportedActions() });
});

export default router;
