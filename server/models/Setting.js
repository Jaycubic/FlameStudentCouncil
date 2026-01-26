const { DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

const Setting = sequelize.define(
  "Setting",
  {
    setting_key: {
      type: DataTypes.STRING(100),
      primaryKey: true,
    },
    setting_value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: "settings",
    timestamps: false,
  }
);

module.exports = Setting;