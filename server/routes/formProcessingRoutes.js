const express = require('express');
const router = express.Router();
const formProcessingController = require('../controllers/formProcessingController');
const { validateToken } = require('../middleware/auth');

router.get('/prefill', validateToken, formProcessingController.getPrefillData);
router.get('/status', validateToken, formProcessingController.getApplicationStatus);

module.exports = router;
