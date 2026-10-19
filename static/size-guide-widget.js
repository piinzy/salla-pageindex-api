(() => {
  'use strict';
  const script=document.currentScript;
  if (!script?.src) return;
  const base=(script.dataset.base||new URL(script.src).origin).replace(/\/$/,'');
  const merchant=script.dataset.merchant;
  if (!/^\d+$/.test(merchant||'')) return;
  window.__sizeGuideWidgets=window.__sizeGuideWidgets||new Set();
  if (window.__sizeGuideWidgets.has(merchant)) return;
  window.__sizeGuideWidgets.add(merchant);
  let current='',host=null,loading=false,timer;
  function context() {
    const get=key=>{try{return window.salla?.config?.get(key,'')}catch{return ''}};
    const match=location.pathname.match(/\/p(\d+)\/?$/),id=match?.[1]||String(get('page.id')||'');
    if (!/^\d+$/.test(id)) return null;
    const options=document.querySelector(`salla-product-options[product-id="${id}"]`);
    if (!match && get('page.slug')!=='product.single' && !options) return null;
    return {id,options,key:location.pathname+':'+id};
  }
  const tasks={};
  function loadAsset(name,globalName) {
    if (window[globalName]) return Promise.resolve();
    if (!tasks[name]) tasks[name]=new Promise((resolve,reject)=>{
      const asset=document.createElement('script');asset.src=base+'/'+name;
      asset.onload=()=>{if(window[globalName])resolve();else{delete tasks[name];reject(Error('asset'));}};
      asset.onerror=()=>{asset.remove();delete tasks[name];reject(Error('asset'));};document.head.append(asset);
    });
    return tasks[name];
  }
  async function getGuide(id) {
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try {const response=await fetch(`${base}/public/size-guides/${merchant}/${id}`,{
      credentials:'omit',cache:'no-store',signal:controller.signal});
      if (response.status===404) return null;if (!response.ok) throw Error('guide');return await response.json();
    } finally {clearTimeout(timeout);}
  }
  let placementEngine=null,liveSettings=null;
  function place(target,ctx,settings) {
    if(!ctx)return;
    placementEngine=placementEngine||window.SizeGuidePlacement.create();
    liveSettings=settings;placementEngine.apply(target,ctx,settings);
  }
  async function mount() {
    if (loading) return;
    const ctx=context(),key=ctx?.key||'';
    if (key===current&&(!host||host.isConnected)) {if(host&&liveSettings)place(host,ctx,liveSettings);return;}
    current=key;placementEngine?.reset();host?.remove();host=null;liveSettings=null;if(!ctx)return;
    loading=true;
    try {
      const data=await getGuide(ctx.id);if(!data||context()?.key!==key)return;
      await Promise.all([loadAsset('size-guide-button.js','SizeGuideButton'),loadAsset('size-guide-placement.js','SizeGuidePlacement')]);if(context()?.key!==key)return;
      const target=document.createElement('span');target.id='product-size-guide';host=target;
      let rendered;
      const activate=async()=>{
        const button=rendered.button;button.disabled=true;button.setAttribute('aria-busy','true');
        try {
          const [fresh]=await Promise.all([getGuide(ctx.id),loadAsset('size-guide-renderer.js','SizeGuideUI')]);
          if (context()?.key!==key||!target.isConnected) return;
          if (!fresh){placementEngine?.reset();target.remove();host=null;liveSettings=null;return;}
          rendered=window.SizeGuideButton.render(target,fresh.button_settings,fresh.guide,activate);
          place(target,context(),rendered.settings);rendered.button.focus();
          window.SizeGuideUI.open(fresh.guide,fresh.product_name);
        } catch {const message='تعذر التحميل، اضغط للمحاولة مجددًا';button.querySelector('.label').textContent=message;button.setAttribute('aria-label',message);button.title=message;}
        finally {button.disabled=false;button.removeAttribute('aria-busy');}
      };
      rendered=window.SizeGuideButton.render(target,data.button_settings,data.guide,activate);
      place(target,context(),rendered.settings);
    } catch {current='';/* Retry on the next scheduled update without interrupting shopping. */}
    finally {loading=false;if((context()?.key||'')!==key)schedule();}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(mount,250);}
  function start(){mount();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('popstate',schedule);window.addEventListener('resize',schedule);setTimeout(schedule,2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
