// server/config/connection.js
require('dotenv').config();

const { Sequelize } = require('sequelize');

const DBP_NAME = process.env.DBP_NAME || 'studentcouncil';
const DBP_USER = process.env.DBP_USER || 'jofrey';
const DBP_PASSWORD = process.env.DBP_PASSWORD || '2025';
const DBP_HOST = process.env.DBP_HOST || '127.0.0.1';
const DBP_PORT = parseInt(process.env.DBP_PORT || '5432', 10);

const sequelize = new Sequelize(DBP_NAME, DBP_USER, DBP_PASSWORD, {
    host: DBP_HOST,
    port: DBP_PORT,
    dialect: 'postgres',
    logging: false,
    define: {
        schema: 'app',
        underscored: true, // Automatically handle snake_case
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    },
    pool: {
        max: 50,
        min: 0,
        acquire: 60000,
        idle: 10000,
    },
    dialectOptions: {
        // SSL can be configured here if needed
    },
});

sequelize
    .authenticate()
    .then(() => console.log("✅ Connected to PostgreSQL studentcouncil database via Sequelize"))
    .catch(err => {
        console.error("❌ Error connecting to PostgreSQL studentcouncil database:", err);
    });

module.exports = sequelize;