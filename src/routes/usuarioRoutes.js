const express = require("express");
const router = express.Router();
const { cadastrar, me } = require("../controllers/usuarioController");
const {
  meuPerfil,
  perfilPublico,
  atualizarMeuPerfil,
  solicitarAmizade,
  aceitarAmizade,
  removerAmizade,
  listarAmizades,
  buscarUsuarios,
  sugerirUsuarios,
} = require("../controllers/perfilController");
const auth = require("../middlewares/auth");
const { createRateLimiter } = require("../middlewares/rateLimit");
const validateJsonBody = require("../middlewares/validateJsonBody");

const cadastroRateLimit = createRateLimiter({
  scope: "registration",
  windowMs: 60 * 60 * 1000,
  maxIp: 5,
});
const perfilRateLimit = createRateLimiter({
  scope: "profile-update",
  windowMs: 60 * 60 * 1000,
  maxIp: 30,
  maxUser: 20,
});
const solicitacaoRateLimit = createRateLimiter({
  scope: "friend-request",
  windowMs: 60 * 60 * 1000,
  maxIp: 40,
  maxUser: 20,
});
const respostaAmizadeRateLimit = createRateLimiter({
  scope: "friendship-response",
  windowMs: 60 * 60 * 1000,
  maxIp: 80,
  maxUser: 60,
});

router.post("/api/usuarios", cadastroRateLimit, validateJsonBody, cadastrar);
router.get("/api/me", auth, me);
router.get("/api/me/perfil", auth, meuPerfil);
router.put("/api/me/perfil", auth, perfilRateLimit, validateJsonBody, atualizarMeuPerfil);
router.get("/api/me/amizades", auth, listarAmizades);
router.get("/api/usuarios/buscar", auth, buscarUsuarios);
router.get("/api/usuarios/sugestoes", auth, sugerirUsuarios);
router.get("/api/usuarios/:id/perfil", auth, perfilPublico);
router.post("/api/usuarios/:id/amizade", auth, solicitacaoRateLimit, solicitarAmizade);
router.put("/api/usuarios/:id/amizade", auth, respostaAmizadeRateLimit, aceitarAmizade);
router.delete("/api/usuarios/:id/amizade", auth, respostaAmizadeRateLimit, removerAmizade);

module.exports = router;
