const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const { setSession, clearSession } = require("../services/session");
const { where, fn, col } = require("sequelize");
const Usuario = require("../models/Usuario");
const { ehEmail } = require("../utils/validacao");

// Dados do usuário que podem ir para o navegador (nunca a senha)
function dadosPublicos(u) {
  return {
    id: u.id,
    nome_usuario: u.nome_usuario,
    email: u.email,
    pontos: u.pontos,
  };
}

function gerarToken(usuario, lembrar) {
  return jwt.sign({ id: usuario.id }, process.env.JWT_SECRET, {
    expiresIn: lembrar ? "30d" : "8h",
    jwtid: crypto.randomUUID(),
  });
}

async function cadastrar(req, res) {
  try {
    const { nome_completo, nome_usuario, email, senha, lembrar } = req.body;

    const nomeExibicao = typeof nome_completo === "string" ? nome_completo.trim() : "";
    const nomeUsuario = typeof nome_usuario === "string" ? nome_usuario.trim().toLowerCase() : "";
    const emailNorm = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (lembrar !== undefined && typeof lembrar !== "boolean") {
      return res.status(400).json({ mensagem: "A opção de manter a sessão deve ser verdadeira ou falsa." });
    }
    if (!nomeExibicao || nomeExibicao.length > 100) {
      return res.status(400).json({ mensagem: "Informe seu nome completo (até 100 caracteres)." });
    }
    if (!/^[a-z0-9_]{3,30}$/.test(nomeUsuario)) {
      return res.status(400).json({ mensagem: "O nome de usuário deve ter de 3 a 30 caracteres: letras, números ou _." });
    }
    if (!ehEmail(emailNorm) || emailNorm.length > 255) {
      return res.status(400).json({ mensagem: "Use um e-mail válido com até 255 caracteres." });
    }
    if (typeof senha !== "string" || senha.length < 6 || Buffer.byteLength(senha, "utf8") > 72) {
      return res.status(400).json({ mensagem: "A senha deve ter ao menos 6 caracteres e no máximo 72 bytes." });
    }

    if (await Usuario.findOne({ attributes: ["id"], where: where(fn("lower", fn("trim", col("email"))), emailNorm) })) {
      return res.status(409).json({ campo: "email", mensagem: "Já existe uma conta com esse e-mail." });
    }
    if (await Usuario.findOne({
      attributes: ["id"],
      where: where(fn("lower", col("nome_usuario")), nomeUsuario),
    })) {
      return res.status(409).json({ campo: "nome_usuario", mensagem: "Esse nome de usuário já está em uso." });
    }

    const usuario = await Usuario.create({
      nome_usuario: nomeUsuario,
      nome_exibicao: nomeExibicao,
      email: emailNorm,
      senha: await bcrypt.hash(senha, 10),
    }, { returning: ["id", "nome_usuario", "email", "pontos"] });

    setSession(req, res, gerarToken(usuario, !!lembrar), !!lembrar);
    res.status(201).json({ usuario: dadosPublicos(usuario) });
  } catch (erro) {
    if (erro.name === "SequelizeUniqueConstraintError" || (erro.original?.code || erro.parent?.code || erro.code) === "23505") {
      const fields = [...Object.keys(erro.fields || {}), ...(erro.errors || []).map(item => item.path)];
      const campo = fields.includes("email") ? "email" : fields.includes("nome_usuario") ? "nome_usuario" : undefined;
      return res.status(409).json({ campo, mensagem: "O e-mail ou nome de usuário já está em uso." });
    }
    console.error(JSON.stringify({
      event: "registration_error",
      request_id: req.requestId,
      error: erro.original?.code || erro.parent?.code || erro.name,
    }));
    res.status(500).json({ mensagem: "Não foi possível cadastrar o usuário." });
  }
}

// Usuário logado (usa o token) — o site chama isso ao abrir cada página
async function me(req, res) {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id, { attributes: ["id", "nome_usuario", "email", "pontos"] });
    if (!usuario) {
      clearSession(req, res);
      return res.status(401).json({ mensagem: "Usuário não encontrado" });
    }
    res.json(dadosPublicos(usuario));
  } catch (erro) {
    console.error(JSON.stringify({
      event: "current_user_error",
      request_id: req.requestId,
      error: erro.original?.code || erro.parent?.code || erro.name,
    }));
    res.status(500).json({ mensagem: "Não foi possível buscar o usuário." });
  }
}

module.exports = { cadastrar, me, dadosPublicos, gerarToken };
