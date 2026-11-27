// Regressões estáticas: cabeçalhos do frontend (A15), remoção do Google e ausência de recuperação de senha.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = caminho => fs.readFileSync(path.join(raiz, caminho), 'utf8');
function arquivos(dir, extensoes, saida = []) {
  for (const nome of fs.readdirSync(path.join(raiz, dir), { withFileTypes: true })) {
    const rel = path.join(dir, nome.name);
    if (nome.isDirectory()) arquivos(rel, extensoes, saida);
    else if (extensoes.some(e => nome.name.endsWith(e))) saida.push(rel);
  }
  return saida;
}

test('vercel.json e public/vercel.json são idênticos e têm CSP estrita para os documentos', () => {
  const a = JSON.parse(ler('vercel.json'));
  const b = JSON.parse(ler('public/vercel.json'));
  assert.deepEqual(a.headers, b.headers);
  assert.deepEqual(a.rewrites, b.rewrites);
  const todos = a.headers.find(h => h.source === '/(.*)').headers;
  const valor = chave => todos.find(h => h.key === chave)?.value;
  const csp = valor('Content-Security-Policy');
  assert.ok(csp, 'CSP presente');
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /frame-src [^;]*https:\/\/itch\.io/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.doesNotMatch(csp, /google/i);
  assert.equal(valor('X-Content-Type-Options'), 'nosniff');
  assert.ok(valor('Referrer-Policy') && valor('Permissions-Policy') && valor('Strict-Transport-Security'));
});

test('páginas não usam estilos nem scripts inline (compatível com a CSP)', () => {
  for (const arquivo of ['public/index.html', ...arquivos('public/paginas', ['.html'])]) {
    const html = ler(arquivo);
    assert.doesNotMatch(html, /\sstyle="/, `${arquivo}: atributo style inline`);
    assert.doesNotMatch(html, /<style[\s>]/, `${arquivo}: <style>`);
    assert.doesNotMatch(html, /<script(?![^>]*\ssrc=)[^>]*>/, `${arquivo}: script inline`);
    assert.doesNotMatch(html, /\son[a-z]+="/i, `${arquivo}: manipulador inline`);
  }
});

test('não há recursos externos além do itch.io e do YouTube nos arquivos do site', () => {
  const permitidos = /^https?:\/\/(itch\.io|www\.youtube(-nocookie)?\.com|www\.w3\.org)/;
  for (const arquivo of ['public/index.html', ...arquivos('public/paginas', ['.html']), ...arquivos('public/css', ['.css'])]) {
    for (const [url] of ler(arquivo).matchAll(/(?:src|href)="(https?:\/\/[^"]+)"|url\((https?:\/\/[^)]+)\)|@import\s+url\((https?:\/\/[^)]+)\)/g)) {
      const endereco = url.match(/https?:\/\/[^"')]+/)[0];
      if (/^https?:\/\/(github\.com|www\.instagram\.com|www\.linkedin\.com)/.test(endereco)) continue; // links de navegação
      assert.match(endereco, permitidos, `${arquivo}: recurso externo inesperado ${endereco}`);
    }
  }
});

test('login com Google e recuperação de senha não existem mais no código nem na interface', () => {
  const fontes = [
    ...arquivos('src', ['.js']), ...arquivos('public', ['.html', '.js', '.css']),
    '.env.example', 'package.json',
  ];
  for (const arquivo of fontes) {
    const texto = ler(arquivo);
    assert.doesNotMatch(texto, /accounts\.google|google-auth-library|GOOGLE_CLIENT_ID|initGoogleLogin|googleVinculo|google_sub/i, `${arquivo}: referência ao Google`);
    assert.doesNotMatch(texto, /esqueci minha senha|recuperar senha|redefinir senha/i, `${arquivo}: recuperação de senha`);
  }
  assert.equal(fs.existsSync(path.join(raiz, 'src/controllers/googleAuthController.js')), false);
  assert.equal(fs.existsSync(path.join(raiz, 'src/services/googleAuth.js')), false);
});
