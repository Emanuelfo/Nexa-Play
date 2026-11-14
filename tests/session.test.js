const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// Isolated store exercises the actual JWT/cookie middleware without touching user data.
const revoked = new Set();
const databasePath = require.resolve('../src/config/database');
require.cache[databasePath] = { id: databasePath, filename: databasePath, loaded: true, exports: {
  async query(sql, options) {
    if (sql.startsWith('SELECT')) return revoked.has(options.replacements.hash) ? [{ found: 1 }] : [];
    if (sql.includes('INSERT INTO public.jwt_revocations')) revoked.add(options.replacements.hash);
    return [];
  },
} };
process.env.JWT_SECRET = 'isolated-session-tests-secret-at-least-32-bytes';
const session = require('../src/services/session');
const auth = require('../src/middlewares/auth');

function response() {
  return {
    statusCode: 200,
    cookie(name, value, options) { this.saved = { name, value, options }; },
    clearCookie(name, options) { this.cleared = { name, options }; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('cookie uses HttpOnly, HTTPS Secure, Lax and API-only scope; persistence follows JWT expiry', () => {
  const token = jwt.sign({ id: '12' }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const res = response();
  session.setSession({ secure: true }, res, token, true);
  assert.equal(res.saved.options.httpOnly, true);
  assert.equal(res.saved.options.secure, true);
  assert.equal(res.saved.options.sameSite, 'lax');
  assert.equal(res.saved.options.path, '/api');
  assert.equal(res.saved.options.domain, undefined);
  assert(res.saved.options.maxAge <= 30 * 86400000);
  assert(res.saved.options.maxAge > 29 * 86400000);
  session.setSession({ secure: false }, res, token, false);
  assert.equal(res.saved.options.maxAge, undefined);
});

test('valid JWT survives independent requests, then logout revokes cookie and legacy Bearer copies', async () => {
  const token = jwt.sign({ id: '21' }, process.env.JWT_SECRET, { expiresIn: '8h', jwtid: 'logout-test' });
  for (let attempt = 0; attempt < 2; attempt++) {
    const req = { headers: { cookie: `nexa_session=${token}` } };
    let accepted = false;
    await auth(req, response(), () => { accepted = true; });
    assert(accepted);
    assert.equal(req.usuario.id, '21');
  }
  await session.revoke(token, jwt.decode(token).exp);
  for (const headers of [{ cookie: `nexa_session=${token}` }, { authorization: `Bearer ${token}` }]) {
    const res = response();
    await auth({ headers }, res, () => assert.fail('Revoked JWT accepted'));
    assert.equal(res.statusCode, 401);
    assert(res.cleared);
  }
});

test('missing, expired, malformed and invalidly signed tokens cannot access protected data', async () => {
  const expired = jwt.sign({ id: '12', exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
  const wrong = jwt.sign({ id: '12' }, 'different-secret', { expiresIn: '8h' });
  for (const token of ['', expired, wrong, 'bad-token', '%E0%A4%A']) {
    const res = response();
    await auth({ headers: { cookie: `nexa_session=${token}` } }, res, () => assert.fail('Invalid session accepted'));
    assert.equal(res.statusCode, 401);
  }
});

test('migration preserves the original expiration, including persistent legacy tokens', () => {
  const token = jwt.sign({ id: '13' }, process.env.JWT_SECRET, { expiresIn: 900 });
  const res = response();
  session.setSession({ secure: true }, res, token, true);
  assert.equal(res.saved.value, token);
  assert(res.saved.options.maxAge <= 900000);
});
