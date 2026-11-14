/* Nexa Quest: capturas de tela da plataforma.
   Cada imagem fica escondida atrás de um espaço reservado. Quando o arquivo
   existe na pasta assets/imagens (rede-social-1.png, rede-social-2.png,
   rede-social-3.png e jogo.png), ele substitui o espaço reservado sozinho. */
(() => {
  document.querySelectorAll('.pic').forEach(frame => {
    const img = frame.querySelector('img');
    if (!img) return;
    const mostrar = () => { if (img.naturalWidth > 0) frame.classList.add('is-loaded'); };
    if (img.complete) mostrar();
    else img.addEventListener('load', mostrar, { once: true });
  });
})();
