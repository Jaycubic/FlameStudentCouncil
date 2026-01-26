const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const RoleSetting = sequelize.define(
  'RoleSetting',
  {
    role_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    setting_key: {
      type: DataTypes.STRING(100),
      primaryKey: true,
    },
    setting_value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: 'role_settings',
    timestamps: false,
  }
);

module.exports = RoleSetting;
