/* Nexa Play — inicialização e comportamentos do site */
const GAME_URL = ''; // Integração pendente: URL do jogo Nexa Quest (ex.: 'https://...')
const { $, $$ } = NP;

/* ---------- Helpers visuais compartilhados da área social ---------- */
const NQ_ICON = {
  home: '<path d="m3 10.5 9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-6.5H9V21H4a1 1 0 0 1-1-1z"/>',
  explore: '<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5z"/>',
  create: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-5.5 6.5-5.5s6.5 1.900 6.500 5.500M16 4.800a3.500 3.500 0 0 1 0 6.400M18 14.800c2 .6 3.500 2.200 3.500 5.200"/>',
  projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.500h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.600-6.500 8-6.500s8 2.500 8 6.500"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.800-3.800"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
};
const nqSvg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

function userInitial(user) {
  return (user?.nome_exibicao || user?.nome_usuario || '?').trim().charAt(0).toUpperCase() || '?';
}

function avatarEl(user, size = 40, tag = 'span') {
  const el = document.createElement(tag);
  el.className = 'nq-avatar';
  el.style.setProperty('--s', `${size}px`);
  const initial = userInitial(user);
  const url = safeHttpsUrl(user?.avatar_url);
  if (url) {
    const image = document.createElement('img');
    image.src = url;
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => { image.remove(); el.textContent = initial; };
    el.append(image);
  } else {
    el.textContent = initial;
  }
  return el;
}

function formatRelative(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'agora';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `há ${days} d`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat('pt-BR', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(date).replace('.', '');
}

let ownProfilePromise = null;
function loadOwnProfile() {
  if (!ownProfilePromise) {
    ownProfilePromise = NP.api('/me/perfil').then(r => (r.ok && r.data.usuario ? r.data.usuario : null));
  }
  return ownProfilePromise;
}

function initTabs(list, onSelect) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const select = (name, focus) => {
    tabs.forEach(tab => {
      const on = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(tab.dataset.tab);
      if (panel) panel.classList.toggle('is-active', on);
      if (on && focus) tab.focus();
    });
    if (onSelect) onSelect(name);
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      const visible = tabs.filter(t => !t.hidden);
      const at = visible.indexOf(tab);
      let next = null;
      if (event.key === 'ArrowRight') next = visible[(at + 1) % visible.length];
      if (event.key === 'ArrowLeft') next = visible[(at - 1 + visible.length) % visible.length];
      if (event.key === 'Home') next = visible[0];
      if (event.key === 'End') next = visible[visible.length - 1];
      if (next) { event.preventDefault(); select(next.dataset.tab, true); }
    });
  });
  const initial = tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0];
  if (initial) select(initial.dataset.tab);
  return { select, tabs };
}

async function railRelationAction(person, button) {
  button.disabled = true;
  const response = await NP.api(`/usuarios/${encodeURIComponent(person.id)}/amizade`, { method: 'POST' });
  if (!response.ok) {
    button.disabled = false;
    NP.toast(response.data.mensagem || 'Não foi possível enviar a solicitação.');
    return;
  }
  button.textContent = 'Enviada';
}

function renderRailSuggestions(box) {
  const list = $('[data-rail-people]', box);
  NP.api('/usuarios/sugestoes').then(response => {
    const users = response.ok && Array.isArray(response.data.usuarios) ? response.data.usuarios.slice(0, 4) : [];
    if (!users.length) { box.hidden = true; return; }
    users.forEach(person => {
      const row = document.createElement('li');
      row.className = 'nq-person';
      const link = document.createElement('a');
      link.href = profileHref(person);
      const name = document.createElement('strong');
      name.textContent = person.nome_exibicao || person.nome_usuario;
      const handle = document.createElement('span');
      handle.textContent = `@${person.nome_usuario}`;
      link.append(name, handle);
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'btn-soft btn-sm';
      add.textContent = 'Adicionar';
      add.addEventListener('click', () => railRelationAction(person, add));
      row.append(avatarEl(person, 36), link, add);
      list.append(row);
    });
  });
}

function renderSocialShell(host, user) {
  const root = NP.root();
  const profile = `${root}paginas/meu-perfil.html`;
  const page = document.body.dataset.page;
  const navigation = [
    { key: 'inicio', label: 'Início', href: `${root}paginas/inicio.html`, path: NQ_ICON.home },
    { key: 'projetos-explorar', label: 'Explorar', href: `${root}paginas/explorar-projetos.html`, path: NQ_ICON.explore },
    { key: 'amigos', label: 'Pessoas', href: `${root}paginas/amigos.html`, path: NQ_ICON.people },
    { key: 'meus-projetos', label: 'Projetos', href: `${root}paginas/meus-projetos.html`, path: NQ_ICON.projects },
    { key: 'perfil', label: 'Perfil', href: profile, path: NQ_ICON.user },
  ];
  const activeMap = { 'perfil-publico': null, 'estatisticas-jogo': 'perfil', 'projeto-detalhe': 'projetos-explorar', 'projeto-criar': 'meus-projetos' };
  const activeKey = page in activeMap ? activeMap[page] : page;
  const link = (item, extra = '') => `<a href="${item.href}" title="${item.label}"${activeKey === item.key ? ' aria-current="page"' : ''}${extra}>${nqSvg(item.path)}<span>${item.label}</span></a>`;
  const publishHref = `${root}paginas/inicio.html?novo=1`;
  const initial = user.nome_usuario.charAt(0).toUpperCase();

  host.className = 'site-header social-topbar';
  host.innerHTML = `<div class="nq-top">
    <a class="nq-brand" href="${root}paginas/inicio.html" aria-label="Nexa Quest — início"><img src="${root}assets/imagens/logo-escura-quest.svg" alt="Nexa Quest" width="64" height="34"></a>
    <form class="nq-search" role="search" action="${root}paginas/amigos.html">
      ${nqSvg(NQ_ICON.search)}
      <label class="sr-only" for="nq-search-input">Buscar pessoas</label>
      <input id="nq-search-input" name="q" type="search" minlength="2" maxlength="100" placeholder="Buscar pessoas" autocomplete="off">
    </form>
    <div class="nq-top-actions">
      <div class="user-area">
        <button class="user-btn" id="user-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="user-menu" aria-label="Abrir menu da conta"></button>
        <div class="user-menu" id="user-menu" aria-label="Menu da conta">
          <div class="menu-id"><strong data-menu-name></strong><span>@${user.nome_usuario}</span></div>
          <a href="${profile}">Meu perfil</a>
          <a href="${root}paginas/meus-projetos.html">Meus projetos</a>
          <a href="${root}paginas/estatisticas.html">Atividade no jogo</a>
          <a href="#" data-game>Acessar o jogo</a>
          <button type="button" id="logout">Sair da conta</button>
        </div>
      </div>
    </div>
  </div>`;
  const accountButton = $('#user-btn');
  const accountMenu = $('#user-menu');
  accountButton.append(avatarEl({ nome_usuario: user.nome_usuario }, 34));
  $('[data-menu-name]').textContent = user.nome_usuario;
  accountButton.addEventListener('click', () => {
    const open = accountMenu.classList.toggle('open');
    accountButton.setAttribute('aria-expanded', open);
  });
  const closeAccountMenu = restoreFocus => {
    accountMenu.classList.remove('open');
    accountButton.setAttribute('aria-expanded', 'false');
    if (restoreFocus) accountButton.focus();
  };
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('.user-area')) closeAccountMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && accountMenu.classList.contains('open')) closeAccountMenu(true);
  });
  $('#logout').addEventListener('click', () => { NP.logout(); location.href = root + 'index.html'; });

  const shell = document.createElement('div');
  shell.className = 'social-shell';
  const sidebar = document.createElement('nav');
  sidebar.className = 'nq-nav';
  sidebar.setAttribute('aria-label', 'Principal');
  sidebar.innerHTML = `<ul>${navigation.map(item => `<li>${link(item)}</li>`).join('')}</ul><a class="btn" href="${publishHref}" data-publish>Publicar</a>`;

  const tabbar = document.createElement('nav');
  tabbar.className = 'nq-tabbar';
  tabbar.setAttribute('aria-label', 'Navegação principal');
  const short = key => navigation.find(item => item.key === key);
  tabbar.innerHTML = [short('inicio'), short('projetos-explorar')].map(item => link(item)).join('')
    + `<a class="is-create" href="${publishHref}" data-publish aria-label="Publicar">${nqSvg(NQ_ICON.create)}<span class="sr-only">Publicar</span></a>`
    + [short('amigos'), short('perfil')].map(item => link(item)).join('');

  const main = $('main');
  if (!main) return;
  main.classList.add('social-main');
  host.after(shell);
  shell.append(sidebar, main);

  if (page === 'inicio') {
    const side = document.createElement('aside');
    side.className = 'nq-side';
    side.setAttribute('aria-label', 'Resumo e sugestões');
    side.innerHTML = `<section class="nq-box" aria-label="Seu perfil">
        <div class="nq-mini"><span data-rail-avatar></span><div><strong data-rail-name></strong><span data-rail-handle></span></div></div>
        <div class="nq-mini-stats" data-rail-stats hidden></div>
      </section>
      <section class="nq-box" aria-labelledby="rail-people-title">
        <h2 id="rail-people-title">Pessoas para conhecer</h2>
        <ul class="nq-people" data-rail-people></ul>
        <a class="nq-more" href="${root}paginas/amigos.html">Ver mais pessoas</a>
      </section>
      <section class="nq-box" aria-labelledby="rail-game-title">
        <h2 id="rail-game-title">Nexa Quest</h2>
        <p class="nq-muted">Continue sua jornada e desbloqueie novas conquistas.</p>
        <a class="btn btn-sm" href="#" data-game style="margin-top:.75rem">Acessar o jogo</a>
      </section>`;
    shell.append(side);
    $('[data-rail-avatar]', side).replaceWith(avatarEl({ nome_usuario: user.nome_usuario }, 48));
    $('[data-rail-name]', side).textContent = user.nome_usuario;
    $('[data-rail-handle]', side).textContent = `${Number(user.pontos) || 0} pontos`;
    renderRailSuggestions($('[data-rail-people]', side).closest('.nq-box'));
  }
  document.body.append(tabbar);

  // Publicar: na própria página do feed, apenas leva o foco ao campo de texto.
  $$('[data-publish]').forEach(anchor => anchor.addEventListener('click', event => {
    const input = $('#feed-post-text');
    if (input) { event.preventDefault(); input.scrollIntoView({ block: 'center' }); input.focus(); }
  }));

  loadOwnProfile().then(own => {
    if (!own) return;
    accountButton.replaceChildren(avatarEl(own, 34));
    $('[data-menu-name]').textContent = own.nome_exibicao || own.nome_usuario;
    const composerAvatar = $('[data-composer-avatar]');
    if (composerAvatar) composerAvatar.replaceWith(avatarEl(own, 40));
    if (page === 'inicio') {
      const railAvatar = $('.nq-side .nq-mini .nq-avatar');
      railAvatar?.replaceWith(avatarEl(own, 48));
      $('[data-rail-name]').textContent = own.nome_exibicao || own.nome_usuario;
      $('[data-rail-handle]').textContent = `@${own.nome_usuario}`;
      const stats = $('[data-rail-stats]');
      const values = own.estatisticas || {};
      [['Amigos', values.amigos], ['Conquistas', values.conquistas], ['Pontos', values.pontos]].forEach(([label, value]) => {
        if (value === null || value === undefined) return;
        const cell = document.createElement('div');
        const strong = document.createElement('b');
        strong.textContent = Number(value).toLocaleString('pt-BR');
        cell.append(strong, label);
        stats.append(cell);
      });
      stats.hidden = !stats.childElementCount;
    }
  });
}

