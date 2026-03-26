const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const SportAttachments = sequelize.define('SportAttachments', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    submission_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    file_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    tableName: 'sport_attachments',
    schema: 'app',
    timestamps: false,
});

module.exports = SportAttachments;
