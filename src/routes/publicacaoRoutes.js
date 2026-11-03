const express = require("express");
const auth = require("../middlewares/auth");
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

router.get("/api/publicacoes", auth, listar);
router.get("/api/publicacoes/:id", auth, obter);
router.post("/api/publicacoes", auth, criar);
router.delete("/api/publicacoes/:id", auth, apagar);
router.put("/api/publicacoes/:id", auth, editar);
router.put("/api/publicacoes/:id/curtida", auth, alterarCurtida);
router.delete("/api/publicacoes/:id/curtida", auth, alterarCurtida);
router.get("/api/publicacoes/:id/comentarios", auth, listarComentarios);
router.post("/api/publicacoes/:id/comentarios", auth, criarComentario);

module.exports = router;
