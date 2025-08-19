const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Footer extends Model {}

Footer.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    signature: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Footer',
    tableName: 'footer',
    timestamps: false, // Corrected placement
  }
);

module.exports = Footer;
