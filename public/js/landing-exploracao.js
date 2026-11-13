/* Progressive enhancement: the complete screenshot remains visible without JS. */
(() => {
  const controls = document.querySelector('.nq-controls');
  const capture = document.querySelector('.nq-capture');
  if (!controls || !capture) return;
  const captions = {full: 'visão completa', areas: 'detalhe das áreas do jogo', profile: 'detalhe do perfil'};
  controls.hidden = false;
  controls.addEventListener('click', event => {
    const button = event.target.closest('button[data-view]');
    if (!button || !Object.hasOwn(captions, button.dataset.view)) return;
    capture.dataset.view = button.dataset.view;
    controls.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    capture.querySelector('figcaption').textContent = `Captura da interface • ${captions[button.dataset.view]}`;
  });
})();
