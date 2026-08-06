// server/controllers/awardsWorkbookController.js
//
// Admin workbook controller — generates/syncs a Google Sheets workbook
// containing all election form responses for admin review.
// Adapted from the old 3-award-table approach to single ElectionFormResponse.

const path   = require('path');
const fs     = require('fs');
const { spawn } = require('child_process');
const { Op }  = require('sequelize');
const {
    ElectionFormResponse,
    AcademicUserSheet,
    AwardsWorkbook, User,
} = require('../models');
const log = require('../utils/logger').child({ module: 'AwardsWorkbook' });
const { syncVerifiedScores } = require('../services/scoresSyncService');

const MASTER_EMAIL        = 'student.awards@flame.edu.in';
const FOLDER_ID           = process.env.GOOGLE_DRIVE_FOLDER_ID || '1GBzDVaUcwehFAMrziH9zt8Cnjx-sN7ly';
const ATTACHMENT_BASE_URL = 'https://flamestudentcouncil.in/api/attachments';
const PHOTO_BASE_URL      = 'https://flamestudentcouncil.in/api/photos';
const LOCAL_PHOTOS_DIR    = '/opt/View/StudentTrackingSystem/server/Photos';

/**
 * Returns the local server URL for a student's photo if the file exists on disk.
 */
function getLocalPhotoUrl(studentId) {
    if (!studentId) return '';
    const exts = ['.jpg', '.jpeg', '.png'];
    for (const ext of exts) {
        if (fs.existsSync(path.join(LOCAL_PHOTOS_DIR, `${studentId}${ext}`))) {
            return `${PHOTO_BASE_URL}/${studentId}`;
        }
    }
    return '';
}

// ─── Immutable columns — NEVER updated by either sync direction ───────────────
const IMMUTABLE = new Set(['student_id', 'email', 'name']);

// ─── Whitelisted fields that CAN be synced cloud → local ─────────────────────
const CLOUD_SYNCABLE = [
    'academic_score', 'sports_score', 'cultural_score',
    'sports_verified_score', 'cultural_verified_score',
    'academic_verified_score', 'total_verified_score',
];

// ─── Python runner ────────────────────────────────────────────────────────────
function runPython(scriptPath, args, timeoutMs = 180_000, stdinData = null) {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', [scriptPath, ...args]);
        let out = '', err = '';
        proc.stdout.on('data', d => { out += d.toString(); });
        proc.stderr.on('data', d => { err += d.toString(); });

        if (stdinData !== null) {
            try {
                proc.stdin.write(stdinData);
                proc.stdin.end();
            } catch (e) {
                reject(new Error(`Failed to write to python stdin: ${e.message}`));
                return;
            }
        }

        const timer = setTimeout(() => {
            proc.kill('SIGTERM');
            reject(new Error('Python script timed out'));
        }, timeoutMs);

        proc.on('close', code => {
            clearTimeout(timer);
            try {
                resolve(JSON.parse(out.trim()));
            } catch {
                reject(new Error(`Non-JSON output (exit ${code}): ${out.slice(0, 200)} | stderr: ${err.slice(0, 200)}`));
            }
        });
    });
}

