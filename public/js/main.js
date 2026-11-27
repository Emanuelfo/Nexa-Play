/* Nexa Play — inicialização e comportamentos do site */
const GAME_PAGE = 'paginas/jogo.html'; // Jogo incorporado (URL entregue por GET /api/jogo somente a sessões válidas)
const { $, $$ } = NP;

// Shared vocabulary and controls for every authenticated social screen.
const NQ_AREAS = ['Desenvolvimento de Sistemas', 'Design', 'Multimídia', 'Jogos Digitais'];
const NQ_LEGACY_CATEGORIES = ['Jogos', 'Arte e design', 'Programação', 'Educação', 'Música', 'Outros'];
const NQ_STAGES = ['Ideia', 'Em desenvolvimento', 'Em testes', 'Concluído'];
const areaOptions = () => NQ_AREAS.map(area => `<option>${area}</option>`).join('');

function skillList(person, limit = 12) {
  const list = document.createElement('ul');
  list.className = 'nq-skills';
  list.setAttribute('aria-label', 'Habilidades');
  (Array.isArray(person.habilidades) ? person.habilidades : []).slice(0, limit).forEach(skill => {
    const item = document.createElement('li');
    item.textContent = skill;
    list.append(item);
  });
  list.hidden = !list.childElementCount;
  return list;
}

function projectSummary(project) {
  if (project.resumo) return project.resumo;
  const firstParagraph = (project.descricao || '').split(/\n\s*\n/)[0];
  // Retain a complete sentence for legacy records, never a CSS-clipped fragment.
  return firstParagraph.match(/^.*?[.!?](?:\s|$)/)?.[0].trim() || firstParagraph;
}

function prepareSocialForm(form) {
  form.noValidate = true;
  [...form.elements].filter(field => field.matches('input:not([type=checkbox]), textarea, select')).forEach((field, index) => {
    if (!field.id) field.id = `${form.id}-field-${index}`;
    if (!document.getElementById(`${field.id}-err`)) {
      const error = document.createElement('small');
      error.id = `${field.id}-err`;
      error.className = 'field-error';
      field.after(error);
    }
    if (!field.dataset.validationReady) {
      field.addEventListener('input', () => NP.setErr(field, ''));
      field.dataset.validationReady = '1';
    }
  });
}

function validateSocialForm(form) {
  let valid = true;
  [...form.elements].filter(field => field.matches('input:not([type=checkbox]), textarea, select')).forEach(field => {
    let message = '';
    if (field.required && !field.value.trim()) message = 'Preencha este campo para continuar.';
    else if (field.validity.patternMismatch || field.validity.tooShort) message = 'Confira o formato e a quantidade de caracteres indicados.';
    else if (field.maxLength > 0 && field.value.length > field.maxLength) message = `Use até ${field.maxLength} caracteres.`;
    else if (field.type === 'url' && field.value && !safeHttpsUrl(field.value)) message = 'Use um endereço completo com https://, sem usuário ou senha.';
    if (field.name === 'habilidades') {
      const skills = field.value.split(',').map(s => s.trim()).filter(Boolean);
      if (skills.length > 12 || skills.some(s => s.length > 40)) message = 'Use até 12 habilidades de até 40 caracteres, separadas por vírgula.';
    }
    NP.setErr(field, message);
    if (message) valid = false;
  });
  if (!valid) NP.focusFirstInvalid(form);
  return valid;
}

function socialFormError(form, response, status) {
  const message = response.data.mensagem || 'Não foi possível salvar. Confira sua conexão e tente novamente; seu texto foi mantido.';
  NP.status(status, message, false);
  const field = form.elements.namedItem(response.data.campo);
  if (field) { NP.setErr(field, message); field.focus(); }
}

function mountSocialDialog(dialog) {
  const origin = document.activeElement;
  const previousScroll = window.scrollY;
  dialog.className = 'nq-dialog';
  document.body.append(dialog);
  document.documentElement.classList.add('nq-modal-open');
  dialog.addEventListener('close', () => {
    dialog.remove();
    document.documentElement.classList.remove('nq-modal-open');
    origin?.focus({ preventScroll: true });
    window.scrollTo({ top: previousScroll, behavior: 'instant' });
  }, { once: true });
  dialog.showModal();
}

function confirmSocialAction(message) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.setAttribute('aria-labelledby', 'social-confirm-title');
    const title = document.createElement('h2'); title.id = 'social-confirm-title'; title.textContent = 'Confirmar alteração';
    const text = document.createElement('p'); text.textContent = message;
    const actions = document.createElement('div'); actions.className = 'project-form-actions';
    const cancel = document.createElement('button'); cancel.className = 'btn-soft'; cancel.textContent = 'Cancelar'; cancel.autofocus = true;
    const accept = document.createElement('button'); accept.className = 'btn'; accept.textContent = 'Confirmar';
    actions.append(cancel, accept); dialog.append(title, text, actions);
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirmar'), { once: true });
    cancel.onclick = () => dialog.close(); accept.onclick = () => dialog.close('confirmar');
    mountSocialDialog(dialog);
  });
}

function shareSocialPost(data) {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'social-share-title');
  const title = document.createElement('h2'); title.id = 'social-share-title'; title.textContent = 'Compartilhar publicação';
  const hint = document.createElement('p'); hint.textContent = 'Envie este link para quem tem uma conta Nexa Quest. As regras de privacidade da publicação continuam valendo.';
  const label = document.createElement('label'); label.className = 'nq-share-label'; label.textContent = 'Link da publicação';
  const input = document.createElement('input'); input.type = 'url'; input.readOnly = true; input.value = data.url; input.autofocus = true; label.append(input);
  const status = document.createElement('p'); status.className = 'feed-status'; status.setAttribute('role', 'status');
  const actions = document.createElement('div'); actions.className = 'project-form-actions';
  const close = document.createElement('button'); close.type = 'button'; close.className = 'btn-soft'; close.textContent = 'Fechar'; close.onclick = () => dialog.close();
  const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'btn'; copy.textContent = 'Copiar link';
  copy.onclick = async () => {
    if (copy.disabled) return;
    setBusy(copy, true);
    try {
      await navigator.clipboard.writeText(data.url);
      status.textContent = 'Link da publicação copiado.';
    } catch {
      status.textContent = 'Selecione o link e use a opção Copiar do seu aparelho ou Ctrl + C.';
      input.focus(); input.select();
    } finally { setBusy(copy, false); }
  };
  actions.append(close, copy);
  if (navigator.share) {
    const native = document.createElement('button'); native.type = 'button'; native.className = 'btn-soft'; native.textContent = 'Compartilhar no aparelho';
    native.onclick = async () => {
      try { await navigator.share(data); }
      catch (error) { if (error.name !== 'AbortError') status.textContent = 'Use o link acima para compartilhar esta publicação.'; }
    };
    actions.prepend(native);
  }
  dialog.append(title, hint, label, status, actions);
  mountSocialDialog(dialog);
  input.select();
}

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
  plus: '<path d="M12 5v14M5 12h14"/>',
  game: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5 3.500-5 3.500z"/>',
};
const nqSvg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

function userInitial(user) {
  return (user?.nome_exibicao || user?.nome_usuario || '?').trim().charAt(0).toUpperCase() || '?';
}

/* Tom estável (0–5) derivado do nome de usuário: dá ritmo visual ao feed sem depender de foto. */
function avatarTone(user) {
  const key = String(user?.nome_usuario || user?.nome_exibicao || '?');
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return String(hash % 6);
}

function avatarEl(user, size = 40, tag = 'span') {
  const el = document.createElement(tag);
  el.className = 'nq-avatar';
  el.style.setProperty('--s', `${size}px`);
  el.dataset.tone = avatarTone(user);
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


/* ---------- Auxiliares da rede social ---------- */
function autosizeField(field, max = 260) {
  field.style.height = 'auto';
  const border = field.offsetHeight - field.clientHeight;
  field.style.height = `${Math.min(field.scrollHeight + border, max)}px`;
}

function setFriendsBadge(total) {
  $$('[data-friends-badge]').forEach(badge => {
    badge.hidden = !total;
    badge.textContent = total > 9 ? '9+' : String(total);
    badge.closest('a')?.setAttribute('aria-label', total
      ? `Pessoas, ${total} ${total === 1 ? 'solicitação pendente' : 'solicitações pendentes'}`
      : 'Pessoas');
  });
}

/* Busca do topo: sugere pessoas enquanto digita; Enter sem seleção abre a página Pessoas. */
function initSearchSuggest(form, root) {
  const input = $('input', form);
  const box = $('.nq-suggest', form);
  if (!input || !box) return;
  let timer = null;
  let sequence = 0;
  let suggestController = null;
  let active = -1;
  const rows = () => [...box.querySelectorAll('[role="option"]')];
  const close = () => {
    box.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  const highlight = index => {
    const list = rows();
    active = index;
    list.forEach((row, i) => {
      row.classList.toggle('is-active', i === index);
      row.setAttribute('aria-selected', String(i === index));
    });
    if (index >= 0) input.setAttribute('aria-activedescendant', list[index].id);
    else input.removeAttribute('aria-activedescendant');
  };
  const show = (users, term) => {
    box.replaceChildren();
    users.slice(0, 5).forEach((person, index) => {
      const row = document.createElement('a');
      row.id = `nq-suggest-${index}`;
      row.className = 'nq-suggest-item';
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', 'false');
      row.href = profileHref(person);
      const text = document.createElement('span');
      text.className = 'nq-suggest-text';
      const name = document.createElement('strong');
      name.textContent = person.nome_exibicao || person.nome_usuario;
      const handle = document.createElement('small');
      handle.textContent = (person.habilidades || []).slice(0, 2).join(' · ') || person.area || `@${person.nome_usuario}`;
      text.append(name, handle);
      row.append(avatarEl(person, 32), text);
      box.append(row);
    });
    if (users.length) {
      const all = document.createElement('a');
      all.id = 'nq-suggest-all';
      all.className = 'nq-suggest-all';
      all.setAttribute('role', 'option');
      all.setAttribute('aria-selected', 'false');
      all.href = `${root}paginas/amigos.html?q=${encodeURIComponent(term)}`;
      all.textContent = `Ver todos os resultados`;
      box.append(all);
    } else {
      const empty = document.createElement('p');
      empty.className = 'nq-suggest-empty';
      empty.textContent = 'Nenhuma pessoa encontrada.';
      box.append(empty);
    }
    box.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
  };
  input.addEventListener('input', event => {
    clearTimeout(timer);
    sequence += 1;
    suggestController?.abort();
    close();
    if (event.isComposing) return;
    const term = input.value.trim().replace(/^@/, '');
    if (term.length < 2) { sequence += 1; suggestController?.abort(); close(); return; }
    timer = setTimeout(async () => {
      const current = ++sequence;
      suggestController?.abort();
      suggestController = new AbortController();
      const response = await NP.api(`/usuarios/buscar?q=${encodeURIComponent(term)}`, { signal: suggestController.signal });
      if (current !== sequence || document.activeElement !== input) return;
      if (!response.ok || !Array.isArray(response.data.usuarios)) { close(); return; }
      show(response.data.usuarios, term);
    }, 250);
  });
  input.addEventListener('compositionend', () => input.dispatchEvent(new Event('input')));
  input.addEventListener('keydown', event => {
    if (event.isComposing) return;
    const list = rows();
    if (event.key === 'Escape' && !box.hidden) { event.preventDefault(); close(); return; }
    if (box.hidden || !list.length) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); highlight((active + 1) % list.length); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); highlight((active - 1 + list.length) % list.length); }
    else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); location.href = list[active].href; }
  });
  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('.nq-search')) close();
  });
}

let ownProfilePromise = null;
let publicProfilePromise = null;
function loadOwnProfileResponse(retry = false) {
  if (retry || !ownProfilePromise) {
    ownProfilePromise = NP.api('/me/perfil');
  }
  return ownProfilePromise;
}

function loadPublicProfileResponse(id, retry = false) {
  if (retry || !publicProfilePromise) {
    publicProfilePromise = NP.api(`/usuarios/${encodeURIComponent(id)}/perfil`);
  }
  return publicProfilePromise;
}

function loadOwnProfile() {
  return loadOwnProfileResponse().then(r => (r.ok && r.data.usuario ? r.data.usuario : null));
}

function statusWithRetry(el, message, retry) {
  if (!el) return;
  NP.status(el, message, false);
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'profile-text-button';
  button.textContent = 'Tentar novamente';
  button.addEventListener('click', () => {
    button.disabled = true;
    retry();
  });
  el.append(' ', button);
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
  NP.toast('Solicitação enviada.');
}

