// server/models/AwardsWorkbook.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const AwardsWorkbook = sequelize.define('AwardsWorkbook', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    workbook_id: {
        type: DataTypes.STRING(200),
        allowNull: false,
        unique: true,
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
    tableName: 'awards_workbooks',
    timestamps: false,
});

module.exports = AwardsWorkbook;
