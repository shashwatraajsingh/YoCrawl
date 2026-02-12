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
 *
 * Patterns from surf.new adopted:
 * - Request logging middleware
 * - Structured error handler
 * - Graceful shutdown support
 * - Request timing headers
 */
export function createApp() {
    const app = express();
    const httpServer = createServer(app);

    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: config.api.corsOrigin,
            methods: ['GET', 'POST', 'DELETE'],
        },
        // Increased ping timeout for long-running agent sessions
        pingTimeout: 60_000,
        pingInterval: 25_000,
    });

    // --- Middleware ---
    app.use(cors({ origin: config.api.corsOrigin }));
    app.use(express.json({ limit: '1mb' }));

    // Request timing + logging
    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - start;
            // Only log non-health-check requests to avoid noise
            if (req.path !== '/api/health') {
                logger.debug(`${req.method} ${req.path}`, {
                    status: res.statusCode,
                    durationMs: duration,
                });
            }
        });
        next();
    });

    // --- Health check (inspired by surf.new's /healthcheck) ---
    app.get('/api/health', (_req, res) => {
        res.json({
            status: 'ok',
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            memory: {
                rss: Math.floor(process.memoryUsage().rss / 1024 / 1024),
                heapUsed: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
            },
        });
    });

    // --- Agent routes ---
    app.use('/api/agent', agentRoutes);

    // --- Static screenshots ---
    app.use('/screenshots', express.static(config.screenshots.directory));

    // --- Structured error handler (inspired by surf.new's error format) ---
    app.use((err, req, res, _next) => {
        const statusCode = err.statusCode || err.code || 500;
        const errorType = err.constructor?.name || 'Error';

        logger.error('Unhandled API error', {
            path: req.path,
            method: req.method,
            error: err.message,
            type: errorType,
        });

        res.status(typeof statusCode === 'number' ? statusCode : 500).json({
            error: {
                message: err.message || 'Internal server error',
                type: errorType,
                code: statusCode,
            },
        });
    });

    // --- Socket.IO real-time events ---
    setupSocketHandlers(io);

    return { app, httpServer, io };
}
