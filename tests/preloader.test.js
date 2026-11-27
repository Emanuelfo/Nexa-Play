// Contrato do preloader: presença em todas as páginas, ordem de recursos e compatibilidade com a CSP estrita.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = caminho => fs.readFileSync(path.join(raiz, caminho), 'utf8');
const paginas = ['public/index.html', ...fs.readdirSync(path.join(raiz, 'public/paginas'))
  .filter(nome => nome.endsWith('.html') && nome !== 'saiba-mais.html').map(nome => `public/paginas/${nome}`)];

test('toda página tem o preloader, preloader.css como 1ª folha e preloader.js como 1º script', () => {
  for (const arquivo of paginas) {
    const html = ler(arquivo);
    const head = html.slice(html.indexOf('<head>'), html.indexOf('</head>'));
    const corpo = html.slice(html.indexOf('<body'));
    assert.match(html, /<html class="np-loading"/, `${arquivo}: html.np-loading`);
    const folhas = [...head.replace(/<noscript>[\s\S]*?<\/noscript>/g, '').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(folhas.map(h => h.split('/').pop()), ['preloader.css'], `${arquivo}: só preloader.css no head`);
    assert.match(head, /<noscript><link rel="stylesheet" href="[^"]*preloader-off\.css"><\/noscript>/, `${arquivo}: fallback sem JS`);
    const scripts = [...head.matchAll(/<script src="([^"]+)"( defer)?/g)].filter(m => m[2]).map(m => m[1].split('/').pop());
    assert.equal(scripts[0], 'preloader.js', `${arquivo}: preloader.js primeiro`);
    assert.ok(scripts.includes('main.js'), `${arquivo}: main.js presente`);
    const abre = corpo.indexOf('id="np-preloader"');
    assert.ok(abre > 0 && abre < corpo.indexOf('<link rel="stylesheet"'), `${arquivo}: preloader antes das folhas pesadas`);
    assert.match(corpo, /golfinho-fone\.svg/, `${arquivo}: mascote original`);
    assert.equal(/session-check\.js/.test(html), false, `${arquivo}: session-check.js foi substituído pelo preloader`);
  }
});

test('páginas com sessão antecipam a verificação (session-boot.js entre functions.js e main.js)', () => {
  const comSessao = paginas.filter(a => /data-protected/.test(ler(a)) || a.endsWith('login.html'));
  assert.ok(comSessao.length >= 11);
  for (const arquivo of comSessao) {
    const ordem = [...ler(arquivo).matchAll(/<script src="[^"]*\/([a-z-]+)\.js" defer/g)].map(m => m[1]);
    assert.ok(ordem.indexOf('functions') < ordem.indexOf('session-boot') && ordem.indexOf('session-boot') < ordem.indexOf('main'), arquivo);
  }
});

test('páginas da área logada carregam fontes.css direto (sem cadeia @import) e pré-carregam as fontes', () => {
  assert.doesNotMatch(ler('public/css/social.css'), /@import/);
  for (const arquivo of paginas.filter(a => /data-protected/.test(ler(a)))) {
    const html = ler(arquivo);
    assert.match(html, /<link rel="stylesheet" href="\.\.\/css\/fontes\.css">/, arquivo);
    assert.match(html, /rel="preload" href="\.\.\/assets\/fontes\/fredoka-latin-wght-normal\.woff2"/, arquivo);
    assert.match(html, /rel="preload" href="\.\.\/assets\/fontes\/inter-latin-wght-normal\.woff2"/, arquivo);
  }
});

test('preloader.css: navy da marca, sem degradê/glow e com rede de segurança em CSS', () => {
  const css = ler('public/css/preloader.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /#091e5b/i);
  assert.doesNotMatch(css, /gradient|box-shadow|filter|blur|@import/);
  assert.match(css, /animation: np-failsafe/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('preloader.js: gates, limites de espera e sem atraso artificial', () => {
  const js = ler('public/js/preloader.js');
  assert.match(js, /MAX_WAIT = 12000/);
  assert.match(js, /addEventListener\('error'/);
  assert.match(js, /NPLoader/);
  assert.doesNotMatch(js, /\beval\b|innerHTML|document\.write/);
});

test('main.js libera o preloader sempre (finally) e mantém a página oculta só quando vai navegar', () => {
  const js = ler('public/js/main.js');
  assert.match(js, /finally \{\s*if \(!keepLoader\) loader\?\.release\('app'\)/);
  assert.match(js, /NP\._boot \|\| NP\.loadUser\(\)/);
});
