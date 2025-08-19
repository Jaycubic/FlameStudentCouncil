const { Sequelize } = require("sequelize");
require("dotenv").config();

const essl = new Sequelize({
  database: process.env.ESSL_DB_NAME,
  username: process.env.ESSL_DB_USER,
  password: process.env.ESSL_DB_PASSWORD,
  host: process.env.ESSL_DB_HOST,
  port: process.env.ESSL_DB_PORT,
  dialect: "mssql",
  dialectModule: require("tedious"),
  dialectOptions: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

module.exports = essl;
