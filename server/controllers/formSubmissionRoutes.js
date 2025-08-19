const express = require('express');
const router = express.Router();
const formController = require('../controllers/formSubmissionController');
const { validateToken, requireAdmin } = require('../middleware/auth'); // adjust middleware names/paths

// Public create endpoint? If you want submissions from unauthenticated clients, remove validateToken.
router.post('/', validateToken, formController.create);

// Bulk enqueue
router.post('/bulk', validateToken, formController.bulkCreate);

// Immediate create (admin use)
router.post('/immediate', validateToken, requireAdmin, formController.createImmediate);

// Read
router.get('/', validateToken, formController.getAll);
router.get('/:id', validateToken, formController.getOne);

// Update & delete
router.put('/:id', validateToken, requireAdmin, formController.update);
router.delete('/:id', validateToken, requireAdmin, formController.delete);

module.exports = router;