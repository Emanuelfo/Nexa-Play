// Run manually with npm start running. Uses DATABASE_URL and removes its own fixture.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const Usuario = require('../src/models/Usuario');

async function run() {
  const base = 'http://127.0.0.1:3000/api';
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  const email = `auth-test-${suffix}@example.invalid`;
  const password = crypto.randomUUID();
  let revokedToken;
  // A distinct simulated proxy client keeps this local fixture within its own rate-limit quota.
  const clientIp = `2001:db8:${crypto.randomBytes(2).toString('hex')}::1`;
  const headers = { 'Content-Type': 'application/json', 'X-Nexa-Request': '1', 'X-Forwarded-Proto': 'https', 'X-Forwarded-For': clientIp };
  const post = (path, body, extraHeaders = {}) => fetch(base + path, {
    method: 'POST', headers: { ...headers, ...extraHeaders }, body: JSON.stringify(body),
  });
  try {
    let response = await fetch(base + '/me');
    assert.equal(response.status, 401);
    response = await fetch(base + '/logout', { method: 'POST' });
    assert.equal(response.status, 403);
    response = await fetch(base + '/me', { headers: { Origin: 'https://untrusted.example' } });
    assert.equal(response.status, 403);
    response = await fetch(base + '/logout', {
      method: 'OPTIONS',
      headers: { Origin: 'https://nexaquest-kappa.vercel.app', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'x-nexa-request,content-type' },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://nexaquest-kappa.vercel.app');

    response = await post('/usuarios', { nome_completo: 'Temporary authentication test', nome_usuario: `authtest_${suffix}`, email, senha: password });
    assert.equal(response.status, 201);
    const signup = await response.json();
    assert.equal(signup.token, undefined);
    const stored = await Usuario.findByPk(signup.usuario.id, { attributes: ['senha'] });
    assert.notEqual(stored.senha, password);
    assert.match(stored.senha, /^\$2[aby]\$/);
    let setCookie = response.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Secure/i);
    assert(!/Max-Age=/i.test(setCookie));
    const legacyToken = decodeURIComponent(setCookie.split(';')[0].split('=')[1]);
    response = await post('/auth/session', { lembrar: true }, { Authorization: `Bearer ${legacyToken}` });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('set-cookie'), /Max-Age=/i);

    response = await post('/usuarios', { nome_completo: 'Duplicate test', nome_usuario: `duplicate_${suffix}`, email: email.toUpperCase(), senha: password });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).campo, 'email');
    response = await post('/login', { id_login: email, senha: 'incorrect-test-password' });
    assert.equal(response.status, 401);
    response = await post('/login', { id_login: email, senha: password, lembrar: false });
    assert.equal(response.status, 200);
    assert(!/Max-Age=/i.test(response.headers.get('set-cookie')));

    response = await post('/login', { id_login: email, senha: password, lembrar: true });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).token, undefined);
    setCookie = response.headers.get('set-cookie');
    assert.match(setCookie, /Max-Age=25919\d+/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert(!/Domain=/i.test(setCookie));
    const cookie = setCookie.split(';')[0];
    revokedToken = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
    for (let page = 0; page < 2; page++) {
      response = await fetch(base + '/me', { headers: { Cookie: cookie } });
      assert.equal(response.status, 200);
      assert.equal(String((await response.json()).id), String(signup.usuario.id));
      assert.match(response.headers.get('cache-control'), /no-store/);
    }
    const expired = jwt.sign({ id: String(signup.usuario.id), exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
    response = await fetch(base + '/me', { headers: { Cookie: `nexa_session=${expired}` } });
    assert.equal(response.status, 401);
    response = await post('/logout', {}, { Cookie: cookie });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i);
    response = await fetch(base + '/me', { headers: { Cookie: cookie } });
    assert.equal(response.status, 401);
    response = await fetch(base + '/me', { headers: { Authorization: `Bearer ${revokedToken}` } });
    assert.equal(response.status, 401);
    console.log('PASS live Express/PostgreSQL: protected access, CSRF/CORS, signup, password hash, duplicate email, wrong password, temporary/persistent cookies, migration, repeated authenticated requests, expiry and logout revocation.');
  } finally {
    await Usuario.destroy({ where: { email } });
    if (revokedToken) {
      await Usuario.sequelize.query('DELETE FROM public.jwt_revocations WHERE token_hash = :hash', {
        replacements: { hash: crypto.createHash('sha256').update(revokedToken).digest('hex') },
      });
    }
    console.log('Temporary test account and its revocation record removed.');
  }
}

run().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => Usuario.sequelize.close());
