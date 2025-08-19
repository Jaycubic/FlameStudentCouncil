const express = require('express');
const router = express.Router();
const formauthController = require('../controllers/formauthController');
const { validateToken } = require('../middleware/auth');

router.post('/authenticate', formauthController.authenticateStudent);

module.exports = router;
