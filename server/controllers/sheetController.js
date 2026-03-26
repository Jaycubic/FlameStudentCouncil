// controllers/sheetController.js
const { CulturalUserSheet, SportsUserSheet, User } = require('../models');
const { spawn } = require('child_process');
const path = require('path');
const { sheetQueue, getJobStatus } = require('../queues/sheetQueue');

const MASTER_EMAIL = 'student.awards@flame.edu.in';
const FOLDER_ID = '1EKS37zB71mAXyGRz5Mu1VxUEZJI2KXyI';

// ─── Concurrency Semaphore ────────────────────────────────────────────────────
// Fast-path limit: 3 concurrent synchronous operations.
// When full, new requests overflow to the BullMQ queue (async path).
class Semaphore {
    constructor(limit) {
        this.limit = limit;
        this.count = 0;
    }
    // Non-blocking: returns true if acquired, false if full
    tryAcquire() {
        if (this.count < this.limit) {
            this.count++;
            return true;
        }
        return false;
    }
    release() {
        this.count--;
    }
    get active() { return this.count; }
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
        masterUser.refresh_token
    ], { detached: true, stdio: 'ignore' });

    proc.unref();

    proc.on('error', err => {
        console.error(`[RevokeAccess] Failed to spawn revoke script for file ${fileId}:`, err.message);
    });
}

// ─── Controller ───────────────────────────────────────────────────────────────

