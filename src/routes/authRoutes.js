const express = require("express");
const router = express.Router();
const { login } = require("../controllers/authController");
const { createRateLimiter } = require("../middlewares/rateLimit");
const validateJsonBody = require("../middlewares/validateJsonBody");

router.post("/api/login", createRateLimiter({
  scope: "login",
  windowMs: 15 * 60 * 1000,
  maxIp: 10,
  maxIdentity: 20,
  identity: req => req.body?.id_login,
}), validateJsonBody, login);

module.exports = router;
