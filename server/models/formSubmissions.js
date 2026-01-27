const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const FormSubmissions = sequelize.define('FormSubmissions', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  student_id: {
    type: DataTypes.CHAR(10),
    allowNull: false,
  },
  mobile_number: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  position: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  Academic_level: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cgpa: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true,
  },
  cgpa_verification: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  sports_score: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cultural_score: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  community_service: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  statement_of_purpose: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  not_on_probation: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  read_handbook: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
  },
  tru_statement: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
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
    type: DataTypes.STRING(50),
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
  gender: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  batch: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  photo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'form_submissions',
});

module.exports = FormSubmissions;