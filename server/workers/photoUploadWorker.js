// workers/photoUploadWorker.js
//
// BullMQ worker — concurrency=3.
// Uploads student photo from local disk to student's own Google Drive,
// makes it publicly accessible (anyone with link = reader).
// Stores the resulting drive_file_id in photo_drive_uploads for use in
// sheetController's =IMAGE() formula insertion into cell B2.

const { Worker } = require('bullmq');
const { spawn }  = require('child_process');
const path       = require('path');
const { photoUploadQueue, connection } = require('../queues/photoUploadQueue');
const { PhotoDriveUpload, User, StudentData } = require('../models');
const log = require('../utils/logger').child({ module: 'PhotoUploadWorker' });

const LOCAL_PHOTOS_DIR = '/opt/View/StudentTrackingSystem/server/Photos';
const SCRIPT_PATH      = path.join(__dirname, '../scripts/upload_photo_drive.py');

// ─── Run Python script, return parsed JSON ────────────────────────────────────
function runUpload(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', [SCRIPT_PATH, ...args]);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });

        const timer = setTimeout(() => {
            proc.kill('SIGTERM');
            reject(new Error('Upload script timed out after 90s'));
        }, 90_000);

        proc.on('close', code => {
            clearTimeout(timer);
            if (stderr.trim()) {
                log.debug({ stderr: stderr.trim() }, 'Python stderr');
            }
            if (code !== 0) {
                return reject(new Error(`Script exited ${code}: ${stderr.trim()}`));
            }
            try {
                resolve(JSON.parse(stdout.trim()));
            } catch {
                reject(new Error(`Non-JSON output: ${stdout.trim()}`));
            }
        });
    });
}

// ─── Worker processor ─────────────────────────────────────────────────────────
const worker = new Worker('photo-upload', async (job) => {
    const { studentId: rawId, studentEmail } = job.data;
    const studentId = (rawId || '').toString().trim();
    log.info({ studentId, attempt: job.attemptsMade + 1 }, 'Processing photo upload job');

    // ── 1. Idempotency: skip if already uploaded ───────────────────────────────
    const existing = await PhotoDriveUpload.findOne({ where: { student_id: studentId } });
    if (existing?.drive_file_id) {
        log.info({ studentId }, 'Already on Drive — skipping');
        return { skipped: true, drive_file_id: existing.drive_file_id };
    }

    // ── 2. Get student or master tokens ────────────────────────────────────────
    const studentUser = await User.findOne({ where: { email: studentEmail } });
    let accessToken = studentUser?.access_token;
    let refreshToken = studentUser?.refresh_token;

    if (!accessToken) {
        const masterUser = await User.findOne({ where: { email: 'student.awards@flame.edu.in' } });
        if (masterUser?.access_token) {
            accessToken = masterUser.access_token;
            refreshToken = masterUser.refresh_token;
        } else {
            throw new Error(`No tokens available for student ${studentEmail} or master account`);
        }
    }

    // ── 3. Run upload script ───────────────────────────────────────────────────
    const result = await runUpload([
        studentId,
        LOCAL_PHOTOS_DIR,
        accessToken,
        refreshToken
    ]);

    if (!result.success) {
        throw new Error(result.error || 'Upload returned failure');
    }

    // ── 4. Persist drive_file_id ───────────────────────────────────────────────
    await PhotoDriveUpload.upsert({
        student_id:    studentId,
        drive_file_id: result.drive_file_id,
        hosted_by:     'student'
    });

    log.info({
        studentId,
        driveFileId:    result.drive_file_id,
        alreadyExisted: result.already_existed
    }, '✅ Photo uploaded to student Drive and made public');

    return { drive_file_id: result.drive_file_id };

}, {
    connection,
    concurrency: 3,    // max 3 concurrent uploads
    limiter: {
        max:      8,       // 8 jobs per window
        duration: 60_000   // per 60s — safe under Drive API quota
    }
});

// ─── Events ───────────────────────────────────────────────────────────────────
worker.on('completed', (job, result) => {
    if (!result?.skipped) {
        log.info({ jobId: job.id }, 'Photo upload job completed');
    }
});

worker.on('failed', (job, err) => {
    log.error({
        jobId:       job?.id,
        attempt:     job?.attemptsMade,
        maxAttempts: job?.opts?.attempts,
        err:         err.message
    }, 'Photo upload job failed');
});

worker.on('error', err => {
    log.error({ err: err.message }, 'PhotoUploadWorker connection error');
});

log.info({ concurrency: 3 }, 'PhotoUploadWorker started');

module.exports = worker;
