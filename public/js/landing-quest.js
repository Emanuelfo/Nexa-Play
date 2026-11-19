/* A local, explicitly labelled product demo. No requests, account writes or storage. */
(() => {
  const form = document.querySelector('#landing-project-form');
  if (!form) return;

  const title = form.querySelector('#idea-title');
  const description = form.querySelector('#idea-description');
  const tags = form.querySelector('#idea-tags');
  const previewTitle = document.querySelector('#preview-title');
  const previewDescription = document.querySelector('#preview-description');
  const previewTags = document.querySelector('#preview-tags');
  const preview = document.querySelector('.nq-preview');
  const state = document.querySelector('#idea-state');
  const status = document.querySelector('#idea-status');
  const error = form.querySelector('#idea-title-error');
  const publish = form.querySelector('#idea-publish');
  const count = form.querySelector('#idea-count');
  let published = false;

  const clearError = () => {
    title.removeAttribute('aria-invalid');
    error.textContent = '';
  };

  const render = () => {
    previewTitle.textContent = title.value.trim() || 'Seu próximo projeto começa aqui';
    previewDescription.textContent = description.value.trim() || 'Conte o que você quer criar. Mesmo uma primeira ideia já é um começo.';
    count.textContent = `${title.value.length}/120`;
    // User text always enters through textContent, never as markup.
    const values = [...new Set(tags.value.split(',').map(value => value.trim()).filter(Boolean))].slice(0, 4);
    previewTags.replaceChildren(...values.map(value => {
      const tag = document.createElement('span');
      tag.textContent = value;
      return tag;
    }));
    previewTags.hidden = values.length === 0;
    if (title.value.trim()) clearError();
    if (published) {
      published = false;
      preview.dataset.published = 'false';
      state.textContent = 'Rascunho';
      status.textContent = 'Ideia atualizada. Você pode testar a publicação de novo.';
    }
  };

  form.addEventListener('input', render);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!title.value.trim()) {
      error.textContent = 'Dê um título ao seu projeto para testar a publicação.';
      title.setAttribute('aria-invalid', 'true');
      title.focus();
      return;
    }
    clearError();
    published = true;
    preview.dataset.published = 'true';
    state.textContent = 'Publicado · teste';
    status.textContent = 'Pronto! Assim fica a sua prévia. Crie uma conta para publicar na comunidade.';
  });

  publish.hidden = false;
  render();
})();
