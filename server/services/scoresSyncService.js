// server/services/scoresSyncService.js
//
// Simplified for single-table architecture (ElectionFormResponse).
//
// With a single table, cross-table sync is no longer needed.
// This service now just recomputes total_verified_score when
// any individual verified score is updated on the same record.

const { ElectionFormResponse } = require('../models');

/**
 * Recompute total_verified_score for a given student email.
 *
 * @param {string} email       - Student email
 * @param {object} updatedFields - The key/value pairs that were just saved
 */
async function syncVerifiedScores(email, updatedFields) {
    if (!email || !updatedFields || Object.keys(updatedFields).length === 0) return;

    try {
        // Only act if a verified score field was updated
        const verifiedFields = ['sports_verified_score', 'cultural_verified_score', 'academic_verified_score'];
        const hasVerifiedUpdate = verifiedFields.some(f => updatedFields[f] !== undefined);
        if (!hasVerifiedUpdate) return;

        const record = await ElectionFormResponse.findOne({ where: { email } });
        if (!record) return;

        const sv = parseFloat(record.sports_verified_score)   || 0;
        const cv = parseFloat(record.cultural_verified_score) || 0;
        const av = parseFloat(record.academic_verified_score) || 0;
        const total = parseFloat((sv + cv + av).toFixed(2));

        await record.update({ total_verified_score: total });
        console.log(`[ScoresSync] Recomputed total_verified_score for ${email}: ${total}`);
    } catch (err) {
        console.error(`[ScoresSync] Error recomputing total for ${email}:`, err.message);
    }
}

module.exports = { syncVerifiedScores };
