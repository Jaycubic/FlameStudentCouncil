// server/config/connection.js
require('dotenv').config();

const { Sequelize } = require('sequelize');

const DB_NAME = process.env.DB_NAME || 'FlameAwards';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
    host: DB_HOST,
    port: DB_PORT,
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
        max: 20,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
    dialectOptions: {
        // SSL can be configured here if needed
    },
});

sequelize
    .authenticate()
    .then(() => console.log("✅ Connected to PostgreSQL FlameAwards database via Sequelize"))
    .catch(err => {
        console.error("❌ Error connecting to PostgreSQL FlameAwards database:", err);
    });

module.exports = sequelize;