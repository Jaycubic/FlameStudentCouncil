// server/controllers/applicantsController.js
const path = require('path');
const fs   = require('fs');
const { TrailblazerAward, SportsPersonAward, CulturalPersonAward,
        SportsUserSheet, CulturalUserSheet,
        SportAttachment, CulturalAttachment } = require('../models');
const { Op } = require('sequelize');

const ATTACHMENT_DIR = '/opt/View/FlameAwards/server/Attachments';
const PHOTO_DIR      = '/opt/View/StudentTrackingSystem/server/Photos';
const SPORTS_FIELDS      = ['id','name','student_id','gender','batch','email','sports_score','submission_date','sports_verified_score','status','photo'];
const CULTURAL_FIELDS    = ['id','name','student_id','gender','batch','email','cultural_score','submission_date','cultural_verified_score','status','photo'];
const TRAILBLAZER_FIELDS = ['id','name','student_id','gender','batch','email','sports_score','cultural_score','cgpa','submission_date','sports_verified_score','cultural_verified_score','status','photo'];

function buildWhere(search, gender, batch) {
    const where = {};
    if (gender) where.gender = gender;
    if (batch)  where.batch  = batch;
    if (search) {
        where[Op.or] = [
            { name:       { [Op.iLike]: `%${search}%` } },
            { student_id: { [Op.iLike]: `%${search}%` } },
            { email:      { [Op.iLike]: `%${search}%` } },
        ];
    }
    return where;
}

// Tag rows with award_type and normalise missing columns to null
function tagSports(rows) {
    return rows.map(r => ({
        ...r.toJSON(),
        award_type:           'Sports Award',
        cultural_score:       null,
        cultural_verified_score: null,
        cgpa:                 null,
    }));
}
function tagCultural(rows) {
    return rows.map(r => ({
        ...r.toJSON(),
        award_type:          'Cultural Award',
        sports_score:        null,
        sports_verified_score: null,
        cgpa:                null,
    }));
}
function tagTrailblazer(rows) {
    return rows.map(r => ({ ...r.toJSON(), award_type: 'Trailblazer Award' }));
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
            award_type = 'all',
            gender     = '',
            batch      = '',
            sort_field = '',
            sort_dir   = 'asc',
            page       = 1,
            limit      = 50,
        } = req.query;

        const where = buildWhere(search.trim(), gender.trim(), batch.trim());

        const needsSports      = award_type === 'all' || award_type === 'sports';
        const needsCultural    = award_type === 'all' || award_type === 'cultural';
        const needsTrailblazer = award_type === 'all' || award_type === 'trailblazer';

        const [sportsRows, culturalRows, trailblazerRows] = await Promise.all([
            needsSports      ? SportsPersonAward.findAll({ where, attributes: SPORTS_FIELDS })      : [],
            needsCultural    ? CulturalPersonAward.findAll({ where, attributes: CULTURAL_FIELDS })   : [],
            needsTrailblazer ? TrailblazerAward.findAll({ where, attributes: TRAILBLAZER_FIELDS }) : [],
        ]);

        let merged = [
            ...tagSports(sportsRows),
            ...tagCultural(culturalRows),
            ...tagTrailblazer(trailblazerRows),
        ];

        // Sort
        if (sort_field) {
            merged = sortRows(merged, sort_field, sort_dir);
        } else {
            merged.sort((a, b) => new Date(b.submission_date) - new Date(a.submission_date));
        }

        // Paginate
        const total     = merged.length;
        const pageNum   = Math.max(1, parseInt(page));
        const limitNum  = Math.max(1, Math.min(200, parseInt(limit)));
        const pages     = Math.ceil(total / limitNum) || 1;
        const paginated = merged.slice((pageNum - 1) * limitNum, pageNum * limitNum);

        // Filter dropdown values
        const allRows = await Promise.all([
            SportsPersonAward.findAll({ attributes: ['gender', 'batch'] }),
            CulturalPersonAward.findAll({ attributes: ['gender', 'batch'] }),
            TrailblazerAward.findAll({ attributes: ['gender', 'batch'] }),
        ]);
        const flatten = allRows.flat();
        const genders = [...new Set(flatten.map(r => r.gender).filter(Boolean))].sort();
        const batches = [...new Set(flatten.map(r => r.batch).filter(Boolean))].sort();

        return res.json({
            success: true,
            total,
            page:  pageNum,
            pages,
            limit: limitNum,
            data:  paginated,
            filters: { genders, batches },
        });
    } catch (err) {
        console.error('[Applicants] Error:', err.message, err.stack);
        return res.status(500).json({ success: false, message: err.message });
    }
}


// ─── Full profile for the modal ───────────────────────────────────────────────
// GET /api/applicants/profile/:awardType/:id
// awardType: sports | cultural | trailblazer

const AWARD_MODEL_MAP = {
    sports:      SportsPersonAward,
    cultural:    CulturalPersonAward,
    trailblazer: TrailblazerAward,
};

async function getApplicantProfile(req, res) {
    try {
        const { awardType, id } = req.params;
        const Model = AWARD_MODEL_MAP[awardType];
        if (!Model) return res.status(400).json({ success: false, message: 'Invalid award type' });

        const record = await Model.findByPk(id);
        if (!record) return res.status(404).json({ success: false, message: 'Record not found' });

        const email = record.email;

        // Fetch sheet links and attachments in parallel
        const [sportsSheet, culturalSheet, sportFiles, culturalFiles] = await Promise.all([
            SportsUserSheet.findOne({ where: { email }, attributes: ['user_sheet_id'] }),
            CulturalUserSheet.findOne({ where: { email }, attributes: ['user_sheet_id'] }),
            awardType === 'sports' || awardType === 'trailblazer'
                ? SportAttachment.findAll({ where: { submission_id: id }, attributes: ['id', 'file_name'] })
                : [],
            awardType === 'cultural' || awardType === 'trailblazer'
                ? CulturalAttachment.findAll({ where: { submission_id: id }, attributes: ['id', 'file_name'] })
                : [],
        ]);

        return res.json({
            success: true,
            data: {
                ...record.toJSON(),
                award_type: awardType,
                sheets: {
                    sports:   sportsSheet?.user_sheet_id  ? `https://docs.google.com/spreadsheets/d/${sportsSheet.user_sheet_id}` : null,
                    cultural: culturalSheet?.user_sheet_id ? `https://docs.google.com/spreadsheets/d/${culturalSheet.user_sheet_id}` : null,
                },
                attachments: {
                    sport:    sportFiles.map(f => ({ id: f.id, fileName: f.file_name })),
                    cultural: culturalFiles.map(f => ({ id: f.id, fileName: f.file_name })),
                },
            },
        });
    } catch (err) {
        console.error('[Applicants] getApplicantProfile error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// ─── Serve attachment or photo files (auth-protected) ─────────────────────────
// GET /api/applicants/file/:fileType/:fileName
// fileType: photo | sport | cultural | academic

function serveFile(req, res) {
    const { fileType, fileName } = req.params;

    // Sanitise — no path traversal
    const safe = path.basename(fileName);

    let filePath;
    if (fileType === 'photo') {
        filePath = path.join(PHOTO_DIR, safe);
    } else if (['sport', 'cultural', 'academic'].includes(fileType)) {
        filePath = path.join(ATTACHMENT_DIR, fileType, safe);
    } else {
        return res.status(400).json({ message: 'Invalid file type' });
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
    }

    return res.sendFile(filePath);
}

module.exports = { getApplicants, getApplicantProfile, serveFile };