const sheetController = {

    /**
     * GET /api/sheets/:type
     * Hybrid: fast path (semaphore) or async path (BullMQ queue).
     *
     * - If semaphore has capacity → run Python synchronously → instant response
     * - If semaphore is full → enqueue BullMQ job → return 202 + jobId for polling
     */
    async getSheet(req, res) {
        try {
            const userEmail = req.user.email;
            const type = req.params.type;

            if (!['cultural', 'sports'].includes(type)) {
                return res.status(400).json({ success: false, message: 'Invalid sheet type.' });
            }

            const Model = type === 'cultural' ? CulturalUserSheet : SportsUserSheet;

            // ── 1. Check DB (fast path) ──────────────────────────────────────
            const existingSheet = await Model.findOne({ where: { email: userEmail } });
            if (existingSheet) {
                // If permission was revoked (prior submission), re-grant access
                if (!existingSheet.student_permission_id) {
                    return await this._handleRestore(res, existingSheet, userEmail, type);
                }

                return res.status(200).json({
                    success: true,
                    sheet_id: existingSheet.user_sheet_id,
                    url: `https://docs.google.com/spreadsheets/d/${existingSheet.user_sheet_id}`,
                    isNew: false
                });
            }

            // ── 2. Fetch tokens ──────────────────────────────────────────────
            const studentUser = await User.findOne({ where: { email: userEmail } });
            if (!studentUser?.access_token) {
                return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
            }

            const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
            if (!masterUser?.access_token) {
                return res.status(500).json({ success: false, message: 'Master account configuration missing.' });
            }

            const scriptArgs = [
                type, userEmail,
                studentUser.access_token, studentUser.refresh_token,
                MASTER_EMAIL,
                masterUser.access_token, masterUser.refresh_token,
                FOLDER_ID
            ];

            // ── 3. Hybrid: try semaphore, fallback to queue ──────────────────
            if (driveSemaphore.tryAcquire()) {
                // FAST PATH — run synchronously
                console.log(`[SheetController] Fast path for ${userEmail} (${driveSemaphore.active}/3 active)`);
                try {
                    const scriptPath = path.join(__dirname, '../scripts/generate_sheet.py');
                    const result = await runPythonScript(scriptPath, scriptArgs);

                    if (!result.success) {
                        console.error('[SheetController] Python error:', result.error);
                        return res.status(500).json({ success: false, message: 'Sheet generation failed: ' + result.error });
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

                    const sheetId = created ? result.sheet_id : sheet.user_sheet_id;
                    return res.status(created ? 201 : 200).json({
                        success: true,
                        sheet_id: sheetId,
                        url: `https://docs.google.com/spreadsheets/d/${sheetId}`,
                        isNew: created
                    });
                } finally {
                    driveSemaphore.release();
                }
            } else {
                // QUEUE PATH — semaphore full, offload to BullMQ
                console.log(`[SheetController] Queue path for ${userEmail} (semaphore full: ${driveSemaphore.active}/3)`);
                const job = await sheetQueue.add(`generate:${userEmail}`, {
                    action: 'generate',
                    type,
                    userEmail,
                    args: scriptArgs
                }, {
                    jobId: `gen-${type}-${userEmail}-${Date.now()}`
                });

                return res.status(202).json({
                    success: true,
                    status: 'queued',
                    jobId: job.id,
                    message: 'Your sheet is being generated. Please wait...'
                });
            }

        } catch (error) {
            console.error('[SheetController] getSheet error:', error);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    /**
     * Handle permission restore — hybrid fast/queue path.
     * Called when a sheet exists in DB but permission was revoked.
     */
    async _handleRestore(res, existingSheet, userEmail, type) {
        const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
        if (!masterUser?.access_token) {
            return res.status(500).json({ success: false, message: 'Master account configuration missing.' });
        }

        const restoreArgs = [
            existingSheet.user_sheet_id,
            userEmail,
            masterUser.access_token,
            masterUser.refresh_token
        ];

        if (driveSemaphore.tryAcquire()) {
            // FAST PATH
            console.log(`[SheetController] Fast restore for ${userEmail}`);
            try {
                const restoreScript = path.join(__dirname, '../scripts/restore_access.py');
                const result = await runPythonScript(restoreScript, restoreArgs);

                if (!result.success) {
                    console.error('[SheetController] Restore error:', result.error);
                    return res.status(500).json({ success: false, message: 'Failed to restore access: ' + result.error });
                }

                await existingSheet.update({ student_permission_id: result.student_permission_id });
                console.log(`[SheetController] Restored ${userEmail} on ${type}. permId: ${result.student_permission_id}`);

                return res.status(200).json({
                    success: true,
                    sheet_id: existingSheet.user_sheet_id,
                    url: `https://docs.google.com/spreadsheets/d/${existingSheet.user_sheet_id}`,
                    isNew: false
                });
            } finally {
                driveSemaphore.release();
            }
        } else {
            // QUEUE PATH
            console.log(`[SheetController] Queue restore for ${userEmail} (semaphore full)`);
            const job = await sheetQueue.add(`restore:${userEmail}`, {
                action: 'restore',
                type,
                userEmail,
                args: restoreArgs
            }, {
                jobId: `restore-${type}-${userEmail}-${Date.now()}`
            });

            return res.status(202).json({
                success: true,
                status: 'queued',
                jobId: job.id,
                message: 'Restoring your sheet access. Please wait...'
            });
        }
    },

    /**
     * GET /api/sheets/job/:jobId
     * Poll endpoint for queued sheet jobs.
     * Frontend calls this every 3s until status is 'completed' or 'failed'.
     */
    async checkJobStatus(req, res) {
        try {
            const { jobId } = req.params;
            const result = await getJobStatus(jobId);

            if (result.status === 'not_found') {
                return res.status(404).json({ success: false, status: 'not_found' });
            }

            if (result.status === 'completed') {
                return res.status(200).json({
                    success: true,
                    status: 'completed',
                    ...result.result
                });
            }

            if (result.status === 'failed') {
                return res.status(200).json({
                    success: false,
                    status: 'failed',
                    error: result.error || 'Sheet generation failed. Please try again.'
                });
            }

            // 'waiting', 'active', 'delayed'
            return res.status(200).json({
                success: true,
                status: result.status
            });

        } catch (error) {
            console.error('[SheetController] checkJobStatus error:', error);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    /**
     * POST /api/sheets/:type/revoke
     * Removes student's Drive permission. File stays in master's Drive.
     */
    async revokeAccess(req, res) {
        try {
            const userEmail = req.body.email || req.user.email;
            const type = req.params.type;

            if (!['cultural', 'sports'].includes(type)) {
                return res.status(400).json({ success: false, message: 'Invalid sheet type.' });
            }

            const Model = type === 'cultural' ? CulturalUserSheet : SportsUserSheet;
            const sheet = await Model.findOne({ where: { email: userEmail } });

            if (!sheet) {
                return res.status(404).json({ success: false, message: 'No sheet found for this user.' });
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
            console.error('[SheetController] revokeAccess error:', error);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    /**
     * PUT /api/admin/template/:type
     * Update the local template from master Drive. Admin only.
     */
    async updateTemplate(req, res) {
        try {
            const type = req.params.type;

            if (!['cultural', 'sports'].includes(type)) {
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
                    masterUser.refresh_token
                ]);
            } catch (err) {
                console.error('[SheetController] updateTemplate script error:', err.message);
                return res.status(500).json({ success: false, message: 'Template update failed internally.' });
            }

            if (result.success) {
                return res.status(200).json({ success: true, message: 'Template updated successfully.' });
            } else {
                return res.status(500).json({ success: false, message: 'Drive error: ' + result.error });
            }

        } catch (error) {
            console.error('[SheetController] updateTemplate error:', error);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    revokeStudentAccess
};

module.exports = sheetController;