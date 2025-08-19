// models/User.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  UserID: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  Department: {
    type: DataTypes.STRING,
    allowNull: true
  },
  CounterId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Counters',
      key: 'id'
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  roleId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Roles',
      key: 'id'
    }
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  two_fa_secret: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  two_fa_setup: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verificationToken: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tokenExpires: {
    type: DataTypes.DATE,
    allowNull: true
  }
});

// Hash password before saving (creation)
User.beforeCreate(async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

// Hash password before saving (updates)
User.beforeUpdate(async (user) => {
  if (user.changed('password') && user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});

// Hooks for activity tracking with error logging
User.afterCreate(async (user, options) => {
  try {
    const ActivityTracker = require('.').ActivityTracker; // Import here
    const performedBy = options.performedBy || user.id;
    await ActivityTracker.create({
      performedBy,
      activityType: 'user_added',
      details: { userId: user.id, username: user.username }
    });
  } catch (error) {
    console.error('Error in afterCreate hook for User:', error);
  }
});

User.afterDestroy(async (user, options) => {
  try {
    const ActivityTracker = require('.').ActivityTracker; // Import here
    const performedBy = options.performedBy || user.id;
    if (performedBy !== user.id) { // Skip logging if performedBy is the deleted user
      await ActivityTracker.create({
        performedBy,
        activityType: 'user_deleted',
        details: { userId: user.id, username: user.username }
      });
    }
  } catch (error) {
    console.error('Error in afterDestroy hook for User:', error);
  }
});

User.afterUpdate(async (user, options) => {
  try {
    const ActivityTracker = require('.').ActivityTracker; // Import here
    const performedBy = options.performedBy || user.id;
    if (user._previousDataValues.CounterId !== user.CounterId) {
      await ActivityTracker.create({
        performedBy,
        activityType: 'user_counterid_updated',
        details: { userId: user.id, oldCounterId: user._previousDataValues.CounterId, newCounterId: user.CounterId }
      });
    }
  } catch (error) {
    console.error('Error in afterUpdate hook for User:', error);
  }
});

module.exports = User;
