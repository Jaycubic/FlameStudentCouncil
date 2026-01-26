const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

class Queue extends Model { }

Queue.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  employee_id: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  employee_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  gender: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  department: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  location_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  counter_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'WAIT',
  },
}, {
  sequelize,
  tableName: 'queue',
});

module.exports = Queue;
