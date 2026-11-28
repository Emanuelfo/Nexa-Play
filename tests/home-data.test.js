const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync('public/js/main.js', 'utf8').split('function prepareSocialForm(')[0];
function context(api) {
  const ctx = vm.createContext({ NP: { api }, console });
  vm.runInContext(source, ctx);
  return ctx;
}
test('Home and destination pages share endpoints and preserve request options', async () => {
  const calls = [];
  const ctx = context(async (path, options) => { calls.push({ path, options }); return { ok: true, data: { usuarios: [], projetos: [] } }; });
  await vm.runInContext("suggestedPeople()", ctx);
  await vm.runInContext("publicProjects('limite=3&cursor=50', {signal:'signal'})", ctx);
  assert.equal(calls[0].path, '/usuarios/sugestoes');
  assert.equal(calls[1].path, '/projetos?limite=3&cursor=50');
  assert.equal(calls[1].options.signal, 'signal');
});
test('invalid responses and offline errors remain errors, not empty successful lists', async () => {
  for (const data of [null, {}, { usuarios: 'invalid' }]) {
    const ctx = context(async () => ({ ok: true, data }));
    const response = await vm.runInContext('suggestedPeople()', ctx);
    assert.equal(response.ok, false);
    assert.ok(response.data.mensagem);
  }
  const ctx = context(async () => { throw new Error('offline'); });
  assert.equal((await vm.runInContext('suggestedPeople()', ctx)).ok, false);
});
test('valid empty lists remain distinguishable from errors and malformed records are isolated', async () => {
  const ctx = context(async () => ({ ok: true, data: { usuarios: [null, {}, {id:'2'}, {id:'3', habilidades:null}] } }));
  const response = await vm.runInContext('suggestedPeople()', ctx);
  assert.equal(response.ok, true);
  assert.deepEqual(response.data.usuarios.map(u => u.id), ['2', '3']);
  assert.equal((await vm.runInContext('suggestedPeople()', context(async () => ({ok:true, data:{usuarios:[]}})))).data.usuarios.length, 0);
});
test('legacy and malformed optional metadata does not interrupt summary or skills', () => {
  const ctx = context(async () => ({}));
  assert.equal(vm.runInContext("projectSummary({descricao:'Primeira frase. Segunda frase.'})",ctx), 'Primeira frase.');
  assert.equal(vm.runInContext('projectSummary({descricao:123, resumo:{}})',ctx), '');
  assert.equal(vm.runInContext("personSkills({habilidades:'Python'}).length",ctx), 0);
  assert.equal(vm.runInContext("personSkills({habilidades:['Python',null,42,'']}).join(',')",ctx), 'Python');
});
