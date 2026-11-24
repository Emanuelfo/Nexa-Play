import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const PUBLIC = '/home/claude/proj/nexaplay/public';
export const cfg = { modo: 'fluid', embed: 'fluid', largura: 1920, altura: 1080 };
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webp': 'image/webp', '.jpeg': 'image/jpeg' };

export function startServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/me') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ id: '1', nome_usuario: 'tester', nome_exibicao: 'Tester', email: 't@t.t' }));
    }
    if (url.pathname === '/api/jogo') {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ titulo: 'NEXA QUEST', url: 'https://itch.io/embed-upload/20479421?color=000000', largura: cfg.largura, altura: cfg.altura, modo: cfg.modo }));
    }
    if (url.pathname.startsWith('/api/')) {
      res.statusCode = 404; res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ mensagem: 'mock' }));
    }
    const file = path.join(PUBLIC, decodeURIComponent(url.pathname));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.statusCode = 404; return res.end('nf'); }
    res.setHeader('content-type', MIME[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

// Página que imita o embed do itch.io: área do jogo + barra inferior com o botão "Fullscreen" nativo.
function embedHtml(kind) {
  const game = kind === 'fixed'
    ? 'width:1920px;height:1080px'
    : 'width:100%;height:calc(100% - 28px)';
  return `<!doctype html><meta charset=utf-8><style>
  html,body{margin:0;${kind === 'fixed' ? '' : 'height:100%;'}background:#222;font:12px sans-serif;color:#fff}
  .g{${game};position:relative;background:linear-gradient(135deg,#243b6b,#0a1a3a);overflow:hidden}
  .c{position:absolute;width:60px;height:60px}
  .tl{left:0;top:0;background:#e53935}.tr{right:0;top:0;background:#43a047}.bl{left:0;bottom:0;background:#1e88e5}.br{right:0;bottom:0;background:#fdd835}
  .t{position:absolute;inset:0;display:grid;place-content:center;font-size:48px}
  .bar{height:28px;display:flex;justify-content:space-between;align-items:center;padding:0 8px;background:#111}
  </style><div class=g><div class="c tl"></div><div class="c tr"></div><div class="c bl"></div><div class="c br"></div><div class=t>NEXA QUEST (${kind})</div></div>
  <div class=bar><span>itch.io</span><button id=nativefs>Fullscreen</button></div>
  <script>window.__id=Math.random().toString(36).slice(2);window.__t=Date.now();</script>`;
}

export async function newBrowser() {
  return puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: await chromium.executablePath(), headless: 'shell' });
}

export const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, ua: null },
  android: { viewport: { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
    ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' },
  iphone: { viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
};

// opts.noFullscreenApi: imita o Safari do iPhone (sem Fullscreen API para elementos).
// opts.orientation: 'chrome' (lock funciona e gira o aparelho) | 'reject' (lock falha) | 'absent' (sem API).
export async function openGame(browser, deviceName, { noFullscreenApi = false, orientation = 'native', embed = 'fluid', modo = 'fluid' } = {}) {
  cfg.embed = embed; cfg.modo = modo;
  const dev = DEVICES[deviceName];
  const page = await browser.newPage();
  await page.setViewport(dev.viewport);
  if (dev.ua) await page.setUserAgent(dev.ua);
  const log = { lock: [], unlock: 0, errors: [] };
  await page.exposeFunction('__log', (k, v) => { if (k === 'lock') log.lock.push(v); else if (k === 'unlock') log.unlock++; });
  await page.evaluateOnNewDocument((noFs, orient) => {
    if (noFs) {
      delete Element.prototype.requestFullscreen;
      delete Element.prototype.webkitRequestFullscreen;
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => false });
    }
    if (orient !== 'native' && screen.orientation) {
      if (orient === 'absent') { screen.orientation.lock = undefined; screen.orientation.unlock = undefined; }
      else {
        screen.orientation.lock = o => { window.__log('lock', o); return orient === 'chrome' ? Promise.resolve() : Promise.reject(new DOMException('no', 'NotSupportedError')); };
        screen.orientation.unlock = () => window.__log('unlock', 1);
      }
    }
  }, noFullscreenApi, orientation);
  page.on('pageerror', e => log.errors.push(String(e)));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = req.url();
    if (u.startsWith('https://itch.io/embed-upload/')) return req.respond({ status: 200, contentType: 'text/html', body: embedHtml(cfg.embed) });
    if (u.startsWith('http://127.0.0.1')) return req.continue();
    return req.abort();
  });
  const { port } = harness.current;
  await page.goto(`http://127.0.0.1:${port}/paginas/jogo.html`, { waitUntil: 'load' });
  await page.waitForSelector('#game-frame iframe', { timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector('#game-fullscreen').disabled, { timeout: 10000 });
  await new Promise(r => setTimeout(r, 400));
  return { page, log };
}
export const harness = { current: null };

export const metrics = page => page.evaluate(() => {
  const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom, hidden: e.hidden }; };
  const stage = document.querySelector('#game-stage');
  return {
    vw: innerWidth, vh: innerHeight, scrollY: scrollY, sw: document.documentElement.scrollWidth,
    frame: r('#game-frame'), stage: r('#game-stage'), exit: r('#game-exit'), hint: r('#game-hint'), btn: r('#game-fullscreen'),
    slot: document.querySelector('#game-exit').dataset.slot || null,
    active: stage.classList.contains('is-active'), fsEl: (document.fullscreenElement || {}).id || null,
    label: document.querySelector('#game-fullscreen span').textContent, state: document.querySelector('#game-fullscreen').dataset.state,
    htmlOverflow: getComputedStyle(document.documentElement).overflow, immersive: document.documentElement.classList.contains('game-immersive'),
    hintShown: !document.querySelector('#game-hint').hidden,
  };
});
export const gameId = async page => {
  const f = page.frames().find(f => f.url().includes('itch.io'));
  return f ? f.evaluate(() => window.__id) : null;
};
