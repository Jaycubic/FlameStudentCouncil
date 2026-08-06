// server/models/ElectionDraft.js
//
// Autosave table — stores the student's in-progress form draft so they
// can leave and resume later without losing their work.
// Upserted via Socket.IO on every keystroke/debounce.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const ElectionDraft = sequelize.define('ElectionDraft', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    position_selected: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    community_service: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    statement_of_purpose: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'election_drafts',
    schema: 'app',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = ElectionDraft;
