const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const RoomKey = sequelize.define(
  "RoomKey",
  {
    Id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    StudentId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    StudentName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    RCName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    HousingBlock: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    Issued: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    Returned: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "RoomKey",
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

module.exports = RoomKey;