// ─── Collect all data for workbook generation / cloud push ───────────────────
async function collectAllData() {
    const allRows = await ElectionFormResponse.findAll();

    // Build email → sheet URL map (single workbook type)
    const emails = [...new Set(allRows.map(r => r.email))];

    const workbookSheets = await AcademicUserSheet.findAll({
        where: { email: { [Op.in]: emails } },
        attributes: ['email', 'user_sheet_id']
    });
    const sheetMap = Object.fromEntries(
        workbookSheets.map(s => [s.email, `https://docs.google.com/spreadsheets/d/${s.user_sheet_id}`])
    );

    // Photo check
    const allStudentIds = [
        ...new Set(allRows.map(r => (r.student_id || '').toString().trim()).filter(Boolean))
    ];
    const withPhoto    = allStudentIds.filter(sid => getLocalPhotoUrl(sid) !== '').length;
    const withoutPhoto = allStudentIds.length - withPhoto;
    log.info({ total: allStudentIds.length, withPhoto, withoutPhoto },
        '[Workbook] Local photo disk check complete');

    const toRow = (r) => {
        const sid = (r.student_id || '').toString().trim();
        const attachmentUrl = sid
            ? `${ATTACHMENT_BASE_URL}/election/${sid}_election_merged.pdf`
            : '';
        return {
            photo_url:                getLocalPhotoUrl(sid),
            student_id:               sid,
            name:                     r.name         || '',
            email:                    r.email        || '',
            gender:                   r.gender       || '',
            batch:                    r.batch        || '',
            mobile_number:            r.mobile_number || '',
            position_selected:        r.position_selected || '',
            community_service:        r.community_service || '',
            statement_of_purpose:     r.statement_of_purpose || '',
            more_info:                r.more_info || '',
            read_handbook:            r.read_handbook ? 'True' : 'False',
            not_on_probation:         r.not_on_probation ? 'True' : 'False',
            tru_statement:            r.tru_statement ? 'True' : 'False',
            academic_score:           r.academic_score || '',
            sports_score:             r.sports_score || '',
            cultural_score:           r.cultural_score || '',
            sports_verified_score:    r.sports_verified_score || '',
            cultural_verified_score:  r.cultural_verified_score || '',
            academic_verified_score:  r.academic_verified_score || '',
            total_verified_score:     r.total_verified_score ? parseFloat(r.total_verified_score).toFixed(2) : '',
            submission_date:          r.submission_date ? new Date(r.submission_date).toISOString().split('T')[0] : '',
            'Workbook Link':          sheetMap[r.email]   || '',
            Attachment:               attachmentUrl,
        };
    };

    const all = allRows
        .map(r => toRow(r))
        .sort((a, b) => {
            const emailCmp = (a.email || '').localeCompare(b.email || '');
            if (emailCmp !== 0) return emailCmp;
            return (a.position_selected || '').localeCompare(b.position_selected || '');
        });

    // Group by position for per-position tabs
    const byPosition = {};
    all.forEach(row => {
        const pos = row.position_selected || 'Unspecified';
        if (!byPosition[pos]) byPosition[pos] = [];
        byPosition[pos].push(row);
    });

    return { all, byPosition };
}

// ─── Check that workbook still exists on Drive ────────────────────────────────
async function workbookExistsOnDrive(workbookId, masterUser) {
    const scriptPath = path.join(__dirname, '../scripts/sync_workbook_to_local.py');
    try {
        const result = await runPython(scriptPath, [
            workbookId,
            masterUser.access_token,
            masterUser.refresh_token,
        ], 30_000);
        return result.success !== false;
    } catch {
        return false;
    }
}

// ─── Controller ───────────────────────────────────────────────────────────────

async function openOrCreate(req, res) {
    try {
        const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
        if (!masterUser?.access_token) {
            return res.status(500).json({ success: false, message: 'Master account not configured.' });
        }

        // 1. Check DB for existing workbook ID
        let workbook = await AwardsWorkbook.findOne();

        if (workbook) {
            const alive = await workbookExistsOnDrive(workbook.workbook_id, masterUser);
            if (alive) {
                log.info({ workbook_id: workbook.workbook_id }, '[Workbook] Returning existing workbook');
                return res.json({
                    success: true,
                    isNew:   false,
                    url:     `https://docs.google.com/spreadsheets/d/${workbook.workbook_id}/edit`,
                    workbook_id: workbook.workbook_id,
                });
            }
            log.warn({ workbook_id: workbook.workbook_id }, '[Workbook] Drive file gone — regenerating');
            await workbook.destroy();
            workbook = null;
        }

        // 2. Collect data and generate new workbook
        log.info('[Workbook] Generating new workbook …');
        const data    = await collectAllData();
        const dataB64 = Buffer.from(JSON.stringify(data)).toString('base64');

        const scriptPath = path.join(__dirname, '../scripts/generate_awards_workbook.py');
        const result = await runPython(scriptPath, [
            masterUser.access_token,
            masterUser.refresh_token,
            FOLDER_ID,
        ], 180_000, dataB64);

        if (!result.success) {
            log.error({ error: result.error }, '[Workbook] Generation failed');
            return res.status(500).json({ success: false, message: result.error });
        }

        // 3. Store in DB
        workbook = await AwardsWorkbook.create({
            workbook_id: result.sheet_id,
            created_at:  new Date(),
            updated_at:  new Date(),
        });

        log.info({ workbook_id: result.sheet_id }, '[Workbook] Created and stored');

        // ── Background: insert =IMAGE() formulas via Sheets API ───────────────
        setImmediate(async () => {
            try {
                const photoScriptPath = path.join(__dirname, '../scripts/insert_workbook_photos.py');
                const photoPayload = {
                    'All Responses': data.all.map(r => ({ photo_url: r.photo_url || '', email: r.email || '' })),
                };
                const usedTitles = new Set(['All Responses']);
                for (const [posName, posRows] of Object.entries(data.byPosition)) {
                    let safeTitle = posName.slice(0, 31).replace(/[\[\]\*:\?\/\\\]/g, '');
                    if (!safeTitle || usedTitles.has(safeTitle)) {
                        safeTitle = `${safeTitle.slice(0, 27)}_${usedTitles.size}`;
                    }
                    usedTitles.add(safeTitle);
                    photoPayload[safeTitle] = posRows.map(r => ({ photo_url: r.photo_url || '', email: r.email || '' }));
                }

                for (const [tab, rows] of Object.entries(photoPayload)) {
                    const withPhoto = rows.filter(r => r.photo_url).length;
                    log.info({ tab, total: rows.length, withPhoto }, '[Workbook] Photo payload stats');
                }

                const photoB64 = Buffer.from(JSON.stringify(photoPayload)).toString('base64');
                const photoResult = await runPython(photoScriptPath, [
                    result.sheet_id,
                    masterUser.access_token,
                    masterUser.refresh_token,
                    photoB64,
                ]);
                if (photoResult.success) {
                    log.info({
                        workbook_id: result.sheet_id,
                        stats: photoResult.stats,
                    }, '[Workbook] ✅ Photo formulas inserted');
                } else {
                    log.warn({ error: photoResult.error }, '[Workbook] Photo insertion failed (non-fatal)');
                }
            } catch (photoErr) {
                log.error({ err: photoErr.message }, '[Workbook] Photo script error (non-fatal)');
            }
        });

        return res.json({
            success:     true,
            isNew:       true,
            url:         result.url,
            workbook_id: result.sheet_id,
        });

    } catch (err) {
        log.error({ err: err.message }, '[Workbook] openOrCreate error');
        return res.status(500).json({ success: false, message: err.message });
    }
}

