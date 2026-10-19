/* The SDK is vendored at version 0.2.6. Sessions stay in memory, never localStorage. */
(() => {
  'use strict';
  let sdk, session = '', appId = '', connected = false, expired = false;
  const navValues = new Set();
  const titles = {catalog:'المنتجات والمقاسات', editor:'تحرير دليل المقاسات', buttonSettings:'إعدادات الزر', install:'تركيب زر المتجر', activity:'سجل المزامنة'};
  const applyTheme = value => { document.documentElement.dataset.theme = value === 'dark' ? 'dark' : 'light'; };
  applyTheme(new URLSearchParams(location.search).get('theme'));
  function status(message, loading = false) {
    let panel = document.getElementById('embeddedStatus');
    if (!panel) { panel = document.createElement('section'); panel.id = 'embeddedStatus'; panel.className = 'embedded-state'; document.body.prepend(panel); }
    panel.replaceChildren();
    if (loading) { const spinner = document.createElement('div'); spinner.className = 'loader'; panel.append(spinner); }
    const title = document.createElement('h1'); title.textContent = 'دليل المقاسات';
    const text = document.createElement('p'); text.textContent = message; text.setAttribute('role', loading ? 'status' : 'alert');
    panel.append(title, text);
    return panel;
  }
  function expire() {
    if (expired) return;
    expired = true;
    const panel = document.createElement('div'); panel.className = 'embedded-session-notice'; panel.setAttribute('role', 'alert');
    panel.textContent = 'انتهت الجلسة. بقيت تعديلاتك ظاهرة هنا؛ انسخ ما لم تحفظه قبل تجديد الجلسة.';
    const button = document.createElement('button'); button.textContent = 'تجديد الجلسة';
    button.onclick = async () => {
      if (typeof mayLeave === 'function' && !(await mayLeave())) return;
      button.disabled = true; sdk.auth.refresh();
    };
    panel.append(button); document.querySelector('main').prepend(panel);
  }
  async function request(path, options = {}) {
    if (!session) throw new Error('افتح التطبيق من لوحة سلة لتسجيل الدخول.');
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json'); headers.set('X-Dashboard-Request', '1');
    headers.set('X-Size-Guide-Embedded', '1'); headers.set('Authorization', 'Bearer ' + session);
    const response = await fetch('/dashboard-api/' + path, {...options, headers, credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer'});
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) { clearInterval(poll); poll = null; expire(); }
      const detail = typeof data.detail === 'string' ? data.detail : 'تعذر تنفيذ الطلب. راجع الحقول ثم حاول مجددًا.';
      throw new Error(detail);
    }
    return data;
  }
  function navigate(tab) {
    if (!connected) return;
    const selected = tab === 'editor' ? 'catalog' : tab;
    sdk.page.setTitle(titles[tab] || 'دليل المقاسات');
    navValues.forEach(value => sdk.nav.updateNavItem({value, active:value === 'size-guide-' + selected}));
  }
  async function setupNavigation() {
    const hostPath = '/embedded/app/' + appId + '/size-guide';
    for (const tab of ['catalog', 'buttonSettings', 'activity', 'install']) {
      const value = 'size-guide-' + tab;
      try {
        await sdk.nav.addNavItem({title:titles[tab], value, url:hostPath, active:tab === 'catalog'});
        navValues.add(value);
      } catch { /* In-content links remain available if this host lacks injected tabs. */ }
    }
    sdk.nav.onNavItemClick(async ({value}) => {
      const tab = value.replace(/^size-guide-/, '');
      if (!['catalog','buttonSettings','activity','install'].includes(tab)) return;
      if (!(await mayLeave())) { navigate(view); return; }
      dirty = false; show(tab);
      try { if (tab === 'catalog') await loadProducts(); if (tab === 'activity') await loadJobs(); }
      catch (error) { toast(error.message); }
    });
    // Task links are also useful when a merchant lands deep in the editor.
    const links = document.createElement('div'); links.className = 'embedded-help-links';
    for (const tab of ['catalog', 'buttonSettings', 'activity', 'install']) {
      const button = document.createElement('button'); button.className = 'secondary'; button.textContent = titles[tab];
      button.onclick = () => document.querySelector('[data-tab="' + tab + '"]').click(); links.append(button);
    }
    document.querySelector('main').append(links);
  }
  async function start(boot) {
    status('جارٍ التحقق من حساب متجرك…', true);
    if (window.parent === window) {
      status('هذه الصفحة تُفتح من التطبيقات المثبتة داخل لوحة سلة. بعد ربط الصفحة المضمنة اضغط «استخدام التطبيق».');
      return;
    }
    try {
      sdk = window.SallaEmbeddedSDK?.embedded || window.Salla?.embedded;
      if (!sdk) throw new Error('تعذر تحميل مكتبة سلة. أعد فتح التطبيق.');
      const {layout} = await sdk.init({debug:false});
      applyTheme(layout.theme); sdk.onThemeChange(applyTheme);
      const token = sdk.auth.getToken();
      if (!token) throw new Error('لم ترسل سلة جلسة الدخول. أعد فتح التطبيق من التطبيقات المثبتة.');
      const cleanUrl = new URL(location.href); cleanUrl.searchParams.delete('token');
      history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      const response = await fetch('/dashboard-api/embedded-session', {
        method:'POST', credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer',
        headers:{'Content-Type':'application/json', 'X-Dashboard-Request':'1'}, body:JSON.stringify({token}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'تعذر تسجيل الدخول من سلة.');
      session = data.session_token; appId = data.app_id; connected = true;
      await boot();
      document.getElementById('embeddedStatus')?.remove();
      sdk.page.setTitle('دليل المقاسات'); sdk.ready();
      await setupNavigation();
    } catch (error) {
      session = ''; connected = false;
      document.getElementById('app').classList.add('hidden');
      status(error.message || 'تعذر فتح التطبيق. حاول مجددًا من سلة.');
      if (sdk?.isReady()) { sdk.ui.toast.error(error.message || 'تعذر فتح التطبيق'); sdk.destroy(); }
    }
  }
  window.SizeGuideEmbedded = {
    start, request, navigate,
    toast(message) { if (!connected) return false; sdk.ui.toast.info(message); return true; },
    async confirm(message) {
      if (!connected) return false;
      try { return (await sdk.ui.confirm({title:'تأكيد الإجراء', message, confirmText:'متابعة', cancelText:'إلغاء', variant:'warning'})).confirmed; }
      catch { sdk.ui.toast.error('تعذر فتح نافذة التأكيد. حاول مجددًا.'); return false; }
    },
  };
})();
