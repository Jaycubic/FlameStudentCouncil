// server/models/ElectionAttachment.js
//
// Generic attachment table for election form submissions.
// Replaces the old sport/cultural/academic-specific attachment tables.

const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const ElectionAttachment = sequelize.define('ElectionAttachment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    submission_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    file_name: {
        type: DataTypes.STRING(500),
        allowNull: false,
    },
}, {
    tableName: 'election_attachments',
    schema: 'app',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = ElectionAttachment;
