// server/routes/applicantsRoutes.js
const express = require('express');
const router  = express.Router();
const { getApplicants, getApplicantProfile, updateApplicant, serveFile } = require('../controllers/applicantsController');
const { validateToken, validateTokenFileServe, requireAdmin } = require('../middleware/auth');

// GET  /api/applicants
router.get('/', validateToken, requireAdmin, getApplicants);

// GET  /api/applicants/profile/:awardType/:id
router.get('/profile/:awardType/:id', validateToken, requireAdmin, getApplicantProfile);

// PATCH /api/applicants/profile/:awardType/:id  — inline edit scores
router.patch('/profile/:awardType/:id', validateToken, requireAdmin, updateApplicant);

// GET  /api/applicants/file/:fileType/:fileName  — no fingerprint (browser direct fetch)
router.get('/file/:fileType/:fileName', validateTokenFileServe, requireAdmin, serveFile);

module.exports = router;
