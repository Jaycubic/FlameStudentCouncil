// routes/sheetRoutes.js
const express = require('express');
const router = express.Router();
const sheetController = require('../controllers/sheetController');
const { validateToken } = require('../middleware/auth');

// Route: GET /api/sheets/:type (cultural/sports)
router.get('/:type', validateToken, sheetController.getSheet);

// Route: POST /api/sheets/update-template/:type (Admin Only - simplified to validateToken for now, ideally requireAdmin)
router.post('/update-template/:type', validateToken, sheetController.updateTemplate);

module.exports = router;
