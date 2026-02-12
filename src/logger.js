import winston from 'winston';
import config from './config.js';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]${metaString} ${message}`;
});

const logger = winston.createLogger({
    level: config.logging.level,
    format: combine(timestamp({ format: 'HH:mm:ss' }), logFormat),
    transports: [
        new winston.transports.Console({
            format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat),
        }),
        new winston.transports.File({
            filename: 'logs/agent.log',
            maxsize: 5_000_000,
            maxFiles: 3,
        }),
    ],
});

export default logger;
