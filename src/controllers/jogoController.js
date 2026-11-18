// Jogo NEXA QUEST (hospedado no itch.io e incorporado em /paginas/jogo.html).
// A URL de incorporação só é entregue a sessões autenticadas (rota protegida por middlewares/auth).
const URL_PADRAO = "https://itch.io/embed-upload/20479421?color=000000";

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

function dadosDoJogo(req, res) {
  return res.json({
    titulo: "NEXA QUEST",
    url: urlDoJogo(),
    largura: 1920,
    altura: 1080,
  });
}

module.exports = { dadosDoJogo, urlDoJogo };
