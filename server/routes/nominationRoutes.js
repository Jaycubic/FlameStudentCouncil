// server/routes/nominationRoutes.js
const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const { generateNominations, getNominations, deleteNominee } = require('../controllers/nominationController');

// GET  /api/nominations            — list all current nominees   (admin only)
router.get('/',          auth.validateTokenFileServe, auth.requireAdmin, getNominations);

// POST /api/nominations/generate   — recalculate & overwrite     (admin only)
router.post('/generate', auth.validateTokenFileServe, auth.requireAdmin, generateNominations);

// DELETE /api/nominations/:id      — remove a single nominee     (admin only)
// ← must be after /generate so ':id' doesn't swallow that literal segment
router.delete('/:id',    auth.validateTokenFileServe, auth.requireAdmin, deleteNominee);

module.exports = router;