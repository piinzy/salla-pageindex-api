/* Eyes follow the pointer, lids droop and blink, the body tilts a little, a press squints. Mount: <div class="fz" data-fuzz></div> */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const SRC = (document.currentScript && document.currentScript.dataset.src) || '/brand-assets/fuzz.webp';
  const eye = side => `<div class="fz-eye ${side}"><div class="fz-white"><i class="fz-pupil"></i></div><div class="fz-lid"></div></div>`;
  const chars = [];
  let px = innerWidth * .5, py = innerHeight * .4, last = performance.now();
  addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; last = performance.now(); }, {passive: true});
  function mount(root) {
    if (root.dataset.fuzzReady) return; root.dataset.fuzzReady = '1';
    root.classList.add('fz');
    root.innerHTML = `<div class="fz-body"><img src="${SRC}" alt="" draggable="false"><div class="fz-eyes">${eye('l')}${eye('r')}</div></div>`;
    const c = {root, body: root.querySelector('.fz-body'), eyes: root.querySelector('.fz-eyes'), els: [...root.querySelectorAll('.fz-eye')],
      gx: 0, gy: 0, rx: 0, ry: 0, lid: 1, blink: 0, blinkAt: performance.now() + 1800 + Math.random() * 2500, down: 0};
    root.addEventListener('pointerdown', () => { root.classList.add('is-down'); c.down = 1; });
    addEventListener('pointerup', () => { root.classList.remove('is-down'); c.down = 0; });
    chars.push(c);
  }
  function frame(t) {
    const idle = t - last > 3500;
    const mx = idle ? innerWidth * (.5 + Math.sin(t / 1900) * .32) : px, my = idle ? innerHeight * (.42 + Math.cos(t / 2500) * .22) : py;
    for (const c of chars) {
      const r = c.root.getBoundingClientRect(); if (r.bottom < -50 || r.top > innerHeight + 50) continue;
      const cx = r.left + r.width * .5, cy = r.top + r.height * .4, dx = mx - cx, dy = my - cy, d = Math.hypot(dx, dy) || 1, k = clamp(d / (r.width * .55), 0, 1);
      const tx = dx / d * k, ty = dy / d * k;                       // -1..1 direction of attention
      c.gx += (tx - c.gx) * .14; c.gy += (ty - c.gy) * .14;
      const eyeW = r.width * .11;
      for (const el of c.els) { el.style.setProperty('--px', (c.gx * eyeW * .2).toFixed(2) + 'px'); el.style.setProperty('--py', (c.gy * eyeW * .16).toFixed(2) + 'px'); }
      c.eyes.style.transform = `translate(${(c.gx * r.width * .012).toFixed(2)}px,${(c.gy * r.width * .008).toFixed(2)}px)`;
      // sleepy lids: a little lower when looking down, almost shut while pressed, a blink now and then
      if (t > c.blinkAt) { c.blink = 1; c.blinkAt = t + 2400 + Math.random() * 3200; }
      c.blink = Math.max(0, c.blink - 0.085);
      const target = 1 + (c.gy > 0 ? c.gy * .1 : c.gy * .18) + (c.down ? .55 : 0) + Math.sin(c.blink * Math.PI) * .7 - (c.gy < -.3 ? .08 : 0);
      c.lid += (target - c.lid) * .35;
      for (const el of c.els) el.style.setProperty('--lid', c.lid.toFixed(3));
      if (!reduce) {
        c.ry += (clamp(dx / innerWidth * 2, -1, 1) * 4.5 - c.ry) * .08; c.rx += (-clamp(dy / innerHeight * 2, -1, 1) * 2.6 - c.rx) * .08;
        c.body.style.transform = `rotateX(${c.rx.toFixed(2)}deg) rotateY(${c.ry.toFixed(2)}deg)`;
      }
    }
    requestAnimationFrame(frame);
  }
  const init = () => { document.querySelectorAll('[data-fuzz]').forEach(mount); requestAnimationFrame(frame); };
  window.Fuzz = {mount};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
