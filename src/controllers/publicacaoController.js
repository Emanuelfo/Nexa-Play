const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const logErro = require("../utils/logErro");

const LIMITE_PADRAO = 10;
const LIMITE_MAXIMO = 30;

function validarId(valor) {
  return typeof valor === "string" && /^\d{1,18}$/.test(valor) && BigInt(valor) > 0n;
}

function lerPaginacao(req, res) {
  const limiteInformado = req.query.limite;
  const limite = limiteInformado === undefined ? LIMITE_PADRAO : Number(limiteInformado);
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

function filtroPublicacoes(cursor, usuarioId, publicacaoId) {
  return `${cursor ? "AND p.id < :cursor" : ""}
    ${usuarioId ? "AND p.usuario_id = :autorId" : ""}
    ${publicacaoId ? "AND p.id = :publicacaoId" : ""}
    AND (
      u.perfil_publico
      OR u.id = :idUsuarioLogado
      OR EXISTS (
        SELECT 1
        FROM amizades am
        WHERE am.status = 'aceita'
          AND (
            (am.solicitante_id = u.id AND am.destinatario_id = :idUsuarioLogado)
            OR (am.destinatario_id = u.id AND am.solicitante_id = :idUsuarioLogado)
          )
      )
    )`;
}

function condicaoPerfilVisivel(alias) {
  return `EXISTS (
    SELECT 1
    FROM usuarios autor
    WHERE autor.id = ${alias}.usuario_id
      AND (
        autor.perfil_publico
        OR autor.id = :idUsuarioLogado
        OR EXISTS (
          SELECT 1
          FROM amizades am
          WHERE am.status = 'aceita'
            AND (
              (am.solicitante_id = autor.id AND am.destinatario_id = :idUsuarioLogado)
              OR (am.destinatario_id = autor.id AND am.solicitante_id = :idUsuarioLogado)
            )
        )
      )
  )`;
}

function buscarPublicacoes({ cursor, usuarioId, publicacaoId, limite, idUsuarioLogado }) {
  return sequelize.query(`
    SELECT
      p.id,
      p.texto,
      p.criado_em,
      json_build_object(
        'id', u.id::text,
        'nome_usuario', u.nome_usuario,
        'nome_exibicao', u.nome_exibicao,
        'avatar_url', u.avatar_url
      ) AS autor,
      CASE WHEN c.id IS NULL THEN NULL
        ELSE json_build_object('id', c.id::text, 'titulo', c.titulo)
      END AS conquista,
      COUNT(DISTINCT cu.usuario_id)::integer AS curtidas,
      COUNT(DISTINCT co.id)::integer AS quantidade_comentarios,
      COUNT(DISTINCT cu.usuario_id) FILTER (WHERE cu.usuario_id = :idUsuarioLogado) > 0
        AS curtida_pelo_usuario
    FROM publicacoes p
    JOIN usuarios u ON u.id = p.usuario_id
    LEFT JOIN conquistas c ON c.id = p.conquista_id
    LEFT JOIN curtidas cu ON cu.publicacao_id = p.id
    LEFT JOIN comentarios co ON co.publicacao_id = p.id AND co.oculta = false
    WHERE p.oculta = false
      ${filtroPublicacoes(cursor, usuarioId, publicacaoId)}
    GROUP BY p.id, u.id, c.id
    ORDER BY p.id DESC
    LIMIT :limite
  `, {
    replacements: {
      cursor,
      autorId: usuarioId,
      publicacaoId,
      idUsuarioLogado,
      limite,
    },
    type: QueryTypes.SELECT,
  });
}

async function listar(req, res) {
  try {
    const paginacao = lerPaginacao(req, res);
    if (!paginacao) return;

    const usuarioId = req.query.usuario;
    if (usuarioId !== undefined && !validarId(usuarioId)) {
      return res.status(400).json({ mensagem: "Identificador de usuário inválido." });
    }

    const registros = await buscarPublicacoes({
      cursor: paginacao.cursor,
      usuarioId,
      limite: paginacao.limite + 1,
      idUsuarioLogado: req.usuario.id,
    });
    const temMais = registros.length > paginacao.limite;
    const publicacoes = temMais ? registros.slice(0, paginacao.limite) : registros;

    return res.json({
      publicacoes,
      proximoCursor: temMais ? String(publicacoes[publicacoes.length - 1].id) : null,
    });
  } catch (erro) {
    logErro("publication_list_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar as publicações." });
  }
}

async function obter(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de publicação inválido." });
  }
  try {
    const [publicacao] = await buscarPublicacoes({
      publicacaoId: req.params.id,
      limite: 1,
      idUsuarioLogado: req.usuario.id,
    });
    if (!publicacao) return res.status(404).json({ mensagem: "Publicação não encontrada." });
    return res.json({ publicacao });
  } catch (erro) {
    logErro("publication_load_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar a publicação." });
  }
}

