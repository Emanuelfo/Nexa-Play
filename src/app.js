require("dotenv").config();
const express = require("express");
const path = require("path");
const sequelize = require("./config/database");
require("./models/Usuario");
require("./models/Mensagem");
const usuarioRoutes = require("./routes/usuarioRoutes");
const authRoutes = require("./routes/authRoutes");
const mensagemRoutes = require("./routes/mensagemRoutes");
const publicacaoRoutes = require("./routes/publicacaoRoutes");
const projetoRoutes = require("./routes/projetoRoutes");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET não definido. Copie .env.example para .env e preencha.");
  process.exit(1);
}

const app = express();
const frontendOrigins = new Set(["https://nexaquest.netlify.app"]);

app.use("/api", (req, res, next) => {
  const origin = req.get("Origin");
  if (origin && frontendOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (req.method === "OPTIONS") res.setHeader("Access-Control-Max-Age", "600");
  }
  res.vary("Origin");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "1mb" }));

// Site (HTML/CSS/JS/imagens)
app.get("/health", (req, res) => res.send("ok"));
app.use(express.static(path.join(__dirname, "..", "public")));

// API
app.use(usuarioRoutes);
app.use(authRoutes);
app.use(mensagemRoutes);
app.use(publicacaoRoutes);
app.use(projetoRoutes);
app.use("/api", (req, res) => {
  res.status(404).json({ mensagem: "Rota da API não encontrada." });
});

const PORT = process.env.PORT || 3000;

sequelize.authenticate()
  .then(() => {
    console.log("Conectado ao banco de dados");
  })
  .then(() => app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`)))
  .catch((err) => {
    console.error("Erro ao conectar ao banco:", err.message);
    process.exit(1);
  });
