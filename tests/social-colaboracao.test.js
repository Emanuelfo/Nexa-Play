const test = require('node:test');
const assert = require('node:assert/strict');
const { AREAS, validarCompetencias } = require('../src/utils/socialMetadata');

const queries = [];
let rows = [];
let updates = null;
function stub(modulePath, exports) {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../src/config/database', {
  query: async (sql, options) => { queries.push({ sql, options }); return rows; },
  where: () => ({}), fn: () => ({}), col: () => ({}),
});
stub('../src/models/Usuario', {
  findOne: async () => null,
  findByPk: async () => ({ update: async values => { updates = values; } }),
});
const profile = require('../src/controllers/perfilController');
const projects = require('../src/controllers/projetoController');
const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
const privacy = Object.fromEntries(['perfil_publico', 'mostrar_biografia', 'mostrar_pontos', 'mostrar_amigos', 'mostrar_conquistas', 'mostrar_progresso'].map(key => [key, true]));

test('habilidades são opcionais, limitadas e deduplicadas sem perder a grafia', () => {
  assert.equal(validarCompetencias(undefined), undefined);
  assert.deepEqual(validarCompetencias([' Python ', 'python', 'Godot']), ['python', 'Godot']);
  assert.throws(() => validarCompetencias(Array(13).fill('Python')));
  assert.throws(() => validarCompetencias(['x'.repeat(41)]));
  assert.throws(() => validarCompetencias('Python'));
  assert.throws(() => validarCompetencias([null]));
});

test('busca permite apenas área, rejeita área inválida e parametriza habilidade', async () => {
  queries.length = 0; rows = [];
  let res = response();
  await profile.buscarUsuarios({ usuario: { id: '1' }, query: { q: '', area: 'Multimídia' } }, res);
  assert.equal(res.code, 200);
  assert.equal(queries[0].options.replacements.area, 'Multimídia');
  assert.match(queries[0].sql, /array_to_string\(u.habilidades/);
  assert.match(queries[0].sql, /u\.mostrar_biografia AND u\.biografia ILIKE/);
  assert.match(queries[0].sql, /u\.perfil_publico OR a\.status = 'aceita'/);
  res = response();
  await profile.buscarUsuarios({ usuario: { id: '1' }, query: { q: 'Godot', area: 'Desconhecida' } }, res);
  assert.equal(res.code, 400);
  assert.equal(queries.length, 1);
});

test('perfil salva habilidades, área e portfólio e preserva metadados omitidos por clientes antigos', async () => {
  rows = []; updates = null;
  const body = { nome_exibicao: 'Pessoa', nome_usuario: 'pessoa', biografia: '', avatar_url: null, capa_url: null, privacidade: privacy, area: 'Design', habilidades: ['Interfaces'], portfolio_url: 'https://example.invalid/portfolio' };
  let res = response();
  await profile.atualizarMeuPerfil({ usuario: { id: '1' }, body }, res);
  assert.deepEqual(updates.habilidades, ['Interfaces']);
  assert.equal(updates.area, 'Design');
  assert.equal(updates.portfolio_url, 'https://example.invalid/portfolio');
  const { area, habilidades, portfolio_url, ...legacy } = body;
  await profile.atualizarMeuPerfil({ usuario: { id: '1' }, body: legacy }, response());
  for (const key of ['area', 'habilidades', 'portfolio_url']) assert.equal(key in updates, false);
});

test('perfil rejeita habilidades e links inválidos antes de gravar', async () => {
  updates = null;
  const body = { nome_exibicao: 'Pessoa', nome_usuario: 'pessoa', biografia: '', privacidade: privacy, area: 'Design', habilidades: ['x'.repeat(41)] };
  let res = response();
  await profile.atualizarMeuPerfil({ usuario: { id: '1' }, body }, res);
  assert.equal(res.code, 400); assert.equal(res.body.campo, 'habilidades'); assert.equal(updates, null);
  res = response();
  await profile.atualizarMeuPerfil({ usuario: { id: '1' }, body: { ...body, habilidades: [], portfolio_url: 'javascript:alert(1)' } }, res);
  assert.equal(res.code, 400); assert.equal(res.body.campo, 'portfolio_url'); assert.equal(updates, null);
});

test('criação aceita as quatro áreas e categorias antigas, persistindo as necessidades e a etapa', async () => {
  for (const categoria of [...AREAS, 'Jogos', 'Arte e design', 'Música']) {
    queries.length = 0; rows = [{ id: '10' }];
    const body = { titulo: 'Projeto', descricao: 'Uma ideia.', categoria, tipo: 'equipe', visibilidade: 'publico', como_contribuir: 'Precisamos de pixel art.', resumo: 'Explore o oceano.', etapa: 'Ideia' };
    const res = response();
    await projects.criar({ usuario: { id: '1' }, body }, res);
    assert.equal(res.code, 201);
    assert.equal(queries[0].options.replacements.comoContribuir, body.como_contribuir);
    assert.equal(queries[0].options.replacements.etapa, 'Ideia');
    assert.equal(queries[0].options.replacements.resumo, body.resumo);
  }
});

test('projetos antigos funcionam sem novos campos e conteúdo inválido não é gravado', async () => {
  queries.length = 0; rows = [{ id: '10' }];
  const body = { titulo: 'Legado', descricao: 'Projeto antigo.', categoria: 'Educação', tipo: 'individual', visibilidade: 'privado' };
  const res = response();
  await projects.criar({ usuario: { id: '1' }, body }, res);
  assert.equal(res.code, 201);
  assert.equal(queries[0].options.replacements.comoContribuir, null);
  for (const extra of [{ como_contribuir: 'x'.repeat(1501) }, { resumo: 'x'.repeat(241) }, { etapa: 'Inválida' }]) {
    queries.length = 0;
    const invalid = response();
    await projects.criar({ usuario: { id: '1' }, body: { ...body, ...extra } }, invalid);
    assert.equal(invalid.code, 400); assert.equal(queries.length, 0);
  }
});
