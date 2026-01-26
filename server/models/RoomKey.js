const { DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

const RoomKey = sequelize.define(
  "RoomKey",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    student_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    student_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    rc_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    housing_block: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    issued: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    returned: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "room_keys",
  }
);

module.exports = RoomKey;