function renderHeader() {
  const host = $('[data-component="header"]'); if (!host) return;
  const r = NP.root(), user = NP.currentUser(), home = r + (user ? 'paginas/inicio.html' : 'index.html'), page = document.body.dataset.page;
  if (document.body.dataset.protected && user) {
    renderSocialShell(host, user);
    return;
  }
  const perfil = r + 'paginas/meu-perfil.html';
  const link = (href, txt, key) => `<a href="${href}"${page === key ? ' aria-current="page"' : ''}>${txt}</a>`;
  const inicial = user ? user.nome_usuario[0].toUpperCase() : NP.icon.user;
  host.className = 'site-header';
  host.innerHTML = `<div class="wrap"><a class="brand" href="${home}" aria-label="Nexa Quest — início"><img src="${r}assets/imagens/logo-escura-quest.svg" alt="Nexa Play" width="157" height="84"></a>
  <nav class="nav" id="nav" aria-label="Principal">${user
    ? link(home, 'Início', 'inicio') + link(perfil + '#missoes', 'Missões', 'missoes') + link(perfil + '#desafios', 'Desafios', 'desafios') + link(perfil, 'Meu Perfil', 'perfil')
    : link(home, 'Início', 'inicio') + link(r + 'paginas/sobre-nexa-play.html', 'Sobre', 'sobre') + link(r + 'paginas/login.html', 'Login', 'login')}</nav>
  <div class="user-area">${user
      ? `<button class="user-btn" id="user-btn" aria-haspopup="true" aria-expanded="false" aria-label="Menu de ${user.nome_usuario}">${inicial}</button><div class="user-menu" id="user-menu"><a href="${r}paginas/inicio.html">Meu início</a><a href="${perfil}">Meu perfil</a><button type="button" id="logout">Sair</button></div>`
      : `<a class="user-btn" href="${r}paginas/login.html" aria-label="Entrar" title="Entrar">${inicial}</a>`}
  <button class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="nav" aria-label="Abrir menu"><span></span></button></div></div>`;
  const nav = $('#nav'), mb = $('#menu-btn');
  mb.addEventListener('click', () => { const o = nav.classList.toggle('open'); mb.setAttribute('aria-expanded', o); });
  nav.addEventListener('click', e => { if (e.target.tagName === 'A') { nav.classList.remove('open'); mb.setAttribute('aria-expanded', false); } });
  const ub = $('#user-btn');
  if (ub) {
    const menu = $('#user-menu');
    ub.addEventListener('click', () => { const o = menu.classList.toggle('open'); ub.setAttribute('aria-expanded', o); });
    const closeMenu = restoreFocus => {
      menu.classList.remove('open');
      ub.setAttribute('aria-expanded', 'false');
      if (restoreFocus) ub.focus();
    };
    document.addEventListener('click', e => {
      if (!(e.target instanceof Element) || !e.target.closest('.user-area')) closeMenu(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu(true);
    });
    $('#logout').addEventListener('click', () => { NP.logout(); location.href = r + 'index.html'; });
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      nav.classList.remove('open');
      mb.setAttribute('aria-expanded', 'false');
    }
  });
}

function renderFooter() {
  const host = $('[data-component="footer"]'); if (!host) return;
  const r = NP.root(), home = r + (NP.currentUser() ? 'paginas/inicio.html' : 'index.html');
  const s = (n, d) => `<a href="https://www.${n}.com" target="_blank" rel="noopener noreferrer" aria-label="${n}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg></a>`;
  host.className = 'site-footer';
  host.innerHTML = `<div class="wrap"><a href="${home}" aria-label="Nexa Play"><img src="${r}assets/imagens/logo-branca.svg" alt="Nexa Play" width="157" height="84"></a>
  <div><h3>NEXA QUEST</h3><ul><li><a href="${home}">Início</a></li>${NP.currentUser() ? `<li><a href="${r}paginas/meu-perfil.html">Meu Perfil</a></li><li><a href="${r}paginas/meu-perfil.html#comunidade">Comunidade</a></li>` : `<li><a href="${r}index.html#como-funciona">Como funciona</a></li><li><a href="${r}index.html#comunidade">Comunidade</a></li>`}</ul></div>
  <div><h3>NEXA PLAY</h3><ul><li><a href="${r}paginas/sobre-nexa-play.html">Sobre a Nexa Play</a></li><li><a href="${r}paginas/sobre-nexa-play.html#parceiros">Parceiros</a></li><li><a href="${r}paginas/sobre-nexa-play.html#contato">Contato</a></li></ul></div>
  <div><h3>SIGA NOSSAS REDES</h3><div class="social">${s('instagram', 'M7 2h10a5 5 0 015 5v10a5 5 0 01-5 5H7a5 5 0 01-5-5V7a5 5 0 015-5zm0 2a3 3 0 00-3 3v10a3 3 0 003 3h10a3 3 0 003-3V7a3 3 0 00-3-3zm5 3.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9zm0 2a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm5.2-3.2a1.1 1.1 0 110 2.2 1.1 1.1 0 010-2.2z')}${s('tiktok', 'M14 3h3a5 5 0 004 4v3a8 8 0 01-4-1.2V15a6 6 0 11-6-6v3.2a3 3 0 103 2.8z')}${s('youtube', 'M22 8a3 3 0 00-2-2c-1.8-.5-8-.5-8-.5s-6.200 0-8 .5A3 3 0 002 8c-.5 1.800-.5 4-.5 4s0 2.200.5 4a3 3 0 002 2c1.800.5 8 .5 8 .5s6.200 0 8-.5a3 3 0 002-2c.5-1.800.5-4 .5-4s0-2.200-.5-4zM10 15V9l5 3z')}${s('x', 'M18.200 2h3.200l-7 8 8.200 12h-6.400l-5-7.300L5.500 22H2.300l7.500-8.600L2 2h6.500l4.500 6.600zm-1.100 18h1.800L7.100 3.800H5.200z')}</div></div></div>`;
}

function initContact() {
  const f = $('#form-contato'); if (!f) return;
  const u = NP.currentUser(); if (u) { f.nome.value = u.nome_usuario; f.email.value = u.email; }
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const ok = [NP.setErr(f.nome, f.nome.value.trim().length < 2 ? 'Informe seu nome.' : ''),
    NP.setErr(f.email, NP.isEmail(f.email.value.trim()) ? '' : 'Informe um e-mail válido.'),
    NP.setErr(f.assunto, f.assunto.value.trim().length < 3 ? 'Informe o assunto.' : ''),
    NP.setErr(f.msg, f.msg.value.trim().length < 10 ? 'Escreva ao menos 10 caracteres.' : '')].every(Boolean);
    if (!ok) return NP.status($('#contato-status'), 'Revise os campos destacados.', false);
    const btn = $('button[type=submit]', f); btn.disabled = true;
    const r = await NP.api('/mensagens', { method: 'POST', body: { nome: f.nome.value.trim(), email: f.email.value.trim(), assunto: f.assunto.value.trim(), msg: f.msg.value.trim() } });
    btn.disabled = false;
    if (!r.ok) return NP.status($('#contato-status'), r.data.mensagem || 'Não foi possível enviar a mensagem.', false);
    f.msg.value = f.assunto.value = '';
    NP.status($('#contato-status'), 'Mensagem enviada. Obrigado pelo contato!', true);
  });
}

function initRegister() {
  const f = $('#form-cadastro'); if (!f) return;
  const confirmarSenha = f.elements.namedItem('confirmar-senha');
  const validarConfirmacao = () => {
    const mensagem = !confirmarSenha.value
      ? 'Confirme sua senha.'
      : confirmarSenha.value !== f.senha.value ? 'As senhas não coincidem.' : '';
    return NP.setErr(confirmarSenha, mensagem);
  };
  confirmarSenha.addEventListener('input', validarConfirmacao);
  f.senha.addEventListener('input', () => {
    if (confirmarSenha.value) validarConfirmacao();
  });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const nomeCompleto = f.nome_completo.value.trim();
    const nomeUsuario = f.nome_usuario.value.trim();
    const email = f.email.value.trim();
    const ok = [NP.setErr(f.nome_completo, nomeCompleto.length > 0 && nomeCompleto.length <= 100 ? '' : 'Informe seu nome completo (até 100 caracteres).'),
    NP.setErr(f.nome_usuario, /^[A-Za-z0-9_]{3,30}$/.test(nomeUsuario) ? '' : 'Use de 3 a 30 letras, números ou _ no nome de usuário.'),
    NP.setErr(f.email, NP.isEmail(email) ? '' : 'Informe um e-mail válido.'),
    NP.setErr(f.senha, f.senha.value.length < 6 ? 'A senha precisa ter ao menos 6 caracteres.' : ''),
    validarConfirmacao()].every(Boolean);
    if (!ok) return NP.status($('#cadastro-status'), 'Revise os campos destacados.', false);
    const btn = $('button[type=submit]', f); btn.disabled = true; NP.status($('#cadastro-status'), 'Criando sua conta…', true);
    const r = await NP.api('/usuarios', { method: 'POST', body: { nome_completo: nomeCompleto, nome_usuario: nomeUsuario, email, senha: f.senha.value, lembrar: true } });
    if (!r.ok) {
      btn.disabled = false;
      if (r.status === 409) {
        const campo = r.data.mensagem?.includes('usuário') ? f.nome_usuario : f.email;
        NP.setErr(campo, r.data.mensagem);
      }
      return NP.status($('#cadastro-status'), r.data.mensagem || 'Não foi possível criar a conta.', false);
    }
    NP.login(r.data.token, true); NP.status($('#cadastro-status'), 'Conta criada! Redirecionando…', true); setTimeout(() => location.href = 'inicio.html', 700);
  });
}

function initLogin() {
  const f = $('#form-login'); if (!f) return;
  f.addEventListener('submit', async e => {
    e.preventDefault(); const id = f.id_login.value.trim();
    const ok = [NP.setErr(f.id_login, id ? '' : 'Informe seu e-mail ou usuário.'), NP.setErr(f.senha, f.senha.value ? '' : 'Informe sua senha.')].every(Boolean);
    if (!ok) return;
    const btn = $('button[type=submit]', f); btn.disabled = true;
    const r = await NP.api('/login', { method: 'POST', body: { id_login: id, senha: f.senha.value, lembrar: f.lembrar.checked } });
    btn.disabled = false;
    if (!r.ok) return NP.status($('#login-status'), r.data.mensagem || 'Não foi possível entrar.', false);
    NP.login(r.data.token, f.lembrar.checked); location.href = 'inicio.html';
  });
  $('#google-btn').addEventListener('click', () => NP.status($('#login-status'), 'Login com Google ainda não está configurado (requer integração com o Google Identity). Use e-mail e senha.', false));
}

function initHome() {
  if (document.body.dataset.protected) { if (!NP.currentUser()) return void (location.href = 'login.html'); }
  const u = NP.currentUser(); if (!u) return;
  $$('[data-user-name]').forEach(el => el.textContent = u.nome_usuario.toUpperCase());
  const set = (k, v) => { const el = $(`[data-stat="${k}"]`); if (el) el.textContent = v; };
  set('pontos', u.pontos ?? '—');
  set('desafios', u.desafios ?? '—');
  set('conquistas', u.conquistas ?? '—');
  const nivel = Number(u.nivel);
  set('nivel', u.nivel !== null && u.nivel !== undefined && Number.isFinite(nivel)
    ? `Nível ${String(nivel).padStart(2, '0')}`
    : 'Indisponível');
}

function formatSocialDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function profileHref(user) {
  const currentUser = NP.currentUser();
  if (currentUser && String(currentUser.id) === String(user.id)) {
    return `${NP.root()}paginas/meu-perfil.html`;
  }
  return `${NP.root()}paginas/perfil-publico.html?id=${encodeURIComponent(user.id)}`;
}

