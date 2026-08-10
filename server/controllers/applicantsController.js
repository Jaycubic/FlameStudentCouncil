// server/controllers/applicantsController.js
//
// Unified election applicants controller.
// Single ElectionFormResponse table replaces the old 3-award-table approach.

const path = require('path');
const fs   = require('fs');
const { ElectionFormResponse, ElectionAttachment,
        AcademicUserSheet } = require('../models');
const { Op } = require('sequelize');

const ATTACHMENT_DIR  = '/opt/View/FlameStudentCouncil/server/Attachments';
const MERGED_PDF_BASE = 'https://flamestudentcouncil.in/api/attachments';
const PHOTO_DIR       = '/opt/View/StudentTrackingSystem/server/Photos';

const LIST_FIELDS = [
    'id', 'name', 'student_id', 'gender', 'batch', 'email',
    'position_selected',
    'sports_score', 'cultural_score', 'academic_score',
    'sports_verified_score', 'cultural_verified_score', 'academic_verified_score',
    'total_verified_score',
    'submission_date', 'status', 'photo'
];

function buildWhere(search, gender, batch, position) {
    const where = {};
    if (gender)   where.gender = gender;
    if (batch)    where.batch  = batch;
    if (position) where.position_selected = position;
    if (search) {
        where[Op.or] = [
            { name:       { [Op.iLike]: `%${search}%` } },
            { student_id: { [Op.iLike]: `%${search}%` } },
            { email:      { [Op.iLike]: `%${search}%` } },
        ];
    }
    return where;
}

function sortRows(rows, sortField, sortDir) {
    if (!sortField) return rows;
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
        const av = parseFloat(a[sortField]);
        const bv = parseFloat(b[sortField]);
        if (!isNaN(av) && !isNaN(bv)) return (av - bv) * dir;
        return ('' + (a[sortField] ?? '')).localeCompare('' + (b[sortField] ?? '')) * dir;
    });
}

async function getApplicants(req, res) {
    try {
        const {
            search     = '',
            position   = '',
            gender     = '',
            batch      = '',
            sort_field = '',
            sort_dir   = 'asc',
            page       = 1,
            limit      = 50,
        } = req.query;

        const where = buildWhere(search.trim(), gender.trim(), batch.trim(), position.trim());

        let rows = await ElectionFormResponse.findAll({
            where,
            attributes: LIST_FIELDS,
        });

        let data = rows.map(r => {
            const obj = r.toJSON();
            // Recompute total_verified_score in real-time including director bonus scores
            const sv = parseFloat(obj.sports_verified_score)   || parseFloat(obj.sports_score)   || 0;
            const cv = parseFloat(obj.cultural_verified_score) || parseFloat(obj.cultural_score) || 0;
            const av = parseFloat(obj.academic_verified_score) || parseFloat(obj.academic_score) || 0;
            const sd = parseFloat(obj.sports_director_score)   || 0;
            const cd = parseFloat(obj.cultural_director_score) || 0;
            obj.total_verified_score = Math.min(30, parseFloat((sv + cv + av + sd + cd).toFixed(2))).toFixed(2);
            return obj;
        });

        // Sort
        if (sort_field) {
            data = sortRows(data, sort_field, sort_dir);
        } else {
            data.sort((a, b) => new Date(b.submission_date) - new Date(a.submission_date));
        }

        // Paginate
        const total     = data.length;
        const pageNum   = Math.max(1, parseInt(page));
        const limitNum  = Math.max(1, Math.min(200, parseInt(limit)));
        const pages     = Math.ceil(total / limitNum) || 1;
        const paginated = data.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        // Filter dropdown values
        const allRows = await ElectionFormResponse.findAll({
            attributes: ['gender', 'batch', 'position_selected']
        });
        const genders   = [...new Set(allRows.map(r => r.gender).filter(Boolean))].sort();
        const batches   = [...new Set(allRows.map(r => r.batch).filter(Boolean))].sort();
        const positions = [...new Set(allRows.map(r => r.position_selected).filter(Boolean))].sort();

        return res.json({
            success: true,
            total,
            page:  pageNum,
            pages,
            limit: limitNum,
            data:  paginated,
            filters: { genders, batches, positions },
        });
    } catch (err) {
        console.error('[Applicants] Error:', err.message, err.stack);
        return res.status(500).json({ success: false, message: err.message });
    }
}


// ─── Full profile for the modal ───────────────────────────────────────────────
// GET /api/applicants/profile/:id

async function getApplicantProfile(req, res) {
    try {
        const { id } = req.params;

        const record = await ElectionFormResponse.findByPk(id);
        if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

        const email = record.email;

        // Fetch workbook sheet link and attachments in parallel
        const [workbookSheet, attachments] = await Promise.all([
            AcademicUserSheet.findOne({ where: { email }, attributes: ['user_sheet_id'] }),
            ElectionAttachment.findAll({ where: { submission_id: id }, attributes: ['id', 'file_name'] }),
        ]);

        // Merged PDF
        const sid        = (record.student_id || '').toString().trim();
        const mergedFile = sid ? `${sid}_election_merged.pdf` : null;
        const mergedPdfUrl = mergedFile && fs.existsSync(path.join(ATTACHMENT_DIR, 'election', mergedFile))
            ? `${MERGED_PDF_BASE}/election/${mergedFile}`
            : null;

        return res.json({
            success: true,
            data: {
                ...record.toJSON(),
                sheets: {
                    workbook: workbookSheet?.user_sheet_id
                        ? `https://docs.google.com/spreadsheets/d/${workbookSheet.user_sheet_id}`
                        : null,
                },
                mergedPdfUrl,
                attachments: attachments.map(f => ({ id: f.id, fileName: f.file_name })),
            },
        });
    } catch (err) {
        console.error('[Applicants] getApplicantProfile error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// ─── Serve attachment or photo files (auth-protected) ─────────────────────────
// GET /api/applicants/file/:fileType/:fileName
// fileType: photo | election

function serveFile(req, res) {
    const { fileType, fileName } = req.params;

    // Sanitise — no path traversal
    const safe = path.basename(fileName);

    let filePath;
    if (fileType === 'photo') {
        filePath = path.join(PHOTO_DIR, safe);
    } else if (fileType === 'election') {
        filePath = path.join(ATTACHMENT_DIR, 'election', safe);
    } else {
        return res.status(400).json({ message: 'Invalid file type' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
    }

    return res.sendFile(filePath);
}

// ─── Update editable fields on an applicant record ─────────────────────────
// PATCH /api/applicants/profile/:id

const { triggerAutoCloudSync } = require('./awardsWorkbookController');

const EDITABLE_FIELDS = [
    'academic_score', 'sports_score', 'cultural_score',
    'sports_director_score', 'cultural_director_score',
    'sports_verified_score', 'cultural_verified_score', 'academic_verified_score',
    'total_verified_score', 'status',
];

async function updateApplicant(req, res) {
    try {
        const { id } = req.params;

        const record = await ElectionFormResponse.findByPk(id);
        if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

        // Only allow whitelisted fields
        const updates = {};
        for (const field of EDITABLE_FIELDS) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field] === '' ? null : req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        await record.update(updates);

        setImmediate(() => triggerAutoCloudSync());

        return res.json({ success: true, data: record.toJSON() });
    } catch (err) {
        console.error('[Applicants] updateApplicant error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getApplicants, getApplicantProfile, updateApplicant, serveFile };
