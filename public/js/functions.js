/* Nexa Play — funções reutilizáveis (sem dependências) */
const API_BASE_URL = ''; // Same-origin /api on Render, localhost and the Vercel proxy.
const NP = {
  $: (s, r = document) => r.querySelector(s),
  $$: (s, r = document) => [...r.querySelectorAll(s)],
  root: () => document.body.dataset.root || '',
  read(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } },
  toast(msg) {
    NP.$('.toast')?.remove();
    const t = Object.assign(document.createElement('div'), { className: 'toast', textContent: msg });
    t.setAttribute('role', 'status'); document.body.append(t); setTimeout(() => t.remove(), 3800);
  },
  isEmail: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
  isPhone: v => /^\d{10,11}$/.test(v.replace(/\D/g, '')),
  normId: v => (NP.isEmail(v.trim()) ? v.trim().toLowerCase() : NP.isPhone(v) ? v.replace(/\D/g, '') : v.trim().toLowerCase()),
  parseDate(v) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim()); if (!m) return null;
    const [d, mo, y] = [+m[1], +m[2], +m[3]], dt = new Date(y, mo - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d && dt <= new Date() && y > 1900 ? dt : null;
  },
  toISODate: v => v.trim().split('/').reverse().join('-'), // dd/mm/aaaa -> aaaa-mm-dd
  maskDate(el) { el.addEventListener('input', () => { const n = el.value.replace(/\D/g, '').slice(0, 8); el.value = n.replace(/(\d{2})(\d)/, '$1/$2').replace(/(\d{2}\/\d{2})(\d)/, '$1/$2'); }); },
  setErr(input, msg) {
    const e = document.getElementById(input.id + '-err'); if (e) e.textContent = msg || '';
    input.setAttribute('aria-invalid', msg ? 'true' : 'false'); return !msg;
  },
  status(el, msg, ok) { if (el) { el.textContent = msg; el.className = 'status ' + (ok ? 'ok' : 'bad'); } },
  /* JWT enviado exclusivamente pelo cookie HttpOnly. */
  async api(path, { method = 'GET', body, legacyToken } = {}) {
    const headers = { 'X-Nexa-Request': '1' };
    if (legacyToken) headers.Authorization = 'Bearer ' + legacyToken;
    if (body) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const r = await fetch(`${API_BASE_URL}/api${path}`, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const response = await r.text();
      let data;
      try {
        data = response ? JSON.parse(response) : {};
      } catch {
        data = {
          mensagem: r.status === 404
            ? 'API não encontrada. Verifique a URL do serviço no Render.'
            : `Resposta inválida da API (HTTP ${r.status}).`,
        };
      }
      if (!data || typeof data !== 'object') data = {};
      if (!r.ok && !data.mensagem) data.mensagem = `Falha na API (HTTP ${r.status}).`;
      if (r.status === 401 && path !== '/login' && path !== '/auth/google' && path !== '/auth/session') {
        NP.clearLocalAuth();
        if (document.body.dataset.protected) location.replace(NP.root() + 'paginas/login.html');
      }
      return { ok: r.ok, status: r.status, data };
    } catch {
      return {
        ok: false,
        status: 0,
        data: {
          mensagem: controller.signal.aborted
            ? 'A solicitação demorou demais para responder. Tente novamente.'
            : 'Não foi possível conectar ao servidor. Tente novamente.',
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  },
  clearLocalAuth() {
    for (const storage of ['localStorage', 'sessionStorage']) {
      try { window[storage].removeItem('np_token'); } catch { /* storage may be disabled */ }
    }
    NP._user = null;
  },
  async login() {
    NP.clearLocalAuth();
    const user = await NP.loadUser();
    if (!user) throw new Error('Não foi possível confirmar a sessão. Verifique se os cookies estão habilitados e tente novamente.');
  },
  async logout() {
    const result = await NP.api('/logout', { method: 'POST' });
    if (!result.ok) throw new Error(result.data.mensagem || 'Não foi possível encerrar a sessão. Tente novamente.');
    NP.clearLocalAuth();
  },
  async signOut() {
    try {
      await NP.logout();
      location.replace(NP.root() + 'index.html');
    } catch (error) { NP.toast(error.message); }
  },
  async enterPlatform() {
    const user = await NP.loadUser();
    if (NP._sessionStatus !== 200 && NP._sessionStatus !== 401) {
      NP.toast('Não foi possível verificar sua sessão. Tente novamente.');
      return;
    }
    location.assign(NP.root() + 'paginas/' + (user ? 'inicio.html' : 'login.html'));
  },
  _user: null,
  _sessionStatus: null,
  _sessionRequest: null,
  async loadUser() {
    if (NP._sessionRequest) return NP._sessionRequest;
    NP._sessionRequest = (async () => {
      let legacyToken = null;
      let remember = false;
      try {
        legacyToken = localStorage.getItem('np_token');
        remember = !!legacyToken;
      } catch { /* storage may be disabled */ }
      if (!legacyToken) {
        try { legacyToken = sessionStorage.getItem('np_token'); } catch { /* storage may be disabled */ }
      }
      if (legacyToken) {
        const migration = await NP.api('/auth/session', { method: 'POST', legacyToken, body: { lembrar: remember } });
        if (migration.ok || migration.status === 401) NP.clearLocalAuth();
        else { NP._sessionStatus = migration.status; return null; }
      }
      const result = await NP.api('/me');
      NP._sessionStatus = result.status;
      NP._user = result.ok ? result.data : null;
      return NP._user;
    })();
    try { return await NP._sessionRequest; }
    finally { NP._sessionRequest = null; }
  },
  currentUser: () => NP._user,
  icon: {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
    pencil: '<svg width="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>'
  }
};

// Revalidate documents restored from the browser back/forward cache.
addEventListener('pageshow', async event => {
  if (!event.persisted || !document.body.dataset.protected) return;
  document.documentElement.style.visibility = 'hidden';
  const user = await NP.loadUser();
  if (user) location.reload();
  else if (NP._sessionStatus === 401) location.replace(NP.root() + 'paginas/login.html');
  else {
    document.body.replaceChildren();
    document.documentElement.style.visibility = '';
    NP.toast('Não foi possível verificar sua sessão. Atualize a página para tentar novamente.');
  }
});
