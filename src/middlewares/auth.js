const jwt = require("jsonwebtoken");

function lerToken(req) {
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string" || !/^Bearer [A-Za-z0-9._~-]+$/i.test(authHeader)) {
    return null;
  }

  try {
    const claims = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      clockTolerance: 5,
      maxAge: "30d",
    });
    if (!claims || typeof claims !== "object"
      || !(typeof claims.id === "string" || Number.isSafeInteger(claims.id))
      || !/^\d{1,18}$/.test(String(claims.id))
      || BigInt(claims.id) < 1n) {
      return null;
    }
    return { id: String(claims.id) };
  } catch {
    return null;
  }
}

function autenticar(req, res, next) {
  const usuario = lerToken(req);
  if (!usuario) {
    console.warn(JSON.stringify({
      event: "authentication_rejected",
      request_id: req.requestId,
      path: req.path,
    }));
    return res.status(401).json({ mensagem: "Token ausente, inválido ou expirado." });
  }
  req.usuario = usuario;
  return next();
}

// Igual ao anterior, mas não bloqueia: só preenche req.usuario se houver token válido
function autenticarOpcional(req, res, next) {
  req.usuario = lerToken(req) || undefined;
  return next();
}

module.exports = autenticar;
module.exports.opcional = autenticarOpcional;
