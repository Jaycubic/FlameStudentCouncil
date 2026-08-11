// controllers/formSubmissionController.js
//
// Unified election form submission handler.
// Architecture:
//   - Multer bounded (15MB/file, image/PDF filter, auto-cleanup on failure)
//   - Synchronous: Score reading from workbook + workbook revocation
//   - Atomic upsert on email (UNIQUE constraint)
//   - Background (BullMQ): Sheet tabs, PDF merge, email, cloud sync, dashboard

const {
  ElectionFormResponse,
  ElectionAttachment,
  AcademicUserSheet,
  StudentData,
  StudentCgpaCache,
  User
} = require('../models');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const { spawn } = require('child_process');

// Import the fire-and-forget revoke helper & sheet tab inserters from sheetController
const { revokeStudentAccess } = require('./sheetController');
const { emitDashboardUpdate } = require('./dashboardController');
const { submissionProcessingQueue } = require('../queues/submissionProcessingQueue');
const log = require('../utils/logger').child({ module: 'FormSubmissionController' });

const MASTER_EMAIL      = 'student.awards@flame.edu.in';
const SCORE_SCRIPT_PATH = path.join(__dirname, '../scripts/read_sheet_score.py');

// ─── Storage config ───────────────────────────────────────────────────────────

const ATTACHMENT_DIR = '/opt/View/FlameStudentCouncil/server/Attachments';
const PHOTO_DIR = '/opt/View/StudentTrackingSystem/server/Photos';

['photos', 'election'].forEach(sub => {
  const dir = sub === 'photos' ? PHOTO_DIR : path.join(ATTACHMENT_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = ATTACHMENT_DIR;
    if (file.fieldname === 'photo')          dest = PHOTO_DIR;
    else if (file.fieldname === 'attachment') dest = path.join(ATTACHMENT_DIR, 'election');
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Sanitise original filename
    const safeName = file.originalname
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .substring(0, 100);
    const ext      = path.extname(safeName) || path.extname(file.originalname);
    const baseName = path.basename(safeName, ext) || 'file';

    // Format: Election-OriginalName.ext
    cb(null, `Election-${baseName}${ext}`);
  }
});

// ─── File filter: only accept images and PDFs ─────────────────────────────────
const ALLOWED_MIMETYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
]);

function fileFilter(req, file, cb) {
  if (ALLOWED_MIMETYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024,  // 15MB per file
    files: 10,                    // Max 10 files total
  },
}).fields([
  { name: 'photo',      maxCount: 1  },
  { name: 'attachment',  maxCount: 10 },
]);

// ─── Helper: clean up uploaded files on error ─────────────────────────────────
function cleanupUploadedFiles(req) {
  if (!req.files) return;
  const allFiles = Object.values(req.files).flat();
  for (const file of allFiles) {
    try {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    } catch (err) {
      log.warn({ file: file.path, err: err.message }, '[Cleanup] Failed to unlink orphaned file');
    }
  }
}

// ─── Score scaling (weighted_scaled_scores.md) ───────────────────────────────
// Piecewise formula:
//   x ≤ 150  →  y = x / 15
//   x > 150  →  y = min(10 + 0.05 * (x - 150), 12)
// w = 0.05, y_max = 12

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

// ─── Read scores from the student's workbook ─────────────────────────────────
// The "Total Point" sheet has: B3=Academic, C3=Sports, D3=Cultural
// Returns { academic_score, sports_score, cultural_score }