function addSafeImage(container, src, alt) {
  if (typeof src !== 'string' || !src.trim()) return;
  let url;
  try {
    url = new URL(src, location.origin);
  } catch {
    return;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  const image = document.createElement('img');
  image.className = 'feed-post-image';
  image.src = url.href;
  image.alt = typeof alt === 'string' ? alt : '';
  image.loading = 'lazy';
  image.decoding = 'async';
  container.append(image);
}

function makeProfileAnchor(user, className) {
  const link = document.createElement('a');
  link.className = className;
  link.href = profileHref(user);
  link.textContent = user.nome_exibicao || `@${user.nome_usuario || 'usuario'}`;
  return link;
}

function safeHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function setProfileImage(image, value) {
  if (!image) return;
  const src = safeHttpsUrl(value);
  image.hidden = !src;
  if (!src) {
    image.removeAttribute('src');
    return;
  }
  image.onerror = () => { image.hidden = true; };
  image.onload = () => { image.hidden = false; };
  image.src = src;
}

function renderFeedComment(comment) {
  const item = document.createElement('article');
  item.className = 'feed-comment';
  const body = document.createElement('div');
  body.className = 'feed-comment-body';
  const heading = document.createElement('div');
  heading.className = 'feed-comment-heading';
  heading.append(makeProfileAnchor(comment.autor, 'feed-comment-author'));
  const date = document.createElement('time');
  date.dateTime = comment.criado_em || '';
  date.title = formatSocialDate(comment.criado_em);
  date.textContent = formatRelative(comment.criado_em);
  heading.append(date);
  const text = document.createElement('p');
  text.textContent = comment.texto || '';
  body.append(heading, text);
  item.append(avatarEl(comment.autor, 32), body);
  return item;
}

function renderFeedPost(post) {
  const item = document.createElement('article');
  item.className = 'feed-post';
  item.id = `publicacao-${post.id}`;
  item.dataset.postId = post.id;

  const heading = document.createElement('header');
  heading.className = 'feed-post-header';
  const avatarLink = document.createElement('a');
  avatarLink.className = 'feed-avatar';
  avatarLink.href = profileHref(post.autor);
  avatarLink.setAttribute('aria-label', `Ver perfil de ${post.autor.nome_usuario || 'usuário'}`);
  avatarLink.append(avatarEl(post.autor, 40));
  const authorMeta = document.createElement('div');
  authorMeta.className = 'feed-post-author-meta';
  authorMeta.append(makeProfileAnchor(post.autor, 'feed-post-author'));
  const sub = document.createElement('div');
  sub.className = 'feed-post-sub';
  const date = document.createElement('time');
  date.dateTime = post.criado_em || '';
  date.title = formatSocialDate(post.criado_em);
  date.textContent = formatRelative(post.criado_em);
  sub.append(`@${post.autor.nome_usuario || 'usuario'} · `, date);
  authorMeta.append(sub);
  heading.append(avatarLink, authorMeta);

  const text = document.createElement('p');
  text.className = 'feed-post-text';
  text.textContent = post.texto || '';
  item.append(heading, text);

  if (post.conquista && post.conquista.titulo) {
    const achievement = document.createElement('div');
    achievement.className = 'feed-post-reference';
    const badge = document.createElement('span');
    badge.className = 'attach-badge';
    badge.innerHTML = nqSvg(NQ_ICON.trophy);
    const info = document.createElement('div');
    info.className = 'attach-text';
    const name = document.createElement('strong');
    name.textContent = post.conquista.titulo;
    const kind = document.createElement('span');
    kind.textContent = 'Conquista desbloqueada';
    info.append(name, kind);
    achievement.append(badge, info);
    item.append(achievement);
  }
  addSafeImage(item, post.imagem_url, post.imagem_alt);
  if (post.projeto && typeof post.projeto.titulo === 'string' && typeof post.projeto.url === 'string') {
    let projectUrl;
    try {
      projectUrl = new URL(post.projeto.url, location.origin);
    } catch {
      projectUrl = null;
    }
    if (projectUrl && (projectUrl.protocol === 'https:' || projectUrl.protocol === 'http:')) {
      const projectLink = document.createElement('a');
      projectLink.className = 'feed-project-reference';
      projectLink.href = projectUrl.href;
      const projectBadge = document.createElement('span');
      projectBadge.className = 'attach-badge';
      projectBadge.innerHTML = nqSvg(NQ_ICON.projects);
      const projectInfo = document.createElement('div');
      projectInfo.className = 'attach-text';
      const projectName = document.createElement('strong');
      projectName.textContent = post.projeto.titulo;
      const projectKind = document.createElement('span');
      projectKind.textContent = 'Projeto';
      projectInfo.append(projectName, projectKind);
      projectLink.append(projectBadge, projectInfo);
      if (projectUrl.origin !== location.origin) {
        projectLink.target = '_blank';
        projectLink.rel = 'noopener noreferrer';
      }
      item.append(projectLink);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'feed-post-actions';
  const like = document.createElement('button');
  like.className = 'feed-action';
  like.type = 'button';
  like.dataset.feedLike = '';
  like.setAttribute('aria-pressed', String(Boolean(post.curtida_pelo_usuario)));
  like.setAttribute('aria-label', post.curtida_pelo_usuario ? 'Remover curtida' : 'Curtir publicação');
  like.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/></svg>';
  like.append(document.createTextNode(` ${Number(post.curtidas) || 0}`));
  const commentsButton = document.createElement('button');
  commentsButton.className = 'feed-action';
  commentsButton.type = 'button';
  commentsButton.dataset.feedCommentsToggle = '';
  commentsButton.setAttribute('aria-expanded', 'false');
  commentsButton.setAttribute('aria-label', `${Number(post.quantidade_comentarios) || 0} comentários`);
  commentsButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></svg>';
  commentsButton.append(document.createTextNode(` ${Number(post.quantidade_comentarios) || 0}`));
  const share = document.createElement('button');
  share.className = 'feed-action';
  share.type = 'button';
  share.dataset.feedShare = '';
  share.setAttribute('aria-label', 'Compartilhar publicação');
  share.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.7 6.8-4.4m-6.8 7 6.8 4.3"/></svg><span class="sr-only">Compartilhar</span>';
  actions.append(like, commentsButton, share);

  const comments = document.createElement('section');
  comments.className = 'feed-comments';
  comments.hidden = true;
  comments.setAttribute('aria-label', 'Comentários da publicação');
  const commentList = document.createElement('div');
  commentList.className = 'feed-comment-list';
  commentList.dataset.commentList = '';
  const commentStatus = document.createElement('p');
  commentStatus.className = 'feed-status';
  commentStatus.dataset.commentStatus = '';
  commentStatus.setAttribute('role', 'status');
  const commentMore = document.createElement('button');
  commentMore.className = 'feed-comment-more';
  commentMore.type = 'button';
  commentMore.dataset.commentMore = '';
  commentMore.hidden = true;
  commentMore.textContent = 'Carregar comentários anteriores';
  const commentForm = document.createElement('form');
  commentForm.className = 'feed-comment-form';
  commentForm.dataset.commentForm = '';
  const commentInput = document.createElement('textarea');
  commentInput.name = 'texto';
  commentInput.maxLength = 1000;
  commentInput.rows = 1;
  commentInput.placeholder = 'Adicione um comentário…';
  commentInput.setAttribute('aria-label', 'Escreva um comentário');
  commentInput.required = true;
  const commentSubmit = document.createElement('button');
  commentSubmit.className = 'btn btn-sm';
  commentSubmit.type = 'submit';
  commentSubmit.textContent = 'Comentar';
  commentForm.append(commentInput, commentSubmit);
  comments.append(commentList, commentMore, commentStatus, commentForm);
  item.append(actions, comments);

  let commentsCursor = null;
  let commentsLoaded = false;
  let commentsLoading = false;
  const loadComments = async (reset = false) => {
    if (commentsLoading || (!reset && commentsLoaded && !commentsCursor)) return;
    commentsLoading = true;
    commentStatus.textContent = 'Carregando comentários…';
    commentMore.disabled = true;
    const query = new URLSearchParams({ limite: '10' });
    if (!reset && commentsCursor) query.set('cursor', commentsCursor);
    const response = await NP.api(`/publicacoes/${encodeURIComponent(post.id)}/comentarios?${query}`);
    commentsLoading = false;
    commentMore.disabled = false;
    if (!response.ok || !Array.isArray(response.data.comentarios)) {
      commentStatus.textContent = response.data.mensagem || 'Não foi possível carregar os comentários.';
      return;
    }
    if (reset) commentList.replaceChildren();
    response.data.comentarios.forEach(comment => commentList.append(renderFeedComment(comment)));
    commentsCursor = response.data.proximoCursor || null;
    commentsLoaded = true;
    commentMore.hidden = !commentsCursor;
    commentStatus.textContent = response.data.comentarios.length
      ? ''
      : 'Nenhum comentário ainda. Comece a conversa.';
  };
  commentsButton.addEventListener('click', async () => {
    const open = comments.hidden;
    comments.hidden = !open;
    commentsButton.setAttribute('aria-expanded', String(open));
    if (open && !commentsLoaded) await loadComments(true);
    if (open) commentInput.focus();
  });
  commentMore.addEventListener('click', () => loadComments());
  commentForm.addEventListener('submit', async event => {
    event.preventDefault();
    const texto = commentInput.value.trim();
    if (!texto) return;
    commentSubmit.disabled = true;
    const response = await NP.api(`/publicacoes/${encodeURIComponent(post.id)}/comentarios`, {
      method: 'POST',
      body: { texto },
    });
    commentSubmit.disabled = false;
    if (!response.ok || !response.data.comentario) {
      commentStatus.textContent = response.data.mensagem || 'Não foi possível publicar o comentário.';
      return;
    }
    commentInput.value = '';
    commentStatus.textContent = '';
    if (!comments.hidden) {
      if (!commentsLoaded) await loadComments(true);
      else commentList.prepend(renderFeedComment(response.data.comentario));
    }
    const total = Number(commentsButton.dataset.count || post.quantidade_comentarios || 0) + 1;
    commentsButton.dataset.count = String(total);
    commentsButton.lastChild.textContent = ` ${total}`;
    commentsButton.setAttribute('aria-label', `${total} comentários`);
  });

  like.addEventListener('click', async () => {
    like.disabled = true;
    const liked = like.getAttribute('aria-pressed') === 'true';
    const response = await NP.api(`/publicacoes/${encodeURIComponent(post.id)}/curtida`, {
      method: liked ? 'DELETE' : 'PUT',
    });
    like.disabled = false;
    if (!response.ok || typeof response.data.curtida !== 'boolean') {
      NP.toast(response.data.mensagem || 'Não foi possível atualizar a curtida.');
      return;
    }
    like.setAttribute('aria-pressed', String(response.data.curtida));
    like.setAttribute('aria-label', response.data.curtida ? 'Remover curtida' : 'Curtir publicação');
    like.lastChild.textContent = ` ${Number(response.data.curtidas) || 0}`;
  });
  share.addEventListener('click', async () => {
    const url = new URL(`${NP.root()}paginas/inicio.html`, location.href);
    url.searchParams.set('publicacao', post.id);
    url.hash = item.id;
    const shareData = { title: `Publicação de ${post.autor.nome_exibicao || post.autor.nome_usuario}`, text: post.texto, url: url.href };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (erro) {
        if (erro.name !== 'AbortError') NP.toast('Não foi possível compartilhar esta publicação.');
      }
      return;
    }
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      NP.toast('Seu navegador não permite copiar o link de compartilhamento.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url.href);
      NP.toast('Link da publicação copiado.');
    } catch {
      NP.toast('Não foi possível copiar o link da publicação.');
    }
  });
  return item;
}

function initFeed() {
  const list = $('#feed-list');
  if (!list) return;
  const form = $('#feed-post-form');
  const input = $('#feed-post-text');
  const formStatus = $('#feed-post-status');
  const status = $('#feed-status');
  const more = $('#feed-load-more');
  const userId = document.body.dataset.feedUserId;
  const sharedPostId = new URLSearchParams(location.search).get('publicacao');
  const validSharedPostId = sharedPostId && /^\d{1,18}$/.test(sharedPostId) && BigInt(sharedPostId) > 0n
    ? sharedPostId
    : null;
  let cursor = null;
  let loading = false;

  const loadPage = async (reset = false) => {
    if (loading) return;
    loading = true;
    let sharedPost = null;
    let sharedPostError = '';
    list.setAttribute('aria-busy', 'true');
    more.disabled = true;
    status.textContent = reset ? '' : 'Carregando mais publicações…';
    if (reset) {
      cursor = null;
      list.replaceChildren();
      if (validSharedPostId && !userId) {
        const sharedResponse = await NP.api(`/publicacoes/${encodeURIComponent(validSharedPostId)}`);
        if (sharedResponse.ok && sharedResponse.data.publicacao) {
          sharedPost = sharedResponse.data.publicacao;
        } else {
          sharedPostError = sharedResponse.data.mensagem || 'A publicação compartilhada não está disponível.';
        }
      }
      if (!sharedPost) {
        const skeleton = document.createElement('div');
        skeleton.className = 'feed-loading';
        skeleton.setAttribute('role', 'status');
        skeleton.innerHTML = '<div class="skeleton-row"><i></i><i></i></div><div class="skeleton-row"><i></i><i></i></div>';
        list.append(skeleton);
      } else {
        list.append(renderFeedPost(sharedPost));
      }
    }
    const query = new URLSearchParams({ limite: '10' });
    if (cursor) query.set('cursor', cursor);
    if (userId) query.set('usuario', userId);
    const response = await NP.api(`/publicacoes?${query}`);
    loading = false;
    list.setAttribute('aria-busy', 'false');
    more.disabled = false;
    if (!response.ok || !Array.isArray(response.data.publicacoes)) {
      if (!reset) {
        status.textContent = response.data.mensagem || 'Não foi possível carregar mais publicações.';
        more.textContent = 'Tentar novamente';
        more.hidden = false;
        return;
      }
      list.replaceChildren();
      if (sharedPost) list.append(renderFeedPost(sharedPost));
      const error = document.createElement('div');
      error.className = 'feed-empty feed-error';
      const message = document.createElement('p');
      message.textContent = response.data.mensagem || 'Não foi possível carregar as publicações.';
      const retry = document.createElement('button');
      retry.className = 'feed-load-more';
      retry.type = 'button';
      retry.textContent = 'Tentar novamente';
      retry.addEventListener('click', () => loadPage(reset));
      error.append(message, retry);
      list.append(error);
      status.textContent = sharedPostError;
      more.hidden = true;
      return;
    }
    more.textContent = 'Carregar mais publicações';
    if (reset) list.replaceChildren();
    if (sharedPost) list.append(renderFeedPost(sharedPost));
    const publicacoesExistentes = new Set(
      [...list.querySelectorAll('[data-post-id]')].map(item => item.dataset.postId),
    );
    response.data.publicacoes
      .filter(post => !publicacoesExistentes.has(String(post.id)))
      .forEach(post => list.append(renderFeedPost(post)));
    cursor = response.data.proximoCursor || null;
    more.hidden = !cursor;
    status.textContent = sharedPostError;
    if (reset && response.data.publicacoes.length === 0 && !list.querySelector('.feed-post')) {
      const empty = document.createElement('div');
      empty.className = 'feed-empty';
      const title = document.createElement('strong');
      title.textContent = userId ? 'Nenhuma publicação ainda.' : 'O feed ainda está vazio.';
      const message = document.createElement('p');
      message.textContent = userId
        ? 'As publicações desta pessoa aparecerão aqui.'
        : 'Publique a primeira ideia da comunidade ou siga alguém em Pessoas.';
      empty.append(title, message);
      list.append(empty);
    } else if (!reset && response.data.publicacoes.length === 0) {
      more.hidden = true;
    }
  };

  more.addEventListener('click', () => loadPage());
  if (form) {
    const count = $('#feed-post-count');
    const open = () => form.classList.add('is-open');
    const refresh = () => {
      if (count) {
        count.textContent = `${input.value.length}/2000`;
        count.classList.toggle('is-near', input.value.length > 1800);
      }
    };
    input.addEventListener('focus', open);
    input.addEventListener('input', () => { open(); refresh(); });
    input.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') form.requestSubmit();
    });
    if (new URLSearchParams(location.search).get('novo') === '1') setTimeout(() => input.focus(), 150);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const texto = input.value.trim();
      if (!texto) {
        NP.status(formStatus, 'Escreva algo antes de publicar.', false);
        return;
      }
      const button = $('button[type="submit"]', form);
      button.disabled = true;
      NP.status(formStatus, 'Publicando…', true);
      const response = await NP.api('/publicacoes', { method: 'POST', body: { texto } });
      button.disabled = false;
      if (!response.ok || !response.data.publicacao) {
        NP.status(formStatus, response.data.mensagem || 'Não foi possível publicar.', false);
        return;
      }
      input.value = '';
      form.classList.remove('is-open');
      input.blur();
      if (count) count.textContent = '0/2000';
      NP.status(formStatus, 'Publicado.', true);
      const empty = list.querySelector('.feed-empty');
      if (empty) empty.remove();
      list.prepend(renderFeedPost(response.data.publicacao));
      setTimeout(() => { if (formStatus) formStatus.textContent = ''; }, 3500);
    });
  }
  loadPage(true);
}

