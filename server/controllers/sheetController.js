// controllers/sheetController.js
//
// Architecture: pool-first hot path (adapted for single workbook type)
//
//   FAST PATH (pool has sheets):
//     1. DB lookup — already has sheet?          ~1ms
//     2. Atomic pool pop (SELECT FOR UPDATE)     ~2ms
//     3. rename_and_share.py (2 Drive calls)   ~200ms
//     4. DB write                                ~1ms
//     Total: ~204ms, flat regardless of load
//
//   FALLBACK PATH (pool empty — should be rare):
//     Falls back to the original generate_sheet.py flow.
//     Also triggers an emergency pool refill so it self-heals.
//
//   BACKGROUND:
//     poolRefillWorker.js keeps the pool stocked via files.copy().
//     It runs every 15 minutes and whenever pool drops below LOW_WATER_MARK.

'use strict';

const {
    AcademicUserSheet,
    User,
    StudentData,
    PhotoDriveUpload,
    ElectionDraft,
} = require('../models');
const SheetPool       = require('../models/SheetPool');
const { spawn }       = require('child_process');
const path            = require('path');
const sequelize       = require('../config/connection');
const { sheetQueue, getJobStatus } = require('../queues/sheetQueue');
const { poolQueue }   = require('../queues/poolQueue');
const { photoUploadQueue } = require('../queues/photoUploadQueue');
const { LOW_WATER_MARK } = require('../workers/poolRefillWorker');
const log             = require('../utils/logger').child({ module: 'SheetController' });

const MASTER_EMAIL = 'student.awards@flame.edu.in';
const FOLDER_ID    = process.env.GOOGLE_DRIVE_FOLDER_ID || '1GBzDVaUcwehFAMrziH9zt8Cnjx-sN7ly';

const NAME_MAP = {
    workbook: 'Student Council Workbook - 2026/2027',
};

// ─── Concurrency Semaphore ────────────────────────────────────────────────────
// Limits simultaneous fallback-path workers (the slow generate_sheet.py path).
// Pool-path requests do NOT consume semaphore slots — they're fast enough.
class Semaphore {
    constructor(limit) {
        this.limit = limit;
        this.count = 0;
    }
    tryAcquire() {
        if (this.count < this.limit) { this.count++; return true; }
        return false;
    }
    release()      { this.count--; }
    get active()   { return this.count; }
}

const driveSemaphore = new Semaphore(3);

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
                reject(new Error(`Non-JSON output from script: ${stdout.trim()}`));
            }
        });
    });
}

/**
 * Fires revoke_access.py in the background — removes only the student's
 * explicit permission entry. The file stays intact in master's Drive.
 */
function revokeStudentAccess(fileId, studentPermissionId, masterUser) {
    const scriptPath = path.join(__dirname, '../scripts/revoke_access.py');

    const proc = spawn('python3', [
        scriptPath,
        fileId,
        studentPermissionId,
        masterUser.access_token,
        masterUser.refresh_token,
    ], { detached: true, stdio: 'ignore' });

    proc.unref();

    proc.on('error', err => {
        log.error({ fileId, err: err.message }, 'Failed to spawn revoke script');
    });
}

// ─── Insert student info + photo into the "Personal Information" sheet ────────
// Cell mapping (per migration spec §2.1):
//   B2 = Name, B3 = Student ID, B4 = Batch, B5 = Email,
//   B6 = Mobile Number, B7 = Position Selected, B9 = Photo