function runScoreScript(sheetId, masterUser) {
  return new Promise((resolve) => {
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
      log.warn({ sheetId }, '[ScoreRead] Timed out after 30s — scores will be null');
      resolve(null);
    }, 30_000);

    proc.on('close', code => {
      clearTimeout(timer);
      try {
        const result = JSON.parse(stdout.trim());
        if (result.success) {
          resolve(result);  // { success, academic_score, sports_score, cultural_score }
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
 * Reads all 3 scores from the student's single workbook.
 */
async function readScoresFromWorkbook(email, masterUser) {
  const scores = { sports_score: null, cultural_score: null, academic_score: null };

  try {
    const sheet = await AcademicUserSheet.findOne({ where: { email } });
    if (!sheet?.user_sheet_id) {
      log.warn({ email }, '[ScoreRead] No workbook found for student');
      return scores;
    }

    const result = await runScoreScript(sheet.user_sheet_id, masterUser);
    if (result) {
      if (result.academic_score !== null && result.academic_score !== undefined) {
        scores.academic_score = String(result.academic_score);
      }
      if (result.sports_score !== null && result.sports_score !== undefined) {
        scores.sports_score = String(result.sports_score);
      }
      if (result.cultural_score !== null && result.cultural_score !== undefined) {
        scores.cultural_score = String(result.cultural_score);
      }
    }

    log.info({ email, ...scores }, '[ScoreRead] Scores resolved from workbook');
  } catch (err) {
    log.error({ err: err.message }, '[ScoreRead] Unexpected error — scores set to null');
  }

  return scores;
}


/**
 * Revokes workbook access after form submission (SYNCHRONOUS).
 */
async function triggerWorkbookRevocation(studentEmail, masterUser) {
  try {
    console.log(`[Revoke] Starting revocation for ${studentEmail}`);

    const sheet = await AcademicUserSheet.findOne({ where: { email: studentEmail } });

    if (!sheet || !sheet.user_sheet_id) {
      log.warn({ studentEmail }, 'No workbook found. Nothing to revoke.');
      return;
    }

    if (!sheet.student_permission_id) {
      log.warn({ studentEmail }, 'No student_permission_id stored. Already revoked?');
      return;
    }

    if (!masterUser || !masterUser.access_token) {
      log.error({ studentEmail }, 'Revocation failed: Master account not found or has no access_token');
      return;
    }

    log.info({ userSheetId: sheet.user_sheet_id, permId: sheet.student_permission_id }, 'Found workbook for revocation');

    revokeStudentAccess(sheet.user_sheet_id, sheet.student_permission_id, masterUser);
    await sheet.update({ student_permission_id: null });

    log.info({ studentEmail, sheetId: sheet.user_sheet_id }, 'Permission removal fired');
  } catch (err) {
    log.error({ err: err.message, stack: err.stack }, 'Background revocation error');
  }
}

// ─── Controller ───────────────────────────────────────────────────────────────

const formController = {

  uploadMiddleware: (req, res, next) => {
    upload(req, res, err => {
      if (err instanceof multer.MulterError) {
        // Multer-specific errors (file too large, too many files, unexpected type)
        cleanupUploadedFiles(req);
        const messages = {
          LIMIT_FILE_SIZE:       'File too large. Maximum allowed size is 15MB per file.',
          LIMIT_FILE_COUNT:      'Too many files. Maximum 10 files allowed.',
          LIMIT_UNEXPECTED_FILE: `Unsupported file type for field "${err.field}". Only images (JPEG, PNG, WebP) and PDFs are accepted.`,
        };
        return res.status(400).json({
          message: messages[err.code] || 'File upload error',
          error: err.code,
        });
      }
      if (err) {
        cleanupUploadedFiles(req);
        return res.status(400).json({ message: 'File upload error', error: err.message });
      }
      next();
    });
  },

  async submitForm(req, res) {
    try {
      const {
        name, studentId, mobileNumber, gender, batch, email,
        position_selected, community_service, statement_of_purpose,
        more_info, moreInfo,
        read_handbook,
        academicLevel, academic_score, sportsScore, culturalScore,
        notOnProbation, trueStatement,
      } = req.body;

      if (!gender) {
        cleanupUploadedFiles(req);
        return res.status(400).json({ message: 'Gender is mandatory.' });
      }

      if (!position_selected) {
        cleanupUploadedFiles(req);
        return res.status(400).json({ message: 'Position selection is mandatory.' });
      }

      // ── 1. Prepare submission data ─────────────────────────────────────────
      const submissionData = {
        name,
        student_id:           studentId,
        mobile_number:        mobileNumber,
        gender,
        batch,
        email,
        position_selected,
        community_service:    community_service || '',
        statement_of_purpose: statement_of_purpose || '',
        more_info:            more_info || moreInfo || null,
        read_handbook:        read_handbook === 'true' || read_handbook === true,
        not_on_probation:     notOnProbation === 'true' || notOnProbation === true,
        tru_statement:        trueStatement  === 'true' || trueStatement  === true,
        status: 'Submitted',
        notification_status: 'pending',
      };

      // Photo column
      if (req.files?.['photo']?.[0]) {
        submissionData.photo = req.files['photo'][0].filename;
      } else if (studentId) {
        submissionData.photo = studentId;
      }

      // ── 2. Read live scores from student's workbook (SYNCHRONOUS) ──────────
      const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
      if (masterUser?.access_token) {
        const scores = await readScoresFromWorkbook(email, masterUser);
        if (scores.sports_score   !== null) submissionData.sports_score   = scores.sports_score;
        if (scores.cultural_score !== null) submissionData.cultural_score = scores.cultural_score;
        if (scores.academic_score !== null) submissionData.academic_score = scores.academic_score;
      } else {
        log.warn({ email }, '[ScoreRead] Master tokens unavailable — scores stored as null');
      }

      // ── 2c. Score Validation & Sanitization ───────────────────────────────
      const validateScore = (scoreRaw) => {
        if (scoreRaw === null || scoreRaw === undefined || String(scoreRaw).trim() === '') return null;
        let value = parseFloat(scoreRaw);
        if (isNaN(value)) value = 0;
        if (value < 0) value = 0;
        if (value > 9999.99) value = 9999.99;
        return value.toFixed(2);
      };

      if (submissionData.sports_score != null)   submissionData.sports_score   = validateScore(submissionData.sports_score);
      if (submissionData.cultural_score != null) submissionData.cultural_score = validateScore(submissionData.cultural_score);
      if (submissionData.academic_score != null) submissionData.academic_score = validateScore(submissionData.academic_score);

      // ── 2d. Auto-scale raw scores → verified scores ───────────────────────
      if (submissionData.sports_score   != null) submissionData.sports_verified_score   = scaleScore(submissionData.sports_score);
      if (submissionData.cultural_score != null) submissionData.cultural_verified_score = scaleScore(submissionData.cultural_score);
      if (submissionData.academic_score != null) submissionData.academic_verified_score = submissionData.academic_score; // CGPA is unscaled

      // Sum the three verified scores + director scores into total_verified_score (capped at 30)
      const sv = parseFloat(submissionData.sports_verified_score)   || 0;
      const cv = parseFloat(submissionData.cultural_verified_score) || 0;
      const av = parseFloat(submissionData.academic_verified_score) || 0;
      const sd = parseFloat(submissionData.sports_director_score)   || 0;
      const cd = parseFloat(submissionData.cultural_director_score) || 0;
      if (sv || cv || av || sd || cd) {
        const rawSum = sv + cv + av + sd + cd;
        const cappedTotal = Math.min(30, parseFloat(rawSum.toFixed(2)));
        submissionData.total_verified_score = cappedTotal.toString();
        log.info({ email, sv, cv, av, sd, cd, total: submissionData.total_verified_score }, '[ScoreScale] total_verified_score computed');
      }

      log.info({
        email,
        raw:   { sports: submissionData.sports_score, cultural: submissionData.cultural_score, academic: submissionData.academic_score },
        scaled: { sports: submissionData.sports_verified_score, cultural: submissionData.cultural_verified_score, academic: submissionData.academic_verified_score }
      }, '[ScoreScale] Verified scores written to submissionData');

      // ── 3. Atomic Upsert (prevents double-click / race condition duplicates) ─
      let submission;
      const [record, created] = await ElectionFormResponse.upsert(submissionData, {
        returning: true,
        conflictFields: ['email'],
      });
      submission = record;

      if (!created) {
        log.info({ email, submissionId: submission.id }, '[Upsert] Updated existing submission');
      } else {
        log.info({ email, submissionId: submission.id }, '[Upsert] Created new submission');
      }

      // ── 4. Handle attachments (optional) ───────────────────────────────────
      try {
        if (req.files && req.files['attachment']) {
          const attachmentJobs = [];
          req.files['attachment'].forEach(file => {
            attachmentJobs.push(ElectionAttachment.create({
              submission_id: submission.id,
              file_name: file.filename
            }));
          });
          await Promise.all(attachmentJobs);
        }
      } catch (attachErr) {
        log.error({ err: attachErr.message, email }, 'Error processing or saving attachments');
        // Non-fatal — don't block submission for optional attachments
      }

      // ── 5. Workbook Revocation (SYNCHRONOUS — immediate) ───────────────────
      if (masterUser?.access_token) {
        await triggerWorkbookRevocation(email, masterUser);
      }

      // ── 6. Respond to student ──────────────────────────────────────────────
      res.status(200).json({
        message: 'Election form submitted successfully',
        submission_id: submission.id
      });

      // ── 7. Queue background tasks (non-blocking) ──────────────────────────
      try {
        await submissionProcessingQueue.add(
          `process:${submission.id}`,
          {
            submissionId:      submission.id,
            email,
            studentName:       submissionData.name || email,
            positionSelected:  position_selected,
            studentId:         submissionData.student_id,
            statementOfPurpose: statement_of_purpose || '',
            moreInfo:          submissionData.more_info || '',
          },
          { jobId: `process-${submission.id}-${Date.now()}` }
        );
        log.info({ email, submissionId: submission.id }, '[Queue] Background processing job dispatched');
      } catch (queueErr) {
        log.error({ err: queueErr.message, email }, '[Queue] Failed to enqueue background job — non-fatal');
        // Fallback: emit dashboard update directly so admin sees the submission
        emitDashboardUpdate();
      }

    } catch (error) {
      // Clean up any uploaded files if the whole submission failed
      cleanupUploadedFiles(req);
      console.error('[FormController] Submission error:', error);
      return res.status(500).json({ message: 'Error submitting form', error: error.message });
    }
  },

  async getAll(req, res) {
    try {
      const submissions = await ElectionFormResponse.findAll();
      return res.json({ submissions });
    } catch (err) {
      return res.status(500).json({ message: 'Error fetching submissions', error: err.message });
    }
  },

  async startQueueWorker() {
    console.log('✅ Election form submission routing active');
  }
};

module.exports = formController;