function setProfileStat(container, label, value, detail) {
  const stat = document.createElement('div');
  stat.className = 'player-stat';
  const name = document.createElement('span');
  name.textContent = label;
  const total = document.createElement('strong');
  total.textContent = value;
  stat.append(name, total);
  if (detail) {
    const description = document.createElement('small');
    description.textContent = detail;
    stat.append(description);
  }
  container.append(stat);
}

function renderProfileAchievements(profile) {
  const section = $('#conquistas');
  const list = $('[data-profile-achievements]');
  if (!section || !list) return;
  if (!Array.isArray(profile.conquistas)) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  list.replaceChildren();
  const count = $('[data-achievement-count]');
  if (count) {
    const total = profile.estatisticas?.conquistas ?? profile.conquistas.length;
    count.textContent = total > profile.conquistas.length
      ? `${profile.conquistas.length}/${total}`
      : String(total);
  }
  if (!profile.conquistas.length) {
    const empty = document.createElement('p');
    empty.className = 'profile-empty';
    empty.textContent = 'Ainda não há conquistas registradas neste perfil.';
    list.append(empty);
    return;
  }
  profile.conquistas.forEach(achievement => {
    const item = document.createElement('article');
    item.className = 'profile-achievement';
    const icon = document.createElement('span');
    icon.className = 'profile-achievement-icon';
    if (safeHttpsUrl(achievement.icone)) {
      const image = document.createElement('img');
      setProfileImage(image, achievement.icone);
      image.alt = '';
      image.loading = 'lazy';
      icon.append(image);
    } else {
      icon.innerHTML = nqSvg(NQ_ICON.trophy);
      icon.firstElementChild.setAttribute('width', '22');
      icon.firstElementChild.setAttribute('height', '22');
    }
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = achievement.titulo || 'Conquista';
    const description = document.createElement('p');
    description.textContent = achievement.descricao || 'Conquista registrada no Nexa Quest.';
    details.append(title, description);
    item.append(icon, details);
    list.append(item);
  });
}

function buildProgressTrack(percent) {
  const meter = document.createElement('div');
  meter.className = 'profile-progress-track';
  meter.setAttribute('role', 'progressbar');
  meter.setAttribute('aria-label', 'Progresso registrado no Nexa Quest');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', '100');
  meter.setAttribute('aria-valuenow', String(percent));
  const bar = document.createElement('span');
  bar.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
  meter.append(bar);
  return meter;
}

function renderProfileActivity(container, data) {
  const summary = document.createElement('div');
  summary.className = 'act-summary';
  [[data.concluidas, 'atividades concluídas'], [data.em_andamento, 'em andamento'], [`${data.percentual}%`, 'da jornada concluída']].forEach(([value, label]) => {
    const card = document.createElement('div');
    card.className = 'act-card';
    const strong = document.createElement('strong');
    strong.textContent = typeof value === 'number' ? value.toLocaleString('pt-BR') : value;
    const span = document.createElement('span');
    span.textContent = label;
    card.append(strong, span);
    summary.append(card);
  });
  container.append(summary);

  const months = Array.isArray(data.evolucao) ? data.evolucao : [];
  if (months.length >= 2) {
    const box = document.createElement('section');
    box.className = 'act-box';
    const title = document.createElement('h3');
    title.textContent = 'Atividades concluídas por mês';
    const chart = document.createElement('div');
    chart.className = 'game-evolution-chart';
    const max = Math.max(...months.map(item => Number(item.atividades_concluidas) || 0), 1);
    months.forEach(item => {
      const count = Number(item.atividades_concluidas) || 0;
      const column = document.createElement('div');
      column.className = 'game-chart-column';
      column.setAttribute('aria-label', `${formatGameMonth(item.mes)}: ${count} atividades concluídas`);
      const value = document.createElement('strong');
      value.textContent = String(count);
      const track = document.createElement('div');
      track.className = 'game-chart-track';
      const bar = document.createElement('span');
      bar.style.height = `${Math.max(8, Math.round((count / max) * 100))}%`;
      track.append(bar);
      const label = document.createElement('span');
      label.className = 'game-chart-month';
      label.textContent = formatGameMonth(item.mes);
      column.append(value, track, label);
      chart.append(column);
    });
    box.append(title, chart);
    container.append(box);
  }

  const history = Array.isArray(data.historico) ? data.historico.slice(0, 6) : [];
  if (history.length) {
    const box = document.createElement('section');
    box.className = 'act-box';
    const title = document.createElement('h3');
    title.textContent = 'Atividades recentes';
    const list = document.createElement('div');
    list.className = 'game-history-list';
    history.forEach(activity => {
      const row = document.createElement('article');
      row.className = 'game-history-item';
      const name = document.createElement('strong');
      name.textContent = activity.titulo || 'Atividade concluída';
      const points = document.createElement('span');
      points.className = 'game-history-points';
      points.textContent = `+${Number(activity.pontuacao) || 0} pts`;
      const meta = document.createElement('time');
      meta.dateTime = activity.concluida_em;
      const type = activity.tipo === 'missao' ? 'Missão' : activity.tipo === 'desafio' ? 'Desafio' : 'Atividade';
      meta.textContent = `${type}${activity.trilha ? ` · ${activity.trilha}` : ''} · ${formatRelative(activity.concluida_em)}`;
      row.append(name, points, meta);
      list.append(row);
    });
    box.append(title, list);
    container.append(box);
  }
}

let profileTabs = null;
function setupProfileTabs() {
  const list = $('#profile-tabs');
  if (!list || profileTabs) return;
  profileTabs = initTabs(list, name => {
    try { history.replaceState(null, '', `#${name}`); } catch { /* ignora */ }
  });
  const fromHash = location.hash.slice(1);
  if (fromHash && profileTabs.tabs.some(tab => tab.dataset.tab === fromHash)) profileTabs.select(fromHash);
}

function syncProfileTabs() {
  const list = $('#profile-tabs');
  if (!list || !profileTabs) return;
  profileTabs.tabs.forEach(tab => {
    const panel = document.getElementById(tab.dataset.tab);
    tab.hidden = !panel || panel.hidden;
  });
  const selected = profileTabs.tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
  if (!selected || selected.hidden) {
    const first = profileTabs.tabs.find(tab => !tab.hidden);
    if (first) profileTabs.select(first.dataset.tab);
  }
  list.hidden = profileTabs.tabs.every(tab => tab.hidden);
}

function renderProfileData(profile, ownProfile) {
  const card = $('#perfil') || $('#public-profile');
  if (!card) return;
  card.setAttribute('aria-busy', 'false');
  $('[data-profile-name]', card).textContent = profile.nome_exibicao || profile.nome_usuario || 'Jogador';
  $('[data-profile-handle]', card).textContent = `@${profile.nome_usuario || ''}`;
  const bio = $('[data-profile-bio]', card);
  bio.textContent = profile.biografia || '';
  bio.hidden = !profile.biografia;
  const joined = $('[data-profile-joined]', card);
  const createdAt = new Date(profile.criado_em);
  joined.textContent = profile.criado_em && !Number.isNaN(createdAt.getTime())
    ? `Membro desde ${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(createdAt)}`
    : '';

  const cover = $('[data-cover-image]', card);
  const avatar = $('[data-avatar-image]', card);
  setProfileImage(cover, profile.capa_url);
  setProfileImage(avatar, profile.avatar_url);
  const initial = $('[data-avatar-initial]', card);
  if (initial) {
    initial.textContent = (profile.nome_exibicao || profile.nome_usuario || '?').charAt(0).toUpperCase();
    initial.hidden = Boolean(safeHttpsUrl(profile.avatar_url));
  }
  if (avatar && initial) {
    avatar.onerror = () => {
      avatar.hidden = true;
      initial.hidden = false;
    };
  }
  const stats = $('[data-profile-stats]', card);
  stats.replaceChildren();
  const values = profile.estatisticas;
  if (values) {
    if (values.amigos !== null) setProfileStat(stats, 'amigos', Number(values.amigos).toLocaleString('pt-BR'));
    if (values.conquistas !== null) setProfileStat(stats, 'conquistas', Number(values.conquistas).toLocaleString('pt-BR'));
    if (values.pontos !== null) setProfileStat(stats, 'pontos', Number(values.pontos).toLocaleString('pt-BR'));
  }
  stats.hidden = !stats.childElementCount;

  const journey = $('[data-profile-journey]', card);
  const progressData = profile.privado ? null : values?.progresso;
  if (journey) {
    journey.replaceChildren();
    journey.hidden = !progressData;
    if (progressData) {
      const line = document.createElement('div');
      line.className = 'pf-journey-line';
      const label = document.createElement('strong');
      label.textContent = 'Jornada';
      const detail = document.createElement('span');
      detail.textContent = `${progressData.concluidas} de ${progressData.total} atividades · ${progressData.percentual}%`;
      line.append(label, detail);
      journey.append(line, buildProgressTrack(progressData.percentual));
    }
  }

  const privateNotice = $('[data-profile-private]');
  if (privateNotice) privateNotice.hidden = !profile.privado;
  const achievements = profile.privado ? null : profile.conquistas;
  renderProfileAchievements({ ...profile, conquistas: achievements });
  const progressSection = $('#jornada');
  const progress = $('[data-profile-progress]');
  if (progressSection && progress) {
    progressSection.hidden = !progressData;
    progress.replaceChildren();
    if (progressData) renderProfileActivity(progress, progressData);
  }

  const projects = $('#projetos');
  if (projects) {
    projects.hidden = Boolean(profile.privado);
    if (!profile.privado) carregarProjetosPerfil(profile);
  }
  const projectsLink = $('[data-profile-projects-link]');
  if (projectsLink) {
    projectsLink.href = `${NP.root()}paginas/explorar-projetos.html?usuario=${encodeURIComponent(profile.id)}`;
  }
  const gameStatsLink = $('[data-profile-game-link]');
  if (gameStatsLink) {
    const hasVisibleGameData = ownProfile
      || (!profile.privado && (
        profile.estatisticas?.pontos !== null && profile.estatisticas?.pontos !== undefined
        || profile.estatisticas?.progresso !== null && profile.estatisticas?.progresso !== undefined
        || Array.isArray(profile.conquistas)
      ));
    gameStatsLink.hidden = !hasVisibleGameData;
    gameStatsLink.href = ownProfile
      ? `${NP.root()}paginas/estatisticas.html`
      : `${NP.root()}paginas/estatisticas.html?id=${encodeURIComponent(profile.id)}`;
  }
  const publications = $('#publicacoes');
  if (publications) publications.hidden = Boolean(profile.privado);

  const editToggle = $('#profile-edit-toggle');
  const publicLink = $('[data-profile-public-link]');
  if (editToggle) editToggle.hidden = !ownProfile;
  if (publicLink) {
    publicLink.href = `${NP.root()}paginas/perfil-publico.html?id=${encodeURIComponent(profile.id)}`;
    publicLink.hidden = !ownProfile;
  }
  syncProfileTabs();
}

