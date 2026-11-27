import { chromium } from 'playwright-core';
const base = process.env.BASE || 'http://127.0.0.1:4173';
const pages = ['index.html','paginas/login.html','paginas/criar-conta.html','paginas/nexa-quest.html','paginas/sobre-nexa-play.html','paginas/saiba-mais.html','paginas/inicio.html','paginas/explorar-projetos.html','paginas/criar-projeto.html','paginas/meus-projetos.html','paginas/amigos.html','paginas/meu-perfil.html','paginas/estatisticas.html','paginas/jogo.html','paginas/projeto.html?id=100'];
let falhas = 0;
const ignorados = [/reqfailed: https:\/\/itch\.io/, /status of 401/, /Unrecognized feature: 'web-share'/, /\/api\/me/];
const browser = await chromium.launch();
for (const logged of [0,1]) {
  await fetch(`${base}/api/__qa/logged?v=${logged}`);
  const ctx = await browser.newContext({ viewport:{width:1366,height:768} });
  for (const pg of pages) {
    const page = await ctx.newPage(); const msgs = [];
    page.on('console', m => { if (['error','warning'].includes(m.type())) msgs.push(m.type()+': '+m.text().slice(0,160)); });
    page.on('pageerror', e => msgs.push('pageerror: '+e.message.slice(0,160)));
    page.on('requestfailed', r => msgs.push('reqfailed: '+r.url().slice(0,100)));
    await page.goto(`${base}/${pg}`, { waitUntil:'networkidle' }).catch(e=>msgs.push('goto: '+e.message.slice(0,80)));
    const reais = msgs.filter(m => !ignorados.some(re => re.test(m)));
    if (reais.length) falhas++;
    console.log(`[${logged?'logado':'anon'}] ${pg} -> ${page.url().replace(base,'')} | ${msgs.length ? msgs.join(' || ') : 'sem erros'}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
if (falhas) { console.error(`${falhas} página(s) com erro de console/CSP`); process.exit(1); }
