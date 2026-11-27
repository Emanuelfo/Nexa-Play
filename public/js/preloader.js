/* Preloader do Nexa Quest: decide quando a interface está pronta e a revela com um fade de opacidade.
   Reutilizável: qualquer página com <html class="np-loading"> + #np-preloader + este script (primeiro da lista, com defer).

   A página só é revelada quando TUDO isto estiver pronto:
     1. gate "app": o boot da página (main.js) terminou: sessão verificada e shell/rodapé montados;
     2. todas as folhas de estilo carregadas;
     3. fontes usadas no 1º viewport carregadas        (espera limitada: FONT_CAP);
     4. imagens essenciais do 1º viewport decodificadas (espera limitada: IMG_CAP): nada com loading="lazy";
     5. dados "suaves" registrados com NPLoader.track() (ex.: perfil do usuário) (espera limitada).
   Não há atraso artificial: a revelação acontece no mesmo quadro em que a última condição fica pronta.

   Segurança contra travamento (em camadas):
     - MAX_WAIT: depois de 12 s a página é revelada de qualquer jeito;
     - erro ao carregar script/folha de estilo: revela na hora;
     - CSS (preloader.css): se este script nunca rodar, o preloader some sozinho em 14 s;
     - sem JavaScript: <noscript> carrega preloader-off.css. */
(() => {
  'use strict';
  const root = document.documentElement;
  if (!root.classList.contains('np-loading')) return;

  const MAX_WAIT = 12000;
  const FONT_CAP = 2500;
  const IMG_CAP = 3000;
  const holds = new Set(['app']);
  const soft = [];
  const inerted = [];
  let revealed = false;
  let wake = null;
  const tick = performance.now();

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const cap = (promise, ms) => Promise.race([Promise.resolve(promise).catch(() => {}), sleep(ms)]);
  const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
  const overlay = () => document.getElementById('np-preloader');

  /* O conteúdo coberto não recebe foco nem é lido por leitores de tela enquanto carrega. */
  function lock() {
    const cover = overlay();
    for (const el of document.body.children) {
      if (el === cover || el.hasAttribute('inert') || /^(SCRIPT|LINK|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
      el.setAttribute('inert', '');
      inerted.push(el);
    }
  }

  function reveal(reason) {
    if (revealed) return;
    revealed = true;
    clearTimeout(watchdog);
    for (const el of inerted) el.removeAttribute('inert');
    root.classList.remove('np-loading');
    root.classList.add('np-ready');
    const cover = overlay();
    if (cover) {
      const remove = () => cover.remove();
      cover.addEventListener('transitionend', event => { if (event.target === cover && event.propertyName === 'opacity') remove(); }, { once: true });
      setTimeout(remove, 700);
    }
    try { performance.mark('np-ready'); } catch { /* sem User Timing */ }
    root.dataset.npReason = reason;
    dispatchEvent(new CustomEvent('np:ready', { detail: { reason, ms: Math.round(performance.now() - tick) } }));
  }

  /* Folhas de estilo: aguarda as que ainda não carregaram (inclui as que ficam no <body>). */
  function stylesReady() {
    const pending = [...document.querySelectorAll('link[rel~="stylesheet"]')]
      .filter(link => !link.sheet && !link.disabled && !/preloader/.test(link.href))
      .map(link => new Promise(resolve => {
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', resolve, { once: true });
      }));
    return Promise.all(pending);
  }

  const inViewport = el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };

  /* Fontes: só as combinações (família, peso, estilo) usadas por texto visível no primeiro viewport. */
  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const jobs = new Map();
    const nodes = document.body.querySelectorAll('h1,h2,h3,h4,p,a,button,label,span,li,strong,small,summary,b,em,dt,dd,th,td,input,textarea');
    let seen = 0;
    for (const el of nodes) {
      if (++seen > 600) break;
      if (el.closest('#np-preloader') || !inViewport(el)) continue;
      const own = [...el.childNodes].find(node => node.nodeType === 3 && node.textContent.trim());
      const text = (own ? own.textContent : el.placeholder || '').trim().slice(0, 24);
      if (!text) continue;
      const cs = getComputedStyle(el);
      const key = `${cs.fontStyle}|${cs.fontWeight}|${cs.fontFamily}`;
      if (!jobs.has(key)) jobs.set(key, [`${cs.fontStyle} ${cs.fontWeight} 16px ${cs.fontFamily}`, text]);
    }
    return Promise.allSettled([...jobs.values()].map(([font, text]) => document.fonts.load(font, text)));
  }

  /* Imagens essenciais: <img> não-lazy no primeiro viewport e fundos CSS (url) de elementos visíveis nele. */
  function imagesReady() {
    const urls = new Set();
    const waits = [];
    for (const img of document.images) {
      if (img.closest('#np-preloader') || img.loading === 'lazy' || img.getAttribute('fetchpriority') === 'low') continue;
      if (!img.currentSrc && !img.src) continue;
      if (img.complete && img.naturalWidth) continue;
      if (inViewport(img)) waits.push(img.decode ? img.decode() : new Promise(resolve => { img.onload = img.onerror = resolve; }));
    }
    let seen = 0;
    for (const el of document.body.querySelectorAll('*')) {
      if (++seen > 900) break;
      if (el.closest('#np-preloader') || !inViewport(el)) continue;
      const bg = getComputedStyle(el).backgroundImage;
      if (!bg || bg === 'none' || bg.indexOf('url(') < 0) continue;
      for (const match of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) if (!match[1].startsWith('data:')) urls.add(match[1]);
    }
    for (const url of [...urls].slice(0, 10)) {
      const img = new Image();
      img.src = url;
      waits.push(img.decode ? img.decode() : Promise.resolve());
    }
    return Promise.allSettled(waits);
  }

  async function run() {
    await stylesReady();
    if (holds.size) await new Promise(resolve => { wake = resolve; });
    await Promise.all([cap(fontsReady(), FONT_CAP), cap(imagesReady(), IMG_CAP), ...soft]);
    await frame();
    reveal('ready');
  }

  const watchdog = setTimeout(() => reveal('timeout'), MAX_WAIT);

  /* Falha ao baixar script ou folha de estilo: não faz sentido segurar o usuário. */
  addEventListener('error', event => {
    const target = event.target;
    if (target && target !== window && /^(SCRIPT|LINK)$/.test(target.tagName)) reveal('resource-error');
  }, true);

  window.NPLoader = {
    /* Segura a revelação até release(nome). O gate "app" já nasce segurado e é liberado pelo main.js. */
    hold(name) { if (!revealed) holds.add(name); },
    release(name) {
      holds.delete(name);
      if (!holds.size && wake) { const go = wake; wake = null; go(); }
    },
    /* Registra uma promessa "suave": a revelação a aguarda por até `ms`, nunca além. */
    track(promise, ms = 1500) { if (!revealed) soft.push(cap(promise, ms)); },
    reveal,
    get ready() { return revealed; },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', lock, { once: true });
  else lock();
  run().catch(() => reveal('error'));
})();
