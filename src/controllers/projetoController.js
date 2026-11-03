const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const Usuario = require("../models/Usuario");
const logErro = require("../utils/logErro");

const LIMITE_PADRAO = 12;
const LIMITE_MAXIMO = 30;
const CATEGORIAS = new Set([
  "Jogos",
  "Arte e design",
  "Programação",
  "Educação",
  "Música",
  "Outros",
]);

function validarId(value) {
  return typeof value === "string" && /^\d{1,18}$/.test(value) && BigInt(value) > 0n;
}

function paginacao(req, res) {
  const limite = req.query.limite === undefined ? LIMITE_PADRAO : Number(req.query.limite);
  if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
    res.status(400).json({ mensagem: `O limite deve estar entre 1 e ${LIMITE_MAXIMO}.` });
    return null;
  }
  const cursor = req.query.cursor;
  if (cursor !== undefined && !validarId(cursor)) {
    res.status(400).json({ mensagem: "Cursor de paginação inválido." });
    return null;
  }
  return { limite, cursor };
}

function validarUrl(value, label, required = false) {
  if (value === null || value === undefined || value === "") {
    if (required) throw new Error(`${label} é obrigatório.`);
    return null;
  }
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error(`${label} deve ser uma URL HTTPS válida.`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} deve ser uma URL HTTPS válida.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${label} deve ser uma URL HTTPS válida.`);
  }
  return url.href;
}

function validarProjeto(body) {
  const titulo = typeof body?.titulo === "string" ? body.titulo.trim() : "";
  const descricao = typeof body?.descricao === "string" ? body.descricao.trim() : "";
  const categoria = typeof body?.categoria === "string" ? body.categoria.trim() : "";
  const visibilidade = body?.visibilidade;
  const tipo = body?.tipo;
  if (!titulo || titulo.length > 120) {
    return { erro: "O título deve ter entre 1 e 120 caracteres." };
  }
  if (!descricao || descricao.length > 5000) {
    return { erro: "A descrição deve ter entre 1 e 5000 caracteres." };
  }
  if (!CATEGORIAS.has(categoria)) {
    return { erro: "Selecione uma categoria válida." };
  }
  if (!["publico", "privado"].includes(visibilidade)) {
    return { erro: "Selecione se o projeto será público ou privado." };
  }
  if (!["individual", "equipe"].includes(tipo)) {
    return { erro: "Selecione se o projeto é individual ou de equipe." };
  }
  try {
    return {
      dados: {
        titulo,
        descricao,
        categoria,
        visibilidade,
        tipo,
        imagem_url: validarUrl(body.imagem_url, "A imagem"),
        link_externo: validarUrl(body.link_externo, "O link do projeto"),
      },
    };
  } catch (erro) {
    return { erro: erro.message };
  }
}

function condicaoVisibilidade(alias = "p") {
  return `(
    ${alias}.visibilidade = 'publico'
    OR ${alias}.proprietario_id = :usuarioId
    OR EXISTS (
      SELECT 1
      FROM projeto_participantes acesso
      WHERE acesso.projeto_id = ${alias}.id
        AND acesso.usuario_id = :usuarioId
        AND acesso.status = 'aceito'
    )
  )`;
}

const BASE_PROJETO = `
  SELECT p.id::text, p.titulo, p.descricao, p.imagem_url, p.categoria,
    p.link_externo, p.visibilidade, p.tipo, p.criado_em, p.atualizado_em,
    p.proprietario_id::text,
    json_build_object(
      'id', dono.id::text,
      'nome_usuario', dono.nome_usuario,
      'nome_exibicao', dono.nome_exibicao,
      'avatar_url', CASE WHEN dono.perfil_publico THEN dono.avatar_url ELSE NULL END
    ) AS proprietario,
    (
      SELECT COUNT(*)::integer
      FROM projeto_participantes integrante
      WHERE integrante.projeto_id = p.id AND integrante.status = 'aceito'
    ) + 1 AS total_participantes,
    (
      SELECT json_build_object(
        'status', participacao.status,
        'origem', participacao.origem
      )
      FROM projeto_participantes participacao
      WHERE participacao.projeto_id = p.id AND participacao.usuario_id = :usuarioId
    ) AS participacao
  FROM projetos p
  JOIN usuarios dono ON dono.id = p.proprietario_id
`;

async function explorar(req, res) {
  const page = paginacao(req, res);
  if (!page) return;
  const busca = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const categoria = typeof req.query.categoria === "string" && CATEGORIAS.has(req.query.categoria)
    ? req.query.categoria
    : null;
  const proprietarioId = req.query.usuario === undefined ? null : req.query.usuario;
  if (proprietarioId !== null && !validarId(proprietarioId)) {
    return res.status(400).json({ mensagem: "Identificador de usuário inválido." });
  }
  try {
    const registros = await sequelize.query(`
      ${BASE_PROJETO}
      WHERE p.visibilidade = 'publico'
        AND (:cursor IS NULL OR p.id < :cursor)
        AND (:categoria IS NULL OR p.categoria = :categoria)
        AND (:proprietarioId IS NULL OR p.proprietario_id = :proprietarioId)
        AND (:busca = '' OR p.titulo ILIKE :termo OR p.descricao ILIKE :termo)
      ORDER BY p.id DESC
      LIMIT :limite
    `, {
      replacements: {
        usuarioId: req.usuario.id,
        cursor: page.cursor || null,
        categoria,
        proprietarioId,
        busca,
        termo: `%${busca}%`,
        limite: page.limite + 1,
      },
      type: QueryTypes.SELECT,
    });
    const temMais = registros.length > page.limite;
    const projetos = temMais ? registros.slice(0, page.limite) : registros;
    return res.json({
      projetos,
      proximoCursor: temMais ? String(projetos[projetos.length - 1].id) : null,
    });
  } catch (erro) {
    logErro("project_explore_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar os projetos." });
  }
}

async function meusProjetos(req, res) {
  const page = paginacao(req, res);
  if (!page) return;
  try {
    const registros = await sequelize.query(`
      ${BASE_PROJETO}
      WHERE (
        p.proprietario_id = :usuarioId
        OR EXISTS (
          SELECT 1 FROM projeto_participantes membro
          WHERE membro.projeto_id = p.id
            AND membro.usuario_id = :usuarioId
            AND membro.status IN ('aceito','pendente')
        )
      )
        AND (:cursor IS NULL OR p.id < :cursor)
      ORDER BY p.id DESC
      LIMIT :limite
    `, {
      replacements: { usuarioId: req.usuario.id, cursor: page.cursor || null, limite: page.limite + 1 },
      type: QueryTypes.SELECT,
    });
    const temMais = registros.length > page.limite;
    const projetos = temMais ? registros.slice(0, page.limite) : registros;
    return res.json({
      projetos,
      proximoCursor: temMais ? String(projetos[projetos.length - 1].id) : null,
    });
  } catch (erro) {
    logErro("user_projects_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar seus projetos." });
  }
}

async function criar(req, res) {
  const validacao = validarProjeto(req.body);
  if (validacao.erro) return res.status(400).json({ mensagem: validacao.erro });
  try {
    const [projeto] = await sequelize.query(`
      INSERT INTO projetos (
        proprietario_id, titulo, descricao, imagem_url, categoria,
        link_externo, visibilidade, tipo
      )
      VALUES (
        :usuarioId, :titulo, :descricao, :imagemUrl, :categoria,
        :linkExterno, :visibilidade, :tipo
      )
      RETURNING id::text, titulo, descricao, imagem_url, categoria,
        link_externo, visibilidade, tipo, criado_em, atualizado_em
    `, {
      replacements: {
        usuarioId: req.usuario.id,
        titulo: validacao.dados.titulo,
        descricao: validacao.dados.descricao,
        imagemUrl: validacao.dados.imagem_url,
        categoria: validacao.dados.categoria,
        linkExterno: validacao.dados.link_externo,
        visibilidade: validacao.dados.visibilidade,
        tipo: validacao.dados.tipo,
      },
      type: QueryTypes.SELECT,
    });
    return res.status(201).json({ projeto });
  } catch (erro) {
    logErro("project_create_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível criar o projeto." });
  }
}

async function carregarProjeto(id, usuarioId, { lockOwner = false } = {}) {
  const [projeto] = await sequelize.query(`
    ${BASE_PROJETO}
    WHERE p.id = :projetoId
      ${lockOwner ? "" : `AND ${condicaoVisibilidade("p")}`}
  `, {
    replacements: { projetoId: id, usuarioId },
    type: QueryTypes.SELECT,
  });
  return projeto || null;
}

async function obter(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de projeto inválido." });
  }
  try {
    const projeto = await carregarProjeto(req.params.id, req.usuario.id);
    if (!projeto) return res.status(404).json({ mensagem: "Projeto não encontrado." });

    const participantes = await sequelize.query(`
      SELECT u.id::text, u.nome_usuario, u.nome_exibicao,
        CASE WHEN u.perfil_publico THEN u.avatar_url ELSE NULL END AS avatar_url,
        pp.criado_em AS participante_desde
      FROM projeto_participantes pp
      JOIN usuarios u ON u.id = pp.usuario_id
      WHERE pp.projeto_id = :projetoId AND pp.status = 'aceito'
      ORDER BY pp.criado_em, u.nome_usuario
    `, {
      replacements: { projetoId: req.params.id },
      type: QueryTypes.SELECT,
    });
    const atualizacoes = await sequelize.query(`
      SELECT a.id::text, a.texto, a.criado_em,
        json_build_object(
          'id', u.id::text,
          'nome_usuario', u.nome_usuario,
          'nome_exibicao', u.nome_exibicao,
          'avatar_url', CASE WHEN u.perfil_publico THEN u.avatar_url ELSE NULL END
        ) AS autor
      FROM projeto_atualizacoes a
      JOIN usuarios u ON u.id = a.autor_id
      WHERE a.projeto_id = :projetoId
      ORDER BY a.id DESC
      LIMIT 20
    `, {
      replacements: { projetoId: req.params.id },
      type: QueryTypes.SELECT,
    });

    const souDono = String(projeto.proprietario_id) === String(req.usuario.id);
    const resultado = {
      ...projeto,
      sou_proprietario: souDono,
      pode_atualizar: souDono || projeto.participacao?.status === "aceito",
      participantes: [projeto.proprietario, ...participantes],
      atualizacoes,
    };
    if (souDono) {
      resultado.solicitacoes = await sequelize.query(`
        SELECT pp.usuario_id::text, pp.origem, pp.status, pp.criado_em,
          json_build_object(
            'id', u.id::text,
            'nome_usuario', u.nome_usuario,
            'nome_exibicao', u.nome_exibicao,
            'avatar_url', CASE WHEN u.perfil_publico THEN u.avatar_url ELSE NULL END
          ) AS usuario
        FROM projeto_participantes pp
        JOIN usuarios u ON u.id = pp.usuario_id
        WHERE pp.projeto_id = :projetoId AND pp.status = 'pendente'
        ORDER BY pp.criado_em
      `, {
        replacements: { projetoId: req.params.id },
        type: QueryTypes.SELECT,
      });
    }
    return res.json({ projeto: resultado });
  } catch (erro) {
    logErro("project_load_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar o projeto." });
  }
}

async function atualizar(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de projeto inválido." });
  }
  const validacao = validarProjeto(req.body);
  if (validacao.erro) return res.status(400).json({ mensagem: validacao.erro });
  try {
    if (validacao.dados.tipo === "individual") {
      const [integrantes] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1
          FROM projeto_participantes
          WHERE projeto_id = :projetoId
            AND status IN ('aceito', 'pendente')
            AND EXISTS (
              SELECT 1
              FROM projetos
              WHERE id = :projetoId AND proprietario_id = :usuarioId
            )
        ) AS possui_integrantes
      `, {
        replacements: { projetoId: req.params.id, usuarioId: req.usuario.id },
        type: QueryTypes.SELECT,
      });
      if (integrantes?.possui_integrantes) {
        return res.status(409).json({
          mensagem: "Remova ou resolva os convites e participações antes de tornar o projeto individual.",
        });
      }
    }
    const [projeto] = await sequelize.query(`
      UPDATE projetos
      SET titulo = :titulo, descricao = :descricao, imagem_url = :imagemUrl,
        categoria = :categoria, link_externo = :linkExterno,
        visibilidade = :visibilidade, tipo = :tipo
      WHERE id = :projetoId AND proprietario_id = :usuarioId
      RETURNING id::text, titulo, descricao, imagem_url, categoria,
        link_externo, visibilidade, tipo, criado_em, atualizado_em
    `, {
      replacements: {
        projetoId: req.params.id,
        usuarioId: req.usuario.id,
        titulo: validacao.dados.titulo,
        descricao: validacao.dados.descricao,
        imagemUrl: validacao.dados.imagem_url,
        categoria: validacao.dados.categoria,
        linkExterno: validacao.dados.link_externo,
        visibilidade: validacao.dados.visibilidade,
        tipo: validacao.dados.tipo,
      },
      type: QueryTypes.SELECT,
    });
    if (!projeto) return res.status(404).json({ mensagem: "Projeto não encontrado ou você não é o proprietário." });
    return res.json({ projeto, mensagem: "Projeto atualizado." });
  } catch (erro) {
    logErro("project_update_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível atualizar o projeto." });
  }
}