function openRelationshipActions(profile) {
  const host = $('[data-relationship-actions]');
  if (!host) return;
  host.replaceChildren();
  const state = profile.amizade?.status;
  if (!state || state === 'proprio') return;
  host.hidden = false;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = state === 'amigos' ? 'btn btn-line' : 'btn';
  const action = {
    nenhuma: { label: 'Adicionar amigo', method: 'POST' },
    enviada: { label: 'Cancelar solicitação', method: 'DELETE' },
    recebida: { label: 'Aceitar solicitação', method: 'PUT' },
    amigos: { label: 'Remover amizade', method: 'DELETE' },
  }[state];
  if (!action) return;
  button.textContent = action.label;
  const status = $('#public-profile-status');
  button.addEventListener('click', async () => {
    if (state === 'amigos' && !window.confirm('Deseja remover esta amizade?')) return;
    button.disabled = true;
    const response = await NP.api(`/usuarios/${encodeURIComponent(profile.id)}/amizade`, { method: action.method });
    if (!response.ok) {
      button.disabled = false;
      NP.status(status, response.data.mensagem || 'Não foi possível atualizar a amizade.', false);
      return;
    }
    await initPublicProfile(true);
    NP.status(status, {
      nenhuma: 'Solicitação enviada.',
      enviada: 'Solicitação cancelada.',
      recebida: 'Solicitação aceita. Vocês agora são amigos.',
      amigos: 'Amizade removida.',
    }[state], true);
  });
  host.append(button);
}

function preencherEditor(profile) {
  const form = $('#profile-edit-form');
  if (!form) return;
  form.elements.namedItem('nome_exibicao').value = profile.nome_exibicao || '';
  form.elements.namedItem('nome_usuario').value = profile.nome_usuario || '';
  form.elements.namedItem('biografia').value = profile.biografia || '';
  form.elements.namedItem('avatar_url').value = profile.avatar_url || '';
  form.elements.namedItem('capa_url').value = profile.capa_url || '';
  Object.entries(profile.privacidade || {}).forEach(([name, value]) => {
    const checkbox = form.elements.namedItem(name);
    if (checkbox) checkbox.checked = Boolean(value);
  });
}

function initProfileEditor(profile) {
  const form = $('#profile-edit-form');
  const editor = $('#profile-editor');
  const toggle = $('#profile-edit-toggle');
  const close = $('#profile-edit-close');
  if (!form || !editor || !toggle) return;
  preencherEditor(profile);
  const setOpen = open => {
    editor.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  toggle.addEventListener('click', () => setOpen(editor.hidden));
  close?.addEventListener('click', () => setOpen(false));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const status = $('#profile-edit-status');
    const submit = $('button[type="submit"]', form);
    const privacidade = Object.fromEntries(
      ['perfil_publico', 'mostrar_biografia', 'mostrar_pontos', 'mostrar_amigos', 'mostrar_conquistas', 'mostrar_progresso']
        .map(name => [name, form.elements.namedItem(name).checked]),
    );
    const body = {
      nome_exibicao: form.elements.namedItem('nome_exibicao').value,
      nome_usuario: form.elements.namedItem('nome_usuario').value,
      biografia: form.elements.namedItem('biografia').value,
      avatar_url: form.elements.namedItem('avatar_url').value || null,
      capa_url: form.elements.namedItem('capa_url').value || null,
      privacidade,
    };
    submit.disabled = true;
    const response = await NP.api('/me/perfil', { method: 'PUT', body });
    submit.disabled = false;
    if (!response.ok || !response.data.usuario) {
      NP.status(status, response.data.mensagem || 'Não foi possível salvar o perfil.', false);
      return;
    }
    profile = response.data.usuario;
    renderProfileData(profile, true);
    preencherEditor(profile);
    const currentUser = NP.currentUser();
    if (currentUser) currentUser.nome_usuario = profile.nome_usuario;
    const userButton = $('#user-btn');
    if (userButton) userButton.replaceChildren(avatarEl(profile, 34));
    NP.status(status, 'Perfil atualizado.', true);
  });
}

async function carregarPerfil(url, ownProfile, skipFeed = false) {
  const card = $('#perfil') || $('#public-profile');
  const status = $('#profile-status') || $('#public-profile-status');
  const response = await NP.api(url);
  if (!response.ok || !response.data.usuario) {
    card?.setAttribute('aria-busy', 'false');
    NP.status(status, response.data.mensagem || 'Não foi possível carregar este perfil.', false);
    $('#publicacoes')?.setAttribute('hidden', '');
    $('#conquistas')?.setAttribute('hidden', '');
    $('#jornada')?.setAttribute('hidden', '');
    syncProfileTabs();
    return null;
  }
  const profile = response.data.usuario;
  renderProfileData(profile, ownProfile);
  if (ownProfile) initProfileEditor(profile);
  else openRelationshipActions(profile);
  if (!profile.privado && !skipFeed) {
    document.body.dataset.feedUserId = profile.id;
    initFeed();
  }
  return profile;
}

async function initPublicProfile(skipFeed = false) {
  if (!NP.currentUser()) return void (location.href = 'login.html');
  setupProfileTabs();
  const id = new URLSearchParams(location.search).get('id');
  if (!id || !/^\d{1,18}$/.test(id) || BigInt(id) < 1n) {
    NP.status($('#public-profile-status'), 'O perfil solicitado não é válido.', false);
    $('#public-profile')?.setAttribute('aria-busy', 'false');
    $('#publicacoes')?.setAttribute('hidden', '');
    return;
  }
  await carregarPerfil(`/usuarios/${encodeURIComponent(id)}/perfil`, false, skipFeed);
}

async function initProfile() {
  if (!$('#perfil')) return;
  if (!NP.currentUser()) return void (location.href = 'login.html');
  setupProfileTabs();
  await carregarPerfil('/me/perfil', true);
}

function formatGameMonth(value) {
  const date = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
}

function renderGameAchievements(profile, ownProfile) {
  const section = $('[data-game-achievements-section]');
  const list = $('[data-game-achievements]');
  if (!Array.isArray(profile.conquistas)) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  list.replaceChildren();
  $('[data-game-achievement-count]').textContent = String(
    profile.estatisticas?.conquistas ?? profile.conquistas.length,
  );
  if (!profile.conquistas.length) {
    const empty = document.createElement('p');
    empty.className = 'profile-empty';
    empty.textContent = 'Nenhuma conquista desbloqueada foi registrada ainda.';
    list.append(empty);
    return;
  }
  profile.conquistas.forEach(achievement => {
    const item = document.createElement('article');
    item.className = 'profile-achievement';
    const icon = document.createElement('span');
    icon.className = 'profile-achievement-icon';
    const iconUrl = safeHttpsUrl(achievement.icone);
    if (iconUrl) {
      const image = document.createElement('img');
      setProfileImage(image, iconUrl);
      image.alt = '';
      image.loading = 'lazy';
      icon.append(image);
    } else {
      icon.innerHTML = nqSvg(NQ_ICON.trophy);
      icon.firstElementChild.setAttribute('width', '22');
      icon.firstElementChild.setAttribute('height', '22');
    }
    const details = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = achievement.titulo || 'Conquista';
    const description = document.createElement('p');
    description.textContent = achievement.descricao || 'Conquista registrada no Nexa Quest.';
    details.append(title, description);
    item.append(icon, details);
    if (achievement.obtida_em) {
      const date = document.createElement('time');
      date.className = 'game-achievement-date';
      date.dateTime = achievement.obtida_em;
      date.textContent = formatSocialDate(achievement.obtida_em);
      details.append(date);
    }
    if (ownProfile && achievement.id) {
      item.classList.add('has-share-action');
      const share = friendActionButton('Compartilhar no feed', 'btn btn-soft game-achievement-share', () => {
        compartilharConquista(achievement, share);
      });
      item.append(share);
    }
    list.append(item);
  });
}

async function compartilharConquista(achievement, button) {
  button.disabled = true;
  const response = await NP.api('/publicacoes', {
    method: 'POST',
    body: {
      texto: `Desbloqueei a conquista "${achievement.titulo}" no Nexa Quest!`,
      conquista_id: String(achievement.id),
    },
  });
  if (!response.ok || !response.data.publicacao) {
    button.disabled = false;
    NP.status(
      $('#game-achievement-share-status'),
      response.data.mensagem || 'Não foi possível compartilhar esta conquista.',
      false,
    );
    return;
  }
  button.textContent = 'Compartilhada';
  NP.status($('#game-achievement-share-status'), 'Conquista compartilhada no feed.', true);
}

function renderGameEvolution(progresso) {
  const chart = $('[data-game-evolution]');
  const note = $('[data-game-chart-note]');
  chart.replaceChildren();
  const months = Array.isArray(progresso.evolucao) ? progresso.evolucao : [];
  if (!months.length) {
    note.textContent = 'Ainda não há conclusões datadas para mostrar uma evolução.';
    return;
  }
  if (months.length < 2) {
    note.textContent = 'Há registros em apenas um mês; ainda não existem dados suficientes para comparar a evolução.';
    return;
  }
  const max = Math.max(...months.map(item => Number(item.atividades_concluidas) || 0), 1);
  months.forEach(item => {
    const count = Number(item.atividades_concluidas) || 0;
    const column = document.createElement('div');
    column.className = 'game-chart-column';
    column.setAttribute(
      'aria-label',
      `${formatGameMonth(item.mes)}: ${count} atividades concluídas e ${Number(item.pontos_registrados) || 0} pontos registrados`,
    );
    const value = document.createElement('strong');
    value.textContent = String(count);
    const track = document.createElement('div');
    track.className = 'game-chart-track';
    const bar = document.createElement('span');
    bar.style.height = `${Math.max(8, Math.round((count / max) * 100))}%`;
    track.append(bar);
    const label = document.createElement('span');
    label.className = 'game-chart-month';
    label.textContent = formatGameMonth(item.mes);
    column.append(value, track, label);
    chart.append(column);
  });
  note.textContent = 'Cada barra representa atividades concluídas; os valores usam os registros disponíveis no banco.';
}

function renderGameHistory(progresso) {
  const list = $('[data-game-history]');
  const history = Array.isArray(progresso.historico) ? progresso.historico : [];
  list.replaceChildren();
  if (!history.length) {
    const empty = document.createElement('p');
    empty.className = 'profile-empty';
    empty.textContent = 'Nenhuma atividade concluída com data registrada.';
    list.append(empty);
    return;
  }
  history.forEach(activity => {
    const row = document.createElement('article');
    row.className = 'game-history-item';
    const title = document.createElement('strong');
    title.textContent = activity.titulo || 'Atividade concluída';
    const meta = document.createElement('span');
    const type = activity.tipo === 'missao' ? 'Missão' : activity.tipo === 'desafio' ? 'Desafio' : 'Atividade';
    meta.textContent = activity.trilha ? `${type} · ${activity.trilha}` : type;
    const date = document.createElement('time');
    date.dateTime = activity.concluida_em;
    date.textContent = formatSocialDate(activity.concluida_em);
    const points = document.createElement('span');
    points.className = 'game-history-points';
    points.textContent = `${Number(activity.pontuacao) || 0} pontos`;
    row.append(title, meta, date, points);
    list.append(row);
  });
}

function renderGamePerformance(progresso) {
  const list = $('[data-game-performance]');
  list.replaceChildren();
  const records = Array.isArray(progresso.desempenho) ? progresso.desempenho : [];
  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'profile-empty';
    empty.textContent = 'Ainda não há resultados de atividades registrados.';
    list.append(empty);
    return;
  }
  const labels = { missao: 'Missões', desafio: 'Desafios', conteudo: 'Conteúdos' };
  records.forEach(record => {
    const card = document.createElement('article');
    card.className = 'game-performance-card';
    const title = document.createElement('h3');
    title.textContent = labels[record.tipo] || 'Atividades';
    const completed = document.createElement('strong');
    completed.textContent = `${Number(record.concluidas) || 0}`;
    const completedLabel = document.createElement('span');
    completedLabel.textContent = 'concluídas';
    const inProgress = document.createElement('span');
    inProgress.textContent = `${Number(record.em_andamento) || 0} em andamento`;
    const points = document.createElement('span');
    points.textContent = `${Number(record.pontos_registrados) || 0} pontos registrados`;
    card.append(title, completed, completedLabel, inProgress, points);
    list.append(card);
  });
}

