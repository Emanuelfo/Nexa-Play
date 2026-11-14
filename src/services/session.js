const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

const COOKIE_NAME = "nexa_session";
const hashToken = token => crypto.createHash("sha256").update(token).digest("hex");

function cookieOptions(req) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production" || req.secure, sameSite: "lax", path: "/api" };
}

function clearSession(req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions(req));
}

function setSession(req, res, token, remember) {
  const claims = jwt.decode(token);
  const options = cookieOptions(req);
  if (remember) options.maxAge = Math.max(0, claims.exp * 1000 - Date.now());
  res.cookie(COOKIE_NAME, token, options);
}

function sessionToken(req) {
  const cookie = (req.headers.cookie || "").split(";").find(part => part.trim().startsWith(`${COOKIE_NAME}=`));
  if (cookie) {
    try { return decodeURIComponent(cookie.trim().slice(COOKIE_NAME.length + 1)); } catch { return null; }
  }
  const header = req.headers.authorization;
  return typeof header === "string" && /^Bearer [A-Za-z0-9._~-]+$/i.test(header) ? header.slice(7) : null;
}

async function initializeSessionStore() {
  await sequelize.query(`CREATE TABLE IF NOT EXISTS public.jwt_revocations (
    token_hash char(64) PRIMARY KEY,
    expires_at timestamptz NOT NULL
  )`);
  await sequelize.query("CREATE INDEX IF NOT EXISTS idx_jwt_revocations_expiry ON public.jwt_revocations (expires_at)");
  await sequelize.query("ALTER TABLE public.jwt_revocations ENABLE ROW LEVEL SECURITY");
}

async function isRevoked(token) {
  const rows = await sequelize.query("SELECT 1 FROM public.jwt_revocations WHERE token_hash = :hash AND expires_at > NOW()", {
    replacements: { hash: hashToken(token) }, type: QueryTypes.SELECT,
  });
  return rows.length > 0;
}

async function revoke(token, exp) {
  await sequelize.query(`INSERT INTO public.jwt_revocations (token_hash, expires_at)
    VALUES (:hash, :expires) ON CONFLICT (token_hash) DO NOTHING`, {
    replacements: { hash: hashToken(token), expires: new Date(exp * 1000) },
  });
}

async function cleanRevocations() {
  await sequelize.query("DELETE FROM public.jwt_revocations WHERE expires_at <= NOW()");
}

module.exports = { clearSession, setSession, sessionToken, initializeSessionStore, isRevoked, revoke, cleanRevocations };
