import { startServer, newBrowser, openGame, metrics, gameId, harness, DEVICES } from './harness.mjs';

harness.current = await startServer();
const browser = await newBrowser();
const results = [];
let section = '';
const check = (name, cond, detail = '') => { results.push({ section, name, ok: !!cond, detail }); if (!cond) console.log(`  ✗ ${name} ${detail}`); };
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;
const ratioOk = f => near(f.w / f.h, 16 / 9, 0.02);
const inside = (f, vw, vh, tol = 1) => f.x >= -tol && f.y >= -tol && f.r <= vw + tol && f.b <= vh + tol;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const overlap = (a, b) => !(a.r <= b.x || b.r <= a.x || a.b <= b.y || b.b <= a.y);
const shot = (page, n) => page.screenshot({ path: `shots/${n}.png` });
const setVp = async (page, dev, w, h) => page.setViewport({ ...DEVICES[dev].viewport, width: w, height: h });
const tapFs = page => page.tap ? page.tap('#game-fullscreen') : page.click('#game-fullscreen');

// ───────────── 1. Desktop ─────────────
section = 'Desktop 1440x900 (16:10)';
{
  const { page, log } = await openGame(browser, 'desktop');
  const id0 = await gameId(page);
  let m = await metrics(page);
  check('página: jogo 16:9 e inteiro dentro da janela, sem rolagem', ratioOk(m.frame) && inside(m.frame, m.vw, m.vh) && m.sw <= m.vw, JSON.stringify(m.frame));
  check('iframe sem permissão fullscreen (botão nativo do itch fica inerte)', await page.evaluate(() => { const f = document.querySelector('iframe'); return !/fullscreen/.test(f.getAttribute('allow')) && !f.hasAttribute('allowfullscreen'); }));
  check('um único botão de tela cheia na página', await page.evaluate(() => document.querySelectorAll('#game-fullscreen').length === 1 && document.querySelector('#game-exit').hidden));

  await page.click('#game-fullscreen'); await sleep(300);
  m = await metrics(page);
  check('entra em tela cheia nativa no #game-stage', m.fsEl === 'game-stage' && m.active);
  check('jogo 16:9 centralizado', ratioOk(m.frame) && near(m.frame.x + m.frame.w / 2, m.vw / 2) && near(m.frame.y + m.frame.h / 2, m.vh / 2), JSON.stringify(m.frame));
  check('jogo ocupa o máximo (encosta na largura ou na altura)', near(m.frame.w, m.vw) || near(m.frame.h, m.vh));
  check('estado/ícone do botão atualizados', m.state === 'on' && m.label === 'Sair da tela cheia');
  check('botão de saída visível na faixa estreita de um notebook 16:10, fora do jogo', !m.exit.hidden && m.slot === 'corner' && !overlap(m.exit, m.frame), `${m.slot} ${JSON.stringify(m.exit)}`);
  check('dica de rotação NÃO aparece no desktop', !m.hintShown);
  check('iframe não recarregou ao entrar', (await gameId(page)) === id0);
  await shot(page, 'desktop-fullscreen');

  // ESC (saída do sistema) → sincroniza
  await page.evaluate(() => document.exitFullscreen()); await sleep(300);
  m = await metrics(page);
  check('saída por ESC/sistema restaura página, estado e rótulo', !m.active && m.state === 'off' && m.label === 'Tela cheia' && m.exit.hidden);
  check('jogo volta ao tamanho de página 16:9', ratioOk(m.frame) && inside(m.frame, m.vw, m.vh));
  check('não mexeu em orientação no desktop', log.lock.length === 0);

  // botão de saída
  await page.click('#game-fullscreen'); await sleep(300);
  await page.click('#game-exit'); await sleep(300);
  m = await metrics(page);
  check('botão de saída da tela cheia funciona', !m.active && m.fsEl === null);

  // repetição
  for (let i = 0; i < 6; i++) { await page.click('#game-fullscreen'); await sleep(200); await page.evaluate(() => document.exitFullscreen()); await sleep(200); }
  m = await metrics(page);
  check('6 ciclos entra/sai: estado limpo e jogo intacto', !m.active && m.state === 'off' && (await gameId(page)) === id0 && log.errors.length === 0, log.errors.join('|'));

  // monitor exatamente 16:9 → sem faixas → aba discreta
  await setVp(page, 'desktop', 1280, 720);
  await page.click('#game-fullscreen'); await sleep(300);
  m = await metrics(page);
  check('tela 16:9 exata: saída vira aba discreta na borda', m.slot === 'edge' && m.exit.w <= 48 && m.exit.h <= 24, `${m.slot} ${JSON.stringify(m.exit)}`);
  await shot(page, 'desktop-fullscreen-exact169');
  await page.evaluate(() => document.exitFullscreen());
  await page.close();
}

