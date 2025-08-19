// routes/wellbeingFormRoutes.js
const express = require('express');
const path    = require('path');
const router  = express.Router();
const ctrl    = require('../controllers/wellbeingFormController');

// Submit, read, update, delete
router.post('/submit', ctrl.submitWellbeingForm);
router.get('/', ctrl.getAllDeclarations);
router.get('/:id', ctrl.getDeclarationById);
router.put('/:id', ctrl.updateDeclaration);
router.delete('/:id', ctrl.deleteDeclaration);

// Serve supportingDocuments statically
const uploadPath = '/opt/View/StudentTrackingSystem/server/formattachments';
router.use(
  '/attachments',
  // e.g. GET /api/wellbeing-form/attachments/12345-file.pdf
  express.static(uploadPath)
);

module.exports = router;
