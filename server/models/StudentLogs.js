// models/StudentLogs.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

const StudentLogs = sequelize.define('StudentLogs', {
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
}, {
  tableName: 'StudentLogs',
  // If you want Sequelize to automatically manage createdAt/updatedAt, you can omit timestamps:false
  // and leave defaults. If you prefer explicit columns in DB, keep defaults (Sequelize manages them).
  timestamps: true
});

// Hash password before creation
StudentLogs.beforeCreate(async (student) => {
  if (student.password) {
    student.password = await bcrypt.hash(student.password, 10);
  }
});

// Hash password before updates when changed
StudentLogs.beforeUpdate(async (student) => {
  if (student.changed('password') && student.password) {
    student.password = await bcrypt.hash(student.password, 10);
  }
});

// Activity hooks (safe: errors logged, not thrown)
StudentLogs.afterCreate(async (student, options) => {
  try {
    const ActivityTracker = require('.').ActivityTracker;
    const performedBy = (options && options.performedBy) || student.id;
    await ActivityTracker.create({
      performedBy,
      activityType: 'studentlog_added',
      details: { studentLogId: student.id, username: student.username }
    });
  } catch (error) {
    console.error('Error in afterCreate hook for StudentLogs:', error);
  }
});

StudentLogs.afterDestroy(async (student, options) => {
  try {
    const ActivityTracker = require('.').ActivityTracker;
    const performedBy = (options && options.performedBy) || student.id;
    if (performedBy !== student.id) { // skip logging if performed by the deleted row itself
      await ActivityTracker.create({
        performedBy,
        activityType: 'studentlog_deleted',
        details: { studentLogId: student.id, username: student.username }
      });
    }
  } catch (error) {
    console.error('Error in afterDestroy hook for StudentLogs:', error);
  }
});

StudentLogs.afterUpdate(async (student, options) => {
  try {
    const ActivityTracker = require('.').ActivityTracker;
    const performedBy = (options && options.performedBy) || student.id;

    // Example: log if roleId changed, or Department changed, or email changed
    const prev = student._previousDataValues || {};
    const changes = [];

    if (prev.roleId !== student.roleId) {
      changes.push({ field: 'roleId', from: prev.roleId, to: student.roleId });
    }
    if (prev.Department !== student.Department) {
      changes.push({ field: 'Department', from: prev.Department, to: student.Department });
    }
    if (prev.email !== student.email) {
      changes.push({ field: 'email', from: prev.email, to: student.email });
    }

    if (changes.length > 0) {
      await ActivityTracker.create({
        performedBy,
        activityType: 'studentlog_updated',
        details: { studentLogId: student.id, changes }
      });
    }
  } catch (error) {
    console.error('Error in afterUpdate hook for StudentLogs:', error);
  }
});

module.exports = StudentLogs;
