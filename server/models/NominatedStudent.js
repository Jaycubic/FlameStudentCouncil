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
    rank: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,       // 1 = top pick (potential winner), 2..N = runners-up
    },
    is_top_pick: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
    },
}, {
    tableName: 'nominated_students',
    schema: 'app',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = NominatedStudent;
