// controllers/formSubmissionController.js
const {
  TrailblazerAward,
  SportsPersonAward,
  CulturalPersonAward,
  SportAttachment,
  CulturalAttachment,
  academicAttachment,
  StudentData,
  CulturalUserSheet,
  SportsUserSheet,
  AcademicUserSheet,
  StudentCgpaCache,
  User
} = require('../models');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { spawn } = require('child_process');

// Import the fire-and-forget revoke helper from sheetController
const { revokeStudentAccess } = require('./sheetController');
const { emitDashboardUpdate } = require('./dashboardController');
const { submissionEmailQueue } = require('../queues/submissionEmailQueue');
const log = require('../utils/logger').child({ module: 'FormSubmissionController' });
// Auto-sync verified scores across award tables when a student submits a new award
// (backfill from sibling tables runs in the setImmediate block below)

const MASTER_EMAIL      = 'student.awards@flame.edu.in';
const SCORE_SCRIPT_PATH = path.join(__dirname, '../scripts/read_sheet_score.py');

// ─── Storage config ───────────────────────────────────────────────────────────

const ATTACHMENT_DIR = '/opt/View/FlameAwards/server/Attachments';
const PHOTO_DIR = '/opt/View/StudentTrackingSystem/server/Photos';

['photos', 'sport', 'cultural', 'academic'].forEach(sub => {
  const dir = sub === 'photos' ? PHOTO_DIR : path.join(ATTACHMENT_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = ATTACHMENT_DIR;
    if (file.fieldname === 'photo')                     dest = PHOTO_DIR;
    else if (file.fieldname === 'sport_attachment')     dest = path.join(ATTACHMENT_DIR, 'sport');
    else if (file.fieldname === 'cultural_attachment')  dest = path.join(ATTACHMENT_DIR, 'cultural');
    else if (file.fieldname === 'academic_attachments') dest = path.join(ATTACHMENT_DIR, 'academic');
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Role-based prefix — multer populates req.body text fields before file fields
    const ROLE_PREFIX_MAP = {
      sports_person:   'SportsPerson',
      cultural_person: 'CocurricularPerson',
      trailblazer:     'Trailblazer',
    };
    const role      = req.body?.selected_role || '';
    const roleLabel = ROLE_PREFIX_MAP[role] || 'Award';

    // Field-level type suffix
    const FIELD_SUFFIX = {
      sport_attachment:     'Sports',
      cultural_attachment:  'Cocurricular',
      academic_attachments: 'Academic',
      photo:                'Photo',
    };
    const suffix = FIELD_SUFFIX[file.fieldname] || 'Attachment';

    // Sanitise original filename
    const safeName = file.originalname
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .substring(0, 100);
    const ext      = path.extname(safeName) || path.extname(file.originalname);
    const baseName = path.basename(safeName, ext) || 'file';

    // Format: RoleLabel-FieldType-OriginalName.ext  (no timestamp)
    cb(null, `${roleLabel}-${suffix}-${baseName}${ext}`);
  }
});

const upload = multer({ storage }).fields([
  { name: 'photo',                maxCount: 1  },
  { name: 'sport_attachment',     maxCount: 10 },
  { name: 'cultural_attachment',  maxCount: 10 },
  { name: 'academic_attachments', maxCount: 10 }
]);

// ─── Sheet revocation map ─────────────────────────────────────────────────────
//
//   sports_person   → revoke sports sheet only
//   cultural_person → revoke cultural sheet only
//   trailblazer     → revoke BOTH

const ROLE_TO_SHEET_TYPES = {
  sports_person:   ['sports'],
  cultural_person: ['cultural'],
  trailblazer:     ['sports', 'cultural', 'academic']
};

const SHEET_MODEL_MAP = {
  cultural: CulturalUserSheet,
  sports:   SportsUserSheet,
  academic: AcademicUserSheet
};

// ─── Score scaling (weighted_scaled_scores.md) ───────────────────────────────
// Piecewise formula:
//   x ≤ 150  →  y = x / 15
//   x > 150  →  y = min(10 + 0.05 * (x - 150), 12)
// w = 0.05, y_max = 12
// Returns a 2-dp string to match the VARCHAR column type, or null for bad input.

