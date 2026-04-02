// server/services/scoresSyncService.js
//
// Auto-syncs verified scores across award tables for the same student.
//
// Problem solved:
//   sports_verified_score is the SAME matrix score whether a student applied
//   for Sports Person Award only, Trailblazer only, or both.
//   Admin should only have to enter it once — this service propagates it.
//
// Propagation rules (directional — source of truth is whichever table was just updated):
//   SportsPersonAward.sports_verified_score   → TrailblazerAward.sports_verified_score
//   CulturalPersonAward.cultural_verified_score → TrailblazerAward.cultural_verified_score
//   TrailblazerAward.sports_verified_score    → SportsPersonAward.sports_verified_score
//   TrailblazerAward.cultural_verified_score  → CulturalPersonAward.cultural_verified_score
//
// academic_verified_score only lives in TrailblazerAward — no propagation needed.

const { SportsPersonAward, CulturalPersonAward, TrailblazerAward } = require('../models');

/**
 * Propagate verified scores across tables for a given student email.
 *
 * @param {string} email       - Student email (used to find sibling records)
 * @param {string} sourceType  - Which table was just updated: 'sports' | 'cultural' | 'trailblazer'
 * @param {object} updatedFields - The key/value pairs that were just saved
 */
async function syncVerifiedScores(email, sourceType, updatedFields) {
    if (!email || !updatedFields || Object.keys(updatedFields).length === 0) return;

    try {
        if (sourceType === 'sports' && updatedFields.sports_verified_score !== undefined) {
            // Push sports_verified_score → TrailblazerAward
            const trail = await TrailblazerAward.findOne({ where: { email } });
            if (trail) {
                await trail.update({ sports_verified_score: updatedFields.sports_verified_score });
                console.log(`[ScoresSync] sports → trailblazer | ${email} | sports_verified_score = ${updatedFields.sports_verified_score}`);
            }
        }

        if (sourceType === 'cultural' && updatedFields.cultural_verified_score !== undefined) {
            // Push cultural_verified_score → TrailblazerAward
            const trail = await TrailblazerAward.findOne({ where: { email } });
            if (trail) {
                await trail.update({ cultural_verified_score: updatedFields.cultural_verified_score });
                console.log(`[ScoresSync] cultural → trailblazer | ${email} | cultural_verified_score = ${updatedFields.cultural_verified_score}`);
            }
        }

        if (sourceType === 'trailblazer') {
            const promises = [];

            if (updatedFields.sports_verified_score !== undefined) {
                // Push sports_verified_score → SportsPersonAward
                promises.push(
                    SportsPersonAward.findOne({ where: { email } }).then(sports => {
                        if (sports) {
                            console.log(`[ScoresSync] trailblazer → sports | ${email} | sports_verified_score = ${updatedFields.sports_verified_score}`);
                            return sports.update({ sports_verified_score: updatedFields.sports_verified_score });
                        }
                    })
                );
            }

            if (updatedFields.cultural_verified_score !== undefined) {
                // Push cultural_verified_score → CulturalPersonAward
                promises.push(
                    CulturalPersonAward.findOne({ where: { email } }).then(cultural => {
                        if (cultural) {
                            console.log(`[ScoresSync] trailblazer → cultural | ${email} | cultural_verified_score = ${updatedFields.cultural_verified_score}`);
                            return cultural.update({ cultural_verified_score: updatedFields.cultural_verified_score });
                        }
                    })
                );
            }

            await Promise.all(promises);
        }
    } catch (err) {
        // Non-fatal: sync failure should never affect the admin's primary save
        console.error(`[ScoresSync] Error syncing scores for ${email}:`, err.message);
    }
}

module.exports = { syncVerifiedScores };
