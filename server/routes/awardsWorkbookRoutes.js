// server/routes/awardsWorkbookRoutes.js
const express = require('express');
const router  = express.Router();
const { openOrCreate, syncFromCloud, syncToCloud } = require('../controllers/awardsWorkbookController');
const { validateToken, requireAdmin } = require('../middleware/auth');

// GET  /api/awards-workbook/open           — open existing or generate new workbook
router.get('/open', validateToken, requireAdmin, openOrCreate);

// POST /api/awards-workbook/sync-from-cloud — pull cloud changes → local DB
router.post('/sync-from-cloud', validateToken, requireAdmin, syncFromCloud);

// POST /api/awards-workbook/sync-to-cloud  — push local data    → cloud sheet
router.post('/sync-to-cloud', validateToken, requireAdmin, syncToCloud);

module.exports = router;
