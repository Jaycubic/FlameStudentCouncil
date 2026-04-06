// server/models/StudentCgpaCache.js
// Pre-fetched CGPA cache — lives in the main FlameAwards DB (config/connection)
// Sourced on demand from academicplanning DB (DegreeProgressAudit / PgDegreeProgressAudit)

const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');   // main FlameAwards DB

const StudentCgpaCache = sequelize.define('student_cgpa_cache', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  student_id: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  // The latest cumulative GPA found (null = no GPA data available in audit DB)
  cgpa: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true,
  },
  // The my_term from which this cgpa was extracted
  my_term: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  // class_year / batch at time of fetch
  batch: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // 'UG' for DegreeProgressAudit, 'PG' for PgDegreeProgressAudit
  program_type: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // Timestamp of last successful CGPA fetch from the audit DB
  fetched_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
}, {
  schema: 'app',
  tableName: 'student_cgpa_cache',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['student_id'], unique: true },
    { fields: ['email'] },
    { fields: ['batch'] },
  ],
});

module.exports = StudentCgpaCache;
