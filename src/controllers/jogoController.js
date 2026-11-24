// Jogo NEXA QUEST (hospedado no itch.io e incorporado em /paginas/jogo.html).
// A URL de incorporação só é entregue a sessões autenticadas (rota protegida por middlewares/auth).
const URL_PADRAO = "https://itch.io/embed-upload/20479421?color=000000";
const LARGURA_PADRAO = 1920;
const ALTURA_PADRAO = 1080;

function urlDoJogo() {
  const bruta = (process.env.GAME_EMBED_URL || URL_PADRAO).trim();
  try {
    const url = new URL(bruta);
    if (url.protocol === "https:" && url.hostname === "itch.io" && url.pathname.startsWith("/embed-upload/")) {
      return url.toString();
    }
  } catch {
    // valor inválido: usa a URL padrão abaixo
  }
  return URL_PADRAO;
}

// Dimensão do jogo em pixels (proporção da caixa 16:9 e, no modo "scaled", tamanho lógico do iframe).
function dimensaoDoJogo(valor, padrao) {
  const texto = String(valor ?? "").trim();
  if (!/^\d{3,4}$/.test(texto)) return padrao; // só dígitos decimais: sem "1e3", hexadecimal, sinal ou decimais
  const numero = Number(texto);
  return numero >= 320 && numero <= 7680 ? numero : padrao;
}

// "fluid" (padrão): o iframe preenche a caixa 16:9 e o jogo se adapta ao espaço.
// "scaled": o iframe mantém largura x altura fixas (o tamanho configurado nas Embed options do itch.io)
// e é reduzido por CSS para caber na caixa. Use quando o itch.io embute o jogo com tamanho fixo
// e o conteúdo aparece cortado.
function modoDeExibicao() {
  return String(process.env.GAME_VIEWPORT_MODE || "").trim().toLowerCase() === "scaled" ? "scaled" : "fluid";
}

function dadosDoJogo(req, res) {
  return res.json({
    titulo: "NEXA QUEST",
    url: urlDoJogo(),
    largura: dimensaoDoJogo(process.env.GAME_WIDTH, LARGURA_PADRAO),
    altura: dimensaoDoJogo(process.env.GAME_HEIGHT, ALTURA_PADRAO),
    modo: modoDeExibicao(),
  });
}

module.exports = { dadosDoJogo, urlDoJogo, dimensaoDoJogo, modoDeExibicao };
