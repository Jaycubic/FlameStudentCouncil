const { DataTypes } = require("sequelize");
const sequelize = require("../config/connection");
const ActivityTracker = require('./ActivityTracker');

const StudentData = sequelize.define(
  "StudentData",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    rc_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    batch: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    student_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    photo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    student_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    with_drawn_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    with_drawn_reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    with_drawn_comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    gender: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    no_of_days: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    dob: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    email_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    contact_no: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    home_town: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    house: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    housing_block: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    father_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    father_email_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    father_mobile_no: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    mother_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mother_email_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    mother_mobile_no: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    student_cvue_no: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    inout: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    device_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    last_punch_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    device_id: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    reported: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      allowNull: false,
    },
    accompany_with: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "student_data",
    schema: "app",
    timestamps: false,
  }
);

// Hooks for activity tracking
StudentData.afterCreate(async (student, options) => {
  const performedBy = options.performedBy; // Must be provided via options
  if (performedBy) {
    await ActivityTracker.create({
      performedBy,
      activity_type: 'student_added',
      details: { student_id: student.id }
    });
  }
});

StudentData.afterDestroy(async (student, options) => {
  const performedBy = options.performedBy;
  if (performedBy) {
    await ActivityTracker.create({
      performedBy,
      activity_type: 'student_deleted',
      details: { student_id: student.id }
    });
  }
});

module.exports = StudentData;
