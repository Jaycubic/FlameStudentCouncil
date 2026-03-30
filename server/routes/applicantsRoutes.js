// server/routes/applicantsRoutes.js
const express = require('express');
const router  = express.Router();
const { getApplicants, getApplicantProfile, updateApplicant, serveFile } = require('../controllers/applicantsController');
const { validateTokenFileServe, requireAdmin } = require('../middleware/auth');

// All applicants routes use validateTokenFileServe (cookie-based JWT, no fingerprint check).
// The x-device-id custom header triggers CORS preflight on fetch requests, which can prevent
// the browser from attaching the accessToken cookie on same-origin API calls.
// Security is maintained: valid JWT required + admin role enforced on every route.

// GET  /api/applicants
router.get('/', validateTokenFileServe, requireAdmin, getApplicants);

// GET  /api/applicants/profile/:awardType/:id
router.get('/profile/:awardType/:id', validateTokenFileServe, requireAdmin, getApplicantProfile);

// PATCH /api/applicants/profile/:awardType/:id  — inline edit scores
router.patch('/profile/:awardType/:id', validateTokenFileServe, requireAdmin, updateApplicant);

// GET  /api/applicants/file/:fileType/:fileName  — no fingerprint (browser direct fetch)
router.get('/file/:fileType/:fileName', validateTokenFileServe, requireAdmin, serveFile);

module.exports = router;
