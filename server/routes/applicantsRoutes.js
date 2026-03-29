// server/routes/applicantsRoutes.js
const express = require('express');
const router  = express.Router();
const { getApplicants } = require('../controllers/applicantsController');
const { validateToken, requireAdmin } = require('../middleware/auth');

// GET /api/applicants?award_type=all&search=&gender=&batch=&sort_field=&sort_dir=asc
router.get('/', validateToken, requireAdmin, getApplicants);

module.exports = router;