function scaleScore(raw) {
  const x = parseFloat(raw);
  if (isNaN(x) || x < 0) return null;
  const W = 0.05;
  const Y_MAX = 12;
  const y = x <= 150
    ? x / 15
    : Math.min(10 + W * (x - 150), Y_MAX);
  return parseFloat(y.toFixed(2)).toString();
}

// ─── Read B1 score from a student sheet ───────────────────────────────────────
// Runs read_sheet_score.py synchronously (awaited before DB write).
// Returns the computed numeric value of B1, or null on any failure.

function runScoreScript(sheetId, masterUser) {
  return new Promise((resolve) => {       // always resolves — never rejects
    const proc = spawn('python3', [
      SCORE_SCRIPT_PATH,
      sheetId,
      masterUser.access_token,
      masterUser.refresh_token
    ]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      log.warn({ sheetId }, '[ScoreRead] Timed out after 30s — score will be null');
      resolve(null);
    }, 30_000);

    proc.on('close', code => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(stdout.trim());
        if (result.success && result.value !== null && result.value !== undefined) {
          resolve(String(result.value));  // store as STRING to match column type
        } else {
          log.warn({ sheetId, error: result.error }, '[ScoreRead] Script returned no value');
          resolve(null);
        }
      } catch {
        log.warn({ sheetId, stdout, stderr }, '[ScoreRead] Non-JSON output');
        resolve(null);
      }
    });
  });
}

/**
 * Reads sports_score and/or cultural_score from the student's sheets
 * depending on the selected_role. Returns { sports_score, cultural_score }.
 *
 * For Trailblazer with pre-filled sections (already submitted as sibling award),
 * scores are sourced directly from the sibling DB record instead of running
 * the slow sheet script — instant and no Drive API call needed.
 */
async function readScoresForSubmission(email, selectedRole, masterUser, opts = {}) {
  const { alreadySubmittedSports = false, alreadySubmittedCultural = false } = opts;
  const scores = { sports_score: null, cultural_score: null, academic_score: null };

  try {
    // ─ DB carry-over for pre-filled Trailblazer sections ────────────────────────
    if (selectedRole === 'trailblazer' && alreadySubmittedSports) {
      const sportsRec = await SportsPersonAward.findOne({ where: { email } });
      if (sportsRec?.sports_score) {
        scores.sports_score = String(sportsRec.sports_score);
        log.info({ email, sports_score: scores.sports_score }, '[ScoreRead] Carried sports_score from SportsPersonAward DB');
      }
    }
    if (selectedRole === 'trailblazer' && alreadySubmittedCultural) {
      const culturalRec = await CulturalPersonAward.findOne({ where: { email } });
      if (culturalRec?.cultural_score) {
        scores.cultural_score = String(culturalRec.cultural_score);
        log.info({ email, cultural_score: scores.cultural_score }, '[ScoreRead] Carried cultural_score from CulturalPersonAward DB');
      }
    }

    // ─ Sheet reads for sections actually shown in this session ────────────────
    const needsSports   = !alreadySubmittedSports   && (selectedRole === 'sports_person' || selectedRole === 'trailblazer');
    const needsCultural = !alreadySubmittedCultural && (selectedRole === 'cultural_person' || selectedRole === 'trailblazer');
    const needsAcademic = selectedRole === 'trailblazer';

    const [sportsSheet, culturalSheet, academicSheet] = await Promise.all([
      needsSports   ? SportsUserSheet.findOne({ where: { email } })   : null,
      needsCultural ? CulturalUserSheet.findOne({ where: { email } }) : null,
      needsAcademic ? AcademicUserSheet.findOne({ where: { email } }) : null
    ]);

    const [sportsScore, culturalScore, academicScore] = await Promise.all([
      sportsSheet?.user_sheet_id   ? runScoreScript(sportsSheet.user_sheet_id,   masterUser) : null,
      culturalSheet?.user_sheet_id ? runScoreScript(culturalSheet.user_sheet_id, masterUser) : null,
      academicSheet?.user_sheet_id ? runScoreScript(academicSheet.user_sheet_id, masterUser) : null
    ]);

    if (needsSports   && sportsScore   !== null) scores.sports_score   = sportsScore;
    if (needsCultural && culturalScore !== null) scores.cultural_score = culturalScore;
    if (needsAcademic && academicScore !== null) scores.academic_score = academicScore;

    log.info({ email, selectedRole, ...scores }, '[ScoreRead] Scores resolved');
  } catch (err) {
    log.error({ err: err.message }, '[ScoreRead] Unexpected error — scores set to null');
  }

  return scores;
}


