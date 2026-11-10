/* Shared by the public application home and the administration interface. */
(() => {
  const key = 'dalilak-ui-theme';
  const root = document.documentElement;
  function apply(value) {
    const theme = value === 'day' ? 'day' : 'night';
    if (root.dataset.uiTheme === theme) return;
    root.dataset.uiTheme = theme;
    window.dispatchEvent(new CustomEvent('dalilak-theme-change', {detail: {theme}}));
  }
  function read() {
    try { apply(localStorage.getItem(key)); }
    catch { if (!root.dataset.uiTheme) apply('night'); }
  }
  window.DalilakTheme = {
    set(theme) {
      if (theme !== 'night' && theme !== 'day') return;
      apply(theme);
      try { localStorage.setItem(key, theme); }
      catch { /* The current page still works when storage is disabled. */ }
    }
  };
  read();
  window.addEventListener('pageshow', event => { if (event.persisted) read(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) read();
  });
})();