async function criar(req, res) {
  const texto = typeof req.body?.texto === "string" ? req.body.texto.trim() : "";
  if (!texto || texto.length > 2000) {
    return res.status(400).json({ mensagem: "A publicação deve ter entre 1 e 2000 caracteres." });
  }
  const conquistaId = req.body?.conquista_id;
  if (conquistaId !== undefined && conquistaId !== null
    && (typeof conquistaId !== "string" || !validarId(conquistaId))) {
    return res.status(400).json({ mensagem: "Identificador de conquista inválido." });
  }

  try {
    const [publicacao] = await sequelize.query(`
      WITH inserida AS (
        INSERT INTO publicacoes (usuario_id, texto, conquista_id)
        SELECT :usuarioId, :texto, :conquistaId
        WHERE :conquistaId IS NULL
          OR EXISTS (
            SELECT 1
            FROM usuario_conquistas
            WHERE usuario_id = :usuarioId AND conquista_id = :conquistaId
          )
        RETURNING id, texto, criado_em, usuario_id, conquista_id
      )
      SELECT inserida.id, inserida.texto, inserida.criado_em,
        json_build_object(
          'id', u.id::text,
          'nome_usuario', u.nome_usuario,
          'nome_exibicao', u.nome_exibicao,
          'avatar_url', u.avatar_url
        ) AS autor,
        CASE WHEN c.id IS NULL THEN NULL
          ELSE json_build_object('id', c.id::text, 'titulo', c.titulo)
        END AS conquista,
        0::integer AS curtidas,
        0::integer AS quantidade_comentarios,
        false AS curtida_pelo_usuario
      FROM inserida
      JOIN usuarios u ON u.id = inserida.usuario_id
      LEFT JOIN conquistas c ON c.id = inserida.conquista_id
    `, {
      replacements: {
        usuarioId: req.usuario.id,
        texto,
        conquistaId: conquistaId || null,
      },
      type: QueryTypes.SELECT,
    });
    if (!publicacao) {
      return conquistaId
        ? res.status(403).json({ mensagem: "Só é possível compartilhar conquistas desbloqueadas por você." })
        : res.status(404).json({ mensagem: "Usuário não encontrado." });
    }
    return res.status(201).json({ publicacao });
  } catch (erro) {
    logErro("publication_create_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível criar a publicação." });
  }
}

async function apagar(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de publicação inválido." });
  }

  try {
    const [publicacao] = await sequelize.query(`
      DELETE FROM publicacoes
      WHERE id = :id AND usuario_id = :usuarioId
      RETURNING id
    `, {
      replacements: { id: req.params.id, usuarioId: req.usuario.id },
      type: QueryTypes.SELECT,
    });
    if (!publicacao) return res.status(404).json({ mensagem: "Publicação não encontrada ou não pertence a você." });
    return res.json({ mensagem: "Publicação apagada." });
  } catch (erro) {
    logErro("publication_delete_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível apagar a publicação." });
  }
}

async function editar(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de publicação inválido." });
  }
  const texto = typeof req.body?.texto === "string" ? req.body.texto.trim() : "";
  if (!texto || texto.length > 2000) {
    return res.status(400).json({ mensagem: "A publicação deve ter entre 1 e 2000 caracteres." });
  }

  try {
    const [publicacao] = await sequelize.query(`
      UPDATE publicacoes
      SET texto = :texto
      WHERE id = :id
        AND usuario_id = :usuarioId
        AND criado_em >= now() - interval '30 minutes'
      RETURNING id, texto, criado_em
    `, {
      replacements: { id: req.params.id, usuarioId: req.usuario.id, texto },
      type: QueryTypes.SELECT,
    });
    if (publicacao) return res.json({ publicacao });

    const [existente] = await sequelize.query(`
      SELECT id
      FROM publicacoes
      WHERE id = :id AND usuario_id = :usuarioId
    `, {
      replacements: { id: req.params.id, usuarioId: req.usuario.id },
      type: QueryTypes.SELECT,
    });
    if (!existente) return res.status(404).json({ mensagem: "Publicação não encontrada ou não pertence a você." });
    return res.status(403).json({ mensagem: "O prazo de 30 minutos para editar esta publicação expirou." });
  } catch (erro) {
    logErro("publication_edit_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível editar a publicação." });
  }
}

