const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const Usuario = require("../models/Usuario");
const logErro = require("../utils/logErro");
const { REABERTURA_HORAS, aplicarAcesso, condicaoMeusProjetos } = require("../services/projetoAcesso");

const LIMITE_PADRAO = 12;
const LIMITE_MAXIMO = 30;
const { AREAS, CATEGORIAS_LEGADAS, ETAPAS } = require("../utils/socialMetadata");
const CATEGORIAS = new Set([...AREAS, ...CATEGORIAS_LEGADAS]);

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
    return { erro: "O título deve ter entre 1 e 120 caracteres.", campo: "titulo" };
  }
  if (!descricao || descricao.length > 5000) {
    return { erro: "A descrição deve ter entre 1 e 5000 caracteres.", campo: "descricao" };
  }
  if (!CATEGORIAS.has(categoria)) {
    return { erro: "Selecione uma categoria válida.", campo: "categoria" };
  }
  if (!["publico", "privado"].includes(visibilidade)) {
    return { erro: "Selecione se o projeto será público ou privado.", campo: "visibilidade" };
  }
  if (!["individual", "equipe"].includes(tipo)) {
    return { erro: "Selecione se o projeto é individual ou de equipe.", campo: "tipo" };
  }
  const comoContribuir = body.como_contribuir == null ? null : body.como_contribuir;
  const etapa = body.etapa || null;
  const resumo = body.resumo == null ? null : body.resumo;
  if (comoContribuir !== null && (typeof comoContribuir !== 'string' || comoContribuir.length > 1500)) return { erro: 'Descreva como contribuir em até 1.500 caracteres.', campo: 'como_contribuir' };
  if (resumo !== null && (typeof resumo !== 'string' || resumo.length > 240)) return { erro: 'Escreva um resumo em até 240 caracteres.', campo: 'resumo' };
  if (etapa && !ETAPAS.includes(etapa)) return { erro: 'Selecione uma etapa válida.', campo: 'etapa' };
  try {
    return {
      dados: {
        titulo,
        descricao,
        como_contribuir: comoContribuir?.trim() || null,
        resumo: resumo?.trim() || null,
        etapa,
        categoria,
        visibilidade,
        tipo,
        imagem_url: validarUrl(body.imagem_url, "A imagem"),
        link_externo: validarUrl(body.link_externo, "O link do projeto"),
      },
    };
  } catch (erro) {
    return { erro: erro.message, campo: erro.message.includes("imagem") ? "imagem_url" : "link_externo" };
  }
}

const BASE_PROJETO = `
  SELECT p.id::text, p.titulo, p.descricao, p.imagem_url, p.categoria,
    to_jsonb(p)->>'como_contribuir' AS como_contribuir, to_jsonb(p)->>'etapa' AS etapa, to_jsonb(p)->>'resumo' AS resumo, p.link_externo, p.visibilidade, p.tipo, p.criado_em, p.atualizado_em,
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
        'origem', participacao.origem,
        'disponivel_em', participacao.atualizado_em + interval '${REABERTURA_HORAS} hours'
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
        AND (:categoria IS NULL OR p.categoria = :categoria
          OR (:categoria = 'Desenvolvimento de Sistemas' AND p.categoria = 'Programação')
          OR (:categoria = 'Design' AND p.categoria = 'Arte e design')
          OR (:categoria = 'Multimídia' AND p.categoria = 'Música')
          OR (:categoria = 'Jogos Digitais' AND p.categoria = 'Jogos'))
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
      WHERE ${condicaoMeusProjetos("p")}
        AND (:cursor IS NULL OR p.id < :cursor)
      ORDER BY p.id DESC
      LIMIT :limite
    `, {
      replacements: { usuarioId: req.usuario.id, cursor: page.cursor || null, limite: page.limite + 1 },
      type: QueryTypes.SELECT,
    });
    const temMais = registros.length > page.limite;
    const pagina = temMais ? registros.slice(0, page.limite) : registros;
    // O cursor vem da página bruta; a visão enviada ao navegador passa sempre pela regra central.
    const projetos = pagina.map(projeto => aplicarAcesso(projeto, req.usuario.id)).filter(Boolean);
    return res.json({
      projetos,
      proximoCursor: temMais ? String(pagina[pagina.length - 1].id) : null,
    });
  } catch (erro) {
    logErro("user_projects_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar seus projetos." });
  }
}