function renderGameStats(profile, ownProfile) {
  const status = $('#game-stats-status');
  if (profile.privado) {
    status.textContent = 'Este perfil é privado. As estatísticas do jogo não estão disponíveis.';
    $('[data-game-indicators]').replaceChildren();
    $('[data-game-evolution-section]').hidden = true;
    $('[data-game-history-section]').hidden = true;
    $('[data-game-performance-section]').hidden = true;
    $('[data-game-achievements-section]').hidden = true;
    $('#game-level-title').closest('.game-stats-panel').hidden = true;
    return;
  }
  status.textContent = '';
  $('[data-game-stats-title]').textContent = ownProfile ? 'Minha jornada no jogo' : `Jornada de ${profile.nome_exibicao || profile.nome_usuario}`;
  $('[data-game-player]').textContent = `${profile.nome_exibicao || profile.nome_usuario} · @${profile.nome_usuario}`;
  const indicators = $('[data-game-indicators]');
  indicators.replaceChildren();
  const statistics = profile.estatisticas || {};
  const progress = statistics.progresso;
  if (statistics.pontos !== null && statistics.pontos !== undefined) {
    setProfileStat(indicators, 'Pontos registrados', Number(statistics.pontos).toLocaleString('pt-BR'), 'Pontuação total armazenada; não representa XP.');
  }
  if (progress) {
    setProfileStat(indicators, 'Atividades concluídas', Number(progress.concluidas).toLocaleString('pt-BR'));
    setProfileStat(indicators, 'Em andamento', Number(progress.em_andamento).toLocaleString('pt-BR'));
    const completion = document.createElement('div');
    completion.className = 'game-completion-stat';
    const label = document.createElement('span');
    label.textContent = `Conclusão das atividades cadastradas · ${progress.percentual}%`;
    const track = document.createElement('div');
    track.className = 'profile-progress-track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', String(progress.percentual));
    const bar = document.createElement('span');
    bar.style.width = `${Math.max(0, Math.min(100, Number(progress.percentual) || 0))}%`;
    track.append(bar);
    completion.append(label, track);
    indicators.append(completion);
  }
  if (statistics.conquistas !== null && statistics.conquistas !== undefined) {
    setProfileStat(indicators, 'Conquistas desbloqueadas', Number(statistics.conquistas).toLocaleString('pt-BR'));
  }
  const evolutionSection = $('[data-game-evolution-section]');
  const historySection = $('[data-game-history-section]');
  const performanceSection = $('[data-game-performance-section]');
  evolutionSection.hidden = !progress;
  historySection.hidden = !progress;
  performanceSection.hidden = !progress;
  if (progress) {
    renderGameEvolution(progress);
    renderGameHistory(progress);
    renderGamePerformance(progress);
  }
  renderGameAchievements(profile, ownProfile);
  if (!ownProfile && progress === null) {
    status.textContent = 'O jogador optou por ocultar o progresso e o histórico de atividades.';
  }
  if (!ownProfile && profile.conquistas === null) {
    const notice = document.createElement('span');
    notice.className = 'game-privacy-note';
    notice.textContent = 'Conquistas ocultas nas configurações de privacidade.';
    $('[data-game-achievements]').replaceChildren(notice);
    $('[data-game-achievements-section]').hidden = false;
  }
}

async function initGameStats() {
  if (!NP.currentUser()) return void (location.href = 'login.html');
  const page = $('.game-stats-page');
  const status = $('#game-stats-status');
  page?.setAttribute('aria-busy', 'true');
  NP.status(status, 'Carregando estatísticas…', true);
  const id = new URLSearchParams(location.search).get('id');
  if (id && (!/^\d{1,18}$/.test(id) || BigInt(id) < 1n)) {
    page?.setAttribute('aria-busy', 'false');
    return NP.status(status, 'O identificador do perfil não é válido.', false);
  }
  const ownProfile = !id || String(NP.currentUser().id) === String(id);
  const endpoint = ownProfile ? '/me/perfil' : `/usuarios/${encodeURIComponent(id)}/perfil`;
  const response = await NP.api(endpoint);
  if (!response.ok || !response.data.usuario) {
    page?.setAttribute('aria-busy', 'false');
    return NP.status(status, response.data.mensagem || 'Não foi possível carregar as estatísticas.', false);
  }
  renderGameStats(response.data.usuario, ownProfile);
  page?.setAttribute('aria-busy', 'false');
  NP.status(status, '', true);
}

const PROJECT_CATEGORIES = ['Jogos', 'Arte e design', 'Programação', 'Educação', 'Música', 'Outros'];

function projectLink(project) {
  return `${NP.root()}paginas/projeto.html?id=${encodeURIComponent(project.id)}`;
}

function carregarProjetosPerfil(profile) {
  const list = $('[data-profile-projects]');
  const status = $('[data-profile-projects-status]');
  if (!list || list.dataset.profileId === String(profile.id)) return;
  list.dataset.profileId = String(profile.id);
  list.setAttribute('aria-busy', 'true');
  status.textContent = 'Carregando projetos públicos…';
  NP.api(`/projetos?limite=6&usuario=${encodeURIComponent(profile.id)}`).then(response => {
    if (list.dataset.profileId !== String(profile.id)) return;
    list.setAttribute('aria-busy', 'false');
    if (!response.ok || !Array.isArray(response.data.projetos)) {
      status.textContent = response.data.mensagem || 'Não foi possível carregar os projetos.';
      return;
    }
    list.replaceChildren();
    response.data.projetos.forEach(project => list.append(projectCard(project)));
    status.textContent = '';
    if (!response.data.projetos.length) {
      list.append(projectEmpty('Ainda não há projetos públicos.', 'Os projetos publicados por este jogador aparecerão aqui.'));
    }
  });
}

function projectCard(project, myProject = false) {
  const card = document.createElement('article');
  card.className = 'project-card';
  const cover = document.createElement('a');
  cover.className = 'project-card-cover';
  cover.href = projectLink(project);
  const imageUrl = safeHttpsUrl(project.imagem_url);
  if (imageUrl) {
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => {
      const placeholder = document.createElement('span');
      placeholder.className = 'project-placeholder';
      placeholder.textContent = project.categoria || 'PROJETO NEXA QUEST';
      cover.replaceChildren(placeholder);
    };
    cover.append(image);
  } else {
    const placeholder = document.createElement('span');
    placeholder.className = 'project-placeholder';
    placeholder.textContent = project.categoria || 'PROJETO NEXA QUEST';
    cover.append(placeholder);
  }
  const body = document.createElement('div');
  body.className = 'project-card-body';
  const tags = document.createElement('div');
  tags.className = 'project-card-tags';
  [project.categoria, project.visibilidade === 'privado' ? 'Privado' : 'Público', project.tipo === 'equipe' ? 'Equipe' : 'Individual']
    .filter(Boolean)
    .forEach(label => {
      const badge = document.createElement('span');
      badge.textContent = label;
      tags.append(badge);
    });
  const title = document.createElement('h2');
  const titleLink = document.createElement('a');
  titleLink.href = projectLink(project);
  titleLink.textContent = project.titulo;
  title.append(titleLink);
  const description = document.createElement('p');
  description.className = 'project-card-description';
  description.textContent = project.descricao || '';
  const owner = document.createElement('div');
  owner.className = 'project-card-owner';
  const ownerLink = makeProfileAnchor(project.proprietario || {}, 'project-owner-link');
  if (project.proprietario?.avatar_url && safeHttpsUrl(project.proprietario.avatar_url)) {
    const avatar = document.createElement('img');
    avatar.src = safeHttpsUrl(project.proprietario.avatar_url);
    avatar.alt = '';
    avatar.loading = 'lazy';
    avatar.onerror = () => avatar.remove();
    ownerLink.prepend(avatar);
  }
  owner.append(ownerLink);
  const meta = document.createElement('span');
  const members = Number(project.total_participantes) || 0;
  meta.textContent = `${members} ${members === 1 ? 'integrante' : 'integrantes'}`;
  owner.append(meta);
  body.append(tags, title, description, owner);
  card.append(cover, body);

  if (myProject) {
    const participation = project.participacao;
    const ownProject = String(project.proprietario_id) === String(NP.currentUser()?.id);
    const status = participation?.status;
    if (ownProject) {
      const ownerBadge = document.createElement('span');
      ownerBadge.className = 'project-role-badge';
      ownerBadge.textContent = 'Proprietário';
      tags.append(ownerBadge);
    } else if (status === 'pendente' && participation.origem === 'convite') {
      const actions = document.createElement('div');
      actions.className = 'project-card-pending';
      const answer = document.createElement('button');
      answer.className = 'btn btn-soft';
      answer.type = 'button';
      answer.textContent = 'Aceitar convite';
      answer.addEventListener('click', () => responderConvite(project, 'aceitar'));
      const decline = document.createElement('button');
      decline.className = 'profile-text-button';
      decline.type = 'button';
      decline.textContent = 'Recusar';
      decline.addEventListener('click', () => responderConvite(project, 'recusar'));
      actions.append(answer, decline);
      body.append(actions);
    } else if (status === 'pendente' && participation.origem === 'solicitacao') {
      const actions = document.createElement('div');
      actions.className = 'project-card-pending';
      const pending = document.createElement('span');
      pending.textContent = 'Solicitação pendente';
      const cancel = document.createElement('button');
      cancel.className = 'profile-text-button';
      cancel.type = 'button';
      cancel.textContent = 'Cancelar';
      cancel.addEventListener('click', () => removerParticipacao(project, NP.currentUser().id));
      actions.append(pending, cancel);
      body.append(actions);
    } else if (status === 'aceito') {
      const leave = document.createElement('button');
      leave.className = 'profile-text-button project-leave-button';
      leave.type = 'button';
      leave.textContent = 'Sair da equipe';
      leave.addEventListener('click', () => removerParticipacao(project, NP.currentUser().id));
      body.append(leave);
    }
  }
  return card;
}

