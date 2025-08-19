const express = require('express');
const router = express.Router();
const studentStatusController = require('../controllers/studentStatusController');
const { validateToken } = require('../middleware/auth');

router.get('/', validateToken, studentStatusController.getStudentStatusData);
router.get('/counts', validateToken, studentStatusController.getStudentStatusCounts);
router.put('/:StudentCvueNo', validateToken, studentStatusController.updateStudentStatus);

module.exports = router;