async function criar(req, res) {
  const validacao = validarProjeto(req.body);
  if (validacao.erro) return res.status(400).json({ mensagem: validacao.erro, campo: validacao.campo });
  try {
    const [projeto] = await sequelize.query(`
      INSERT INTO projetos (
        proprietario_id, titulo, descricao, imagem_url, categoria,
        link_externo, visibilidade, tipo, como_contribuir, etapa, resumo
      )
      VALUES (
        :usuarioId, :titulo, :descricao, :imagemUrl, :categoria,
        :linkExterno, :visibilidade, :tipo, :comoContribuir, :etapa, :resumo
      )
      RETURNING id::text, titulo, descricao, imagem_url, categoria,
        link_externo, visibilidade, tipo, como_contribuir, etapa, resumo, criado_em, atualizado_em
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
        comoContribuir: validacao.dados.como_contribuir,
        etapa: validacao.dados.etapa,
        resumo: validacao.dados.resumo,
      },
      type: QueryTypes.SELECT,
    });
    return res.status(201).json({ projeto });
  } catch (erro) {
    logErro("project_create_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível criar o projeto." });
  }
}

// Carrega o projeto sem decidir quem o vê: use aplicarAcesso() para obter a visão permitida.
async function carregarProjeto(id, usuarioId) {
  const [projeto] = await sequelize.query(`
    ${BASE_PROJETO}
    WHERE p.id = :projetoId
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
    const completo = await carregarProjeto(req.params.id, req.usuario.id);
    const projeto = aplicarAcesso(completo, req.usuario.id);
    if (!projeto) return res.status(404).json({ mensagem: "Projeto não encontrado." });
    if (projeto.acesso === "convite") {
      // Convite para projeto privado: só o necessário para aceitar ou recusar.
      return res.json({ projeto: { ...projeto, sou_proprietario: false, pode_atualizar: false } });
    }

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

    const souDono = projeto.acesso === "proprietario";
    const resultado = {
      ...projeto,
      sou_proprietario: souDono,
      pode_atualizar: souDono || projeto.acesso === "participante",
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
  if (validacao.erro) return res.status(400).json({ mensagem: validacao.erro, campo: validacao.campo });
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
    const replacements = {
      projetoId: req.params.id,
      usuarioId: req.usuario.id,
      titulo: validacao.dados.titulo,
      descricao: validacao.dados.descricao,
      imagemUrl: validacao.dados.imagem_url,
      categoria: validacao.dados.categoria,
      linkExterno: validacao.dados.link_externo,
      visibilidade: validacao.dados.visibilidade,
      tipo: validacao.dados.tipo,
      comoContribuir: validacao.dados.como_contribuir,
      etapa: validacao.dados.etapa,
      resumo: validacao.dados.resumo,
      temContribuicao: Object.hasOwn(req.body, 'como_contribuir'),
      temEtapa: Object.hasOwn(req.body, 'etapa'),
      temResumo: Object.hasOwn(req.body, 'resumo'),
    };
    // Política ao tornar um projeto público em privado (A01):
    //  - participantes aceitos e convites pendentes do proprietário continuam valendo;
    //  - solicitações pendentes de quem não faz parte da equipe são encerradas (privados não recebem
    //    solicitações), o que também as tira da listagem e dos detalhes de quem pediu.
    const resultado = await sequelize.transaction(async transaction => {
      const [atual] = await sequelize.query(
        "SELECT visibilidade FROM projetos WHERE id = :projetoId AND proprietario_id = :usuarioId FOR UPDATE",
        { replacements, type: QueryTypes.SELECT, transaction },
      );
      if (!atual) return null;
      const [projeto] = await sequelize.query(`
        UPDATE projetos
        SET titulo = :titulo, descricao = :descricao, imagem_url = :imagemUrl,
          categoria = :categoria, link_externo = :linkExterno,
          visibilidade = :visibilidade, tipo = :tipo,
          como_contribuir = CASE WHEN :temContribuicao THEN :comoContribuir ELSE como_contribuir END,
          etapa = CASE WHEN :temEtapa THEN :etapa ELSE etapa END,
          resumo = CASE WHEN :temResumo THEN :resumo ELSE resumo END
        WHERE id = :projetoId AND proprietario_id = :usuarioId
        RETURNING id::text, titulo, descricao, imagem_url, categoria,
          link_externo, visibilidade, tipo, como_contribuir, etapa, resumo, criado_em, atualizado_em
      `, { replacements, type: QueryTypes.SELECT, transaction });
      let encerradas = 0;
      if (atual.visibilidade === "publico" && validacao.dados.visibilidade === "privado") {
        const removidas = await sequelize.query(`
          DELETE FROM projeto_participantes
          WHERE projeto_id = :projetoId AND origem = 'solicitacao' AND status = 'pendente'
          RETURNING usuario_id::text
        `, { replacements, type: QueryTypes.SELECT, transaction });
        encerradas = removidas.length;
      }
      return { projeto, encerradas };
    });
    if (!resultado) return res.status(404).json({ mensagem: "Projeto não encontrado ou você não é o proprietário." });
    return res.json({
      projeto: resultado.projeto,
      solicitacoes_encerradas: resultado.encerradas,
      mensagem: resultado.encerradas
        ? "Projeto atualizado. As solicitações de participação pendentes foram encerradas porque o projeto agora é privado."
        : "Projeto atualizado.",
    });
  } catch (erro) {
    logErro("project_update_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível atualizar o projeto." });
  }
}

// Política de novas solicitações/convites (A11): só é possível reabrir uma participação RECUSADA, e apenas
// depois de REABERTURA_HORAS desde a recusa. Pendente e aceita continuam sem duplicar. Responde com o motivo exato.
async function responderParticipacaoBloqueada(res, projetoId, usuarioId, tipo) {
  const [atual] = await sequelize.query(`
    SELECT status, origem, atualizado_em,
      atualizado_em + make_interval(hours => :reaberturaHoras) AS disponivel_em
    FROM projeto_participantes
    WHERE projeto_id = :projetoId AND usuario_id = :usuarioId
  `, {
    replacements: { projetoId, usuarioId, reaberturaHoras: REABERTURA_HORAS },
    type: QueryTypes.SELECT,
  });
  const sujeito = tipo === "convite" ? "este usuário" : "você";
  if (atual?.status === "aceito") {
    return res.status(409).json({ codigo: "ja_participa", mensagem: tipo === "convite" ? "Este usuário já participa do projeto." : "Você já participa deste projeto." });
  }
  if (atual?.status === "pendente") {
    return res.status(409).json({
      codigo: "participacao_pendente",
      mensagem: atual.origem === "convite"
        ? (tipo === "convite" ? "Já existe um convite pendente para este usuário." : "Você já recebeu um convite para este projeto. Responda em Meus projetos.")
        : (tipo === "convite" ? "Este usuário já pediu para participar. Responda à solicitação na página do projeto." : "Você já enviou uma solicitação para este projeto."),
    });
  }
  if (atual?.status === "recusado") {
    return res.status(409).json({
      codigo: "reabertura_indisponivel",
      disponivel_em: atual.disponivel_em,
      mensagem: `Uma nova tentativa só poderá ser feita ${REABERTURA_HORAS} horas após a recusa. Tente novamente mais tarde.`,
    });
  }
  return res.status(409).json({ codigo: "participacao_indisponivel", mensagem: `Não foi possível registrar a participação de ${sujeito}.` });
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
    const projeto = await carregarProjeto(req.params.id, req.usuario.id);
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
        AND projeto_participantes.atualizado_em <= now() - make_interval(hours => :reaberturaHoras)
      RETURNING usuario_id::text, origem, status, criado_em
    `, {
      replacements: { projetoId: req.params.id, usuarioId: usuario.id, reaberturaHoras: REABERTURA_HORAS },
      type: QueryTypes.SELECT,
    });
    if (!convite) return responderParticipacaoBloqueada(res, req.params.id, usuario.id, "convite");
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
        AND projeto_participantes.atualizado_em <= now() - make_interval(hours => :reaberturaHoras)
      RETURNING usuario_id::text, origem, status, criado_em
    `, {
      replacements: { projetoId: req.params.id, usuarioId: req.usuario.id, reaberturaHoras: REABERTURA_HORAS },
      type: QueryTypes.SELECT,
    });
    if (!solicitacao) return responderParticipacaoBloqueada(res, req.params.id, req.usuario.id, "solicitacao");
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
