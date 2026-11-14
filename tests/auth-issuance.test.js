const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.JWT_SECRET = 'isolated-auth-tests-secret-at-least-32-bytes';
const users = [];
const revoked = new Set();
function stub(modulePath, exports) {
  const id = require.resolve(modulePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}
stub('../src/config/database', {
  async query(sql, options) {
    if (sql.startsWith('SELECT')) return revoked.has(options.replacements.hash) ? [{ found: 1 }] : [];
    if (sql.includes('INSERT INTO public.jwt_revocations')) revoked.add(options.replacements.hash);
    return [];
  },
});
stub('../src/models/Usuario', {
  async findOne({ where }) {
    return users.find(user => Object.entries(where).every(([key, value]) => user[key] === value)) || null;
  },
  async findByPk(id) { return users.find(user => String(user.id) === String(id)) || null; },
  async create(values) { const user = { id: String(users.length + 1), ...values }; users.push(user); return user; },
});
class InvalidGoogleToken extends Error {}
stub('../src/services/googleAuth', {
  async verificarIdToken(credential) {
    if (credential !== 'verified-google-fixture') throw new InvalidGoogleToken();
    return { sub: 'google-fixture', email: 'google@example.invalid', nome: 'Google fixture' };
  },
  googleConfigurado: () => true,
  clientId: () => 'fixture.apps.googleusercontent.com',
  gerarTokenVinculo: () => 'temporary-link-fixture',
  lerTokenVinculo: () => null,
  GoogleTokenInvalidoError: InvalidGoogleToken,
  GoogleEmailNaoVerificadoError: class extends Error {},
  GoogleIndisponivelError: class extends Error {},
});
stub('../src/middlewares/rateLimit', { createRateLimiter: () => (req, res, next) => next() });
const controller = require('../src/controllers/usuarioController');
const auth = require('../src/middlewares/auth');

test('password, registration and Google issue the same session; refresh and server logout use that session', async () => {
  const app = express();
  app.use(express.json());
  app.post('/api/usuarios', controller.cadastrar);
  app.get('/api/me', auth, controller.me);
  app.use(require('../src/routes/authRoutes'));
  const server = await new Promise(resolve => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (path, body, cookie) => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
  try {
    let result = await post('/usuarios', { nome_completo: 'Fixture', nome_usuario: 'fixture', email: 'fixture@example.invalid', senha: 'valid-test-password' });
    assert.equal(result.status, 201);
    assert.equal((await result.json()).token, undefined);
    assert.match(result.headers.get('set-cookie'), /HttpOnly/);
    assert(!result.headers.get('set-cookie').includes('Max-Age'));
    result = await post('/login', { id_login: 'fixture@example.invalid', senha: 'wrong-password' });
    assert.equal(result.status, 401);
    result = await post('/login', { id_login: 'fixture@example.invalid', senha: 'valid-test-password', lembrar: true });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).token, undefined);
    assert.match(result.headers.get('set-cookie'), /Max-Age=25919\d+/);
    const cookie = result.headers.get('set-cookie').split(';')[0];
    for (let page = 0; page < 2; page++) {
      result = await fetch(base + '/me', { headers: { Cookie: cookie } });
      assert.equal(result.status, 200);
    }
    result = await post('/logout', {}, cookie);
    assert.equal(result.status, 204);
    result = await fetch(base + '/me', { headers: { Cookie: cookie } });
    assert.equal(result.status, 401);
    result = await post('/auth/google', { credential: 'verified-google-fixture', lembrar: true });
    assert.equal(result.status, 200);
    assert.equal((await result.json()).token, undefined);
    assert.match(result.headers.get('set-cookie'), /HttpOnly/);
    assert.match(result.headers.get('set-cookie'), /Max-Age=/);
    const googleCookie = result.headers.get('set-cookie').split(';')[0];
    result = await fetch(base + '/me', { headers: { Cookie: googleCookie } });
    assert.equal(result.status, 200);
    result = await post('/logout', {}, googleCookie);
    assert.equal(result.status, 204);
    result = await fetch(base + '/me', { headers: { Cookie: googleCookie } });
    assert.equal(result.status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
