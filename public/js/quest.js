/* Nexa Quest — entrada da seção e profundidade do monitor na rolagem (JS nativo, sem bibliotecas).
   Escreve apenas a classe .qm--in e a variável CSS --p (0 → 1); todo o visual é calculado no CSS. */
(() => {
  const sec = document.querySelector('[data-qm]');
  if (!sec) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const device = sec.querySelector('.qm-device');

  [...sec.querySelectorAll('.qm-copy > *')].forEach((el, n) => el.style.setProperty('--n', n));
  sec.classList.add('qm--ready');

  /* entrada: texto sobe, monitor desliza e cresce quando a seção aparece */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { sec.classList.add('qm--in'); io.disconnect(); }
  }), { threshold: .2 });
  io.observe(sec);

  /* profundidade: inclinação e reflexo variam suavemente com a posição na tela */
  let queued = false;
  const update = () => {
    queued = false;
    if (calm.matches || !device) return;
    const r = sec.getBoundingClientRect(), vh = innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
    sec.style.setProperty('--p', p.toFixed(3));
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  calm.addEventListener?.('change', () => { if (calm.matches) sec.style.removeProperty('--p'); else queue(); });
  update();
})();

/* Demonstração em vídeo: o cabeçalho e o player entram quando a seção aparece.
   Escreve só .vd--ready e .vd--in; o iframe do YouTube fica sempre no DOM (nada de capa estática). */
(() => {
  const sec = document.querySelector('[data-vd]');
  if (!sec) return;
  sec.classList.add('vd--ready');
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { sec.classList.add('vd--in'); io.disconnect(); }
  }), { threshold: .12, rootMargin: '0px 0px -5% 0px' });
  io.observe(sec);
})();