// ───────────── 2. Android / Chrome ─────────────
section = 'Android Chrome (lock de orientação funciona)';
{
  const { page, log } = await openGame(browser, 'android', { orientation: 'chrome' });
  const id0 = await gameId(page);
  let m = await metrics(page);
  check('vertical: página sem corte nem rolagem horizontal', ratioOk(m.frame) && inside(m.frame, m.vw, m.vh) && m.sw <= m.vw, JSON.stringify(m.frame));
  await shot(page, 'android-portrait-page');
  await tapFs(page); await sleep(500);
  m = await metrics(page);
  check('entra em tela cheia nativa', m.fsEl === 'game-stage' && m.active);
  check('pediu orientação horizontal (landscape)', log.lock.length === 1 && log.lock[0] === 'landscape', JSON.stringify(log.lock));
  // simula o aparelho girando depois do lock
  await setVp(page, 'android', 915, 412); await sleep(400);
  m = await metrics(page);
  check('horizontal: jogo 16:9 centralizado e inteiro', ratioOk(m.frame) && inside(m.frame, m.vw, m.vh) && near(m.frame.x + m.frame.w / 2, m.vw / 2) && near(m.frame.y + m.frame.h / 2, m.vh / 2), JSON.stringify(m.frame));
  check('horizontal: ocupa toda a altura', near(m.frame.h, m.vh));
  check('horizontal: sem dica de rotação', !m.hintShown);
  check('horizontal: saída no canto, fora do jogo', m.slot === 'corner' && !overlap(m.exit, m.frame), `${m.slot}`);
  check('sem rolagem na tela cheia', await page.evaluate(() => { scrollBy(0, 200); return scrollY === 0; }));
  await shot(page, 'android-landscape-fullscreen');
  // saída pelo gesto/botão Voltar do sistema
  await page.evaluate(() => document.exitFullscreen()); await sleep(400);
  await setVp(page, 'android', 412, 915); await sleep(300);
  m = await metrics(page);
  check('saída do sistema libera o lock de orientação', log.unlock === 1, `unlock=${log.unlock}`);
  check('interface restaurada (menus e botão)', !m.active && m.state === 'off' && !m.btn.hidden && m.btn.w > 0);
  check('progresso preservado (iframe não recarregou)', (await gameId(page)) === id0);

  // mudança de orientação durante a partida, em tela cheia
  await tapFs(page); await sleep(500);
  await setVp(page, 'android', 915, 412); await sleep(300);
  let a = await metrics(page);
  await setVp(page, 'android', 412, 915); await sleep(300);
  let b = await metrics(page);
  await setVp(page, 'android', 915, 412); await sleep(300);
  let c = await metrics(page);
  check('girar durante a partida: sempre inteiro, 16:9 e centralizado', [a, b, c].every(x => ratioOk(x.frame) && inside(x.frame, x.vw, x.vh) && near(x.frame.x + x.frame.w / 2, x.vw / 2) && near(x.frame.y + x.frame.h / 2, x.vh / 2)));
  check('girar para vertical mostra a dica; voltar à horizontal a esconde', b.hintShown && !a.hintShown && !c.hintShown);
  check('dica (vertical) fica na faixa preta, sem tocar o jogo', !overlap(b.hint, b.frame), `${JSON.stringify(b.hint)} vs ${JSON.stringify(b.frame)}`);
  await shot(page, 'android-fullscreen-portrait-hint');
  check('iframe preservado após girar', (await gameId(page)) === id0);
  await page.evaluate(() => document.exitFullscreen()); await sleep(300);
  for (let i = 0; i < 5; i++) { await setVp(page, 'android', 412, 915); await tapFs(page); await sleep(250); await page.evaluate(() => document.exitFullscreen()); await sleep(250); }
  m = await metrics(page);
  check('5 ciclos entra/sai no celular: limpo e sem erros', !m.active && log.lock.length === 7 && log.unlock === 7 && (await gameId(page)) === id0 && log.errors.length === 0, `lock=${log.lock.length} unlock=${log.unlock} ${log.errors}`);

  // celular na horizontal, na PÁGINA (antes: o 16:9 passava da altura e cortava)
  await setVp(page, 'android', 915, 412); await sleep(300);
  m = await metrics(page);
  check('horizontal na página: jogo inteiro visível (sem corte vertical)', ratioOk(m.frame) && inside(m.frame, m.vw, m.vh) && m.scrollY === 0, JSON.stringify(m.frame));
  await shot(page, 'android-landscape-page');
  await page.close();
}

