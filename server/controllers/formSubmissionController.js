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
const path = require('path');
const fs = require('fs');

// Import the fire-and-forget revoke helper from sheetController
const { revokeStudentAccess } = require('./sheetController');

const MASTER_EMAIL = 'student.awards@flame.edu.in';

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
    if (file.fieldname === 'photo')                  dest = PHOTO_DIR;
    else if (file.fieldname === 'sport_attachment')  dest = path.join(ATTACHMENT_DIR, 'sport');
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
// Determines which sheet type(s) to lock after form submission.
//
//   sports_person   → revoke sports sheet only
//   cultural_person → revoke cultural sheet only
//   trailblazer     → revoke BOTH (trailblazer uses both sheet types)

const ROLE_TO_SHEET_TYPES = {
  sports_person:   ['sports'],
  cultural_person: ['cultural'],
  trailblazer:     ['sports', 'cultural']
};

const SHEET_MODEL_MAP = {
  cultural: CulturalUserSheet,
  sports:   SportsUserSheet
};

/**
 * Silently revokes student access for all sheets associated with their role.
 * Runs entirely in the background — does not affect the HTTP response.
 *
 * @param {string} studentEmail
 * @param {string} selectedRole  - 'sports_person' | 'cultural_person' | 'trailblazer'
 */
async function triggerSheetRevocation(studentEmail, selectedRole) {
  try {
    const sheetTypes = ROLE_TO_SHEET_TYPES[selectedRole];
    if (!sheetTypes) return; // Unknown role — nothing to revoke

    const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });
    if (!masterUser?.access_token) {
      console.error('[Revoke] Master account missing or has no token. Revocation skipped.');
      return;
    }

    for (const sheetType of sheetTypes) {
      const Model = SHEET_MODEL_MAP[sheetType];
      const sheet = await Model.findOne({ where: { email: studentEmail } });

      if (!sheet) {
        // Student never generated this sheet — nothing to revoke
        continue;
      }

      if (!sheet.student_permission_id) {
        // Already revoked or never stored — skip silently
        console.warn(`[Revoke] No student_permission_id on record for ${studentEmail} (${sheetType}). Skipping.`);
        continue;
      }

      // Fire revoke script in detached background process
      revokeStudentAccess(sheet.user_sheet_id, sheet.student_permission_id, masterUser);

      // Null out the permission_id immediately so duplicate submits don't re-trigger
      await sheet.update({ student_permission_id: null });

      console.log(`[Revoke] Revocation fired for ${studentEmail} — ${sheetType} sheet (${sheet.user_sheet_id})`);
    }
  } catch (err) {
    // Never let revocation errors bubble up to the student's response
    console.error('[Revoke] Background revocation error:', err.message);
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
      if      (selected_role === 'trailblazer')    AwardModel = TrailblazerAward;
      else if (selected_role === 'sports_person')  AwardModel = SportsPersonAward;
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
        submissionData.academic_level      = academicLevel;
        submissionData.cgpa                = cgpa ? parseFloat(cgpa) : null;
        submissionData.sports_score        = sportsScore || null;
        submissionData.cultural_score      = culturalScore || null;
        submissionData.statement_of_purpose = sop;
        submissionData.community_service   = communityService;
      } else if (selected_role === 'sports_person') {
        submissionData.sports_score   = sportsScore || null;
      } else if (selected_role === 'cultural_person') {
        submissionData.cultural_score = culturalScore || null;
      }

      if (req.files['photo']) {
        submissionData.photo = req.files['photo'][0].filename;
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
      // The revocation happens entirely after this — student never waits for it.
      res.status(200).json({
        message: `${selected_role.replace('_', ' ')} submitted successfully`,
        submission_id: submission.id
      });

      // ── 6. Fire invisible sheet revocation ────────────────────────────────
      // setImmediate defers until after the response is flushed.
      // Student sees "submitted" instantly; Drive access is revoked in background.
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