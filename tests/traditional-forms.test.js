const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function formClient(kind) {
  const source = fs.readFileSync('public/js/main.js', 'utf8');
  const start = source.indexOf('function initRegister()');
  const end = source.indexOf('/* Login com Google', start);
  const field = value => ({ value, addEventListener() {} });
  const form = {
    nome_completo: field('Test Person'), nome_usuario: field('test_person'),
    email: field('person@example.invalid'), senha: field('safe-test-password'),
    id_login: field('person@example.invalid'), lembrar: { checked: true },
    addEventListener(type, callback) { this[type] = callback; },
  };
  const confirmation = field('safe-test-password');
  form.elements = { namedItem: name => name === 'confirmar-senha' ? confirmation : form[name] };
  const button = { disabled: false };
  const calls = [], messages = [], navigation = [];
  const context = {
    TextEncoder,
    location: { replace: path => navigation.push(path) },
    initGoogleLogin() {},
    $: selector => selector === '#form-' + (kind === 'register' ? 'cadastro' : 'login') ? form : selector === 'button[type=submit]' ? button : {},
    NP: {
      isEmail: email => email.includes('@'),
      setErr: (input, message) => !message,
      status: (element, message) => messages.push(message),
      api: async (path, options) => { calls.push({ path, options }); return { ok: false, status: 401, data: { mensagem: 'Invalid credentials' } }; },
      login: async () => {},
    },
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end) + `\n${kind === 'register' ? 'initRegister' : 'initLogin'}();`, context);
  return { form, button, calls, messages, navigation, NP: context.NP };
}

for (const kind of ['register', 'login']) {
  test(`${kind} blocks duplicate submissions until session verification completes`, async () => {
    const c = formClient(kind);
    let complete;
    let sent = 0;
    c.NP.api = () => { sent++; return new Promise(resolve => { complete = resolve; }); };
    const first = c.form.submit({ preventDefault() {} });
    await c.form.submit({ preventDefault() {} });
    assert.equal(sent, 1);
    assert.equal(c.button.disabled, true);
    complete({ ok: true, status: 200, data: {} });
    let finishLogin;
    c.NP.login = () => new Promise(resolve => { finishLogin = resolve; });
    await new Promise(resolve => setImmediate(resolve));
    await c.form.submit({ preventDefault() {} });
    assert.equal(sent, 1);
    finishLogin();
    await first;
    assert.equal(c.navigation[0], 'inicio.html');
  });

  test(`${kind} enables retry after session confirmation fails`, async () => {
    const c = formClient(kind);
    c.NP.api = async () => ({ ok: true, status: 200, data: {} });
    c.NP.login = async () => { throw new Error('Render temporarily unavailable'); };
    await c.form.submit({ preventDefault() {} });
    assert.equal(c.button.disabled, false);
    assert.equal(c.messages.at(-1), 'Render temporarily unavailable');
    assert.equal(c.navigation.length, 0);
  });

  test(`${kind} reports network failures as connectivity errors and permits another attempt`, async () => {
    const c = formClient(kind);
    c.NP.api = async () => ({ ok: false, status: 0, data: { mensagem: 'Connection failed' } });
    await c.form.submit({ preventDefault() {} });
    assert.equal(c.button.disabled, false);
    assert.equal(c.messages.at(-1), 'Connection failed');
  });
}