section = 'Android (lock rejeitado / Firefox-like)';
{
  const { page, log } = await openGame(browser, 'android', { orientation: 'reject' });
  await tapFs(page); await sleep(500);
  const m = await metrics(page);
  check('lock rejeitado não quebra: continua em tela cheia', m.fsEl === 'game-stage' && m.active);
  check('na vertical mostra a dica para girar', m.hintShown && !overlap(m.hint, m.frame));
  await page.evaluate(() => document.exitFullscreen()); await sleep(300);
  check('sem unlock indevido quando o lock falhou', log.unlock === 0);
  await page.close();
}

// ───────────── 3. iPhone / Safari (sem Fullscreen API) ─────────────
section = 'iPhone Safari (modo imersivo)';
{
  const { page, log } = await openGame(browser, 'iphone', { noFullscreenApi: true, orientation: 'absent' });
  const id0 = await gameId(page);
  await page.evaluate(() => scrollTo(0, 0));
  await tapFs(page); await sleep(400);
  let m = await metrics(page);
  check('sem API nativa → modo imersivo (fixed), tela toda', m.immersive && m.active && m.fsEl === null && near(m.stage.w, m.vw) && near(m.stage.h, m.vh), JSON.stringify(m.stage));
  check('rolagem da página travada', m.htmlOverflow === 'hidden');
  check('vertical: jogo 16:9 inteiro e centralizado', ratioOk(m.frame) && inside(m.frame, m.vw, m.vh) && near(m.frame.y + m.frame.h / 2, m.vh / 2));
  check('vertical: dica de girar visível (Safari não trava orientação)', m.hintShown && !overlap(m.hint, m.frame));
  check('nenhuma chamada a lock de orientação', log.lock.length === 0);
  await shot(page, 'iphone-immersive-portrait');
  await setVp(page, 'iphone', 844, 390); await sleep(300);
  m = await metrics(page);
  check('horizontal: dica some, jogo ocupa a altura toda, saída fora do jogo', !m.hintShown && near(m.frame.h, m.vh) && m.slot === 'corner' && !overlap(m.exit, m.frame), `${m.slot} ${JSON.stringify(m.frame)}`);
  await shot(page, 'iphone-immersive-landscape');
  await page.click('#game-exit'); await sleep(300);
  m = await metrics(page);
  check('sair restaura a página (sem classe imersiva, rolagem liberada)', !m.active && !m.immersive && m.htmlOverflow === 'visible' && m.state === 'off');
  check('iframe não recarregou', (await gameId(page)) === id0);
  // ESC no modo imersivo
  await tapFs(page); await sleep(250);
  await page.keyboard.press('Escape'); await sleep(250);
  m = await metrics(page);
  check('ESC sai do modo imersivo', !m.active);
  for (let i = 0; i < 5; i++) { await tapFs(page); await sleep(150); await page.tap('#game-exit'); await sleep(150); }
  m = await metrics(page);
  check('5 ciclos no iPhone: limpo, sem erros, iframe intacto', !m.active && (await gameId(page)) === id0 && log.errors.length === 0);
  await page.close();
}

section = 'iPhone com notch (safe-area) na horizontal';
{
  const { page } = await openGame(browser, 'iphone', { noFullscreenApi: true, orientation: 'absent' });
  await setVp(page, 'iphone', 844, 390);
  const client = await page.createCDPSession();
  let applied = true;
  try { await client.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, left: 47, bottom: 21, right: 47 } }); } catch (e) { applied = false; }
  if (applied) {
    await tapFs(page); await sleep(400);
    const m = await metrics(page);
    check('jogo respeita a área segura (não fica sob o notch)', m.frame.x >= 47 - 1 && m.frame.r <= m.vw - 47 + 1 && m.frame.b <= m.vh - 21 + 1 && ratioOk(m.frame), JSON.stringify(m.frame));
    await shot(page, 'iphone-notch-landscape');
  } else check('(emulação de safe-area indisponível neste Chromium — ignorado)', true);
  await page.close();
}

