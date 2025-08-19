const express = require('express');
const router = express.Router();
const queueController = require('../controllers/queueController');
const { validateToken, requireAdmin } = require('../middleware/auth');

// Routes requiring admin privileges
router.put('/:id', validateToken, requireAdmin, queueController.updateQueue);
router.delete('/:id', validateToken, requireAdmin, queueController.deleteQueue);
router.put('/:id/off', validateToken, requireAdmin, queueController.setQueueOff);
router.put('/:id/on', validateToken, requireAdmin, queueController.setQueueOn);

// Routes requiring authentication only
router.get('/', validateToken, queueController.getAllQueues);
router.get('/:id', validateToken, queueController.getQueueById);
router.get('/status/wait', validateToken, queueController.getQueuesByStatusWait);
router.get('/status/on', validateToken, queueController.getQueuesByStatusOn);
router.get('/count/wait', validateToken, queueController.countQueuesByStatusWait);
router.get('/count/on', validateToken, queueController.countQueuesByStatusOn);

module.exports = router;
