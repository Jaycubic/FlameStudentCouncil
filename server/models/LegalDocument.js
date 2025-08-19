const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class LegalDocument extends Model {}

LegalDocument.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notNull: { msg: 'Document type is required' },
      notEmpty: { msg: 'Document type cannot be empty' },
    },
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notNull: { msg: 'Content is required' },
      notEmpty: { msg: 'Content cannot be empty' },
    },
  },
}, {
  sequelize,
  modelName: 'LegalDocument',
  tableName: 'legal_documents',
  timestamps: true,
});

module.exports = LegalDocument;
