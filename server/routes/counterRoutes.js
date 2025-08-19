const express = require('express');
const router = express.Router();
const countersController = require('../controllers/countersController');
const { validateToken, requireAdmin } = require('../middleware/auth');

router.get('/', validateToken, countersController.getAllCounters);
router.post('/', validateToken, countersController.createCounter);
router.get('/:id', validateToken, countersController.getCounterById);
router.put('/:id', validateToken, countersController.updateCounter);
router.delete('/:id', validateToken, countersController.deleteCounter);

module.exports = router;
