/* Nexa Quest — movimento das páginas públicas (Inicial, Nexa Quest e Sobre).
   Sem dependências. Faz três coisas pequenas:
   1. revela as cenas ilustradas ([data-reveal]) uma única vez, ao rolar;
   2. dispara a montagem das cenas-chave ([data-reveal="montagem"]);
   3. pausa as animações ambientes fora da tela ou com a aba oculta.
   Não toca em motion.js (páginas de login). Para desligar tudo, remova este
   arquivo e css/animacoes.css.

   Regras de segurança:
   - com prefers-reduced-motion: reduce ou sem IntersectionObserver, não faz nada;
   - só esconde (.rv-wait) o que está ABAIXO da dobra: nada visível no carregamento
     é ocultado, então não há "piscada";
   - se o observer falhar ou não responder em 3s, tudo é mostrado. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || !('IntersectionObserver' in window)) return;

  const STEP = 80;                 // ms entre itens de um mesmo grupo (--stagger-group)
  const MAX_GROUP = 3;             // no máximo 3 itens por vez
  let revealObserver = null;
  let ambientObserver = null;
  let alive = false;

  const finish = el => {
    el.style.willChange = '';
    el.style.transitionDelay = '';
  };

  const reveal = (el, delay) => {
    el.classList.remove('rv-wait');
    el.classList.add('is-in');
    if (el.dataset.reveal === 'montagem') return;   // a montagem é feita por animação CSS
    if (delay) el.style.transitionDelay = delay + 'ms';
    el.style.willChange = 'transform, opacity';
    el.addEventListener('transitionend', event => { if (event.target === el) finish(el); }, { once: true });
    setTimeout(() => finish(el), 1200);             // garantia caso o transitionend não venha
  };

  const revealAll = () => {
    if (revealObserver) revealObserver.disconnect();
    document.querySelectorAll('[data-reveal].rv-wait').forEach(el => {
      el.classList.remove('rv-wait');
      el.classList.add('is-in');
    });
  };

  const onReveal = entries => {
    alive = true;
    const hits = entries.filter(entry => entry.isIntersecting).map(entry => entry.target);
    hits.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    let group = 0;
    hits.forEach(el => {
      revealObserver.unobserve(el);
      const grouped = el.dataset.reveal === 'grupo';
      reveal(el, grouped ? Math.min(group++, MAX_GROUP - 1) * STEP : 0);
    });
  };

  const setupReveal = () => {
    revealObserver = new IntersectionObserver(onReveal, { rootMargin: '0px 0px -10% 0px' });
    const limit = innerHeight * 0.9;                 // mesma linha do rootMargin
    document.querySelectorAll('[data-reveal]').forEach(el => {
      if (el.getBoundingClientRect().top < limit) {
        // já está na tela (ou acima dela): nunca é ocultado; a montagem toca uma vez.
        if (el.dataset.reveal === 'montagem' && el.getBoundingClientRect().bottom > 0) el.classList.add('is-in');
        return;
      }
      el.classList.add('rv-wait');
      revealObserver.observe(el);
    });
    setTimeout(() => { if (!alive) revealAll(); }, 3000);
  };

  /* Ambiente: o CSS pausa quando o elemento tem [data-motion-paused].
     O rodapé é montado depois por main.js, mas o host já existe no HTML;
     o atributo sobrevive porque renderFooter só troca className e conteúdo. */
  const setupAmbient = () => {
    ambientObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.toggleAttribute('data-motion-paused', !entry.isIntersecting));
    }, { rootMargin: '100px 0px' });
    document.querySelectorAll('.scene--hero, .cta, footer[data-component="footer"]')
      .forEach(el => ambientObserver.observe(el));
    document.addEventListener('visibilitychange', () => {
      root.classList.toggle('nq-tab-hidden', document.hidden);
    });
  };

  const stop = () => {
    revealAll();
    if (ambientObserver) ambientObserver.disconnect();
    root.classList.remove('js-motion');
  };

  try {
    root.classList.add('js-motion');
    setupReveal();
    setupAmbient();
    reduced.addEventListener('change', event => { if (event.matches) stop(); });
  } catch (error) {
    stop();
  }
})();
