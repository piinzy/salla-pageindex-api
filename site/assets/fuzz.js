/* Shared character, eye movement and the accessories it holds in the dashboard. */
(() => {
  const source = document.currentScript?.dataset.src || '/brand-assets/fuzz.webp';
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const characters = new Map();
  const visible = new Set();
  let attention = null;
  let frame = 0;
  let restTimer = 0;

  function schedule() {
    if (frame || document.hidden || reduced?.matches || !visible.size) return;
    frame = requestAnimationFrame(draw);
  }

  const observer = 'IntersectionObserver' in window && new IntersectionObserver(entries => {
    for (const entry of entries) {
      const root = entry.target;
      if (entry.isIntersecting) {
        visible.add(root);
        root.dataset.fuzzVisible = '';
      } else {
        visible.delete(root);
        delete root.dataset.fuzzVisible;
      }
    }
    schedule();
  });

  function draw() {
    frame = 0;
    if (document.hidden || reduced?.matches) return;
    for (const root of visible) {
      const rect = root.getBoundingClientRect();
      if (!rect.width || rect.bottom <= 0 || rect.top >= innerHeight) continue;
      const rest = characters.get(root);
      let x = rest.x, y = rest.y;
      if (attention) {
        const dx = attention.x - (rect.left + rect.width * .5);
        const dy = attention.y - (rect.top + rect.height * .38);
        const distance = Math.max(rect.width * .65, Math.hypot(dx, dy));
        x = dx / distance;
        y = dy / distance;
      }
      root.style.setProperty('--px', (x * rect.width * .023).toFixed(2) + 'px');
      root.style.setProperty('--py', (y * rect.width * .018).toFixed(2) + 'px');
      root.style.setProperty('--lid', (1 + y * .13).toFixed(3));
      root.style.setProperty('--fz-turn', (x * 3.5).toFixed(2) + 'deg');
      root.style.setProperty('--fz-nod', (-y * 2).toFixed(2) + 'deg');
    }
  }

  function rest() {
    clearTimeout(restTimer);
    attention = null;
    schedule();
  }

  function lookAt(x, y) {
    if (document.hidden || reduced?.matches || !visible.size) return;
    clearTimeout(restTimer);
    attention = {x, y};
    schedule();
    restTimer = setTimeout(rest, 3200);
  }

  function mount(root) {
    if (!root || root.dataset.fuzzReady) return;
    root.dataset.fuzzReady = '1';
    root.setAttribute('aria-hidden', 'true');
    root.classList.add('fz');
    const eye = side => '<div class="fz-eye ' + side + '"><div class="fz-white"><i class="fz-pupil"></i></div><div class="fz-lid"></div></div>';
    root.innerHTML = '<div class="fz-body"><img alt="" draggable="false"><div class="fz-eyes">' + eye('l') + eye('r') + '</div></div>';
    root.querySelector('img').src = source;
    const prop = root.dataset.fuzzProp;
    if (prop) {
      const svgNS = 'http://www.w3.org/2000/svg';
      const accessory = document.createElementNS(svgNS, 'svg');
      accessory.setAttribute('class', 'fz-accessory');
      accessory.setAttribute('viewBox', '0 0 100 68');
      accessory.setAttribute('focusable', 'false');
      accessory.setAttribute('aria-hidden', 'true');
      const drawing = document.createElementNS(svgNS, 'use');
      drawing.setAttribute('href', '/brand-assets/fuzz-props.svg#' + prop);
      accessory.append(drawing);
      root.querySelector('.fz-body').append(accessory);
    }
    characters.set(root, {x: Number(root.dataset.lookX) || 0, y: Number(root.dataset.lookY) || 0});
    root.style.setProperty('--fz-blink-cycle', (4.5 + Math.random() * 1.8).toFixed(2) + 's');
    if (observer) observer.observe(root);
    else {
      visible.add(root);
      root.dataset.fuzzVisible = '';
    }
  }

  function dressSections() {
    const scenes = [
      ['#catalog > .panelhead > div', 'ruler', -.3, .5],
      ['#editor .studio-heading > div', 'preview', .1, .48],
      ['#library > .panelhead > div', 'books', -.35, .65],
      ['#buttonSettings > .studio-header > div', 'switch', -.65, .4],
      ['#stats > .panelhead > div', 'chart', .42, -.4],
    ];
    for (const [selector, name, x, y] of scenes) {
      const title = document.querySelector(selector);
      if (!title || title.classList.contains('fz-section-title')) continue;
      title.classList.add('fz-section-title');
      const scene = document.createElement('span');
      scene.className = 'fz-scene fz-scene-' + name;
      scene.setAttribute('aria-hidden', 'true');
      const character = document.createElement('span');
      character.dataset.fuzz = '';
      character.dataset.fuzzProp = name;
      character.dataset.lookX = x;
      character.dataset.lookY = y;
      scene.append(character);
      title.prepend(scene);
    }
  }

  function init() {
    dressSections();
    document.querySelectorAll('[data-fuzz]').forEach(mount);
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'touch') lookAt(e.clientX, e.clientY);
    }, {passive: true});
    window.addEventListener('pointerdown', e => lookAt(e.clientX, e.clientY), {passive: true});
    document.addEventListener('focusin', e => {
      const rect = e.target.getBoundingClientRect();
      lookAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    document.documentElement.addEventListener('pointerleave', rest);
    document.addEventListener('visibilitychange', rest);
    window.addEventListener('scroll', schedule, {passive: true, capture: true});
    window.addEventListener('resize', schedule, {passive: true});
    reduced?.addEventListener?.('change', rest);
    schedule();
  }

  window.Fuzz = {mount};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
