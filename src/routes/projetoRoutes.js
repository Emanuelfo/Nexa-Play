const express = require("express");
const auth = require("../middlewares/auth");
const controller = require("../controllers/projetoController");
const { createRateLimiter } = require("../middlewares/rateLimit");
const validateJsonBody = require("../middlewares/validateJsonBody");

const router = express.Router();
const criarProjetoRateLimit = createRateLimiter({
  scope: "project-create",
  windowMs: 60 * 60 * 1000,
  maxIp: 30,
  maxUser: 10,
});
const editarProjetoRateLimit = createRateLimiter({
  scope: "project-edit",
  windowMs: 60 * 60 * 1000,
  maxIp: 60,
  maxUser: 30,
});
const conviteProjetoRateLimit = createRateLimiter({
  scope: "project-invitation",
  windowMs: 60 * 60 * 1000,
  maxIp: 40,
  maxUser: 20,
});
const solicitacaoProjetoRateLimit = createRateLimiter({
  scope: "project-join-request",
  windowMs: 60 * 60 * 1000,
  maxIp: 40,
  maxUser: 20,
});
const participacaoProjetoRateLimit = createRateLimiter({
  scope: "project-participation",
  windowMs: 60 * 60 * 1000,
  maxIp: 80,
  maxUser: 40,
});
const atualizacaoProjetoRateLimit = createRateLimiter({
  scope: "project-update-post",
  windowMs: 60 * 60 * 1000,
  maxIp: 60,
  maxUser: 30,
});

router.get("/api/projetos", auth, controller.explorar);
router.get("/api/me/projetos", auth, controller.meusProjetos);
router.post("/api/projetos", auth, criarProjetoRateLimit, validateJsonBody, controller.criar);
router.get("/api/projetos/:id", auth, controller.obter);
router.put("/api/projetos/:id", auth, editarProjetoRateLimit, validateJsonBody, controller.atualizar);
router.post("/api/projetos/:id/convites", auth, conviteProjetoRateLimit, validateJsonBody, controller.convidar);
router.post("/api/projetos/:id/solicitacoes", auth, solicitacaoProjetoRateLimit, controller.solicitarParticipacao);
router.put("/api/projetos/:id/participantes/:usuarioId", auth, participacaoProjetoRateLimit, validateJsonBody, controller.responderParticipacao);
router.delete("/api/projetos/:id/participantes/:usuarioId", auth, participacaoProjetoRateLimit, controller.removerParticipante);
router.post("/api/projetos/:id/atualizacoes", auth, atualizacaoProjetoRateLimit, validateJsonBody, controller.criarAtualizacao);

module.exports = router;
