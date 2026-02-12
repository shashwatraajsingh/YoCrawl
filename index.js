import { createApp } from './src/api/server.js';
import config from './src/config.js';
import logger from './src/logger.js';
import sessionManager from './src/agent/SessionManager.js';

const { httpServer } = createApp();

httpServer.listen(config.api.port, () => {
    logger.info(`YoCrawl API server running on http://localhost:${config.api.port}`);
    logger.info('Endpoints:');
    logger.info('  POST   /api/agent/start              — Start a new agent session');
    logger.info('  GET    /api/agent                     — List all sessions');
    logger.info('  GET    /api/agent/:id                 — Get session details + metrics');
    logger.info('  GET    /api/agent/:id/metrics         — Get session metrics only');
    logger.info('  POST   /api/agent/:id/stop            — Stop a session');
    logger.info('  DELETE /api/agent/:id                 — Delete a session');
    logger.info('  GET    /api/agent/actions/supported   — List supported actions');
    logger.info('  GET    /api/health                    — Health check');
    logger.info('  WS     socket.io                      — Real-time step streaming');
});

// --- Graceful shutdown (inspired by surf.new's cleanup-on-unload) ---
let shuttingDown = false;

const shutdown = async (signal) => {
    if (shuttingDown) return; // Only run once
    shuttingDown = true;

    logger.info(`Received ${signal} — shutting down gracefully...`);

    // Stop accepting new connections
    httpServer.close(() => {
        logger.info('HTTP server closed');
    });

    // Clean up session manager (clears timers, stops agents)
    sessionManager.destroy();

    // Give active sessions a moment to wrap up
    setTimeout(() => {
        logger.info('Force exiting');
        process.exit(0);
    }, 3000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions so we log instead of crash
process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', {
        error: reason instanceof Error ? reason.message : String(reason),
    });
});
