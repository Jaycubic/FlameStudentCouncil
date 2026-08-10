// controllers/formSubmissionController.js
//
// Unified election form submission handler.
// Replaces the old 3-award-model routing with a single ElectionFormResponse model.

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
const { revokeStudentAccess, insertSopSheetTab, insertMoreInfoSheetTab } = require('./sheetController');
const { triggerAutoCloudSync } = require('./awardsWorkbookController');
const { emitDashboardUpdate } = require('./dashboardController');
const { submissionEmailQueue } = require('../queues/submissionEmailQueue');
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

const upload = multer({ storage }).fields([
  { name: 'photo',      maxCount: 1  },
  { name: 'attachment',  maxCount: 10 },  // Generic election attachments (optional)
]);

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
 * Revokes workbook access after form submission.
 */
async function triggerWorkbookRevocation(studentEmail) {
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

    const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
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
      if (err) return res.status(400).json({ message: 'File upload error', error: err.message });
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
        return res.status(400).json({ message: 'Gender is mandatory.' });
      }

      if (!position_selected) {
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
        status: 'Submitted'
      };

      // Photo column
      if (req.files?.['photo']?.[0]) {
        submissionData.photo = req.files['photo'][0].filename;
      } else if (studentId) {
        submissionData.photo = studentId;
      }

      // ── 2. Read live scores from student's workbook ────────────────────────
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
      if (submissionData.academic_score != null) submissionData.academic_verified_score = scaleScore(submissionData.academic_score);

      // Sum the three verified scores into total_verified_score
      const sv = parseFloat(submissionData.sports_verified_score)   || 0;
      const cv = parseFloat(submissionData.cultural_verified_score) || 0;
      const av = parseFloat(submissionData.academic_verified_score) || 0;
      if (sv || cv || av) {
        submissionData.total_verified_score = parseFloat((sv + cv + av).toFixed(2)).toString();
        log.info({ email, sv, cv, av, total: submissionData.total_verified_score }, '[ScoreScale] total_verified_score computed');
      }

      log.info({
        email,
        raw:   { sports: submissionData.sports_score, cultural: submissionData.cultural_score, academic: submissionData.academic_score },
        scaled: { sports: submissionData.sports_verified_score, cultural: submissionData.cultural_verified_score, academic: submissionData.academic_verified_score }
      }, '[ScoreScale] Verified scores written to submissionData');

      // ── 3. Upsert submission ───────────────────────────────────────────────
      let submission = await ElectionFormResponse.findOne({ where: { email } });
      if (submission) {
        await submission.update(submissionData);
      } else {
        submission = await ElectionFormResponse.create(submissionData);
      }

      // ── 4. Handle attachments (optional) ───────────────────────────────────
      // Attachments are optional for Student Council elections
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

      // ── 5. Respond to student FIRST ────────────────────────────────────────
      res.status(200).json({
        message: 'Election form submitted successfully',
        submission_id: submission.id
      });

      // ── 6. Background tasks after response is flushed ─────────────────────
      setImmediate(async () => {
        // ── Queue submission confirmation email (fire-and-forget) ──────────
        try {
          const studentName = submissionData.name || email;
          await submissionEmailQueue.add(
            `confirm:${submission.id}`,
            {
              studentEmail: email,
              studentName,
              positionSelected: position_selected,
              submissionId: submission.id
            },
            { jobId: `confirm-${submission.id}`, attempts: 3 }
          );
          log.info({ email, submissionId: submission.id }, '[SubmissionEmail] Confirmation email queued');
        } catch (emailErr) {
          log.warn({ err: emailErr.message }, '[SubmissionEmail] Failed to enqueue — non-fatal');
        }

        // ── Dynamically insert Statement of Purpose sheet tab into student workbook ─
        try {
          const sheet = await AcademicUserSheet.findOne({ where: { email } });
          if (sheet?.user_sheet_id && masterUser?.access_token) {
            if (statement_of_purpose) {
              await insertSopSheetTab(sheet.user_sheet_id, statement_of_purpose, masterUser);
            }
            // Insert 'More Information' sheet tab ONLY if more_info is filled out
            const moreInfoText = submissionData.more_info;
            if (moreInfoText && moreInfoText.trim()) {
              await insertMoreInfoSheetTab(sheet.user_sheet_id, moreInfoText, masterUser);
            }
          }
        } catch (sopErr) {
          log.warn({ err: sopErr.message, email }, '[DynamicSheetTabs] Failed to insert sheet tabs — non-fatal');
        }

        triggerWorkbookRevocation(email);
        emitDashboardUpdate();   // push fresh stats to admin dashboard

        // ── Background PDF merge ───────────────────────────────────────────
        try {
          const sidForMerge = (submissionData.student_id || '').toString().trim();
          if (sidForMerge) {
            const aFiles = await ElectionAttachment.findAll({
              where: { submission_id: submission.id },
              attributes: ['file_name']
            });
            const pdfPaths = aFiles
              .map(f => path.join(ATTACHMENT_DIR, 'election', f.file_name))
              .filter(p => fs.existsSync(p));

            if (pdfPaths.length > 0) {
              const outputPath = path.join(ATTACHMENT_DIR, 'election', `${sidForMerge}_election_merged.pdf`);
              const scriptPath = path.join(__dirname, '../scripts/merge_pdfs.py');
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
                      log.info({ sidForMerge, merged: r.merged, output: r.output }, '[PdfMerge] ✅ Merged successfully');
                    } else {
                      log.error({ sidForMerge, error: r.error, stderr: err }, '[PdfMerge] ❌ Script returned failure');
                    }
                  } catch (_) {
                    log.error({ out, stderr: err, exitCode: code }, '[PdfMerge] Non-JSON output from merge script');
                  }
                  resolve();
                });
              });
            } else {
              log.info({ sidForMerge }, '[PdfMerge] No PDF files found — skipping merge');
            }
          }
        } catch (mergeErr) {
          log.error({ err: mergeErr.message }, '[PdfMerge] Error during PDF merge');
        }
      });

      // Trigger automatic cloud sync if Master Admin Workbook has been created (completely asynchronous)
      setImmediate(() => {
        triggerAutoCloudSync().catch(err => log.error({ err: err.message }, '[AutoCloudSync] Background sync error (non-fatal)'));
      });

    } catch (error) {
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