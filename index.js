import { createApp } from './src/api/server.js';
import config from './src/config.js';
import logger from './src/logger.js';

const { httpServer } = createApp();

httpServer.listen(config.api.port, () => {
    logger.info(`YoCrawl API server running on http://localhost:${config.api.port}`);
    logger.info('Endpoints:');
    logger.info('  POST   /api/agent/start          — Start a new agent session');
    logger.info('  GET    /api/agent                 — List all sessions');
    logger.info('  GET    /api/agent/:id             — Get session details');
    logger.info('  POST   /api/agent/:id/stop        — Stop a session');
    logger.info('  DELETE /api/agent/:id             — Delete a session');
    logger.info('  GET    /api/agent/actions/supported — List supported actions');
    logger.info('  GET    /api/health                — Health check');
    logger.info('  WS     socket.io                  — Real-time step streaming');
});
