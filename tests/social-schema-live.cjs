const assert = require('node:assert/strict');
const db = require('../src/config/database');
const profile = require('../src/controllers/perfilController');
const projects = require('../src/controllers/projetoController');

// Opt-in PostgreSQL integration: only temporary tables, one connection, rolled back.
// Run: node tests/social-schema-live.cjs
async function run() {
  const transaction = await db.transaction();
  const query = db.query.bind(db);
  const sql = (text, options = {}) => query(text, { ...options, transaction });
  db.query = sql;
  const call = async (fn, params = {}) => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await fn({ usuario: { id: '900000001' }, query: {}, ...params }, res);
    assert.equal(res.code, 200, JSON.stringify(res.body));
    return res.body;
  };
  try {
    for (const table of ['usuarios', 'amizades', 'projetos', 'projeto_participantes', 'atividades', 'progresso_usuario', 'trilhas', 'conquistas', 'usuario_conquistas']) {
      await sql(`CREATE TEMP TABLE ${table} (LIKE public.${table} INCLUDING DEFAULTS) ON COMMIT DROP`);
    }
    await sql(`INSERT INTO usuarios (id, nome_usuario, nome_exibicao, email, senha, pontos, perfil_publico) VALUES
      (900000001, 'qa_own', 'Conta de teste', 'own@example.invalid', 'unused', 125, true),
      (900000002, 'qa_eligible', 'Pessoa elegível', 'eligible@example.invalid', 'unused', 0, true),
      (900000003, 'qa_friend', 'Amizade', 'friend@example.invalid', 'unused', 0, true),
      (900000004, 'qa_sent', 'Enviada', 'sent@example.invalid', 'unused', 0, true),
      (900000005, 'qa_received', 'Recebida', 'received@example.invalid', 'unused', 0, true),
      (900000006, 'qa_private', 'Privado', 'private@example.invalid', 'unused', 0, false)`);
    await sql(`INSERT INTO amizades (id, solicitante_id, destinatario_id, status) VALUES
      (900000001, 900000001, 900000003, 'aceita'), (900000002, 900000001, 900000004, 'pendente'), (900000003, 900000005, 900000001, 'pendente')`);
    await sql(`INSERT INTO projetos (id, titulo, descricao, categoria, tipo, visibilidade, proprietario_id) VALUES
      (900000001, 'Público antigo', 'Descrição antiga.', 'Programação', 'equipe', 'publico', 900000002),
      (900000002, 'Público recente', 'Descrição recente.', 'Design', 'equipe', 'publico', 900000002),
      (900000003, 'Privado', 'Oculto.', 'Design', 'equipe', 'privado', 900000002)`);
    // Emulate the deployment before collaboration metadata was migrated.
    await sql('ALTER TABLE pg_temp.usuarios DROP COLUMN area, DROP COLUMN habilidades, DROP COLUMN portfolio_url');
    await sql('ALTER TABLE pg_temp.projetos DROP COLUMN resumo, DROP COLUMN etapa, DROP COLUMN como_contribuir');
    await sql('SAVEPOINT old_query');
    await assert.rejects(sql('SELECT u.area FROM usuarios u'), e => e.original?.code === '42703');
    await sql('ROLLBACK TO SAVEPOINT old_query');
    const suggestions = await call(profile.sugerirUsuarios);
    assert.deepEqual(suggestions.usuarios.map(u => u.id), ['900000002']);
    assert.deepEqual(suggestions.usuarios[0].habilidades, []);
    const list = await call(projects.explorar);
    assert.deepEqual(list.projetos.map(p => p.id), ['900000002', '900000001']);
    assert.equal(list.projetos[0].resumo, null);
    const own = (await call(profile.meuPerfil)).usuario;
    assert.equal(own.nome_exibicao, 'Conta de teste');
    assert.equal(own.estatisticas.pontos, 125);
    assert.equal(own.estatisticas.amigos, 1);
    assert.equal(own.estatisticas.conquistas, 0);
    assert.equal((await call(profile.listarAmizades)).recebidas.length, 1);
    assert.equal((await call(profile.buscarUsuarios, { query: { q: 'qa_' } })).usuarios.length, 5);
    assert.equal((await call(projects.explorar, { query: { q: 'inexistente' } })).projetos.length, 0);
    await sql(`ALTER TABLE pg_temp.usuarios ADD COLUMN area text, ADD COLUMN habilidades jsonb, ADD COLUMN portfolio_url text`);
    await sql(`UPDATE usuarios SET area = 'Design', habilidades = '["Python", "Interfaces"]' WHERE id = 900000002`);
    // Corrupt optional metadata must not break another person's result.
    await sql(`UPDATE usuarios SET habilidades = '"legacy-string"' WHERE id = 900000003`);
    const search = await call(profile.buscarUsuarios, { query: { q: 'Python', area: 'Design' } });
    assert.deepEqual(search.usuarios.map(u => u.id), ['900000002']);
    assert.deepEqual((await call(profile.listarAmizades)).amigos[0].habilidades, []);
    await sql(`UPDATE usuarios SET perfil_publico = false WHERE id = 900000002`);
    assert.deepEqual((await call(profile.sugerirUsuarios)).usuarios, []);
    console.log('PASS PostgreSQL: legacy 42703 reproduced; projects, eligibility, private data, profile/stats, search, malformed metadata and empty states.');
  } finally {
    db.query = query;
    await transaction.rollback();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
