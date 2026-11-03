const Mensagem = require("../models/Mensagem");
const { ehEmail } = require("../utils/validacao");

async function enviar(req, res) {
  try {
    const nome = typeof req.body.nome === "string" ? req.body.nome.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const assunto = typeof req.body.assunto === "string" ? req.body.assunto.trim() : "";
    const texto = typeof req.body.msg === "string" ? req.body.msg.trim() : "";

    if (nome.length < 2) return res.status(400).json({ mensagem: "Informe seu nome." });
    if (!ehEmail(email)) return res.status(400).json({ mensagem: "Informe um e-mail válido." });
    if (assunto.length < 3) return res.status(400).json({ mensagem: "Informe o assunto." });
    if (texto.length < 10) return res.status(400).json({ mensagem: "Escreva ao menos 10 caracteres." });
    if (texto.length > 5000 || assunto.length > 150 || nome.length > 100 || email.length > 255) {
      return res.status(400).json({ mensagem: "Algum campo excede o tamanho permitido." });
    }

    await Mensagem.create({ nome, email, assunto, texto, usuario_id: req.usuario ? req.usuario.id : null });
    res.status(201).json({ mensagem: "Mensagem enviada." });
  } catch (erro) {
    console.error(JSON.stringify({
      event: "message_submission_error",
      request_id: req.requestId,
      error: erro.original?.code || erro.parent?.code || erro.name,
    }));
    res.status(500).json({ mensagem: "Não foi possível enviar a mensagem." });
  }
}

module.exports = { enviar };
