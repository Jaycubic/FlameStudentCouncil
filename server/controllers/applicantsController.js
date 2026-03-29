// server/controllers/applicantsController.js
const { TrailblazerAward, SportsPersonAward, CulturalPersonAward } = require('../models');
const { Op } = require('sequelize');

// Each table only has its own verified score column
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

module.exports = { getApplicants };
