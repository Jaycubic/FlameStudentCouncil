// server/controllers/applicantsController.js
//
// Returns all award applicants from all three tables, merged with a virtual
// "award_type" column.  Supports:
//   - search     : student name or student_id (case-insensitive)
//   - award_type : 'sports' | 'cultural' | 'trailblazer' | 'all' (default all)
//   - gender     : exact match
//   - batch      : exact match
//   - sort_field : sports_score | cultural_score | sports_verified_score | cultural_verified_score | submission_date
//   - sort_dir   : asc | desc

const { TrailblazerAward, SportsPersonAward, CulturalPersonAward } = require('../models');
const { Op } = require('sequelize');

const SPORTS_FIELDS     = ['id','name','student_id','gender','batch','email','sports_score','submission_date','sports_verified_score','status','photo'];
const CULTURAL_FIELDS   = ['id','name','student_id','gender','batch','email','cultural_score','submission_date','cultural_verified_score','status','photo'];
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

function tag(rows, awardType) {
    return rows.map(r => ({ ...r.toJSON(), award_type: awardType }));
}

function sortRows(rows, sortField, sortDir) {
    if (!sortField) return rows;
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
        const av = parseFloat(a[sortField]);
        const bv = parseFloat(b[sortField]);
        if (!isNaN(av) && !isNaN(bv)) return (av - bv) * dir;
        // fallback: string compare
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
        } = req.query;

        const where = buildWhere(search.trim(), gender.trim(), batch.trim());

        const needsSports      = award_type === 'all' || award_type === 'sports';
        const needsCultural    = award_type === 'all' || award_type === 'cultural';
        const needsTrailblazer = award_type === 'all' || award_type === 'trailblazer';

        const [sportsRows, culturalRows, trailblazerRows] = await Promise.all([
            needsSports      ? SportsPersonAward.findAll({ where, attributes: SPORTS_FIELDS })     : [],
            needsCultural    ? CulturalPersonAward.findAll({ where, attributes: CULTURAL_FIELDS })  : [],
            needsTrailblazer ? TrailblazerAward.findAll({ where, attributes: TRAILBLAZER_FIELDS }) : [],
        ]);

        let merged = [
            ...tag(sportsRows,      'Sports Award'),
            ...tag(culturalRows,    'Cultural Award'),
            ...tag(trailblazerRows, 'Trailblazer Award'),
        ];

        // Sort if requested
        if (sort_field) {
            merged = sortRows(merged, sort_field, sort_dir);
        } else {
            // Default: newest first
            merged.sort((a, b) => new Date(b.submission_date) - new Date(a.submission_date));
        }

        // Unique gender & batch values for filter dropdowns
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
            total: merged.length,
            data: merged,
            filters: { genders, batches },
        });
    } catch (err) {
        console.error('[Applicants] Error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { getApplicants };
