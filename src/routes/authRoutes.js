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

const auth = require("../middlewares/auth");
const session = require("../services/session");

// Move a legacy Bearer JWT into the cookie without extending its expiration.
router.post("/api/auth/session", auth, (req, res) => {
  session.setSession(req, res, req.sessionToken, req.body?.lembrar === true);
  res.sendStatus(204);
});
router.post("/api/logout", auth.opcional, async (req, res) => {
  if (req.usuario) await session.revoke(req.sessionToken, req.sessionExpiry);
  session.clearSession(req, res);
  res.sendStatus(204);
});

module.exports = router;
