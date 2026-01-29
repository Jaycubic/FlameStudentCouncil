// routes/timeSettingsRoutes.js
const express = require('express');
const router = express.Router();
const timeSettingsController = require('../controllers/timeSettingsController');
const { validateToken, requireAdmin } = require('../middleware/auth');

// Get current settings (Public or Auth)
router.get('/', timeSettingsController.getSettings);

// Update settings (Admin only)
router.post('/', validateToken, requireAdmin, timeSettingsController.updateSettings);

module.exports = router;
