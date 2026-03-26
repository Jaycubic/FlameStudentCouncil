// utils/logger.js
// Production-grade async logger using Pino.
// Pino writes logs asynchronously — console.log blocks the event loop,
// Pino doesn't. This keeps I/O from slowing down request handling.
const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
        level: (label) => ({ level: label.toUpperCase() })
    },
    // In dev: pretty print to console (human-readable)
    // In prod: raw JSON to stdout (fastest, PM2/journald captures it)
    transport: isDev
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname'
            }
        }
        : undefined
});

module.exports = logger;
