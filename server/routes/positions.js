// routes/positions.js
const express = require('express');
const router = express.Router();
const positionController = require('../controllers/positionController');
const { validateToken, requireAdmin } = require('../middleware/auth'); // adjust middleware names/paths if needed

// Create (admin only)
router.post('/', validateToken, requireAdmin, positionController.create);

// Read (authenticated)
router.get('/', validateToken, positionController.getAll);
router.get('/:id', validateToken, positionController.getOne);

// Update & delete (admin only)
router.put('/:id', validateToken, requireAdmin, positionController.update);
router.delete('/:id', validateToken, requireAdmin, positionController.delete);

module.exports = router;
