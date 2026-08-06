// workers/poolRefillWorker.js
//
// Keeps the sheet_pool table stocked so the student hot path only needs
// 2 Drive API calls (rename + share) instead of a full generation cycle.
//
// Triggered two ways:
//   1. Scheduled — every 15 minutes via BullMQ repeatable job (catches overnight drain)
//   2. On-demand — sheetController adds a 'refill' job when pool drops below LOW_WATER_MARK
//
// Pacing: 1 copy every COPY_INTERVAL_MS to avoid Drive quota spikes.
// At 600ms each, filling 50 sheets × 3 types = 90 seconds total — well within limits.

'use strict';

const { Worker }  = require('bullmq');
const path        = require('path');
const { spawn }   = require('child_process');
const cron        = require('node-cron');
const redisConnection = require('../config/redis');
const SheetPool   = require('../models/SheetPool');
const { User }    = require('../models');
const { poolQueue } = require('../queues/poolQueue');
const log         = require('../utils/logger').child({ module: 'PoolRefillWorker' });

// ─── Tuning constants ────────────────────────────────────────────────────────
const TYPES           = ['workbook'];
const TARGET_SIZE     = 50;   // Sheets to maintain per type
const LOW_WATER_MARK  = 20;   // Trigger refill when available drops below this
const COPY_INTERVAL_MS = 600; // Pause between files.copy() calls — controls Drive quota usage
const MASTER_EMAIL    = 'student.awards@flame.edu.in';

// ─── Helper: run copy_sheet.py ────────────────────────────────────────────────
function copyOneSheet(type, masterUser) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '../scripts/copy_sheet.py');
        const proc = spawn('python3', [
            scriptPath,
            type,
            masterUser.access_token,
            masterUser.refresh_token,
        ]);

        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });

        const timeout = setTimeout(() => {
            proc.kill('SIGTERM');
            reject(new Error('copy_sheet.py timed out'));
        }, 30_000);

        proc.on('close', code => {
            clearTimeout(timeout);
            if (code !== 0) {
                return reject(new Error(`copy_sheet.py exited ${code}: ${stderr.trim()}`));
            }
            try {
                resolve(JSON.parse(stdout.trim()));
            } catch {
                reject(new Error(`Non-JSON from copy_sheet.py: ${stdout.trim()}`));
            }
        });
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Core refill logic ────────────────────────────────────────────────────────
async function refillType(type, masterUser) {
    const available = await SheetPool.count({
        where: { type, assigned_to: null },
    });

    const needed = TARGET_SIZE - available;
    if (needed <= 0) {
        log.info({ type, available }, '[Pool] Already at target — skipping');
        return { type, available, created: 0 };
    }

    log.info({ type, available, needed }, '[Pool] Refilling...');
    let created = 0;

    for (let i = 0; i < needed; i++) {
        try {
            const result = await copyOneSheet(type, masterUser);

            if (!result.success) {
                log.error({ type, error: result.error }, '[Pool] Copy failed — stopping batch');
                break;
            }

            await SheetPool.create({
                type,
                sheet_id:    result.sheet_id,
                assigned_to: null,
                assigned_at: null,
            });

            created++;
            log.debug({ type, sheet_id: result.sheet_id, progress: `${created}/${needed}` }, '[Pool] Sheet added');

            // Pace the copies — don't hammer Drive API
            if (i < needed - 1) {
                await sleep(COPY_INTERVAL_MS);
            }
        } catch (err) {
            log.error({ type, err: err.message }, '[Pool] Copy error — stopping batch');
            break;
        }
    }

    log.info({ type, created, available: available + created }, '[Pool] Refill complete');
    return { type, created };
}

// ─── BullMQ Worker ────────────────────────────────────────────────────────────
const poolWorker = new Worker(
    'sheet-pool-maintenance',
    async job => {
        log.info({ jobId: job.id, data: job.data }, '[Pool] Job started');

        const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
        if (!masterUser?.access_token) {
            throw new Error('Master account not configured — cannot refill pool');
        }

        const types = job.data.type ? [job.data.type] : TYPES;

        const results = [];
        for (const type of types) {
            const r = await refillType(type, masterUser);
            results.push(r);
        }

        return results;
    },
    {
        connection:  redisConnection,
        concurrency: 1,   // Pool refiller is intentionally single-file — pacing matters more than speed
    }
);

poolWorker.on('completed', job => {
    log.info({ jobId: job.id, result: job.returnvalue }, '[Pool] Job completed');
});

poolWorker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, err: err.message }, '[Pool] Job failed');
});

// ─── Scheduled refill: every 15 minutes ──────────────────────────────────────
// Keeps the pool healthy even during quiet periods.
// Also runs once at startup after a 30s warm-up delay.

async function scheduleRefill() {
    const jobId = `scheduled-refill-${Date.now()}`;
    try {
        await poolQueue.add(
            'scheduled-refill',
            { type: null },  // null = all types
            { jobId, priority: 10 }
        );
        log.info({ jobId }, '[Pool] Scheduled refill enqueued');
    } catch (err) {
        log.error({ err: err.message }, '[Pool] Failed to enqueue scheduled refill');
    }
}

// Warm-up: run first check 30s after server starts
setTimeout(scheduleRefill, 30_000);

// Then every 15 minutes
cron.schedule('*/15 * * * *', scheduleRefill);

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
    poolWorker,
    refillType,
    LOW_WATER_MARK,
    TARGET_SIZE,
};