const express = require("express");
const router = express.Router();
const { enviar } = require("../controllers/mensagemController");
const auth = require("../middlewares/auth");

// Aberta a visitantes; se vier um token válido, a mensagem fica ligada ao usuário
router.post("/api/mensagens", auth.opcional, enviar);

module.exports = router;
