const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/photoController');
const { validateToken } = require('../middleware/auth2');

router.post('/upload', validateToken, ctrl.uploadPhoto);
router.post('/delete', validateToken, ctrl.deletePhoto);
router.post('/edit', validateToken, ctrl.editPhoto);

module.exports = router;
