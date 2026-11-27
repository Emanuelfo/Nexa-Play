// Regressão de privacidade de projetos (A01) e de solicitações/convites (A11).
// Sem banco real: o Sequelize é substituído por um stub em memória; nenhum dado de usuário é tocado.
// Limite: o SQL em si não é executado aqui (sem PostgreSQL); validam-se as decisões de acesso da aplicação.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

function stub(modulePath, exports) {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const consultas = [];
let responder = () => [];
stub('../src/config/database', {
  async query(sql, options = {}) { consultas.push({ sql, options }); return responder(sql, options); },
  async transaction(callback) { return callback({ id: 'tx-fixture' }); },
  where: () => ({}), fn: () => ({}), col: () => ({}),
});
stub('../src/models/Usuario', { async findOne() { return { id: '99' }; } });

const acesso = require('../src/services/projetoAcesso');
const controller = require('../src/controllers/projetoController');

const DONO = '1', MEMBRO = '2', CONVIDADO = '3', ESTRANHO = '4', SOLICITANTE = '5';
const dono = { id: DONO, nome_usuario: 'dono', nome_exibicao: 'Dono', avatar_url: null };
function projeto(extra = {}) {
  return {
    id: '10', titulo: 'Segredo', descricao: 'Descrição privada', imagem_url: 'https://exemplo.invalid/capa.png',
    categoria: 'Jogos', link_externo: 'https://exemplo.invalid/repo', visibilidade: 'privado', tipo: 'equipe',
    criado_em: '2026-01-01', atualizado_em: '2026-01-02', proprietario_id: DONO, proprietario: dono,
    total_participantes: 2, participacao: null, ...extra,
  };
}

test('nivelAcesso diferencia proprietário, participante, convite, solicitação e estranho', () => {
  assert.equal(acesso.nivelAcesso(projeto(), DONO), 'proprietario');
  assert.equal(acesso.nivelAcesso(projeto({ participacao: { status: 'aceito', origem: 'convite' } }), MEMBRO), 'participante');
  assert.equal(acesso.nivelAcesso(projeto({ participacao: { status: 'pendente', origem: 'convite' } }), CONVIDADO), 'convite');
  assert.equal(acesso.nivelAcesso(projeto({ participacao: { status: 'pendente', origem: 'solicitacao' } }), SOLICITANTE), 'nenhum');
  assert.equal(acesso.nivelAcesso(projeto({ participacao: { status: 'recusado', origem: 'convite' } }), CONVIDADO), 'nenhum');
  assert.equal(acesso.nivelAcesso(projeto(), ESTRANHO), 'nenhum');
  assert.equal(acesso.nivelAcesso(null, ESTRANHO), 'nenhum');
});

test('projeto público é visível a qualquer usuário, mesmo com solicitação pendente ou recusada', () => {
  const publico = projeto({ visibilidade: 'publico' });
  assert.equal(acesso.nivelAcesso(publico, ESTRANHO), 'publico');
  assert.equal(acesso.nivelAcesso({ ...publico, participacao: { status: 'pendente', origem: 'solicitacao' } }, SOLICITANTE), 'publico');
  assert.equal(acesso.nivelAcesso({ ...publico, participacao: { status: 'recusado', origem: 'solicitacao' } }, SOLICITANTE), 'publico');
});

test('convite para projeto privado recebe visão mínima, sem dados privados', () => {
  const visao = acesso.aplicarAcesso(projeto({ participacao: { status: 'pendente', origem: 'convite' } }), CONVIDADO);
  assert.equal(visao.acesso, 'convite');
  assert.equal(visao.titulo, 'Segredo');
  for (const campo of ['descricao', 'imagem_url', 'link_externo', 'total_participantes', 'criado_em']) {
    assert.equal(campo in visao, false, `${campo} não pode vazar para convite`);
  }
  assert.equal(acesso.aplicarAcesso(projeto(), ESTRANHO), null);
});

async function servidor(usuarioId) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.usuario = { id: req.get('x-usuario') }; next(); });
  app.get('/api/projetos/:id', controller.obter);
  app.get('/api/me/projetos', controller.meusProjetos);
  app.put('/api/projetos/:id', controller.atualizar);
  app.post('/api/projetos/:id/solicitacoes', controller.solicitarParticipacao);
  app.post('/api/projetos/:id/convites', controller.convidar);
  const escuta = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${escuta.address().port}/api`;
  const chamar = (metodo, caminho, usuario, corpo) => fetch(base + caminho, {
    method: metodo,
    headers: { 'content-type': 'application/json', 'x-usuario': usuario },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { chamar, fechar: () => new Promise(resolve => escuta.close(resolve)) };
}

function bancoDeProjeto(base, usuarioId) {
  // Devolve a mesma linha que o SQL devolveria: `participacao` é a do usuário que consulta.
  return (sql, options) => {
    if (sql.includes('FROM projetos p') && sql.includes('WHERE p.id = :projetoId')) {
      return [{ ...base.projeto, participacao: base.participacoes[options.replacements.usuarioId] || null }];
    }
    if (sql.includes('FROM projeto_participantes pp') && sql.includes("pp.status = 'aceito'")) return [{ id: MEMBRO, nome_usuario: 'membro' }];
    if (sql.includes('FROM projeto_atualizacoes')) return [{ id: '1', texto: 'novidade' }];
    if (sql.includes("pp.status = 'pendente'") && sql.includes('ORDER BY pp.criado_em')) return [{ usuario_id: SOLICITANTE, origem: 'solicitacao' }];
    return [];
  };
}

test('GET /projetos/:id aplica a mesma regra para cada tipo de usuário em projeto privado', async () => {
  const cenario = {
    projeto: projeto(),
    participacoes: {
      [MEMBRO]: { status: 'aceito', origem: 'convite' },
      [CONVIDADO]: { status: 'pendente', origem: 'convite' },
      [SOLICITANTE]: { status: 'pendente', origem: 'solicitacao' },
    },
  };
  responder = bancoDeProjeto(cenario);
  const { chamar, fechar } = await servidor();
  try {
    let r = await chamar('GET', '/projetos/10', ESTRANHO);
    assert.equal(r.status, 404);
    const corpoEstranho = await r.json();
    r = await chamar('GET', '/projetos/999', ESTRANHO);
    assert.deepEqual(await r.json(), corpoEstranho, 'projeto privado e inexistente respondem igual');

    r = await chamar('GET', '/projetos/10', SOLICITANTE);
    assert.equal(r.status, 404, 'solicitação pendente não dá acesso a projeto privado');

    r = await chamar('GET', '/projetos/10', CONVIDADO);
    assert.equal(r.status, 200);
    let corpo = (await r.json()).projeto;
    assert.equal(corpo.acesso, 'convite');
    assert.equal(corpo.descricao, undefined);
    assert.equal(corpo.participantes, undefined);
    assert.equal(corpo.atualizacoes, undefined);
    assert.equal(corpo.pode_atualizar, false);

    r = await chamar('GET', '/projetos/10', MEMBRO);
    corpo = (await r.json()).projeto;
    assert.equal(corpo.descricao, 'Descrição privada');
    assert.equal(corpo.pode_atualizar, true);
    assert.equal(corpo.solicitacoes, undefined, 'só o proprietário vê solicitações');

    r = await chamar('GET', '/projetos/10', DONO);
    corpo = (await r.json()).projeto;
    assert.equal(corpo.sou_proprietario, true);
    assert.equal(corpo.solicitacoes.length, 1);
  } finally { await fechar(); }
});

test('GET /me/projetos não entrega dados privados a quem só tem convite ou solicitação', async () => {
  const privado = projeto({ participacao: { status: 'pendente', origem: 'convite' } });
  const privadoComSolicitacao = projeto({ id: '11', participacao: { status: 'pendente', origem: 'solicitacao' } });
  const publico = projeto({ id: '12', visibilidade: 'publico', participacao: { status: 'pendente', origem: 'solicitacao' } });
  responder = () => [publico, privadoComSolicitacao, privado];
  const { chamar, fechar } = await servidor();
  try {
    const r = await chamar('GET', '/me/projetos', CONVIDADO);
    const { projetos } = await r.json();
    assert.deepEqual(projetos.map(p => p.id), ['12', '10'], 'solicitação em projeto privado não é listada');
    const convite = projetos.find(p => p.id === '10');
    assert.equal(convite.descricao, undefined);
    assert.equal(convite.imagem_url, undefined);
    assert.equal(convite.link_externo, undefined);
    assert.equal(projetos.find(p => p.id === '12').descricao, 'Descrição privada');
    const sql = consultas.at(-1).sql;
    assert.match(sql, /membro\.origem = 'convite'/, 'a consulta restringe solicitações pendentes a projetos públicos');
  } finally { await fechar(); }
});

const corpoProjeto = { titulo: 'T', descricao: 'D', categoria: 'Jogos', visibilidade: 'privado', tipo: 'equipe' };

test('tornar um projeto público em privado encerra solicitações pendentes e preserva equipe e convites', async () => {
  consultas.length = 0;
  responder = sql => {
    if (sql.startsWith('SELECT visibilidade')) return [{ visibilidade: 'publico' }];
    if (sql.includes('UPDATE projetos')) return [{ id: '10', visibilidade: 'privado' }];
    if (sql.includes('DELETE FROM projeto_participantes')) return [{ usuario_id: SOLICITANTE }, { usuario_id: '6' }];
    return [];
  };
  const { chamar, fechar } = await servidor();
  try {
    const r = await chamar('PUT', '/projetos/10', DONO, corpoProjeto);
    assert.equal(r.status, 200);
    const corpo = await r.json();
    assert.equal(corpo.solicitacoes_encerradas, 2);
    const remocao = consultas.find(c => c.sql.includes('DELETE FROM projeto_participantes'));
    assert.match(remocao.sql, /origem = 'solicitacao' AND status = 'pendente'/);
    assert.doesNotMatch(remocao.sql, /aceito|convite/, 'participantes aceitos e convites não são tocados');
  } finally { await fechar(); }
});

test('manter o projeto privado, ou torná-lo público, não apaga solicitações', async () => {
  for (const [antes, depois] of [['privado', 'privado'], ['privado', 'publico']]) {
    consultas.length = 0;
    responder = sql => {
      if (sql.startsWith('SELECT visibilidade')) return [{ visibilidade: antes }];
      if (sql.includes('UPDATE projetos')) return [{ id: '10', visibilidade: depois }];
      return [];
    };
    const { chamar, fechar } = await servidor();
    try {
      const r = await chamar('PUT', '/projetos/10', DONO, { ...corpoProjeto, visibilidade: depois });
      assert.equal(r.status, 200);
      assert.equal(consultas.some(c => c.sql.includes('DELETE FROM projeto_participantes')), false);
    } finally { await fechar(); }
  }
});

test('quem não é proprietário não consegue editar nem alterar a visibilidade', async () => {
  consultas.length = 0;
  responder = sql => (sql.startsWith('SELECT visibilidade') ? [] : []);
  const { chamar, fechar } = await servidor();
  try {
    const r = await chamar('PUT', '/projetos/10', ESTRANHO, corpoProjeto);
    assert.equal(r.status, 404);
    assert.equal(consultas.some(c => c.sql.includes('UPDATE projetos')), false);
  } finally { await fechar(); }
});

test('solicitar participação: novo pedido, duplicados e reabertura após recusa (A11)', async () => {
  const publicoEquipe = { id: '10', proprietario_id: DONO, tipo: 'equipe', visibilidade: 'publico' };
  const { chamar, fechar } = await servidor();
  try {
    // 1) primeira solicitação (INSERT devolve a linha)
    responder = sql => sql.startsWith('SELECT id, proprietario_id') ? [publicoEquipe] : sql.includes('INSERT INTO projeto_participantes') ? [{ usuario_id: SOLICITANTE, origem: 'solicitacao', status: 'pendente' }] : [];
    let r = await chamar('POST', '/projetos/10/solicitacoes', SOLICITANTE);
    assert.equal(r.status, 201);

    // 2) já pendente: sem duplicar
    responder = sql => sql.startsWith('SELECT id, proprietario_id') ? [publicoEquipe] : sql.includes('INSERT INTO') ? [] : [{ status: 'pendente', origem: 'solicitacao' }];
    r = await chamar('POST', '/projetos/10/solicitacoes', SOLICITANTE);
    assert.equal(r.status, 409);
    assert.equal((await r.json()).codigo, 'participacao_pendente');

    // 3) recusada há pouco: bloqueada com horário de liberação
    const liberacao = new Date(Date.now() + 3600_000).toISOString();
    responder = sql => sql.startsWith('SELECT id, proprietario_id') ? [publicoEquipe] : sql.includes('INSERT INTO') ? [] : [{ status: 'recusado', origem: 'solicitacao', disponivel_em: liberacao }];
    r = await chamar('POST', '/projetos/10/solicitacoes', SOLICITANTE);
    assert.equal(r.status, 409);
    const corpo = await r.json();
    assert.equal(corpo.codigo, 'reabertura_indisponivel');
    assert.equal(corpo.disponivel_em, liberacao);

    // 4) o SQL da reabertura exige recusa anterior e o intervalo mínimo
    const insercao = consultas.filter(c => c.sql.includes('INSERT INTO projeto_participantes')).at(-1);
    assert.match(insercao.sql, /status = 'recusado'/);
    assert.match(insercao.sql, /make_interval\(hours => :reaberturaHoras\)/);
    assert.equal(insercao.options.replacements.reaberturaHoras, acesso.REABERTURA_HORAS);

    // 5) projeto que virou privado não aceita solicitações
    responder = sql => sql.startsWith('SELECT id, proprietario_id') ? [{ ...publicoEquipe, visibilidade: 'privado' }] : [];
    r = await chamar('POST', '/projetos/10/solicitacoes', SOLICITANTE);
    assert.equal(r.status, 409);

    // 6) o proprietário não solicita ao próprio projeto
    responder = sql => sql.startsWith('SELECT id, proprietario_id') ? [publicoEquipe] : [];
    r = await chamar('POST', '/projetos/10/solicitacoes', DONO);
    assert.equal(r.status, 409);
  } finally { await fechar(); }
});

test('reconvidar usuário que recusou respeita o mesmo intervalo mínimo', async () => {
  responder = sql => {
    if (sql.includes('WHERE p.id = :projetoId')) return [projeto()];
    if (sql.includes('INSERT INTO projeto_participantes')) return [];
    if (sql.includes('FROM projeto_participantes')) return [{ status: 'recusado', origem: 'convite', disponivel_em: '2099-01-01T00:00:00Z' }];
    return [];
  };
  const { chamar, fechar } = await servidor();
  try {
    const r = await chamar('POST', '/projetos/10/convites', DONO, { nome_usuario: 'fulano' });
    assert.equal(r.status, 409);
    assert.equal((await r.json()).codigo, 'reabertura_indisponivel');
  } finally { await fechar(); }
});
