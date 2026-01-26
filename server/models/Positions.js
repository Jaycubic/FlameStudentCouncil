const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const Positions = sequelize.define('Positions', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  max_score: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  tableName: 'positions',
  timestamps: false,
});

module.exports = Positions;
