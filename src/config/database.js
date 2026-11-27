const { Sequelize } = require("sequelize");
require("dotenv").config();

const databaseCa = process.env.DATABASE_SSL_CA?.replace(/\\n/g, "\n");
const databaseSsl = {
  require: true,
  rejectUnauthorized: Boolean(databaseCa),
  ...(databaseCa ? { ca: databaseCa } : {}),
};

// Sem a CA, a conexão continua criptografada, mas o certificado do servidor NÃO é verificado (risco de MITM).
// Com a CA, rejectUnauthorized fica ativo. Nunca force rejectUnauthorized: false como solução permanente.
if (databaseCa && !/-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(databaseCa)) {
  console.error(JSON.stringify({
    event: "database_ssl_ca_invalid_format",
    remediation: "DATABASE_SSL_CA deve conter o certificado PEM completo (BEGIN/END CERTIFICATE); use \\n no lugar das quebras de linha.",
  }));
}

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