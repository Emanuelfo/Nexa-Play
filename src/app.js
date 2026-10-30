require("dotenv").config();
const express = require("express");
const path = require("path");
const sequelize = require("./config/database");
require("./models/Usuario");
require("./models/Mensagem");
const usuarioRoutes = require("./routes/usuarioRoutes");
const authRoutes = require("./routes/authRoutes");
const mensagemRoutes = require("./routes/mensagemRoutes");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET não definido. Copie .env.example para .env e preencha.");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "1mb" }));

// Site (HTML/CSS/JS/imagens)
app.use(express.static(path.join(__dirname, "..", "public")));

// API
app.use(usuarioRoutes);
app.use(authRoutes);
app.use(mensagemRoutes);

const PORT = process.env.PORT || 3000;

sequelize.authenticate()
  .then(() => {
    console.log("Conectado ao banco de dados");
    return sequelize.sync(); // cria as tabelas que ainda não existem
  })
  .then(() => app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`)))
  .catch((err) => {
    console.error("Erro ao conectar ao banco:", err.message);
    process.exit(1);
  });
