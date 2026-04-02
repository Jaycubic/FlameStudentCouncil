// server/controllers/nominationController.js
const { SportsPersonAward, CulturalPersonAward, TrailblazerAward, NominatedStudent } = require('../models');
const log = require('../utils/logger').child({ module: 'NominationController' });

// ─── Helper: parse a verified score string to float ──────────────────────────
function toFloat(val) {
    if (val === null || val === undefined || val === '') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}

// ─── Helper: pick top-scorer per gender ──────────────────────────────────────
function topPerGender(rows, scoreField) {
    const best = {};
    for (const row of rows) {
        const score = toFloat(row[scoreField]);
        if (score === null) continue;
        const gender = (row.gender || '').trim();
        if (!best[gender] || score > toFloat(best[gender][scoreField])) {
            best[gender] = row;
        }
    }
    return best;
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

        // ── Sports Person Award ───────────────────────────────────────────────
        const sportsWinners = topPerGender(sportsRows.map(r => r.toJSON()), 'sports_verified_score');
        for (const row of Object.values(sportsWinners)) {
            nominees.push({
                name:                  row.name,
                student_id:            row.student_id,
                gender:                row.gender,
                batch:                 row.batch,
                email:                 row.email,
                sports_verified_score: row.sports_verified_score,
                award_name:            'Sports Person Award',
            });
        }

        // ── Co-curricular Person Award ────────────────────────────────────────
        const culturalWinners = topPerGender(culturalRows.map(r => r.toJSON()), 'cultural_verified_score');
        for (const row of Object.values(culturalWinners)) {
            nominees.push({
                name:                    row.name,
                student_id:              row.student_id,
                gender:                  row.gender,
                batch:                   row.batch,
                email:                   row.email,
                cultural_verified_score: row.cultural_verified_score,
                award_name:              'Co-curricular Person Award',
            });
        }

        // ── Trailblazer Award: single highest total ───────────────────────────
        let trailWinner = null;
        let trailBestTotal = -Infinity;
        for (const r of trailblazerRows) {
            const row = r.toJSON();
            const vals = [
                toFloat(row.sports_verified_score),
                toFloat(row.cultural_verified_score),
                toFloat(row.academic_verified_score),
            ].filter(v => v !== null);
            if (vals.length === 0) continue;
            const total = vals.reduce((a, b) => a + b, 0);
            if (total > trailBestTotal) {
                trailBestTotal = total;
                trailWinner = { ...row, _total: total };
            }
        }
        if (trailWinner) {
            nominees.push({
                name:                    trailWinner.name,
                student_id:              trailWinner.student_id,
                gender:                  trailWinner.gender,
                batch:                   trailWinner.batch,
                email:                   trailWinner.email,
                sports_verified_score:   trailWinner.sports_verified_score,
                cultural_verified_score: trailWinner.cultural_verified_score,
                academic_verified_score: trailWinner.academic_verified_score,
                award_name:              'Trailblazer Award',
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
            order: [['award_name', 'ASC'], ['gender', 'ASC']],
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

        // Guard: id must be a positive integer
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