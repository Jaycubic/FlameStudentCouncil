const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const TimeSettings = sequelize.define('TimeSettings', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    start_time: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    end_time: {
        type: DataTypes.TIME,
        allowNull: false,
    },
    time_zone: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Asia/Kolkata'
    },
    days: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 7
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'time_settings',
    timestamps: false,
});

module.exports = TimeSettings;
