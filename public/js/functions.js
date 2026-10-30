/* Nexa Play — funções reutilizáveis (sem dependências) */
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
  /* API (backend Node/MySQL). O token JWT fica no localStorage ("lembrar de mim") ou no sessionStorage. */
  async api(path, { method = 'GET', body } = {}) {
    const headers = { 'Content-Type': 'application/json' }, t = NP.token();
    if (t) headers.Authorization = 'Bearer ' + t;
    try {
      const r = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, data };
    } catch { return { ok: false, status: 0, data: { mensagem: 'Não foi possível conectar ao servidor. Tente novamente.' } }; }
  },
  token() { try { return localStorage.getItem('np_token') || sessionStorage.getItem('np_token'); } catch { return null; } },
  login(token, remember) {
    NP.logout();
    try { (remember ? localStorage : sessionStorage).setItem('np_token', token); } catch { /* armazenamento bloqueado */ }
  },
  logout() { try { localStorage.removeItem('np_token'); sessionStorage.removeItem('np_token'); } catch { /* ignora */ } NP._user = null; },
  _user: null,
  /* Busca o usuário logado no servidor; chamado uma vez ao abrir cada página */
  async loadUser() {
    if (!NP.token()) return null;
    const r = await NP.api('/me');
    if (r.ok) NP._user = r.data;
    else if (r.status === 401) NP.logout(); // token inválido ou expirado
    return NP._user;
  },
  currentUser: () => NP._user,
  icon: {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>',
    pencil: '<svg width="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>'
  }
};
