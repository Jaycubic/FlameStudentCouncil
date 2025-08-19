const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AcademicAttachments = sequelize.define('AcademicAttachments', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    allowNull: false,
  },
  submission_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'academic_attachments',
  timestamps: false,
});

module.exports = AcademicAttachments;
