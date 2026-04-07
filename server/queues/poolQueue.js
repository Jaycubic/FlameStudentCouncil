// queues/poolQueue.js
// Dedicated BullMQ queue for pool maintenance jobs (refill, emergency refill).
// Kept separate from sheetQueue so pool work never blocks student-facing jobs.

const { Queue } = require('bullmq');
const redisConnection = require('../config/redis');

const poolQueue = new Queue('sheet-pool-maintenance', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts:          3,
        backoff:           { type: 'exponential', delay: 5000 },
        removeOnComplete:  { age: 3600 },
        removeOnFail:      { age: 86400 },
    },
});

module.exports = { poolQueue };