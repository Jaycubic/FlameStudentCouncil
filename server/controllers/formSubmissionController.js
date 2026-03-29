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
  User
} = require('../models');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { spawn } = require('child_process');

// Import the fire-and-forget revoke helper from sheetController
const { revokeStudentAccess } = require('./sheetController');
const log = require('../utils/logger').child({ module: 'FormSubmissionController' });

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
    if (file.fieldname === 'photo')                    dest = PHOTO_DIR;
    else if (file.fieldname === 'sport_attachment')    dest = path.join(ATTACHMENT_DIR, 'sport');
    else if (file.fieldname === 'cultural_attachment') dest = path.join(ATTACHMENT_DIR, 'cultural');
    else if (file.fieldname === 'academic_attachments') dest = path.join(ATTACHMENT_DIR, 'academic');
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
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
  trailblazer:     ['sports', 'cultural']
};

const SHEET_MODEL_MAP = {
  cultural: CulturalUserSheet,
  sports:   SportsUserSheet
};

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
 * Both default to null if sheet not found or read fails.
 */
async function readScoresForSubmission(email, selectedRole, masterUser) {
  const scores = { sports_score: null, cultural_score: null };

  try {
    const needsSports   = selectedRole === 'sports_person'   || selectedRole === 'trailblazer';
    const needsCultural = selectedRole === 'cultural_person' || selectedRole === 'trailblazer';

    const [sportsSheet, culturalSheet] = await Promise.all([
      needsSports   ? SportsUserSheet.findOne({ where: { email } })   : null,
      needsCultural ? CulturalUserSheet.findOne({ where: { email } }) : null
    ]);

    const [sportsScore, culturalScore] = await Promise.all([
      sportsSheet?.user_sheet_id   ? runScoreScript(sportsSheet.user_sheet_id,   masterUser) : null,
      culturalSheet?.user_sheet_id ? runScoreScript(culturalSheet.user_sheet_id, masterUser) : null
    ]);

    if (needsSports)   scores.sports_score   = sportsScore;
    if (needsCultural) scores.cultural_score = culturalScore;

    log.info({ email, selectedRole, sportsScore, culturalScore }, '[ScoreRead] Scores resolved');
  } catch (err) {
    log.error({ err: err.message }, '[ScoreRead] Unexpected error — scores set to null');
  }

  return scores;
}


/**
 * Silently removes student Drive permissions for all sheets tied to their role.
 * The file itself stays in master's private folder — only the student's
 * explicit permission entry is deleted.
 *
 * @param {string} studentEmail
 * @param {string} selectedRole  - 'sports_person' | 'cultural_person' | 'trailblazer'
 */
async function triggerSheetRevocation(studentEmail, selectedRole) {
  try {
    console.log(`[Revoke] Starting revocation for ${studentEmail}, role=${selectedRole}`);

    const sheetTypes = ROLE_TO_SHEET_TYPES[selectedRole];
    if (!sheetTypes) {
      log.warn({ role: selectedRole }, 'Unknown role — nothing to revoke.');
      return;
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
        academicLevel, cgpa, sportsScore, culturalScore,
        notOnProbation, trueStatement, sop, communityService,
        selected_role
      } = req.body;

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
        submissionData.cgpa = cgpa ? parseFloat(cgpa) : null;
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
        const scores = await readScoresForSubmission(email, selected_role, masterUser);
        // Overwrite whatever the client sent — sheet is the source of truth
        if (scores.sports_score   !== null) submissionData.sports_score   = scores.sports_score;
        if (scores.cultural_score !== null) submissionData.cultural_score = scores.cultural_score;
      } else {
        log.warn({ email }, '[ScoreRead] Master tokens unavailable — scores stored as null');
      }


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

      // ── 6. Fire invisible permission revocation ────────────────────────────
      // setImmediate defers until after the response is flushed.
      // Student sees "submitted" instantly; Drive permission removed in background.
      setImmediate(() => {
        triggerSheetRevocation(email, selected_role);
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