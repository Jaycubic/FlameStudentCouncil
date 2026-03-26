const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const CulturalAttachments = sequelize.define('CulturalAttachments', {
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
    tableName: 'cultural_attachments',
    schema: 'app',
    timestamps: false,
});

module.exports = CulturalAttachments;