async function convidar(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de projeto inválido." });
  }
  const nomeUsuario = typeof req.body?.nome_usuario === "string"
    ? req.body.nome_usuario.trim().replace(/^@/, "").toLowerCase()
    : "";
  if (!/^[a-z0-9_]{3,30}$/.test(nomeUsuario)) {
    return res.status(400).json({ mensagem: "Informe um nome de usuário válido." });
  }
  try {
    const projeto = await carregarProjeto(req.params.id, req.usuario.id, { lockOwner: true });
    if (!projeto || String(projeto.proprietario_id) !== String(req.usuario.id)) {
      return res.status(404).json({ mensagem: "Projeto não encontrado ou você não é o proprietário." });
    }
    if (projeto.tipo !== "equipe") {
      return res.status(409).json({ mensagem: "Projetos individuais não aceitam participantes." });
    }
    const usuario = await Usuario.findOne({
      where: sequelize.where(sequelize.fn("lower", sequelize.col("nome_usuario")), nomeUsuario),
      attributes: ["id"],
    });
    if (!usuario) return res.status(404).json({ mensagem: "Usuário não encontrado." });
    if (String(usuario.id) === String(req.usuario.id)) {
      return res.status(400).json({ mensagem: "Você já é o proprietário do projeto." });
    }
    const [convite] = await sequelize.query(`
      INSERT INTO projeto_participantes (projeto_id, usuario_id, origem, status)
      VALUES (:projetoId, :usuarioId, 'convite', 'pendente')
      ON CONFLICT (projeto_id, usuario_id)
      DO UPDATE SET origem = 'convite', status = 'pendente', atualizado_em = now()
      WHERE projeto_participantes.status = 'recusado'
      RETURNING usuario_id::text, origem, status, criado_em
    `, {
      replacements: { projetoId: req.params.id, usuarioId: usuario.id },
      type: QueryTypes.SELECT,
    });
    if (!convite) return res.status(409).json({ mensagem: "Já existe um convite, solicitação ou participação para este usuário." });
    return res.status(201).json({ convite });
  } catch (erro) {
    logErro("project_invitation_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível enviar o convite." });
  }
}

