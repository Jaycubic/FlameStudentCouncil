const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const EmailLog = sequelize.define('EmailLog', {
    id: { 
        type: DataTypes.INTEGER, 
        primaryKey: true, 
        autoIncrement: true 
    },
    student_id: { 
        type: DataTypes.STRING(255), 
        allowNull: true 
    },
    email: { 
        type: DataTypes.STRING(255), 
        allowNull: false 
    },
    award_category: { 
        type: DataTypes.STRING(255), 
        allowNull: false 
    },
    status: { 
        type: DataTypes.STRING(50), 
        allowNull: false 
    },
    error_message: { 
        type: DataTypes.TEXT, 
        allowNull: true 
    },
    sent_at: { 
        type: DataTypes.DATE, 
        defaultValue: DataTypes.NOW 
    }
}, {
    tableName: 'email_logs',
    schema: 'app',
    timestamps: false
});

module.exports = EmailLog;