function renderRailSuggestions(box) {
  const list = $('[data-rail-people]', box);
  NP.api('/usuarios/sugestoes').then(response => {
    const users = response.ok && Array.isArray(response.data.usuarios) ? response.data.usuarios.slice(0, 4) : [];
    if (!users.length) {
      const empty = document.createElement('li');
      empty.className = 'nq-support-empty';
      empty.textContent = response.ok ? 'Busque por uma habilidade para encontrar colaboradores.' : 'Não foi possível carregar as sugestões. Tente pela seção Pessoas.';
      list.replaceChildren(empty);
      return;
    }
    users.forEach(person => {
      const row = document.createElement('li');
      row.className = 'nq-person';
      const link = document.createElement('a');
      link.href = profileHref(person);
      const name = document.createElement('strong');
      name.textContent = person.nome_exibicao || person.nome_usuario;
      const handle = document.createElement('span');
      handle.textContent = (person.habilidades || []).slice(0, 2).join(' · ') || person.area || `@${person.nome_usuario}`;
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

const NQ_PAGE_TITLE = {
  inicio: 'Início',
  'projetos-explorar': 'Explorar projetos',
  amigos: 'Pessoas',
  'meus-projetos': 'Meus projetos',
  perfil: 'Meu perfil',
  'perfil-publico': 'Perfil',
  jogo: 'Jogo',
  'estatisticas-jogo': 'Atividade no jogo',
  'projeto-criar': 'Criar projeto',
  'projeto-detalhe': 'Projeto',
};

function renderSocialShell(host, user) {
  const root = NP.root();
  const profile = `${root}paginas/meu-perfil.html`;
  const page = document.body.dataset.page;
  const navigation = [
    { key: 'inicio', label: 'Início', href: `${root}paginas/inicio.html`, path: NQ_ICON.home },
        { key: 'projetos-explorar', label: 'Explorar projetos', short: 'Projetos', href: `${root}paginas/explorar-projetos.html`, path: NQ_ICON.explore },
    { key: 'amigos', label: 'Pessoas', href: `${root}paginas/amigos.html`, path: NQ_ICON.people },
    { key: 'meus-projetos', label: 'Meus projetos', href: `${root}paginas/meus-projetos.html`, path: NQ_ICON.projects },
    { key: 'jogo', label: 'Jogo', href: `${root}${GAME_PAGE}`, path: NQ_ICON.game },
    { key: 'perfil', label: 'Meu perfil', short: 'Perfil', href: profile, path: NQ_ICON.user },
  ];
  const activeMap = { 'perfil-publico': String(new URLSearchParams(location.search).get('id')) === String(user.id) ? 'perfil' : 'amigos', 'estatisticas-jogo': 'estatisticas-jogo', 'projeto-detalhe': 'projetos-explorar', 'projeto-criar': 'projetos-explorar' };
  const activeKey = page in activeMap ? activeMap[page] : page;
  const link = (item, extra = '', short = false) => `<a href="${item.href}" title="${item.label}"${(activeKey === item.key || (short && page === 'meus-projetos' && item.key === 'projetos-explorar')) ? ' aria-current="page"' : ''}${extra}>${nqSvg(item.path)}<span>${short ? (item.short || item.label) : item.label}</span>${item.key === 'amigos' ? '<b class="nq-badge" data-friends-badge hidden aria-hidden="true"></b>' : ''}</a>`;
  const createHref = `${root}paginas/criar-projeto.html`;
  const statsItem = { key: 'estatisticas-jogo', label: 'Atividade no jogo', href: `${root}paginas/estatisticas.html`, path: NQ_ICON.trophy };

  host.className = 'site-header social-topbar';
  host.innerHTML = `<div class="nq-top">
    <a class="nq-brand-mobile" href="${root}paginas/inicio.html" aria-label="Nexa Quest — início"><img src="${root}assets/imagens/logo-escura-quest.svg" alt="Nexa Quest" width="52" height="28"></a>
    <p class="nq-top-title" data-top-title>${NQ_PAGE_TITLE[page] || ''}</p>
    <form class="nq-search" role="search" action="${root}paginas/amigos.html">
      ${nqSvg(NQ_ICON.search)}
      <label class="sr-only" for="nq-search-input">Buscar pessoas ou habilidades</label>
      <input id="nq-search-input" name="q" type="search" minlength="2" maxlength="100" placeholder="Buscar pessoas ou habilidades" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="nq-suggest">
      <div class="nq-suggest" id="nq-suggest" role="listbox" aria-label="Pessoas encontradas" hidden></div>
    </form>
    <div class="nq-top-actions">
      <a class="nq-publish" href="${root}paginas/inicio.html?novo=1" data-publish>${nqSvg(NQ_ICON.plus)}<span>Publicar</span></a>
      <button class="nq-search-toggle" type="button" aria-label="Buscar pessoas" aria-expanded="false">${nqSvg(NQ_ICON.search)}</button>
      <button class="theme-toggle" data-theme-toggle type="button" aria-label="Alternar entre modo claro e escuro" title="Ativar modo escuro" aria-pressed="false">
        <svg data-theme-icon="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.4A8.5 8.5 0 0 1 8.6 3.8 8.5 8.5 0 1 0 20.2 15.4Z"></path></svg>
        <svg data-theme-icon="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path></svg>
      </button>
      <div class="user-area">
        <button class="user-btn" id="user-btn" type="button" aria-haspopup="true" aria-expanded="false" aria-controls="user-menu" aria-label="Abrir menu da conta"></button>
        <div class="user-menu" id="user-menu" aria-label="Menu da conta">
          <div class="menu-id"><strong data-menu-name></strong><span>@${user.nome_usuario}</span></div>
          <a href="${profile}">Meu perfil</a>
          <a href="${root}paginas/meus-projetos.html">Meus projetos</a>
          <a href="${root}paginas/estatisticas.html">Atividade no jogo</a>
          <a href="${root}${GAME_PAGE}" data-game>Acessar o jogo</a>
          <button type="button" id="logout">Sair da conta</button>
        </div>
      </div>
    </div>
  </div>`;
  const topbar = $('.nq-top', host);
  initSearchSuggest($('.nq-search', host), root);
  const searchToggle = $('.nq-search-toggle', host);
  searchToggle.addEventListener('click', () => {
    const open = topbar.classList.toggle('is-searching');
    searchToggle.setAttribute('aria-expanded', String(open));
    if (open) $('#nq-search-input').focus();
  });
  topbar.addEventListener('keydown', event => {
    if (event.key === 'Escape' && topbar.classList.contains('is-searching')) {
      topbar.classList.remove('is-searching'); searchToggle.setAttribute('aria-expanded', 'false'); searchToggle.focus();
    }
  });
  document.dispatchEvent(new Event('np:social-theme-controls-ready'));
  const accountButton = $('#user-btn');
  const accountMenu = $('#user-menu');
  accountButton.append(avatarEl(user, 34));
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
  $('#logout').addEventListener('click', () => NP.signOut());

  const shell = document.createElement('div');
  shell.className = 'social-shell';
  const sidebar = document.createElement('nav');
  sidebar.className = 'nq-nav';
  sidebar.setAttribute('aria-label', 'Principal');
  sidebar.innerHTML = `<p class="nq-nav-label">Comunidade</p>
    <ul>${navigation.map(item => `<li>${link(item)}</li>${item.key === 'meus-projetos' ? `<li class="nq-create-row"><a class="nq-create" href="${createHref}">${nqSvg(NQ_ICON.plus)}<span>Criar projeto</span></a></li>` : ''}`).join('')}</ul>
    <ul class="nq-nav-secondary"><li>${link(statsItem)}</li></ul>`;

  const tabbar = document.createElement('nav');
  tabbar.className = 'nq-tabbar';
  tabbar.setAttribute('aria-label', 'Navegação principal');
  // Cinco destinos com a mesma largura; criação fica na área de projetos.
  const byKey = key => navigation.find(item => item.key === key);
  tabbar.innerHTML = ['inicio', 'projetos-explorar', 'jogo', 'amigos', 'perfil']
    .map(key => link(byKey(key), key === 'jogo' ? ' class="is-game"' : '', true))
    .join('');

  const main = $('main');
  if (!main) return;
  main.classList.add('social-main');
  const stage = document.createElement('div');
  stage.className = 'nq-stage';
  const body = document.createElement('div');
  body.className = 'nq-body';
  host.after(shell);
  stage.append(body);
  body.append(main);
  shell.append(host, sidebar, stage);

  if (page === 'inicio') {
    const side = document.createElement('aside');
    side.className = 'nq-side';
    side.setAttribute('aria-label', 'Resumo e sugestões');
    side.innerHTML = `<section class="nq-box" aria-labelledby="rail-people-title">
        <div class="home-section-head"><h2 id="rail-people-title">Pessoas para conhecer</h2></div>
        <ul class="nq-people" data-rail-people></ul>
        <a class="nq-more" href="${root}paginas/amigos.html">Ver mais pessoas</a>
      </section>
      <section class="nq-box nq-progress" aria-labelledby="rail-progress-title">
        <h2 id="rail-progress-title">Seu progresso</h2>
        <div class="nq-mini-stats" data-rail-stats hidden></div>
        <a class="nq-more" href="${profile}">Ver atividade no perfil</a>
      </section>
      <section class="nq-box nq-game" aria-labelledby="rail-game-title">
        <img class="nq-game-mascot" src="${root}assets/imagens/golfinho-fone.svg" alt="" width="120" height="76">
        <h2 id="rail-game-title">Acessar o jogo</h2>
        <p>Continue suas missões no Nexa Quest.</p>
        <a class="btn btn-sm" href="${root}${GAME_PAGE}" data-game>Acessar o jogo</a>
      </section>`;
    const recent = $('.home-recent');
    const placeRecent = () => {
      if (matchMedia('(min-width: 1100px)').matches) side.prepend(recent);
      else {
        const posts = $$('#feed-list > .feed-post');
        if (posts.length >= 2) { if (posts[1].nextElementSibling !== recent) posts[1].after(recent); }
        else if ($('#publicacoes').nextElementSibling !== recent) $('#publicacoes').after(recent);
      }
    };
    if (recent) {
      const feed = $('#feed-list');
      new MutationObserver(() => { if (!side.contains(recent)) placeRecent(); }).observe(feed, { childList: true });
      matchMedia('(min-width: 1100px)').addEventListener('change', placeRecent);
      placeRecent();
    }
    body.append(side);
    renderRailSuggestions($('[data-rail-people]', side).closest('.nq-box'));
  }
  document.body.append(tabbar);
  // VisualViewport covers keyboards that overlay the layout viewport (notably iOS).
  // Hide the fixed navigation while typing; the document remains the scroll owner.
  if (window.visualViewport) {
    let fullHeight = window.visualViewport.height;
    const fitKeyboard = () => {
      const viewport = window.visualViewport;
      const typing = document.activeElement?.matches('input, textarea, select');
      if (!typing) fullHeight = viewport.height;
      const open = typing && (innerHeight - viewport.height > 140 || fullHeight - viewport.height > 140);
      document.body.classList.toggle('nq-keyboard-open', !!open);
      if (open) document.activeElement.scrollIntoView({ block: 'nearest' });
    };
    window.visualViewport.addEventListener('resize', fitKeyboard);
    document.addEventListener('focusout', () => requestAnimationFrame(fitKeyboard));
  }

  // Aviso de solicitações de amizade pendentes na navegação.
  NP.api('/me/amizades').then(response => {
    if (response.ok && Array.isArray(response.data.recebidas)) setFriendsBadge(response.data.recebidas.length);
  });

  // Tocar no item da página atual leva ao topo em vez de recarregar.
  $$('.nq-nav a[aria-current="page"], .nq-tabbar a[aria-current="page"]').forEach(anchor => {
    if (new URL(anchor.href).pathname !== location.pathname) return;
    anchor.addEventListener('click', event => {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  });

  // Compatibilidade: links antigos com ?novo=1 continuam levando o foco ao campo de publicação.
  $$('[data-publish]').forEach(anchor => anchor.addEventListener('click', event => {
    const input = $('#feed-post-text');
    if (input) { event.preventDefault(); input.scrollIntoView({ block: 'center' }); input.focus(); }
  }));

  const ownProfileTask = loadOwnProfile().then(own => {
    if (!own) return;
    accountButton.replaceChildren(avatarEl(own, 34));
    $('[data-menu-name]').textContent = own.nome_exibicao || own.nome_usuario;
    const composerAvatar = $('[data-composer-avatar]');
    if (composerAvatar) composerAvatar.replaceWith(avatarEl(own, 40));
    if (page === 'inicio') {
      const greeting = $('[data-home-greeting]');
      const firstName = String(own.nome_exibicao || own.nome_usuario || '').trim().split(/\s+/)[0];
      if (greeting && firstName) greeting.textContent = `Olá, ${firstName}!`;
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
  // Saudação, avatar e resumo fazem parte da 1ª renderização: o preloader os aguarda por até 1,5 s (nunca além).
  window.NPLoader?.track(ownProfileTask, 1500);
}

/* Início: projetos mais recentes da comunidade (mesmo endpoint e mesmo card do Explorar). */
function initHomeProjects() {
  const list = $('#home-projects');
  if (!list) return;
  NP.api('/projetos?limite=3').then(response => {
    list.setAttribute('aria-busy', 'false');
    list.replaceChildren();
    if (!response.ok || !Array.isArray(response.data.projetos)) {
      list.append(projectEmpty('Não foi possível carregar os projetos.', 'Tente novamente em instantes.'));
      return;
    }
    response.data.projetos.slice(0, 3).forEach(project => {
      const row = document.createElement('article');
      row.className = 'home-project';
      const category = document.createElement('small');
      category.textContent = project.categoria;
      const title = document.createElement('a');
      title.href = projectLink(project);
      title.textContent = project.titulo;
      const summary = document.createElement('p');
      summary.textContent = projectSummary(project);
      row.append(category, title, summary);
      if (project.tipo === 'equipe' && project.visibilidade === 'publico') {
        const available = document.createElement('span');
        available.className = 'nq-availability';
        available.textContent = 'Aceita solicitações de participação';
        row.append(available);
      }
      list.append(row);
    });
    if (!response.data.projetos.length) {
      list.append(projectEmpty('Ainda não há projetos públicos.', 'Quando a comunidade publicar projetos, eles aparecerão aqui.', 'Criar um projeto', `${NP.root()}paginas/criar-projeto.html`));
    }
  });
}

/* Estado de carregamento de botões (visual + bloqueio de cliques repetidos). */
function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle('is-loading', busy);
  if (busy) button.setAttribute('aria-busy', 'true'); else button.removeAttribute('aria-busy');
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
    $('#logout').addEventListener('click', () => NP.signOut());
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
  const r = NP.root(), logged = !!NP.currentUser();
  host.className = 'site-footer';
  host.innerHTML = `<div class="shell pf">
  <div class="pf-brand"><a href="${r}index.html" aria-label="Nexa Quest — página inicial"><img src="${r}assets/imagens/logo-branca-quest.svg" alt="Nexa Quest" width="88" height="68"></a><p>Uma criação da Nexa Play.</p></div>
  <div><h3>Nexa Quest</h3><ul><li><a href="${r}index.html">Inicial</a></li><li><a href="${r}paginas/nexa-quest.html">Nexa Quest</a></li><li><a href="${r}paginas/sobre-nexa-play.html">Sobre</a></li></ul></div>
  <div><h3>Sua conta</h3><ul>${logged
    ? `<li><a href="${r}paginas/inicio.html">Ir para a plataforma</a></li>`
    : `<li><a href="${r}paginas/criar-conta.html">Criar conta</a></li><li><a href="${r}paginas/login.html">Entrar</a></li>`}</ul></div>
</div>`;
}

/* Registrado ANTES de qualquer operação assíncrona (verificação de sessão): assim o envio nunca cai no
   comportamento nativo do navegador (GET com nome, e-mail e mensagem na URL). Sem JavaScript, o formulário
   usa method="post" e não expõe dados na URL. */
function initContact() {
  const f = $('#form-contato'); if (!f) return;
  let sending = false;
  addEventListener('sessionchecked', () => {
    const u = NP.currentUser();
    if (u && !f.nome.value && !f.email.value) { f.nome.value = u.nome_usuario; f.email.value = u.email; }
  }, { once: true });
  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (sending) return;
    const ok = [NP.setErr(f.nome, f.nome.value.trim().length < 2 ? 'Informe seu nome.' : ''),
    NP.setErr(f.email, NP.isEmail(f.email.value.trim()) ? '' : 'Informe um e-mail válido.'),
    NP.setErr(f.assunto, f.assunto.value.trim().length < 3 ? 'Informe o assunto.' : ''),
    NP.setErr(f.msg, f.msg.value.trim().length < 10 ? 'Escreva ao menos 10 caracteres.' : '')].every(Boolean);
    if (!ok) return NP.status($('#contato-status'), 'Revise os campos destacados.', false);
    const btn = $('button[type=submit]', f);
    const label = btn.textContent;
    sending = true; btn.disabled = true; btn.textContent = 'Enviando…'; f.setAttribute('aria-busy', 'true');
    NP.status($('#contato-status'), 'Enviando sua mensagem…', true);
    let r;
    try {
      r = await NP.api('/mensagens', { method: 'POST', body: { nome: f.nome.value.trim(), email: f.email.value.trim(), assunto: f.assunto.value.trim(), msg: f.msg.value.trim() } });
    } catch { r = { ok: false, data: {} };
    } finally {
      sending = false; btn.disabled = false; btn.textContent = label; f.removeAttribute('aria-busy');
    }
    if (!r.ok) return NP.status($('#contato-status'), r.data?.mensagem || 'Não foi possível enviar a mensagem. Verifique sua conexão e tente novamente.', false);
    f.msg.value = f.assunto.value = '';
    NP.status($('#contato-status'), 'Mensagem enviada. Obrigado pelo contato!', true);
  });
}

function initRegister() {
  const f = $('#form-cadastro'); if (!f) return;
  let submitting = false;
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
    if (submitting) return;
    const nomeCompleto = f.nome_completo.value.trim();
    const nomeUsuario = f.nome_usuario.value.trim();
    const email = f.email.value.trim();
    const ok = [NP.setErr(f.nome_completo, nomeCompleto.length > 0 && nomeCompleto.length <= 100 ? '' : 'Informe seu nome completo (até 100 caracteres).'),
    NP.setErr(f.nome_usuario, /^[A-Za-z0-9_]{3,30}$/.test(nomeUsuario) ? '' : 'Use de 3 a 30 letras, números ou _ no nome de usuário.'),
    NP.setErr(f.email, NP.isEmail(email) && email.length <= 255 ? '' : 'Informe um e-mail válido.'),
    NP.setErr(f.senha, f.senha.value.length < 6 || new TextEncoder().encode(f.senha.value).length > 72 ? 'Use ao menos 6 caracteres e até 72 bytes na senha.' : ''),
    validarConfirmacao()].every(Boolean);
    if (!ok) return NP.status($('#cadastro-status'), 'Revise os campos destacados.', false);
    const btn = $('button[type=submit]', f);
    submitting = true;
    btn.disabled = true;
    NP.status($('#cadastro-status'), 'Criando sua conta…', true);
    let completed = false;
    try {
      const result = await NP.api('/usuarios', { method: 'POST', body: { nome_completo: nomeCompleto, nome_usuario: nomeUsuario, email, senha: f.senha.value } });
      if (!result.ok) {
        if (result.status === 409 && ['email', 'nome_usuario'].includes(result.data.campo)) {
          NP.setErr(f.elements.namedItem(result.data.campo), result.data.mensagem);
        }
        NP.status($('#cadastro-status'), result.data.mensagem || 'Não foi possível criar a conta.', false);
        return;
      }
      await NP.login();
      completed = true;
      NP.status($('#cadastro-status'), 'Conta criada! Redirecionando…', true);
      location.replace(postLoginUrl());
    } catch (error) {
      NP.status($('#cadastro-status'), error.message, false);
    } finally {
      if (!completed) {
        submitting = false;
        btn.disabled = false;
      }
    }
  });
}

function initLogin() {
  const f = $('#form-login'); if (!f) return;
  let submitting = false;
  f.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    const id = f.id_login.value.trim();
    const valid = [
      NP.setErr(f.id_login, id && id.length <= 255 ? '' : 'Informe seu e-mail ou usuário.'),
      NP.setErr(f.senha, f.senha.value ? '' : 'Informe sua senha.'),
    ].every(Boolean);
    if (!valid) return;
    const button = $('button[type=submit]', f);
    submitting = true;
    button.disabled = true;
    NP.status($('#login-status'), 'Entrando…', true);
    let completed = false;
    try {
      const result = await NP.api('/login', { method: 'POST', body: { id_login: id, senha: f.senha.value, lembrar: f.lembrar.checked } });
      if (!result.ok) {
        NP.status($('#login-status'), result.data.mensagem || 'Não foi possível entrar.', false);
        return;
      }
      await NP.login();
      completed = true;
      location.replace(postLoginUrl());
    } catch (error) {
      NP.status($('#login-status'), error.message, false);
    } finally {
      if (!completed) {
        submitting = false;
        button.disabled = false;
      }
    }
  });
}

const GAME_AFTER_LOGIN_KEY = 'nq_after_login';
/* Quem tentou abrir o jogo sem sessão volta a ele depois de entrar (apenas nesta aba). */
function rememberGameDestination() {
  try { sessionStorage.setItem(GAME_AFTER_LOGIN_KEY, 'jogo'); } catch { /* storage may be disabled */ }
}
function postLoginUrl() {
  let next = '';
  try {
    next = sessionStorage.getItem(GAME_AFTER_LOGIN_KEY) || '';
    sessionStorage.removeItem(GAME_AFTER_LOGIN_KEY);
  } catch { /* storage may be disabled */ }
  return next === 'jogo' ? 'jogo.html' : 'inicio.html';
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
  image.decoding = 'async';
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

const FEED_ICON = {
  like: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>',
  comment: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.7 6.8-4.4m-6.8 7 6.8 4.3"/>',
};

function feedActionButton(iconPath, count) {
  const button = document.createElement('button');
  button.className = 'feed-action';
  button.type = 'button';
  button.innerHTML = nqSvg(iconPath);
  if (count !== null) {
    const number = document.createElement('span');
    number.className = 'feed-action-count';
    number.textContent = String(count);
    button.append(number);
  }
  return button;
}

function renderFeedPost(post) {
  const item = document.createElement('article');
  item.className = 'feed-post';
  item.id = `publicacao-${post.id}`;
  item.dataset.postId = post.id;

  const avatarLink = document.createElement('a');
  avatarLink.className = 'feed-avatar';
  avatarLink.href = profileHref(post.autor);
  avatarLink.setAttribute('aria-label', `Ver perfil de ${post.autor.nome_usuario || 'usuário'}`);
  avatarLink.append(avatarEl(post.autor, 40));

  const main = document.createElement('div');
  main.className = 'feed-post-main';

  const heading = document.createElement('header');
  heading.className = 'feed-post-header';
  const handle = document.createElement('span');
  handle.className = 'feed-post-handle';
  handle.textContent = `@${post.autor.nome_usuario || 'usuario'}`;
  const date = document.createElement('time');
  date.className = 'feed-post-time';
  date.dateTime = post.criado_em || '';
  date.title = formatSocialDate(post.criado_em);
  date.textContent = formatRelative(post.criado_em);
  heading.append(makeProfileAnchor(post.autor, 'feed-post-author'), handle, date);

  const body = post.texto || '';
  const text = document.createElement('p');
  text.className = 'feed-post-text';
  text.textContent = body;
  main.append(heading, text);
  if (body.length > 420 || (body.match(/\n/g) || []).length > 6) {
    text.classList.add('is-clamped');
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'feed-more';
    expand.textContent = 'Ver mais';
    expand.setAttribute('aria-expanded', 'false');
    expand.addEventListener('click', () => {
      const collapsed = text.classList.toggle('is-clamped');
      expand.textContent = collapsed ? 'Ver mais' : 'Ver menos';
      expand.setAttribute('aria-expanded', String(!collapsed));
    });
    main.append(expand);
  }

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
    main.append(achievement);
  }
  addSafeImage(main, post.imagem_url, post.imagem_alt);
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
      main.append(projectLink);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'feed-post-actions';
  let likeCount = Number(post.curtidas) || 0;
  let commentTotal = Number(post.quantidade_comentarios) || 0;
  const like = feedActionButton(FEED_ICON.like, likeCount);
  like.dataset.feedLike = '';
  const likeLabel = document.createElement('span');
  likeLabel.className = 'feed-action-label';
  like.prepend(likeLabel);
  const likeNumber = like.querySelector('.feed-action-count');
  const paintLike = liked => {
    likeLabel.textContent = liked ? 'Curtido' : 'Curtir';
    like.setAttribute('aria-pressed', String(liked));
    like.setAttribute('aria-label', `${liked ? 'Remover curtida' : 'Curtir publicação'} (${likeCount})`);
    likeNumber.textContent = String(likeCount);
  };
  paintLike(Boolean(post.curtida_pelo_usuario));
  const commentsButton = feedActionButton(FEED_ICON.comment, commentTotal);
  const commentLabel = document.createElement('span');
  commentLabel.className = 'feed-action-label';
  commentLabel.textContent = 'Comentar';
  commentsButton.append(commentLabel);
  commentsButton.dataset.feedCommentsToggle = '';
  commentsButton.setAttribute('aria-expanded', 'false');
  const commentsNumber = commentsButton.querySelector('.feed-action-count');
  const paintComments = () => {
    commentsNumber.textContent = String(commentTotal);
    commentsButton.setAttribute('aria-label', `Comentários (${commentTotal})`);
  };
  paintComments();
  const share = feedActionButton(FEED_ICON.share, null);
  const shareLabel = document.createElement('span');
  shareLabel.className = 'feed-action-label';
  shareLabel.textContent = 'Compartilhar';
  share.append(shareLabel);
  share.dataset.feedShare = '';
  share.setAttribute('aria-label', 'Compartilhar publicação');
  actions.append(like, commentsButton, share);

  const comments = document.createElement('section');
  comments.className = 'feed-comments';
  comments.hidden = true;
  comments.id = `comentarios-${post.id}`;
  commentsButton.setAttribute('aria-controls', comments.id);
  comments.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      comments.hidden = true;
      commentsButton.setAttribute('aria-expanded', 'false');
      commentsButton.focus({ preventScroll: true });
    }
  });
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
  commentInput.placeholder = 'Escreva um comentário…';
  commentInput.setAttribute('aria-label', 'Escreva um comentário');
  commentInput.required = true;
  const commentSubmit = document.createElement('button');
  commentSubmit.className = 'btn btn-sm';
  commentSubmit.type = 'submit';
  commentSubmit.disabled = true;
  commentSubmit.textContent = 'Comentar';
  const formAvatar = avatarEl(NP.currentUser() || {}, 32);
  commentForm.append(formAvatar, commentInput, commentSubmit);
  comments.append(commentList, commentMore, commentStatus, commentForm);
  main.append(actions, comments);
  item.append(avatarLink, main);

  commentInput.addEventListener('input', () => {
    commentSubmit.disabled = !commentInput.value.trim();
    autosizeField(commentInput, 160);
  });
  commentInput.addEventListener('keydown', event => {
    if (!event.isComposing && (event.ctrlKey || event.metaKey) && event.key === 'Enter') commentForm.requestSubmit();
  });

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
  let ownAvatarLoaded = false;
  commentsButton.addEventListener('click', async () => {
    const open = comments.hidden;
    comments.hidden = !open;
    commentsButton.setAttribute('aria-expanded', String(open));
    if (open) commentInput.focus({ preventScroll: true });
    if (open && !ownAvatarLoaded) {
      ownAvatarLoaded = true;
      loadOwnProfile().then(own => { if (own) formAvatar.replaceWith(avatarEl(own, 32)); });
    }
    if (open && !commentsLoaded) await loadComments(true);
  });
  commentMore.addEventListener('click', () => loadComments());
  commentForm.addEventListener('submit', async event => {
    event.preventDefault();
    const texto = commentInput.value.trim();
    if (!texto || commentForm.dataset.busy) return;
    commentForm.dataset.busy = '1';
    commentSubmit.disabled = true;
    setBusy(commentSubmit, true);
    const response = await NP.api(`/publicacoes/${encodeURIComponent(post.id)}/comentarios`, {
      method: 'POST',
      body: { texto },
    });
    delete commentForm.dataset.busy;
    setBusy(commentSubmit, false);
    if (!response.ok || !response.data.comentario) {
      commentSubmit.disabled = false;
      commentStatus.textContent = response.data.mensagem || 'Não foi possível publicar o comentário.';
      return;
    }
    commentInput.value = '';
    commentInput.style.height = '';
    commentStatus.textContent = '';
    if (!commentsLoaded) await loadComments(true);
    else commentList.prepend(renderFeedComment(response.data.comentario));
    commentTotal += 1;
    paintComments();
  });

  let likeBusy = false;
  like.addEventListener('click', async () => {
    if (likeBusy) return;
    likeBusy = true;
    const wasLiked = like.getAttribute('aria-pressed') === 'true';
    const previous = likeCount;
    likeCount = Math.max(0, previous + (wasLiked ? -1 : 1));
    paintLike(!wasLiked); // atualização imediata; volta ao estado anterior se a API falhar
    if (!wasLiked) {
      like.classList.add('is-pop');
      like.addEventListener('animationend', () => like.classList.remove('is-pop'), { once: true });
    }
    const response = await NP.api(`/publicacoes/${encodeURIComponent(post.id)}/curtida`, {
      method: wasLiked ? 'DELETE' : 'PUT',
    });
    likeBusy = false;
    if (!response.ok || typeof response.data.curtida !== 'boolean') {
      likeCount = previous;
      paintLike(wasLiked);
      NP.toast(response.data.mensagem || 'Não foi possível atualizar a curtida.');
      return;
    }
    likeCount = Number(response.data.curtidas) || 0;
    paintLike(response.data.curtida);
  });
  share.addEventListener('click', () => {
    const url = new URL(`${NP.root()}paginas/inicio.html`, location.href);
    url.searchParams.set('publicacao', post.id);
    url.hash = item.id;
    shareSocialPost({ title: `Publicação de ${post.autor.nome_exibicao || post.autor.nome_usuario}`, text: post.texto, url: url.href });
  });
  return item;
}

