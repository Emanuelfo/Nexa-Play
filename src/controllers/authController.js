const bcrypt = require("bcrypt");
const { where, fn, col } = require("sequelize");
const Usuario = require("../models/Usuario");
const { ehEmail } = require("../utils/validacao");
const { dadosPublicos, gerarToken } = require("./usuarioController");

async function login(req, res) {
  try {
    const { id_login, senha, lembrar } = req.body;
    const invalido = () => res.status(401).json({ mensagem: "E-mail, usuário ou senha incorretos. Confira os dados ou crie uma conta." });

    if (typeof id_login !== "string" || !id_login.trim() || id_login.length > 255
      || typeof senha !== "string" || !senha || Buffer.byteLength(senha, "utf8") > 1024
      || (lembrar !== undefined && typeof lembrar !== "boolean")) {
      return invalido();
    }

    const identificador = id_login.trim();
    const usuario = ehEmail(identificador)
      ? await Usuario.findOne({ where: { email: identificador.toLowerCase() } })
      : await Usuario.findOne({
        where: where(fn("lower", col("nome_usuario")), identificador.replace(/^@/, "").toLowerCase()),
      });

    if (usuario && await bcrypt.compare(String(senha), usuario.senha)) {
      return res.json({ token: gerarToken(usuario, !!lembrar), usuario: dadosPublicos(usuario) });
    }
    invalido();
  } catch (erro) {
    console.error(JSON.stringify({
      event: "login_error",
      request_id: req.requestId,
      error: erro.original?.code || erro.parent?.code || erro.name,
    }));
    res.status(500).json({ mensagem: "Não foi possível fazer login." });
  }
}

module.exports = { login };