async function responderConvite(project, acao) {
  const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}/participantes/${encodeURIComponent(NP.currentUser().id)}`, {
    method: 'PUT',
    body: { acao },
  });
  if (!response.ok) return NP.status($('#projects-status'), response.data.mensagem || 'Não foi possível responder ao convite.', false);
  await carregarMeusProjetos(true);
  if (acao === 'aceitar') location.href = projectLink(project);
  else NP.status($('#projects-status'), 'Convite recusado.', true);
}

async function removerParticipacao(project, userId) {
  if (!window.confirm('Deseja sair deste projeto ou remover esta participação?')) return;
  const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}/participantes/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) return NP.status($('#projects-status') || $('#project-detail-status'), response.data.mensagem || 'Não foi possível remover a participação.', false);
  if ($('#project-detail')) {
    await carregarDetalheProjeto();
    NP.status($('#project-detail-status'), 'Participação atualizada.', true);
    return;
  }
  await carregarMeusProjetos(true);
  NP.status($('#projects-status'), 'Participação atualizada.', true);
}

function projectEmpty(title, description, linkText, href) {
  const empty = document.createElement('div');
  empty.className = 'project-empty';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const message = document.createElement('p');
  message.textContent = description;
  empty.append(heading, message);
  if (linkText && href) {
    const link = document.createElement('a');
    link.className = 'btn btn-soft';
    link.href = href;
    link.textContent = linkText;
    empty.append(link);
  }
  return empty;
}

function friendCard(user) {
  const card = document.createElement('article');
  card.className = 'friend-card';
  const identity = document.createElement('div');
  identity.className = 'friend-identity';
  const avatarLink = document.createElement('a');
  avatarLink.className = 'friend-avatar';
  avatarLink.href = profileHref(user);
  avatarLink.setAttribute('aria-label', `Abrir perfil de ${user.nome_exibicao || user.nome_usuario}`);
  const avatarUrl = safeHttpsUrl(user.avatar_url);
  if (avatarUrl) {
    const image = document.createElement('img');
    image.src = avatarUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => {
      image.remove();
      avatarLink.textContent = (user.nome_exibicao || user.nome_usuario || '?').charAt(0).toUpperCase();
    };
    avatarLink.append(image);
  } else {
    avatarLink.textContent = (user.nome_exibicao || user.nome_usuario || '?').charAt(0).toUpperCase();
  }
  const name = document.createElement('a');
  name.className = 'friend-name';
  name.href = profileHref(user);
  name.textContent = user.nome_exibicao || user.nome_usuario || 'Jogador';
  const handle = document.createElement('span');
  handle.className = 'friend-handle';
  handle.textContent = `@${user.nome_usuario || 'jogador'}`;
  const text = document.createElement('div');
  text.className = 'friend-card-identity-text';
  text.append(name, handle);
  identity.append(avatarLink, text);
  card.append(identity);

  const actions = document.createElement('div');
  actions.className = 'friend-card-actions';
  const relation = user.relacao || 'desconhecido';
  if (relation === 'desconhecido') {
    actions.append(friendActionButton('Adicionar', 'btn btn-soft', () => executarAcaoAmizade(user, 'enviar')));
  } else if (relation === 'enviada') {
    const state = document.createElement('span');
    state.className = 'friend-relation-state';
    state.textContent = 'Solicitação enviada';
    actions.append(state, friendActionButton('Cancelar', 'friend-action-link', () => executarAcaoAmizade(user, 'cancelar')));
  } else if (relation === 'recebida') {
    actions.append(
      friendActionButton('Aceitar', 'btn btn-soft', () => executarAcaoAmizade(user, 'aceitar')),
      friendActionButton('Recusar', 'friend-action-link', () => executarAcaoAmizade(user, 'recusar')),
    );
  } else if (relation === 'amigos') {
    const state = document.createElement('span');
    state.className = 'friend-relation-state is-friend';
    state.textContent = 'Amigo';
    actions.append(state, friendActionButton('Remover', 'friend-action-link', () => executarAcaoAmizade(user, 'remover')));
  }
  card.append(actions);
  return card;
}

function friendActionButton(label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

function renderFriendList(target, users, emptyMessage) {
  target.replaceChildren();
  if (!users.length) {
    const empty = document.createElement('p');
    empty.className = 'friends-empty';
    empty.textContent = emptyMessage;
    target.append(empty);
    return;
  }
  users.forEach(user => target.append(friendCard(user)));
}

let friendActionInProgress = false;
let friendsTabs = null;
let friendsTabsOpened = false;
let friendSearchHasResults = false;

async function executarAcaoAmizade(user, action) {
  if (friendActionInProgress) return;
  if (action === 'remover' && !window.confirm(`Deseja remover ${user.nome_exibicao || user.nome_usuario} dos seus amigos?`)) return;
  friendActionInProgress = true;
  const status = $('#friends-page-status');
  const method = action === 'enviar' ? 'POST' : action === 'aceitar' ? 'PUT' : 'DELETE';
  const response = await NP.api(`/usuarios/${encodeURIComponent(user.id)}/amizade`, { method });
  friendActionInProgress = false;
  if (!response.ok) {
    NP.status(status, response.data.mensagem || 'Não foi possível atualizar esta amizade.', false);
    return;
  }
  NP.status(status, {
    enviar: 'Solicitação enviada.',
    aceitar: 'Solicitação aceita. Vocês agora são amigos.',
    recusar: 'Solicitação recusada.',
    cancelar: 'Solicitação cancelada.',
    remover: 'Amizade removida.',
  }[action], true);
  await Promise.all([carregarPainelAmizades(), carregarSugestoesAmizade()]);
  if (friendSearchHasResults) await pesquisarAmigos($('#friends-search-input').value);
}

async function carregarPainelAmizades() {
  const targets = [
    ['#friends-list-content', '#friends-list-status'],
    ['#friend-requests-received-list', '#friend-requests-received-status'],
    ['#friend-requests-sent-list', '#friend-requests-sent-status'],
  ];
  targets.forEach(([listSelector, statusSelector]) => {
    $(listSelector).setAttribute('aria-busy', 'true');
    $(statusSelector).textContent = 'Carregando…';
  });
  const response = await NP.api('/me/amizades');
  targets.forEach(([listSelector]) => $(listSelector).setAttribute('aria-busy', 'false'));
  if (!response.ok) {
    targets.forEach(([, statusSelector]) => {
      $(statusSelector).textContent = response.data.mensagem || 'Não foi possível carregar esta seção.';
    });
    $('#friends-count').textContent = '—';
    return;
  }
  const friends = Array.isArray(response.data.amigos) ? response.data.amigos : [];
  const received = Array.isArray(response.data.recebidas) ? response.data.recebidas : [];
  const sent = Array.isArray(response.data.enviadas) ? response.data.enviadas : [];
  renderFriendList($('#friends-list-content'), friends, 'Você ainda não tem amigos. Veja as sugestões ou busque alguém pelo nome.');
  renderFriendList($('#friend-requests-received-list'), received, 'Você não tem solicitações recebidas.');
  renderFriendList($('#friend-requests-sent-list'), sent, 'Você não tem solicitações enviadas.');
  $('#friends-list-status').textContent = '';
  $('#friend-requests-received-status').textContent = '';
  $('#friend-requests-sent-status').textContent = '';
  $('#friends-count').textContent = String(friends.length);
  $('#friend-requests-received-count').textContent = String(received.length);
  $('#friend-requests-sent-count').textContent = String(sent.length);
  $('#friend-requests-received-count').classList.toggle('is-alert', received.length > 0);
  if (!friendsTabsOpened) {
    friendsTabsOpened = true;
    if (received.length > 0 && !new URLSearchParams(location.search).get('q')) friendsTabs?.select('friend-requests-received');
  }
}

async function carregarSugestoesAmizade() {
  const list = $('#friend-suggestions');
  const status = $('#friend-suggestions-status');
  list.setAttribute('aria-busy', 'true');
  status.textContent = 'Carregando sugestões…';
  const response = await NP.api('/usuarios/sugestoes');
  list.setAttribute('aria-busy', 'false');
  if (!response.ok || !Array.isArray(response.data.usuarios)) {
    status.textContent = response.data.mensagem || 'Não foi possível carregar sugestões.';
    return;
  }
  renderFriendList(list, response.data.usuarios, 'Sem sugestões por enquanto. Use a busca para encontrar alguém.');
  status.textContent = '';
}

async function pesquisarAmigos(term) {
  const value = term.trim().replace(/^@/, '');
  const results = $('#friend-search-results');
  const status = $('#friends-search-status');
  friendSearchHasResults = value.length >= 2;
  results.hidden = !friendSearchHasResults;
  const searchBlock = $('#friends-search-block');
  if (searchBlock) searchBlock.hidden = !friendSearchHasResults;
  if (!friendSearchHasResults) {
    status.textContent = 'Digite pelo menos 2 caracteres para pesquisar.';
    return;
  }
  results.setAttribute('aria-busy', 'true');
  status.textContent = 'Pesquisando pessoas…';
  const response = await NP.api(`/usuarios/buscar?q=${encodeURIComponent(value)}`);
  results.setAttribute('aria-busy', 'false');
  if (!response.ok || !Array.isArray(response.data.usuarios)) {
    status.textContent = response.data.mensagem || 'Não foi possível pesquisar usuários.';
    return;
  }
  renderFriendList(results, response.data.usuarios, 'Nenhuma pessoa encontrada. Tente outro nome ou nome de usuário.');
  status.textContent = '';
}

function initFriendsPage() {
  const form = $('#friends-search-form');
  if (!form) return;
  if (!NP.currentUser()) return void (location.href = 'login.html');
  friendsTabs = initTabs($('#friends-tabs'));
  form.addEventListener('submit', event => {
    event.preventDefault();
    pesquisarAmigos($('#friends-search-input').value);
  });
  const initialQuery = new URLSearchParams(location.search).get('q');
  if (initialQuery) {
    $('#friends-search-input').value = initialQuery;
    pesquisarAmigos(initialQuery);
  }
  carregarPainelAmizades();
  carregarSugestoesAmizade();
}

function initProjectExplorer() {
  const list = $('#project-list');
  if (!list) return;
  const form = $('#project-search-form');
  const more = $('#projects-load-more');
  const status = $('#projects-status');
  let cursor = null;
  let loading = false;
  const load = async (reset = false) => {
    if (loading) return;
    loading = true;
    list.setAttribute('aria-busy', 'true');
    more.disabled = true;
    status.textContent = reset ? 'Carregando projetos públicos…' : 'Carregando mais projetos…';
    if (reset) {
      cursor = null;
      list.replaceChildren();
    }
    const query = new URLSearchParams({ limite: '12' });
    const busca = $('#project-search')?.value.trim();
    const categoria = $('#project-category')?.value;
    const proprietarioId = new URLSearchParams(location.search).get('usuario');
    if (busca) query.set('q', busca);
    if (categoria) query.set('categoria', categoria);
    if (proprietarioId) query.set('usuario', proprietarioId);
    if (cursor) query.set('cursor', cursor);
    const response = await NP.api(`/projetos?${query}`);
    loading = false;
    list.setAttribute('aria-busy', 'false');
    more.disabled = false;
    if (!response.ok || !Array.isArray(response.data.projetos)) {
      status.textContent = response.data.mensagem || 'Não foi possível carregar os projetos.';
      return;
    }
    response.data.projetos.forEach(project => list.append(projectCard(project)));
    cursor = response.data.proximoCursor || null;
    more.hidden = !cursor;
    status.textContent = '';
    if (reset && response.data.projetos.length === 0) {
      list.append(projectEmpty('Ainda não há projetos públicos.', 'Quando a comunidade publicar projetos, eles aparecerão aqui.', 'Criar um projeto', `${NP.root()}paginas/criar-projeto.html`));
    }
  };
  form?.addEventListener('submit', event => { event.preventDefault(); load(true); });
  const chips = $$('#project-chips .chip');
  chips.forEach(chip => chip.addEventListener('click', () => {
    chips.forEach(other => other.setAttribute('aria-pressed', String(other === chip)));
    $('#project-category').value = chip.dataset.cat;
    load(true);
  }));
  more.addEventListener('click', () => load());
  load(true);
}

let meusProjetosCursor = null;
let meusProjetosLoading = false;

async function carregarMeusProjetos(reset = true) {
  const list = $('#project-list');
  if (!list) return;
  const more = $('#projects-load-more');
  const status = $('#projects-status');
  if (meusProjetosLoading) return;
  meusProjetosLoading = true;
  if (reset) {
    meusProjetosCursor = null;
    list.replaceChildren();
  }
  list.setAttribute('aria-busy', 'true');
  if (more) more.disabled = true;
  status.textContent = reset ? 'Carregando seus projetos…' : 'Carregando mais projetos…';
  const query = new URLSearchParams({ limite: '20' });
  if (meusProjetosCursor) query.set('cursor', meusProjetosCursor);
  const response = await NP.api(`/me/projetos?${query}`);
  meusProjetosLoading = false;
  list.setAttribute('aria-busy', 'false');
  if (more) more.disabled = false;
  if (!response.ok || !Array.isArray(response.data.projetos)) {
    status.textContent = response.data.mensagem || 'Não foi possível carregar seus projetos.';
    return;
  }
  response.data.projetos.forEach(project => list.append(projectCard(project, true)));
  meusProjetosCursor = response.data.proximoCursor || null;
  if (more) more.hidden = !meusProjetosCursor;
  status.textContent = '';
  if (reset && response.data.projetos.length === 0) {
    list.append(projectEmpty('Sua próxima ideia começa aqui.', 'Crie um projeto ou descubra uma equipe que combine com você.', 'Explorar projetos', `${NP.root()}paginas/explorar-projetos.html`));
  }
}

function initMyProjects() {
  if (!$('#project-list')) return;
  $('#projects-load-more')?.addEventListener('click', () => carregarMeusProjetos(false));
  carregarMeusProjetos();
}

function initCreateProject() {
  const form = $('#project-form');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = new FormData(form);
    const body = Object.fromEntries(fields.entries());
    const status = $('#project-form-status');
    const button = $('button[type="submit"]', form);
    button.disabled = true;
    NP.status(status, 'Publicando projeto…', true);
    const response = await NP.api('/projetos', { method: 'POST', body });
    button.disabled = false;
    if (!response.ok || !response.data.projeto) {
      NP.status(status, response.data.mensagem || 'Não foi possível publicar o projeto.', false);
      return;
    }
    location.href = projectLink(response.data.projeto);
  });
}

function renderProjectUpdates(updates) {
  const list = $('[data-project-updates]');
  if (!list) return;
  list.replaceChildren();
  if (!updates?.length) {
    list.append(projectEmpty('Ainda não há atualizações.', 'Os avanços da equipe aparecerão aqui.'));
    return;
  }
  updates.forEach(update => {
    const article = document.createElement('article');
    article.className = 'project-update';
    const header = document.createElement('header');
    const author = document.createElement('a');
    author.href = profileHref(update.autor);
    author.textContent = update.autor?.nome_exibicao || `@${update.autor?.nome_usuario || 'jogador'}`;
    const date = document.createElement('time');
    date.dateTime = update.criado_em || '';
    date.textContent = formatSocialDate(update.criado_em);
    header.append(author, date);
    const body = document.createElement('p');
    body.textContent = update.texto || '';
    article.append(header, body);
    list.append(article);
  });
}

function projectFormFields(form, project, editing) {
  const categories = PROJECT_CATEGORIES.map(category => `<option value="${category}">${category}</option>`).join('');
  form.innerHTML = `
    <label>Título<input name="titulo" type="text" maxlength="120" required></label>
    <label>Descrição<textarea name="descricao" rows="5" maxlength="5000" required></textarea><small>Até 5.000 caracteres.</small></label>
    <div class="project-form-row">
      <label>Categoria<select name="categoria" required><option value="">Selecione</option>${categories}</select></label>
      <label>Formato<select name="tipo" required><option value="individual">Individual</option><option value="equipe">Projeto em equipe</option></select></label>
    </div>
    <div class="project-form-row">
      <label>Visibilidade<select name="visibilidade" required><option value="publico">Público</option><option value="privado">Privado</option></select></label>
      <label>Imagem · URL HTTPS<input name="imagem_url" type="url" inputmode="url" placeholder="https://…"></label>
    </div>
    <label>Link externo · URL HTTPS<input name="link_externo" type="url" inputmode="url" placeholder="https://…"></label>
    <p class="feed-status" data-project-edit-status role="status" aria-live="polite"></p>
    <div class="project-form-actions"><button class="btn" type="submit">${editing ? 'Salvar alterações' : 'Publicar projeto'}</button></div>`;
  if (project) {
    for (const [name, value] of Object.entries(project)) {
      const field = form.elements.namedItem(name);
      if (field) field.value = value || '';
    }
  }
}

function renderProjectDetails(project) {
  const root = $('#project-detail');
  root.setAttribute('aria-busy', 'false');
  $('[data-project-title]').textContent = project.titulo;
  $('[data-project-description]').textContent = project.descricao;
  $('[data-project-category]').textContent = project.categoria;
  $('[data-project-visibility]').textContent = project.visibilidade === 'publico' ? 'Público' : 'Privado';
  $('[data-project-type]').textContent = project.tipo === 'equipe' ? 'Projeto em equipe' : 'Projeto individual';
  const owner = $('[data-project-owner]');
  owner.href = profileHref(project.proprietario);
  owner.textContent = project.proprietario?.nome_exibicao || `@${project.proprietario?.nome_usuario || 'jogador'}`;
  const image = $('[data-project-image]');
  setProfileImage(image, project.imagem_url);
  $('[data-project-external]').hidden = !safeHttpsUrl(project.link_externo);
  if (safeHttpsUrl(project.link_externo)) $('[data-project-external]').href = safeHttpsUrl(project.link_externo);

  const join = $('[data-project-join]');
  const cancel = $('[data-project-cancel]');
  const state = project.participacao?.status;
  const canRequest = !project.sou_proprietario && project.tipo === 'equipe' && project.visibilidade === 'publico' && !state;
  join.hidden = !canRequest;
  cancel.hidden = !(!project.sou_proprietario && state === 'pendente' && project.participacao.origem === 'solicitacao');
  join.onclick = async () => {
    join.disabled = true;
    const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}/solicitacoes`, { method: 'POST' });
    join.disabled = false;
    if (!response.ok) return NP.status($('#project-detail-status'), response.data.mensagem || 'Não foi possível solicitar participação.', false);
    await carregarDetalheProjeto();
    NP.status($('#project-detail-status'), 'Solicitação enviada ao proprietário.', true);
  };
  cancel.onclick = () => removerParticipacao(project, NP.currentUser().id);

  const editToggle = $('[data-project-edit-toggle]');
  const editPanel = $('#project-edit-panel');
  editToggle.hidden = !project.sou_proprietario;
  editToggle.onclick = () => {
    const open = editPanel.hidden;
    editPanel.hidden = !open;
    editToggle.setAttribute('aria-expanded', String(open));
    if (open) editPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const editForm = $('#project-edit-form');
  if (project.sou_proprietario) {
    projectFormFields(editForm, project, true);
    editForm.onsubmit = async event => {
      event.preventDefault();
      const body = Object.fromEntries(new FormData(editForm).entries());
      const submit = $('button[type="submit"]', editForm);
      submit.disabled = true;
      const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}`, { method: 'PUT', body });
      submit.disabled = false;
      if (!response.ok) {
        return NP.status($('[data-project-edit-status]'), response.data.mensagem || 'Não foi possível salvar as alterações.', false);
      }
      await carregarDetalheProjeto();
      NP.status($('[data-project-edit-status]'), 'Projeto atualizado.', true);
    };
  }

  const participants = $('[data-project-participants]');
  participants.replaceChildren();
  const people = Array.isArray(project.participantes) ? project.participantes : [];
  $('[data-project-member-count]').textContent = `${people.length}`;
  people.forEach((person, index) => {
    const item = document.createElement('article');
    item.className = 'project-person';
    const avatar = document.createElement('span');
    avatar.className = 'project-person-avatar';
    const avatarUrl = safeHttpsUrl(person.avatar_url);
    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = '';
      img.onerror = () => {
        img.remove();
        avatar.textContent = (person.nome_exibicao || person.nome_usuario || '?').charAt(0).toUpperCase();
      };
      avatar.append(img);
    } else {
      avatar.textContent = (person.nome_exibicao || person.nome_usuario || '?').charAt(0).toUpperCase();
    }
    const name = document.createElement('a');
    name.href = profileHref(person);
    name.textContent = person.nome_exibicao || `@${person.nome_usuario}`;
    const role = document.createElement('small');
    role.textContent = index === 0 ? 'Proprietário' : 'Integrante';
    item.append(avatar, name, role);
    if (project.sou_proprietario && index > 0) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'profile-text-button';
      remove.textContent = 'Remover';
      remove.addEventListener('click', () => removerParticipacao(project, person.id));
      item.append(remove);
    } else if (!project.sou_proprietario && String(person.id) === String(NP.currentUser().id)) {
      const leave = document.createElement('button');
      leave.type = 'button';
      leave.className = 'profile-text-button';
      leave.textContent = 'Sair';
      leave.addEventListener('click', () => removerParticipacao(project, person.id));
      item.append(leave);
    }
    participants.append(item);
  });

  const inviteSection = $('[data-project-invite-section]');
  inviteSection.hidden = !(project.sou_proprietario && project.tipo === 'equipe');
  const inviteForm = $('#project-invite-form');
  inviteForm.onsubmit = async event => {
    event.preventDefault();
    const status = $('#project-invite-status');
    const input = inviteForm.elements.namedItem('nome_usuario');
    const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}/convites`, {
      method: 'POST',
      body: { nome_usuario: input.value },
    });
    if (!response.ok) return NP.status(status, response.data.mensagem || 'Não foi possível convidar esse usuário.', false);
    input.value = '';
    NP.status(status, 'Convite enviado.', true);
    await carregarDetalheProjeto();
  };
  const requestList = $('[data-project-requests]');
  requestList.replaceChildren();
  (project.solicitacoes || []).forEach(pending => {
    const row = document.createElement('article');
    row.className = 'project-request';
    const userLink = document.createElement('a');
    userLink.href = profileHref(pending.usuario);
    userLink.textContent = pending.usuario.nome_exibicao || `@${pending.usuario.nome_usuario}`;
    const label = document.createElement('span');
    label.textContent = pending.origem === 'solicitacao' ? 'Pediu para participar' : 'Convite enviado';
    row.append(userLink, label);
    const actions = document.createElement('div');
    if (pending.origem === 'solicitacao') {
      const accept = document.createElement('button');
      accept.type = 'button';
      accept.className = 'profile-text-button';
      accept.textContent = 'Aceitar';
      accept.onclick = () => responderParticipacaoProjeto(project, pending.usuario_id, 'aceitar');
      const decline = document.createElement('button');
      decline.type = 'button';
      decline.className = 'profile-text-button';
      decline.textContent = 'Recusar';
      decline.onclick = () => responderParticipacaoProjeto(project, pending.usuario_id, 'recusar');
      actions.append(accept, decline);
    } else {
      const cancelInvite = document.createElement('button');
      cancelInvite.type = 'button';
      cancelInvite.className = 'profile-text-button';
      cancelInvite.textContent = 'Cancelar convite';
      cancelInvite.onclick = () => removerParticipacao(project, pending.usuario_id);
      actions.append(cancelInvite);
    }
    row.append(actions);
    requestList.append(row);
  });

  const updateForm = $('#project-update-form');
  updateForm.hidden = !project.pode_atualizar;
  updateForm.onsubmit = async event => {
    event.preventDefault();
    const input = updateForm.elements.namedItem('texto');
    const status = $('#project-update-status');
    const submit = $('button[type="submit"]', updateForm);
    submit.disabled = true;
    NP.status(status, 'Publicando atualização…', true);
    const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}/atualizacoes`, {
      method: 'POST',
      body: { texto: input.value },
    });
    submit.disabled = false;
    if (!response.ok) return NP.status(status, response.data.mensagem || 'Não foi possível publicar a atualização.', false);
    input.value = '';
    NP.status(status, 'Atualização publicada.', true);
    await carregarDetalheProjeto();
  };
  renderProjectUpdates(project.atualizacoes);
  if (project.tipo === 'equipe' && project.visibilidade === 'publico' && !project.sou_proprietario && !state) {
    const status = document.createElement('p');
    status.className = 'project-join-hint';
    status.textContent = 'Este projeto público está aberto a novos integrantes.';
    $('#project-detail-status').before(status);
  } else {
    $('.project-join-hint')?.remove();
  }
}

async function responderParticipacaoProjeto(project, userId, acao) {
  const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}/participantes/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    body: { acao },
  });
  if (!response.ok) return NP.status($('#project-detail-status'), response.data.mensagem || 'Não foi possível atualizar a solicitação.', false);
  await carregarDetalheProjeto();
  NP.status(
    $('#project-detail-status'),
    acao === 'aceitar' ? 'Solicitação aceita.' : 'Solicitação recusada.',
    true,
  );
}

async function carregarDetalheProjeto() {
  const id = new URLSearchParams(location.search).get('id');
  const root = $('#project-detail');
  const status = $('#project-detail-status');
  if (!id || !/^\d{1,18}$/.test(id) || BigInt(id) < 1n) {
    root.setAttribute('aria-busy', 'false');
    return NP.status(status, 'O identificador do projeto não é válido.', false);
  }
  root.setAttribute('aria-busy', 'true');
  const response = await NP.api(`/projetos/${encodeURIComponent(id)}`);
  if (!response.ok || !response.data.projeto) {
    root.setAttribute('aria-busy', 'false');
    return NP.status(status, response.data.mensagem || 'Não foi possível carregar este projeto.', false);
  }
  $('.project-join-hint')?.remove();
  status.textContent = '';
  renderProjectDetails(response.data.projeto);
}

function initProjectDetail() {
  if (!$('#project-detail')) return;
  if (!NP.currentUser()) return void (location.href = 'login.html');
  carregarDetalheProjeto();
}

function initPlaceholders() {
  $$('[data-soon]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); NP.toast(a.dataset.soon); }));
  $$('[data-logout]').forEach(b => b.addEventListener('click', () => { NP.logout(); location.href = NP.root() + 'index.html'; }));
}

function initGameLinks() {
  $$('[data-game]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    if (!NP.currentUser()) return void (location.href = NP.root() + 'paginas/login.html');
    GAME_URL ? (location.href = GAME_URL) : NP.toast('O jogo ainda não está disponível nesta versão.');
  }));
  $$('[data-back]').forEach(a => a.addEventListener('click', e => { if (history.length > 1 && document.referrer.startsWith(location.origin || 'null')) { e.preventDefault(); history.back(); } }));
}

document.addEventListener('DOMContentLoaded', async () => {
  await NP.loadUser(); // confirma o login no servidor antes de montar as páginas
  renderHeader(); renderFooter();
  const page = document.body.dataset.page;
  if (page === 'estatisticas-jogo') initGameStats();
  else if (page === 'amigos') initFriendsPage();
  else if ($('#project-detail')) initProjectDetail();
  else if (page === 'projeto-criar') initCreateProject();
  else if (page === 'projetos-explorar') initProjectExplorer();
  else if (page === 'meus-projetos') initMyProjects();
  else if ($('#public-profile')) await initPublicProfile();
  else if ($('#perfil')) await initProfile();
  else {
    initHome();
    initFeed();
  }
  initPlaceholders(); initContact(); initRegister(); initLogin(); initGameLinks();
});
