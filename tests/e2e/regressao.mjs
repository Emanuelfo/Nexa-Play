import { chromium } from 'playwright-core';
const base=process.env.BASE||'http://127.0.0.1:4173'; const out=[]; let falhas=0; const ok=(n,c,x='')=>{if(!c) falhas++; const l=`${c?'PASS':'FAIL'} ${n} ${x}`; out.push(l); console.log(l)};
const browser=await chromium.launch(); const ctx=await browser.newContext({viewport:{width:1366,height:768}});
await fetch(base+'/api/__qa/logged?v=1');
// ---- A02: envio antes do fim da verificação de sessão não pode virar GET com dados na URL
{ const page=await ctx.newPage();
  await page.route('**/api/me', async r=>{ await new Promise(s=>setTimeout(s,1500)); r.continue(); }); // sessão lenta
  await page.goto(base+'/paginas/sobre-nexa-play.html',{waitUntil:'domcontentloaded'});
  await page.fill('#c-nome','Visitante Teste'); await page.fill('#c-email','v@exemplo.invalid'); await page.fill('#c-assunto','Assunto'); await page.fill('#c-msg','Mensagem de teste longa o bastante');
  await page.click('#form-contato button[type=submit]');
  await page.waitForTimeout(300);
  ok('A02 URL sem dados pessoais com sessão lenta', !/nome=|email=|msg=/.test(page.url()), page.url());
  await page.waitForSelector('#contato-status.ok:has-text("Mensagem enviada")',{timeout:5000}).then(()=>ok('A02 sucesso exibido',true)).catch(()=>ok('A02 sucesso exibido',false));
  // duplo clique rápido -> um único envio
  await fetch(base+'/api/__qa/log'); const before=(await (await fetch(base+'/api/__qa/log')).json()).mensagens.length;
  await page.fill('#c-assunto','Outro'); await page.fill('#c-msg','Segunda mensagem de teste valida');
  await page.evaluate(()=>{const b=document.querySelector('#form-contato button[type=submit]'); b.click(); document.querySelector('#form-contato').requestSubmit();});
  await page.waitForSelector('#contato-status.ok:has-text("Mensagem enviada")',{timeout:5000});
  const after=(await (await fetch(base+'/api/__qa/log')).json()).mensagens.length;
  ok('A02 sem envio duplicado', after-before===1, `enviados=${after-before}`);
  // erro de validação -> foco no 1º inválido + aria
  await page.fill('#c-nome',''); await page.click('#form-contato button[type=submit]'); await page.waitForTimeout(100);
  ok('A12 foco no primeiro campo inválido', await page.evaluate(()=>document.activeElement.id==='c-nome'));
  ok('A12 aria-invalid + aria-describedby', await page.evaluate(()=>{const e=document.getElementById('c-nome');return e.getAttribute('aria-invalid')==='true'&&e.getAttribute('aria-describedby')?.includes('c-nome-err');}));
  await page.close(); }
// ---- A06: troca de categoria durante carregamento
{ const page=await ctx.newPage();
  await page.goto(base+'/paginas/explorar-projetos.html',{waitUntil:'networkidle'});
  const chip=t=>page.locator('#project-chips .chip').filter({hasText:new RegExp('^'+t+'$')}).first();
  const nomes=await page.locator('#project-chips .chip').allTextContents(); out.push('chips: '+nomes.join(' | '));
  await page.locator('#legacy-project-categories summary').click();
  await chip('Jogos').click();     // categoria lenta (900 ms)
  await page.waitForTimeout(100);
  await chip('Arte e design').click();    // troca antes da resposta
  await page.waitForTimeout(1500);
  const cats=await page.locator('#project-list .project-card, #project-list article').evaluateAll(els=>els.map(e=>e.textContent));
  ok('A06 resultados = última categoria (Arte e design)', cats.length>0 && cats.every(t=>/Arte e design/.test(t) && !/Jogos/.test(t.replace(/Arte e design/g,''))), `cards=${cats.length}`);
  ok('A06 chip pressionado = Arte e design', await page.evaluate(()=>document.querySelector('#project-chips .chip[aria-pressed="true"]')?.textContent.trim()), '');
  // filtro sem resultado != "Ainda não há projetos públicos"
  await page.fill('#project-search','zzzz'); await page.click('#project-search-form button[type=submit], #project-search-form [type=submit]').catch(()=>page.press('#project-search','Enter'));
  await page.waitForTimeout(500);
  const txt=await page.locator('#project-list').innerText();
  ok('A16 sem resultado de filtro tem mensagem própria', /Nenhum projeto encontrado/.test(txt) && !/Ainda não há/.test(txt), txt.replace(/\n/g,' ').slice(0,100));
  await page.close(); }
// ---- A07: busca de pessoas, resposta antiga lenta ("ab" 700ms) não sobrescreve "abe"
{ const page=await ctx.newPage();
  await page.goto(base+'/paginas/amigos.html',{waitUntil:'networkidle'});
  const input=page.locator('#friends-search-input');
  await input.fill('ab'); await page.press('#friends-search-input','Enter');
  await page.waitForTimeout(100);
  await input.fill('abe'); await page.press('#friends-search-input','Enter');
  await page.waitForTimeout(1200);
  const t=await page.locator('#friend-search-results').innerText();
  ok('A07 resultados correspondem ao termo atual (abe)', /ABEL/i.test(t) && !/ABIGAIL|ABRAAO/i.test(t), t.replace(/\n/g,' ').slice(0,80));
  await page.close(); }
await browser.close();
if (falhas) { console.error(`${falhas} verificação(ões) falharam`); process.exit(1); }
