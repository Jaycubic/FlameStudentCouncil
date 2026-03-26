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
 * Fires revoke_access.py in the background — removes only the student's
 * explicit permission entry. The file stays intact in master's Drive.
 *
 * This works cleanly because the file lives in master's private folder,
 * which breaks domain-wide permission inheritance. The student's entry is
 * always explicit → permissions().delete() never 403s.
 *
 * @param {string} fileId               - Google Drive file ID
 * @param {string} studentPermissionId  - Student's Drive permission ID on that file
 * @param {object} masterUser           - Master User record from DB (has tokens)
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
     * GET /api/sheet/:type
     * Generate or retrieve a spreadsheet for the logged-in student.
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
            const [sheet, created] = await Model.findOrCreate({
                where: { email: userEmail },
                defaults: {
                    email: userEmail,
                    user_sheet_id: result.sheet_id,
                    student_permission_id: result.student_permission_id
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

            // Fire permission removal in background — don't block the HTTP response
            revokeStudentAccess(sheet.user_sheet_id, sheet.student_permission_id, masterUser);

            // Null out so we don't attempt a double-revoke
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