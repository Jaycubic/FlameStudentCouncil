// queues/sheetQueue.js
// BullMQ queue for sheet generation and permission restore jobs.
// Jobs are stored in Redis — no in-process memory pressure.
const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const sheetQueue = new Queue('sheet-operations', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,                    // Retry once on failure
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: { age: 3600 },  // Clean up after 1 hour
        removeOnFail: { age: 86400 }      // Keep failed jobs 24h for debugging
    }
});

/**
 * Get the status of a queued sheet job.
 * @param {string} jobId
 * @returns {{ status, result? }}
 */
async function getJobStatus(jobId) {
    const job = await sheetQueue.getJob(jobId);
    if (!job) return { status: 'not_found' };

    const state = await job.getState();

    if (state === 'completed') {
        return { status: 'completed', result: job.returnvalue };
    }
    if (state === 'failed') {
        return { status: 'failed', error: job.failedReason };
    }
    return { status: state }; // 'waiting', 'active', 'delayed'
}

module.exports = { sheetQueue, getJobStatus };
