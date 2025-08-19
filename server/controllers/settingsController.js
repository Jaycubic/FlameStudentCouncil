const { RoleSetting, Role } = require('../models');

const settingsController = {
  async getSettingsForRole(req, res) {
    try {
      const { roleId } = req.params;
      const settings = await RoleSetting.findAll({
        where: { role_id: roleId }
      });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching settings', error: error.message });
    }
  },

  async updateSettingForRole(req, res) {
    try {
      const { roleId, settingKey } = req.params;
      const { settingValue } = req.body;
      const [setting, created] = await RoleSetting.upsert({
        role_id: roleId,
        setting_key: settingKey,
        setting_value: settingValue
      });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: 'Error updating setting', error: error.message });
    }
  },

  async getAllRolesWith2FA(req, res) {
    try {
      const roles = await Role.findAll();
      const roleSettings = await RoleSetting.findAll({
        where: { setting_key: '2fa_enabled' }
      });
      const role2FA = roleSettings.reduce((acc, setting) => {
        acc[setting.role_id] = setting.setting_value === 'true';
        return acc;
      }, {});
      const rolesWith2FA = roles.map(role => ({
        ...role.toJSON(),
        twoFAEnabled: role2FA[role.id] || false
      }));
      res.json(rolesWith2FA);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching roles with 2FA', error: error.message });
    }
  }
};

module.exports = settingsController;
