// workers/sheetWorker.js
// BullMQ worker that processes sheet generation/restore jobs.
// Runs inside the main PM2 process — no separate service needed.
// Concurrency = 2 to cap memory usage (~200MB worst case).
const { Worker } = require('bullmq');
const { spawn } = require('child_process');
const path = require('path');
const redisConnection = require('../config/redis');
const { CulturalUserSheet, SportsUserSheet } = require('../models');
const log = require('../utils/logger').child({ module: 'SheetWorker' });

// ─── Python script runner (same as sheetController's) ─────────────────────────
function runPythonScript(scriptPath, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', [scriptPath, ...args]);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });

        const timeout = setTimeout(() => {
            proc.kill('SIGTERM');
            reject(new Error('Script execution timed out after 120s'));
        }, 120_000);

        proc.on('close', code => {
            clearTimeout(timeout);
            if (code !== 0) {
                return reject(new Error(`Script exited with code ${code}: ${stderr.trim()}`));
            }
            try {
                resolve(JSON.parse(stdout.trim()));
            } catch {
                reject(new Error(`Non-JSON output: ${stdout.trim()}`));
            }
        });
    });
}

// ─── Job processor ────────────────────────────────────────────────────────────
async function processSheetJob(job) {
    const { action, type, userEmail, args } = job.data;
    const Model = type === 'cultural' ? CulturalUserSheet : SportsUserSheet;

    log.info({ action, type, userEmail }, 'Processing sheet job');

    if (action === 'generate') {
        const scriptPath = path.join(__dirname, '../scripts/generate_sheet.py');
        const result = await runPythonScript(scriptPath, args);

        if (!result.success) {
            throw new Error(result.error || 'Sheet generation failed');
        }

        // Atomic DB write
        const [sheet, created] = await Model.findOrCreate({
            where: { email: userEmail },
            defaults: {
                email: userEmail,
                user_sheet_id: result.sheet_id,
                student_permission_id: result.student_permission_id
            }
        });

        if (!created) {
            log.warn({ userEmail, orphan: result.sheet_id }, 'Race: duplicate sheet');
        }

        const sheetId = created ? result.sheet_id : sheet.user_sheet_id;
        return {
            success: true,
            sheet_id: sheetId,
            url: `https://docs.google.com/spreadsheets/d/${sheetId}`,
            isNew: created
        };
    }

    if (action === 'restore') {
        const scriptPath = path.join(__dirname, '../scripts/restore_access.py');
        const result = await runPythonScript(scriptPath, args);

        if (!result.success) {
            throw new Error(result.error || 'Permission restore failed');
        }

        // Update DB with new permission ID
        const sheet = await Model.findOne({ where: { email: userEmail } });
        if (sheet) {
            await sheet.update({ student_permission_id: result.student_permission_id });
        }

        return {
            success: true,
            sheet_id: sheet?.user_sheet_id,
            url: `https://docs.google.com/spreadsheets/d/${sheet?.user_sheet_id}`,
            isNew: false
        };
    }

    throw new Error(`Unknown action: ${action}`);
}

// ─── Start worker ─────────────────────────────────────────────────────────────
const sheetWorker = new Worker('sheet-operations', processSheetJob, {
    connection: redisConnection,
    concurrency: 2,   // Max 2 Python processes from the worker at a time
    limiter: {
        max: 10,      // Max 10 jobs per 60 seconds (Google API rate safety)
        duration: 60_000
    }
});

sheetWorker.on('completed', (job) => {
    log.info({ jobId: job.id, userEmail: job.data.userEmail }, 'Job completed');
});

sheetWorker.on('failed', (job, err) => {
    log.error({ jobId: job?.id, userEmail: job?.data?.userEmail, err: err.message }, 'Job failed');
});

sheetWorker.on('error', err => {
    log.error({ err: err.message }, 'Worker error');
});

log.info('Worker started (concurrency=2, rate=10/min)');

module.exports = sheetWorker;