function createFeedSkeleton() {
  const skeleton = document.createElement('div');
  skeleton.className = 'feed-loading';
  skeleton.setAttribute('aria-hidden', 'true');
  skeleton.innerHTML = `
    <article class="feed-skeleton-post">
      <div class="feed-skeleton-heading"><i></i><span><i></i><i></i></span></div>
      <i class="feed-skeleton-line"></i><i class="feed-skeleton-line short"></i>
      <div class="feed-skeleton-actions"><i></i><i></i></div>
    </article>
    <article class="feed-skeleton-post">
      <div class="feed-skeleton-heading"><i></i><span><i></i><i></i></span></div>
      <i class="feed-skeleton-line"></i><i class="feed-skeleton-line short"></i>
      <div class="feed-skeleton-actions"><i></i><i></i></div>
    </article>`;
  return skeleton;
}

function initFeed() {
  const list = $('#feed-list');
  if (!list || list.dataset.initialized === 'true') return;
  list.dataset.initialized = 'true';
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
        list.append(createFeedSkeleton());
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
        : 'Publique a primeira ideia da comunidade ou adicione amigos em Pessoas.';
      empty.append(title, message);
      if (!userId && input) {
        const write = document.createElement('button');
        write.type = 'button';
        write.className = 'btn-soft btn-sm';
        write.textContent = 'Escrever publicação';
        write.addEventListener('click', () => input.focus());
        empty.append(write);
      }
      list.append(empty);
    } else if (!reset && response.data.publicacoes.length === 0) {
      more.hidden = true;
    }
  };

  more.addEventListener('click', () => loadPage());
  if ('IntersectionObserver' in window) {
    // Carrega a próxima página ao chegar perto do fim; o botão continua como alternativa.
    new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting) && !more.hidden && !loading && more.textContent === 'Carregar mais publicações') loadPage();
    }, { rootMargin: '480px 0px' }).observe(more);
  }
  if (form) {
    const count = $('#feed-post-count');
    const submit = $('button[type="submit"]', form);
    const open = () => form.classList.add('is-open');
    const refresh = () => {
      const length = input.value.length;
      if (count) {
        count.textContent = `${length}/2000`;
        count.hidden = length < 1500;
        count.classList.toggle('is-near', length > 1800);
      }
      submit.disabled = !input.value.trim() || Boolean(submit.dataset.busy);
      autosizeField(input);
    };
    input.addEventListener('focus', open);
    input.addEventListener('input', () => { open(); refresh(); });
    input.addEventListener('keydown', event => {
      if (!event.isComposing && (event.ctrlKey || event.metaKey) && event.key === 'Enter') form.requestSubmit();
      if (event.key === 'Escape' && !input.value.trim()) input.blur();
    });
    form.addEventListener('focusout', event => {
      if (!input.value.trim() && !form.contains(event.relatedTarget)) form.classList.remove('is-open');
    });
    refresh();
    if (new URLSearchParams(location.search).get('novo') === '1') setTimeout(() => input.focus(), 150);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const texto = input.value.trim();
      if (!texto || submit.dataset.busy) return;
      submit.dataset.busy = '1';
      setBusy(submit, true);

      NP.status(formStatus, '', true);
      const response = await NP.api('/publicacoes', { method: 'POST', body: { texto } });
      delete submit.dataset.busy;

      setBusy(submit, false);
      if (!response.ok || !response.data.publicacao) {
        NP.status(formStatus, response.data.mensagem || 'Não foi possível publicar. Seu texto foi mantido.', false);
        return;
      }
      input.value = '';
      input.style.height = '';
      form.classList.remove('is-open');
      input.blur();
      refresh();
      NP.toast('Publicado.');
      list.querySelector('.feed-empty')?.remove();
      const fresh = renderFeedPost(response.data.publicacao);
      fresh.classList.add('is-new');
      list.prepend(fresh);
    });
  }
  loadPage(true);
}

