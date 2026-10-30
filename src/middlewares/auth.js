const jwt = require("jsonwebtoken");

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ mensagem: "Token não enviado" });
  }

  const token = authHeader.split(" ")[1];
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (erro) {
    return res.status(401).json({ mensagem: "Token inválido ou expirado" });
  }
}

// Igual ao anterior, mas não bloqueia: só preenche req.usuario se houver token válido
function autenticarOpcional(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      req.usuario = jwt.verify(authHeader.split(" ")[1], process.env.JWT_SECRET);
    } catch (erro) { /* token inválido: segue como visitante */ }
  }
  next();
}

module.exports = autenticar;
module.exports.opcional = autenticarOpcional;
