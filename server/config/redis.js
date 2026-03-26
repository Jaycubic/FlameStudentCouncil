// config/redis.js
// Shared IORedis connection for BullMQ.
// BullMQ requires ioredis (not the 'redis' npm package).
const IORedis = require('ioredis');

const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null  // Required by BullMQ
});

redisConnection.on('error', err => {
    console.error('[Redis/BullMQ] Connection error:', err.message);
});

redisConnection.on('connect', () => {
    console.log('[Redis/BullMQ] Connected');
});

module.exports = redisConnection;