function setProfileStat(container, label, value, detail, action) {
  const stat = document.createElement(action ? (action.href ? 'a' : 'button') : 'div');
  stat.className = action ? 'player-stat is-link' : 'player-stat';
  if (action?.href) stat.href = action.href;
  if (action && !action.href) {
    stat.type = 'button';
    stat.addEventListener('click', () => {
      if (document.getElementById(action.tab)?.hidden) return;
      profileTabs?.select(action.tab);
      $('#profile-tabs')?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }
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
  list.setAttribute('aria-busy', 'false');
  list.replaceChildren();
  if (!Array.isArray(profile.conquistas)) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
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
  const fromHash = location.hash.slice(1);
  profileTabs = initTabs(list, name => {
    try { history.replaceState(null, '', `#${name}`); } catch { /* ignora */ }
  });
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
  card.removeAttribute('data-profile-pending');
  card.setAttribute('aria-busy', 'false');
  $('[data-profile-name]', card).textContent = profile.nome_exibicao || profile.nome_usuario || 'Jogador';
  document.title = `${profile.nome_exibicao || profile.nome_usuario || 'Perfil'} | Nexa Quest`;
  $('[data-profile-handle]', card).textContent = `@${profile.nome_usuario || ''}`;
  const bio = $('[data-profile-bio]', card);
  bio.textContent = profile.biografia || '';
  bio.hidden = !profile.biografia;
  let skills = $('[data-profile-skills]', card);
  if (!skills) {
    skills = document.createElement('div'); skills.dataset.profileSkills = '';
    bio.after(skills);
  }
  skills.replaceChildren();
  if (!profile.privado) {
    if (profile.area) { const area = document.createElement('p'); area.className = 'profile-area'; area.textContent = profile.area; skills.append(area); }
    skills.append(skillList(profile));
    const url = safeHttpsUrl(profile.portfolio_url);
    if (url) {
      const link = document.createElement('a'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.className = 'profile-portfolio'; link.textContent = 'Abrir portfólio'; skills.append(link);
    }
  }
  const activity = $('#jornada');
  if (activity) {
    let summary = $('[data-profile-activity-summary]', activity);
    if (!summary) { summary = document.createElement('div'); summary.dataset.profileActivitySummary = ''; activity.prepend(summary); }
    const stats = $('[data-profile-stats]') || $('[data-profile-stats]', summary);
    const journey = $('[data-profile-journey]') || $('[data-profile-journey]', summary);
    if (stats) summary.append(stats);
    if (journey) summary.append(journey);
  }
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
  $('[data-profile-avatar]', card)?.setAttribute('data-tone', avatarTone(profile));
  if (initial) {
    initial.textContent = (profile.nome_exibicao || profile.nome_usuario || '?').charAt(0).toUpperCase();
    initial.hidden = false;
  }
  if (avatar && initial) {
    avatar.onload = () => {
      avatar.hidden = false;
      initial.hidden = true;
    };
    avatar.onerror = () => {
      avatar.hidden = true;
      initial.hidden = false;
    };
  }
  const stats = $('[data-profile-stats]');
  stats.replaceChildren();
  const values = profile.estatisticas;
  if (values) {
    if (values.amigos !== null) setProfileStat(stats, 'amigos', Number(values.amigos).toLocaleString('pt-BR'), null, ownProfile ? { href: `${NP.root()}paginas/amigos.html` } : null);
    if (values.conquistas !== null) setProfileStat(stats, 'conquistas', Number(values.conquistas).toLocaleString('pt-BR'), null, { tab: 'conquistas' });
    if (values.pontos !== null) setProfileStat(stats, 'pontos', Number(values.pontos).toLocaleString('pt-BR'), null, { tab: 'jornada' });
  }
  stats.hidden = !stats.childElementCount;

  const journey = $('[data-profile-journey]');
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
    progressSection.hidden = !progressData && !Object.values(values || {}).some(value => value !== null && value !== undefined);
    progress.replaceChildren();
    progress.setAttribute('aria-busy', 'false');
    if (progressData) renderProfileActivity(progress, progressData);
  }

  const projects = $('#projetos');
  if (projects) {
    projects.hidden = Boolean(profile.privado);
    if (!profile.privado) {
      carregarProjetosPerfil(profile);
    } else {
      const projectList = $('[data-profile-projects]', projects);
      projectList?.replaceChildren();
      projectList?.setAttribute('aria-busy', 'false');
      $('[data-profile-projects-status]', projects).textContent = '';
    }
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

function renderProfilePreview(user) {
  const card = $('#perfil');
  if (!card || !user) return;
  card.removeAttribute('data-profile-pending');
  const name = user.nome_exibicao || user.nome_usuario || 'Jogador';
  $('[data-profile-name]', card).textContent = name;
  $('[data-profile-handle]', card).textContent = `@${user.nome_usuario || ''}`;
  const initial = $('[data-avatar-initial]', card);
  $('[data-profile-avatar]', card)?.setAttribute('data-tone', avatarTone(user));
  if (initial) {
    initial.textContent = name.charAt(0).toUpperCase();
    initial.hidden = false;
  }
  const stats = $('[data-profile-stats]');
  if (stats && user.pontos !== null && user.pontos !== undefined) {
    stats.replaceChildren();
    setProfileStat(stats, 'pontos', Number(user.pontos).toLocaleString('pt-BR'));
  }
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
    if (state === 'amigos' && !(await confirmSocialAction('Deseja remover esta amizade? Você poderá enviar uma nova solicitação depois.'))) return;
    button.disabled = true;
    const response = await NP.api(`/usuarios/${encodeURIComponent(profile.id)}/amizade`, { method: action.method });
    if (!response.ok) {
      button.disabled = false;
      NP.status(status, response.data.mensagem || 'Não foi possível atualizar a amizade.', false);
      return;
    }
    publicProfilePromise = null;
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
  form.elements.namedItem('area').value = profile.area || '';
  form.elements.namedItem('habilidades').value = (profile.habilidades || []).join(', ');
  form.elements.namedItem('portfolio_url').value = profile.portfolio_url || '';
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
  prepareSocialForm(form);
  preencherEditor(profile);
  const setOpen = open => {
    editor.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) { editor.scrollIntoView({ block: 'start' }); form.elements.namedItem('nome_exibicao').focus({ preventScroll: true }); }
    else toggle.focus({ preventScroll: true });
  };
  toggle.onclick = () => setOpen(editor.hidden);
  if (close) close.onclick = () => setOpen(false);
  editor.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); } });
  form.onsubmit = async event => {
    event.preventDefault();
    if (form.dataset.busy || !validateSocialForm(form)) return;
    form.dataset.busy = '1';
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
      area: form.elements.namedItem('area').value || null,
      habilidades: form.elements.namedItem('habilidades').value.split(',').map(s => s.trim()).filter(Boolean),
      portfolio_url: form.elements.namedItem('portfolio_url').value || null,
      avatar_url: form.elements.namedItem('avatar_url').value || null,
      capa_url: form.elements.namedItem('capa_url').value || null,
      privacidade,
    };
    setBusy(submit, true);
    const response = await NP.api('/me/perfil', { method: 'PUT', body });
    delete form.dataset.busy;
    setBusy(submit, false);
    if (!response.ok || !response.data.usuario) {
      socialFormError(form, response, status);
      return;
    }
    profile = response.data.usuario;
    ownProfilePromise = Promise.resolve({ ok: true, status: response.status, data: { usuario: profile } });
    renderProfileData(profile, true);
    preencherEditor(profile);
    const currentUser = NP.currentUser();
    if (currentUser) currentUser.nome_usuario = profile.nome_usuario;
    const userButton = $('#user-btn');
    if (userButton) userButton.replaceChildren(avatarEl(profile, 34));
    NP.status(status, 'Perfil atualizado.', true);
  };
}

