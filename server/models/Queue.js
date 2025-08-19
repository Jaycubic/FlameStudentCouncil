const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Queue extends Model {}

Queue.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  EmployeeId: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  EmployeeName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  Gender: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  Department: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  Email: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  locationName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  CounterId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  DeviceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(10),
    defaultValue: 'WAIT',
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'Queue',
  tableName: 'Queue',
  timestamps: true,
  updatedAt: 'updatedAt',
  createdAt: 'createdAt',
});

module.exports = Queue;
