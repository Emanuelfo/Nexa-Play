// Validação do ID Token do Google (Google Identity Services) com a biblioteca oficial.
// ATENÇÃO: nunca registrar o token nem erro.message nos logs — mensagens da biblioteca
// podem conter trechos do token.
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const EMISSORES_GOOGLE = new Set(["accounts.google.com", "https://accounts.google.com"]);
const FORMATO_JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/;
const ERRO_REDE = /retrieve verification certs|ENOTFOUND|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|network/i;

class GoogleTokenInvalidoError extends Error {
  constructor(motivo) { super("Token do Google inválido."); this.name = "GoogleTokenInvalidoError"; this.motivo = motivo; }
}
class GoogleEmailNaoVerificadoError extends Error {
  constructor() { super("E-mail do Google não verificado."); this.name = "GoogleEmailNaoVerificadoError"; }
}
class GoogleIndisponivelError extends Error {
  constructor() { super("Serviço de validação do Google indisponível."); this.name = "GoogleIndisponivelError"; }
}

const clientId = () => (process.env.GOOGLE_CLIENT_ID || "").trim();
const googleConfigurado = () => /^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId());

let cliente;
const obterCliente = () => (cliente ||= new OAuth2Client());

/**
 * Valida assinatura (certificados públicos do Google), emissor, audiência (GOOGLE_CLIENT_ID)
 * e expiração do ID Token. Retorna só os dados confiáveis do payload validado.
 */
async function verificarIdToken(idToken) {
  if (!googleConfigurado()) throw new GoogleIndisponivelError();
  if (typeof idToken !== "string" || idToken.length > 8192 || !FORMATO_JWT.test(idToken)) {
    throw new GoogleTokenInvalidoError("formato");
  }

  let payload;
  try {
    const ticket = await obterCliente().verifyIdToken({ idToken, audience: clientId() });
    payload = ticket.getPayload();
  } catch (erro) {
    if (ERRO_REDE.test(`${erro?.code || ""} ${erro?.message || ""}`)) throw new GoogleIndisponivelError();
    throw new GoogleTokenInvalidoError("verificacao");
  }

  // Conferência explícita (defesa em profundidade, além da biblioteca)
  if (!payload
    || !EMISSORES_GOOGLE.has(payload.iss)
    || payload.aud !== clientId()
    || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()
    || typeof payload.sub !== "string" || !/^[\x21-\x7E]{1,255}$/.test(payload.sub)) {
    throw new GoogleTokenInvalidoError("payload");
  }
  if (typeof payload.email !== "string" || !payload.email.trim()) throw new GoogleTokenInvalidoError("sem_email");
  if (payload.email_verified !== true && payload.email_verified !== "true") throw new GoogleEmailNaoVerificadoError();

  return {
    sub: payload.sub,
    email: payload.email.trim().toLowerCase(),
    nome: typeof payload.name === "string" ? payload.name.trim() : "",
  };
}

/* ---- Token curto de vínculo (Google -> conta existente) -------------------------------------
 * Emitido quando o e-mail do Google já pertence a uma conta com senha. Prova que o dono do
 * Google confirmou o e-mail, mas NÃO autentica ninguém: o vínculo só se conclui no /api/login,
 * depois que a senha da conta existente for conferida. Usa chave derivada do JWT_SECRET e
 * "purpose" próprio, então não é aceito como token de sessão (que exige claim "id"). */
const chaveVinculo = () => crypto.createHmac("sha256", process.env.JWT_SECRET).update("google-link-v1").digest();

function gerarTokenVinculo({ sub, email }) {
  return jwt.sign({ purpose: "google-link", sub, email }, chaveVinculo(), { algorithm: "HS256", expiresIn: "10m" });
}

function lerTokenVinculo(token) {
  try {
    const claims = jwt.verify(token, chaveVinculo(), { algorithms: ["HS256"], clockTolerance: 5, maxAge: "10m" });
    if (claims?.purpose !== "google-link" || typeof claims.sub !== "string" || typeof claims.email !== "string") return null;
    return { sub: claims.sub, email: claims.email };
  } catch {
    return null;
  }
}

module.exports = {
  verificarIdToken,
  googleConfigurado,
  clientId,
  gerarTokenVinculo,
  lerTokenVinculo,
  GoogleTokenInvalidoError,
  GoogleEmailNaoVerificadoError,
  GoogleIndisponivelError,
};