async function carregarPerfil(url, ownProfile, skipFeed = false, retry = false) {
  const card = $('#perfil') || $('#public-profile');
  const status = $('#profile-status') || $('#public-profile-status');
  if (retry) {
    card?.setAttribute('aria-busy', 'true');
    NP.status(status, 'Carregando perfil…', true);
  }
  const publicId = ownProfile ? null : new URLSearchParams(location.search).get('id');
  const response = ownProfile
    ? await loadOwnProfileResponse(retry)
    : await loadPublicProfileResponse(publicId, retry);
  if (!response.ok || !response.data.usuario) {
    card?.setAttribute('aria-busy', 'false');
    card?.removeAttribute('data-profile-pending');
    if (!ownProfile) {
      $('[data-profile-name]', card).textContent = 'Perfil indisponível';
      $('[data-profile-handle]', card).textContent = '';
      const initial = $('[data-avatar-initial]', card);
      if (initial) initial.textContent = '!';
    }
    $('#conquistas')?.setAttribute('hidden', '');
    $('#jornada')?.setAttribute('hidden', '');
    const achievementList = $('[data-profile-achievements]');
    achievementList?.replaceChildren();
    achievementList?.setAttribute('aria-busy', 'false');
    const progressList = $('[data-profile-progress]');
    progressList?.replaceChildren();
    progressList?.setAttribute('aria-busy', 'false');
    statusWithRetry(
      status,
      response.data.mensagem || 'Não foi possível carregar este perfil.',
      () => carregarPerfil(url, ownProfile, skipFeed, true),
    );
    syncProfileTabs();
    return null;
  }
  const profile = response.data.usuario;
  if (status) status.textContent = '';
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
    const card = $('#public-profile');
    card?.setAttribute('aria-busy', 'false');
    card?.removeAttribute('data-profile-pending');
    $('[data-profile-name]', card).textContent = 'Perfil indisponível';
    const initial = $('[data-avatar-initial]', card);
    if (initial) initial.textContent = '!';
    $('#conquistas')?.setAttribute('hidden', '');
    $('#jornada')?.setAttribute('hidden', '');
    renderProfileAchievements({ conquistas: null });
    const progressList = $('[data-profile-progress]');
    progressList?.replaceChildren();
    progressList?.setAttribute('aria-busy', 'false');
    return;
  }
  document.body.dataset.feedUserId = id;
  initFeed();
  carregarProjetosPerfil({ id });
  await carregarPerfil(`/usuarios/${encodeURIComponent(id)}/perfil`, false, skipFeed);
}

async function initProfile() {
  if (!$('#perfil')) return;
  if (!NP.currentUser()) return void (location.href = 'login.html');
  setupProfileTabs();
  const user = NP.currentUser();
  renderProfilePreview(user);
  document.body.dataset.feedUserId = String(user.id);
  initFeed();
  carregarProjetosPerfil(user);
  await carregarPerfil('/me/perfil', true, true);
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

async function initGameStats(retry = false) {
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
  const response = ownProfile ? await loadOwnProfileResponse(retry) : await NP.api(endpoint);
  if (!response.ok || !response.data.usuario) {
    page?.setAttribute('aria-busy', 'false');
    return statusWithRetry(
      status,
      response.data.mensagem || 'Não foi possível carregar as estatísticas.',
      () => initGameStats(true),
    );
  }
  renderGameStats(response.data.usuario, ownProfile);
  page?.setAttribute('aria-busy', 'false');
  NP.status(status, '', true);
}

const PROJECT_CATEGORIES = [...NQ_AREAS, ...NQ_LEGACY_CATEGORIES];

function projectLink(project) {
  return `${NP.root()}paginas/projeto.html?id=${encodeURIComponent(project.id)}`;
}

function renderProjectSkeleton(list) {
  list.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    const card = document.createElement('article');
    card.className = 'project-card project-card-skeleton';
    card.setAttribute('aria-hidden', 'true');
    card.innerHTML = '<div class="project-skeleton-cover"></div><div class="project-card-body"><i class="project-skeleton-line short"></i><i class="project-skeleton-line"></i><i class="project-skeleton-line"></i><i class="project-skeleton-line owner"></i></div>';
    list.append(card);
  }
}

