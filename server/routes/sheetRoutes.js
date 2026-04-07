// routes/sheetRoutes.js
const express = require('express');
const router = express.Router();
const sheetController = require('../controllers/sheetController');
const { validateToken } = require('../middleware/auth');

// Route: GET /api/sheets/:type (cultural/sports)
router.get('/job/:jobId', validateToken, sheetController.checkJobStatus);
router.get('/:type', validateToken, sheetController.getSheet);
router.get('/pool-status', validateToken, sheetController.getPoolStatus);
// Route: POST /api/sheets/update-template/:type (Admin Only - simplified to validateToken for now, ideally requireAdmin)
router.post('/update-template/:type', validateToken, sheetController.updateTemplate);

module.exports = router;
