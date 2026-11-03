const express = require("express");
const auth = require("../middlewares/auth");
const { createRateLimiter } = require("../middlewares/rateLimit");
const validateJsonBody = require("../middlewares/validateJsonBody");
const {
  listar,
  obter,
  criar,
  apagar,
  editar,
  alterarCurtida,
  listarComentarios,
  criarComentario,
} = require("../controllers/publicacaoController");

const router = express.Router();
const criarPublicacaoRateLimit = createRateLimiter({
  scope: "publication-create",
  windowMs: 60 * 60 * 1000,
  maxIp: 30,
  maxUser: 10,
});
const editarPublicacaoRateLimit = createRateLimiter({
  scope: "publication-edit",
  windowMs: 60 * 60 * 1000,
  maxIp: 40,
  maxUser: 20,
});
const apagarPublicacaoRateLimit = createRateLimiter({
  scope: "publication-delete",
  windowMs: 60 * 60 * 1000,
  maxIp: 40,
  maxUser: 20,
});
const curtidaRateLimit = createRateLimiter({
  scope: "publication-like",
  windowMs: 60 * 1000,
  maxIp: 120,
  maxUser: 60,
});
const comentarioRateLimit = createRateLimiter({
  scope: "publication-comment",
  windowMs: 60 * 1000,
  maxIp: 60,
  maxUser: 30,
});

router.get("/api/publicacoes", auth, listar);
router.get("/api/publicacoes/:id", auth, obter);
router.post("/api/publicacoes", auth, criarPublicacaoRateLimit, validateJsonBody, criar);
router.delete("/api/publicacoes/:id", auth, apagarPublicacaoRateLimit, apagar);
router.put("/api/publicacoes/:id", auth, editarPublicacaoRateLimit, validateJsonBody, editar);
router.put("/api/publicacoes/:id/curtida", auth, curtidaRateLimit, alterarCurtida);
router.delete("/api/publicacoes/:id/curtida", auth, curtidaRateLimit, alterarCurtida);
router.get("/api/publicacoes/:id/comentarios", auth, listarComentarios);
router.post("/api/publicacoes/:id/comentarios", auth, comentarioRateLimit, validateJsonBody, criarComentario);

module.exports = router;