async function insertPhotoFormula(sheetId, userEmail, masterUser) {
    try {
        const student = await StudentData.findOne({ where: { email_id: userEmail } });
        if (!student?.student_cvue_no) {
            log.warn({ userEmail }, '[PhotoFormula] No StudentData found — skipping insert');
            return;
        }
        const studentId = student.student_cvue_no.toString();

        const photoRecord = await PhotoDriveUpload.findOne({ where: { student_id: studentId } });
        let driveFileId = photoRecord?.drive_file_id;

        if (!driveFileId) {
            log.warn({ studentId }, '[PhotoFormula] Photo not on Drive yet — appending student info only and triggering upload worker');
            try {
                await photoUploadQueue.add(
                    `upload:${studentId}`,
                    { studentId, studentEmail: userEmail, jobType: 'upload' },
                    {
                        jobId: `upload-${studentId}-${Date.now()}`,
                        priority: 2,
                        attempts: 4,
                        backoff: { type: 'exponential', delay: 15_000 }
                    }
                );
            } catch (err) {
                log.error({ err: err.message }, 'Failed to enqueue photo upload from sheetController');
            }
            driveFileId = 'NONE';
        }

        // Fetch the student's saved position from ElectionDraft (if any)
        const draft = await ElectionDraft.findOne({ where: { email: userEmail }, attributes: ['position_selected'] });
        const positionSelected = draft?.position_selected || '';

        // Fetch CGPA from cache
        const { StudentCgpaCache } = require('../models');
        const cgpaRecord = await StudentCgpaCache.findOne({ where: { student_id: studentId }, attributes: ['cgpa'] });
        const cgpa = cgpaRecord?.cgpa ? cgpaRecord.cgpa.toString() : '';

        const scriptPath = path.join(__dirname, '../scripts/insert_photo_formula.py');
        const result = await runPythonScript(scriptPath, [
            sheetId,
            driveFileId,
            masterUser.access_token,
            masterUser.refresh_token,
            student.student_name  || '',
            studentId,
            student.batch         || '',
            student.email_id      || userEmail,
            student.contact_no ? student.contact_no.toString() : '',
            positionSelected,
            cgpa,
        ]);

        if (result.success) {
            log.info({ sheetId, studentId }, '[PhotoFormula] ✅ Photo + student info inserted');
        } else {
            log.warn({ sheetId, error: result.error }, '[PhotoFormula] Script returned failure');
        }
    } catch (err) {
        log.error({ sheetId, err: err.message }, '[PhotoFormula] Non-fatal error');
    }
}

// ─── Surgical update of cell B7 (Position Selected) only ──────────────────────
async function updateSheetPositionCell(sheetId, positionSelected, masterUser) {
    try {
        if (!sheetId || !positionSelected) return;
        const scriptPath = path.join(__dirname, '../scripts/update_position_cell.py');
        const result = await runPythonScript(scriptPath, [
            sheetId,
            masterUser.access_token,
            masterUser.refresh_token,
            positionSelected,
        ]);
        if (result.success) {
            log.info({ sheetId, positionSelected }, '[SheetPosition] Surgical cell B7 update succeeded');
        } else {
            log.warn({ sheetId, error: result.error }, '[SheetPosition] Surgical cell B7 update returned failure');
        }
    } catch (err) {
        log.error({ sheetId, err: err.message }, '[SheetPosition] Non-fatal error');
    }
}

// ─── Surgical update of cell B3 ('Statement of Purpose' sheet) ────────────────
async function updateSheetSOPCell(sheetId, statementOfPurpose, masterUser) {
    try {
        if (!sheetId || !statementOfPurpose) return;
        const scriptPath = path.join(__dirname, '../scripts/update_sop_cell.py');
        const result = await runPythonScript(scriptPath, [
            sheetId,
            masterUser.access_token,
            masterUser.refresh_token,
            statementOfPurpose,
        ]);
        if (result.success) {
            log.info({ sheetId }, '[SheetSOP] Surgical SOP cell B3 update succeeded');
        } else {
            log.warn({ sheetId, error: result.error }, '[SheetSOP] Surgical SOP cell B3 update returned failure');
        }
    } catch (err) {
        log.error({ sheetId, err: err.message }, '[SheetSOP] Non-fatal error');
    }
}