/**
 * Silently removes student Drive permissions for all sheets tied to their role
 * that were actually opened/generated in this session.
 *
 * For Trailblazer with pre-filled sections, we skip the sheet types that were
 * never opened (the sibling award already revoked them at its own submission time).
 *
 * @param {string} studentEmail
 * @param {string} selectedRole  - 'sports_person' | 'cultural_person' | 'trailblazer'
 * @param {object} opts          - { alreadySubmittedSports, alreadySubmittedCultural }
 */
async function triggerSheetRevocation(studentEmail, selectedRole, opts = {}) {
  try {
    const { alreadySubmittedSports = false, alreadySubmittedCultural = false } = opts;
    console.log(`[Revoke] Starting revocation for ${studentEmail}, role=${selectedRole}`);

    let sheetTypes = [...(ROLE_TO_SHEET_TYPES[selectedRole] || [])];
    if (!sheetTypes.length) {
      log.warn({ role: selectedRole }, 'Unknown role — nothing to revoke.');
      return;
    }

    // For Trailblazer: strip sheet types for sections that were pre-filled from
    // sibling awards. Those sheets were either never opened in this session OR
    // already had their permissions revoked when the sibling award was submitted.
    if (selectedRole === 'trailblazer') {
      sheetTypes = sheetTypes.filter(type => {
        if (type === 'sports'   && alreadySubmittedSports)   { log.info({ studentEmail, type }, '[Revoke] Skipping sports sheet — pre-filled from sibling award'); return false; }
        if (type === 'cultural' && alreadySubmittedCultural) { log.info({ studentEmail, type }, '[Revoke] Skipping cultural sheet — pre-filled from sibling award'); return false; }
        return true;
      });
      if (sheetTypes.length === 0) {
        log.info({ studentEmail }, '[Revoke] All sheet types were pre-filled — nothing to revoke this session');
        return;
      }
    }

    const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
    if (!masterUser || !masterUser.access_token) {
      log.error({ studentEmail }, 'Revocation failed: Master account not found or has no access_token');
      return;
    }

    log.info({ studentEmail, hasRefreshToken: !!masterUser.refresh_token }, 'Master account found');

    for (const sheetType of sheetTypes) {
      const Model = SHEET_MODEL_MAP[sheetType];
      const sheet = await Model.findOne({ where: { email: studentEmail } });

      if (!sheet || !sheet.user_sheet_id) {
        log.warn({ sheetType, studentEmail }, 'No sheet found. Nothing to revoke.');
        continue;
      }

      if (!sheet.student_permission_id) {
        log.warn({ sheetType, studentEmail }, 'No student_permission_id stored. Already revoked?');
        continue;
      }

      log.info({ sheetType, userSheetId: sheet.user_sheet_id, permId: sheet.student_permission_id }, 'Found sheet for revocation');

      // Remove only the student's permission — file stays in master's Drive
      revokeStudentAccess(sheet.user_sheet_id, sheet.student_permission_id, masterUser);

      // Null out so a re-submit or admin call doesn't attempt a double-revoke
      await sheet.update({ student_permission_id: null });

      log.info({ studentEmail, sheetType, sheetId: sheet.user_sheet_id }, 'Permission removal fired');
    }
  } catch (err) {
    // Never let revocation errors bubble up to the student's response
    log.error({ err: err.message, stack: err.stack }, 'Background revocation error');
  }
}

// ─── Controller ───────────────────────────────────────────────────────────────

