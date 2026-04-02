// server/routes/nominationRoutes.js
const express = require('express');
const router  = express.Router();
const { validateToken, requireAdmin } = require('../middleware/authMiddleware');
const { generateNominations, getNominations } = require('../controllers/nominationController');

// GET  /api/nominations          — list all current nominees  (admin only)
router.get('/',        validateToken, requireAdmin, getNominations);

// POST /api/nominations/generate — recalculate & overwrite    (admin only)
router.post('/generate', validateToken, requireAdmin, generateNominations);

module.exports = router;
