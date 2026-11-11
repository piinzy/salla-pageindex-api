/* The side rail of the standalone admin: expanded or icons only, remembered between visits. */
(() => {
  const app = document.getElementById('app'), toggle = document.getElementById('railToggle');
  if (!app || !toggle) return;
  const key = 'dalilak-rail';
  const paint = () => {
    const on = app.classList.contains('rail');
    toggle.setAttribute('aria-pressed', String(on));
    toggle.setAttribute('aria-label', on ? 'توسيع القائمة' : 'طيّ القائمة');
  };
  try { if (localStorage.getItem(key) === '1') app.classList.add('rail'); } catch { /* the rail still works for this visit */ }
  document.querySelectorAll('aside nav button').forEach(button => { const label = button.querySelector('span'); if (label) button.title = label.textContent.trim(); });
  toggle.addEventListener('click', () => {
    app.classList.toggle('rail'); paint();
    try { localStorage.setItem(key, app.classList.contains('rail') ? '1' : '0'); } catch { /* ignore */ }
  });
  paint();
})();
