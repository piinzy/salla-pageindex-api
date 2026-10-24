/* Dashboard motion helpers (interface only, never the guide shoppers see). No framework: plain DOM, transform and opacity only,
   and every helper falls back to "instant" when the device asks for reduced motion or cannot animate. */
(() => {
  'use strict';
  const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const canAnimate = () => typeof window.requestAnimationFrame === 'function' && !reduced();
  const now = () => (window.performance || Date).now();

  /* ---- cubic-bezier easing (same maths as CSS) ---- */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const x = t => ((ax * t + bx) * t + cx) * t, y = t => ((ay * t + by) * t + cy) * t, dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return progress => {
      if (progress <= 0) return 0;
      if (progress >= 1) return 1;
      let t = progress;
      for (let i = 0; i < 8; i++) { const e = x(t) - progress, d = dx(t); if (Math.abs(e) < 1e-6 || !d) break; t -= e / d; }
      return y(Math.min(1, Math.max(0, t)));
    };
  }
  const easeOutExpo = bezier(0.16, 1, 0.3, 1);

  /* ---- numbers roll from the old value to the new one (~1.2s), rounded every frame ---- */
  const arabic = value => Math.round(value).toLocaleString('ar');
  function rollTo(el, value, options = {}) {
    if (!el) return;
    const format = options.format || arabic, duration = options.duration || 1200;
    el.classList.add('num');
    if (el._roll) { cancelAnimationFrame(el._roll.frame); el._roll = null; }
    const from = Number.isFinite(Number(el.dataset.n)) && el.dataset.n !== undefined && el.dataset.n !== '' ? Number(el.dataset.n) : 0;
    el.dataset.n = String(value);
    if (!Number.isFinite(value) || !canAnimate() || from === value) { el.textContent = Number.isFinite(value) ? format(value) : String(value); return; }
    const start = now(), state = el._roll = {frame: 0};
    const step = time => {
      const t = Math.min(1, ((typeof time === 'number' ? time : now()) - start) / duration);
      if (t >= 1) { el.textContent = format(value); el._roll = null; return; }
      el.textContent = format(from + (value - from) * easeOutExpo(t));
      state.frame = requestAnimationFrame(step);
    };
    state.frame = requestAnimationFrame(step);
  }

  /* ---- progress fill: only the fill moves (scaleX), the track is untouched ---- */
  function fill(el, ratio) {
    if (!el) return;
    el.style.transform = 'scaleX(' + Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0)).toFixed(4) + ')';
  }

  /* ---- a line that draws itself, then its area fades in ---- */
  function sparkline(host, values, label) {
    host.replaceChildren();
    const data = values.map(Number).filter(Number.isFinite);
    if (data.length < 2) return null;
    const W = 160, H = 44, pad = 3, max = Math.max(1, ...data), step = (W - pad * 2) / (data.length - 1);
    const points = data.map((v, i) => [pad + i * step, H - pad - (v / max) * (H - pad * 2)]);
    const d = points.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'spark'); svg.setAttribute('preserveAspectRatio', 'none');
    if (label) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); } else svg.setAttribute('aria-hidden', 'true');
    const area = document.createElementNS(ns, 'path'), line = document.createElementNS(ns, 'path');
    area.setAttribute('d', d + ` L${points[points.length - 1][0].toFixed(1)} ${H} L${points[0][0].toFixed(1)} ${H} Z`); area.setAttribute('class', 'area');
    line.setAttribute('d', d); line.setAttribute('class', 'line'); line.setAttribute('pathLength', '1'); line.setAttribute('fill', 'none');
    svg.append(area, line); host.append(svg);
    return svg;
  }

  /* ---- lists: rows that stay glide to their new place, new rows fade in, removed rows fade out of layout (FLIP) ---- */
  function flip(container, mutate, keyOf = el => el.dataset.key) {
    if (!container) { mutate(); return; }
    const before = new Map(), olds = [...container.children];
    if (canAnimate()) for (const el of olds) { const k = keyOf(el); if (k) before.set(k, {el, rect: el.getBoundingClientRect()}); }
    mutate();
    if (!canAnimate()) return;
    const hostRect = container.getBoundingClientRect(), after = new Set();
    for (const el of [...container.children]) {
      const k = keyOf(el); if (!k) continue; after.add(k);
      const old = before.get(k);
      if (!old) { el.classList.add('motion-in'); continue; }
      const rect = el.getBoundingClientRect(), dx = old.rect.left - rect.left, dy = old.rect.top - rect.top;
      if (!dx && !dy) continue;
      el.style.transition = 'none'; el.style.transform = `translate(${dx}px,${dy}px)`;
      el.getBoundingClientRect();
      el.style.transition = 'transform .26s cubic-bezier(.22,1,.36,1)'; el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; }, 300);
    }
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    for (const [k, old] of before) {
      if (after.has(k)) continue;
      const ghost = old.el; ghost.classList.add('motion-out');
      ghost.style.cssText += `;position:absolute;left:${old.rect.left - hostRect.left}px;top:${old.rect.top - hostRect.top}px;width:${old.rect.width}px;pointer-events:none;margin:0`;
      container.append(ghost); setTimeout(() => ghost.remove(), 220);
    }
  }

  /* ---- a pill that slides behind the active item on a tight spring (FLIP on position and size) ---- */
  function pill(container, activeSelector) {
    if (!container || container._pill) return container?._pill;
    const el = document.createElement('span');
    el.className = 'motion-pill'; el.setAttribute('aria-hidden', 'true');
    container.classList.add('has-pill'); container.prepend(el);
    const K = 700, C = 45;                                    // stiffness and damping of the spring
    let base = null, cur = null, vel = [0, 0, 0, 0], frame = 0, last = 0;
    const measure = () => {
      const a = container.querySelector(activeSelector);
      if (!a || !a.offsetWidth || !a.offsetHeight) return null;
      return [a.offsetLeft, a.offsetTop, a.offsetWidth, a.offsetHeight];
    };
    const apply = v => { el.style.transform = `translate(${v[0]}px,${v[1]}px) scale(${v[2] / base[2]},${v[3] / base[3]})`; };
    const target = () => measure();
    function show() { el.style.opacity = '1'; }
    function snap() {
      const t = target(); if (!t) { el.style.opacity = '0'; return; }
      if (!base) { base = t.slice(); el.style.width = t[2] + 'px'; el.style.height = t[3] + 'px'; }
      cancelAnimationFrame(frame); cur = t.slice(); vel = [0, 0, 0, 0]; apply(cur); show();
    }
    function go() {
      const t = target(); if (!t) { el.style.opacity = '0'; return; }
      if (!base || !cur || !canAnimate()) { snap(); return; }
      cancelAnimationFrame(frame); last = now();
      const tick = time => {
        const stamp = typeof time === 'number' ? time : now(), dt = Math.min(0.032, Math.max(0.001, (stamp - last) / 1000)); last = stamp;
        let settled = true;
        for (let i = 0; i < 4; i++) {
          const force = -K * (cur[i] - t[i]) - C * vel[i];
          vel[i] += force * dt; cur[i] += vel[i] * dt;
          if (Math.abs(cur[i] - t[i]) > 0.05 || Math.abs(vel[i]) > 0.05) settled = false;
        }
        if (settled) { cur = t.slice(); vel = [0, 0, 0, 0]; apply(cur); return; }
        apply(cur); frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }
    new MutationObserver(go).observe(container, {attributes: true, subtree: true, attributeFilter: ['class', 'aria-selected']});
    window.addEventListener('resize', snap);
    if (typeof ResizeObserver === 'function') new ResizeObserver(snap).observe(container);
    snap();
    return container._pill = {snap, go};
  }

  /* ---- toasts: a stack that rises in, glides when others come and go, pauses on hover ---- */
  const TOAST_LIFE = 4000, TOAST_MAX = 4;
  function toast(message, life = TOAST_LIFE) {
    const host = document.getElementById('toast');
    if (!host) return false;
    host.classList.remove('hidden'); host.classList.add('stack');
    const animate = canAnimate();
    const item = document.createElement('div');
    item.className = 'toast-item'; item.textContent = message; item.setAttribute('role', 'status');
    const move = mutate => flip(host, mutate, el => el.classList.contains('motion-out') ? '' : (el._toastId || ''));
    item._toastId = 't' + Math.random().toString(36).slice(2);
    move(() => host.prepend(item));
    if (animate) item.classList.add('toast-in');
    let left = life, started = 0, timer = 0;
    const dismiss = () => {
      clearTimeout(timer);
      if (!item.isConnected || item._gone) return;
      item._gone = true;
      if (!animate) { item.remove(); if (!host.children.length) host.classList.add('hidden'); return; }
      move(() => item.remove());                       // flip() keeps a fading ghost while the others close the gap
      setTimeout(() => { if (!host.querySelector('.toast-item:not(.motion-out)')) host.classList.add('hidden'); }, 240);
    };
    const run = () => { started = now(); timer = setTimeout(dismiss, left); };
    item.addEventListener('mouseenter', () => { clearTimeout(timer); left = Math.max(Math.min(life, 600), left - (now() - started)); });
    item.addEventListener('mouseleave', run);
    item.addEventListener('click', dismiss);
    run();
    const live = [...host.querySelectorAll('.toast-item:not(.motion-out)')];
    if (live.length > TOAST_MAX) live[live.length - 1].click();
    return true;
  }

  /* ---- icon nudge: the arrow moves 4px in its travel direction, the label never does ---- */
  const ARROWS = {
    forward: 'M4 12h15M13 6l6 6-6 6', back: 'M20 12H5M11 6l-6 6 6 6', down: 'M12 4v15M6 13l6 6 6-6',
  };
  function enhance(root = document) {
    const rtl = document.documentElement.dir === 'rtl' || getComputedStyle(document.body).direction === 'rtl';
    for (const button of root.querySelectorAll('[data-nudge]:not([data-nudged])')) {
      const kind = button.dataset.nudge;
      if (!ARROWS[kind]) continue;
      const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), path = document.createElementNS(ns, 'path');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('class', 'nudge-ico'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
      path.setAttribute('d', ARROWS[kind]); svg.append(path);
      // In a right-to-left page "forward" points left, and "back" points right.
      const flipX = rtl && kind !== 'down';
      svg.style.setProperty('--nx', (kind === 'down' ? 0 : (kind === 'forward' ? 1 : -1) * (flipX ? -1 : 1) * 4) + 'px');
      svg.style.setProperty('--ny', kind === 'down' ? '4px' : '0px');
      if (flipX) svg.style.scale = '-1 1'; else svg.style.scale = '';
      button.dataset.nudged = '1'; button.classList.add('has-nudge');
      if (kind === 'back') button.prepend(svg); else button.append(svg);
    }
  }

  function init() {
    enhance();
    pill(document.querySelector('aside nav'), 'button.active');
    pill(document.getElementById('studioTabs'), 'button[aria-selected=true]');
  }
  window.UIMotion = {rollTo, fill, sparkline, flip, pill, toast, enhance, bezier, easeOutExpo, reduced};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true}); else init();
})();
