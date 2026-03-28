// server/cron/cronPhotoUpload.js
//
// Nightly catch-up job: ensures every student who has a local photo but no
// Drive record gets uploaded to the master FlameAwards2026Photos folder.
//
// Runs at 00:00 (midnight) daily via node-cron.
// Also exported as `runPhotoUploadCatchup()` for manual/admin triggers.

const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const { Op } = require('sequelize');
const fs = require('fs');

const { StudentData, User, PhotoDriveUpload } = require('../models');

const PHOTO_FOLDER_ID  = '1zf29mZFzNObWcMjrbtKg13aoO9PNkqxK'; // FlameAwards2026Photos
const MASTER_EMAIL     = 'student.awards@flame.edu.in';
const LOCAL_PHOTOS_DIR = '/opt/View/StudentTrackingSystem/server/Photos';
const PHOTO_EXTS       = ['.jpg', '.jpeg', '.png'];
const SCRIPT_PATH      = path.join(__dirname, '../scripts/upload_photo_drive.py');

// ─── Helper: run python, return parsed JSON ────────────────────────────────────
function runUploadScript(studentId, masterUser) {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', [
            SCRIPT_PATH,
            studentId,
            LOCAL_PHOTOS_DIR,
            masterUser.access_token,
            masterUser.refresh_token,
            PHOTO_FOLDER_ID
        ]);
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });
        const timer = setTimeout(() => { proc.kill('SIGTERM'); reject(new Error('timeout')); }, 90_000);
        proc.on('close', code => {
            clearTimeout(timer);
            if (code !== 0) return reject(new Error(`exit ${code}: ${stderr.trim()}`));
            try { resolve(JSON.parse(stdout.trim())); }
            catch { reject(new Error(`Non-JSON output: ${stdout.trim()}`)); }
        });
    });
}

// ─── Helper: does a local photo file exist for this studentId? ────────────────
function localPhotoExists(studentId) {
    return PHOTO_EXTS.some(ext =>
        fs.existsSync(path.join(LOCAL_PHOTOS_DIR, `${studentId}${ext}`))
    );
}

// ─── Main catchup routine ─────────────────────────────────────────────────────
async function runPhotoUploadCatchup() {
    console.log('[CronPhotoUpload] Starting nightly photo Drive upload catchup...');

    try {
        // 1. Get master tokens
        const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
        if (!masterUser?.access_token) {
            console.error('[CronPhotoUpload] Master account tokens not available — aborting');
            return;
        }

        // 2. Get all students with a local photo
        const allStudents = await StudentData.findAll({
            attributes: ['student_cvue_no', 'email_id'],
            where: { student_cvue_no: { [Op.not]: null } }
        });

        // 3. Get already-uploaded student IDs
        const uploaded = await PhotoDriveUpload.findAll({ attributes: ['student_id'] });
        const uploadedSet = new Set(uploaded.map(r => r.student_id));

        // 4. Filter: have local photo + not yet uploaded
        const pending = allStudents.filter(s => {
            const sid = s.student_cvue_no?.toString();
            return sid && !uploadedSet.has(sid) && localPhotoExists(sid);
        });

        console.log(`[CronPhotoUpload] ${pending.length} students pending Drive upload`);

        // 5. Process sequentially to avoid hammering the Drive API
        let successCount = 0;
        let failCount = 0;

        for (const student of pending) {
            const studentId = student.student_cvue_no.toString();
            try {
                const result = await runUploadScript(studentId, masterUser);
                if (result.success) {
                    await PhotoDriveUpload.upsert({
                        student_id: studentId,
                        drive_file_id: result.drive_file_id
                    });
                    successCount++;
                    console.log(`[CronPhotoUpload] ✅ ${studentId} → ${result.drive_file_id} (existed: ${result.already_existed})`);
                } else {
                    failCount++;
                    console.warn(`[CronPhotoUpload] ⚠️  ${studentId}: ${result.error}`);
                }
            } catch (err) {
                failCount++;
                console.error(`[CronPhotoUpload] ❌ ${studentId}: ${err.message}`);
            }

            // Small delay between uploads to respect Drive API quotas
            await new Promise(r => setTimeout(r, 500));
        }

        console.log(`[CronPhotoUpload] Done — ✅ ${successCount} uploaded, ❌ ${failCount} failed`);

    } catch (err) {
        console.error('[CronPhotoUpload] Fatal error:', err.message);
    }
}

// ─── Schedule: every night at midnight ────────────────────────────────────────
cron.schedule('0 0 * * *', () => {
    runPhotoUploadCatchup().catch(err =>
        console.error('[CronPhotoUpload] Unhandled error in cron:', err.message)
    );
}, {
    timezone: 'Asia/Kolkata'
});

console.log('[CronPhotoUpload] Registered — runs at 00:00 IST daily');

module.exports = { runPhotoUploadCatchup };
