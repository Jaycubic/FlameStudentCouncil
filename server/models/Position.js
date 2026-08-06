// server/models/Position.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const Position = sequelize.define('Positions', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  schema: 'app',
  tableName: 'Positions',
  timestamps: true,
  underscored: true,
});

module.exports = Position;