async function solicitarParticipacao(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de projeto inválido." });
  }
  try {
    const [projeto] = await sequelize.query(
      "SELECT id, proprietario_id, tipo, visibilidade FROM projetos WHERE id = :id",
      { replacements: { id: req.params.id }, type: QueryTypes.SELECT },
    );
    if (!projeto) return res.status(404).json({ mensagem: "Projeto não encontrado." });
    if (String(projeto.proprietario_id) === String(req.usuario.id)) {
      return res.status(409).json({ mensagem: "Você já é o proprietário deste projeto." });
    }
    if (projeto.visibilidade !== "publico" || projeto.tipo !== "equipe") {
      return res.status(409).json({ mensagem: "Solicitações estão disponíveis apenas para projetos públicos de equipe." });
    }
    const [solicitacao] = await sequelize.query(`
      INSERT INTO projeto_participantes (projeto_id, usuario_id, origem, status)
      VALUES (:projetoId, :usuarioId, 'solicitacao', 'pendente')
      ON CONFLICT (projeto_id, usuario_id)
      DO UPDATE SET origem = 'solicitacao', status = 'pendente', atualizado_em = now()
      WHERE projeto_participantes.status = 'recusado'
      RETURNING usuario_id::text, origem, status, criado_em
    `, {
      replacements: { projetoId: req.params.id, usuarioId: req.usuario.id },
      type: QueryTypes.SELECT,
    });
    if (!solicitacao) return res.status(409).json({ mensagem: "Já existe uma solicitação, convite ou participação para este projeto." });
    return res.status(201).json({ solicitacao });
  } catch (erro) {
    logErro("project_join_request_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível solicitar participação." });
  }
}

