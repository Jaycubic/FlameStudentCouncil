const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/photoController');
const { validateToken } = require('../middleware/auth');

router.post('/upload', validateToken, ctrl.uploadPhoto);

// PUBLIC: serve images directly so <img src="/photos/..." /> works from the browser
router.get('/:studentId', ctrl.getPhoto);

module.exports = router;
