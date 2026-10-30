const bcrypt = require("bcrypt");
const { Op, where, fn, col } = require("sequelize");
const Usuario = require("../models/Usuario");
const { normalizarContato } = require("../utils/validacao");
const { dadosPublicos, gerarToken } = require("./usuarioController");

async function login(req, res) {
  try {
    const { id_login, senha, lembrar } = req.body;
    const invalido = () => res.status(401).json({ mensagem: "E-mail, usuário ou senha incorretos. Confira os dados ou crie uma conta." });

    if (!id_login || !senha) return invalido();

    // O site permite entrar com e-mail, celular, nome ou nome completo
    const contato = normalizarContato(id_login);
    let candidatos;
    if (contato) {
      candidatos = await Usuario.findAll({ where: { contato } });
    } else {
      const texto = String(id_login).trim().toLowerCase();
      candidatos = await Usuario.findAll({
        where: {
          [Op.or]: [
            where(fn("lower", col("nome")), texto),
            where(fn("lower", fn("concat", col("nome"), " ", col("sobrenome"))), texto),
          ],
        },
        limit: 20,
      });
    }

    for (const usuario of candidatos) {
      if (await bcrypt.compare(String(senha), usuario.senha)) {
        return res.json({ token: gerarToken(usuario, !!lembrar), usuario: dadosPublicos(usuario) });
      }
    }
    invalido();
  } catch (erro) {
    res.status(500).json({ mensagem: "Erro ao fazer login", erro: erro.message });
  }
}

module.exports = { login };
