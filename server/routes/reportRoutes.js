const express = require('express');
const router = express.Router();
const { getReportData, updateReportData } = require('../controllers/reportController');

router.get('/data', getReportData);
router.put('/data/:id', updateReportData);

module.exports = router;
