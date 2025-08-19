// controllers/wellbeingFormController.js
const WellbeingDeclaration = require('../models/WellbeingDeclaration');
const { Queue }            = require('../models');
const jwt                  = require('jsonwebtoken');
const multer               = require('multer');
const path                 = require('path');
const fs                   = require('fs');
require('dotenv').config();

let io;
exports.setIo = (socketIo) => { io = socketIo; };

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = '/opt/View/StudentTrackingSystem/server/formattachments';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|jpg|jpeg|png/;
    const extname   = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype  = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed'));
  },
}).array('supportingDocuments', 5);

// CREATE
exports.submitWellbeingForm = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        const msg = err instanceof multer.MulterError
          ? `File upload error: ${err.message}`
          : err.message;
        return res.status(400).json({ message: msg });
      }

      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'Token is required' });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }

      const formData = req.body;
      const files    = req.files || [];

      // Required fields validation
      for (const f of ['studentId','fullName','email','program','parentName','parentEmail','signature']) {
        if (!formData[f] || !formData[f].trim()) {
          return res.status(400).json({ message: `${f} is required` });
        }
      }

      // Email validations
      if (!/\S+@\S+\.\S+/.test(formData.email)) {
        return res.status(400).json({ message: 'Invalid email format' });
      }
      if (!/\S+@\S+\.\S+/.test(formData.parentEmail)) {
        return res.status(400).json({ message: 'Invalid parent email format' });
      }

      // Generate submissionId & gather filenames
      const submissionId = `WD${Date.now().toString().slice(-6)}`;
      const supportingDocuments = files.map(f => f.filename).join(',');

      // Uppercase the program
      const programUpper = formData.program.trim().toUpperCase();

      // Handle new fields
      const studentSignature = formData.studentSignature || null;
      const consentForm = formData.consentForm === 'true';

      // CREATE the record
      const declaration = await WellbeingDeclaration.create({
        studentId:                    formData.studentId,
        fullName:                     formData.fullName,
        email:                        formData.email,
        program:                      programUpper,
        psychologicalConcerns_yes:    formData.psychologicalConcerns_yes === 'true',
        psychologicalConcerns_no:     formData.psychologicalConcerns_no === 'true',
        consultedPsychotherapist_yes: formData.consultedPsychotherapist_yes === 'true',
        consultedPsychotherapist_no:  formData.consultedPsychotherapist_no === 'true',
        currentTreatment_yes:         formData.currentTreatment_yes === 'true',
        currentTreatment_no:          formData.currentTreatment_no === 'true',
        wantsCounsellingServices_yes: formData.wantsCounsellingServices_yes === 'true',
        wantsCounsellingServices_no:  formData.wantsCounsellingServices_no === 'true',
        learningChallenges_yes:       formData.learningChallenges_yes === 'true',
        learningChallenges_no:        formData.learningChallenges_no === 'true',
        parentName:                   formData.parentName,
        parentContact:                formData.parentContact,
        parentEmail:                  formData.parentEmail,
        signature:                    formData.signature,
        studentSignature:             studentSignature,
        consentForm:                  consentForm,
        supportingDocuments,
        submissionId
      }, { performedBy: formData.studentId });

      // Flip queue OFF if needed
      const queue = await Queue.findOne({
        where: { EmployeeId: formData.studentId, status: 'ON' }
      });
      if (queue) {
        await queue.update({ status: 'OFF', CounterId: null });
        io?.emit('queueUpdate', queue);
      }

      res.status(201).json({
        message: 'Form submitted successfully',
        submissionId
      });
    });
  } catch (error) {
    console.error('Form submission error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// READ ALL
exports.getAllDeclarations = async (req, res) => {
  try {
    const all = await WellbeingDeclaration.findAll({ order: [['submittedAt','DESC']] });
    res.json(all);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not fetch declarations' });
  }
};

// READ ONE
exports.getDeclarationById = async (req, res) => {
  try {
    const one = await WellbeingDeclaration.findByPk(req.params.id);
    if (!one) {
      return res.status(404).json({ message: 'Not found' });
    }
    res.json(one);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching record' });
  }
};

// UPDATE
exports.updateDeclaration = async (req, res) => {
  try {
    const existing = await WellbeingDeclaration.findByPk(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Not found' });
    }

    // If program in body, uppercase it
    if (req.body.program) {
      req.body.program = req.body.program.trim().toUpperCase();
    }

    await existing.update(req.body);
    res.json({ message: 'Updated successfully', updated: existing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not update' });
  }
};

// DELETE
exports.deleteDeclaration = async (req, res) => {
  try {
    const existing = await WellbeingDeclaration.findByPk(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'Not found' });
    }
    await existing.destroy();
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not delete' });
  }
};
