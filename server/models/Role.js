const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
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
    type: DataTypes.JSON,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Hooks for activity tracking
Role.afterCreate(async (role, options) => {
  const performedBy = options.performedBy;
  if (performedBy) {
    await ActivityTracker.create({
      performedBy,
      activityType: 'role_added',
      details: { roleName: role.name }
    });
  }
});

Role.afterDestroy///

(async (role, options) => {
  const performedBy = options.performedBy;
  if (performedBy) {
    await ActivityTracker.create({
      performedBy,
      activityType: 'role_deleted',
      details: { roleName: role.name }
    });
  }
});

module.exports = Role;
