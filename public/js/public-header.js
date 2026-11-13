/* Menu superior das páginas públicas: Inicial, Nexa Quest e Sobre. */
(() => {
  const header = document.querySelector('[data-public-header]');
  if (!header) return;

  const { root = '', page } = document.body.dataset;
  const links = [
    [root + 'index.html', 'Inicial', 'inicio'],
    [root + 'paginas/nexa-quest.html', 'Nexa Quest', 'nexa-quest'],
    [root + 'paginas/sobre-nexa-play.html', 'Sobre', 'sobre'],
  ].map(([url, label, key]) =>
    `<a href="${url}"${key === page ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');

  // Quem já tem sessão vai direto à plataforma; os demais, ao Login.
  const entrada = (typeof NP !== 'undefined' && NP.token && NP.token()) ? 'paginas/inicio.html' : 'paginas/login.html';

  header.innerHTML = `
    <div class="nx-nav-wrap">
      <a class="nx-brand" href="${root}index.html" aria-label="Nexa Quest — página inicial">
        <img src="${root}assets/imagens/logo-escura-quest.svg" width="64" height="54" alt="Nexa Quest">
      </a>
      <nav class="nx-nav" aria-label="Principal">${links}</nav>
      <a class="nx-nav-access" href="${root}${entrada}">Acessar plataforma</a>
      <details class="nx-mobile-menu">
        <summary aria-label="Menu de navegação">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14"/>
          </svg>
        </summary>
        <nav aria-label="Principal">${links}</nav>
      </details>
    </div>`;

  const menu = header.querySelector('.nx-mobile-menu');
  const trigger = menu.querySelector('summary');

  menu.querySelector('nav').addEventListener('click', event => {
    if (!event.target.closest('a')) return;
    trigger.focus({ preventScroll: true });
    menu.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !menu.open) return;
    menu.open = false;
    if (menu.contains(document.activeElement)) trigger.focus();
  });
  document.addEventListener('click', event => {
    if (!menu.contains(event.target)) menu.open = false;
  });
})();
