// server/models/NominatedStudent.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const NominatedStudent = sequelize.define('NominatedStudent', {
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
    award_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    tableName: 'nominated_students',
    schema: 'app',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = NominatedStudent;
