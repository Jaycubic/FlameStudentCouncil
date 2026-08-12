// workers/studentSyncWorker.js
//
// Independent background worker for syncing MySQL student data into PostgreSQL app.student_data.
// Scheduled via node-cron (runs every hour + once on startup after initial boot delay).

const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const log = require('../utils/logger').child({ module: 'StudentSyncWorker' });

const SCRIPT_PATH = path.join(__dirname, '../scripts/sync_students.py');

/**
 * Executes python3 sync_students.py
 */
function runStudentSync() {
    return new Promise((resolve) => {
        log.info('[StudentSync] 🔄 Starting student database synchronization...');

        const proc = spawn('python3', [SCRIPT_PATH]);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });

        const timeout = setTimeout(() => {
            proc.kill('SIGTERM');
            log.error('[StudentSync] ❌ Sync process timed out after 3 minutes');
            resolve({ success: false, error: 'Timeout after 180s' });
        }, 180_000); // 3 minutes timeout

        proc.on('close', code => {
            clearTimeout(timeout);
            if (code === 0) {
                log.info({ stdout: stdout.trim() }, '[StudentSync] ✅ Student synchronization completed successfully');
                resolve({ success: true, output: stdout.trim() });
            } else {
                log.error({ code, stderr: stderr.trim(), stdout: stdout.trim() }, '[StudentSync] ❌ Student synchronization failed');
                resolve({ success: false, error: stderr.trim() });
            }
        });

        proc.on('error', err => {
            clearTimeout(timeout);
            log.error({ err: err.message }, '[StudentSync] ❌ Failed to spawn python sync process');
            resolve({ success: false, error: err.message });
        });
    });
}

// ─── Schedule ────────────────────────────────────────────────────────────────
// Run every hour at minute 0 (0 * * * *)
cron.schedule('0 * * * *', () => {
    runStudentSync().catch(err => {
        log.error({ err: err.message }, '[StudentSync] Scheduled sync error');
    });
});

// ─── Startup Execution ────────────────────────────────────────────────────────
// Run once on server boot after 15 seconds delay (non-blocking)
setTimeout(() => {
    log.info('[StudentSync] Running initial boot sync...');
    runStudentSync().catch(err => {
        log.error({ err: err.message }, '[StudentSync] Boot sync error');
    });
}, 15_000);

log.info('[StudentSync] Independent student sync worker registered (Hourly cron active)');

module.exports = {
    runStudentSync,
};
