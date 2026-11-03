const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const Usuario = require("../models/Usuario");
const logErro = require("../utils/logErro");

const CAMPOS_PRIVACIDADE = [
  "mostrar_biografia",
  "mostrar_pontos",
  "mostrar_amigos",
  "mostrar_conquistas",
  "mostrar_progresso",
];

function validarId(value) {
  return typeof value === "string" && /^\d{1,18}$/.test(value) && BigInt(value) > 0n;
}

function validarUrlImagem(value, nome) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) {
    throw new Error(`${nome} deve ser uma URL HTTPS válida.`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${nome} deve ser uma URL HTTPS válida.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${nome} deve ser uma URL HTTPS válida.`);
  }
  return url.href;
}

async function obterAmizade(usuarioId, outroId) {
  if (String(usuarioId) === String(outroId)) return { status: "proprio" };
  const [relacao] = await sequelize.query(`
    SELECT solicitante_id, destinatario_id, status
    FROM amizades
    WHERE LEAST(solicitante_id, destinatario_id) = LEAST(CAST(:usuarioId AS bigint), CAST(:outroId AS bigint))
      AND GREATEST(solicitante_id, destinatario_id) = GREATEST(CAST(:usuarioId AS bigint), CAST(:outroId AS bigint))
  `, {
    replacements: { usuarioId, outroId },
    type: QueryTypes.SELECT,
  });
  if (!relacao) return { status: "nenhuma" };
  if (relacao.status === "aceita") return { status: "amigos" };
  return {
    status: String(relacao.solicitante_id) === String(usuarioId) ? "enviada" : "recebida",
  };
}

async function lerPerfil(usuarioId, viewerId, proprio) {
  const [usuario] = await sequelize.query(`
    SELECT id, nome_usuario, nome_exibicao, biografia, avatar_url, capa_url,
      email, pontos, criado_em, perfil_publico, mostrar_biografia,
      mostrar_pontos, mostrar_amigos, mostrar_conquistas, mostrar_progresso
    FROM usuarios
    WHERE id = :usuarioId
  `, {
    replacements: { usuarioId },
    type: QueryTypes.SELECT,
  });
  if (!usuario) return null;

  const amizade = await obterAmizade(viewerId, usuarioId);
  const privado = !proprio && !usuario.perfil_publico && amizade.status !== "amigos";
  const perfil = {
    id: String(usuario.id),
    nome_usuario: usuario.nome_usuario,
    nome_exibicao: usuario.nome_exibicao,
    avatar_url: usuario.avatar_url,
    capa_url: usuario.capa_url,
    criado_em: usuario.criado_em,
    privado,
    amizade,
  };

  if (privado) {
    perfil.avatar_url = null;
    perfil.capa_url = null;
    perfil.criado_em = null;
    perfil.biografia = null;
    perfil.estatisticas = null;
    perfil.conquistas = null;
    return perfil;
  }

  const [contagemAmigos] = await sequelize.query(`
    SELECT COUNT(*)::integer AS total
    FROM amizades
    WHERE status = 'aceita'
      AND (solicitante_id = :usuarioId OR destinatario_id = :usuarioId)
  `, {
    replacements: { usuarioId },
    type: QueryTypes.SELECT,
  });
  const [progresso] = await sequelize.query(`
    SELECT
      COUNT(*) FILTER (WHERE pu.status = 'concluida')::integer AS concluidas,
      COUNT(*) FILTER (WHERE pu.status = 'em_andamento')::integer AS em_andamento,
      COUNT(DISTINCT a.id)::integer AS total
    FROM atividades a
    LEFT JOIN progresso_usuario pu
      ON pu.atividade_id = a.id AND pu.usuario_id = :usuarioId
  `, {
    replacements: { usuarioId },
    type: QueryTypes.SELECT,
  });
  const historico = usuario.mostrar_progresso || proprio
    ? await sequelize.query(`
      SELECT a.id::text AS atividade_id, a.titulo, a.tipo, t.titulo AS trilha,
        pu.pontuacao, pu.concluida_em
      FROM progresso_usuario pu
      JOIN atividades a ON a.id = pu.atividade_id
      LEFT JOIN trilhas t ON t.id = a.trilha_id
      WHERE pu.usuario_id = :usuarioId
        AND pu.status = 'concluida'
        AND pu.concluida_em IS NOT NULL
      ORDER BY pu.concluida_em DESC, a.id DESC
      LIMIT 20
    `, {
      replacements: { usuarioId },
      type: QueryTypes.SELECT,
    })
    : null;
  const evolucao = usuario.mostrar_progresso || proprio
    ? await sequelize.query(`
      SELECT to_char(date_trunc('month', pu.concluida_em), 'YYYY-MM') AS mes,
        COUNT(*)::integer AS atividades_concluidas,
        COALESCE(SUM(pu.pontuacao), 0)::integer AS pontos_registrados
      FROM progresso_usuario pu
      WHERE pu.usuario_id = :usuarioId
        AND pu.status = 'concluida'
        AND pu.concluida_em >= date_trunc('month', now()) - interval '5 months'
        AND pu.concluida_em <= now()
      GROUP BY date_trunc('month', pu.concluida_em)
      ORDER BY date_trunc('month', pu.concluida_em)
    `, {
      replacements: { usuarioId },
      type: QueryTypes.SELECT,
    })
    : null;
  const desempenho = usuario.mostrar_progresso || proprio
    ? await sequelize.query(`
      SELECT a.tipo,
        COUNT(*) FILTER (WHERE pu.status = 'concluida')::integer AS concluidas,
        COUNT(*) FILTER (WHERE pu.status = 'em_andamento')::integer AS em_andamento,
        COALESCE(SUM(pu.pontuacao) FILTER (WHERE pu.status = 'concluida'), 0)::integer AS pontos_registrados
      FROM progresso_usuario pu
      JOIN atividades a ON a.id = pu.atividade_id
      WHERE pu.usuario_id = :usuarioId
      GROUP BY a.tipo
      ORDER BY CASE a.tipo WHEN 'missao' THEN 1 WHEN 'desafio' THEN 2 ELSE 3 END
    `, {
      replacements: { usuarioId },
      type: QueryTypes.SELECT,
    })
    : null;
  const conquistas = usuario.mostrar_conquistas || proprio
    ? await sequelize.query(`
      SELECT c.id::text, c.titulo, c.descricao, c.icone, uc.obtida_em
      FROM usuario_conquistas uc
      JOIN conquistas c ON c.id = uc.conquista_id
      WHERE uc.usuario_id = :usuarioId
      ORDER BY uc.obtida_em DESC, c.id DESC
      LIMIT 24
    `, {
      replacements: { usuarioId },
      type: QueryTypes.SELECT,
    })
    : null;
  const [totalConquistas] = usuario.mostrar_conquistas || proprio
    ? await sequelize.query(`
      SELECT COUNT(*)::integer AS total
      FROM usuario_conquistas
      WHERE usuario_id = :usuarioId
    `, {
      replacements: { usuarioId },
      type: QueryTypes.SELECT,
    })
    : [{ total: null }];

  const mostrar = campo => proprio || usuario[campo];
  if (proprio) perfil.email = usuario.email;
  perfil.biografia = mostrar("mostrar_biografia") ? usuario.biografia : null;
  perfil.privacidade = proprio
    ? {
      perfil_publico: usuario.perfil_publico,
      mostrar_biografia: usuario.mostrar_biografia,
      mostrar_pontos: usuario.mostrar_pontos,
      mostrar_amigos: usuario.mostrar_amigos,
      mostrar_conquistas: usuario.mostrar_conquistas,
      mostrar_progresso: usuario.mostrar_progresso,
    }
    : undefined;
  perfil.estatisticas = {
    pontos: mostrar("mostrar_pontos") ? Number(usuario.pontos) : null,
    amigos: mostrar("mostrar_amigos") ? Number(contagemAmigos.total) : null,
    conquistas: mostrar("mostrar_conquistas") ? Number(totalConquistas.total) : null,
    progresso: mostrar("mostrar_progresso")
      ? {
        concluidas: Number(progresso.concluidas),
        em_andamento: Number(progresso.em_andamento),
        total: Number(progresso.total),
        percentual: progresso.total
          ? Math.round((Number(progresso.concluidas) / Number(progresso.total)) * 100)
          : 0,
        historico,
        evolucao,
        desempenho,
      }
      : null,
  };
  perfil.conquistas = conquistas;
  return perfil;
}

async function meuPerfil(req, res) {
  try {
    const perfil = await lerPerfil(req.usuario.id, req.usuario.id, true);
    if (!perfil) return res.status(404).json({ mensagem: "Perfil não encontrado." });
    return res.json({ usuario: perfil });
  } catch (erro) {
    logErro("profile_load_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar o perfil." });
  }
}

async function perfilPublico(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de usuário inválido." });
  }
  try {
    const perfil = await lerPerfil(req.params.id, req.usuario.id, false);
    if (!perfil) return res.status(404).json({ mensagem: "Perfil não encontrado." });
    return res.json({ usuario: perfil });
  } catch (erro) {
    logErro("public_profile_load_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar o perfil." });
  }
}

async function atualizarMeuPerfil(req, res) {
  const corpo = req.body || {};
  const nomeExibicao = typeof corpo.nome_exibicao === "string" ? corpo.nome_exibicao.trim() : "";
  const nomeUsuario = typeof corpo.nome_usuario === "string" ? corpo.nome_usuario.trim().toLowerCase() : "";
  const biografia = typeof corpo.biografia === "string" ? corpo.biografia.trim() : null;

  if (nomeExibicao.length < 1 || nomeExibicao.length > 100) {
    return res.status(400).json({ mensagem: "O nome deve ter entre 1 e 100 caracteres." });
  }
  if (!/^[a-z0-9_]{3,30}$/.test(nomeUsuario)) {
    return res.status(400).json({ mensagem: "O nome de usuário deve ter de 3 a 30 caracteres: letras, números ou _." });
  }
  if (biografia === null || biografia.length > 500) {
    return res.status(400).json({ mensagem: "A biografia deve ter até 500 caracteres." });
  }

  const privacidade = corpo.privacidade;
  if (!privacidade || typeof privacidade !== "object"
    || typeof privacidade.perfil_publico !== "boolean"
    || CAMPOS_PRIVACIDADE.some(campo => typeof privacidade[campo] !== "boolean")) {
    return res.status(400).json({ mensagem: "Selecione as opções de privacidade do perfil." });
  }

  let avatarUrl;
  let capaUrl;
  try {
    avatarUrl = validarUrlImagem(corpo.avatar_url, "A foto de perfil");
    capaUrl = validarUrlImagem(corpo.capa_url, "A imagem de capa");
  } catch (erro) {
    return res.status(400).json({ mensagem: erro.message });
  }

  try {
    const duplicado = await Usuario.findOne({
      where: sequelize.where(sequelize.fn("lower", sequelize.col("nome_usuario")), nomeUsuario),
    });
    if (duplicado && String(duplicado.id) !== String(req.usuario.id)) {
      return res.status(409).json({ mensagem: "Esse nome de usuário já está em uso." });
    }

    const usuario = await Usuario.findByPk(req.usuario.id);
    if (!usuario) return res.status(404).json({ mensagem: "Perfil não encontrado." });
    await usuario.update({
      nome_exibicao: nomeExibicao,
      nome_usuario: nomeUsuario,
      biografia,
      avatar_url: avatarUrl,
      capa_url: capaUrl,
      perfil_publico: privacidade.perfil_publico,
      ...Object.fromEntries(CAMPOS_PRIVACIDADE.map(campo => [campo, privacidade[campo]])),
    });

    const perfil = await lerPerfil(req.usuario.id, req.usuario.id, true);
    return res.json({ usuario: perfil, mensagem: "Perfil atualizado." });
  } catch (erro) {
    if (erro.name === "SequelizeUniqueConstraintError" || erro.code === "23505") {
      return res.status(409).json({ mensagem: "Esse nome de usuário já está em uso." });
    }
    logErro("profile_update_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível salvar o perfil." });
  }
}

async function solicitarAmizade(req, res) {
  const outroId = req.params.id;
  if (!validarId(outroId)) {
    return res.status(400).json({ mensagem: "Identificador de usuário inválido." });
  }
  if (String(outroId) === String(req.usuario.id)) {
    return res.status(400).json({ mensagem: "Não é possível adicionar a si mesmo." });
  }
  try {
    const existe = await Usuario.findByPk(outroId, { attributes: ["id"] });
    if (!existe) return res.status(404).json({ mensagem: "Usuário não encontrado." });

    const amizade = await obterAmizade(req.usuario.id, outroId);
    if (amizade.status === "amigos") {
      return res.status(409).json({ mensagem: "Vocês já são amigos." });
    }
    if (amizade.status === "enviada") {
      return res.status(409).json({ mensagem: "A solicitação já foi enviada." });
    }
    if (amizade.status === "recebida") {
      return res.status(409).json({ mensagem: "Este usuário já enviou uma solicitação. Aceite-a no perfil." });
    }

    await sequelize.query(`
      INSERT INTO amizades (solicitante_id, destinatario_id)
      VALUES (:solicitanteId, :destinatarioId)
    `, {
      replacements: { solicitanteId: req.usuario.id, destinatarioId: outroId },
      type: QueryTypes.INSERT,
    });
    return res.status(201).json({ amizade: { status: "enviada" } });
  } catch (erro) {
    if (erro.original?.code === "23505" || erro.parent?.code === "23505") {
      return res.status(409).json({ mensagem: "A relação de amizade mudou. Atualize o perfil." });
    }
    logErro("friend_request_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível enviar a solicitação." });
  }
}

async function aceitarAmizade(req, res) {
  const outroId = req.params.id;
  if (!validarId(outroId)) {
    return res.status(400).json({ mensagem: "Identificador de usuário inválido." });
  }
  try {
    const atualizadas = await sequelize.query(`
      UPDATE amizades
      SET status = 'aceita', atualizado_em = now()
      WHERE solicitante_id = :outroId
        AND destinatario_id = :usuarioId
        AND status = 'pendente'
      RETURNING id
    `, {
      replacements: { outroId, usuarioId: req.usuario.id },
      type: QueryTypes.SELECT,
    });
    if (!atualizadas.length) {
      return res.status(404).json({ mensagem: "Solicitação recebida não encontrada." });
    }
    return res.json({ amizade: { status: "amigos" } });
  } catch (erro) {
    logErro("friend_request_accept_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível aceitar a solicitação." });
  }
}

async function removerAmizade(req, res) {
  const outroId = req.params.id;
  if (!validarId(outroId)) {
    return res.status(400).json({ mensagem: "Identificador de usuário inválido." });
  }
  try {
    const removidas = await sequelize.query(`
      DELETE FROM amizades
      WHERE (
        (solicitante_id = :usuarioId AND destinatario_id = :outroId AND status = 'pendente')
        OR
        (solicitante_id = :outroId AND destinatario_id = :usuarioId AND status = 'pendente')
        OR
        (LEAST(solicitante_id, destinatario_id) = LEAST(CAST(:usuarioId AS bigint), CAST(:outroId AS bigint))
          AND GREATEST(solicitante_id, destinatario_id) = GREATEST(CAST(:usuarioId AS bigint), CAST(:outroId AS bigint))
          AND status = 'aceita')
      )
      RETURNING id
    `, {
      replacements: { usuarioId: req.usuario.id, outroId },
      type: QueryTypes.SELECT,
    });
    if (!removidas.length) {
      return res.status(404).json({ mensagem: "Solicitação ou amizade não encontrada." });
    }
    return res.json({ amizade: { status: "nenhuma" } });
  } catch (erro) {
    logErro("friendship_remove_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível remover a solicitação ou amizade." });
  }
}

async function listarAmizades(req, res) {
  try {
    const relacionamentos = await sequelize.query(`
      SELECT
        u.id::text,
        u.nome_usuario,
        u.nome_exibicao,
        CASE WHEN u.perfil_publico OR a.status = 'aceita' THEN u.avatar_url ELSE NULL END AS avatar_url,
        a.status AS status_relacao,
        CASE
          WHEN a.status = 'aceita' THEN 'amigos'
          WHEN a.solicitante_id = :usuarioId THEN 'enviada'
          ELSE 'recebida'
        END AS relacao,
        a.criado_em
      FROM amizades a
      JOIN usuarios u
        ON u.id = CASE
          WHEN a.solicitante_id = :usuarioId THEN a.destinatario_id
          ELSE a.solicitante_id
        END
      WHERE a.solicitante_id = :usuarioId OR a.destinatario_id = :usuarioId
      ORDER BY a.atualizado_em DESC, a.id DESC
    `, {
      replacements: { usuarioId: req.usuario.id },
      type: QueryTypes.SELECT,
    });
    return res.json({
      amigos: relacionamentos.filter(item => item.relacao === "amigos"),
      recebidas: relacionamentos.filter(item => item.relacao === "recebida"),
      enviadas: relacionamentos.filter(item => item.relacao === "enviada"),
    });
  } catch (erro) {
    logErro("friendship_list_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar suas amizades." });
  }
}

async function buscarUsuarios(req, res) {
  const termo = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (termo.length < 2) {
    return res.status(400).json({ mensagem: "Digite pelo menos 2 caracteres para pesquisar." });
  }
  try {
    const usuarios = await sequelize.query(`
      SELECT
        u.id::text,
        u.nome_usuario,
        u.nome_exibicao,
        CASE WHEN u.perfil_publico OR a.status = 'aceita' THEN u.avatar_url ELSE NULL END AS avatar_url,
        CASE
          WHEN a.status = 'aceita' THEN 'amigos'
          WHEN a.status = 'pendente' AND a.solicitante_id = :usuarioId THEN 'enviada'
          WHEN a.status = 'pendente' THEN 'recebida'
          ELSE 'desconhecido'
        END AS relacao
      FROM usuarios u
      LEFT JOIN amizades a
        ON LEAST(a.solicitante_id, a.destinatario_id) = LEAST(CAST(:usuarioId AS bigint), u.id)
       AND GREATEST(a.solicitante_id, a.destinatario_id) = GREATEST(CAST(:usuarioId AS bigint), u.id)
      WHERE u.id <> :usuarioId
        AND (
          u.nome_usuario ILIKE :termo
          OR u.nome_exibicao ILIKE :termo
        )
      ORDER BY
        CASE WHEN a.status = 'aceita' THEN 0 WHEN a.status = 'pendente' THEN 1 ELSE 2 END,
        lower(u.nome_usuario)
      LIMIT 30
    `, {
      replacements: { usuarioId: req.usuario.id, termo: `%${termo}%` },
      type: QueryTypes.SELECT,
    });
    return res.json({ usuarios });
  } catch (erro) {
    logErro("user_search_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível pesquisar usuários." });
  }
}

async function sugerirUsuarios(req, res) {
  try {
    const usuarios = await sequelize.query(`
      SELECT u.id::text, u.nome_usuario, u.nome_exibicao, u.avatar_url,
        'desconhecido' AS relacao
      FROM usuarios u
      WHERE u.id <> :usuarioId
        AND u.perfil_publico = true
        AND NOT EXISTS (
          SELECT 1
          FROM amizades a
          WHERE LEAST(a.solicitante_id, a.destinatario_id) = LEAST(CAST(:usuarioId AS bigint), u.id)
            AND GREATEST(a.solicitante_id, a.destinatario_id) = GREATEST(CAST(:usuarioId AS bigint), u.id)
        )
      ORDER BY u.criado_em DESC, u.id DESC
      LIMIT 12
    `, {
      replacements: { usuarioId: req.usuario.id },
      type: QueryTypes.SELECT,
    });
    return res.json({ usuarios });
  } catch (erro) {
    logErro("friend_suggestions_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar sugestões de pessoas." });
  }
}

module.exports = {
  meuPerfil,
  perfilPublico,
  atualizarMeuPerfil,
  solicitarAmizade,
  aceitarAmizade,
  removerAmizade,
  listarAmizades,
  buscarUsuarios,
  sugerirUsuarios,
};
