const bcrypt = require("bcrypt");
const { where, fn, col } = require("sequelize");
const Usuario = require("../models/Usuario");
const { ehEmail } = require("../utils/validacao");
const { dadosPublicos, gerarToken } = require("./usuarioController");

async function login(req, res) {
  try {
    const { id_login, senha, lembrar } = req.body;
    const invalido = () => res.status(401).json({ mensagem: "E-mail, usuário ou senha incorretos. Confira os dados ou crie uma conta." });

    if (!id_login || !senha) return invalido();

    const identificador = String(id_login).trim();
    const usuario = ehEmail(identificador)
      ? await Usuario.findOne({ where: { email: identificador.toLowerCase() } })
      : await Usuario.findOne({
        where: where(fn("lower", col("nome_usuario")), identificador.toLowerCase()),
      });

    if (usuario && await bcrypt.compare(String(senha), usuario.senha)) {
      return res.json({ token: gerarToken(usuario, !!lembrar), usuario: dadosPublicos(usuario) });
    }
    invalido();
  } catch (erro) {
    res.status(500).json({ mensagem: "Erro ao fazer login", erro: erro.message });
  }
}

module.exports = { login };
