// server/config/cgpa.js
require('dotenv').config(); // make sure you have dotenv installed if you use a .env file

const { Sequelize } = require('sequelize');

const DB_NAME = process.env.DBPA_NAME || 'academicplanning';
const DB_USER = process.env.DBPA_USER || 'postgres';
const DB_PASSWORD = process.env.DBPA_PASSWORD || '';
const DB_HOST = process.env.DBPA_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DBPA_PORT || '5432', 10);

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: {
    // If you need SSL you can enable it here based on env
    // ssl: process.env.DB_SSL === 'true'
  },
});

module.exports = sequelize;