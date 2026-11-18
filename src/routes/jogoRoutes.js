const express = require("express");
const auth = require("../middlewares/auth");
const { dadosDoJogo } = require("../controllers/jogoController");

const router = express.Router();

router.get("/api/jogo", auth, dadosDoJogo);

module.exports = router;
