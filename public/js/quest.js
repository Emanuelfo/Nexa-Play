/* Nexa Quest — cena da home guiada pela rolagem (JS nativo, sem bibliotecas).
   Escreve apenas três variáveis CSS (--e, --i, --c) na seção; todo o visual
   (clip-path, escala, perspectiva) é calculado no CSS, só com transform/clip-path/opacity. */
(() => {
  const sec = document.querySelector('[data-qx]');
  if (!sec) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const small = matchMedia('(max-width: 760px)');
  const frame = sec.querySelector('.qx-frame');
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const last = { e: -1, i: -1, c: -1 };
  let queued = false;

  const set = (e, i, c) => {
    if (Math.abs(e - last.e) < .001 && Math.abs(i - last.i) < .001 && Math.abs(c - last.c) < .001) return;
    Object.assign(last, { e, i, c });
    sec.style.setProperty('--e', e.toFixed(4));
    sec.style.setProperty('--i', i.toFixed(4));
    sec.style.setProperty('--c', c.toFixed(4));
    sec.classList.toggle('qx--on', c > .75);
  };

  const update = () => {
    queued = false;
    const vh = innerHeight, r = sec.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 2) return;          // longe da tela: nada a fazer
    if (small.matches) {                                   // celular: sem fixar; a tela abre ao subir
      const f = frame.getBoundingClientRect();
      set(ease(clamp((vh * .92 - f.top) / (vh * .6))), 1, 1);
      return;
    }
    const p = clamp(-r.top / Math.max(1, r.height - vh));  // 0 → 1 ao longo da cena fixada
    set(ease(clamp(p / .6)), 1 - clamp(p / .22), ease(clamp((p - .5) / .3)));
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };

  const mode = () => {
    const live = !calm.matches;
    sec.classList.toggle('qx--live', live);
    if (!live) { ['--e', '--i', '--c'].forEach(v => sec.style.removeProperty(v)); sec.classList.remove('qx--on'); Object.assign(last, { e: -1, i: -1, c: -1 }); return; }
    update();
  };

  sec.querySelectorAll('.qx-expect li').forEach((li, n) => li.style.setProperty('--n', n));
  addEventListener('scroll', () => { if (!calm.matches) queue(); }, { passive: true });
  addEventListener('resize', () => { Object.assign(last, { e: -1, i: -1, c: -1 }); queue(); });
  calm.addEventListener?.('change', mode);
  small.addEventListener?.('change', () => { Object.assign(last, { e: -1, i: -1, c: -1 }); queue(); });
  mode();
})();
