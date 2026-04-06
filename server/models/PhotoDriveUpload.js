// models/PhotoDriveUpload.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

/**
 * Tracks which student photos have been uploaded to the master Google Drive
 * folder (FLAMEAwards2026Photos). The drive_file_id is used at sheet-generation
 * time to insert =IMAGE(...) formula into cell B2 without re-uploading.
 */
const PhotoDriveUpload = sequelize.define('PhotoDriveUpload', {
    student_id: {
        type: DataTypes.STRING,
        primaryKey: true,   // one row per student, upsert-safe
        allowNull: false
    },
    drive_file_id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    hosted_by: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'master'  // 'master' | 'student'
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
    tableName: 'photo_drive_uploads',
    schema: 'app',
    timestamps: true,
    underscored: true
});

module.exports = PhotoDriveUpload;
