/* Equipe do Nexa Quest (página Sobre).
   As fotos ficam em ../assets/imagens/. Se um arquivo não carregar, o quadro mostra
   a inicial do nome no lugar da imagem, mantendo o layout da seção. */
(() => {
  const mostrarInicial = img => {
    const quadro = img.parentElement;
    const nome = img.closest('.member')?.querySelector('h3')?.textContent.trim() || '';
    img.remove();
    quadro.textContent = nome.charAt(0).toUpperCase();
    quadro.setAttribute('aria-hidden', 'true');
  };

  document.querySelectorAll('.member-photo img').forEach(img => {
    if (img.complete && img.naturalWidth === 0) mostrarInicial(img);
    else img.addEventListener('error', () => mostrarInicial(img), { once: true });
  });
})();