async function alterarCurtida(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de publicação inválido." });
  }

  try {
    const [publicacao] = await sequelize.query(
      `SELECT p.id FROM publicacoes p
       WHERE p.id = :id AND p.oculta = false
         AND ${condicaoPerfilVisivel("p")}`,
      {
        replacements: { id: req.params.id, idUsuarioLogado: req.usuario.id },
        type: QueryTypes.SELECT,
      },
    );
    if (!publicacao) return res.status(404).json({ mensagem: "Publicação não encontrada." });

    if (req.method === "PUT") {
      await sequelize.query(`
        INSERT INTO curtidas (publicacao_id, usuario_id)
        VALUES (:publicacaoId, :usuarioId)
        ON CONFLICT (publicacao_id, usuario_id) DO NOTHING
      `, {
        replacements: { publicacaoId: req.params.id, usuarioId: req.usuario.id },
      });
    } else {
      await sequelize.query(`
        DELETE FROM curtidas
        WHERE publicacao_id = :publicacaoId AND usuario_id = :usuarioId
      `, {
        replacements: { publicacaoId: req.params.id, usuarioId: req.usuario.id },
      });
    }

    const [resultado] = await sequelize.query(`
      SELECT COUNT(*)::integer AS curtidas,
        EXISTS (
          SELECT 1 FROM curtidas
          WHERE publicacao_id = :publicacaoId AND usuario_id = :usuarioId
        ) AS curtida
      FROM curtidas
      WHERE publicacao_id = :publicacaoId
    `, {
      replacements: { publicacaoId: req.params.id, usuarioId: req.usuario.id },
      type: QueryTypes.SELECT,
    });
    return res.json(resultado);
  } catch (erro) {
    logErro("publication_like_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível atualizar a curtida." });
  }
}

async function listarComentarios(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de publicação inválido." });
  }
  const paginacao = lerPaginacao(req, res);
  if (!paginacao) return;

  try {
    const [publicacao] = await sequelize.query(
      `SELECT p.id FROM publicacoes p
       WHERE p.id = :id AND p.oculta = false
         AND ${condicaoPerfilVisivel("p")}`,
      {
        replacements: { id: req.params.id, idUsuarioLogado: req.usuario.id },
        type: QueryTypes.SELECT,
      },
    );
    if (!publicacao) return res.status(404).json({ mensagem: "Publicação não encontrada." });

    const cursorFiltro = paginacao.cursor ? "AND co.id < :cursor" : "";
    const comentarios = await sequelize.query(`
      SELECT co.id, co.texto, co.criado_em,
        json_build_object(
          'id', u.id::text,
          'nome_usuario', u.nome_usuario,
          'nome_exibicao', u.nome_exibicao,
          'avatar_url', u.avatar_url
        ) AS autor
      FROM comentarios co
      JOIN publicacoes p ON p.id = co.publicacao_id
      JOIN usuarios u ON u.id = co.usuario_id
      WHERE co.publicacao_id = :publicacaoId AND co.oculta = false
        AND ${condicaoPerfilVisivel("p")}
        ${cursorFiltro}
      ORDER BY co.id DESC
      LIMIT :limite
    `, {
      replacements: {
        publicacaoId: req.params.id,
        idUsuarioLogado: req.usuario.id,
        cursor: paginacao.cursor,
        limite: paginacao.limite + 1,
      },
      type: QueryTypes.SELECT,
    });
    const temMais = comentarios.length > paginacao.limite;
    const itens = temMais ? comentarios.slice(0, paginacao.limite) : comentarios;
    return res.json({
      comentarios: itens,
      proximoCursor: temMais ? String(itens[itens.length - 1].id) : null,
    });
  } catch (erro) {
    logErro("comment_list_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível carregar os comentários." });
  }
}

async function criarComentario(req, res) {
  if (!validarId(req.params.id)) {
    return res.status(400).json({ mensagem: "Identificador de publicação inválido." });
  }
  const texto = typeof req.body?.texto === "string" ? req.body.texto.trim() : "";
  if (!texto || texto.length > 1000) {
    return res.status(400).json({ mensagem: "O comentário deve ter entre 1 e 1000 caracteres." });
  }

  try {
    const [publicacao] = await sequelize.query(
      `SELECT p.id FROM publicacoes p
       WHERE p.id = :id AND p.oculta = false
         AND ${condicaoPerfilVisivel("p")}`,
      {
        replacements: { id: req.params.id, idUsuarioLogado: req.usuario.id },
        type: QueryTypes.SELECT,
      },
    );
    if (!publicacao) return res.status(404).json({ mensagem: "Publicação não encontrada." });

    const [comentario] = await sequelize.query(`
      WITH inserido AS (
        INSERT INTO comentarios (publicacao_id, usuario_id, texto)
        VALUES (:publicacaoId, :usuarioId, :texto)
        RETURNING id, texto, criado_em, usuario_id
      )
      SELECT inserido.id, inserido.texto, inserido.criado_em,
        json_build_object(
          'id', u.id::text,
          'nome_usuario', u.nome_usuario,
          'nome_exibicao', u.nome_exibicao,
          'avatar_url', u.avatar_url
        ) AS autor
      FROM inserido
      JOIN usuarios u ON u.id = inserido.usuario_id
    `, {
      replacements: { publicacaoId: req.params.id, usuarioId: req.usuario.id, texto },
      type: QueryTypes.SELECT,
    });
    return res.status(201).json({ comentario });
  } catch (erro) {
    logErro("comment_create_error", req, erro);
    return res.status(500).json({ mensagem: "Não foi possível publicar o comentário." });
  }
}

module.exports = { listar, obter, criar, apagar, editar, alterarCurtida, listarComentarios, criarComentario };
