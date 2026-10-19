(() => {
  'use strict';

  const script = document.currentScript;
  if (!script?.src) return;

  const base = (
    script.dataset.base || new URL(script.src).origin
  ).replace(/\/$/, '');

  const merchant = script.dataset.merchant;
  if (!/^\d+$/.test(merchant || '')) return;

  window.__sizeGuideWidgets = window.__sizeGuideWidgets || new Set();
  if (window.__sizeGuideWidgets.has(merchant)) return;
  window.__sizeGuideWidgets.add(merchant);

  let current = '';
  let host = null;
  let loading = false;
  let timer;

  function context() {
    const get = key => {
      try {
        return window.salla?.config?.get(key, '');
      } catch {
        return '';
      }
    };

    const match = location.pathname.match(/\/p(\d+)\/?$/);
    const id = match?.[1] || String(get('page.id') || '');

    if (!/^\d+$/.test(id)) return null;

    const options = document.querySelector(
      `salla-product-options[product-id="${id}"]`
    );

    if (
      !match &&
      get('page.slug') !== 'product.single' &&
      !options
    ) {
      return null;
    }

    return {
      id,
      options,
      key: location.pathname + ':' + id
    };
  }

  const tasks = {};

  function loadAsset(name, globalName) {
    if (window[globalName]) return Promise.resolve();

    if (!tasks[name]) {
      tasks[name] = new Promise((resolve, reject) => {
        const asset = document.createElement('script');
        asset.src = base + '/' + name;

        asset.onload = () => {
          if (window[globalName]) {
            resolve();
          } else {
            delete tasks[name];
            reject(Error('asset'));
          }
        };

        asset.onerror = () => {
          asset.remove();
          delete tasks[name];
          reject(Error('asset'));
        };

        document.head.append(asset);
      });
    }

    return tasks[name];
  }

  async function getGuide(id) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(
        `${base}/public/size-guides/${merchant}/${id}`,
        {
          credentials: 'omit',
          cache: 'no-store',
          signal: controller.signal
        }
      );

      if (response.status === 404) return null;
      if (!response.ok) throw Error('guide');

      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function place(target, ctx, settings) {
    // السعر الرئيسي الموجود تحت اسم المنتج.
    const product =
      document.getElementById(`product-${ctx.id}`) || document;

    const price = product.querySelector(
      '[data-testid="store-product-price"]'
    );

    const anchor =
      document.querySelector('[data-size-guide-anchor]') ||
      price ||
      ctx.options ||
      document.querySelector(
        `salla-add-product-button[product-id="${ctx.id}"]`
      );

    if (settings.design === 'floating' || !anchor) {
      target.style.cssText =
        'position:fixed;' +
        'left:max(16px,env(safe-area-inset-left));' +
        'bottom:calc(24px + env(safe-area-inset-bottom));' +
        'z-index:9999;' +
        'max-width:calc(100vw - 32px);' +
        'width:max-content';

      document.body.append(target);
    } else {
      target.style.cssText =
        'display:block;margin:12px 0;max-width:100%';

      // إدراج الزر فوق السعر مباشرة.
      anchor.before(target);
    }
  }

  async function mount() {
    if (loading) return;

    const ctx = context();
    const key = ctx?.key || '';

    if (key === current && (!host || host.isConnected)) return;

    current = key;
    host?.remove();
    host = null;

    if (!ctx) return;

    loading = true;

    try {
      const data = await getGuide(ctx.id);
      if (!data || context()?.key !== key) return;

      await loadAsset('size-guide-button.js', 'SizeGuideButton');
      if (context()?.key !== key) return;

      const target = document.createElement('span');
      target.id = 'product-size-guide';
      host = target;

      let rendered;

      const activate = async () => {
        const button = rendered.button;
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');

        try {
          const [fresh] = await Promise.all([
            getGuide(ctx.id),
            loadAsset('size-guide-renderer.js', 'SizeGuideUI')
          ]);

          if (
            context()?.key !== key ||
            !target.isConnected
          ) {
            return;
          }

          if (!fresh) {
            target.remove();
            return;
          }

          rendered = window.SizeGuideButton.render(
            target,
            fresh.button_settings,
            fresh.guide,
            activate
          );

          place(target, context(), rendered.settings);
          rendered.button.focus();

          window.SizeGuideUI.open(
            fresh.guide,
            fresh.product_name
          );
        } catch {
          button.querySelector('.label').textContent =
            'تعذر التحميل، اضغط للمحاولة مجددًا';
        } finally {
          button.disabled = false;
          button.removeAttribute('aria-busy');
        }
      };

      rendered = window.SizeGuideButton.render(
        target,
        data.button_settings,
        data.guide,
        activate
      );

      place(target, context(), rendered.settings);
    } catch {
      current = '';
    } finally {
      loading = false;

      if ((context()?.key || '') !== key) {
        schedule();
      }
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(mount, 250);
  }

  function start() {
    mount();

    new MutationObserver(schedule).observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('popstate', schedule);
    setTimeout(schedule, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {
      once: true
    });
  } else {
    start();
  }
})();
