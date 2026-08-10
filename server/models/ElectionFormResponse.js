// server/models/ElectionFormResponse.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const ElectionFormResponse = sequelize.define('ElectionFormResponse', {
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
    gender: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    batch: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    position_selected: {
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
    more_info: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    read_handbook: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    sports_score: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    academic_score: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
    },
    cultural_score: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    not_on_probation: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
    tru_statement: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
    },
    submission_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Submitted',
    },
    photo: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    sports_director_score: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
    },
    cultural_director_score: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
    },
    sports_verified_score: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    cultural_verified_score: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    academic_verified_score: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    total_verified_score: {
        type: DataTypes.DECIMAL(6, 2),
        allowNull: true,
    },
}, {
    tableName: 'election_form_responses',
    schema: 'app',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = ElectionFormResponse;
