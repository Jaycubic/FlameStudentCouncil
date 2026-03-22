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
    // Stores the student's Drive permissionId on their sheet.
    // Used by revoke_access.py to remove student access after form submission.
    // Nulled out once revocation is fired to prevent duplicate revocations.
    student_permission_id: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
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
    schema: 'app',
    timestamps: true,
    underscored: true
});

module.exports = CulturalUserSheet;