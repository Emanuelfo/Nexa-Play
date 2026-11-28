(() => {
  const root = document.documentElement;
  if (!root.hasAttribute('data-social-theme')) return;

  const storageKey = 'np_social_theme';
  let theme = 'light';
  try {
    const savedTheme = localStorage.getItem(storageKey);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      theme = savedTheme;
    } else {
      const legacyTheme = localStorage.getItem('np_theme');
      if (legacyTheme === 'light' || legacyTheme === 'dark') {
        theme = legacyTheme;
        localStorage.setItem(storageKey, theme);
      }
    }
  } catch (error) {
    console.warn('Não foi possível acessar a preferência de tema.', error);
  }

  const syncToggle = button => {
    const isDark = theme === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';
    button.setAttribute('aria-label', 'Alternar entre modo claro e escuro');
    button.setAttribute('title', `Ativar modo ${nextTheme === 'dark' ? 'escuro' : 'claro'}`);
    button.setAttribute('aria-pressed', String(isDark));
  };

  const applyTheme = persist => {
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(syncToggle);
    if (persist) {
      try {
        localStorage.setItem(storageKey, theme);
      } catch (error) {
        console.warn('Não foi possível salvar a preferência de tema.', error);
      }
    }
  };

  applyTheme(false);

  document.addEventListener('np:social-theme-controls-ready', () => {
    document.querySelectorAll('[data-theme-toggle]').forEach(syncToggle);
  });

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-theme-toggle]');
    if (!button) return;
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(true);
  });

  window.addEventListener('storage', event => {
    if (event.key !== storageKey) return;
    theme = event.newValue === 'dark' ? 'dark' : 'light';
    applyTheme(false);
  });
})();
