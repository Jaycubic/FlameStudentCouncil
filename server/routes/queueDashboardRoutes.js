const express = require('express');
const router = express.Router();
const queueDashboardController = require('../controllers/queueDashboardController');
const { validateToken } = require('../middleware/auth');
const path = require('path');

// Serve specific sound file
router.get('/sounds/ding-dong.wav', (req, res) => {
  const filePath = '/opt/View/StudentTrackingSystem/Code/src/services/ding-dong.wav';
  console.log('Serving file from:', filePath);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(500).send('Error serving sound file');
    }
  });
});

router.get('/waiting', validateToken, queueDashboardController.getWaitingQueues);
router.get('/active', validateToken, queueDashboardController.getActiveQueues);
router.get('/active-dashboard', validateToken, queueDashboardController.getActiveQueuesForDashboard);
router.get('/completed', validateToken, queueDashboardController.getCompletedQueues);
router.put('/:id/on', validateToken, queueDashboardController.setQueueOn);
router.put('/:id/off', validateToken, queueDashboardController.setQueueOff);
router.delete('/:id', validateToken, queueDashboardController.deleteQueue);
router.get('/counters', validateToken, queueDashboardController.getDepartmentCounters);
router.put('/:id/move', validateToken, queueDashboardController.moveQueueToCounter);
router.get('/waiting-special', validateToken, queueDashboardController.getWaitingQueuesSpecial);
router.get('/active-special', validateToken, queueDashboardController.getActiveQueuesSpecial);

module.exports = router;
