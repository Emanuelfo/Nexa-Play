const express = require("express");
const router = express.Router();
const { cadastrar, me, redefinirSenha } = require("../controllers/usuarioController");
const auth = require("../middlewares/auth");

router.post("/api/usuarios", cadastrar);
router.get("/api/me", auth, me);
router.post("/api/redefinir-senha", redefinirSenha);

module.exports = router;
