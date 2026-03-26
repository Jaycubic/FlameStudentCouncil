// controllers/sheetController.js
const { CulturalUserSheet, SportsUserSheet, User } = require('../models');
const { spawn } = require('child_process');
const path = require('path');

const MASTER_EMAIL = 'student.awards@flame.edu.in';

// ─── Concurrency Semaphore ────────────────────────────────────────────────────
class Semaphore {
    constructor(limit) {
        this.limit = limit;
        this.count = 0;
        this.queue = [];
    }
    acquire() {
        return new Promise(resolve => {
            if (this.count < this.limit) { this.count++; resolve(); }
            else this.queue.push(resolve);
        });
    }
    release() {
        this.count--;
        if (this.queue.length > 0) { this.count++; this.queue.shift()(); }
    }
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
 * Fires revoke_access.py in the background — deletes the Drive file entirely.
 * Master owns the file, so this succeeds cleanly with no permission edge cases.
 * The file disappears from the student's "Shared with me" immediately.
 *
 * @param {string} fileId      - Google Drive file ID to permanently delete
 * @param {object} masterUser  - Master User record from DB (has tokens)
 */
function revokeStudentAccess(fileId, masterUser) {
    const scriptPath = path.join(__dirname, '../scripts/revoke_access.py');

    const proc = spawn('python3', [
        scriptPath,
        fileId,
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
                return res.status(200).json({
                    success: true,
                    sheet_id: existingSheet.user_sheet_id,
                    url: `https://docs.google.com/spreadsheets/d/${existingSheet.user_sheet_id}`,
                    isNew: false
                });
            }

            // ── 2. Fetch student tokens ──────────────────────────────────────
            const studentUser = await User.findOne({ where: { email: userEmail } });
            if (!studentUser?.access_token) {
                return res.status(401).json({
                    success: false,
                    message: 'Session expired. Please log in again.'
                });
            }

            // ── 2b. Fetch master tokens ──────────────────────────────────────
            const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
            if (!masterUser?.access_token) {
                return res.status(500).json({
                    success: false,
                    message: 'Master account configuration missing. Please contact admin.'
                });
            }

            const folderId = '1EKS37zB71mAXyGRz5Mu1VxUEZJI2KXyI';

            // ── 3. Run Python under semaphore ────────────────────────────────
            const scriptPath = path.join(__dirname, '../scripts/generate_sheet.py');
            let result;

            await driveSemaphore.acquire();
            try {
                result = await runPythonScript(scriptPath, [
                    type,
                    userEmail,
                    studentUser.access_token,
                    studentUser.refresh_token,
                    MASTER_EMAIL,
                    masterUser.access_token,
                    masterUser.refresh_token,
                    folderId
                ]);
            } finally {
                driveSemaphore.release();
            }

            if (!result.success) {
                console.error('[SheetController] Python error:', result.error);
                return res.status(500).json({
                    success: false,
                    message: 'Google API error during sheet generation: ' + result.error
                });
            }

            // ── 4. Atomic DB write ───────────────────────────────────────────
            // student_permission_id is no longer needed — kept null, or you can
            // remove the column entirely from the model after a migration.
            const [sheet, created] = await Model.findOrCreate({
                where: { email: userEmail },
                defaults: {
                    email: userEmail,
                    user_sheet_id: result.sheet_id
                }
            });

            if (!created) {
                console.warn(`[SheetController] Race: duplicate sheet for ${userEmail}. Orphan: ${result.sheet_id}`);
                return res.status(200).json({
                    success: true,
                    sheet_id: sheet.user_sheet_id,
                    url: `https://docs.google.com/spreadsheets/d/${sheet.user_sheet_id}`,
                    isNew: false
                });
            }

            return res.status(201).json({
                success: true,
                sheet_id: result.sheet_id,
                url: `https://docs.google.com/spreadsheets/d/${result.sheet_id}`,
                isNew: true
            });

        } catch (error) {
            console.error('[SheetController] getSheet error:', error);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    },

    /**
     * POST /api/sheet/:type/revoke
     * Called after form submission. Permanently deletes the student's sheet.
     * Since master owns the file, this is a clean single-API-call operation.
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

            const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
            if (!masterUser?.access_token) {
                return res.status(500).json({ success: false, message: 'Master account not configured.' });
            }

            // Fire delete in background — don't block the HTTP response
            revokeStudentAccess(sheet.user_sheet_id, masterUser);

            // Null out the sheet ID so we don't try to delete twice
            await sheet.update({ user_sheet_id: null });

            return res.status(200).json({ success: true, message: 'Sheet deletion initiated.' });

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