const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const ActivityTracker = require('./ActivityTracker');

const StudentData = sequelize.define(
  "StudentData",
  {
    id: {
      type: DataTypes.INTEGER,
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
    Status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    StudentStatus: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    WithDrawnDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    WithDrawnReason: {
      type: DataTypes.STRING,
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
      type: DataTypes.FLOAT,
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
      type: DataTypes.FLOAT,
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
      type: DataTypes.FLOAT,
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
  },
  {
    tableName: "studentdata",
    timestamps: false,
  }
);

// Hooks for activity tracking
StudentData.afterCreate(async (student, options) => {
  const performedBy = options.performedBy; // Must be provided via options
  if (performedBy) {
    await ActivityTracker.create({
      performedBy,
      activityType: 'student_added',
      details: { studentId: student.id }
    });
  }
});

StudentData.afterDestroy(async (student, options) => {
  const performedBy = options.performedBy;
  if (performedBy) {
    await ActivityTracker.create({
      performedBy,
      activityType: 'student_deleted',
      details: { studentId: student.id }
    });
  }
});

module.exports = StudentData;
