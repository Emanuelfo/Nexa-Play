const Mensagem = require("../models/Mensagem");
const { ehEmail } = require("../utils/validacao");

async function enviar(req, res) {
  try {
    const nome = String(req.body.nome || "").trim();
    const email = String(req.body.email || "").trim();
    const assunto = String(req.body.assunto || "").trim();
    const texto = String(req.body.msg || "").trim();

    if (nome.length < 2) return res.status(400).json({ mensagem: "Informe seu nome." });
    if (!ehEmail(email)) return res.status(400).json({ mensagem: "Informe um e-mail válido." });
    if (assunto.length < 3) return res.status(400).json({ mensagem: "Informe o assunto." });
    if (texto.length < 10) return res.status(400).json({ mensagem: "Escreva ao menos 10 caracteres." });
    if (texto.length > 5000 || assunto.length > 200 || nome.length > 150 || email.length > 200) {
      return res.status(400).json({ mensagem: "Algum campo excede o tamanho permitido." });
    }

    await Mensagem.create({ nome, email, assunto, texto, usuario_id: req.usuario ? req.usuario.id : null });
    res.status(201).json({ mensagem: "Mensagem enviada." });
  } catch (erro) {
    res.status(500).json({ mensagem: "Erro ao enviar mensagem", erro: erro.message });
  }
}

module.exports = { enviar };
