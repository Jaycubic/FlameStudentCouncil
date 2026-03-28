// queues/photoUploadQueue.js
// BullMQ queue for photo-to-Drive uploads.
// Jobs are added on student login (fire-and-forget from authController).

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

const photoUploadQueue = new Queue('photo-upload', {
    connection,
    defaultJobOptions: {
        attempts: 4,                   // 4 total tries
        backoff: { type: 'exponential', delay: 15_000 }, // 15s, 30s, 60s, 120s
        removeOnComplete: { count: 200 },
        removeOnFail:    { count: 100 },
    }
});

module.exports = { photoUploadQueue, connection };
