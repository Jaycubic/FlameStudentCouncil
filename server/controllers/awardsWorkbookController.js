// server/controllers/awardsWorkbookController.js
const path   = require('path');
const { spawn } = require('child_process');
const { Op }  = require('sequelize');
const {
    TrailblazerAward, SportsPersonAward, CulturalPersonAward,
    SportsUserSheet, CulturalUserSheet, AcademicUserSheet,
    AwardsWorkbook, User, PhotoDriveUpload,
} = require('../models');
const log = require('../utils/logger').child({ module: 'AwardsWorkbook' });
const { syncVerifiedScores } = require('../services/scoresSyncService');

const MASTER_EMAIL        = 'student.awards@flame.edu.in';
const FOLDER_ID           = '1EKS37zB71mAXyGRz5Mu1VxUEZJI2KXyI';
const ATTACHMENT_BASE_URL = 'https://flameawards.in/attachments'; // no-auth static route

// ─── Immutable columns — NEVER updated by either sync direction ───────────────
const IMMUTABLE = new Set(['student_id', 'email', 'name']);

// ─── Whitelisted fields that CAN be synced cloud → local ─────────────────────
const CLOUD_SYNCABLE = [
    'academic_score', 'sports_score', 'cultural_score',
    'sports_verified_score', 'cultural_verified_score',
    'academic_verified_score', 'total_verified_score',
];

// ─── Python runner ────────────────────────────────────────────────────────────
function runPython(scriptPath, args, timeoutMs = 180_000) {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', [scriptPath, ...args]);
        let out = '', err = '';
        proc.stdout.on('data', d => { out += d.toString(); });
        proc.stderr.on('data', d => { err += d.toString(); });

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
    const [sportsRows, culturalRows, trailblazerRows] = await Promise.all([
        SportsPersonAward.findAll(),
        CulturalPersonAward.findAll(),
        TrailblazerAward.findAll(),
    ]);

    // Build email → sheet URL maps
    const emails = [
        ...new Set([
            ...sportsRows.map(r => r.email),
            ...culturalRows.map(r => r.email),
            ...trailblazerRows.map(r => r.email),
        ]),
    ];

    const [sportsSheets, culturalSheets, academicSheets] = await Promise.all([
        SportsUserSheet.findAll({ where: { email: { [Op.in]: emails } }, attributes: ['email', 'user_sheet_id'] }),
        CulturalUserSheet.findAll({ where: { email: { [Op.in]: emails } }, attributes: ['email', 'user_sheet_id'] }),
        AcademicUserSheet.findAll({ where: { email: { [Op.in]: emails } }, attributes: ['email', 'user_sheet_id'] }),
    ]);

    const sportsSheetMap   = Object.fromEntries(sportsSheets.map(s => [s.email, `https://docs.google.com/spreadsheets/d/${s.user_sheet_id}`]));
    const culturalSheetMap = Object.fromEntries(culturalSheets.map(s => [s.email, `https://docs.google.com/spreadsheets/d/${s.user_sheet_id}`]));
    const academicSheetMap = Object.fromEntries(academicSheets.map(s => [s.email, `https://docs.google.com/spreadsheets/d/${s.user_sheet_id}`]));

    // Build student_id → Drive photo file ID map (for =IMAGE() in workbook Photo column)
    const allStudentIds = [
        ...new Set([
            ...sportsRows.map(r => r.student_id).filter(Boolean),
            ...culturalRows.map(r => r.student_id).filter(Boolean),
            ...trailblazerRows.map(r => r.student_id).filter(Boolean),
        ])
    ];
    const photoRecords = allStudentIds.length > 0
        ? await PhotoDriveUpload.findAll({
            where: { student_id: { [Op.in]: allStudentIds } },
            attributes: ['student_id', 'drive_file_id'],
          })
        : [];
    const photoMap = Object.fromEntries(photoRecords.map(p => [p.student_id, p.drive_file_id]));

    const AWARD_MERGE_KEY = {
        'Sports Award':      'sport',
        'Cultural Award':    'cultural',
        'Trailblazer Award': 'trailblazer',
    };
    // Merged PDFs are stored in existing award-type subfolders (no merged/ dir needed)
    const AWARD_SUB_FOLDER = {
        'Sports Award':      'sport',
        'Cultural Award':    'cultural',
        'Trailblazer Award': 'academic',
    };

    const toRow = (r, awardType) => {
        const mergeKey      = AWARD_MERGE_KEY[awardType] || '';
        const sub           = AWARD_SUB_FOLDER[awardType] || '';
        const attachmentUrl = (mergeKey && sub && r.student_id)
            ? `${ATTACHMENT_BASE_URL}/${sub}/${r.student_id}_${mergeKey}_merged.pdf`
            : '';
        return {
            photo_drive_id:           photoMap[r.student_id] || '',
            student_id:               r.student_id   || '',
            name:                     r.name         || '',
            email:                    r.email        || '',
            gender:                   r.gender       || '',
            batch:                    r.batch        || '',
            mobile_number:            r.mobile_number || '',
            academic_score:           r.academic_score || '',
            sports_score:             r.sports_score || '',
            cultural_score:           r.cultural_score || '',
            sports_verified_score:    r.sports_verified_score || '',
            cultural_verified_score:  r.cultural_verified_score || '',
            academic_verified_score:  r.academic_verified_score || '',
            total_verified_score:     r.total_verified_score || '',
            submission_date:          r.submission_date ? new Date(r.submission_date).toISOString().split('T')[0] : '',
            'Sports Sheet Link':      sportsSheetMap[r.email]   || '',
            'Cultural Sheet Link':    culturalSheetMap[r.email] || '',
            'Academic Sheet Link':    academicSheetMap[r.email] || '',
            award_type:               awardType,
            Attachment:               attachmentUrl,
        };
    };

    const sports      = sportsRows.map(r      => toRow(r, 'Sports Award'));
    const cultural    = culturalRows.map(r    => toRow(r, 'Cultural Award'));
    const trailblazer = trailblazerRows.map(r => toRow(r, 'Trailblazer Award'));

    // Sort 'all' by email first (keeps same-student rows adjacent for photo-cell
    // merging in the Python script), then by name for admin readability.
    const all = [...sports, ...cultural, ...trailblazer]
        .sort((a, b) => {
            const emailCmp = (a.email || '').localeCompare(b.email || '');
            if (emailCmp !== 0) return emailCmp;
            return (a.award_type || '').localeCompare(b.award_type || '');
        });

    return { sports, cultural, trailblazer, all };
}

