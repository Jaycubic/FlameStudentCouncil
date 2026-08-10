// config/database.js
require("dotenv").config();
const { Sequelize } = require("sequelize");

const logger = require("../utils/logger");

const schemaName = process.env.DBPB_SCHEMA || "app";

const sequelize = new Sequelize(
  process.env.DBPB_NAME || process.env.DB_NAME || "infirmary",
  process.env.DBPB_USER || process.env.DB_USER || "jofrey",
  process.env.DBPB_PASSWORD || process.env.DB_PASSWORD || "2025",
  {
    host: process.env.DBPB_HOST || process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DBPB_PORT || process.env.DB_PORT || "5432", 10),
    dialect: "postgres",
    schema: schemaName,
    searchPath: schemaName,
    dialectOptions: {
      prependSearchPath: true,
    },
    define: {
      schema: schemaName,
      schemaDelimiter: ".",
    },
    logging: (msg, options) => {
      const context = options?.loggingContext ? `[Context: ${options.loggingContext}] ` : "";
      logger.info(`${context}${msg}`);
    }, // Improved logging with context
    pool: {
      max: 20,
      min: 5,
      acquire: 20000,
      idle: 5000,
    },
  }
);

sequelize
  .authenticate()
  .then(() => logger.info(`✅ Connected to PostgreSQL database (${process.env.DBPB_NAME || "infirmary"}, schema: ${schemaName}) via Sequelize`))
  .catch(err => {
    logger.error("❌ Error connecting to PostgreSQL:", err);
    process.exit(1);
  });

module.exports = sequelize;
