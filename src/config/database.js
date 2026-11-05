const { Sequelize } = require("sequelize");
require("dotenv").config();

const databaseCa = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
const databaseSsl = {
  require: true,
  rejectUnauthorized: Boolean(databaseCa),
  ...(databaseCa ? { ca: databaseCa } : {}),
};

if (process.env.NODE_ENV === "production" && !databaseCa) {
  console.warn(JSON.stringify({
    event: "database_tls_verification_disabled",
    remediation: "Configure DATABASE_SSL_CA with the Supabase root CA certificate.",
  }));
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: databaseSsl,
    statement_timeout: 15000,
  },
  pool: { max: 5, min: 0, idle: 10000, acquire: 30000 },
});

module.exports = sequelize;