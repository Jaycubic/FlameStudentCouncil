// workers/cgpaAuditWorker.js
//
// Retroactive CGPA integrity audit worker.
//
// Compares academic_score in ElectionFormResponse against the trusted CGPA
// in StudentCgpaCache for every submitted student. If a mismatch is found
// (i.e. the student tampered with their workbook CGPA before the tamper
// protection was deployed), corrects the record.
//
// Only processes students whose student_id exists in StudentCgpaCache.
// Students NOT in the cache are skipped (their manual CGPA is allowed).
//
// Schedule: runs once on boot (30s delay), then every 6 hours.

const cron = require('node-cron');
const { ElectionFormResponse, StudentCgpaCache } = require('../models');
const { Op } = require('sequelize');
const log = require('../utils/logger').child({ module: 'CGPAAuditWorker' });

/**
 * Runs a single audit pass over all submitted election form responses.
 */
async function runCgpaAudit() {
    log.info('[CGPAAudit] 🔍 Starting CGPA integrity audit...');

    let checked = 0;
    let corrected = 0;
    let skippedNoCache = 0;
    let errors = 0;

    try {
        // Fetch all submissions that have a student_id
        const submissions = await ElectionFormResponse.findAll({
            where: {
                student_id: { [Op.not]: null },
            },
            attributes: [
                'id', 'email', 'student_id',
                'academic_score', 'academic_verified_score',
                'sports_verified_score', 'cultural_verified_score',
                'sports_director_score', 'cultural_director_score',
                'total_verified_score',
            ],
        });

        log.info({ count: submissions.length }, '[CGPAAudit] Fetched submissions for audit');

        for (const submission of submissions) {
            try {
                const studentId = String(submission.student_id).trim();

                // Look up trusted CGPA from cache
                const cacheRecord = await StudentCgpaCache.findOne({
                    where: { student_id: studentId },
                    attributes: ['cgpa'],
                });

                if (!cacheRecord || cacheRecord.cgpa == null) {
                    // Student not in cache — manual CGPA was allowed, skip
                    skippedNoCache++;
                    continue;
                }

                checked++;
                const trustedCgpa = parseFloat(cacheRecord.cgpa);
                const currentScore = parseFloat(submission.academic_score);

                // Compare with tolerance for floating-point
                if (isNaN(trustedCgpa)) continue;
                if (!isNaN(currentScore) && Math.abs(currentScore - trustedCgpa) < 0.005) {
                    // Values match — no correction needed
                    continue;
                }

                // ── Mismatch detected — correct it ───────────────────────────
                const trustedStr = trustedCgpa.toFixed(2);

                // academic_verified_score = academic_score (always same, no scaling)
                const newAcademicVerified = trustedStr;

                // Recalculate total_verified_score
                const sv = parseFloat(submission.sports_verified_score)   || 0;
                const cv = parseFloat(submission.cultural_verified_score) || 0;
                const av = trustedCgpa;
                const sd = parseFloat(submission.sports_director_score)   || 0;
                const cd = parseFloat(submission.cultural_director_score) || 0;
                const rawSum = sv + cv + av + sd + cd;
                const newTotal = Math.min(30, parseFloat(rawSum.toFixed(2)));

                log.warn({
                    email: submission.email,
                    studentId,
                    oldAcademicScore: submission.academic_score,
                    newAcademicScore: trustedStr,
                    oldTotal: submission.total_verified_score,
                    newTotal: newTotal.toString(),
                }, '[CGPAAudit] ⚠️ CGPA mismatch detected — correcting');

                await submission.update({
                    academic_score:          trustedStr,
                    academic_verified_score: newAcademicVerified,
                    total_verified_score:    newTotal.toString(),
                });

                corrected++;
            } catch (rowErr) {
                errors++;
                log.error({ err: rowErr.message, submissionId: submission.id }, '[CGPAAudit] Error processing row');
            }
        }

        log.info({
            checked,
            corrected,
            skippedNoCache,
            errors,
        }, '[CGPAAudit] ✅ Audit complete');

    } catch (err) {
        log.error({ err: err.message }, '[CGPAAudit] ❌ Fatal error during audit');
    }

    return { checked, corrected, skippedNoCache, errors };
}

// ─── Schedule ────────────────────────────────────────────────────────────────
// Run every 6 hours (at minute 10 to avoid colliding with other crons)
cron.schedule('10 */6 * * *', () => {
    runCgpaAudit().catch(err => {
        log.error({ err: err.message }, '[CGPAAudit] Scheduled audit error');
    });
});

// ─── Startup Execution ────────────────────────────────────────────────────────
// Run once on server boot after 30 seconds delay
setTimeout(() => {
    log.info('[CGPAAudit] Running initial boot audit...');
    runCgpaAudit().catch(err => {
        log.error({ err: err.message }, '[CGPAAudit] Boot audit error');
    });
}, 30_000);

log.info('[CGPAAudit] CGPA audit worker registered (6-hourly cron active)');

module.exports = {
    runCgpaAudit,
};
