require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("node:crypto");
const helmet = require("helmet");
const sequelize = require("./config/database");
const { createRateLimiter, initializeRateLimitStore, cleanExpiredBuckets } = require("./middlewares/rateLimit");
require("./models/Usuario");
require("./models/Mensagem");
const usuarioRoutes = require("./routes/usuarioRoutes");
const authRoutes = require("./routes/authRoutes");
const mensagemRoutes = require("./routes/mensagemRoutes");
const publicacaoRoutes = require("./routes/publicacaoRoutes");
const projetoRoutes = require("./routes/projetoRoutes");

if (Buffer.byteLength(process.env.JWT_SECRET || "", "utf8") < 32) {
  console.error("JWT_SECRET ausente ou fraco. Configure um segredo aleatório com pelo menos 32 bytes.");
  process.exit(1);
}

const session = require("./services/session");
const app = express();
const frontendOrigins = new Set([
  "https://nexaquest-kappa.vercel.app",
  "https://nexa-play.onrender.com",
  ...((process.env.CORS_ORIGINS || "").split(",").map(origin => origin.trim()).filter(Boolean)),
]);
const apiRateLimit = createRateLimiter({
  scope: "api-ip",
  windowMs: 60 * 1000,
  maxIp: 1200,
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://accounts.google.com/gsi/client"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://accounts.google.com/gsi/style"],
      imgSrc: ["'self'", "https:", "data:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'", "https://nexa-play.onrender.com", "https://accounts.google.com/gsi/"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com", "https://accounts.google.com/gsi/"],
      mediaSrc: ["'self'", "https:", "blob:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  // O popup do Google Identity Services precisa conversar com a página que o abriu
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  strictTransportSecurity: process.env.NODE_ENV === "production" ? undefined : false,
}));

app.use("/api", (req, res, next) => {
  const origin = req.get("Origin");
  res.vary("Origin");
  res.setHeader("Cache-Control", "private, no-store");
  if (origin && !frontendOrigins.has(origin) && origin !== `${req.protocol}://${req.get("host")}`) {
    return res.status(403).json({ mensagem: "Esta origem não tem permissão para acessar a API." });
  }
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Nexa-Request");
    res.setHeader("Access-Control-Expose-Headers", "Retry-After, X-Request-Id");
    if (req.method === "OPTIONS") res.setHeader("Access-Control-Max-Age", "600");
  }

  if (req.method === "OPTIONS") {
    const method = req.get("Access-Control-Request-Method");
    const headers = (req.get("Access-Control-Request-Headers") || "")
      .split(",").map(header => header.trim().toLowerCase()).filter(Boolean);
    const allowedMethods = new Set(["GET", "POST", "PUT", "DELETE"]);
    const allowedHeaders = new Set(["authorization", "content-type", "x-nexa-request"]);
    if ((method && !allowedMethods.has(method))
      || headers.some(header => !allowedHeaders.has(header))) {
      return res.status(403).json({ mensagem: "Método ou cabeçalho CORS não permitido." });
    }
    return res.sendStatus(204);
  }
  const bearerRequest = /^Bearer [A-Za-z0-9._~-]+$/i.test(req.get("Authorization") || "");
  if (!["GET", "HEAD"].includes(req.method) && req.get("X-Nexa-Request") !== "1" && !bearerRequest) {
    return res.status(403).json({ mensagem: "Cabeçalho de proteção da requisição ausente." });
  }
  return next();
});

app.use("/api", apiRateLimit);
app.use("/api", express.json({ limit: "64kb", strict: true }));

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
app.use((erro, req, res, next) => {
  if (res.headersSent) return next(erro);
  const status = erro.status === 413 || erro.type === "entity.too.large"
    ? 413
    : erro.status === 415 || erro.type === "charset.unsupported" || erro.type === "encoding.unsupported"
      ? 415
    : erro.status === 400 || erro.type === "entity.parse.failed"
      ? 400
      : 500;
  const code = erro.type === "entity.too.large"
    ? "request_too_large"
    : erro.type === "entity.parse.failed"
      ? "invalid_json"
      : erro.name || "Error";
  console.error(JSON.stringify({
    event: "http_request_error",
    request_id: req.requestId,
    method: req.method,
    path: req.path,
    status,
    error: code,
  }));
  return res.status(status).json({
    mensagem: status === 413
      ? "A requisição excede o tamanho máximo permitido."
      : status === 415
        ? "O formato da requisição não é suportado."
      : status === 400
        ? "O JSON da requisição é inválido."
        : "Ocorreu um erro interno.",
  });
});

const PORT = process.env.PORT || 3000;

sequelize.authenticate()
  .then(() => {
    console.log("Conectado ao banco de dados");
  })
  .then(initializeRateLimitStore)
  .then(session.initializeSessionStore)
  .then(() => {
    const cleanupTimer = setInterval(() => {
      session.cleanRevocations().catch(() => console.error("session_cleanup_failed"));
      cleanExpiredBuckets().catch(erro => {
        console.error(JSON.stringify({
          event: "rate_limit_cleanup_error",
          error: erro.original?.code || erro.parent?.code || erro.name,
        }));
      });
    }, 15 * 60 * 1000);
    cleanupTimer.unref();
    app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
  })
  .catch((err) => {
    console.error(JSON.stringify({
      event: "startup_failed",
      error: err.original?.code || err.parent?.code || err.name,
    }));
    process.exit(1);
  });
