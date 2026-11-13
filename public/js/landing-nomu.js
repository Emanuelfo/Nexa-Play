/* The landing remains fully usable without JavaScript. Expand the real game
   demonstration when reached through its in-page link. No auth logic here. */
(() => {
  const demo = document.querySelector('#demonstracao');
  if (!demo) return;
  const openDemo = () => { if (location.hash === '#demonstracao') demo.open = true; };
  document.querySelectorAll('a[href="#demonstracao"]').forEach(link => {
    link.addEventListener('click', () => { demo.open = true; });
  });
  addEventListener('hashchange', openDemo);
  openDemo();
})();
(() => {
  const controls = document.querySelector('.nx-view-controls');
  const figure = document.querySelector('.nx-game-art');
  if (!controls || !figure) return;
  const captions = {full:'Captura do jogo • visão completa',areas:'Captura do jogo • detalhe das áreas',profile:'Captura do jogo • detalhe do perfil'};
  controls.hidden = false;
  controls.addEventListener('click', event => {
    const button = event.target.closest('button[data-view]');
    if (!button || !Object.hasOwn(captions, button.dataset.view)) return;
    figure.dataset.view = button.dataset.view;
    controls.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    figure.querySelector('figcaption').textContent = captions[button.dataset.view];
  });
})();
