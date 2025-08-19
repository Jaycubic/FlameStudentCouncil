const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');
const { validateToken } = require('../middleware/auth');

router.get('/', validateToken, organizationController.getAllOrganizations);
router.post('/', validateToken, organizationController.createOrganization);
router.get('/:id', validateToken, organizationController.getOrganizationById);
router.put('/:id', validateToken, organizationController.updateOrganization);
router.delete('/:id', validateToken, organizationController.deleteOrganization);

module.exports = router;
