// queues/submissionProcessingQueue.js
// BullMQ queue for post-submission background processing tasks:
// Dynamic sheet tabs, PDF merges, email delivery, cloud sync, and stats updates.

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis({
    host:     process.env.REDIS_HOST || 'localhost',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

const submissionProcessingQueue = new Queue('submission-processing', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
    },
});

module.exports = { submissionProcessingQueue, connection };
