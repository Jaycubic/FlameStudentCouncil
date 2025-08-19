const { DataTypes } = require("sequelize");
const infirmarySequelize = require("../config/infirmary"); // Use the Infirmary Sequelize instance

const EmployeeStudentMaster = infirmarySequelize.define(
  "EmployeeStudentMaster",
  {
    EmployeeId: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    StudentNo: {
      type: DataTypes.TEXT,
      field: "Student No.", // maps the DB column "Student No." to StudentNo in model
      allowNull: true,
    },
    EmployeeName: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    EmployeeCode: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    Batch: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    Gender: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    Designation: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    Status: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    CompanyFName: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    DOB: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    Email: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    EmployeePhoto: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    RCName: {
      type: DataTypes.TEXT,
      field: "RC Name",
      allowNull: true,
    },
    HomeTown: {
      type: DataTypes.TEXT,
      field: "Home Town",
      allowNull: true,
    },
    HousingBlock: {
      type: DataTypes.TEXT,
      field: "Housing Block",
      allowNull: true,
    },
    FatherName: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    FatherEmailID: {
      type: DataTypes.TEXT,
      field: "Father Email ID",
      allowNull: true,
    },
    FatherMobileNo: {
      type: DataTypes.TEXT,
      field: "Father Mobile No.",
      allowNull: true,
    },
    MotherName: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    MotherEmailID: {
      type: DataTypes.TEXT,
      field: "Mother Email ID",
      allowNull: true,
    },
    MotherMobileNo: {
      type: DataTypes.TEXT,
      field: "Mother Mobile No.",
      allowNull: true,
    },
    BLOODGROUP: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "employeestudentmaster", // match the exact table name
    timestamps: false, // no createdAt or updatedAt columns
  }
);

module.exports = EmployeeStudentMaster;
