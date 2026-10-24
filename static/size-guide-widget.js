(() => {
  'use strict';
  const script=document.currentScript;
  if (!script?.src) return;
  const base=(script.dataset.base||new URL(script.src).origin).replace(/\/$/,'');
  // One code for every store: without data-merchant the store is read from the storefront's own configuration.
  let merchant=script.dataset.merchant||'';
  if (merchant&&!/^\d+$/.test(merchant)) return;
  window.__sizeGuideWidgets=window.__sizeGuideWidgets||new Set();
  if (window.__sizeGuideWidgets.has(merchant||'auto')) return;
  window.__sizeGuideWidgets.add(merchant||'auto');
  function knowStore() {
    if (merchant) return true;
    try {const id=String(window.salla?.config?.get('store.id','')||'');if (/^\d+$/.test(id)) {merchant=id;return true;}} catch {/* the storefront is not ready yet */}
    return false;
  }
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
  // Counters carry no cookies, body or personal data: the server only adds one to a per-day total.
  function track(id,type){try{fetch(`${base}/public/size-guides/${merchant}/${id}/event?t=${type}`,{method:'POST',keepalive:true,credentials:'omit',mode:'cors'}).catch(()=>{});}catch{/* analytics never blocks shopping */}}
  // One slot per configured button: the main one plus up to three extras, each with its own placement engine.
  let slots=[];
  function teardown(){for(const slot of slots){slot.engine.reset();slot.host.remove();}slots=[];host=null;}
  function place(slot,ctx){if(ctx)slot.engine.apply(slot.host,ctx,slot.settings);}
  function build(data,ctx,activate){
    teardown();
    const normalized=window.SizeGuideButton.normalize(data.button_settings||{});
    [normalized,...normalized.extra_buttons].forEach((settings,index)=>{
      const target=document.createElement('span');
      if(index===0)target.id='product-size-guide';else target.dataset.sizeGuideExtra=String(index);
      const slot={host:target,settings,engine:window.SizeGuidePlacement.create(),rendered:null};
      slot.rendered=window.SizeGuideButton.render(target,settings,data.guide,activate);
      slots.push(slot);place(slot,ctx);
    });
    host=slots[0].host;
  }
  async function mount() {
    if (loading||!knowStore()) return;
    const ctx=context(),key=ctx?.key||'';
    if (key===current&&(!host||host.isConnected)) {for(const slot of slots)place(slot,ctx);return;}
    current=key;teardown();if(!ctx)return;
    loading=true;
    try {
      const data=await getGuide(ctx.id);if(!data||context()?.key!==key)return;
      await Promise.all([loadAsset('size-guide-button.js','SizeGuideButton'),loadAsset('size-guide-placement.js','SizeGuidePlacement')]);if(context()?.key!==key)return;
      const activate=async()=>{
        const buttons=slots.map(slot=>slot.rendered.button);
        for(const button of buttons){button.disabled=true;button.setAttribute('aria-busy','true');}
        try {
          const [fresh]=await Promise.all([getGuide(ctx.id),loadAsset('size-guide-renderer.js','SizeGuideUI')]);
          if (context()?.key!==key||!host?.isConnected) return;
          if (!fresh){teardown();return;}
          build(fresh,context(),activate);slots[0].rendered.button.focus();
          window.SizeGuideUI.onEvent=type=>track(ctx.id,type);track(ctx.id,'open');
          window.SizeGuideUI.open(fresh.guide,fresh.product_name);
        } catch {
          const message='تعذر التحميل، اضغط للمحاولة مجددًا';
          for(const button of buttons){button.querySelector('.label').textContent=message;button.setAttribute('aria-label',message);button.title=message;}
        }
        finally {for(const button of buttons){button.disabled=false;button.removeAttribute('aria-busy');}}
      };
      build(data,ctx,activate);
    } catch {current='';/* Retry on the next scheduled update without interrupting shopping. */}
    finally {loading=false;if((context()?.key||'')!==key)schedule();}
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(mount,250);}
  function start(){mount();new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('popstate',schedule);window.addEventListener('resize',schedule);setTimeout(schedule,2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
