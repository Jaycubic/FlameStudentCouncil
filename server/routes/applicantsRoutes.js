// server/routes/applicantsRoutes.js
const express = require('express');
const router  = express.Router();
const { getApplicants, getApplicantProfile, serveFile } = require('../controllers/applicantsController');
const { validateToken, requireAdmin } = require('../middleware/auth');

// GET /api/applicants?award_type=all&search=&gender=&batch=&sort_field=&sort_dir=asc&page=1&limit=50
router.get('/', validateToken, requireAdmin, getApplicants);

// GET /api/applicants/profile/:awardType/:id
router.get('/profile/:awardType/:id', validateToken, requireAdmin, getApplicantProfile);

// GET /api/applicants/file/:fileType/:fileName  — authenticated file serving
router.get('/file/:fileType/:fileName', validateToken, requireAdmin, serveFile);

module.exports = router;
