// server/controllers/dashboardController.js
//
// Computes election application stats from the ElectionFormResponse table.
// Called on demand (HTTP GET) and also emits via Socket.IO when data changes.

const { ElectionFormResponse, Position } = require('../models');
const { broadcastDashboardUpdate } = require('../socket');


// ─── Core data aggregation ────────────────────────────────────────────────────

async function buildDashboardData() {
    const allResponses = await ElectionFormResponse.findAll({
        attributes: ['gender', 'batch', 'position_selected', 'email']
    });

    const totalApplicants = new Set(allResponses.map(r => r.email)).size;

    // ── Position-based counts ────────────────────────────────────────────────
    const positionCounts = {};
    allResponses.forEach(r => {
        const pos = r.position_selected || 'Unknown';
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
    });

    // ── Gender distribution by position ─────────────────────────────────────
    const genderByPosition = {};
    allResponses.forEach(r => {
        const pos = r.position_selected || 'Unknown';
        if (!genderByPosition[pos]) {
            genderByPosition[pos] = { male: 0, female: 0, other: 0, total: 0 };
        }
        const g = (r.gender || '').toLowerCase();
        if (g === 'male')        genderByPosition[pos].male++;
        else if (g === 'female') genderByPosition[pos].female++;
        else                     genderByPosition[pos].other++;
        genderByPosition[pos].total++;
    });

    // ── Batch distribution by position ──────────────────────────────────────
    const batchPositionMap = {};
    const allBatches = new Set();
    const allPositions = new Set();

    allResponses.forEach(r => {
        const batch = r.batch || 'Unknown';
        const pos   = r.position_selected || 'Unknown';
        allBatches.add(batch);
        allPositions.add(pos);

        const key = `${batch}::${pos}`;
        batchPositionMap[key] = (batchPositionMap[key] || 0) + 1;
    });

    // Build batch-by-position array for charts
    const batchByPosition = [];
    allBatches.forEach(batch => {
        const row = { batch };
        allPositions.forEach(pos => {
            row[pos] = batchPositionMap[`${batch}::${pos}`] || 0;
        });
        batchByPosition.push(row);
    });
    batchByPosition.sort((a, b) => a.batch.localeCompare(b.batch));

    // ── Gender totals (across all positions) ────────────────────────────────
    const genderTotals = { male: 0, female: 0, other: 0 };
    allResponses.forEach(r => {
        const g = (r.gender || '').toLowerCase();
        if (g === 'male')        genderTotals.male++;
        else if (g === 'female') genderTotals.female++;
        else                     genderTotals.other++;
    });

    return {
        totalApplicants,
        totalSubmissions: allResponses.length,
        positionCounts,
        genderByPosition,
        genderTotals,
        batchByPosition,
        positions: [...allPositions].sort(),
    };
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

// ─── Socket emit helper — call after any election form submission ────────────

async function emitDashboardUpdate() {
    try {
        const data = await buildDashboardData();
        await broadcastDashboardUpdate(data);
    } catch (err) {
        console.error('[Dashboard] Socket emit error:', err.message);
    }
}


module.exports = { getDashboardStats, emitDashboardUpdate };
