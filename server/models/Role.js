const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');
const ActivityTracker = require('./ActivityTracker');

const Role = sequelize.define('Role', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  permissions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'roles',
});

// Hooks for activity tracking
Role.afterCreate(async (role, options) => {
  const performedBy = options.performedBy;
  if (performedBy) {
    await ActivityTracker.create({
      performed_by: performedBy,
      activity_type: 'role_added',
      details: { role_name: role.name }
    });
  }
});

Role.afterDestroy(async (role, options) => {
  const performedBy = options.performedBy;
  if (performedBy) {
    await ActivityTracker.create({
      performed_by: performedBy,
      activity_type: 'role_deleted',
      details: { role_name: role.name }
    });
  }
});

module.exports = Role;
