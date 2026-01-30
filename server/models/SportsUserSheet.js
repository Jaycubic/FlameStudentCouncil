// models/SportsUserSheet.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const SportsUserSheet = sequelize.define('SportsUserSheet', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    user_sheet_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'sports_user_sheets',
    timestamps: true,
    underscored: true
});

module.exports = SportsUserSheet;
