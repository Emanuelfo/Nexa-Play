const express = require("express");
const router = express.Router();
const { enviar } = require("../controllers/mensagemController");
const auth = require("../middlewares/auth");
const { createRateLimiter } = require("../middlewares/rateLimit");
const validateJsonBody = require("../middlewares/validateJsonBody");
const mensagemRateLimit = createRateLimiter({
  scope: "contact-message",
  windowMs: 60 * 60 * 1000,
  maxIp: 5,
  maxUser: 8,
});

// Aberta a visitantes; se vier um token válido, a mensagem fica ligada ao usuário
router.post("/api/mensagens", auth.opcional, mensagemRateLimit, validateJsonBody, enviar);

module.exports = router;
