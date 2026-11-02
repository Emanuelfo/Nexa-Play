const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
  pool: { max: 5, min: 0, idle: 10000, acquire: 30000 },
});

module.exports = sequelize;