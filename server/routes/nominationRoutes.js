// server/routes/nominationRoutes.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { generateNominations, getNominations } = require('../controllers/nominationController');

// GET  /api/nominations          — list all current nominees  (admin only)
router.get('/',          auth.validateToken, auth.requireAdmin, getNominations);

// POST /api/nominations/generate — recalculate & overwrite    (admin only)
router.post('/generate', auth.validateToken, auth.requireAdmin, generateNominations);

module.exports = router;