async function responderParticipacao(req, res) {
  if (!validarId(req.params.id) || !validarId(req.params.usuarioId)) {
    return res.status(400).json({ mensagem: "Identificador de projeto ou usuário inválido." });
  }
  const acao = req.body?.acao;
  if (!["aceitar", "recusar"].includes(acao)) {
    return res.status(400).json({ mensagem: "A ação deve ser aceitar ou recusar." });
  }
  try {
    const [resultado] = await sequelize.query(`
      UPDATE projeto_participantes pp
      SET status = :status, atualizado_em = now()
      FROM projetos p
      WHERE pp.projeto_id = p.id
        AND pp.projeto_id = :projetoId
        AND pp.usuario_id = :usuarioId
        AND pp.status = 'pendente'
        AND (
          (pp.origem = 'convite' AND pp.usuario_id = :atorId AND p.tipo = 'equipe')
          OR (
            pp.origem = 'solicitacao'
            AND p.proprietario_id = :atorId
            AND p.tipo = 'equipe'
            AND (p.visibilidade = 'publico' OR :acao = 'recusar')
          )
        )
      RETURNING pp.usuario_id::text, pp.origem, pp.status
    `, {
      replacements: {
        status: acao === "aceitar" ? "aceito" : "recusado",
        projetoId: req.params.id,
        usuarioId: req.params.usuarioId,
        atorId: req.usuario.id,
        acao,
      },
      type: QueryTypes.SELECT,
    });
    if (!resultado) {
      return res.status(404).json({ mensagem: "Convite ou solicitação pendente não encontrado." });
    }
    return res.json({ participacao: resultado });
  } catch (erro) {
    logErro("project_participation_response_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível atualizar a participação." });
  }
}

