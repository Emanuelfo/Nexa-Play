const express = require("express");
const auth = require("../middlewares/auth");
const controller = require("../controllers/projetoController");

const router = express.Router();

router.get("/api/projetos", auth, controller.explorar);
router.get("/api/me/projetos", auth, controller.meusProjetos);
router.post("/api/projetos", auth, controller.criar);
router.get("/api/projetos/:id", auth, controller.obter);
router.put("/api/projetos/:id", auth, controller.atualizar);
router.post("/api/projetos/:id/convites", auth, controller.convidar);
router.post("/api/projetos/:id/solicitacoes", auth, controller.solicitarParticipacao);
router.put("/api/projetos/:id/participantes/:usuarioId", auth, controller.responderParticipacao);
router.delete("/api/projetos/:id/participantes/:usuarioId", auth, controller.removerParticipante);
router.post("/api/projetos/:id/atualizacoes", auth, controller.criarAtualizacao);

module.exports = router;