function carregarProjetosPerfil(profile, retry = false) {
  const list = $('[data-profile-projects]');
  const status = $('[data-profile-projects-status]');
  if (!list || (!retry && list.dataset.profileId === String(profile.id))) return;
  list.dataset.profileId = String(profile.id);
  list.setAttribute('aria-busy', 'true');
  NP.status(status, 'Carregando projetos públicos…', true);
  renderProjectSkeleton(list);
  NP.api(`/projetos?limite=6&usuario=${encodeURIComponent(profile.id)}`).then(response => {
    if (list.dataset.profileId !== String(profile.id)) return;
    list.setAttribute('aria-busy', 'false');
    if (!response.ok || !Array.isArray(response.data.projetos)) {
      list.replaceChildren();
      statusWithRetry(
        status,
        response.data.mensagem || 'Não foi possível carregar os projetos.',
        () => carregarProjetosPerfil(profile, true),
      );
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
  const imageUrl = safeHttpsUrl(project.imagem_url);
  if (imageUrl) {
    const cover = document.createElement('a');
    cover.className = 'project-card-cover';
    cover.href = projectLink(project);
    cover.tabIndex = -1;
    cover.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    image.src = imageUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => { cover.remove(); card.classList.add('is-textual'); };
    cover.append(image);
    card.append(cover);
  } else {
    card.classList.add('is-textual');
  }
  const body = document.createElement('div');
  body.className = 'project-card-body';
  const tags = document.createElement('div');
  tags.className = 'project-card-tags';
  [project.categoria, project.visibilidade === 'privado' ? 'Privado' : null, project.tipo === 'equipe' ? 'Equipe' : 'Individual']
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
  description.textContent = projectSummary(project);
  const owner = document.createElement('div');
  owner.className = 'project-card-owner';
  const ownerLink = makeProfileAnchor(project.proprietario || {}, 'project-owner-link');
  ownerLink.prepend(avatarEl(project.proprietario || {}, 22));
  owner.append(ownerLink);
  const meta = document.createElement('span');
  const members = Number(project.total_participantes) || 0;
  meta.textContent = project.tipo === 'individual' ? 'Individual' : `${members} ${members === 1 ? 'integrante' : 'integrantes'}`;
  owner.append(meta);
  body.append(tags, title, description);
  if (project.tipo === 'equipe' && project.visibilidade === 'publico') {
    const availability = document.createElement('p');
    availability.className = 'nq-availability';
    availability.textContent = 'Aceita solicitações de participação';
    body.append(availability);
  }
  body.append(owner);
  card.append(body);

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
  const self = String(userId) === String(NP.currentUser().id);
  const pending = self && project.participacao?.status === 'pendente';
  const message = pending ? 'Cancelar sua solicitação de participação neste projeto?' : self ? 'Sair desta equipe? O acesso a projetos privados será encerrado.' : 'Remover esta pessoa do projeto? O acesso dela a projetos privados será encerrado.';
  if (!(await confirmSocialAction(message))) return;
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
  if (user.area) {
    const area = document.createElement('p');
    area.className = 'friend-area'; area.textContent = user.area; card.append(area);
  }
  card.append(skillList(user, 2));
  const work = document.createElement('div');
  work.className = 'friend-work-links';
  const profile = document.createElement('a'); profile.href = profileHref(user); profile.textContent = 'Ver perfil';
  const projects = document.createElement('a'); projects.href = `${NP.root()}paginas/perfil-publico.html?id=${encodeURIComponent(user.id)}#projetos`; projects.textContent = 'Ver projetos';
  work.append(profile, projects); card.append(work);

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
    const state = document.createElement('span');
    state.className = 'friend-relation-state';
    state.textContent = 'Solicitação recebida';
    actions.append(state);
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
  if (action === 'remover' && !(await confirmSocialAction(`Deseja remover ${user.nome_exibicao || user.nome_usuario} dos seus amigos?`))) return;
  friendActionInProgress = true;
  const status = $('#friends-page-status');
  const method = action === 'enviar' ? 'POST' : action === 'aceitar' ? 'PUT' : 'DELETE';
  const response = await NP.api(`/usuarios/${encodeURIComponent(user.id)}/amizade`, { method });
  friendActionInProgress = false;
  if (!response.ok) {
    NP.toast(response.data.mensagem || 'Não foi possível atualizar esta amizade.');
    return;
  }
  NP.toast({
    enviar: 'Solicitação enviada.',
    aceitar: 'Solicitação aceita. Vocês agora são amigos.',
    recusar: 'Solicitação recusada.',
    cancelar: 'Solicitação cancelada.',
    remover: 'Amizade removida.',
  }[action]);
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
  setFriendsBadge(received.length);
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

let friendSearchController = null;
let friendSearchId = 0;
async function pesquisarAmigos(term) {
  const value = term.trim().replace(/^@/, '');
  friendSearchController?.abort();
  const id = ++friendSearchId;
  const area = $('#friends-area')?.value || '';
  const params = new URLSearchParams({ q: value });
  if (area) params.set('area', area);
  const route = new URL(location.href); route.search = params.toString(); history.replaceState(null, '', route);
  const results = $('#friend-search-results');
  const status = $('#friends-search-status');
  friendSearchHasResults = value.length >= 2 || !!area;
  results.hidden = !friendSearchHasResults;
  const searchBlock = $('#friends-search-block');
  if (searchBlock) searchBlock.hidden = !friendSearchHasResults;
  if (!friendSearchHasResults) {
    status.textContent = value ? 'Digite pelo menos 2 caracteres ou escolha uma área.' : '';
    $$('.pf-panel').forEach(panel => panel.hidden = false);
    $('#friends-tabs').hidden = false;
    return;
  }
  results.setAttribute('aria-busy', 'true');
  status.textContent = 'Pesquisando pessoas…';
  // A7: só a pesquisa mais recente pode escrever na tela; as anteriores são canceladas
  $('#friends-tabs').hidden = true;
  $$('.pf-panel').forEach(panel => panel.hidden = true);
  friendSearchController = new AbortController();
  const response = await NP.api(`/usuarios/buscar?${params}`, { signal: friendSearchController.signal });
  if (id !== friendSearchId) return;
  results.setAttribute('aria-busy', 'false');
  if (!response.ok || !Array.isArray(response.data.usuarios)) {
    results.replaceChildren();
    status.textContent = response.data.mensagem || 'Não foi possível pesquisar usuários. Tente novamente.';
    return;
  }
  renderFriendList(results, response.data.usuarios, 'Nenhuma pessoa encontrada. Tente outra habilidade, ajuste a área ou limpe os filtros.');
  status.textContent = `${response.data.usuarios.length} ${response.data.usuarios.length === 1 ? 'pessoa encontrada' : 'pessoas encontradas'}.`;
}

function initFriendsPage() {
  const form = $('#friends-search-form');
  if (!form) return;
  if (!NP.currentUser()) return void (location.href = 'login.html');
  friendsTabs = initTabs($('#friends-tabs'));
  form.addEventListener('submit', event => {
    event.preventDefault();
    clearTimeout(timer);
    pesquisarAmigos($('#friends-search-input').value);
  });
  const input = $('#friends-search-input');
  const area = $('#friends-area');
  const clear = $('#friends-clear');
  form.noValidate = true;
  area.innerHTML = `<option value="">Todas as áreas</option>${areaOptions()}`;
  const params = new URLSearchParams(location.search);
  const initialQuery = params.get('q') || params.get('busca') || '';
  input.value = initialQuery;
  area.value = params.get('area') || '';
  let timer;
  input.addEventListener('input', event => {
    clearTimeout(timer);
    friendSearchController?.abort(); ++friendSearchId;
    if (event.isComposing) return;
    timer = setTimeout(() => pesquisarAmigos(input.value), 300);
  });
  input.addEventListener('compositionend', () => input.dispatchEvent(new Event('input')));
  area.addEventListener('change', () => { clearTimeout(timer); pesquisarAmigos(input.value); });
  clear.addEventListener('click', () => {
    clearTimeout(timer); input.value = ''; area.value = '';
    $$('.pf-panel').forEach(panel => panel.hidden = false);
    pesquisarAmigos(''); input.focus();
  });
  if (initialQuery || area.value) pesquisarAmigos(initialQuery);
  carregarPainelAmizades();
  carregarSugestoesAmizade();
}

function initProjectExplorer() {
  const list = $('#project-list');
  if (!list) return;
  const form = $('#project-search-form');
  const initial = new URLSearchParams(location.search);
  $('#project-search').value = initial.get('q') || '';
  $('#project-category').value = PROJECT_CATEGORIES.includes(initial.get('categoria')) ? initial.get('categoria') : '';
  const more = $('#projects-load-more');
  const status = $('#projects-status');
  let cursor = null;
  let controller = null;
  let requestId = 0;
  const retryButton = () => {
    const wrap = document.createElement('div');
    wrap.className = 'project-empty';
    const text = document.createElement('p');
    text.textContent = 'Não foi possível carregar os projetos agora.';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-soft';
    retry.textContent = 'Tentar novamente';
    retry.addEventListener('click', () => load(true));
    wrap.append(text, retry);
    return wrap;
  };
  /* A6: cada consulta nova cancela a anterior e só a mais recente atualiza a tela. A categoria e a busca
     são lidas no momento da chamada e guardadas junto com o pedido, então resultado e filtro nunca divergem. */
  const load = async (reset = false) => {
    if (!reset && controller) return; // "Carregar mais" não empilha pedidos
    controller?.abort();
    const id = ++requestId;
    controller = new AbortController();
    const query = new URLSearchParams({ limite: '12' });
    const busca = $('#project-search')?.value.trim() || '';
    const categoria = $('#project-category')?.value || '';
    const proprietarioId = new URLSearchParams(location.search).get('usuario');
    if (busca) query.set('q', busca);
    if (categoria) query.set('categoria', categoria);
    if (proprietarioId) query.set('usuario', proprietarioId);
    const stateQuery = new URLSearchParams(query); stateQuery.delete('limite');
    history.replaceState(null, '', `${location.pathname}${stateQuery.size ? '?' + stateQuery : ''}`);
    if (reset) { cursor = null; list.replaceChildren(); more.hidden = true; }
    if (cursor) query.set('cursor', cursor);
    list.setAttribute('aria-busy', 'true');
    more.disabled = true;
    status.textContent = reset ? 'Carregando projetos…' : 'Carregando mais projetos…';
    const response = await NP.api(`/projetos?${query}`, { signal: controller.signal });
    if (id !== requestId) return; // resposta antiga: descartada
    controller = null;
    list.setAttribute('aria-busy', 'false');
    more.disabled = false;
    if (!response.ok || !Array.isArray(response.data.projetos)) {
      status.textContent = response.data.mensagem || 'Não foi possível carregar os projetos.';
      if (reset) list.replaceChildren(retryButton());
      return;
    }
    response.data.projetos.forEach(project => list.append(projectCard(project)));
    cursor = response.data.proximoCursor || null;
    more.hidden = !cursor;
    status.textContent = '';
    if (response.data.projetos.length || !reset) return;
    if (busca || categoria) {
      const partes = [categoria && `na categoria ${categoria}`, busca && `para “${busca}”`].filter(Boolean).join(' ');
      list.append(projectEmpty('Nenhum projeto encontrado', `Não há projetos públicos ${partes}. Tente outro termo ou outra categoria.`));
    } else {
      list.append(projectEmpty('Ainda não há projetos públicos.', 'Quando a comunidade publicar projetos, eles aparecerão aqui.', 'Criar um projeto', `${NP.root()}paginas/criar-projeto.html`));
    }
  };
  form?.addEventListener('submit', event => { event.preventDefault(); load(true); });
  const chips = $$('#project-chips .chip');
  chips.forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.cat === $('#project-category').value)));
  if ($('#project-category').value && NQ_LEGACY_CATEGORIES.includes($('#project-category').value)) $('#legacy-project-categories').open = true;
  chips.forEach(chip => chip.addEventListener('click', () => {
    chips.forEach(other => other.setAttribute('aria-pressed', String(other === chip)));
    $('#project-category').value = chip.dataset.cat;
    load(true);
  }));
  $('#project-search-clear')?.addEventListener('click', () => { $('#project-search').value = ''; load(true); $('#project-search').focus(); });
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

function projectCreateOrigin() {
  try {
    const from = new URL(document.referrer);
    const allowed = /\/paginas\/(explorar-projetos|meus-projetos|meu-perfil|inicio)\.html$/;
    if (from.origin === location.origin && allowed.test(from.pathname)) return from.pathname + from.search + from.hash;
  } catch { /* Direct entry returns to projects. */ }
  return `${NP.root()}paginas/explorar-projetos.html`;
}

function initCreateProject() {
  const form = $('#project-form');
  if (!form) return;
  projectFormFields(form, null, false);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (form.dataset.busy || !validateSocialForm(form)) return;
    form.dataset.busy = '1';
    const fields = new FormData(form);
    const body = Object.fromEntries(fields.entries());
    const status = $('#project-form-status');
    const button = $('button[type="submit"]', form);
    setBusy(button, true);
    NP.status(status, 'Publicando projeto…', true);
    const response = await NP.api('/projetos', { method: 'POST', body });
    delete form.dataset.busy;
    setBusy(button, false);
    if (!response.ok || !response.data.projeto) {
      socialFormError(form, response, status);
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
  const categories = NQ_AREAS.map(category => `<option>${category}</option>`).join('')
    + `<optgroup label="Categorias anteriores">${NQ_LEGACY_CATEGORIES.map(category => `<option>${category}</option>`).join('')}</optgroup>`;
  form.innerHTML = `
    <fieldset class="form-group">
      <legend>Sobre o projeto</legend>
      <label>Título<input name="titulo" type="text" maxlength="120" required></label>
      <label>Descrição<textarea name="descricao" rows="5" maxlength="5000" required placeholder="O que o projeto faz? Para quem ele é?"></textarea><small>Até 5.000 caracteres.</small></label>
      <label>Resumo (opcional)<textarea name="resumo" rows="2" maxlength="240" placeholder="Apresente a ideia em uma ou duas frases completas."></textarea><small>Até 240 caracteres. Aparece nos cartões e nos projetos recentes.</small></label>
      <label>Como contribuir (opcional)<textarea name="como_contribuir" rows="3" maxlength="1500" placeholder="Que ajuda você procura? Quais habilidades e tarefas são necessárias?"></textarea><small>Em equipes públicas, estas informações aparecem perto da solicitação de participação.</small></label>
    </fieldset>
    <fieldset class="form-group">
      <legend>Organização</legend>
      <div class="project-form-row">
        <label>Categoria<select name="categoria" required><option value="">Selecione</option>${categories}</select></label>
        <label>Formato<select name="tipo" required><option value="individual">Individual</option><option value="equipe">Projeto em equipe</option></select></label>
      </div>
      <div class="project-form-row">
        <label>Etapa (opcional)<select name="etapa"><option value="">Não informada</option>${NQ_STAGES.map(stage => `<option>${stage}</option>`).join('')}</select></label>
        <label>Visibilidade<select name="visibilidade" required><option value="publico">Público</option><option value="privado">Privado</option></select><small data-visibility-help></small></label>
      </div>
    </fieldset>
    <fieldset class="form-group">
      <legend>Divulgação <span class="form-optional">opcional</span></legend>
      <div class="project-form-row">
        <label>Imagem · URL HTTPS<input name="imagem_url" type="url" inputmode="url" placeholder="https://…"></label>
        <label>Link externo · URL HTTPS<input name="link_externo" type="url" inputmode="url" placeholder="https://…"></label>
      </div>
    </fieldset>
    <p id="${editing ? 'project-edit-status' : 'project-form-status'}" class="feed-status" data-project-edit-status role="status" aria-live="polite"></p>
    <div class="project-form-actions"><a class="btn-soft" data-project-form-cancel href="${editing ? '#project-detail' : projectCreateOrigin()}">Cancelar</a><button class="btn" type="submit">${editing ? 'Salvar alterações' : 'Publicar projeto'}</button></div>`;
  if (project) {
    for (const [name, value] of Object.entries(project)) {
      const field = form.elements.namedItem(name);
      if (field) field.value = value || '';
    }
  }
  prepareSocialForm(form);
  const visibility = form.elements.namedItem('visibilidade');
  const help = $('[data-visibility-help]', form);
  const describe = () => {
    help.textContent = visibility.value === 'publico'
      ? 'Qualquer pessoa com conta pode encontrar e acessar. Projetos em equipe aceitam solicitações de participação.'
      : 'Somente você e integrantes aceitos acessam o conteúdo. Convites mostram apenas informações básicas até serem aceitos.';
  };
  visibility.addEventListener('change', describe); describe();
  if (editing) $('[data-project-form-cancel]', form).onclick = event => {
    event.preventDefault(); $('#project-edit-panel').hidden = true;
    const toggle = $('[data-project-edit-toggle]'); toggle.setAttribute('aria-expanded', 'false'); toggle.focus();
  };

}

/* Convite para projeto privado: o servidor envia só o necessário para decidir (sem descrição, equipe ou
   atualizações). Aqui o usuário aceita ou recusa; ao aceitar, a página recarrega com a visão completa. */
function renderProjectInvite(project) {
  const root = $('#project-detail');
  root.setAttribute('aria-busy', 'false');
  $('[data-project-title]').textContent = project.titulo;
  document.title = `${project.titulo} | Nexa Quest`;
  $('[data-project-category]').textContent = project.categoria;
  $('[data-project-visibility]').textContent = 'Privado';
  $('[data-project-type]').textContent = project.tipo === 'equipe' ? 'Projeto em equipe' : 'Projeto individual';
  const owner = $('[data-project-owner]');
  owner.href = profileHref(project.proprietario);
  owner.textContent = project.proprietario?.nome_exibicao || `@${project.proprietario?.nome_usuario || 'jogador'}`;
  $('[data-project-description]').textContent = 'Este é um projeto privado. Aceite o convite para ver a descrição, a equipe e as atualizações.';
  $('[data-project-cover]').hidden = true;
  for (const selector of ['[data-project-external]', '[data-project-join]', '[data-project-cancel]', '[data-project-edit-toggle]', '#project-edit-panel', '.project-detail-grid']) {
    const element = $(selector);
    if (element) element.hidden = true;
  }
  const actions = $('.project-detail-actions');
  actions.querySelector('[data-project-invite-answer]')?.remove();
  const box = document.createElement('div');
  box.className = 'project-detail-invite';
  box.dataset.projectInviteAnswer = '';
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'btn';
  accept.textContent = 'Aceitar convite';
  const decline = document.createElement('button');
  decline.type = 'button';
  decline.className = 'btn-soft';
  decline.textContent = 'Recusar';
  const answer = async acao => {
    accept.disabled = decline.disabled = true;
    const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}/participantes/${encodeURIComponent(NP.currentUser().id)}`, { method: 'PUT', body: { acao } });
    if (!response.ok) {
      accept.disabled = decline.disabled = false;
      return NP.status($('#project-detail-status'), response.data.mensagem || 'Não foi possível responder ao convite.', false);
    }
    if (acao === 'aceitar') return carregarDetalheProjeto();
    location.href = 'meus-projetos.html';
  };
  accept.addEventListener('click', () => answer('aceitar'));
  decline.addEventListener('click', () => answer('recusar'));
  box.append(accept, decline);
  actions.append(box);
}

function renderProjectDetails(project) {
  if (project.acesso === 'convite') return renderProjectInvite(project);
  const root = $('#project-detail');
  root.setAttribute('aria-busy', 'false');
  $$('.project-join-hint').forEach(hint => hint.remove());
  root.querySelector('[data-project-invite-answer]')?.remove();
  for (const selector of ['.project-detail-grid']) { const element = $(selector); if (element) element.hidden = false; }
  $('[data-project-title]').textContent = project.titulo;
  document.title = `${project.titulo} | Nexa Quest`;
  $('[data-project-description]').textContent = project.descricao;
  const contribute = $('[data-project-contribution]');
  contribute.hidden = !project.como_contribuir;
  $('[data-project-contribution-text]').textContent = project.como_contribuir || '';
  const stage = $('[data-project-stage]');
  stage.hidden = !project.etapa; stage.textContent = project.etapa || '';
  const relation = $('[data-project-relation]');
  relation.textContent = project.sou_proprietario ? 'Você é responsável por este projeto.'
    : project.participacao?.status === 'aceito' ? 'Você participa desta equipe.'
    : project.participacao?.status === 'pendente' ? (project.participacao.origem === 'convite' ? 'Você recebeu um convite para esta equipe.' : 'Solicitação enviada. Aguarde a resposta do responsável.') : '';
  $('[data-project-category]').textContent = project.categoria;
  $('[data-project-visibility]').textContent = project.visibilidade === 'publico' ? 'Público' : 'Privado';
  $('[data-project-type]').textContent = project.tipo === 'equipe' ? 'Projeto em equipe' : 'Projeto individual';
  const owner = $('[data-project-owner]');
  owner.href = profileHref(project.proprietario);
  owner.textContent = project.proprietario?.nome_exibicao || `@${project.proprietario?.nome_usuario || 'jogador'}`;
  const image = $('[data-project-image]');
  setProfileImage(image, project.imagem_url);
  const detailCover = $('[data-project-cover]');
  if (detailCover) {
    detailCover.hidden = !safeHttpsUrl(project.imagem_url);
    image.addEventListener('error', () => { detailCover.hidden = true; }, { once: true });
  }
  $('[data-project-external]').hidden = !safeHttpsUrl(project.link_externo);
  if (safeHttpsUrl(project.link_externo)) $('[data-project-external]').href = safeHttpsUrl(project.link_externo);

  const join = $('[data-project-join]');
  const cancel = $('[data-project-cancel]');
  const state = project.participacao?.status;
  // A11: depois de uma recusa é possível pedir de novo; o servidor define quando (intervalo mínimo)
  const reopensAt = state === 'recusado' && project.participacao?.disponivel_em ? new Date(project.participacao.disponivel_em) : null;
  const waiting = reopensAt && reopensAt.getTime() > Date.now();
  const canRequest = !project.sou_proprietario && project.tipo === 'equipe' && project.visibilidade === 'publico' && (!state || state === 'recusado');
  join.hidden = !canRequest;
  join.disabled = !!waiting;
  if (canRequest && state === 'recusado') {
    const hint = document.createElement('p');
    hint.className = 'feed-status project-join-hint';
    hint.textContent = waiting
      ? `Sua última solicitação foi recusada. Você poderá pedir novamente em ${reopensAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}.`
      : 'Sua última solicitação foi recusada. Você pode enviar uma nova.';
    join.closest('.project-detail-actions').after(hint);
  }
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
  if (!project.sou_proprietario && state === 'pendente' && project.participacao.origem === 'convite') {
    const actions = document.createElement('div'); actions.dataset.projectInviteAnswer = ''; actions.className = 'project-detail-invite';
    ['aceitar', 'recusar'].forEach(action => {
      const button = document.createElement('button'); button.type = 'button'; button.className = action === 'aceitar' ? 'btn' : 'btn-soft';
      button.textContent = action === 'aceitar' ? 'Aceitar convite' : 'Recusar convite';
      button.onclick = async () => {
        actions.querySelectorAll('button').forEach(b => b.disabled = true);
        const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}/participantes/${NP.currentUser().id}`, { method: 'PUT', body: { acao: action } });
        if (!response.ok) { actions.querySelectorAll('button').forEach(b => b.disabled = false); return NP.status($('#project-detail-status'), response.data.mensagem, false); }
        await carregarDetalheProjeto();
      };
      actions.append(button);
    });
    join.closest('.project-detail-actions').append(actions);
  }


  const editToggle = $('[data-project-edit-toggle]');
  const editPanel = $('#project-edit-panel');
  editToggle.hidden = !project.sou_proprietario;
  editToggle.onclick = () => {
    const open = editPanel.hidden;
    editPanel.hidden = !open;
    editToggle.setAttribute('aria-expanded', String(open));
    if (open) { editPanel.scrollIntoView({ block: 'start' }); $('#project-edit-form [name=titulo]').focus({ preventScroll: true }); }
    else editToggle.focus({ preventScroll: true });
  };
  editPanel.onkeydown = event => { if (event.key === 'Escape') { editPanel.hidden = true; editToggle.setAttribute('aria-expanded', 'false'); editToggle.focus(); } };
  const editForm = $('#project-edit-form');
  if (project.sou_proprietario) {
    projectFormFields(editForm, project, true);
    editForm.onsubmit = async event => {
      event.preventDefault();
      if (editForm.dataset.busy || !validateSocialForm(editForm)) return;
      editForm.dataset.busy = '1';
      const body = Object.fromEntries(new FormData(editForm).entries());
      const submit = $('button[type="submit"]', editForm);
      setBusy(submit, true);
      const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}`, { method: 'PUT', body });
      delete editForm.dataset.busy;
      setBusy(submit, false);
      if (!response.ok) {
        return socialFormError(editForm, response, $('[data-project-edit-status]'));
      }
      await carregarDetalheProjeto();
      editPanel.hidden = true; editToggle.setAttribute('aria-expanded', 'false'); editToggle.focus();
      NP.status($('#project-detail-status'), 'Projeto atualizado.', true);
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
  prepareSocialForm(inviteForm);
  inviteForm.onsubmit = async event => {
    event.preventDefault();
    if (!validateSocialForm(inviteForm) || inviteForm.dataset.busy) return;
    inviteForm.dataset.busy = '1';
    const inviteSubmit = $('button[type=submit]', inviteForm); setBusy(inviteSubmit, true);
    const status = $('#project-invite-status');
    const input = inviteForm.elements.namedItem('nome_usuario');
    const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}/convites`, {
      method: 'POST',
      body: { nome_usuario: input.value },
    });
    delete inviteForm.dataset.busy; setBusy(inviteSubmit, false);
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
  prepareSocialForm(updateForm);
  updateForm.onsubmit = async event => {
    event.preventDefault();
    if (updateForm.dataset.busy || !validateSocialForm(updateForm)) return;
    updateForm.dataset.busy = '1';
    const input = updateForm.elements.namedItem('texto');
    const status = $('#project-update-status');
    const submit = $('button[type="submit"]', updateForm);
    setBusy(submit, true);
    NP.status(status, 'Publicando atualização…', true);
    const response = await NP.api(`/projetos/${encodeURIComponent(project.id)}/atualizacoes`, {
      method: 'POST',
      body: { texto: input.value },
    });
    delete updateForm.dataset.busy;
    setBusy(submit, false);
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

/* A16: o título provisório "Carregando projeto…" nunca fica na tela depois de uma falha. */
function renderProjectError(kind, message, retry) {
  const root = $('#project-detail');
  root.setAttribute('aria-busy', 'false');
  $('[data-project-title]').textContent = kind === 'indisponivel' ? 'Projeto indisponível' : 'Não foi possível carregar o projeto';
  for (const selector of ['[data-project-category]', '[data-project-visibility]', '[data-project-type]', '[data-project-cover]', '[data-project-external]', '[data-project-join]', '[data-project-cancel]', '[data-project-edit-toggle]', '#project-edit-panel', '.project-detail-grid']) {
    const element = $(selector);
    if (element) element.hidden = true;
  }
  $('[data-project-description]').textContent = message;
  const actions = $('.project-detail-actions');
  actions?.querySelector('[data-project-error-actions]')?.remove();
  const box = document.createElement('div');
  box.dataset.projectErrorActions = '';
  if (retry) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.textContent = 'Tentar novamente';
    button.addEventListener('click', retry);
    box.append(button);
  }
  const back = document.createElement('a');
  back.className = 'btn-soft';
  back.href = 'explorar-projetos.html';
  back.textContent = 'Ver projetos públicos';
  box.append(back);
  actions?.append(box);
}

