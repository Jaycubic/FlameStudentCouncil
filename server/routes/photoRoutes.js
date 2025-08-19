const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/photoController');
const { validateToken } = require('../middleware/auth');

router.post('/upload', ctrl.uploadPhoto);
router.get('/:studentId', ctrl.getPhoto);

module.exports = router;