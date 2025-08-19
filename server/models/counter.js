const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Counter = sequelize.define('Counter', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  CounterName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  DepartmentName: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'departments',
      key: 'departmentName'
    }
  }
}, {
  indexes: [
    {
      unique: true,
      fields: ['CounterName', 'DepartmentName']
    }
  ]
});

module.exports = Counter;
