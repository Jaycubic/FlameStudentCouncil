require("dotenv").config();
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME     || "studenttracking",
  process.env.DB_USER     || "root",
  process.env.DB_PASSWORD || "",
  {
    host:    process.env.DB_HOST || "localhost",
    port:    process.env.DB_PORT || 3306,
    dialect: "mysql",
    logging: false,
    pool: {
      max:     10,
      min:     0,
      acquire: 30000,
      idle:    10000,
    },
  }
);

sequelize
  .authenticate()
  .then(() => console.log("✅ Connected to MySQL studenttracking database via Sequelize"))
  .catch(err => {
    console.error("❌ Error connecting to studenttracking MySQL:", err);
    process.exit(1);
  });

module.exports = sequelize;
