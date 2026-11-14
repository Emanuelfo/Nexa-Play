const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function client(replies, legacy = null) {
  const calls = [], navigation = [];
  const localStorage = new Map(legacy ? [['np_token', legacy]] : []);
  const sessionStorage = new Map();
  for (const storage of [localStorage, sessionStorage]) {
    storage.getItem = key => storage.get(key) || null;
    storage.removeItem = key => storage.delete(key);
  }
  const context = {
    document: { body: { dataset: { root: '' } } },
    localStorage, sessionStorage, AbortController, setTimeout, clearTimeout,
    location: { assign: url => navigation.push(url), replace: url => navigation.push(url) },
    addEventListener() {},
    async fetch(url, options) {
      calls.push({ url, options });
      const result = replies.shift();
      if (result instanceof Error) throw result;
      return { ok: result.status >= 200 && result.status < 300, status: result.status, text: async () => JSON.stringify(result.data || {}) };
    },
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('public/js/functions.js', 'utf8') + '\nglobalThis.NP = NP;', context);
  const messages = [];
  context.NP.toast = text => messages.push(text);
  return { ...context, calls, navigation, messages };
}

test('entry validates before choosing login or the internal home, with same-origin credentials', async () => {
  for (const status of [200, 401]) {
    const c = client([{ status, data: { id: '1' } }]);
    await c.NP.enterPlatform();
    assert.equal(c.calls[0].url, '/api/me');
    assert.equal(c.calls[0].options.credentials, 'same-origin');
    assert.equal(c.calls[0].options.cache, 'no-store');
    assert.equal(c.navigation[0], status === 200 ? 'paginas/inicio.html' : 'paginas/login.html');
    assert.equal(c.calls[0].options.headers.Authorization, undefined);
  }
});

test('temporary outages preserve legacy credentials and do not redirect to login', async () => {
  const c = client([new Error('offline')], 'existing-jwt');
  await c.NP.enterPlatform();
  assert.equal(c.navigation.length, 0);
  assert.equal(c.localStorage.get('np_token'), 'existing-jwt');
  assert.equal(c.messages.length, 1);
});

test('legacy migration removes localStorage credentials after cookie exchange and checks /me', async () => {
  const c = client([{ status: 204 }, { status: 200, data: { id: '1' } }], 'legacy-jwt');
  await c.NP.loadUser();
  assert.equal(c.calls[0].url, '/api/auth/session');
  assert.equal(c.calls[0].options.headers.Authorization, 'Bearer legacy-jwt');
  assert.equal(c.localStorage.has('np_token'), false);
  assert.equal(c.NP.currentUser().id, '1');
});

test('logout waits for server success and reports failure without claiming the session ended', async () => {
  const success = client([{ status: 204 }]);
  success.NP._user = { id: '1' };
  await success.NP.signOut();
  assert.equal(success.NP.currentUser(), null);
  assert.equal(success.navigation[0], 'index.html');
  const failure = client([{ status: 503 }]);
  failure.NP._user = { id: '1' };
  await failure.NP.signOut();
  assert.equal(failure.navigation.length, 0);
  assert.equal(failure.NP.currentUser().id, '1');
});

test('simultaneous validations share one request', async () => {
  const c = client([{ status: 200, data: { id: '1' } }]);
  await Promise.all([c.NP.loadUser(), c.NP.loadUser()]);
  assert.equal(c.calls.length, 1);
});
