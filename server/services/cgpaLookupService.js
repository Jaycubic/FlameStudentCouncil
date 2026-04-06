// server/services/cgpaLookupService.js
//
// Purpose: resolve the latest cumulative CGPA for a given student by querying
//          the correct audit table (UG vs PG) in the academicplanning DB, then
//          caching the result in app.student_cgpa_cache (main FlameAwards DB).
//
// Algorithm (per user spec):
//   1. Get ALL records for the student_id from the correct audit table.
//   2. Find the maximum numeric my_term across all records.
//   3. Check if any record at maxTerm has a non-null cumulative_gpa.
//   4. If not, fall back to the next lower my_term and repeat.
//   5. Return { cgpa, my_term, program_type } or { cgpa: null, ... } if not found.
//
// Cache policy:
//   - Cache entries older than CACHE_TTL_HOURS are considered stale and refreshed.
//   - A cache miss (no row) also triggers a fresh fetch.
//   - The cache row is upserted (INSERT … ON CONFLICT UPDATE) so there is never
//     a double row per student_id.

const { Op } = require('sequelize');
const DegreeProgressAudit   = require('../models/DegreeProgressAudit');
const PgDegreeProgressAudit = require('../models/PgDegreeProgressAudit');
const StudentCgpaCache      = require('../models/StudentCgpaCache');
const log = require('../utils/logger').child({ module: 'CgpaLookupService' });

const CACHE_TTL_HOURS = 24;   // refresh cached CGPA after 24 hours

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determines whether a batch belongs to a PG programme.
 * PG batches contain 'PG', 'MSC', 'PGPEI', or 'PGC' (case-insensitive).
 * Everything else (UG, BDES, numeric years …) uses DegreeProgressAudit.
 */
function isPGBatch(batch) {
  if (!batch) return false;
  const u = batch.toString().toUpperCase();
  return u.includes('PG') || u.includes('MSC') || u.includes('PGPEI') || u.includes('PGC');
}

/**
 * Queries the appropriate audit table for a student and walks down my_term
 * values from highest to lowest until a non-null cumulative_gpa is found.
 *
 * @param {string} studentId
 * @param {string} batch        - class_year value; used to pick UG vs PG table
 * @returns {{ cgpa: number|null, my_term: number|null, program_type: string }}
 */
async function fetchCgpaFromAuditDB(studentId, batch) {
  const pg = isPGBatch(batch);
  const Model = pg ? PgDegreeProgressAudit : DegreeProgressAudit;
  const programType = pg ? 'PG' : 'UG';

  try {
    // Fetch all rows for this student — we only need my_term + cumulative_gpa
    const records = await Model.findAll({
      where: { student_id: studentId.toString() },
      attributes: ['my_term', 'cumulative_gpa'],
      raw: true,
    });

    if (!records.length) {
      log.info({ studentId, batch, programType }, '[CgpaLookup] No audit records found');
      return { cgpa: null, my_term: null, program_type: programType };
    }

    // Extract unique numeric my_term values, sort descending (highest first)
    const terms = [
      ...new Set(
        records
          .map(r => parseInt(r.my_term))
          .filter(t => !isNaN(t) && t > 0)
      )
    ].sort((a, b) => b - a);

    if (!terms.length) {
      log.info({ studentId, batch }, '[CgpaLookup] All my_term values are non-numeric');
      return { cgpa: null, my_term: null, program_type: programType };
    }

    // Walk from highest term downward until we find a non-null cgpa
    for (const term of terms) {
      const hit = records.find(
        r => parseInt(r.my_term) === term && r.cumulative_gpa !== null && r.cumulative_gpa !== undefined
      );
      if (hit) {
        const cgpa = parseFloat(hit.cumulative_gpa);
        log.info({ studentId, batch, term, cgpa, programType }, '[CgpaLookup] CGPA resolved');
        return { cgpa, my_term: term, program_type: programType };
      }
    }

    // Exhausted all terms — no cgpa data
    log.info({ studentId, batch, termsChecked: terms }, '[CgpaLookup] No cumulative_gpa found in any term');
    return { cgpa: null, my_term: null, program_type: programType };

  } catch (err) {
    log.error({ err: err.message, studentId, batch }, '[CgpaLookup] Error querying audit DB');
    return { cgpa: null, my_term: null, program_type: programType };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the cached CGPA for a student.
 * If the cache is missing or stale, fetches from the audit DB and updates the cache.
 *
 * @param {string} studentId
 * @param {string} email
 * @param {string} batch
 * @param {object} [opts]
 * @param {boolean} [opts.forceRefresh=false]  Always re-fetch from audit DB
 * @returns {Promise<{ cgpa: number|null, my_term: number|null, program_type: string, fromCache: boolean }>}
 */
async function getCgpa(studentId, email, batch, opts = {}) {
  const { forceRefresh = false } = opts;

  try {
    // Check cache
    const cached = await StudentCgpaCache.findOne({ where: { student_id: studentId.toString() } });

    if (!forceRefresh && cached) {
      const ageHours = (Date.now() - new Date(cached.fetched_at).getTime()) / 36e5;
      if (ageHours < CACHE_TTL_HOURS) {
        return {
          cgpa:         cached.cgpa !== null ? parseFloat(cached.cgpa) : null,
          my_term:      cached.my_term,
          program_type: cached.program_type,
          fromCache:    true,
        };
      }
    }

    // Cache miss or stale — hit the audit DB
    const result = await fetchCgpaFromAuditDB(studentId, batch);

    // Upsert into cache
    await StudentCgpaCache.upsert({
      student_id:   studentId.toString(),
      email:        email.toString(),
      cgpa:         result.cgpa,
      my_term:      result.my_term,
      batch:        batch,
      program_type: result.program_type,
      fetched_at:   new Date(),
    }, {
      conflictFields: ['student_id'],
    });

    return { ...result, fromCache: false };

  } catch (err) {
    log.error({ err: err.message, studentId }, '[CgpaLookup] Cache upsert error — returning live result if available');
    // Best-effort: return live fetch without crashing caller
    const fallback = await fetchCgpaFromAuditDB(studentId, batch).catch(() => ({ cgpa: null, my_term: null, program_type: isPGBatch(batch) ? 'PG' : 'UG' }));
    return { ...fallback, fromCache: false };
  }
}

/**
 * Background-safe wrapper: fires getCgpa without blocking the caller.
 * Errors are swallowed — the cache will just be refreshed on the next call.
 */
function refreshCgpaInBackground(studentId, email, batch) {
  setImmediate(async () => {
    try {
      const result = await getCgpa(studentId, email, batch, { forceRefresh: true });
      log.info({ studentId, cgpa: result.cgpa, my_term: result.my_term }, '[CgpaLookup] Background refresh complete');
    } catch (err) {
      log.warn({ err: err.message, studentId }, '[CgpaLookup] Background refresh error — cache unchanged');
    }
  });
}

module.exports = { getCgpa, refreshCgpaInBackground, isPGBatch };
