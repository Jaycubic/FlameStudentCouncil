// routes/simpleauth.js

const express = require('express');
const router = express.Router();
const simpleAuthController = require('../controllers/simpleAuthController');

// POST /api/simpleauth/verify
router.post('/verify', simpleAuthController.verifyStudent);

module.exports = router;
