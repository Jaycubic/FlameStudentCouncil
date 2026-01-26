const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const Counter = sequelize.define('Counter', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  counter_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  department_name: {
    type: DataTypes.STRING,
    allowNull: false,
    references: {
      model: 'departments',
      key: 'department_name'
    }
  }
}, {
  tableName: 'counters',
  indexes: [
    {
      unique: true,
      fields: ['counter_name', 'department_name']
    }
  ]
});

module.exports = Counter;
