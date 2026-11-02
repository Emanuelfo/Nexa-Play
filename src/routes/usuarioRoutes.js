const express = require("express");
const router = express.Router();
const { cadastrar, me } = require("../controllers/usuarioController");
const auth = require("../middlewares/auth");

router.post("/api/usuarios", cadastrar);
router.get("/api/me", auth, me);

module.exports = router;
