const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');
const bcrypt = require('bcrypt');

const StudentLogs = sequelize.define('StudentLogs', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  department: {
    type: DataTypes.STRING,
    allowNull: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'roles',
      key: 'id'
    }
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  two_fa_secret: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  two_fa_setup: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  verification_token: {
    type: DataTypes.STRING,
    allowNull: true
  },
  token_expires: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'student_logs',
});

// Hash password before creation
StudentLogs.beforeCreate(async (student) => {
  if (student.password) {
    student.password = await bcrypt.hash(student.password, 10);
  }
});

// Hash password before updates when changed
StudentLogs.beforeUpdate(async (student) => {
  if (student.changed('password') && student.password) {
    student.password = await bcrypt.hash(student.password, 10);
  }
});

module.exports = StudentLogs;
