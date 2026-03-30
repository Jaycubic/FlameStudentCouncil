// server/routes/awardsWorkbookRoutes.js
const express = require('express');
const router  = express.Router();
const { openOrCreate, syncFromCloud, syncToCloud } = require('../controllers/awardsWorkbookController');
const { validateTokenFileServe, requireAdmin } = require('../middleware/auth');

// All workbook routes: use validateTokenFileServe (no fingerprint check).
// These are admin-only long-running operations — cookie-based JWT + role check
// is sufficient. Using validateToken would fail for CORS preflights that cannot
// relay the x-device-id custom header with the same-request credentials.

// GET  /api/awards-workbook/open           — open existing or generate new workbook
router.get('/open', validateTokenFileServe, requireAdmin, openOrCreate);

// POST /api/awards-workbook/sync-from-cloud — pull cloud changes → local DB
router.post('/sync-from-cloud', validateTokenFileServe, requireAdmin, syncFromCloud);

// POST /api/awards-workbook/sync-to-cloud  — push local data → cloud sheet
router.post('/sync-to-cloud', validateTokenFileServe, requireAdmin, syncToCloud);

module.exports = router;