async function carregarDetalheProjeto() {
  const id = new URLSearchParams(location.search).get('id');
  const root = $('#project-detail');
  const status = $('#project-detail-status');
  if (!id || !/^\d{1,18}$/.test(id) || BigInt(id) < 1n) {
    return renderProjectError('indisponivel', 'O endereço deste projeto não é válido. Volte à lista de projetos e abra-o novamente.');
  }
  root.setAttribute('aria-busy', 'true');
  $('[data-project-error-actions]')?.remove();
  const response = await NP.api(`/projetos/${encodeURIComponent(id)}`);
  if (!response.ok || !response.data.projeto) {
    if (response.status === 404) {
      return renderProjectError('indisponivel', 'Este projeto não existe, foi removido ou é privado e você não tem acesso a ele.');
    }
    return renderProjectError('erro', response.data.mensagem || 'Verifique sua conexão e tente novamente.', carregarDetalheProjeto);
  }
  for (const selector of ['[data-project-category]', '[data-project-visibility]', '[data-project-type]']) { const element = $(selector); if (element) element.hidden = false; }
  $('.project-join-hint')?.remove();
  status.textContent = '';
  renderProjectDetails(response.data.projeto);
}

function initProjectDetail() {
  if (!$('#project-detail')) return;
  if (!NP.currentUser()) return void (location.href = 'login.html');
  carregarDetalheProjeto();
}

/* Página do jogo: a URL de incorporação vem de GET /api/jogo (exige sessão válida no servidor)
   e só então o iframe é criado. O HTML estático não contém o endereço do jogo.

   Tela cheia (um único controle: o botão da plataforma):
   - nativa, pela Fullscreen API aplicada ao #game-stage (ancestral do iframe, que nunca é movido nem recarregado);
   - imersiva (position: fixed + rolagem travada), usada somente quando o navegador não oferece a API
     para elementos (iPhone/Safari). É o limite da plataforma: não há tela cheia real nesse caso.
   O iframe NÃO recebe a permissão "fullscreen": assim o botão nativo do itch.io não funciona dentro da
   plataforma e não compete com o botão do Nexa Quest. */
