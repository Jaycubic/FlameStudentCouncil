const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

class Footer extends Model { }

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
    tableName: 'footer',
    timestamps: false,
  }
);

module.exports = Footer;
