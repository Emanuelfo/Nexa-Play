// Validações e normalizações (espelham as regras que o site já aplicava no navegador;
// agora o servidor também confere, pois o front-end pode ser burlado)

const ehEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const ehCelular = (v) => /^\d{10,11}$/.test(v.replace(/\D/g, ""));

// E-mail -> minúsculo | celular -> só dígitos
function normalizarContato(v) {
  v = String(v || "").trim();
  if (ehEmail(v)) return v.toLowerCase();
  if (ehCelular(v)) return v.replace(/\D/g, "");
  return null;
}

// Aceita AAAA-MM-DD, valida data real, no passado e depois de 1900
function dataValida(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ""));
  if (!m) return false;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d && dt <= new Date() && y > 1900;
}

module.exports = { ehEmail, ehCelular, normalizarContato, dataValida };
