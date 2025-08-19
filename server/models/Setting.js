const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Setting = sequelize.define(
  "Setting",
  {
    setting_key: {
      type: DataTypes.STRING(50),
      primaryKey: true,
    },
    setting_value: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
  },
  {
    tableName: "settings",
    timestamps: false,
  }
);

module.exports = Setting;