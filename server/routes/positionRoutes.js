// server/routes/positionRoutes.js
const express = require('express');
const router = express.Router();
const positionController = require('../controllers/positionController');
const { validateToken, requireAdmin } = require('../middleware/auth');

// GET all positions (authenticated users)
router.get('/', validateToken, positionController.getAllPositions);

// GET single position by ID
router.get('/:id', validateToken, positionController.getPositionById);

// POST create position (admin only)
router.post('/', validateToken, requireAdmin, positionController.createPosition);

// PUT update position (admin only)
router.put('/:id', validateToken, requireAdmin, positionController.updatePosition);

// DELETE position (admin only)
router.delete('/:id', validateToken, requireAdmin, positionController.deletePosition);

module.exports = router;