// ─── Check that workbook still exists on Drive ────────────────────────────────
async function workbookExistsOnDrive(workbookId, masterUser) {
    // Quick Sheets API call — if 404 the workbook was deleted
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
            // Verify it still exists on Drive
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
            // Stale — delete record and regenerate
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
            dataB64,
        ]);

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
        // generate_awards_workbook.py uploads an XLSX which may not preserve
        // =IMAGE() through Drive's format conversion. We fire insert_workbook_photos.py
        // separately (same proven pattern as insert_photo_formula.py) after returning.
        setImmediate(async () => {
            try {
                const photoScriptPath = path.join(__dirname, '../scripts/insert_workbook_photos.py');
                // Build photo payload: { tabName: [{ photo_drive_id, email }, ...] }
                const photoPayload = {
                    AllAwards:        data.all.map(r        => ({ photo_drive_id: r.photo_drive_id || '', email: r.email || '' })),
                    SportsAward:      data.sports.map(r     => ({ photo_drive_id: r.photo_drive_id || '', email: r.email || '' })),
                    CulturalAward:    data.cultural.map(r   => ({ photo_drive_id: r.photo_drive_id || '', email: r.email || '' })),
                    TrailblazerAward: data.trailblazer.map(r=> ({ photo_drive_id: r.photo_drive_id || '', email: r.email || '' })),
                };
                const photoB64 = Buffer.from(JSON.stringify(photoPayload)).toString('base64');
                const photoResult = await runPython(photoScriptPath, [
                    result.sheet_id,
                    masterUser.access_token,
                    masterUser.refresh_token,
                    photoB64,
                ]);
                if (photoResult.success) {
                    log.info({ workbook_id: result.sheet_id }, '[Workbook] ✅ Photo formulas inserted');
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

        // MODEL_LIST maps each model to its awardType key for score propagation
        const MODEL_LIST = [
            { Model: SportsPersonAward,   type: 'sports' },
            { Model: CulturalPersonAward, type: 'cultural' },
            { Model: TrailblazerAward,    type: 'trailblazer' },
        ];

        for (const cloudRow of rows) {
            const sid = cloudRow.student_id?.trim();
            if (!sid) { skipped++; continue; }

            // Build safe update object (never touch immutable fields)
            const updates = {};
            for (const field of CLOUD_SYNCABLE) {
                if (cloudRow[field] !== undefined) {
                    updates[field] = cloudRow[field] === '' ? null : cloudRow[field];
                }
            }
            if (Object.keys(updates).length === 0) { skipped++; continue; }

            // Update EVERY table that has this student, then propagate scores
            let found = false;
            for (const { Model, type } of MODEL_LIST) {
                const record = await Model.findOne({ where: { student_id: sid } });
                if (record) {
                    // Only apply fields that are relevant to this model
                    const relevant = {};
                    for (const [k, v] of Object.entries(updates)) {
                        if (record.rawAttributes && record.rawAttributes[k]) relevant[k] = v;
                    }
                    if (Object.keys(relevant).length > 0) {
                        await record.update(relevant);
                        // Propagate cross-table in background
                        setImmediate(() => syncVerifiedScores(record.email, type, relevant));
                        updated++;
                        found = true;
                    }
                }
            }
            if (!found) skipped++;
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
            dataB64,
        ]);

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
