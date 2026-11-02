/* Nexa Play — inicialização e comportamentos do site */
const GAME_URL = ''; // Integração pendente: URL do jogo Nexa Quest (ex.: 'https://...')
const { $, $$ } = NP;

function renderHeader() {
  const host = $('[data-component="header"]'); if (!host) return;
  const r = NP.root(), user = NP.currentUser(), home = r + (user ? 'paginas/inicio.html' : 'index.html'), page = document.body.dataset.page;
  const perfil = r + 'paginas/meu-perfil.html';
  const link = (href, txt, key) => `<a href="${href}"${page === key ? ' aria-current="page"' : ''}>${txt}</a>`;
  const inicial = user ? user.nome_usuario[0].toUpperCase() : NP.icon.user;
  host.className = 'site-header';
  host.innerHTML = `<div class="wrap"><a class="brand" href="${home}" aria-label="Nexa Quest — início"><img src="${r}assets/imagens/logo-escura-quest.svg" alt="Nexa Play" width="157" height="84"></a>
  <nav class="nav" id="nav" aria-label="Principal">${user
    ? link(home, 'Início', 'inicio') + link(perfil + '#missoes', 'Missões', 'missoes') + link(perfil + '#desafios', 'Desafios', 'desafios') + link(perfil + '#comunidade', 'Comunidade', 'comunidade') + link(perfil, 'Meu Perfil', 'perfil')
    : link(home, 'Início', 'inicio') + link(r + 'index.html#como-funciona', 'Como funciona', 'como') + link(r + 'index.html#comunidade', 'Comunidade', 'comunidade') + link(r + 'paginas/sobre-nexa-play.html', 'Sobre', 'sobre')}</nav>
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
    document.addEventListener('click', e => { if (!e.target.closest('.user-area')) menu.classList.remove('open'); });
    $('#logout').addEventListener('click', () => { NP.logout(); location.href = r + 'index.html'; });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { nav.classList.remove('open'); $('#user-menu')?.classList.remove('open'); } });
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
    const nomeUsuario = f.nome_usuario.value.trim();
    const email = f.email.value.trim();
    const ok = [NP.setErr(f.nome_usuario, nomeUsuario.length < 2 || nomeUsuario.length > 100 ? 'Use um nome de usuário entre 2 e 100 caracteres.' : ''),
    NP.setErr(f.email, NP.isEmail(email) ? '' : 'Informe um e-mail válido.'),
    NP.setErr(f.senha, f.senha.value.length < 6 ? 'A senha precisa ter ao menos 6 caracteres.' : ''),
    validarConfirmacao()].every(Boolean);
    if (!ok) return NP.status($('#cadastro-status'), 'Revise os campos destacados.', false);
    const btn = $('button[type=submit]', f); btn.disabled = true; NP.status($('#cadastro-status'), 'Criando sua conta…', true);
    const r = await NP.api('/usuarios', { method: 'POST', body: { nome_usuario: nomeUsuario, email, senha: f.senha.value, lembrar: true } });
    if (!r.ok) {
      btn.disabled = false;
      if (r.status === 409) NP.setErr(f.email, r.data.mensagem);
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
  set('pontos', u.pontos ?? 0); set('desafios', u.desafios ?? 5); set('conquistas', u.conquistas ?? 0); set('nivel', 'Nível ' + String(u.nivel ?? 1).padStart(2, '0'));
}

/* Meu Perfil: usa os dados de /api/me. Pontos e progresso ainda não existem no banco: aparecem zerados até o back-end enviá-los. */
function initProfile() {
  const u = NP.currentUser(); if (!u || !$('#perfil')) return;
  const campos = { nome_usuario: u.nome_usuario, email: u.email };
  $$('[data-field]').forEach(el => el.textContent = campos[el.dataset.field] || '—');
  $$('[data-user-avatar]').forEach(el => { el.textContent = u.nome_usuario[0].toUpperCase(); });
  const p = Math.max(0, Math.min(100, Number(u.progresso) || 0));
  $$('[data-progress]').forEach(el => el.style.setProperty('--w', p + '%'));
  $$('[data-progress-bar]').forEach(el => el.setAttribute('aria-valuenow', p));
  $$('[data-progress-text]').forEach(el => el.textContent = p + '% concluído');
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
  renderHeader(); renderFooter(); initHome(); initProfile(); initPlaceholders(); initContact(); initRegister(); initLogin(); initGameLinks();
});
