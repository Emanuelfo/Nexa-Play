const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('public/js/theme.js', 'utf8');

function boot(values = {}, blocked = false) {
  const saved = new Map(Object.entries(values));
  const events = {};
  const attrs = {};
  const button = { setAttribute: (key, value) => { attrs[key] = value; } };
  const root = { dataset: {}, hasAttribute: () => true };
  const context = {
    document: { documentElement: root, querySelectorAll: () => [button], addEventListener: (key, fn) => { events[key] = fn; } },
    window: { addEventListener: (key, fn) => { events[key] = fn; } },
    localStorage: { getItem: key => { if (blocked) throw new Error('storage unavailable'); return saved.get(key) ?? null; }, setItem: (key, value) => { if (blocked) throw new Error('storage unavailable'); saved.set(key, value); } },
    console: { warn() {} },
    Element: class Element {},
  };
  vm.runInNewContext(source, context);
  const click = () => { const target = new context.Element(); target.closest = () => button; events.click({ target }); };
  return { root, attrs, saved, click, events };
}

test('sem preferência, ou com armazenamento bloqueado, a área social inicia no escuro', () => {
  assert.equal(boot().root.dataset.theme, 'dark');
  assert.equal(boot({}, true).root.dataset.theme, 'dark');
});
test('escolhas claras e escuras salvas são respeitadas na recarga', () => {
  for (const theme of ['light', 'dark']) assert.equal(boot({ np_social_theme: theme }).root.dataset.theme, theme);
});
test('preferência legada é migrada sem trocar a escolha explícita', () => {
  const page = boot({ np_theme: 'light' });
  assert.equal(page.root.dataset.theme, 'light');
  assert.equal(page.saved.get('np_social_theme'), 'light');
});
test('alternância persiste a escolha e sincroniza o botão', () => {
  const page = boot();
  page.click();
  assert.equal(page.root.dataset.theme, 'light');
  assert.equal(page.attrs['aria-pressed'], 'false');
  assert.equal(boot(Object.fromEntries(page.saved)).root.dataset.theme, 'light');
  page.click();
  assert.equal(page.root.dataset.theme, 'dark');
  assert.equal(page.attrs['aria-pressed'], 'true');
  assert.equal(boot(Object.fromEntries(page.saved)).root.dataset.theme, 'dark');
});
test('eventos entre abas e remoção da preferência mantêm um tema válido', () => {
  const page = boot();
  page.events.storage({ key: 'np_social_theme', newValue: 'light' });
  assert.equal(page.root.dataset.theme, 'light');
  page.events.storage({ key: 'np_social_theme', newValue: null });
  assert.equal(page.root.dataset.theme, 'dark');
});
test('todas as páginas sociais têm fallback escuro antes do JavaScript', () => {
  for (const name of fs.readdirSync('public/paginas')) {
    if (!name.endsWith('.html')) continue;
    const html = fs.readFileSync(`public/paginas/${name}`, 'utf8');
    if (html.includes('data-social-theme')) assert.match(html, /data-social-theme data-theme="dark"/, name);
  }
});
