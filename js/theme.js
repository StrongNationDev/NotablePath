(() => {
  const storageKey = 'notablepath-theme';
  const savedTheme = localStorage.getItem(storageKey);
  const preferredTheme = savedTheme || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = preferredTheme;

  function updateButton(button) {
    if (!button) return;
    const isLight = document.documentElement.dataset.theme === 'light';
    button.textContent = isLight ? 'Dark mode' : 'Light mode';
    button.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
  }

  document.querySelectorAll('#workspace-theme, #admin-theme').forEach(button => {
    updateButton(button);
    button.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      document.documentElement.dataset.theme = nextTheme;
      localStorage.setItem(storageKey, nextTheme);
      updateButton(button);
    });
  });
})();