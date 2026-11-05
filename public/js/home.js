/* Nexa Quest — home: seção "Gamificação".
   Os cinco marcos começam "bloqueados" e destravam quando passam pela linha de leitura (62% da tela);
   a barra de nível sobe junto. Voltar a rolagem tranca de novo, como o manifesto logo acima.
   O JS só escreve classes (.nq-lvl--live, .is-open, .on, .is-complete) e o contador; todo o visual está em css/home.css.
   Sem JS, ou com "movimento reduzido" no sistema, todos os marcos aparecem abertos e a barra completa. */
(() => {
  const sec = document.querySelector('[data-nq-lvl]');
  if (!sec) return;
  const stages = [...sec.querySelectorAll('[data-stage]')];
  const segs = [...sec.querySelectorAll('.nq-meter .nq-bar i')];
  const out = sec.querySelector('[data-nq-count]');
  if (!stages.length || !segs.length) return;

  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const pad = n => String(n).padStart(2, '0');
  sec.classList.add('nq-lvl--live');

  const render = (opened, lit) => {
    stages.forEach((s, i) => s.classList.toggle('is-open', i < opened));
    segs.forEach((s, i) => s.classList.toggle('on', i < lit));
    sec.classList.toggle('is-complete', opened === stages.length && lit === segs.length);
    if (out) out.textContent = pad(opened);
  };

  const update = () => {
    queued = false;
    if (calm.matches) return render(stages.length, segs.length);
    const line = innerHeight * .62;
    const tops = stages.map(s => s.getBoundingClientRect().top);
    const opened = tops.filter(t => t < line).length;
    const span = tops[tops.length - 1] - tops[0];
    const p = span > 0 ? Math.min(1, Math.max(0, (line - tops[0]) / span)) : 1;
    const lit = opened === 0 ? 0 : opened === stages.length ? segs.length : Math.max(1, Math.round(p * segs.length));
    render(opened, lit);
  };

  let queued = false;
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  calm.addEventListener?.('change', queue);
  document.fonts?.ready.then(queue);
  update();
})();