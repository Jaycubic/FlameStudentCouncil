// queues/submissionEmailQueue.js
// BullMQ queue for post-submission confirmation emails.
// Jobs are enqueued fire-and-forget after the HTTP response is sent.

const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// Reuse same Redis connection config as photoUploadQueue
const connection = new IORedis({
    host:     process.env.REDIS_HOST || 'localhost',
    port:     parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});

const submissionEmailQueue = new Queue('submission-email', {
    connection,
    defaultJobOptions: {
        attempts:  3,
        backoff:   { type: 'exponential', delay: 10_000 }, // 10s, 20s, 40s
        removeOnComplete: { count: 500 },
        removeOnFail:     { count: 200 },
    },
});

module.exports = { submissionEmailQueue, connection };
