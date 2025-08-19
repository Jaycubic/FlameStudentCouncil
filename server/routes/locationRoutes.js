const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationController');
const { validateToken } = require('../middleware/auth');

router.get('/', validateToken, locationController.getAllLocations);
router.post('/', validateToken, locationController.createLocation);
router.get('/:id', validateToken, locationController.getLocationById);
router.put('/:id', validateToken, locationController.updateLocation);
router.delete('/:id', validateToken, locationController.deleteLocation);

module.exports = router;
