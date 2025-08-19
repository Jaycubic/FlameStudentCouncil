// routes/queueCountRoutes.js
const express = require('express');
const router = express.Router();
const queueCountController = require('../controllers/queueCountController');
const { validateToken } = require('../middleware/auth');

router.get(
  '/counts',
  validateToken,
  queueCountController.getQueueCounts
);

router.get(
  '/list',
  validateToken,
  queueCountController.getQueueList
);

router.get(
  '/summary',
  validateToken,
  queueCountController.getSummaryTableData
);

router.get(
  '/reported-summary',
  validateToken,
  queueCountController.getReportedStudentsSummary
);

router.get(
  '/reported-list',
  validateToken,
  queueCountController.getReportedStudentsList
);

module.exports = router;
