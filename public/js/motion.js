/* Nexa Play — movimento e interações (JS nativo, sem bibliotecas) */
(() => {
  const root = document.documentElement, $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
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
    const alvos = $$('.stage .kicker,.stage .lead,.stage .btn-row,.stage .mini-feats,.split>*,.convite .panel>*,.contato .panel>*,.stats .stat,.news>*,.perks>*,.about-hero>*,.f-head>*,.fcard,.ptn-art,.ptn-copy>*');
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15, rootMargin: '0px 0px -6% 0px' });
    alvos.forEach((el, k) => { el.classList.add('rv'); el.style.setProperty('--d', (k % 4) * 90 + 'ms'); io.observe(el); });

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

    /* Manifesto: cada linha é uma "fase". Ao passar pela linha de leitura (60% da tela) ela acende,
       a trilha cresce e o golfinho vai até a fase atual. Com movimento reduzido tudo já nasce aceso. */
    const man = $('.manifesto');
    if (man) {
      const rows = $$('.mrow', man), list = $('.m-list', man), art = $('.m-art', man), cnt = $('.m-count b', man);
      const icons = rows.map(r => $('.mi', r)), pad = n => String(n).padStart(2, '0'), small = matchMedia('(max-width:720px)');
      let cur = -2, tiltT = 0;
      const mid = el => { const b = el.getBoundingClientRect(); return b.top + b.height / 2; };
      const place = i => {
        const r = rows[Math.max(0, i)];
        art.style.setProperty('--ty', (r.offsetTop + (small.matches ? -art.offsetHeight * .26 : (r.offsetHeight - art.offsetHeight) / 2)) + 'px');
      };
      const measure = () => {
        const a = icons[0].getBoundingClientRect(), z = icons[icons.length - 1].getBoundingClientRect(), l = list.getBoundingClientRect();
        list.style.setProperty('--rt', (a.top - l.top + a.height / 2) + 'px');
        list.style.setProperty('--rh', (z.top - a.top) + 'px');
        place(cur);
      };
      const update = () => {
        const line = innerHeight * .6, c0 = mid(icons[0]), c1 = mid(icons[icons.length - 1]);
        let idx = -1;
        rows.forEach((r, i) => { const on = calm || mid(icons[i]) < line; r.classList.toggle('on', on); if (on) idx = i; });
        list.style.setProperty('--p', calm ? 1 : Math.min(1, Math.max(0, (line - c0) / (c1 - c0))));
        if (idx === cur) return;
        if (cur !== -2 && !calm) { /* mergulha ao descer, sobe ao voltar */
          art.style.setProperty('--tilt', (idx > cur ? -9 : 9) + 'deg');
          clearTimeout(tiltT); tiltT = setTimeout(() => art.style.setProperty('--tilt', '0deg'), 650);
        }
        cur = idx; cnt.textContent = pad(idx + 1); place(idx);
      };
      let tk = false;
      const sched = () => { if (tk) return; tk = true; requestAnimationFrame(() => { tk = false; update(); }); };
      addEventListener('scroll', sched, { passive: true });
      new ResizeObserver(() => { measure(); sched(); }).observe($('.m-stage', man));
      document.fonts?.ready.then(() => { measure(); update(); });
      measure(); update();

      /* camadas com profundidade: grade ao fundo e golfinho à frente se movem em sentidos opostos */
      if (!calm && matchMedia('(hover:hover) and (pointer:fine)').matches) {
        man.addEventListener('pointermove', e => { const r = man.getBoundingClientRect();
          man.style.setProperty('--px', ((e.clientX - r.left) / r.width - .5) * 2); man.style.setProperty('--py', ((e.clientY - r.top) / r.height - .5) * 2); });
        man.addEventListener('pointerleave', () => { man.style.setProperty('--px', 0); man.style.setProperty('--py', 0); });
      }
    }

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