function initGame() {
  const stage = $('#game-stage');
  const box = $('#game-frame');
  const status = $('#game-status');
  const fullscreenButton = $('#game-fullscreen');
  const exitButton = $('#game-exit');
  const hint = $('#game-hint');
  if (!stage || !box || !status || !fullscreenButton || !exitButton || !hint) return;

  const root = document.documentElement;
  const label = $('span', fullscreenButton);
  const touchScreen = window.matchMedia('(pointer: coarse)');
  const portrait = window.matchMedia('(orientation: portrait)');
  const requestNative = stage.requestFullscreen || stage.webkitRequestFullscreen;
  const exitNative = document.exitFullscreen || document.webkitExitFullscreen;
  const nativeElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const nativeSupported = () => Boolean(requestNative && exitNative)
    && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled) !== false;

  let mode = 'off'; // 'off' | 'native' | 'immersive'
  let busy = false;
  let orientationLocked = false;
  let savedScroll = 0;
  let game = { largura: 1920, altura: 1080, modo: 'fluid' };

  function onMedia(query, handler) {
    if (query.addEventListener) query.addEventListener('change', handler);
    else if (query.addListener) query.addListener(handler); // Safari < 14
  }

  /* ---------- Layout ---------- */
  // Modo "scaled": o iframe mantém o tamanho fixo do itch.io e é reduzido para caber na caixa.
  function fitScaled() {
    const frame = box.querySelector('iframe');
    if (!frame || game.modo !== 'scaled') return;
    const scale = box.clientWidth / game.largura;
    if (scale > 0) frame.style.transform = `scale(${scale})`;
  }

  // O botão de saída fica numa faixa preta quando existe espaço (nunca cobre o jogo); sem faixas, vira uma aba
  // pequena e translúcida na borda superior.
  function placeExit() {
    if (exitButton.hidden) return;
    const stageRect = stage.getBoundingClientRect();
    const gameRect = box.getBoundingClientRect();
    const styles = getComputedStyle(stage);
    const insetTop = parseFloat(styles.paddingTop) || 0;
    const insetRight = parseFloat(styles.paddingRight) || 0;
    const roomAbove = gameRect.top - stageRect.top - insetTop;
    const roomBeside = stageRect.right - gameRect.right - insetRight;
    let slot = 'edge';
    if (roomAbove >= 44) {
      // faixa superior (ex.: notebook 16:10, celular na vertical): centraliza se for estreita
      slot = 'corner';
      exitButton.style.setProperty('--game-exit-top', `${insetTop + Math.min(8, Math.max(2, (roomAbove - 40) / 2))}px`);
    } else if (roomBeside >= 56) {
      // faixa lateral (ex.: celular 19.5:9, monitor ultrawide)
      slot = 'corner';
      exitButton.style.setProperty('--game-exit-top', `${insetTop + 8}px`);
    }
    exitButton.dataset.slot = slot;
  }

  function render() {
    const active = mode !== 'off';
    stage.classList.toggle('is-active', active);
    root.classList.toggle('game-immersive', mode === 'immersive');
    fullscreenButton.dataset.state = active ? 'on' : 'off';
    if (label) label.textContent = active ? 'Sair da tela cheia' : 'Tela cheia';
    exitButton.hidden = !active;
    // Só pede para girar quando o aparelho realmente continua na vertical (se o lock funcionou, já é horizontal).
    hint.hidden = !(active && touchScreen.matches && portrait.matches);
    placeExit();
    fitScaled();
  }

  /* ---------- Orientação ---------- */
  // Só celulares/tablets, e só em tela cheia nativa (o Chrome do Android exige isso). Safari/iPhone e Firefox
  // não permitem travar: nesses casos o aviso "Gire o celular" cobre a limitação.
  async function lockLandscape() {
    if (!touchScreen.matches || !screen.orientation || typeof screen.orientation.lock !== 'function') return;
    try {
      await screen.orientation.lock('landscape');
      orientationLocked = true;
    } catch {
      orientationLocked = false;
    }
    render();
  }

  function unlockOrientation() {
    if (!orientationLocked) return;
    orientationLocked = false;
    try { screen.orientation.unlock(); } catch { /* sem suporte */ }
  }

  /* ---------- Entrada e saída ---------- */
  function focusGame() {
    // O foco precisa ir para o jogo, senão o teclado continua no botão (agora escondido).
    box.querySelector('iframe')?.focus({ preventScroll: true });
  }

  function waitForNative(ms) {
    return new Promise(resolve => {
      const done = () => {
        clearTimeout(timer);
        document.removeEventListener('fullscreenchange', done);
        document.removeEventListener('webkitfullscreenchange', done);
        resolve();
      };
      const timer = setTimeout(done, ms);
      document.addEventListener('fullscreenchange', done);
      document.addEventListener('webkitfullscreenchange', done);
    });
  }

  async function enterNative() {
    const result = requestNative.call(stage, { navigationUI: 'hide' });
    if (result && typeof result.then === 'function') await result;
    else await waitForNative(800); // prefixo webkit (iPad) não devolve Promise
    if (nativeElement() !== stage) throw new Error('A tela cheia nativa não foi concedida.');
  }

  function enterImmersive() {
    savedScroll = window.scrollY;
    mode = 'immersive';
    render();
    // Foco no botão de saída (não no jogo): o ESC dentro do iframe, de outra origem, nunca chegaria à página.
    exitButton.focus({ preventScroll: true });
  }

  async function enter() {
    if (mode !== 'off' || busy) return;
    busy = true;
    try {
      if (nativeSupported()) {
        try {
          await enterNative(); // onNativeChange define o modo e trava a orientação
          return;
        } catch (error) {
          console.warn('NEXA QUEST: tela cheia nativa indisponível; usando o modo imersivo.', error);
        }
      }
      enterImmersive();
    } finally {
      busy = false;
    }
  }

  // Limpeza única, chamada por qualquer caminho de saída (botão, ESC, gesto do sistema, botão Voltar).
  function leave() {
    const wasImmersive = mode === 'immersive';
    mode = 'off';
    unlockOrientation();
    render();
    if (wasImmersive) window.scrollTo(0, savedScroll);
    fullscreenButton.focus({ preventScroll: true });
  }

  async function exit() {
    if (mode === 'off') return;
    if (nativeElement() === stage) {
      try { await exitNative.call(document); } catch { /* já saiu */ }
      if (mode === 'native' && nativeElement() !== stage) leave();
    } else {
      leave();
    }
  }

  function onNativeChange() {
    const inNative = nativeElement() === stage;
    if (inNative && mode === 'off') {
      mode = 'native';
      render();
      lockLandscape();
      focusGame();
      return;
    }
    if (!inNative && mode === 'native') return leave(); // saída por ESC, gesto ou Voltar
    render();
  }

  fullscreenButton.addEventListener('click', () => (mode === 'off' ? enter() : exit()));
  exitButton.addEventListener('click', exit);
  document.addEventListener('fullscreenchange', onNativeChange);
  document.addEventListener('webkitfullscreenchange', onNativeChange);
  document.addEventListener('keydown', event => {
    // Em tela cheia nativa o próprio navegador trata o ESC; no modo imersivo é a página que trata.
    if (event.key === 'Escape' && mode === 'immersive') exit();
  });
  window.addEventListener('pagehide', unlockOrientation);
  window.addEventListener('resize', () => { placeExit(); fitScaled(); });
  onMedia(touchScreen, render);
  onMedia(portrait, render);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => { placeExit(); fitScaled(); });
    observer.observe(stage);
    observer.observe(box);
  }

  /* ---------- Carregamento ---------- */
  function showError(message) {
    stage.setAttribute('aria-busy', 'false');
    status.hidden = false;
    status.textContent = '';
    status.append(message + ' ');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-soft btn-sm';
    retry.textContent = 'Tentar novamente';
    retry.addEventListener('click', () => { retry.remove(); loadGame(); });
    status.append(retry);
  }

  function isEmbedUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'itch.io' && url.pathname.startsWith('/embed-upload/');
    } catch { return false; }
  }

  function dimension(value, fallback) {
    return Number.isInteger(value) && value >= 320 && value <= 7680 ? value : fallback;
  }

  async function loadGame() {
    stage.setAttribute('aria-busy', 'true');
    status.hidden = false;
    status.textContent = 'Carregando o jogo…';
    const response = await NP.api('/jogo');
    if (response.status === 401) return; // NP.api já encaminha para o login
    if (!response.ok || !isEmbedUrl(response.data.url)) {
      return showError(response.ok ? 'O endereço do jogo é inválido.' : (response.data.mensagem || 'Não foi possível carregar o jogo.'));
    }
    game = {
      largura: dimension(response.data.largura, 1920),
      altura: dimension(response.data.altura, 1080),
      modo: response.data.modo === 'scaled' ? 'scaled' : 'fluid',
    };
    stage.style.setProperty('--game-ratio', (game.largura / game.altura).toFixed(4));
    box.classList.toggle('is-scaled', game.modo === 'scaled');
    box.querySelector('iframe')?.remove();
    const frame = document.createElement('iframe');
    frame.title = 'NEXA QUEST';
    // Sem "fullscreen" de propósito (ver o comentário no topo): a tela cheia é do botão da plataforma.
    frame.setAttribute('allow', 'autoplay; gamepad; clipboard-write');
    frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    frame.setAttribute('scrolling', 'no');
    if (game.modo === 'scaled') {
      frame.style.width = `${game.largura}px`;
      frame.style.height = `${game.altura}px`;
    }
    frame.addEventListener('load', () => {
      stage.setAttribute('aria-busy', 'false');
      status.hidden = true;
    }, { once: true });
    frame.src = response.data.url;
    box.prepend(frame);
    fitScaled();
    fullscreenButton.disabled = false;
  }

  loadGame();
}

function initPlaceholders() {
  $$('[data-soon]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); NP.toast(a.dataset.soon); }));
  $$('[data-logout]').forEach(b => b.addEventListener('click', () => NP.signOut()));
}

function initGameLinks() {
  $$('[data-game]').forEach(a => a.addEventListener('click', e => {
    if (NP.currentUser()) return; // segue o href real da página do jogo
    e.preventDefault();
    rememberGameDestination();
    location.href = NP.root() + 'paginas/login.html';
  }));
  $$('[data-back]').forEach(a => a.addEventListener('click', e => { if (history.length > 1 && document.referrer.startsWith(location.origin || 'null')) { e.preventDefault(); history.back(); } }));
}

document.addEventListener('DOMContentLoaded', async () => {
  const loader = window.NPLoader; // preloader: ausente se a página não o usar ou se ele falhar ao carregar
  const isProtected = !!document.body.dataset.protected;
  let keepLoader = false; // true quando a página vai navegar: o preloader fica até o navegador trocar de página
  try {
    initRegister();
    initLogin();
    initContact();
    // Páginas públicas não dependem da sessão para a 1ª renderização: o rodapé nasce no estado "visitante"
    // e é refeito se houver sessão. Assim a revelação não espera a API (que pode estar acordando no Render).
    if (!isProtected && !$('#form-login')) { renderFooter(); loader?.release('app'); }
    const user = await (NP._boot || NP.loadUser());
    NP._boot = null;
    if ($('#form-login') && user) {
      keepLoader = true;
      location.replace(postLoginUrl());
      return;
    }
    document.documentElement.style.visibility = '';
    dispatchEvent(new Event('sessionchecked'));
    if (isProtected && !user) {
      if (NP._sessionStatus === 401) {
        keepLoader = true;
        if (document.body.dataset.page === 'jogo') rememberGameDestination();
        location.replace(NP.root() + 'paginas/login.html');
      }
      else {
        const message = document.createElement('p');
        message.setAttribute('role', 'status');
        message.textContent = 'Não foi possível verificar sua sessão. ';
        const retry = document.createElement('button');
        retry.textContent = 'Tentar novamente';
        retry.addEventListener('click', () => location.reload());
        message.append(retry);
        document.querySelector('main').replaceChildren(message);
      }
      return;
    }
    renderHeader(); renderFooter();
    const page = document.body.dataset.page;
    if (page === 'jogo') initGame();
    else if (page === 'estatisticas-jogo') initGameStats();
    else if (page === 'amigos') initFriendsPage();
    else if ($('#project-detail')) initProjectDetail();
    else if (page === 'projeto-criar') initCreateProject();
    else if (page === 'projetos-explorar') initProjectExplorer();
    else if (page === 'meus-projetos') initMyProjects();
    else if ($('#public-profile')) initPublicProfile();
    else if ($('#perfil')) initProfile();
    else {
      initHome();
      initHomeProjects();
      initFeed();
    }
    initPlaceholders(); initGameLinks();
  } finally {
    if (!keepLoader) loader?.release('app'); // sempre libera, mesmo se algo acima lançar erro
  }
});
