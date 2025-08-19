const express = require('express');
const router = express.Router();
const footerController = require('../controllers/FooterController');

// Get footer content
router.get('/footer', footerController.getFooter);

module.exports = router;
