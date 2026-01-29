const express = require('express');
const router = express.Router();
const formController = require('../controllers/formSubmissionController');
const { validateToken, requireAdmin } = require('../middleware/auth');

// Main submission endpoint
router.post('/submit', validateToken, formController.uploadMiddleware, formController.submitForm);

// Admin Read (Multi-table)
router.get('/', validateToken, requireAdmin, formController.getAll);

module.exports = router;