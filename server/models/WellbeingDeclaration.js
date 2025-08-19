const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const WellbeingDeclaration = sequelize.define(
  "WellbeingDeclaration",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    studentId: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    fullName: {
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
    psychologicalConcerns_yes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    psychologicalConcerns_no: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    consultedPsychotherapist_yes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    consultedPsychotherapist_no: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    currentTreatment_yes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    currentTreatment_no: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    wantsCounsellingServices_yes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    wantsCounsellingServices_no: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    learningChallenges_yes: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    learningChallenges_no: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    parentName: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    parentContact: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    parentEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    signature: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    studentSignature: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    consentForm: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    supportingDocuments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    submissionId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    submittedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "wellbeing_declarations",
    timestamps: true,
    updatedAt: 'updatedAt',
    createdAt: 'createdAt',
  }
);

module.exports = WellbeingDeclaration;