const formController = {

  uploadMiddleware: (req, res, next) => {
    upload(req, res, err => {
      if (err) return res.status(400).json({ message: 'File upload error', error: err.message });
      next();
    });
  },

  async submitForm(req, res) {
    try {
      const {
        name, studentId, mobileNumber, gender, batch, email,
        academicLevel, academic_score, sportsScore, culturalScore,
        notOnProbation, trueStatement, sop, communityService,
        selected_role,
        already_submitted_sports,
        already_submitted_cultural
      } = req.body;

      // Parse the pre-fill flags sent by the frontend
      const alreadySubmittedSports   = already_submitted_sports   === 'true';
      const alreadySubmittedCultural = already_submitted_cultural === 'true';

      if (!gender) {
        return res.status(400).json({ message: 'Gender is mandatory.' });
      }

      // ── 1. Resolve award model ─────────────────────────────────────────────
      let AwardModel;
      if      (selected_role === 'trailblazer')     AwardModel = TrailblazerAward;
      else if (selected_role === 'sports_person')   AwardModel = SportsPersonAward;
      else if (selected_role === 'cultural_person') AwardModel = CulturalPersonAward;
      else return res.status(400).json({ message: 'Invalid award category selected.' });

      // ── 2. Prepare submission data ─────────────────────────────────────────
      const submissionData = {
        name,
        student_id:     studentId,
        mobile_number:  mobileNumber,
        gender,
        batch,
        email,
        not_on_probation: notOnProbation === 'true' || notOnProbation === true,
        tru_statement:    trueStatement  === 'true' || trueStatement  === true,
        status: 'Submitted'
      };

      if (selected_role === 'trailblazer') {
        submissionData.academic_score = academic_score ? parseFloat(academic_score) : null;
      }

      // Photo column
      if (req.files?.['photo']?.[0]) {
        submissionData.photo = req.files['photo'][0].filename;
      } else if (studentId) {
        submissionData.photo = studentId;
      }

      // ── 2b. Read live scores from student's sheet(s) ───────────────────────
      // Fetches the computed value of B1 (=SUM(J5:J495)) from the student's
      // Google Sheet using the master token. Runs BEFORE the DB write so the
      // final stored score is always the actual sheet value, not a client guess.
      const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
      if (masterUser?.access_token) {
        const scores = await readScoresForSubmission(email, selected_role, masterUser, {
          alreadySubmittedSports,
          alreadySubmittedCultural
        });
        // Overwrite whatever the client sent — sheet/DB is the source of truth
        if (scores.sports_score   !== null) submissionData.sports_score   = scores.sports_score;
        if (scores.cultural_score !== null) submissionData.cultural_score = scores.cultural_score;
        if (scores.academic_score !== null) submissionData.academic_score = scores.academic_score;
      } else {
        log.warn({ email }, '[ScoreRead] Master tokens unavailable — scores stored as null');
      }

      // ── 2b-ii. CGPA injection into academic raw score (Trailblazer only) ────
      // For Trailblazer, the student’s CGPA is added precisely to the academic
      // raw score BEFORE it enters the scaling formula.
      // Example: sheet_raw=40, cgpa=7.15 → combined_raw=47.15 → scaleScore(47.15)
      // Uses the local StudentCgpaCache — fast single-row read, no audit DB call.
      // If CGPA is not cached (null), the raw score passes through unchanged.
      if (selected_role === 'trailblazer' && submissionData.academic_score != null) {
        const cgpaRow = await StudentCgpaCache.findOne({
          where: { email },
          attributes: ['cgpa'],
          raw: true
        });
        const cgpaVal = cgpaRow?.cgpa != null ? parseFloat(cgpaRow.cgpa) : null;
        if (cgpaVal !== null && !isNaN(cgpaVal)) {
          const rawBeforeCgpa = parseFloat(submissionData.academic_score);
          const combinedRaw   = parseFloat((rawBeforeCgpa + cgpaVal).toFixed(2));
          submissionData.academic_score = combinedRaw;
          log.info(
            { email, rawBeforeCgpa, cgpaVal, combinedRaw },
            '[CgpaInjection] CGPA added to academic raw score for Trailblazer'
          );
        } else {
          log.warn({ email }, '[CgpaInjection] CGPA not in cache — academic_score unchanged, will not include CGPA boost');
        }
      }

      // ── 2c. Auto-scale raw scores → verified scores ───────────────────────
      // Formula from weighted_scaled_scores.md (w = 0.05, y_max = 12):
      //   x ≤ 150  →  y = x / 15
      //   x > 150  →  y = min(10 + 0.05*(x-150), 12)
      // These are written at submission time so admins have a sensible starting
      // value. Admin edits in the workbook will still override these values.
      if (submissionData.sports_score   != null) submissionData.sports_verified_score   = scaleScore(submissionData.sports_score);
      if (submissionData.cultural_score != null) submissionData.cultural_verified_score = scaleScore(submissionData.cultural_score);
      if (submissionData.academic_score != null) submissionData.academic_verified_score = scaleScore(submissionData.academic_score);

      // For Trailblazer: sum the three verified scores into total_verified_score
      if (selected_role === 'trailblazer') {
        const sv = parseFloat(submissionData.sports_verified_score)   || 0;
        const cv = parseFloat(submissionData.cultural_verified_score) || 0;
        const av = parseFloat(submissionData.academic_verified_score) || 0;
        if (sv || cv || av) {
          submissionData.total_verified_score = parseFloat((sv + cv + av).toFixed(2)).toString();
          log.info({ email, sv, cv, av, total: submissionData.total_verified_score }, '[ScoreScale] Trailblazer total_verified_score computed');
        }
      }
      log.info({
        email, role: selected_role,
        raw:   { sports: submissionData.sports_score, cultural: submissionData.cultural_score, academic: submissionData.academic_score },
        scaled: { sports: submissionData.sports_verified_score, cultural: submissionData.cultural_verified_score, academic: submissionData.academic_verified_score }
      }, '[ScoreScale] Verified scores written to submissionData');

      // ── 3. Upsert submission ───────────────────────────────────────────────
      let submission = await AwardModel.findOne({ where: { email } });
      if (submission) {
        await submission.update(submissionData);
      } else {
        submission = await AwardModel.create(submissionData);
      }

      // ── 4. Handle attachments ──────────────────────────────────────────────
      const attachmentJobs = [];

      if (req.files['sport_attachment']) {
        req.files['sport_attachment'].forEach(file => {
          attachmentJobs.push(SportAttachment.create({ submission_id: submission.id, file_name: file.filename }));
        });
      }
      if (req.files['cultural_attachment']) {
        req.files['cultural_attachment'].forEach(file => {
          attachmentJobs.push(CulturalAttachment.create({ submission_id: submission.id, file_name: file.filename }));
        });
      }
      if (req.files['academic_attachments']) {
        req.files['academic_attachments'].forEach(file => {
          attachmentJobs.push(academicAttachment.create({ submission_id: submission.id, file_name: file.filename }));
        });
      }

      await Promise.all(attachmentJobs);

      // ── 5. Respond to student FIRST ────────────────────────────────────────
      res.status(200).json({
        message: `${selected_role.replace('_', ' ')} submitted successfully`,
        submission_id: submission.id
      });

      // ── 6. Background tasks after response is flushed ─────────────────────
      setImmediate(async () => {
        // ── Queue submission confirmation email (fire-and-forget) ──────────
        try {
          const studentName = submissionData.name || email;
          await submissionEmailQueue.add(
            `confirm:${submission.id}`,
            { studentEmail: email, studentName, awardRole: selected_role, submissionId: submission.id },
            { jobId: `confirm-${submission.id}`, attempts: 3 }
          );
          log.info({ email, submissionId: submission.id }, '[SubmissionEmail] Confirmation email queued');
        } catch (emailErr) {
          log.warn({ err: emailErr.message }, '[SubmissionEmail] Failed to enqueue — non-fatal');
        }

        triggerSheetRevocation(email, selected_role, { alreadySubmittedSports, alreadySubmittedCultural });
        emitDashboardUpdate();   // push fresh award counts to admin dashboard

        // ── Back-fill verified scores from sibling tables ──────────────────
        // If this student already had a score verified in another award table,
        // copy it into this newly submitted record automatically.
        try {
          const roleTypeMap = {
            sports_person:   'sports',
            cultural_person: 'cultural',
            trailblazer:     'trailblazer',
          };
          const awardType = roleTypeMap[selected_role];

          if (awardType === 'trailblazer') {
            // Pull sports_verified_score from SportsPersonAward if that record exists
            const [sportsRec, culturalRec] = await Promise.all([
              SportsPersonAward.findOne({ where: { email } }),
              CulturalPersonAward.findOne({ where: { email } }),
            ]);
            const backfill = {};
            if (sportsRec?.sports_verified_score)   backfill.sports_verified_score   = sportsRec.sports_verified_score;
            if (culturalRec?.cultural_verified_score) backfill.cultural_verified_score = culturalRec.cultural_verified_score;
            if (Object.keys(backfill).length > 0) {
              await submission.update(backfill);
              console.log(`[ScoresSync] Backfilled trailblazer record for ${email}:`, backfill);
            }
          } else if (awardType === 'sports') {
            // Fetch Trailblazer record (may not exist if student never applied for it)
            const trailRec = await TrailblazerAward.findOne({ where: { email } });
            if (trailRec) {
              // ① Carry admin-overridden verified score DOWN to the new sports submission
              if (trailRec.sports_verified_score) {
                await submission.update({ sports_verified_score: trailRec.sports_verified_score });
                console.log(`[ScoresSync] Backfilled sports record for ${email}: sports_verified_score =`, trailRec.sports_verified_score);
              }
              // ② Push fresh raw + scaled scores UP to TrailblazerAward, then recompute total
              if (submission.sports_score !== null && submission.sports_score !== undefined) {
                const newSportsVerified = scaleScore(submission.sports_score);
                const trailUpdate = { sports_score: submission.sports_score };
                if (newSportsVerified !== null) trailUpdate.sports_verified_score = newSportsVerified;
                // Recompute total: new sports + existing cultural + existing academic
                const sv = parseFloat(newSportsVerified)                    || 0;
                const cv = parseFloat(trailRec.cultural_verified_score)     || 0;
                const av = parseFloat(trailRec.academic_verified_score)     || 0;
                if (sv || cv || av) trailUpdate.total_verified_score = parseFloat((sv + cv + av).toFixed(2)).toString();
                await trailRec.update(trailUpdate);
                console.log(`[ScoresSync] Synced TrailblazerAward for ${email}:`, trailUpdate);
              }
            }
          } else if (awardType === 'cultural') {
            // Fetch Trailblazer record (may not exist if student never applied for it)
            const trailRec = await TrailblazerAward.findOne({ where: { email } });
            if (trailRec) {
              // ① Carry admin-overridden verified score DOWN to the new cultural submission
              if (trailRec.cultural_verified_score) {
                await submission.update({ cultural_verified_score: trailRec.cultural_verified_score });
                console.log(`[ScoresSync] Backfilled cultural record for ${email}: cultural_verified_score =`, trailRec.cultural_verified_score);
              }
              // ② Push fresh raw + scaled scores UP to TrailblazerAward, then recompute total
              if (submission.cultural_score !== null && submission.cultural_score !== undefined) {
                const newCulturalVerified = scaleScore(submission.cultural_score);
                const trailUpdate = { cultural_score: submission.cultural_score };
                if (newCulturalVerified !== null) trailUpdate.cultural_verified_score = newCulturalVerified;
                // Recompute total: existing sports + new cultural + existing academic
                const sv = parseFloat(trailRec.sports_verified_score)       || 0;
                const cv = parseFloat(newCulturalVerified)                  || 0;
                const av = parseFloat(trailRec.academic_verified_score)     || 0;
                if (sv || cv || av) trailUpdate.total_verified_score = parseFloat((sv + cv + av).toFixed(2)).toString();
                await trailRec.update(trailUpdate);
                console.log(`[ScoresSync] Synced TrailblazerAward for ${email}:`, trailUpdate);
              }
            }
          }
        } catch (syncErr) {
          console.error('[ScoresSync] Backfill error on submission:', syncErr.message);
        }

        // ── Background PDF merge ───────────────────────────────────────────────
        // Combines all uploaded PDFs for this submission into one file stored at
        // Attachments/merged/{student_id}_{type}_merged.pdf, served publicly at
        // /merged-pdfs/{student_id}_{type}_merged.pdf (no auth, inline preview).
        // Trailblazer merges sport + cultural + academic PDFs all together.
        try {
          const sidForMerge = (submissionData.student_id || '').toString().trim();
          const typeKey     = { sports_person: 'sport', cultural_person: 'cultural', trailblazer: 'trailblazer' }[selected_role];
          if (sidForMerge && typeKey) {
            const [sFiles, cFiles, aFiles] = await Promise.all([
              (selected_role === 'sports_person' || selected_role === 'trailblazer')
                ? SportAttachment.findAll({ where: { submission_id: submission.id }, attributes: ['file_name'] })
                : [],
              (selected_role === 'cultural_person' || selected_role === 'trailblazer')
                ? CulturalAttachment.findAll({ where: { submission_id: submission.id }, attributes: ['file_name'] })
                : [],
              selected_role === 'trailblazer'
                ? academicAttachment.findAll({ where: { submission_id: submission.id }, attributes: ['file_name'] })
                : [],
            ]);
            const pdfPaths = [
              ...sFiles.map(f => path.join(ATTACHMENT_DIR, 'sport',    f.file_name)),
              ...cFiles.map(f => path.join(ATTACHMENT_DIR, 'cultural', f.file_name)),
              ...aFiles.map(f => path.join(ATTACHMENT_DIR, 'academic', f.file_name)),
            ].filter(p => fs.existsSync(p));
            if (pdfPaths.length > 0) {
              // Save merged PDF inside the award-type subfolder (sport/, cultural/, academic/)
              // These directories already exist (created at startup), so no mkdir needed.
              const mergeSubMap  = { sport: 'sport', cultural: 'cultural', trailblazer: 'academic' };
              const mergeSub     = mergeSubMap[typeKey] || typeKey;
              const outputPath   = path.join(ATTACHMENT_DIR, mergeSub, `${sidForMerge}_${typeKey}_merged.pdf`);
              const scriptPath   = path.join(__dirname, '../scripts/merge_pdfs.py');
              await new Promise(resolve => {
                const proc = spawn('python3', [scriptPath, outputPath, ...pdfPaths]);
                let out = '';
                let err = '';
                proc.stdout.on('data', d => { out += d.toString(); });
                proc.stderr.on('data', d => { err += d.toString(); });
                proc.on('close', (code) => {
                  try {
                    const r = JSON.parse(out.trim());
                    if (r.success) {
                      log.info({ sidForMerge, typeKey, merged: r.merged, output: r.output }, '[PdfMerge] ✅ Merged successfully');
                    } else {
                      log.error({ sidForMerge, typeKey, error: r.error, stderr: err }, '[PdfMerge] ❌ Script returned failure');
                    }
                  } catch (_) {
                    log.error({ out, stderr: err, exitCode: code }, '[PdfMerge] Non-JSON output from merge script');
                  }
                  resolve();
                });
              });
            } else {
              log.info({ sidForMerge, typeKey }, '[PdfMerge] No PDF files found — skipping merge');
            }
          }
        } catch (mergeErr) {
          log.error({ err: mergeErr.message }, '[PdfMerge] Error during PDF merge');
        }
      });

    } catch (error) {
      console.error('[FormController] Submission error:', error);
      return res.status(500).json({ message: 'Error submitting form', error: error.message });
    }
  },

  async getAll(req, res) {
    try {
      const [trailblazers, sports, cultural] = await Promise.all([
        TrailblazerAward.findAll(),
        SportsPersonAward.findAll(),
        CulturalPersonAward.findAll()
      ]);
      return res.json({ trailblazers, sports, cultural });
    } catch (err) {
      return res.status(500).json({ message: 'Error fetching submissions', error: err.message });
    }
  },

  async startQueueWorker() {
    console.log('✅ Award submission tables routing active');
  }
};

module.exports = formController;