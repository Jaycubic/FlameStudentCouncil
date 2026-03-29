// server/routes/dashboardRoutes.js
const express = require('express');
const router  = express.Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { validateToken, requireAdmin } = require('../middleware/auth');

// GET /api/dashboard/stats — returns award applicant counts + charts data
router.get('/stats', validateToken, requireAdmin, getDashboardStats);

module.exports = router;
