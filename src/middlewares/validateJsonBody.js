function validateJsonBody(req, res, next) {
  if (!req.is("application/json")) {
    return res.status(415).json({ mensagem: "Envie os dados no formato application/json." });
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ mensagem: "O corpo da requisição deve ser um objeto JSON." });
  }
  next();
}

module.exports = validateJsonBody;
