const express = require("express");
const router = express.Router();
const { login } = require("../controllers/authController");
const { configGoogle, loginGoogle } = require("../controllers/googleAuthController");
const { createRateLimiter } = require("../middlewares/rateLimit");
const validateJsonBody = require("../middlewares/validateJsonBody");

router.post("/api/login", createRateLimiter({
  scope: "login",
  windowMs: 15 * 60 * 1000,
  maxIp: 10,
  maxIdentity: 20,
  identity: req => req.body?.id_login,
}), validateJsonBody, login);

// Login com Google (Google Identity Services): o front envia o ID Token; o servidor valida tudo.
router.get("/api/auth/google/config", configGoogle);
router.post("/api/auth/google", createRateLimiter({
  scope: "google-login",
  windowMs: 15 * 60 * 1000,
  maxIp: 30,
}), validateJsonBody, loginGoogle);

module.exports = router;