// ─── Sync cloud → local ───────────────────────────────────────────────────────
async function syncFromCloud(req, res) {
    try {
        const workbook = await AwardsWorkbook.findOne();
        if (!workbook) {
            return res.status(404).json({ success: false, message: 'No workbook found. Open the Google Sheet first.' });
        }

        const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
        if (!masterUser?.access_token) {
            return res.status(500).json({ success: false, message: 'Master account not configured.' });
        }

        const scriptPath = path.join(__dirname, '../scripts/sync_workbook_to_local.py');
        const result = await runPython(scriptPath, [
            workbook.workbook_id,
            masterUser.access_token,
            masterUser.refresh_token,
        ]);

        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error });
        }

        const rows = result.rows || [];
        let updated = 0, skipped = 0;

        for (const cloudRow of rows) {
            const sid = cloudRow.student_id?.trim();
            if (!sid) { skipped++; continue; }

            // Build safe update object (never touch immutable fields)
            const updates = {};
            for (const field of CLOUD_SYNCABLE) {
                if (cloudRow[field] !== undefined) {
                    let val = cloudRow[field] === '' ? null : cloudRow[field];
                    if (val !== null && field === 'total_verified_score') {
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) val = parsed.toFixed(2);
                    }
                    updates[field] = val;
                }
            }
            if (Object.keys(updates).length === 0) { skipped++; continue; }

            // Update ElectionFormResponse for this student
            const record = await ElectionFormResponse.findOne({ where: { student_id: sid } });
            if (record) {
                await record.update(updates);
                setImmediate(() => syncVerifiedScores(record.email, updates));
                updated++;
            } else {
                skipped++;
            }
        }

        log.info({ updated, skipped }, '[Workbook] Cloud → local sync complete');
        return res.json({ success: true, updated, skipped, total: rows.length });

    } catch (err) {
        log.error({ err: err.message }, '[Workbook] syncFromCloud error');
        return res.status(500).json({ success: false, message: err.message });
    }
}

// ─── Sync local → cloud ───────────────────────────────────────────────────────
async function syncToCloud(req, res) {
    try {
        const workbook = await AwardsWorkbook.findOne();
        if (!workbook) {
            return res.status(404).json({ success: false, message: 'No workbook found. Open the Google Sheet first.' });
        }

        const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
        if (!masterUser?.access_token) {
            return res.status(500).json({ success: false, message: 'Master account not configured.' });
        }

        const data    = await collectAllData();
        const dataB64 = Buffer.from(JSON.stringify(data)).toString('base64');
        const scriptPath = path.join(__dirname, '../scripts/sync_local_to_workbook.py');

        const result = await runPython(scriptPath, [
            workbook.workbook_id,
            masterUser.access_token,
            masterUser.refresh_token,
        ], 180_000, dataB64);

        if (!result.success) {
            return res.status(500).json({ success: false, message: result.error });
        }

        log.info({ tabs: result.tabs_updated }, '[Workbook] Local → cloud sync complete');
        return res.json({ success: true, tabs_updated: result.tabs_updated });

    } catch (err) {
        log.error({ err: err.message }, '[Workbook] syncToCloud error');
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { openOrCreate, syncFromCloud, syncToCloud };
