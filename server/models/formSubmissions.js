const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FormSubmissions = sequelize.define('FormSubmissions', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  student_id: {
    type: DataTypes.CHAR(6),
    allowNull: false,
  },
  mobile_number: {
    type: DataTypes.STRING(15),
    allowNull: false,
  },
  position: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cgpa: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: false,
  },
  cgpa_verification: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sports_score: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cultural_score: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  community_service: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  statement_of_purpose: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  not_on_probation: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  read_handbook: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  tru_statement: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  submission_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
  },
  ramzi_score: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  farrokh_score: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  Gender: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  Batch: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  Photo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'form_submissions',
  timestamps: false,
});

module.exports = FormSubmissions;