// ─── Insert 'Statement of Purpose' tab on final submission ──────────────────
async function insertSopSheetTab(sheetId, statementOfPurpose, masterUser) {
    try {
        if (!sheetId || !statementOfPurpose) return;
        const scriptPath = path.join(__dirname, '../scripts/insert_sop_sheet.py');
        const result = await runPythonScript(scriptPath, [
            sheetId,
            masterUser.access_token,
            masterUser.refresh_token,
            statementOfPurpose,
        ]);
        if (result.success) {
            log.info({ sheetId }, '[SheetSOPTab] Added Statement of Purpose sheet tab successfully');
        } else {
            log.warn({ sheetId, error: result.error }, '[SheetSOPTab] Adding Statement of Purpose tab returned failure');
        }
    } catch (err) {
        log.error({ sheetId, err: err.message }, '[SheetSOPTab] Non-fatal error inserting SOP sheet tab');
    }
}

// ─── Insert 'More Information' tab on final submission (only if provided) ─────
async function insertMoreInfoSheetTab(sheetId, moreInfo, masterUser) {
    try {
        if (!sheetId || !moreInfo || !moreInfo.trim()) return;
        const scriptPath = path.join(__dirname, '../scripts/insert_more_info_sheet.py');
        const result = await runPythonScript(scriptPath, [
            sheetId,
            masterUser.access_token,
            masterUser.refresh_token,
            moreInfo,
        ]);
        if (result.success) {
            log.info({ sheetId }, '[SheetMoreInfoTab] Added More Information sheet tab successfully');
        } else {
            log.warn({ sheetId, error: result.error }, '[SheetMoreInfoTab] Adding More Information tab returned failure');
        }
    } catch (err) {
        log.error({ sheetId, err: err.message }, '[SheetMoreInfoTab] Non-fatal error inserting More Info sheet tab');
    }
}

// ─── Atomic pool pop ──────────────────────────────────────────────────────────
// SELECT FOR UPDATE SKIP LOCKED ensures two concurrent requests never claim
// the same sheet, even if they hit the DB at the exact same millisecond.

async function atomicPoolPop(type) {
    const t = await sequelize.transaction();
    try {
        const sheet = await SheetPool.findOne({
            where:       { type, assigned_to: null },
            lock:        t.LOCK.UPDATE,
            skipLocked:  true,
            transaction: t,
        });

        if (!sheet) {
            await t.rollback();
            return null;
        }

        await sheet.update(
            { assigned_to: '__pending__', assigned_at: new Date() },
            { transaction: t }
        );

        await t.commit();
        return sheet;
    } catch (err) {
        await t.rollback();
        throw err;
    }
}

// ─── Permission Restore Helper ────────────────────────────────────────────────

async function handleRestore(res, existingSheet, userEmail, type) {
    const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
    if (!masterUser?.access_token) {
        return res.status(500).json({ success: false, message: 'Master account configuration missing.' });
    }

    const restoreArgs = [
        existingSheet.user_sheet_id,
        userEmail,
        masterUser.access_token,
        masterUser.refresh_token,
    ];

    if (driveSemaphore.tryAcquire()) {
        log.info({ userEmail }, `Fast restore for ${userEmail}`);
        try {
            const restoreScript = path.join(__dirname, '../scripts/restore_access.py');
            const result = await runPythonScript(restoreScript, restoreArgs);

            if (!result.success) {
                log.error({ userEmail, error: result.error }, 'Restore access failed');
                return res.status(500).json({ success: false, message: 'Failed to restore access: ' + result.error });
            }

            await existingSheet.update({ student_permission_id: result.student_permission_id });
            log.info({ userEmail, type, permId: result.student_permission_id }, 'Access restored');

            return res.status(200).json({
                success:  true,
                sheet_id: existingSheet.user_sheet_id,
                url:      `https://docs.google.com/spreadsheets/d/${existingSheet.user_sheet_id}`,
                isNew:    false,
            });
        } finally {
            driveSemaphore.release();
        }
    } else {
        log.info({ userEmail }, 'Queue restore (semaphore full)');
        const job = await sheetQueue.add(`restore:${userEmail}`, {
            action:    'restore',
            type,
            userEmail,
            args:      restoreArgs,
        }, {
            jobId: `restore-${type}-${userEmail}-${Date.now()}`,
        });

        return res.status(202).json({
            success: true,
            status:  'queued',
            jobId:   job.id,
            message: 'Restoring your workbook access. Please wait...',
        });
    }
}

