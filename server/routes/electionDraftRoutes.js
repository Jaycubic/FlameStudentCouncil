const express = require('express');
const router = express.Router();
const electionDraftController = require('../controllers/electionDraftController');
const { validateToken } = require('../middleware/auth');

// Autosave draft — used by frontend for debounced saves
router.post('/', validateToken, electionDraftController.saveDraft);
router.get('/',  validateToken, electionDraftController.getDraft);

module.exports = router;
