/* Shared placement engine. Preview anchors are supplied explicitly; storefront anchors are scoped to the current product. */
(() => {
  'use strict';
  const EXCLUDED='salla-product-card,salla-products-slider,salla-products-list,[data-product-card]';
  function first(root,selectors){
    for(const selector of selectors){for(const e of root.querySelectorAll(selector))if(!e.closest(EXCLUDED))return e;}
    return null;
  }
  function anchors(ctx){
    const root=document.getElementById('product-'+ctx.id)||document.querySelector('main')||document;
    const price=first(root,['[data-testid="store-product-price"]','.product-price','.total-price']);
    const title=first(root,['[data-testid="store-product-title"]','h1']);
    const options=first(root,[`salla-product-options[product-id="${ctx.id}"]`]);
    const cart=first(root,[`salla-add-product-button[product-id="${ctx.id}"]`]);
    const slider=first(root,['[data-testid="store-product-image-slider"]',`#details-slider-${ctx.id}`]);
    // The stationary viewport, never a moving slide, image link, or thumbnail strip.
    const gallery=slider?.querySelector('.s-slider-container')||slider;
    let size=null;
    if(options){
      size=first(options,['[data-size-guide-size-label]']);
      if(!size)size=[...options.querySelectorAll('label,legend,.s-product-options-option-label')].find(e=>
        /(^|\s)(المقاس|المقاسات|مقاس|size|sizes)(\s|[:*]|$)/i.test(e.textContent.trim())&&
        !e.querySelector('input,select,button,textarea'));
    }
    return {root,price,title,options,cart,gallery,size,custom:first(root,['[data-size-guide-anchor]'])};
  }
  function create(config={}){
    let active=null,undo=()=>{},styleKey='',placedHost=null;
    const viewport=config.viewport||(()=>window.matchMedia?.('(max-width: 767px)').matches||false);
    function reset(){undo();undo=()=>{};active=null;styleKey='';placedHost=null;}
    function relative(e){const old=e.style.position;if(!getComputedStyle(e).position||getComputedStyle(e).position==='static'){
      e.style.position='relative';return ()=>{if(e.style.position==='relative')e.style.position=old;};}return ()=>{};}
    function wrapper(anchor,kind){
      // Several buttons may sit beside the same anchor; they share one row and the last one out restores the theme.
      let row=anchor.parentElement,applied=kind==='cart'?'1 1 180px':'0 1 auto';
      if(row?.dataset.dalilakLayout===kind)row._sgUsers=(row._sgUsers||1)+1;
      else{
        row=document.createElement('div');row.dataset.dalilakLayout=kind;row._sgUsers=1;row._sgFlex=anchor.style.flex;
        row.style.cssText='display:flex;align-items:center;gap:10px;flex-wrap:wrap;max-width:100%;width:100%';
        anchor.before(row);row.append(anchor);anchor.style.flex=applied;
      }
      return {row,cleanup:()=>{
        if(--row._sgUsers>0)return;
        if(anchor.style.flex===applied)anchor.style.flex=row._sgFlex;if(row.parentNode)row.before(anchor);row.remove();}};
    }
    function apply(host,ctx,raw){
      const s=window.SizeGuideButton.normalizeOne(raw),mobile=viewport();
      const hidden=(s.devices==='mobile'&&!mobile)||(s.devices==='desktop'&&mobile);
      let requested=mobile&&s.mobile_placement!=='inherit'?s.mobile_placement:s.placement;
      let placement=requested==='mobile_bar'&&!mobile?'above_price':requested;
      const a=config.anchors?config.anchors(ctx):anchors(ctx);
      const floating=()=>['floating_left','floating_right','side_tab','mobile_bar'].includes(placement);
      let anchor;
      if(placement.startsWith('image_'))anchor=a.gallery;
      else if(placement==='below_title')anchor=a.title;
      else if(placement==='before_options')anchor=a.options;
      else if(placement==='beside_size')anchor=a.size;
      else if(['above_cart','beside_cart'].includes(placement))anchor=a.cart;
      else if(!floating())anchor=a.custom||a.price;
      if(!floating()&&!anchor){placement='above_price';anchor=a.custom||a.price||a.options||a.cart;}
      // If the theme exposes none of the safe anchors, retain a usable button.
      if(!floating()&&!anchor)placement='floating_left';
      const parent=floating()?(config.surface||document.body):anchor;
      const modeKey=[placement,s.alignment,s.edge_offset,s.bottom_offset,mobile,hidden].join('|');
      if(!active||active.anchor!==parent||active.mode!==modeKey||placedHost!==host||!host.isConnected||!active.container?.isConnected){
        reset();placedHost=host;
        let container=parent;
        if(placement.startsWith('image_'))undo=relative(anchor);
        if(placement==='beside_cart'||placement==='beside_size'){
          const wrapped=wrapper(anchor,placement==='beside_cart'?'cart':'size');container=wrapped.row;undo=wrapped.cleanup;
        }
        active={anchor:parent,mode:modeKey,container};
      }
      const edge=s.edge_offset;
      let css='display:block;max-width:100%;direction:rtl;box-sizing:border-box;';
      const fixed=config.surface?'absolute':'fixed';
      if(placement.startsWith('image_')){
        const vertical=placement.includes('_top_')?'top':'bottom',side=placement.endsWith('_right')?'right':'left';
        css+=`position:absolute;${vertical}:${edge}px;${side}:${edge}px;z-index:6;width:max-content;max-width:calc(100% - ${Math.max(edge*2,8)}px);filter:drop-shadow(0 2px 5px #0002);`;
        if(host.parentElement!==active.container)active.container.append(host);
      }else if(floating()){
        css+=`position:${fixed};z-index:999;`;
        if(placement==='side_tab')css+='right:0;top:50%;transform:translateY(-50%);width:max-content;max-width:200px;';
        else if(placement==='mobile_bar')css+=`left:${edge}px;right:${edge}px;bottom:calc(${s.bottom_offset}px + env(safe-area-inset-bottom));width:auto;text-align:center;padding:8px;background:var(--sg-surface,#fff);border:1px solid #e4e9e6;border-radius:12px;box-shadow:0 3px 14px #0002;`;
        else css+=`${placement==='floating_right'?'right':'left'}:max(${edge}px,env(safe-area-inset-${placement==='floating_right'?'right':'left'}));bottom:calc(${s.bottom_offset}px + env(safe-area-inset-bottom));width:max-content;max-width:calc(100% - ${Math.max(edge*2,8)}px);`;
        if(host.parentElement!==active.container)active.container.append(host);
      }else if(placement==='beside_size'||placement==='beside_cart'){
        css+='flex:0 1 auto;min-width:0;margin:8px 0;';
        if(host.parentElement!==active.container)active.container.append(host);
      }else{
        css+=`margin:12px 0;width:100%;text-align:${s.alignment};`;
        if(['below_title','below_price'].includes(placement)){if(anchor.nextElementSibling!==host)anchor.after(host);}
        else if(anchor.previousElementSibling!==host)anchor.before(host);
        active.container=host.parentElement;
      }
      if(hidden)css+='display:none!important;';
      if(styleKey!==css){host.style.cssText=css;styleKey=css;}
      host.dataset.placement=placement;
      return {requested,placement,fallback:requested!==placement,mobile,hidden};
    }
    return {apply,reset};
  }
  window.SizeGuidePlacement={anchors,create};
})();
