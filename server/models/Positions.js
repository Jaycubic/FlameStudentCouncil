const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Positions = sequelize.define('Positions', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
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
  tableName: 'Positions',
  timestamps: false,
});

module.exports = Positions;
