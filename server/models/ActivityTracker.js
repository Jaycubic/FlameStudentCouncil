const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const ActivityTracker = sequelize.define('ActivityTracker', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  performed_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  activity_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'activity_tracker',
  updatedAt: false
});

module.exports = ActivityTracker;
