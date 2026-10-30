const express = require("express");
const router = express.Router();
const { login } = require("../controllers/authController");

router.post("/api/login", login);

module.exports = router;