// ───────────── 4. iPad Safari: API prefixada sem Promise ─────────────
section = 'Safari/iPad (webkitRequestFullscreen sem Promise)';
{
  const { page } = await openGame(browser, 'desktop');
  await page.evaluate(() => {
    const orig = Element.prototype.requestFullscreen;
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true });
    Element.prototype.webkitRequestFullscreen = function () { orig.call(this); /* sem retorno */ };
  });
  // reinicializa a lógica não é possível sem recarregar; recarrega com o patch ativo
  await page.evaluateOnNewDocument(() => {
    const orig = Element.prototype.requestFullscreen;
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true });
    Element.prototype.webkitRequestFullscreen = function () { orig.call(this); };
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('#game-fullscreen').disabled, { timeout: 10000 });
  await sleep(300);
  await page.click('#game-fullscreen'); await sleep(700);
  let m = await metrics(page);
  check('prefixo webkit sem Promise entra em tela cheia nativa', m.fsEl === 'game-stage' && m.active && !m.immersive, JSON.stringify({ fs: m.fsEl, imm: m.immersive }));
  await page.click('#game-exit'); await sleep(500);
  m = await metrics(page);
  check('e sai corretamente', !m.active && m.fsEl === null);
  await page.close();
}

// ───────────── 5. Falha da API nativa → fallback sem travar ─────────────
section = 'Erro da Fullscreen API (NotAllowedError)';
{
  const { page, log } = await openGame(browser, 'desktop');
  await page.evaluateOnNewDocument(() => { Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('denied')); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !document.querySelector('#game-fullscreen').disabled, { timeout: 10000 });
  await sleep(300);
  await page.click('#game-fullscreen'); await sleep(400);
  let m = await metrics(page);
  check('erro tratado: cai para o modo imersivo, sem exceção', m.immersive && m.active && log.errors.length === 0, log.errors.join('|'));
  await page.click('#game-exit'); await sleep(200);
  m = await metrics(page);
  check('e consegue sair', !m.active && !m.immersive);
  await page.close();
}

// ───────────── 6. Modo scaled (itch.io com tamanho fixo 1920x1080 + barra) ─────────────
section = 'Modo scaled (embed fixo do itch.io)';
{
  const { page } = await openGame(browser, 'android', { embed: 'fixed', modo: 'scaled', orientation: 'chrome' });
  let m = await metrics(page);
  const tf = await page.evaluate(() => { const f = document.querySelector('#game-frame iframe'); const b = f.getBoundingClientRect(); return { w: f.style.width, h: f.style.height, tr: f.style.transform, bw: b.width, bh: b.height }; });
  const expected = m.frame.w - 2;
  check('iframe com tamanho fixo e escala = largura da caixa / 1920', tf.w === '1920px' && tf.h === '1080px' && near(tf.bw, expected, 2.5) && near(tf.bh, expected * 9 / 16, 2.5), JSON.stringify(tf));
  await shot(page, 'android-scaled-page');
  await tapFs(page); await sleep(500);
  await setVp(page, 'android', 915, 412); await sleep(400);
  m = await metrics(page);
  const tf2 = await page.evaluate(() => { const b = document.querySelector('#game-frame iframe').getBoundingClientRect(); return { bw: b.width, bh: b.height }; });
  check('tela cheia scaled: escala acompanha a caixa (sem corte)', near(tf2.bw, m.frame.w, 2) && near(tf2.bh, m.frame.h, 2) && ratioOk(m.frame), `${JSON.stringify(tf2)} ${JSON.stringify(m.frame)}`);
  await shot(page, 'android-scaled-fullscreen');
  await page.evaluate(() => document.exitFullscreen());
  await page.close();
}

await browser.close(); harness.current.server.close();
const failed = results.filter(r => !r.ok);
let last = '';
for (const r of results) { if (r.section !== last) { console.log(`\n${r.section}`); last = r.section; } console.log(`  ${r.ok ? '✓' : '✗'} ${r.name}`); }
console.log(`\n${results.length - failed.length}/${results.length} verificações OK`);
process.exit(failed.length ? 1 : 0);
