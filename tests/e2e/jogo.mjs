import { chromium } from 'playwright-core';
const base=process.env.BASE||'http://127.0.0.1:4173';
let falhas=0;
const b=await chromium.launch();
for (const [w,h,mobile] of [[360,800,1],[390,844,1],[844,390,1],[768,1024,1],[1024,768,0],[1366,768,0],[1920,1080,0]]) {
  const ctx=await b.newContext({viewport:{width:w,height:h},hasTouch:!!mobile,isMobile:!!mobile});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(`${base}/paginas/jogo.html`,{waitUntil:'load'}); await p.waitForSelector('#game-frame iframe',{timeout:5000}); await p.waitForTimeout(400);
  const m=await p.evaluate(()=>{const f=document.querySelector('#game-frame').getBoundingClientRect();const i=document.querySelector('#game-frame iframe').getBoundingClientRect();const s=document.querySelector('#game-stage').getBoundingClientRect();
    return {box:[Math.round(f.width),Math.round(f.height),+(f.width/f.height).toFixed(3)], iframe:[Math.round(i.width),Math.round(i.height)], bottom:Math.round(s.bottom), hscroll:document.documentElement.scrollWidth>innerWidth, fsButtons:[...document.querySelectorAll('button,a')].filter(e=>/tela cheia|fullscreen/i.test((e.textContent||'')+(e.getAttribute('aria-label')||''))&&e.offsetParent).length};});
  let fs='n/a';
  if(!mobile||true){ try{ await p.click('#game-fullscreen'); await p.waitForTimeout(500);
      const on=await p.evaluate(()=>({native:!!document.fullscreenElement, imm:document.documentElement.classList.contains('game-immersive'), iframeSame:!!document.querySelector('#game-frame iframe')}));
      const g=await p.evaluate(()=>{const r=document.querySelector('#game-frame').getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),innerWidth,innerHeight]});
      const hint=await p.evaluate(()=>!document.querySelector('#game-hint').hidden);
      await p.click('#game-exit'); await p.waitForTimeout(400);
      const off=await p.evaluate(()=>!document.fullscreenElement && !document.documentElement.classList.contains('game-immersive'));
      fs=JSON.stringify({...on,frameInFS:g,hint,exitOk:off}); }catch(e){fs='erro '+e.message.slice(0,60)} }
  const cond=m.box[2]===1.778 && !m.hscroll && m.fsButtons===1 && /"native":true/.test(fs) && /"exitOk":true/.test(fs) && errs.length===0;
  if(!cond) falhas++;
  console.log(cond?'PASS':'FAIL', `${w}x${h}`, JSON.stringify(m), '| FS', fs, '| js', errs.join(';')||'ok');
  await ctx.close();
}
await b.close();
if (falhas) { console.error(`${falhas} resolução(ões) falharam`); process.exit(1); }
