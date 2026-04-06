// server/controllers/nominationController.js
const { SportsPersonAward, CulturalPersonAward, TrailblazerAward, NominatedStudent } = require('../models');
const log = require('../utils/logger').child({ module: 'NominationController' });

// ─── Helper: parse a verified score string to float ──────────────────────────
function toFloat(val) {
    if (val === null || val === undefined || val === '') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}

// ─── Helper: pick top N per gender, sorted descending by scoreField ───────────
// Returns a flat array ranked 1..N within each gender, is_top_pick=true for rank 1.
function topNPerGender(rows, scoreField, n) {
    const byGender = {};
    for (const row of rows) {
        const score = toFloat(row[scoreField]);
        if (score === null) continue;
        const gender = (row.gender || 'Unknown').trim();
        if (!byGender[gender]) byGender[gender] = [];
        byGender[gender].push({ ...row, _score: score });
    }

    const results = [];
    for (const [gender, list] of Object.entries(byGender)) {
        list.sort((a, b) => b._score - a._score);
        const top = list.slice(0, n);
        top.forEach((r, i) => {
            results.push({ ...r, _rank: i + 1, _gender: gender });
        });
    }
    return results;
}

// ─── Helper: compute trailblazer total ───────────────────────────────────────
function trailTotal(row) {
    return [
        toFloat(row.sports_verified_score),
        toFloat(row.cultural_verified_score),
        toFloat(row.academic_verified_score),
    ].filter(v => v !== null).reduce((a, b) => a + b, 0);
}

// ─── Generate nominations (overwrites existing) ───────────────────────────────
async function generateNominations(req, res) {
    try {
        const [sportsRows, culturalRows, trailblazerRows] = await Promise.all([
            SportsPersonAward.findAll({
                attributes: ['id', 'name', 'student_id', 'gender', 'batch', 'email', 'sports_verified_score'],
            }),
            CulturalPersonAward.findAll({
                attributes: ['id', 'name', 'student_id', 'gender', 'batch', 'email', 'cultural_verified_score'],
            }),
            TrailblazerAward.findAll({
                attributes: ['id', 'name', 'student_id', 'gender', 'batch', 'email',
                    'sports_verified_score', 'cultural_verified_score', 'academic_verified_score'],
            }),
        ]);

        const nominees = [];

        // ── Sports Person Award — top 5 male + 5 female by sports_verified_score ─
        const sportsPicks = topNPerGender(
            sportsRows.map(r => r.toJSON()), 'sports_verified_score', 5
        );
        for (const row of sportsPicks) {
            nominees.push({
                name:                  row.name,
                student_id:            (row.student_id || '').toString().trim(),
                gender:                row.gender,
                batch:                 row.batch,
                email:                 row.email,
                sports_verified_score: row.sports_verified_score,
                award_name:            'Sports Person Award',
                rank:                  row._rank,
                is_top_pick:           row._rank === 1,
            });
        }

        // ── Co-curricular Person Award — top 5 male + 5 female ───────────────
        const culturalPicks = topNPerGender(
            culturalRows.map(r => r.toJSON()), 'cultural_verified_score', 5
        );
        for (const row of culturalPicks) {
            nominees.push({
                name:                    row.name,
                student_id:              (row.student_id || '').toString().trim(),
                gender:                  row.gender,
                batch:                   row.batch,
                email:                   row.email,
                cultural_verified_score: row.cultural_verified_score,
                award_name:              'Co-curricular Person Award',
                rank:                    row._rank,
                is_top_pick:             row._rank === 1,
            });
        }

        // ── Trailblazer Award — top 3 male + 3 female by sum of all scores ───
        const trailJson = trailblazerRows.map(r => r.toJSON());
        const trailWithTotal = trailJson
            .map(row => ({ ...row, _total: trailTotal(row) }))
            .filter(row => row._total > 0);

        const trailPicks = topNPerGender(trailWithTotal, '_total', 3);
        for (const row of trailPicks) {
            nominees.push({
                name:                    row.name,
                student_id:              (row.student_id || '').toString().trim(),
                gender:                  row.gender,
                batch:                   row.batch,
                email:                   row.email,
                sports_verified_score:   row.sports_verified_score,
                cultural_verified_score: row.cultural_verified_score,
                academic_verified_score: row.academic_verified_score,
                award_name:              'Trailblazer Award',
                rank:                    row._rank,
                is_top_pick:             row._rank === 1,
            });
        }

        // ── Overwrite existing nominations ────────────────────────────────────
        await NominatedStudent.destroy({ where: {}, truncate: true });
        const created = await NominatedStudent.bulkCreate(nominees);

        log.info({ count: created.length }, '[Nominations] Generated fresh nominations');

        return res.json({
            success: true,
            count:   created.length,
            nominees: created.map(n => n.toJSON()),
        });

    } catch (err) {
        log.error({ err: err.message }, '[Nominations] generateNominations error');
        return res.status(500).json({ success: false, message: err.message });
    }
}

// ─── Get all nominees ─────────────────────────────────────────────────────────
async function getNominations(req, res) {
    try {
        const rows = await NominatedStudent.findAll({
            order: [['award_name', 'ASC'], ['gender', 'ASC'], ['rank', 'ASC']],
        });
        return res.json({ success: true, data: rows.map(r => r.toJSON()) });
    } catch (err) {
        log.error({ err: err.message }, '[Nominations] getNominations error');
        return res.status(500).json({ success: false, message: err.message });
    }
}

// ─── Delete a single nominee by id ───────────────────────────────────────────
async function deleteNominee(req, res) {
    try {
        const { id } = req.params;
        const parsedId = parseInt(id, 10);
        if (!parsedId || parsedId < 1) {
            return res.status(400).json({ success: false, message: 'Invalid nominee ID.' });
        }
        const nominee = await NominatedStudent.findByPk(parsedId);
        if (!nominee) {
            return res.status(404).json({ success: false, message: 'Nominee not found.' });
        }
        await nominee.destroy();
        log.info({ id: parsedId, name: nominee.name }, '[Nominations] Nominee deleted');
        return res.json({
            success: true,
            message: `Nominee "${nominee.name}" has been removed.`,
        });
    } catch (err) {
        log.error({ err: err.message }, '[Nominations] deleteNominee error');
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { generateNominations, getNominations, deleteNominee };