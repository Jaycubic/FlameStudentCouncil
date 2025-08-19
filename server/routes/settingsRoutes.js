const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { validateToken, requireAdmin } = require('../middleware/auth');

router.get('/roles/:roleId', validateToken, requireAdmin, settingsController.getSettingsForRole);
router.put('/roles/:roleId/:settingKey', validateToken, requireAdmin, settingsController.updateSettingForRole);
router.get('/roles-with-2fa', validateToken, requireAdmin, settingsController.getAllRolesWith2FA);

module.exports = router;
