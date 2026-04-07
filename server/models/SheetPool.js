// models/SheetPool.js
// Tracks pre-generated Drive sheets waiting to be assigned to students.
// One row per sheet. assigned_to is NULL until a student claims it.

'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const SheetPool = sequelize.define('SheetPool', {
    id: {
        type:          DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey:    true,
    },
    type: {
        type:      DataTypes.ENUM('cultural', 'sports', 'academic'),
        allowNull: false,
    },
    sheet_id: {
        type:      DataTypes.STRING(255),
        allowNull: false,
        unique:    true,
        comment:   'Google Drive file ID of the pre-copied sheet',
    },
    assigned_to: {
        type:      DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
        comment:   'Student email that claimed this sheet. NULL = available.',
    },
    assigned_at: {
        type:      DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName:  'sheet_pool',
    schema: 'app',
    timestamps: false,
    indexes: [
        // Fast pool pop: WHERE type = X AND assigned_to IS NULL
        { fields: ['type', 'assigned_to'] },
    ],
});

module.exports = SheetPool;