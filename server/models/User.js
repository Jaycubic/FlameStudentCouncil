const { DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

const User = sequelize.define('users', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  username: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  employee_name: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  user_type: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  email: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true,
  },
  department: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  password: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  access_token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  refresh_token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  two_fa_secret: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  two_fa_setup: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  verification_token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  token_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'users',
  indexes: [
    {
      name: 'idx_users_role_id',
      fields: ['role_id'],
    },
  ],
});

module.exports = User;