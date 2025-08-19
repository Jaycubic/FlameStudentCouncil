const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');
const { validateToken, requireAdmin } = require('../middleware/auth'); // Import validateToken and requireAdmin middlewares

// Add validateToken and requireAdmin middlewares to the /generate route
router.post('/generate', validateToken, requireAdmin, pdfController.triggerPDFGeneration);

module.exports = router;
