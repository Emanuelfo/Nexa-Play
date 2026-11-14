const jwt = require("jsonwebtoken");
const session = require("../services/session");

async function lerToken(req) {
  const token = session.sessionToken(req);
  if (!token) return null;
  let claims;
  try {
    claims = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      clockTolerance: 5,
      maxAge: "30d",
    });
    if (!claims || typeof claims !== "object" || !Number.isFinite(claims.exp)
      || !(typeof claims.id === "string" || Number.isSafeInteger(claims.id))
      || !/^\d{1,18}$/.test(String(claims.id))
      || BigInt(claims.id) < 1n) {
      return null;
    }

  } catch {
    return null;
  }
  if (await session.isRevoked(token)) return null;
  req.sessionToken = token;
  req.sessionExpiry = claims.exp;
  return { id: String(claims.id) };
}

async function autenticar(req, res, next) {
  const usuario = await lerToken(req);
  if (!usuario) {
    console.warn(JSON.stringify({
      event: "authentication_rejected",
      request_id: req.requestId,
      path: req.path,
    }));
    session.clearSession(req, res);
    return res.status(401).json({ mensagem: "Token ausente, inválido ou expirado." });
  }
  req.usuario = usuario;
  return next();
}

// Igual ao anterior, mas não bloqueia: só preenche req.usuario se houver token válido
async function autenticarOpcional(req, res, next) {
  req.usuario = await lerToken(req) || undefined;
  return next();
}

module.exports = autenticar;
module.exports.opcional = autenticarOpcional;
