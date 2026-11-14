const { setSession } = require("../services/session");
const bcrypt = require("bcrypt");
const { where, fn, col } = require("sequelize");
const Usuario = require("../models/Usuario");
const { ehEmail } = require("../utils/validacao");
const { dadosPublicos, gerarToken } = require("./usuarioController");
const { lerTokenVinculo } = require("../services/googleAuth");

// Retorna null quando o vínculo foi feito (ou já existia); caso contrário, a resposta de erro.
async function vincularGoogle(usuario, { sub, email }) {
  if (usuario.email !== email) {
    return { status: 400, corpo: { codigo: "vinculo_invalido", mensagem: "Esta confirmação do Google é de outro e-mail. Clique em \"Continuar com o Google\" novamente." } };
  }
  if (usuario.google_sub === sub) return null;
  if (usuario.google_sub) {
    return { status: 409, corpo: { codigo: "conta_vinculada_outro_google", mensagem: "Esta conta já está vinculada a outra conta do Google." } };
  }
  try {
    // UPDATE condicional: não sobrescreve um vínculo criado em paralelo
    const [alteradas] = await Usuario.update(
      { google_sub: sub, google_vinculado_em: new Date() },
      { where: { id: usuario.id, google_sub: null } },
    );
    if (!alteradas) {
      return { status: 409, corpo: { codigo: "conta_vinculada_outro_google", mensagem: "Esta conta já está vinculada a outra conta do Google." } };
    }
    return null;
  } catch (erro) {
    if (erro.name === "SequelizeUniqueConstraintError" || (erro.parent || erro.original)?.code === "23505") {
      return { status: 409, corpo: { codigo: "google_ja_vinculado", mensagem: "Esta conta do Google já está vinculada a outra conta Nexa." } };
    }
    throw erro;
  }
}

async function login(req, res) {
  try {
    const { id_login, senha, lembrar, google_vinculo: googleVinculo } = req.body;
    const invalido = () => res.status(401).json({ mensagem: "E-mail, usuário ou senha incorretos. Confira os dados ou crie uma conta." });

    if (typeof id_login !== "string" || !id_login.trim() || id_login.length > 255
      || typeof senha !== "string" || !senha || Buffer.byteLength(senha, "utf8") > 1024
      || (lembrar !== undefined && typeof lembrar !== "boolean")
      || (googleVinculo !== undefined && (typeof googleVinculo !== "string" || googleVinculo.length > 2048))) {
      return invalido();
    }

    // Vínculo Google -> conta existente: o token vem do /api/auth/google (e-mail já provado pelo Google);
    // só é concluído abaixo, depois que a SENHA da conta existente for conferida.
    let vinculo = null;
    if (googleVinculo !== undefined) {
      vinculo = lerTokenVinculo(googleVinculo);
      if (!vinculo) {
        return res.status(400).json({
          codigo: "vinculo_invalido",
          mensagem: "A confirmação do Google expirou. Clique em \"Continuar com o Google\" novamente.",
        });
      }
    }

    const identificador = id_login.trim();
    const usuario = ehEmail(identificador)
      ? await Usuario.findOne({ where: { email: identificador.toLowerCase() } })
      : await Usuario.findOne({
        where: where(fn("lower", col("nome_usuario")), identificador.replace(/^@/, "").toLowerCase()),
      });

    // Contas criadas só pelo Google não têm senha local: nunca passam por este caminho.
    if (usuario && typeof usuario.senha === "string" && usuario.senha
      && await bcrypt.compare(String(senha), usuario.senha)) {
      if (vinculo) {
        const resultado = await vincularGoogle(usuario, vinculo);
        if (resultado) return res.status(resultado.status).json(resultado.corpo);
      }
      setSession(req, res, gerarToken(usuario, !!lembrar), !!lembrar);
      return res.json({
        usuario: dadosPublicos(usuario),
        ...(vinculo ? { google_vinculado: true } : {}),
      });
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
