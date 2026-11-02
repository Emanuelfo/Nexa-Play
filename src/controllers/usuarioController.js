const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
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
  });
}

async function cadastrar(req, res) {
  try {
    const { nome_usuario, email, senha, lembrar } = req.body;

    const nomeExibicao = typeof nome_usuario === "string" ? nome_usuario.trim() : "";
    const nomeUsuario = nomeExibicao.toLowerCase();
    const emailNorm = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!/^[a-z0-9_]{3,30}$/.test(nomeUsuario)) {
      return res.status(400).json({ mensagem: "O nome de usuário deve ter de 3 a 30 caracteres: letras, números ou _." });
    }
    if (!ehEmail(emailNorm)) return res.status(400).json({ mensagem: "Use um e-mail válido." });
    if (typeof senha !== "string" || senha.length < 6) return res.status(400).json({ mensagem: "A senha precisa ter ao menos 6 caracteres." });

    if (await Usuario.findOne({ where: { email: emailNorm } })) {
      return res.status(409).json({ mensagem: "Já existe uma conta com esse e-mail." });
    }
    if (await Usuario.findOne({
      where: where(fn("lower", col("nome_usuario")), nomeUsuario),
    })) {
      return res.status(409).json({ mensagem: "Esse nome de usuário já está em uso." });
    }

    const usuario = await Usuario.create({
      nome_usuario: nomeUsuario,
      nome_exibicao: nomeExibicao,
      email: emailNorm,
      senha: await bcrypt.hash(senha, 10),
    });

    res.status(201).json({ token: gerarToken(usuario, !!lembrar), usuario: dadosPublicos(usuario) });
  } catch (erro) {
    if (erro.name === "SequelizeUniqueConstraintError" || erro.code === "23505") {
      return res.status(409).json({ mensagem: "O e-mail ou nome de usuário já está em uso." });
    }
    res.status(500).json({ mensagem: "Erro ao cadastrar usuário", erro: erro.message });
  }
}

// Usuário logado (usa o token) — o site chama isso ao abrir cada página
async function me(req, res) {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id);
    if (!usuario) return res.status(401).json({ mensagem: "Usuário não encontrado" });
    res.json(dadosPublicos(usuario));
  } catch (erro) {
    res.status(500).json({ mensagem: "Erro ao buscar usuário", erro: erro.message });
  }
}

module.exports = { cadastrar, me, dadosPublicos, gerarToken };
