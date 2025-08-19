const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ActivityTracker = sequelize.define('ActivityTracker', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  performedBy: {
    type: DataTypes.INTEGER,
    allowNull: true, // Changed to allow NULL
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  activityType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  timestamps: true,
  updatedAt: false
});

module.exports = ActivityTracker;
