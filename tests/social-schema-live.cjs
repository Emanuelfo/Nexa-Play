// Opt-in PostgreSQL integration. All fixtures live in TEMP tables in a rolled-back transaction.
// No public rows or columns are modified. Run: node tests/social-schema-live.cjs
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const controller = require('../src/controllers/perfilController');
const result = () => ({ code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

(async () => {
  const transaction = await db.transaction();
  const query = db.query.bind(db);
  try {
    const options = { transaction };
    await query('CREATE TEMP TABLE usuarios (LIKE public.usuarios INCLUDING DEFAULTS) ON COMMIT DROP', options);
    await query('CREATE TEMP TABLE amizades (LIKE public.amizades INCLUDING DEFAULTS) ON COMMIT DROP', options);
    await query('ALTER TABLE pg_temp.usuarios DROP COLUMN IF EXISTS area, DROP COLUMN IF EXISTS habilidades, DROP COLUMN IF EXISTS portfolio_url', options);
    await query(`INSERT INTO pg_temp.usuarios (id,nome_usuario,nome_exibicao,email,senha,perfil_publico)
      VALUES (900000001,'qa_self','Pessoa QA','self@example.invalid','fixture',true),
      (900000002,'qa_legacy','Perfil antigo','legacy@example.invalid','fixture',true),
      (900000003,'qa_private','Privado QA','private@example.invalid','fixture',false),
      (900000004,'qa_friend','Amizade QA','friend@example.invalid','fixture',false)`, options);
    await query(`INSERT INTO pg_temp.amizades (id,solicitante_id,destinatario_id,status)
      VALUES (900000001,900000001,900000004,'aceita'), (900000002,900000003,900000001,'pendente')`, options);
    // Demonstrate the original failure on an unmigrated schema using a savepoint.
    await query('SAVEPOINT legacy_failure', options);
    await assert.rejects(() => query('SELECT u.area, u.habilidades FROM pg_temp.usuarios u', options), error => error.original?.code === '42703');
    await query('ROLLBACK TO SAVEPOINT legacy_failure', options);
    db.query = (sql, settings = {}) => query(sql, { ...settings, transaction });
    const request = { usuario: { id: '900000001' }, query: {} };
    let response = result(); await controller.listarAmizades(request, response);
    assert.equal(response.code, 200); assert.equal(response.body.amigos.length, 1); assert.equal(response.body.recebidas.length, 1);
    assert.deepEqual(response.body.amigos[0].habilidades, []);
    response = result(); await controller.sugerirUsuarios(request, response);
    assert.equal(response.code, 200); assert.equal(response.body.usuarios[0].nome_usuario, 'qa_legacy');
    response = result(); await controller.buscarUsuarios({ ...request, query: { q: 'qa_legacy' } }, response);
    assert.equal(response.code, 200); assert.equal(response.body.usuarios.length, 1);
    response = result(); await controller.buscarUsuarios({ ...request, query: { area: 'Design' } }, response);
    assert.equal(response.code, 200); assert.equal(response.body.usuarios.length, 0);
    await query("ALTER TABLE pg_temp.usuarios ADD COLUMN area text, ADD COLUMN habilidades text[]", options);
    await query("UPDATE pg_temp.usuarios SET area='Design',habilidades=ARRAY['Interfaces'] WHERE id IN (900000002,900000003)", options);
    response = result(); await controller.buscarUsuarios({ ...request, query: { q: 'Interfaces', area: 'Design' } }, response);
    assert.equal(response.code, 200); assert.equal(response.body.usuarios.length, 1);
    assert.equal(response.body.usuarios[0].nome_usuario, 'qa_legacy');
    console.log('PASS: reproduced SQL 42703; legacy connections, suggestions, name search, area-only filter, modern skills and privacy all pass. Fixtures rolled back.');
  } finally { db.query = query; await transaction.rollback(); }
})().catch(error => { console.error(error.original?.code || error.name, error.message); process.exitCode = 1; }).finally(() => db.close());
