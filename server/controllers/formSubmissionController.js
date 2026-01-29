const {
  TrailblazerAward,
  SportsPersonAward,
  CulturalPersonAward,
  SportAttachment,
  CulturalAttachment,
  academicAttachment,
  StudentData
} = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Storage configuration
const ATTACHMENT_DIR = '/opt/View/StudentTrackingSystem/server/Attachments';
const PHOTO_DIR = '/opt/View/StudentTrackingSystem/server/Photos';

// Ensure directories exist
['photos', 'sport', 'cultural', 'academic'].forEach(sub => {
  const dir = sub === 'photos' ? PHOTO_DIR : path.join(ATTACHMENT_DIR, sub);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dest = ATTACHMENT_DIR;
    if (file.fieldname === 'photo') dest = PHOTO_DIR;
    else if (file.fieldname === 'sport_attachment') dest = path.join(ATTACHMENT_DIR, 'sport');
    else if (file.fieldname === 'cultural_attachment') dest = path.join(ATTACHMENT_DIR, 'cultural');
    else if (file.fieldname === 'academic_attachments') dest = path.join(ATTACHMENT_DIR, 'academic');
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage }).fields([
  { name: 'photo', maxCount: 1 },
  { name: 'sport_attachment', maxCount: 10 },
  { name: 'cultural_attachment', maxCount: 10 },
  { name: 'academic_attachments', maxCount: 10 }
]);

const formController = {
  uploadMiddleware: (req, res, next) => {
    upload(req, res, (err) => {
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

      // Validation: Gender is mandatory as requested
      if (!gender) {
        return res.status(400).json({ message: 'Gender is mandatory.' });
      }

      // 1. Determine which model to use
      let AwardModel;
      if (selected_role === 'trailblazer') AwardModel = TrailblazerAward;
      else if (selected_role === 'sports_person') AwardModel = SportsPersonAward;
      else if (selected_role === 'cultural_person') AwardModel = CulturalPersonAward;
      else return res.status(400).json({ message: 'Invalid award category selected.' });

      // 2. Prepare Data
      const submissionData = {
        name,
        student_id: studentId,
        mobile_number: mobileNumber,
        gender,
        batch,
        email,
        not_on_probation: notOnProbation === 'true' || notOnProbation === true,
        tru_statement: trueStatement === 'true' || trueStatement === true,
        status: 'Submitted'
      };

      // Category specific fields
      if (selected_role === 'trailblazer') {
        submissionData.academic_level = academicLevel;
        submissionData.cgpa = cgpa ? parseFloat(cgpa) : null;
        submissionData.sports_score = sportsScore;
        submissionData.cultural_score = culturalScore;
        submissionData.statement_of_purpose = sop;
        submissionData.community_service = communityService;
      } else if (selected_role === 'sports_person') {
        submissionData.sports_score = sportsScore;
      } else if (selected_role === 'cultural_person') {
        submissionData.cultural_score = culturalScore;
      }

      if (req.files['photo']) {
        submissionData.photo = req.files['photo'][0].filename;
      }

      // 3. Find or Create submission for this student and award type
      let submission = await AwardModel.findOne({ where: { email } });

      if (submission) {
        await submission.update(submissionData);
      } else {
        submission = await AwardModel.create(submissionData);
      }

      // 4. Handle Attachments
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

      return res.status(200).json({ message: `${selected_role.replace('_', ' ')} submitted successfully`, submission_id: submission.id });
    } catch (error) {
      console.error('Submission error:', error);
      return res.status(500).json({ message: 'Error submitting form', error: error.message });
    }
  },

  // Combined getAll for all award types if needed, or separate methods
  async getAll(req, res) {
    try {
      const trailblazers = await TrailblazerAward.findAll();
      const sports = await SportsPersonAward.findAll();
      const cultural = await CulturalPersonAward.findAll();
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
