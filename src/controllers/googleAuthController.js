const crypto = require("node:crypto");
const { where, fn, col } = require("sequelize");
const Usuario = require("../models/Usuario");
const { ehEmail } = require("../utils/validacao");
const { dadosPublicos, gerarToken } = require("./usuarioController");
const {
  verificarIdToken,
  googleConfigurado,
  clientId,
  gerarTokenVinculo,
  GoogleTokenInvalidoError,
  GoogleEmailNaoVerificadoError,
  GoogleIndisponivelError,
} = require("../services/googleAuth");

const MAX_TENTATIVAS_NOME = 8;

// O Client ID é público por definição (aparece no navegador); o front-end estático o busca aqui,
// assim a mesma variável GOOGLE_CLIENT_ID do Render vale para o servidor e para o botão.
function configGoogle(req, res) {
  if (!googleConfigurado()) {
    return res.status(503).json({ mensagem: "O login com Google não está disponível no momento." });
  }
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.json({ client_id: clientId() });
}

const semAcento = (texto) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// nome_usuario segue a regra do cadastro: /^[a-z0-9_]{3,30}$/
function baseNomeUsuario(email) {
  let base = semAcento(email.split("@")[0]).toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  if (base.length < 3) base = `jogador${base}`;
  return base.slice(0, 22);
}

function candidatoNomeUsuario(base, tentativa) {
  if (tentativa === 0) return base;
  const sufixo = crypto.randomInt(0, 36 ** 5).toString(36).padStart(5, "0");
  return `${base}_${sufixo}`.slice(0, 30);
}

const nomeUsuarioEmUso = async (nome) => !!(await Usuario.findOne({
  where: where(fn("lower", col("nome_usuario")), nome),
  attributes: ["id"],
}));

const eUnicidade = (erro) => erro?.name === "SequelizeUniqueConstraintError" || (erro?.parent || erro?.original)?.code === "23505";

function respostaLogin(res, usuario, lembrar, extra = {}) {
  return res.json({ token: gerarToken(usuario, lembrar), usuario: dadosPublicos(usuario), ...extra });
}

async function criarContaGoogle(google) {
  const nomeExibicao = (google.nome || google.email.split("@")[0]).slice(0, 100);
  const base = baseNomeUsuario(google.email);
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_NOME; tentativa += 1) {
    const nomeUsuario = candidatoNomeUsuario(base, tentativa);
    if (await nomeUsuarioEmUso(nomeUsuario)) continue;
    try {
      const usuario = await Usuario.create({
        nome_usuario: nomeUsuario,
        nome_exibicao: nomeExibicao,
        email: google.email,
        senha: null, // conta Google: sem senha local
        google_sub: google.sub,
        google_vinculado_em: new Date(),
      });
      return { usuario, criado: true };
    } catch (erro) {
      if (!eUnicidade(erro)) throw erro;
      // Requisição simultânea (ou nome ocupado no meio-tempo): reavalia o estado real do banco.
      const porSub = await Usuario.findOne({ where: { google_sub: google.sub } });
      if (porSub) return { usuario: porSub, criado: false };
      if (await Usuario.findOne({ where: { email: google.email }, attributes: ["id"] })) {
        const conflito = new Error("email_em_uso");
        conflito.name = "EmailEmUsoError";
        throw conflito;
      }
      // senão foi colisão de nome_usuario: tenta outro candidato
    }
  }
  throw new Error("Não foi possível gerar um nome de usuário único.");
}

async function loginGoogle(req, res) {
  try {
    const { credential, lembrar } = req.body;
    if (typeof credential !== "string" || !credential
      || (lembrar !== undefined && typeof lembrar !== "boolean")) {
      return res.status(400).json({ codigo: "requisicao_invalida", mensagem: "Não foi possível ler a resposta do Google. Tente novamente." });
    }

    const google = await verificarIdToken(credential);

    // 1) Conta já vinculada a este Google (identificador externo "sub")
    const vinculado = await Usuario.findOne({ where: { google_sub: google.sub } });
    if (vinculado) return respostaLogin(res, vinculado, !!lembrar, { novo_usuario: false });

    // 2) Mesmo e-mail em conta existente: NÃO vincula automaticamente
    const existente = ehEmail(google.email)
      ? await Usuario.findOne({ where: { email: google.email } })
      : null;
    if (existente) {
      // Conta criada/vinculada a este mesmo Google por uma requisição simultânea: é a mesma pessoa
      if (existente.google_sub === google.sub) return respostaLogin(res, existente, !!lembrar, { novo_usuario: false });
      if (existente.google_sub) {
        return res.status(409).json({
          codigo: "conta_vinculada_outro_google",
          mensagem: "Este e-mail pertence a uma conta Nexa já vinculada a outra conta do Google.",
        });
      }
      return res.status(409).json({
        codigo: "conta_existente",
        email: existente.email,
        vinculo_token: gerarTokenVinculo({ sub: google.sub, email: existente.email }),
        mensagem: `Já existe uma conta Nexa com o e-mail ${existente.email}. Digite a senha dela para vincular o seu Google.`,
      });
    }

    // 3) Conta nova (e-mail validado pelo Google; sem senha local)
    if (!ehEmail(google.email) || google.email.length > 255) {
      return res.status(400).json({ codigo: "email_invalido", mensagem: "O e-mail da conta Google não pôde ser usado." });
    }
    const { usuario, criado } = await criarContaGoogle(google);
    return respostaLogin(res, usuario, !!lembrar, { novo_usuario: criado });
  } catch (erro) {
    if (erro instanceof GoogleTokenInvalidoError) {
      return res.status(401).json({ codigo: "google_token_invalido", mensagem: "Não foi possível confirmar sua conta do Google. Tente novamente." });
    }
    if (erro instanceof GoogleEmailNaoVerificadoError) {
      return res.status(403).json({ codigo: "email_nao_verificado", mensagem: "O e-mail da sua conta Google ainda não foi verificado." });
    }
    if (erro instanceof GoogleIndisponivelError) {
      return res.status(503).json({ codigo: "google_indisponivel", mensagem: "O login com Google está indisponível no momento. Tente novamente em instantes ou use e-mail e senha." });
    }
    if (erro?.name === "EmailEmUsoError") {
      return res.status(409).json({ codigo: "conta_existente", mensagem: "Já existe uma conta com este e-mail. Tente entrar novamente." });
    }
    console.error(JSON.stringify({
      event: "google_login_error",
      request_id: req.requestId,
      error: erro.original?.code || erro.parent?.code || erro.name,
    }));
    return res.status(500).json({ mensagem: "Não foi possível entrar com o Google." });
  }
}

module.exports = { configGoogle, loginGoogle };