async function removerParticipante(req, res) {
  if (!validarId(req.params.id) || !validarId(req.params.usuarioId)) {
    return res.status(400).json({ mensagem: "Identificador de projeto ou usuário inválido." });
  }
  try {
    const [removido] = await sequelize.query(`
      DELETE FROM projeto_participantes pp
      USING projetos p
      WHERE pp.projeto_id = p.id
        AND pp.projeto_id = :projetoId
        AND pp.usuario_id = :usuarioId
        AND (
          (:atorId = pp.usuario_id AND pp.status IN ('aceito','pendente'))
          OR (:atorId = p.proprietario_id AND pp.usuario_id <> p.proprietario_id)
        )
      RETURNING pp.usuario_id::text
    `, {
      replacements: {
        projetoId: req.params.id,
        usuarioId: req.params.usuarioId,
        atorId: req.usuario.id,
      },
      type: QueryTypes.SELECT,
    });
    if (!removido) return res.status(404).json({ mensagem: "Participação não encontrada ou ação não permitida." });
    return res.json({ mensagem: "Participação removida." });
  } catch (erro) {
    logErro("project_participant_remove_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível remover a participação." });
  }
}

async function criarAtualizacao(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de projeto inválido." });
  }
  const texto = typeof req.body?.texto === "string" ? req.body.texto.trim() : "";
  if (!texto || texto.length > 2000) {
    return res.status(400).json({ mensagem: "A atualização deve ter entre 1 e 2000 caracteres." });
  }
  try {
    const [atualizacao] = await sequelize.query(`
      INSERT INTO projeto_atualizacoes (projeto_id, autor_id, texto)
      SELECT p.id, :usuarioId, :texto
      FROM projetos p
      WHERE p.id = :projetoId
        AND (
          p.proprietario_id = :usuarioId
          OR EXISTS (
            SELECT 1 FROM projeto_participantes pp
            WHERE pp.projeto_id = p.id
              AND pp.usuario_id = :usuarioId
              AND pp.status = 'aceito'
          )
        )
      RETURNING id::text, texto, criado_em
    `, {
      replacements: {
        projetoId: req.params.id,
        usuarioId: req.usuario.id,
        texto,
      },
      type: QueryTypes.SELECT,
    });
    if (!atualizacao) return res.status(404).json({ mensagem: "Projeto não encontrado ou você não participa da equipe." });
    const [autor] = await sequelize.query(`
      SELECT id::text, nome_usuario, nome_exibicao,
        CASE WHEN perfil_publico THEN avatar_url ELSE NULL END AS avatar_url
      FROM usuarios WHERE id = :usuarioId
    `, {
      replacements: { usuarioId: req.usuario.id },
      type: QueryTypes.SELECT,
    });
    return res.status(201).json({ atualizacao: { ...atualizacao, autor } });
  } catch (erro) {
    logErro("project_update_post_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível publicar a atualização." });
  }
}

module.exports = {
  explorar,
  meusProjetos,
  criar,
  obter,
  atualizar,
  convidar,
  solicitarParticipacao,
  responderParticipacao,
  removerParticipante,
  criarAtualizacao,
};
