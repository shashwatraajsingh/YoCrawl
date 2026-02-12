import sessionManager from '../agent/SessionManager.js';
import logger from '../logger.js';

/**
 * Wires up Socket.IO so the frontend receives real-time agent events.
 *
 * Frontend connects and joins a session room:
 *   socket.emit('join', { sessionId })
 *
 * Then receives events:
 *   socket.on('step:start',   data => ...)
 *   socket.on('step:observe', data => ...)
 *   socket.on('step:plan',    data => ...)
 *   socket.on('step:act',     data => ...)
 *   socket.on('task:complete', data => ...)
 *   socket.on('task:error',   data => ...)
 */
export function setupSocketHandlers(io) {
    io.on('connection', (socket) => {
        logger.info('WebSocket client connected', { socketId: socket.id });

        socket.on('join', ({ sessionId }) => {
            const session = sessionManager.getSession(sessionId);

            if (!session) {
                socket.emit('error', { message: 'Session not found' });
                return;
            }

            socket.join(sessionId);
            logger.info('Client joined session room', {
                socketId: socket.id,
                sessionId,
            });

            // Send any steps that already happened before the client connected
            socket.emit('session:replay', {
                sessionId,
                status: session.agent.status,
                steps: session.steps,
                report: session.report,
                error: session.error,
            });

            // Forward all future agent events into this session's room
            const events = [
                'step:start',
                'step:observe',
                'step:plan',
                'step:act',
                'task:complete',
                'task:error',
            ];

            for (const eventName of events) {
                const handler = (data) => {
                    io.to(sessionId).emit(eventName, { sessionId, ...data });
                };

                session.agent.on(eventName, handler);

                // Clean up when socket disconnects
                socket.on('disconnect', () => {
                    session.agent.removeListener(eventName, handler);
                });
            }
        });

        socket.on('stop', ({ sessionId }) => {
            const stopped = sessionManager.stopSession(sessionId);
            socket.emit('stop:ack', { sessionId, stopped });
        });

        socket.on('disconnect', () => {
            logger.info('WebSocket client disconnected', { socketId: socket.id });
        });
    });
}
