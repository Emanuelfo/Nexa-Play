/* Nexa Quest — interações da área social (v2).
   Melhoria progressiva sobre main.js: usa só dados reais da API, sem dados fictícios. */
(() => {
  'use strict';
  if (!document.body.dataset.protected) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const page = document.body.dataset.page;
  const root = document.body.dataset.root || '';

  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const ICON = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    explore: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
    create: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 8v8M8 12h8"/>',
    friends: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    up: '<path d="m6 14 6-6 6 6"/>',
  };

  /* ---------- utilidades ---------- */
  function httpsUrl(v) {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
    } catch { return null; }
  }

  function profileUrl(u) {
    const me = NP.currentUser();
    return me && String(me.id) === String(u.id)
      ? `${root}paginas/meu-perfil.html`
      : `${root}paginas/perfil-publico.html?id=${encodeURIComponent(u.id)}`;
  }

  function avatar(u, cls) {
    const a = el('a', cls);
    a.href = profileUrl(u);
    const name = u.nome_exibicao || u.nome_usuario || '?';
    a.setAttribute('aria-label', `Ver perfil de ${name}`);
    const initial = name.replace(/^@/, '').charAt(0).toUpperCase();
    const src = httpsUrl(u.avatar_url);
    if (src) {
      const img = new Image();
      img.alt = '';
      img.loading = 'lazy';
      img.onerror = () => { img.remove(); a.textContent = initial; };
      img.src = src;
      a.append(img);
    } else {
      a.textContent = initial;
    }
    return a;
  }

  function whenShell(cb) {
    const ready = () => $('.social-shell .social-sidebar') && $('.social-topbar-inner');
    if (ready()) return cb();
    const obs = new MutationObserver(() => {
      if (ready()) { obs.disconnect(); cb(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 15000);
  }

  /* ---------- dados de amizade ---------- */
  let friendsPromise = null;
  const loadFriends = force => {
    if (!friendsPromise || force) friendsPromise = NP.api('/me/amizades');
    return friendsPromise;
  };

  /* ---------- busca rápida (Ctrl+K) ---------- */
  const NAV = [
    ['Início', 'paginas/inicio.html', ICON.home],
    ['Explorar projetos', 'paginas/explorar-projetos.html', ICON.explore],
    ['Criar projeto', 'paginas/criar-projeto.html', ICON.create],
    ['Amigos', 'paginas/amigos.html', ICON.friends],
    ['Meu perfil', 'paginas/meu-perfil.html', ICON.user],
    ['Meus projetos', 'paginas/meus-projetos.html', ICON.folder],
    ['Jornada no jogo', 'paginas/estatisticas.html', ICON.chart],
  ];
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  let pal = null, palInput = null, palList = null, palItems = [], palIdx = 0, lastFocus = null;

  function buildPalette() {
    if (pal) return;
    pal = el('div', 'np-pal');
    pal.hidden = true;
    pal.innerHTML = `<div class="np-pal-box" role="dialog" aria-modal="true" aria-label="Busca rápida">
      <label class="np-pal-input">${svg(ICON.search)}<input type="text" autocomplete="off" spellcheck="false" maxlength="100" placeholder="Buscar pessoas ou ir para…" aria-label="Buscar pessoas ou ir para uma página"></label>
      <ul class="np-pal-list" role="listbox" aria-label="Resultados"></ul>
      <div class="np-pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd>navegar</span><span><kbd>Enter</kbd>abrir</span><span><kbd>Esc</kbd>fechar</span></div></div>`;
    document.body.append(pal);
    palInput = $('input', pal);
    palList = $('.np-pal-list', pal);
    pal.addEventListener('mousedown', e => { if (e.target === pal) closePalette(); });
    palInput.addEventListener('input', () => renderPalette(palInput.value));
    palInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(palIdx + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(palIdx - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = palItems[palIdx]; if (it) location.href = it.href; }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      else if (e.key === 'Tab') e.preventDefault();
    });
  }

  function renderPalette(term) {
    const q = term.trim();
    palItems = [];
    if (q.length >= 2) {
      palItems.push({ label: `Buscar pessoas por “${q}”`, hint: 'Amigos', href: `${root}paginas/amigos.html?busca=${encodeURIComponent(q)}`, icon: ICON.search });
    }
    NAV.filter(n => !q || norm(n[0]).includes(norm(q)))
      .forEach(n => palItems.push({ label: n[0], hint: 'Página', href: root + n[1], icon: n[2] }));
    palList.replaceChildren();
    if (!palItems.length) {
      const li = el('li', null, 'Nada encontrado. Digite 2 letras ou mais para buscar pessoas.');
      li.style.cssText = 'padding:1rem;color:var(--app-muted);font-size:.82rem';
      palList.append(li);
      return;
    }
    palItems.forEach((it, i) => {
      const li = el('li');
      li.setAttribute('role', 'presentation');
      const a = el('a', 'np-pal-item');
      a.href = it.href;
      a.setAttribute('role', 'option');
      a.innerHTML = svg(it.icon);
      a.append(el('span', null, it.label), el('small', null, it.hint));
      a.addEventListener('mousemove', () => setActive(i, true));
      li.append(a);
      palList.append(li);
    });
    setActive(0);
  }

  function setActive(i, quiet) {
    if (!palItems.length) return;
    palIdx = (i + palItems.length) % palItems.length;
    $$('.np-pal-item', palList).forEach((a, n) => {
      const on = n === palIdx;
      a.classList.toggle('is-active', on);
      a.setAttribute('aria-selected', String(on));
      if (on && !quiet) a.scrollIntoView({ block: 'nearest' });
    });
  }

  function openPalette() {
    buildPalette();
    lastFocus = document.activeElement;
    pal.hidden = false;
    palInput.value = '';
    renderPalette('');
    palInput.focus();
  }

  function closePalette() {
    if (!pal || pal.hidden) return;
    pal.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      pal && !pal.hidden ? closePalette() : openPalette();
      return;
    }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = e.target;
      const typing = t instanceof Element && (t.closest('input, textarea, select, [contenteditable]'));
      if (!typing && $('.social-topbar-inner')) { e.preventDefault(); openPalette(); }
    }
  });

  /* ---------- topbar e sidebar ---------- */
  function enhanceTopbar() {
    const inner = $('.social-topbar-inner');
    if (!inner || $('.np-search', inner)) return;
    const pill = el('button', 'np-search');
    pill.type = 'button';
    pill.setAttribute('aria-haspopup', 'dialog');
    pill.setAttribute('aria-label', 'Buscar pessoas e páginas');
    pill.innerHTML = `${svg(ICON.search)}<span>Buscar pessoas e páginas</span><kbd>Ctrl K</kbd>`;
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $('kbd', pill).textContent = '⌘ K';
    pill.addEventListener('click', openPalette);
    inner.insertBefore(pill, $('.social-header-actions', inner));
  }

  function enhanceSidebar() {
    const side = $('.social-sidebar');
    const me = NP.currentUser();
    if (!side || !me || $('.np-dock', side)) return;
    const name = me.nome_exibicao || me.nome_usuario || 'Jogador';
    const dock = el('a', 'np-dock');
    dock.href = `${root}paginas/meu-perfil.html`;
    dock.setAttribute('aria-label', `Abrir meu perfil, ${name}`);
    const av = el('span', 'np-dock-avatar', name.charAt(0).toUpperCase());
    av.setAttribute('aria-hidden', 'true');
    const txt = el('span', 'np-dock-text');
    txt.append(el('b', null, name), el('small', null, `@${me.nome_usuario || 'jogador'} · ${Number(me.pontos) || 0} pts`));
    dock.append(av, txt);
    side.append(dock);
  }

  async function refreshBadge(force) {
    const link = $$('.social-nav-link').find(a => /^Amigos/.test(a.textContent.trim()));
    if (!link) return;
    const r = await loadFriends(force);
    const n = r.ok && Array.isArray(r.data.recebidas) ? r.data.recebidas.length : 0;
    let badge = $('.np-badge', link);
    if (!n) { if (badge) badge.remove(); return; }
    if (!badge) { badge = el('span', 'np-badge'); link.append(badge); }
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.append(el('span', 'sr-only', ' solicitações de amizade pendentes'));
  }

  /* ---------- coluna direita (somente no feed) ---------- */
  const miniBtn = (label, cls, fn) => {
    const b = el('button', `np-mini-btn ${cls || ''}`.trim(), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };

  function widget(title, count, href, more) {
    const w = el('section', 'social-rail-card np-widget');
    const h = el('header', 'np-widget-head');
    h.append(el('h2', null, title));
    if (count) h.append(el('span', 'np-widget-count', String(count)));
    if (href) { const a = el('a', 'np-widget-more', more || 'Ver todos'); a.href = href; h.append(a); }
    w.append(h);
    return w;
  }

  function personRow(u, actions) {
    const row = el('div', 'np-person');
    row.append(avatar(u, 'np-person-avatar'));
    const t = el('div', 'np-person-text');
    const n = el('a', 'np-person-name', u.nome_exibicao || u.nome_usuario || 'Jogador');
    n.href = profileUrl(u);
    t.append(n, el('span', 'np-person-handle', `@${u.nome_usuario || 'jogador'}`));
    row.append(t);
    if (actions && actions.length) {
      const a = el('div', 'np-person-actions');
      actions.forEach(x => a.append(x));
      row.append(a);
    }
    return row;
  }

  async function friendCall(u, method, btn, okMsg) {
    btn.disabled = true;
    const r = await NP.api(`/usuarios/${encodeURIComponent(u.id)}/amizade`, { method });
    if (!r.ok) {
      btn.disabled = false;
      NP.toast(r.data.mensagem || 'Não foi possível atualizar esta amizade.');
      return false;
    }
    NP.toast(okMsg);
    return true;
  }

  async function fillRail(host) {
    const [fr, sg] = await Promise.all([loadFriends(true), NP.api('/usuarios/sugestoes')]);
    host.replaceChildren();
    const friends = fr.ok && Array.isArray(fr.data.amigos) ? fr.data.amigos : [];
    const received = fr.ok && Array.isArray(fr.data.recebidas) ? fr.data.recebidas : [];
    const suggestions = sg.ok && Array.isArray(sg.data.usuarios) ? sg.data.usuarios : [];
    const friendsPage = `${root}paginas/amigos.html`;

    if (received.length) {
      const w = widget('Pedidos de amizade', received.length, `${friendsPage}#friend-requests-received`);
      received.slice(0, 3).forEach(u => {
        const accept = miniBtn('Aceitar', '', async () => {
          if (await friendCall(u, 'PUT', accept, 'Solicitação aceita.')) { fillRail(host); refreshBadge(); }
        });
        const decline = miniBtn('Recusar', 'is-quiet', async () => {
          if (await friendCall(u, 'DELETE', decline, 'Solicitação recusada.')) { fillRail(host); refreshBadge(); }
        });
        w.append(personRow(u, [accept, decline]));
      });
      host.append(w);
    }

    if (fr.ok) {
      const w = widget('Amigos', friends.length || 0, `${friendsPage}#friends-list`);
      if (!friends.length) {
        const p = el('p', 'np-empty', 'Você ainda não tem amigos por aqui. ');
        const a = el('a', null, 'Encontre pessoas');
        a.href = friendsPage;
        p.append(a, '.');
        w.append(p);
      } else {
        friends.slice(0, 6).forEach(u => w.append(personRow(u)));
      }
      host.append(w);
    }

    if (suggestions.length) {
      const w = widget('Sugestões para você');
      suggestions.slice(0, 4).forEach(u => {
        const add = miniBtn('Adicionar', '', async () => {
          if (await friendCall(u, 'POST', add, 'Solicitação enviada.')) { add.textContent = 'Enviada'; add.disabled = true; }
        });
        w.append(personRow(u, [add]));
      });
      host.append(w);
    }
  }

  function buildRail() {
    if (page !== 'inicio') return;
    const rail = $('.social-rail');
    if (!rail || rail.dataset.np) return;
    rail.dataset.np = '1';
    const host = el('div', 'np-rail-stack');
    host.append(el('div', 'np-skel'));
    rail.append(host);
    fillRail(host);
  }

  /* ---------- feed ---------- */
  function relTime(iso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 45) return 'agora';
    const m = Math.floor(s / 60);
    if (m < 60) return `há ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h} h`;
    const d = Math.floor(h / 24);
    if (d === 1) return 'ontem';
    if (d < 7) return `há ${d} dias`;
    return null;
  }

  function stampTimes() {
    $$('.feed-post time[datetime], .feed-comment time[datetime]').forEach(t => {
      if (!t.dataset.full) t.dataset.full = t.textContent;
      const next = relTime(t.getAttribute('datetime')) || t.dataset.full;
      if (t.textContent !== next) t.textContent = next;
      t.title = t.dataset.full;
    });
  }

  function burst(post, e) {
    const r = post.getBoundingClientRect();
    const b = el('span', 'np-burst');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/></svg>';
    b.style.left = `${e.clientX - r.left}px`;
    b.style.top = `${e.clientY - r.top}px`;
    post.append(b);
    setTimeout(() => b.remove(), 900);
  }

  function initFeedEnhancements() {
    const list = $('#feed-list');
    if (!list) return;

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; stampTimes(); tryMore(); });
    };
    new MutationObserver(schedule).observe(list, { childList: true, subtree: true });
    setInterval(stampTimes, 60000);

    list.addEventListener('dblclick', e => {
      const hit = e.target instanceof Element && e.target.closest('.feed-post-text, .feed-post-image, .feed-post-reference');
      if (!hit) return;
      const post = hit.closest('.feed-post');
      const like = post && $('[data-feed-like]', post);
      if (!like) return;
      if (!reduce) burst(post, e);
      if (like.getAttribute('aria-pressed') !== 'true' && !like.disabled) like.click();
      const sel = window.getSelection && window.getSelection();
      if (sel) sel.removeAllRanges();
    });

    // Rolagem infinita: reaproveita o botão "Carregar mais" já existente.
    const more = $('#feed-load-more');
    function tryMore() {
      if (!more || more.hidden || more.disabled) return;
      if (more.textContent.trim() === 'Tentar novamente') return;
      const r = more.getBoundingClientRect();
      if (r.top < innerHeight + 600) more.click();
    }
    if (more && 'IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        if (entries.some(en => en.isIntersecting)) tryMore();
      }, { rootMargin: '600px 0px' }).observe(more);
    }
    schedule();
  }

  function enhanceComposer() {
    const box = $('.feed-composer');
    const ta = $('#feed-post-text');
    const form = $('#feed-post-form');
    if (!box || !ta || !form || box.dataset.np) return;
    box.dataset.np = '1';
    box.classList.add('np-composer');

    const me = NP.currentUser();
    if (me) {
      const a = el('span', 'np-composer-avatar', (me.nome_exibicao || me.nome_usuario || '?').charAt(0).toUpperCase());
      a.setAttribute('aria-hidden', 'true');
      box.prepend(a);
    }

    const footer = $('.feed-composer-footer', form);
    const btn = footer && $('.btn', footer);
    const ring = el('span', 'np-ring');
    ring.innerHTML = '<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="np-ring-bg" cx="18" cy="18" r="15"/><circle class="np-ring-fg" cx="18" cy="18" r="15" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100"/></svg><b></b>';
    if (footer && btn) {
      const end = el('div', 'np-composer-end');
      end.append(ring, btn);
      footer.append(end);
      btn.title = 'Ctrl + Enter para publicar';
    }

    const max = Number(ta.maxLength) || 2000;
    const update = () => {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 320)}px`;
      const n = ta.value.length;
      $('.np-ring-fg', ring).style.strokeDashoffset = String(100 - Math.min(100, (n / max) * 100));
      ring.dataset.state = n > max * 0.95 ? 'danger' : n > max * 0.8 ? 'warn' : '';
      $('b', ring).textContent = n > max * 0.8 ? String(max - n) : '';
      box.dataset.empty = n === 0 ? 'true' : 'false';
    };
    ta.addEventListener('input', update);
    ta.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); form.requestSubmit(); }
    });
    const status = $('#feed-post-status');
    if (status) new MutationObserver(update).observe(status, { childList: true, characterData: true, subtree: true });
    update();
  }

  /* ---------- extras ---------- */
  function scrollTopButton() {
    if ($('.np-top')) return;
    const b = el('button', 'np-top');
    b.type = 'button';
    b.hidden = true;
    b.setAttribute('aria-label', 'Voltar ao topo');
    b.innerHTML = svg(ICON.up);
    b.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
    document.body.append(b);
    let tick = false;
    addEventListener('scroll', () => {
      if (tick) return;
      tick = true;
      requestAnimationFrame(() => { b.hidden = scrollY < 900; tick = false; });
    }, { passive: true });
  }

  function friendsPrefill() {
    if (page !== 'amigos') return;
    const term = new URLSearchParams(location.search).get('busca');
    const input = $('#friends-search-input');
    const form = $('#friends-search-form');
    if (!term || !input || !form) return;
    setTimeout(() => {
      input.value = term.slice(0, 100);
      form.requestSubmit();
    }, 0);
  }

  /* ---------- início ---------- */
  initFeedEnhancements();
  whenShell(() => {
    enhanceTopbar();
    enhanceSidebar();
    enhanceComposer();
    refreshBadge();
    buildRail();
    friendsPrefill();
    scrollTopButton();
  });
})();
