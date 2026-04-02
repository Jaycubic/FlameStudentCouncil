// server/routes/emailRoutes.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { sendNotifications } = require('../controllers/emailController');

// POST /api/email/send-notifications  — admin only
router.post('/send-notifications', auth.validateTokenFileServe, auth.requireAdmin, sendNotifications);

module.exports = router;
