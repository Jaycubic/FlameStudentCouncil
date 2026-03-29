// server/models/CulturalPersonAward.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const CulturalPersonAward = sequelize.define('CulturalPersonAward', {
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
    cultural_verified_score: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    tableName: 'cultural_person_awards',
    schema: 'app',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = CulturalPersonAward;
