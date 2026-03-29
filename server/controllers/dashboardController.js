// server/controllers/dashboardController.js
//
// Computes award application stats from the three award tables.
// Called on demand (HTTP GET) and also emits via Socket.IO when data changes.

const { TrailblazerAward, SportsPersonAward, CulturalPersonAward } = require('../models');
const { broadcastDashboardUpdate } = require('../socket');
const { Op } = require('sequelize');


// ─── Core data aggregation ────────────────────────────────────────────────────

async function buildDashboardData() {
    const [trailblazers, sports, cultural] = await Promise.all([
        TrailblazerAward.findAll({ attributes: ['gender', 'batch'] }),
        SportsPersonAward.findAll({ attributes: ['gender', 'batch'] }),
        CulturalPersonAward.findAll({ attributes: ['gender', 'batch'] }),
    ]);

    const sportsCount      = sports.length;
    const culturalCount    = cultural.length;
    const trailblazerCount = trailblazers.length;

    // Deduplicate by email to count unique students across all categories
    const [allEmails] = await Promise.all([
        Promise.all([
            TrailblazerAward.findAll({ attributes: ['email'] }),
            SportsPersonAward.findAll({ attributes: ['email'] }),
            CulturalPersonAward.findAll({ attributes: ['email'] }),
        ])
    ]);
    const uniqueApplicants = new Set([
        ...allEmails[0].map(r => r.email),
        ...allEmails[1].map(r => r.email),
        ...allEmails[2].map(r => r.email),
    ]).size;

    // ── Gender distribution by award ────────────────────────────────────────
    const genderByAward = {
        sports: countGenders(sports),
        cultural: countGenders(cultural),
        trailblazer: countGenders(trailblazers),
    };

    // ── Batch distribution by award ──────────────────────────────────────────
    const batchByAward = buildBatchDistribution({ sports, cultural, trailblazers });

    return {
        sportsCount,
        culturalCount,
        trailblazerCount,
        totalApplicants: uniqueApplicants,
        genderByAward,
        batchByAward,
    };
}

function countGenders(rows) {
    let male = 0, female = 0, other = 0;
    rows.forEach(r => {
        const g = (r.gender || '').toLowerCase();
        if (g === 'male')        male++;
        else if (g === 'female') female++;
        else                     other++;
    });
    return { male, female, other, total: rows.length };
}

function buildBatchDistribution({ sports, cultural, trailblazers }) {
    // Collect all batches across all awards
    const allBatches = new Set([
        ...sports.map(r => r.batch).filter(Boolean),
        ...cultural.map(r => r.batch).filter(Boolean),
        ...trailblazers.map(r => r.batch).filter(Boolean),
    ]);

    const batchMap = {};
    allBatches.forEach(batch => {
        batchMap[batch] = { batch, sports: 0, cultural: 0, trailblazer: 0 };
    });

    sports.forEach(r => { if (r.batch && batchMap[r.batch]) batchMap[r.batch].sports++; });
    cultural.forEach(r => { if (r.batch && batchMap[r.batch]) batchMap[r.batch].cultural++; });
    trailblazers.forEach(r => { if (r.batch && batchMap[r.batch]) batchMap[r.batch].trailblazer++; });

    // Sort by batch label
    return Object.values(batchMap).sort((a, b) => a.batch.localeCompare(b.batch));
}

// ─── HTTP endpoint ────────────────────────────────────────────────────────────

async function getDashboardStats(req, res) {
    try {
        const data = await buildDashboardData();
        return res.json({ success: true, data });
    } catch (err) {
        console.error('[Dashboard] Error:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
}

// ─── Socket emit helper — call after any award submission ────────────────────
// Import and call this from formSubmissionController after a successful upsert.

async function emitDashboardUpdate() {
    try {
        const data = await buildDashboardData();
        await broadcastDashboardUpdate(data);  // caches in Redis + emits to all sockets
    } catch (err) {
        console.error('[Dashboard] Socket emit error:', err.message);
    }
}


module.exports = { getDashboardStats, emitDashboardUpdate };
