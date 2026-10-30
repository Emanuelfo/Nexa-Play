/* Nexa Play — movimento e interações (JS nativo, sem bibliotecas) */
(() => {
  const root = document.documentElement, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('js');

  document.addEventListener('DOMContentLoaded', () => {
    /* Título do hero: palavra por palavra */
    const h1 = $('.stage h1');
    if (h1 && !calm) {
      let i = 0;
      const wrap = n => { if (n.nodeType === 3) { const f = document.createDocumentFragment(); n.textContent.split(/(\s+)/).forEach(t => { if (!t.trim()) return f.append(t); const w = document.createElement('span'); w.className = 'w'; w.style.setProperty('--i', i++); w.innerHTML = '<span></span>'; w.firstChild.textContent = t; f.append(w); }); n.replaceWith(f); } else [...n.childNodes].forEach(wrap); };
      wrap(h1); requestAnimationFrame(() => $$('.w', h1).forEach(w => w.classList.add('in')));
    }

    /* Revelação na rolagem */
    const alvos = $$('.stage .kicker,.stage .lead,.stage .btn-row,.stage .mini-feats,.quest-head>*,.quest-img,.split>*,.convite .panel>*,.contato .panel>*,.stats .stat,.news>*,.perks>*,.about-hero>*,.f-head>*,.fcard,.pcard,.m-art');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15, rootMargin: '0px 0px -6% 0px' });
    alvos.forEach((el, k) => { el.classList.add('rv'); el.style.setProperty('--d', (k % 4) * 90 + 'ms'); io.observe(el); });

    /* Manifesto: a frase acende ao chegar no centro da tela */
    const mio = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('on', e.isIntersecting)), { rootMargin: '-38% 0px -38% 0px' });
    $$('.mline').forEach(l => calm ? l.classList.add('on') : mio.observe(l));

    /* Barra de progresso, cabeçalho e parallax (um único rAF) */
    const bar = Object.assign(document.createElement('div'), { className: 'progress' }); bar.setAttribute('aria-hidden', 'true'); document.body.prepend(bar);
    const hero = $('.stage'); let tick = false;
    const onScroll = () => { if (tick) return; tick = true; requestAnimationFrame(() => {
      const y = scrollY, max = root.scrollHeight - innerHeight;
      bar.style.setProperty('--p', max > 0 ? y / max : 0);
      $('.site-header')?.classList.toggle('scrolled', y > 8);
      if (hero && !calm && y < innerHeight * 1.2) hero.style.setProperty('--sy', y);
      tick = false; }); };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();

    /* Imagem do jogo se endireita conforme entra na tela */
    const shot = $('.shot img');
    if (shot) { if (calm) shot.style.setProperty('--k', 1); else addEventListener('scroll', () => requestAnimationFrame(() => { const r = shot.getBoundingClientRect(); shot.style.setProperty('--k', Math.min(1, Math.max(0, 1 - (r.top - innerHeight * .35) / (innerHeight * .6)))); }), { passive: true }); }

    /* Manifesto: partículas neon geradas aleatoriamente (estáticas com movimento reduzido) */
    const fx = $('.m-fx');
    if (fx) { const cores = ['#4cc3ff', '#ffffff', '#7c9bff'];
      for (let k = 0; k < 34; k++) { const p = document.createElement('i'), s = 2 + Math.random() * 4; p.className = 'pt';
        p.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${s}px;height:${s}px;--c:${cores[k % 3]};--t:${3 + Math.random() * 5}s;--dl:${-Math.random() * 6}s`; fx.append(p); } }

    /* Estatísticas dos parceiros: contagem ao entrar na tela */
    if (!calm) $$('[data-count]').forEach(el => {
      const fim = +el.dataset.count, pre = el.dataset.prefix || '', suf = el.dataset.suffix || ''; el.textContent = pre + 0 + suf;
      const o = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; o.disconnect(); const t0 = performance.now();
        const passo = t => { const k = Math.min(1, (t - t0) / 1300); el.textContent = pre + Math.round(fim * (1 - Math.pow(1 - k, 3))) + suf; if (k < 1) requestAnimationFrame(passo); };
        requestAnimationFrame(passo); }), { threshold: .6 });
      o.observe(el); });

    /* Inclinação 3D que segue o cursor (só com mouse) */
    if (fine && !calm) {
      const tilt = (box, el, max) => {
        box.addEventListener('pointermove', e => { const r = box.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; el.style.setProperty('--ry', x * max + 'deg'); el.style.setProperty('--rx', -y * max + 'deg'); });
        box.addEventListener('pointerleave', () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); });
      };
      const art = $('.stage .hero-art'); if (art) tilt(hero, $('img', art), 14);
      const qi = $('.quest-img'); if (qi) tilt(qi.parentElement, qi, 5);
      /* Brilho que segue o cursor nos cards de recursos */
      $$('.fcard').forEach(c => c.addEventListener('pointermove', e => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }));
      /* Botões magnéticos */
      $$('.btn').forEach(b => {
        b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.translate = ((e.clientX - r.left - r.width / 2) * .2) + 'px ' + ((e.clientY - r.top - r.height / 2) * .3) + 'px'; });
        b.addEventListener('pointerleave', () => { b.style.translate = ''; });
      });
    }
  });
})();
