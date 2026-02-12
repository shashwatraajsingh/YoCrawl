import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import config from '../config.js';
import logger from '../logger.js';
import agentRoutes from './agentRoutes.js';
import { setupSocketHandlers } from './socketHandlers.js';

/**
 * Creates and configures the Express + Socket.IO server.
 * Separated from startup logic so it can be tested independently.
 */
export function createApp() {
    const app = express();
    const httpServer = createServer(app);

    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: config.api.corsOrigin,
            methods: ['GET', 'POST', 'DELETE'],
        },
    });

    app.use(cors({ origin: config.api.corsOrigin }));
    app.use(express.json());

    // Health check
    app.get('/api/health', (_req, res) => {
        res.json({
            status: 'ok',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        });
    });

    // Agent routes
    app.use('/api/agent', agentRoutes);
    app.use('/screenshots', express.static(config.screenshots.directory));

    // Socket.IO real-time events
    setupSocketHandlers(io);

    return { app, httpServer, io };
}
