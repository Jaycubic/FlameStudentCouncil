const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Role = require('./Role');

const RoleSetting = sequelize.define(
  'RoleSetting',
  {
    role_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
    },
    setting_key: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    setting_value: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: 'RoleSettings',
    timestamps: false,
  }
);

RoleSetting.belongsTo(Role, { foreignKey: 'role_id' });

module.exports = RoleSetting;
