// controllers/formSubmissionController.js
const { formSubmissions, SportAttachment, CulturalAttachment, academicAttachment, StudentData } = require('../models');
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
  // Middleware-like function to handle file uploads
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
        academicLevel, position, cgpa, sportsScore, culturalScore,
        notOnProbation, trueStatement, sop, communityService,
        selected_role
      } = req.body;

      // 1. Prepare Update Data with correct mapping
      const updateData = {
        name,
        student_id: studentId,
        mobile_number: mobileNumber,
        gender,
        batch,
        position,
        Academic_level: academicLevel,
        statement_of_purpose: sop,
        community_service: communityService,
        not_on_probation: notOnProbation === 'true' || notOnProbation === true,
        tru_statement: trueStatement === 'true' || trueStatement === true,
        status: 'pending'
      };

      // Role specific overrides
      if (selected_role === 'trailblazer') {
        updateData.cgpa = cgpa ? parseFloat(cgpa) : null;
        updateData.sports_score = sportsScore;
        updateData.cultural_score = culturalScore;
      } else if (selected_role === 'sports_person') {
        updateData.sports_score = sportsScore;
      } else if (selected_role === 'cultural_person') {
        updateData.cultural_score = culturalScore;
      }

      if (req.files['photo']) {
        updateData.photo = req.files['photo'][0].filename;
      }

      // 3. Find or Create/Update submission
      let submission = await formSubmissions.findOne({ where: { email } });

      if (submission) {
        await submission.update(updateData);
      } else {
        submission = await formSubmissions.create({ ...updateData, email });
      }

      // 4. Handle Attachments (Clear old if updating? For now we just add more)
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

      return res.status(200).json({ message: 'Form submitted successfully', submission_id: submission.id });
    } catch (error) {
      console.error('Submission error:', error);
      return res.status(500).json({ message: 'Error submitting form', error: error.message });
    }
  },

  async getAll(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      const { count, rows } = await formSubmissions.findAndCountAll({
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });
      return res.json({ data: rows, total: count });
    } catch (err) {
      return res.status(500).json({ message: 'Error fetching submissions', error: err.message });
    }
  },

  async getOne(req, res) {
    try {
      const item = await formSubmissions.findByPk(req.params.id, {
        include: [academicAttachment, SportAttachment, CulturalAttachment]
      });
      if (!item) return res.status(404).json({ message: 'Not found' });
      return res.json(item);
    } catch (err) {
      return res.status(500).json({ message: 'Error fetching submission', error: err.message });
    }
  },

  async create(req, res) {
    try {
      const created = await formSubmissions.create(req.body);
      return res.status(201).json(created);
    } catch (err) {
      return res.status(500).json({ message: 'Error creating submission', error: err.message });
    }
  },

  async bulkCreate(req, res) {
    try {
      const created = await formSubmissions.bulkCreate(req.body);
      return res.status(201).json(created);
    } catch (err) {
      return res.status(500).json({ message: 'Error bulk creating submissions', error: err.message });
    }
  },

  async createImmediate(req, res) {
    try {
      const created = await formSubmissions.create(req.body);
      return res.status(201).json(created);
    } catch (err) {
      return res.status(500).json({ message: 'Error creating submission immediately', error: err.message });
    }
  },

  async update(req, res) {
    try {
      const item = await formSubmissions.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: 'Not found' });
      await item.update(req.body);
      return res.json(item);
    } catch (err) {
      return res.status(500).json({ message: 'Error updating submission', error: err.message });
    }
  },

  async delete(req, res) {
    try {
      const item = await formSubmissions.findByPk(req.params.id);
      if (!item) return res.status(404).json({ message: 'Not found' });
      await item.destroy();
      return res.json({ message: 'Deleted successfully' });
    } catch (err) {
      return res.status(500).json({ message: 'Error deleting submission', error: err.message });
    }
  },

  startQueueWorker() {
    console.log('✅ Form submission queue worker initialized (Immediate processing active)');
  }
};

module.exports = formController;