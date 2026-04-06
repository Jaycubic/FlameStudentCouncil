// server/models/PgDegreeProgressAudit.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/cgpa');

const PgDegreeProgressAudit = sequelize.define('pg_degree_progress_audit', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  student_id: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  student_name: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  scholastic_name: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  email: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  admission_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  gpa: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true,
  },
  total_required_credits: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  remaining_credits_required: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  program_credits_attempted: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  program_credits_earned: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  program_grade_points: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
  program_quality_points: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
  discipline_description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  major: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  minor: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  class_year: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  my_term: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  pe_pathway_id: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  enrollment_status: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  term_name: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  term_credits_attempted: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  term_credits_earned: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  term_credits_enrolled: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  cumulative_credits_attempted: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  cumulative_gpa: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true,
  },
  cumulative_quality_points: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
  term_gpa: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true,
  },
  term_grade_points: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
  quality_points: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
  quality_points_transcript: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
  previous_credits_attempted: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  previous_quality_points: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
  course_connection_id: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  course_offering_id: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  course_code: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  course_title: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  section_id: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  ignore_credits_earned: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  ignore_gpa_calc: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  course_credits_attempted: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  course_credits_earned: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  credits_offered: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  grade: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  retake: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  grade_points_course: {
    type: DataTypes.DECIMAL(4, 2),
    allowNull: true,
  },
  grade_result: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  pe_group_name: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  plan_requirement_name: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  discipline_req_shortname: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  parent_pe_discipline_req_name: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  degree_awarded: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  degree: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  manual_override: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  parent_text: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  schema: 'app',
  tableName: 'pg_degree_progress_audit',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['student_id'] },
    { fields: ['student_name'] },
    { fields: ['email'] },
    { fields: ['term_name'] },
    { fields: ['course_code'] },
    { fields: ['course_title'] },
    { fields: ['enrollment_status'] },
    { fields: ['student_id', 'term_name'] },
  ],
});

module.exports = PgDegreeProgressAudit;
