const express = require('express');
const router = express.Router();
const activityTrackerController = require('../controllers/ActivityTrackerController');
const { validateToken } = require('../middleware/auth');

router.get('/', validateToken, activityTrackerController.getNotifications);
router.put('/mark-read/:activityId', validateToken, activityTrackerController.markNotificationAsRead);
router.put('/clear/:activityId', validateToken, activityTrackerController.clearNotification);
router.put('/mark-read', validateToken, activityTrackerController.markNotificationsAsRead);
router.put('/clear', validateToken, activityTrackerController.clearNotifications);

module.exports = router;
