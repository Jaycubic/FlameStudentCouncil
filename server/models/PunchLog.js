const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class PunchLog extends Model {}

PunchLog.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  EmployeeCode: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  PunchTime: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isWithinLastMinute(value) {
        const nowMs = Date.now();
        const punchMs = new Date(value).getTime();
        if (isNaN(punchMs)) {
          throw new Error('PunchTime is not a valid date');
        }
        if (punchMs < nowMs - 60 * 1000) {
          throw new Error('PunchTime is older than 1 minute — insertion rejected');
        }
      }
    }
  },
  DeviceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  CreatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'PunchLog',
  tableName: 'PunchLog',
  timestamps: false,
  hooks: {
    beforeCreate(instance) {
      // Double-check one more time in a hook
      const nowMs = Date.now();
      const punchMs = new Date(instance.PunchTime).getTime();
      if (punchMs < nowMs - 60 * 1000) {
        throw new Error('PunchLog creation blocked: PunchTime is older than 1 minute');
      }
    }
  }
});

module.exports = PunchLog;
