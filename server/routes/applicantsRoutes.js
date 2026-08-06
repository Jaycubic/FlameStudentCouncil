// server/routes/applicantsRoutes.js
const express = require('express');
const router  = express.Router();
const { getApplicants, getApplicantProfile, updateApplicant, serveFile } = require('../controllers/applicantsController');
const { validateTokenFileServe, requireAdmin } = require('../middleware/auth');

// All applicants routes use validateTokenFileServe (cookie-based JWT, no fingerprint check).

// GET  /api/applicants
router.get('/', validateTokenFileServe, requireAdmin, getApplicants);

// GET  /api/applicants/profile/:id  (simplified — single model, no awardType param)
router.get('/profile/:id', validateTokenFileServe, requireAdmin, getApplicantProfile);

// PATCH /api/applicants/profile/:id  — inline edit scores
router.patch('/profile/:id', validateTokenFileServe, requireAdmin, updateApplicant);

// GET  /api/applicants/file/:fileType/:fileName  — no fingerprint (browser direct fetch)
router.get('/file/:fileType/:fileName', validateTokenFileServe, requireAdmin, serveFile);

module.exports = router;