// ─── Controller ───────────────────────────────────────────────────────────────

const sheetController = {

    /**
     * GET /api/sheets/workbook
     *
     * Single workbook type (replaces the old 3 types: cultural/sports/academic).
     *
     * Priority order:
     *   1. Already has sheet in DB → return immediately
     *   2. Pool has a sheet → pop + rename + share (~200ms, no semaphore needed)
     *   3. Pool empty (edge case) → live generate_sheet.py (original flow)
     *                               + trigger emergency pool refill
     */
    async getSheet(req, res) {
        try {
            const userEmail = req.user.email;
            const type      = req.params.type;

            // Only 'workbook' type is supported now
            if (type !== 'workbook') {
                return res.status(400).json({ success: false, message: 'Invalid sheet type. Use "workbook".' });
            }

            const Model = AcademicUserSheet; // Reusing AcademicUserSheet as the single sheet tracker

            // ── 1. Already has a sheet ───────────────────────────────────────
            const existingSheet = await Model.findOne({ where: { email: userEmail } });
            if (existingSheet) {
                if (!existingSheet.student_permission_id) {
                    return await handleRestore(res, existingSheet, userEmail, type);
                }
                return res.status(200).json({
                    success:  true,
                    sheet_id: existingSheet.user_sheet_id,
                    url:      `https://docs.google.com/spreadsheets/d/${existingSheet.user_sheet_id}`,
                    isNew:    false,
                });
            }

            // ── 2. Fetch student metadata & master account ───────────────────
            const student = await StudentData.findOne({ where: { email_id: userEmail } });
            if (!student?.student_cvue_no) {
                return res.status(404).json({ success: false, message: 'Student registration data not found.' });
            }
            const studentId = student.student_cvue_no.toString();

            const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
            if (!masterUser?.access_token) {
                return res.status(500).json({ success: false, message: 'Master account configuration missing.' });
            }

            // ── 3. Try pool pop ──────────────────────────────────────────────
            const pooled = await atomicPoolPop(type);

            if (pooled) {
                log.info({ userEmail, sheet_id: pooled.sheet_id }, '[Pool] Sheet claimed — running rename+share');

                // ── 3a. Rename + share (2 Drive API calls) ───────────────────
                const displayName = `${NAME_MAP[type]} - ${studentId}`;
                const renameScript = path.join(__dirname, '../scripts/rename_and_share.py');

                let renameResult;
                try {
                    renameResult = await runPythonScript(renameScript, [
                        pooled.sheet_id,
                        userEmail,
                        displayName,
                        masterUser.access_token,
                        masterUser.refresh_token,
                    ]);
                } catch (err) {
                    // Script failed — release pool row so it can be retried
                    await pooled.update({ assigned_to: null, assigned_at: null });
                    log.error({ userEmail, err: err.message }, '[Pool] rename_and_share failed — pool row released');
                    return res.status(500).json({ success: false, message: 'Workbook setup failed: ' + err.message });
                }

                if (!renameResult.success) {
                    await pooled.update({ assigned_to: null, assigned_at: null });
                    log.error({ userEmail, error: renameResult.error }, '[Pool] rename_and_share returned failure — pool row released');
                    return res.status(500).json({ success: false, message: 'Workbook setup failed: ' + renameResult.error });
                }

                // ── 3b. Persist to user sheet table ──────────────────────────
                const [sheet, created] = await Model.findOrCreate({
                    where:    { email: userEmail },
                    defaults: {
                        email:                 userEmail,
                        user_sheet_id:         pooled.sheet_id,
                        student_permission_id: renameResult.student_permission_id,
                    },
                });

                const sheetId = created ? pooled.sheet_id : sheet.user_sheet_id;

                // Mark pool row with final owner (audit trail)
                await pooled.update({ assigned_to: userEmail });

                // ── 3c. Photo formula — best-effort, non-blocking ─────────────
                insertPhotoFormula(sheetId, userEmail, masterUser).catch(() => {});

                // ── 3d. Trigger pool refill if running low ────────────────────
                const remaining = await SheetPool.count({ where: { type, assigned_to: null } });
                if (remaining < LOW_WATER_MARK) {
                    poolQueue
                        .add('low-water-refill', { type }, { jobId: `refill-${type}-${Date.now()}`, priority: 5 })
                        .then(() => log.info({ type, remaining }, '[Pool] Low-water refill enqueued'))
                        .catch(err => log.error({ err: err.message }, '[Pool] Failed to enqueue refill'));
                }

                log.info({ userEmail, sheetId, remaining }, '[Pool] ✅ Workbook assigned via pool');

                return res.status(created ? 201 : 200).json({
                    success:  true,
                    sheet_id: sheetId,
                    url:      `https://docs.google.com/spreadsheets/d/${sheetId}`,
                    isNew:    created,
                });
            }

            // ── 4. Pool exhausted — fallback to live generation ───────────────
            log.warn({ userEmail, type }, '[Pool] Pool empty — falling back to live generation');

            poolQueue
                .add('emergency-refill', { type }, { jobId: `emergency-${type}-${Date.now()}`, priority: 1 })
                .catch(err => log.error({ err: err.message }, '[Pool] Failed to enqueue emergency refill'));

            // ── Fallback: original generate_sheet.py path ────────────────────
            const studentUser = await User.findOne({ where: { email: userEmail } });
            if (!studentUser?.access_token) {
                return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
            }

            const scriptArgs = [
                type, userEmail,
                studentUser.access_token, studentUser.refresh_token,
                MASTER_EMAIL,
                masterUser.access_token,  masterUser.refresh_token,
                FOLDER_ID,
                studentId,
            ];

            if (driveSemaphore.tryAcquire()) {
                log.info({ userEmail, active: driveSemaphore.active }, '[Fallback] Fast path generate');
                try {
                    const scriptPath = path.join(__dirname, '../scripts/generate_sheet.py');
                    const result = await runPythonScript(scriptPath, scriptArgs);

                    if (!result.success) {
                        log.error({ userEmail, error: result.error }, '[Fallback] Python workbook generation error');
                        return res.status(500).json({ success: false, message: 'Workbook generation failed: ' + result.error });
                    }

                    const [sheet, created] = await Model.findOrCreate({
                        where:    { email: userEmail },
                        defaults: {
                            email:                 userEmail,
                            user_sheet_id:         result.sheet_id,
                            student_permission_id: result.student_permission_id,
                        },
                    });

                    const sheetId = created ? result.sheet_id : sheet.user_sheet_id;
                    insertPhotoFormula(sheetId, userEmail, masterUser).catch(() => {});

                    return res.status(created ? 201 : 200).json({
                        success:  true,
                        sheet_id: sheetId,
                        url:      `https://docs.google.com/spreadsheets/d/${sheetId}`,
                        isNew:    created,
                    });
                } finally {
                    driveSemaphore.release();
                }
            } else {
                log.info({ userEmail, active: driveSemaphore.active }, '[Fallback] Queue path (semaphore full)');
                const job = await sheetQueue.add(`generate:${userEmail}`, {
                    action:    'generate',
                    type,
                    userEmail,
                    args:      scriptArgs,
                }, {
                    jobId: `gen-${type}-${userEmail}-${Date.now()}`,
                });

                return res.status(202).json({
                    success: true,
                    status:  'queued',
                    jobId:   job.id,
                    message: 'Your workbook is being generated. Please wait...',
                });
            }

        } catch (error) {
            log.error({ err: error }, 'getSheet error');
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    /**
     * GET /api/sheets/job/:jobId
     * Poll endpoint for queued sheet jobs.
     */
    async checkJobStatus(req, res) {
        try {
            const { jobId } = req.params;
            const result = await getJobStatus(jobId);

            if (result.status === 'not_found') {
                return res.status(404).json({ success: false, status: 'not_found' });
            }
            if (result.status === 'completed') {
                return res.status(200).json({ success: true, status: 'completed', ...result.result });
            }
            if (result.status === 'failed') {
                return res.status(200).json({
                    success: false,
                    status:  'failed',
                    error:   result.error || 'Workbook generation failed. Please try again.',
                });
            }
            return res.status(200).json({ success: true, status: result.status });

        } catch (error) {
            log.error({ err: error }, 'checkJobStatus error');
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    /**
     * GET /api/sheets/pool-status
     * Admin endpoint: shows current pool levels.
     */
    async getPoolStatus(req, res) {
        try {
            const counts = [{
                type: 'workbook',
                available: await SheetPool.count({ where: { type: 'workbook', assigned_to: null } }),
                assigned:  await SheetPool.count({ where: { type: 'workbook', assigned_to: { [require('sequelize').Op.not]: null } } }),
            }];

            return res.status(200).json({ success: true, pool: counts });
        } catch (error) {
            log.error({ err: error }, 'getPoolStatus error');
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    /**
     * POST /api/sheets/:type/revoke
     * Removes student's Drive permission after form submission.
     */
    async revokeAccess(req, res) {
        try {
            const userEmail = req.body.email || req.user.email;
            const type      = req.params.type;

            if (type !== 'workbook') {
                return res.status(400).json({ success: false, message: 'Invalid sheet type.' });
            }

            const sheet = await AcademicUserSheet.findOne({ where: { email: userEmail } });
            if (!sheet) {
                return res.status(404).json({ success: false, message: 'No workbook found for this user.' });
            }
            if (!sheet.student_permission_id) {
                return res.status(200).json({ success: true, message: 'No student permission to revoke.' });
            }

            const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
            if (!masterUser?.access_token) {
                return res.status(500).json({ success: false, message: 'Master account not configured.' });
            }

            revokeStudentAccess(sheet.user_sheet_id, sheet.student_permission_id, masterUser);
            await sheet.update({ student_permission_id: null });

            return res.status(200).json({ success: true, message: 'Access revocation initiated.' });

        } catch (error) {
            log.error({ err: error }, 'revokeAccess error');
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    /**
     * POST /api/sheets/update-template/:type
     * Downloads the master workbook from Drive to local disk, then triggers
     * an immediate pool refill so new copies use the updated template.
     */
    async updateTemplate(req, res) {
        try {
            const type = req.params.type;

            if (type !== 'workbook') {
                return res.status(400).json({ success: false, message: 'Invalid sheet type.' });
            }

            const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
            if (!masterUser?.access_token) {
                return res.status(500).json({ success: false, message: 'Master account not configured.' });
            }

            const scriptPath = path.join(__dirname, '../scripts/update_template.py');
            let result;

            try {
                result = await runPythonScript(scriptPath, [
                    type,
                    masterUser.access_token,
                    masterUser.refresh_token,
                ]);
            } catch (err) {
                log.error({ err: err.message }, 'updateTemplate script error');
                return res.status(500).json({ success: false, message: 'Template update failed internally.' });
            }

            if (!result.success) {
                return res.status(500).json({ success: false, message: 'Drive error: ' + result.error });
            }

            // Trigger immediate pool refill with the new template
            poolQueue
                .add('post-update-refill', { type }, { jobId: `post-update-${type}-${Date.now()}`, priority: 3 })
                .catch(err => log.error({ err: err.message }, '[Pool] Failed to enqueue post-update refill'));

            return res.status(200).json({
                success: true,
                message: (result.message || 'Template updated successfully.') + ' Pool refill started.',
            });

        } catch (error) {
            log.error({ err: error }, 'updateTemplate error');
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    revokeStudentAccess,
    insertPhotoFormula,
    updateSheetPositionCell,
    updateSheetSOPCell,
    insertSopSheetTab,
    insertMoreInfoSheetTab,
};

module.exports = sheetController;