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

router.post("/api/usuarios", cadastrar);
router.get("/api/me", auth, me);
router.get("/api/me/perfil", auth, meuPerfil);
router.put("/api/me/perfil", auth, atualizarMeuPerfil);
router.get("/api/me/amizades", auth, listarAmizades);
router.get("/api/usuarios/buscar", auth, buscarUsuarios);
router.get("/api/usuarios/sugestoes", auth, sugerirUsuarios);
router.get("/api/usuarios/:id/perfil", auth, perfilPublico);
router.post("/api/usuarios/:id/amizade", auth, solicitarAmizade);
router.put("/api/usuarios/:id/amizade", auth, aceitarAmizade);
router.delete("/api/usuarios/:id/amizade", auth, removerAmizade);

module.exports = router;
