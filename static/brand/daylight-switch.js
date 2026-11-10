/* Day and night switch. Builds the pill inside every [data-ld-part="toggle-daylight"], keeps it in step with
   window.DalilakTheme (app-theme.js) and never touches the page itself. */
(() => {
  const SPRITE = {day: '/brand-assets/toggle-day.webp?v=1', night: '/brand-assets/toggle-night.webp?v=1'};
  const TRAIL = '<svg class="dn-trail" viewBox="0 0 240 92" fill="none" aria-hidden="true"><path d="M44 58C77 69 88 33 114 38S132 64 119 58S130 28 153 37S175 52 193 37" stroke="currentColor" stroke-width="1" stroke-dasharray="2 4" stroke-linecap="round"/></svg>';
  const current = () => document.documentElement.dataset.uiTheme === 'day' ? 'day' : 'night';
  const parts = [];

  function paint(part, animate) {
    const night = current() === 'night', button = part.button;
    button.setAttribute('aria-checked', String(night));
    part.image.src = SPRITE[night ? 'night' : 'day'];
    part.status.textContent = night ? 'المظهر الليلي' : 'المظهر النهاري';
    if (animate) {
      part.fly.style.setProperty('--tilt', night ? '8deg' : '-8deg');
      part.fly.classList.remove('dn-flight'); void part.fly.offsetWidth; part.fly.classList.add('dn-flight');
    }
  }

  function build(root) {
    if (root.dataset.dnReady) return;
    root.dataset.dnReady = '1';
    const id = root.querySelector('button')?.id || '';
    root.replaceChildren();
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'dn'; button.setAttribute('role', 'switch');
    button.setAttribute('aria-label', 'المظهر الليلي'); button.title = 'تبديل مظهر التطبيق';
    if (id) button.id = id;
    button.innerHTML = '<span class="dn-track" aria-hidden="true">' + TRAIL + '<span class="dn-fly"><img class="dn-sprite" alt="" draggable="false" width="64" height="64"></span></span>';
    const status = document.createElement('span');
    status.className = 'vh'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    root.append(button, status);
    const part = {button, status, fly: button.querySelector('.dn-fly'), image: button.querySelector('.dn-sprite')};
    button.addEventListener('click', () => window.DalilakTheme.set(current() === 'night' ? 'day' : 'night'));
    button.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { event.preventDefault(); window.DalilakTheme.set('night'); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { event.preventDefault(); window.DalilakTheme.set('day'); }
    });
    parts.push(part); paint(part, false);
  }

  function init() { document.querySelectorAll('[data-ld-part="toggle-daylight"]').forEach(build); }
  window.addEventListener('dalilak-theme-change', () => parts.forEach(part => paint(part, true)));
  for (const src of Object.values(SPRITE)) { const preload = new Image(); preload.src = src; }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
