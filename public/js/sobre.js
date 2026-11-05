/* Nexa Play — Sobre nós: o símbolo vira um interruptor que liga a experiência.
   JS nativo, sem bibliotecas. Uma única linha do tempo (T de 0 a 1) comanda tudo:
   a bolinha sobe, as cores do símbolo se invertem e o fundo escuro se espalha a partir do símbolo.
   Os textos trocam de cor exatamente na frente da onda (gradiente em CSS, ver style.css). */
(() => {
  const sec = document.querySelector('.sobre');
  const sw = sec && sec.querySelector('.sw');
  if (!sw) return;

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sweeps = [...sec.querySelectorAll('[data-sweep]')];
  const [pOut, pIn] = sw.querySelectorAll('.sw-out, .sw-in');
  const gBall = sw.querySelector('.sw-ball');

  /* paleta da marca (RGB) */
  const NAVY = [9, 30, 91], WHITE = [255, 255, 255], CYAN = [76, 195, 255];
  const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t))})`;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const inOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* geometria do símbolo original (viewBox 109x188): centro da bolinha ligada e curso até a posição desligada */
  const CX = 54.15, CY = 55.25, TRAVEL = 77.5;
  const BALL_END = .65;            // a bolinha chega ao topo em 65% da linha do tempo; a onda segue até 100%

  let T = 0, cx = 0, cy = 0, maxR = 0;

  /* posição de um elemento dentro da seção, ignorando transform/translate de entrada */
  const pos = el => {
    let x = 0, y = 0;
    while (el && el !== sec) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x, y };
  };

  function measure() {
    const s = pos(sw);
    cx = s.x + sw.offsetWidth / 2;
    cy = s.y + sw.offsetHeight / 2;
    const w = sec.offsetWidth, h = sec.offsetHeight;
    maxR = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 12;
    sec.style.setProperty('--ox', cx + 'px');
    sec.style.setProperty('--oy', cy + 'px');
    sweeps.forEach(el => {
      const p = pos(el);
      el.style.setProperty('--ex', (cx - p.x) + 'px');
      el.style.setProperty('--ey', (cy - p.y) + 'px');
    });
  }

  function render() {
    /* bolinha: sobe com ease in-out e se alonga um pouco no pico de velocidade */
    const x = clamp(T / BALL_END), eb = inOut(x);
    const v = (x <= 0 || x >= 1) ? 0 : (x < .5 ? 12 * x * x : 12 * (1 - x) * (1 - x)) / 3;
    const dy = TRAVEL * (1 - eb);
    gBall.setAttribute('transform',
      `translate(${CX} ${CY + dy}) scale(${1 - .04 * v} ${1 + .09 * v}) translate(${-CX} ${-CY})`);

    /* cores do símbolo: contorno e miolo se invertem; a bolinha passa pelo ciano no meio do caminho */
    pOut.setAttribute('fill', mix(WHITE, NAVY, smooth(.1, .9, eb)));
    pIn.setAttribute('fill', mix(NAVY, WHITE, smooth(0, .75, eb)));
    gBall.firstElementChild.setAttribute('fill', eb < .5 ? mix(WHITE, CYAN, eb / .5) : mix(CYAN, NAVY, (eb - .5) / .5));

    /* fundo: a onda nasce no símbolo, acelera depois que a bolinha chega e desacelera ao cobrir a seção */
    const wp = inOut(clamp((T - .1) / .9));
    sec.style.setProperty('--r', (wp * maxR).toFixed(1) + 'px');
    sec.style.setProperty('--rim', (smooth(0, .12, wp) * (1 - smooth(.8, 1, wp))).toFixed(3));
    sec.style.setProperty('--k', smooth(.35, .95, T).toFixed(3));
  }

  let raf = 0;
  function go(to, ms) {
    cancelAnimationFrame(raf);
    sw.setAttribute('aria-checked', to > .5 ? 'true' : 'false');
    const from = T, dur = ms * Math.abs(to - from);
    if (calm || dur <= 0) { T = to; render(); return; }
    const t0 = performance.now();
    const step = now => {
      const k = clamp((now - t0) / dur);
      T = from + (to - from) * k; render();
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  const AUTO_INTERVAL = 15000;
  let autoTimer = 0;
  const scheduleAutoToggle = () => {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => go(T > .5 ? 0 : 1, 1500), AUTO_INTERVAL);
  };

  /* interruptor de verdade: clique ou teclado alternam entre desligado e ligado */
  sw.addEventListener('click', () => {
    go(T > .5 ? 0 : 1, 1500);
    scheduleAutoToggle();
  });

  /* medidas e redimensionamento */
  let pending = false;
  const remeasure = () => {
    if (pending) return; pending = true;
    requestAnimationFrame(() => { pending = false; measure(); render(); });
  };
  new ResizeObserver(remeasure).observe(sec);
  document.fonts?.ready.then(remeasure);

  measure(); render();
  sec.classList.add('is-ready');

  /* movimento reduzido: já nasce ligado, sem animação */
  if (calm) { go(1, 0); sec.classList.add('is-in'); return; }

  if (!('IntersectionObserver' in window)) {
    sec.classList.add('is-in');
    go(1, 0);
    scheduleAutoToggle();
    return;
  }

  /* entrada dos textos e do símbolo quando a seção aparece */
  const ioIn = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) { sec.classList.add('is-in'); ioIn.disconnect(); }
  }, { threshold: .15 });
  ioIn.observe(sec);

  /* a ativação acontece uma única vez por visita, quando o símbolo está bem à vista */
  const ioPlay = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    ioPlay.disconnect();
    setTimeout(() => { measure(); go(1, 2000); scheduleAutoToggle(); }, 800);
  }, { threshold: .55 });
  ioPlay.observe(sw);
})();
