const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");
const { normalizarContato, dataValida } = require("../utils/validacao");

// Dados do usuário que podem ir para o navegador (nunca a senha)
function dadosPublicos(u) {
  return {
    id: u.id,
    nome: u.nome,
    sobrenome: u.sobrenome,
    contato: u.contato,
    nascimento: u.nascimento,
    genero: u.genero,
    avatar: u.avatar,
    nivel: u.nivel,
    desafios: u.desafios,
    conquistas: u.conquistas,
  };
}

function gerarToken(usuario, lembrar) {
  return jwt.sign({ id: usuario.id }, process.env.JWT_SECRET, {
    expiresIn: lembrar ? "30d" : "8h",
  });
}

async function cadastrar(req, res) {
  try {
    const { nome, sobrenome, contato, senha, nascimento, genero, avatar, lembrar } = req.body;

    const contatoNorm = normalizarContato(contato);
    if (String(nome || "").trim().length < 2) return res.status(400).json({ mensagem: "Informe seu nome." });
    if (String(sobrenome || "").trim().length < 2) return res.status(400).json({ mensagem: "Informe seu sobrenome." });
    if (!contatoNorm) return res.status(400).json({ mensagem: "Use um e-mail ou celular (com DDD) válido." });
    if (typeof senha !== "string" || senha.length < 6) return res.status(400).json({ mensagem: "A senha precisa ter ao menos 6 caracteres." });
    if (!dataValida(nascimento)) return res.status(400).json({ mensagem: "Data de nascimento inválida." });
    if (!["Feminino", "Masculino", "Outros"].includes(genero)) return res.status(400).json({ mensagem: "Selecione o gênero." });
    if (avatar && (typeof avatar !== "string" || !avatar.startsWith("data:image/") || avatar.length > 200000)) {
      return res.status(400).json({ mensagem: "Foto de perfil inválida." });
    }

    if (await Usuario.findOne({ where: { contato: contatoNorm } })) {
      return res.status(409).json({ mensagem: "Já existe uma conta com esse contato." });
    }

    const usuario = await Usuario.create({
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      contato: contatoNorm,
      senha: await bcrypt.hash(senha, 10),
      nascimento,
      genero,
      avatar: avatar || null,
    });

    res.status(201).json({ token: gerarToken(usuario, !!lembrar), usuario: dadosPublicos(usuario) });
  } catch (erro) {
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

// Redefinição de senha. Sem serviço de e-mail/SMS, a confirmação de identidade
// é feita com contato + data de nascimento. Troque por link enviado por e-mail em produção.
async function redefinirSenha(req, res) {
  try {
    const { contato, nascimento, novaSenha } = req.body;
    const falha = () => res.status(400).json({ mensagem: "Não foi possível redefinir: confira o contato e a data de nascimento." });

    if (typeof novaSenha !== "string" || novaSenha.length < 6) {
      return res.status(400).json({ mensagem: "A nova senha precisa ter ao menos 6 caracteres." });
    }
    const contatoNorm = normalizarContato(contato);
    if (!contatoNorm || !dataValida(nascimento)) return falha();

    const usuario = await Usuario.findOne({ where: { contato: contatoNorm } });
    if (!usuario || usuario.nascimento !== nascimento) return falha();

    usuario.senha = await bcrypt.hash(novaSenha, 10);
    await usuario.save();
    res.json({ mensagem: "Senha atualizada." });
  } catch (erro) {
    res.status(500).json({ mensagem: "Erro ao redefinir senha", erro: erro.message });
  }
}

module.exports = { cadastrar, me, redefinirSenha, dadosPublicos, gerarToken };
