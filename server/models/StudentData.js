// models/StudentData.js
// Directly connected to MySQL studenttracking database via config/database.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StudentData = sequelize.define(
  "StudentData",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    RCName: {
      type: DataTypes.STRING,
      field: "RC Name",
      allowNull: true,
    },
    Batch: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    StudentName: {
      type: DataTypes.STRING,
      field: "Student Name",
      allowNull: true,
    },
    Photo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Validity: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    BloodGroup: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    StudentStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    WithDrawnDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    WithDrawnReason: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    WithDrawnComment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    Gender: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    NoOfDays: {
      type: DataTypes.FLOAT,
      field: "No.of Days",
      allowNull: true,
    },
    DOB: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    EmailID: {
      type: DataTypes.STRING,
      field: "Email ID",
      allowNull: true,
    },
    ContactNo: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    HomeTown: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    House: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    HousingBlock: {
      type: DataTypes.STRING,
      field: "Housing Block",
      allowNull: true,
    },
    HouseCategory: {
      type: DataTypes.STRING,
      field: "House Category",
      allowNull: true,
    },
    FatherName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    FatherEmailID: {
      type: DataTypes.STRING,
      field: "Father Email ID",
      allowNull: true,
    },
    FatherMobileNo: {
      type: DataTypes.STRING(20),
      field: "Father Mobile No.",
      allowNull: true,
    },
    MotherName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    MotherEmailID: {
      type: DataTypes.STRING,
      field: "Mother Email ID",
      allowNull: true,
    },
    MotherMobileNo: {
      type: DataTypes.STRING(20),
      field: "Mother Mobile No.",
      allowNull: true,
    },
    StudentCvueNo: {
      type: DataTypes.INTEGER,
      field: "Student Cvue No.",
      allowNull: true,
    },
    INOUT: {
      type: DataTypes.STRING,
      field: "IN-OUT",
      allowNull: true,
    },
    DeviceName: {
      type: DataTypes.STRING,
      field: "Device Name",
      allowNull: true,
    },
    LastPunchDate: {
      type: DataTypes.DATE,
      field: "Last Punch Date",
      allowNull: true,
    },
    DeviceId: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    Reported: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false,
    },
    AccompanyWith: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    Photo_Uploaded_At: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    IdCardGeneratedStatus: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false,
    },
    IdCardGenerated_At: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    Nationality: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    IsInternational: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: true,
    },

    // ── Virtual fields for backwards compatibility with snake_case code ──────
    email_id: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('EmailID'); },
      set(val) { this.setDataValue('EmailID', val); }
    },
    student_cvue_no: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('StudentCvueNo'); },
      set(val) { this.setDataValue('StudentCvueNo', val); }
    },
    student_name: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('StudentName'); },
      set(val) { this.setDataValue('StudentName', val); }
    },
    batch: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('Batch'); },
      set(val) { this.setDataValue('Batch', val); }
    },
    contact_no: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('ContactNo'); },
      set(val) { this.setDataValue('ContactNo', val); }
    },
  },
  {
    tableName: "studentdata",
    timestamps: false,
  }
);

module.exports = StudentData;
