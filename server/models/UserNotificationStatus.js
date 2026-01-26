const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const UserNotificationStatus = sequelize.define('UserNotificationStatus', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  activity_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'activity_tracker',
      key: 'id'
    }
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_cleared: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'user_notification_status',
});

module.exports = UserNotificationStatus;
