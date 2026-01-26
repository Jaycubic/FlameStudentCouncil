const { DataTypes } = require("sequelize");
const sequelize = require("../config/connection");

const WellbeingDeclaration = sequelize.define(
  "WellbeingDeclaration",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    student_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    full_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    program: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    psychological_concerns_yes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    psychological_concerns_no: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    consulted_psychotherapist_yes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    consulted_psychotherapist_no: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    current_treatment_yes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    current_treatment_no: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    wants_counselling_services_yes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    wants_counselling_services_no: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    learning_challenges_yes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    learning_challenges_no: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    parent_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    parent_contact: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    parent_email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    signature: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    student_signature: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    consent_form: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    supporting_documents: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    submission_id: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    submitted_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "wellbeing_declarations",
  }
);

module.exports = WellbeingDeclaration;
