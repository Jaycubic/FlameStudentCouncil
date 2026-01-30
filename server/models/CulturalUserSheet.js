// models/CulturalUserSheet.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const CulturalUserSheet = sequelize.define('CulturalUserSheet', {
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
    tableName: 'cultural_user_sheets',
    timestamps: true,
    underscored: true
});

module.exports = CulturalUserSheet;
