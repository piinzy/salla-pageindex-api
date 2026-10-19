/* Shared renderer: the admin preview and storefront use exactly the same button. */
(() => {
  'use strict';
  const designs = [
    {id:'link', name:'الرابط الهادئ', hint:'رابط بسيط بجانب خيارات المقاس'},
    {id:'outline', name:'الإطار الأنيق', hint:'زر بإطار واضح وحواف ناعمة'},
    {id:'pill', name:'الكبسولة الداكنة', hint:'زر ممتلئ بحواف دائرية'},
    {id:'band', name:'شريط الإرشاد', hint:'شريط بعرض المساحة مع نص مساعد'},
    {id:'floating', name:'الزر العائم', hint:'زر ثابت أسفل يسار صفحة المنتج'},
    {id:'card', name:'بطاقة القياس', hint:'بطاقة بأيقونة مستقلة ونص مساعد'},
  ];
  const colors = ['background_color','text_color','border_color','icon_color','secondary_text_color'];
  function defaults(design='outline') {
    if (!designs.some(item => item.id === design)) design = 'outline';
    const base = {design, label:'', subtitle:'اختاري مقاسك بثقة', background_color:'#ffffff',
      text_color:'#243c30', border_color:'#d9e3dc', icon_color:'#243c30', secondary_text_color:'#63756a'};
    if (design === 'pill' || design === 'floating') Object.assign(base, {
      background_color:'#263a30', text_color:'#ffffff', border_color:'#263a30',
      icon_color:'#ffffff', secondary_text_color:'#dce9dc'});
    if (design === 'band') Object.assign(base, {background_color:'#f3f5ef', border_color:'#f3f5ef'});
    return base;
  }
  function normalize(input={}) {
    const settings = defaults(input?.design);
    for (const key of colors) if (/^#[0-9a-fA-F]{6}$/.test(input?.[key])) settings[key] = input[key];
    if (typeof input?.label === 'string') settings.label = input.label.trim().slice(0,40);
    if (typeof input?.subtitle === 'string') settings.subtitle = input.subtitle.trim().slice(0,80);
    return settings;
  }
  const css = `:host{display:block;direction:rtl;max-width:100%;color-scheme:light}*{box-sizing:border-box}
    button{display:inline-flex;align-items:center;justify-content:center;gap:9px;max-width:100%;min-height:44px;
      padding:11px 17px;border:1px solid var(--sg-border);border-radius:6px;background:var(--sg-bg);
      color:var(--sg-text);font:14px/1.6 Tahoma,Arial,sans-serif;cursor:pointer;text-align:right;overflow-wrap:anywhere}
    button:hover:not(:disabled){filter:brightness(.94)}button:disabled{opacity:.65;cursor:wait}
    button:focus-visible{outline:3px solid var(--sg-icon);outline-offset:3px}
    .icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sg-icon)}
    .icon svg{display:block;width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
    .copy{display:flex;flex-direction:column;min-width:0;gap:2px}.label{font-weight:500}.sub{color:var(--sg-secondary);font-size:12px}
    .link{background:transparent;border:0;border-radius:0;padding:6px 0;text-decoration:underline;text-underline-offset:5px}
    .pill,.floating{border-radius:999px;padding-inline:21px}.floating{box-shadow:0 4px 16px #0002}
    .band,.card{width:100%;justify-content:flex-start;border-radius:9px}.band{padding:13px 15px}
    .arrow{margin-inline-start:auto;font-size:19px;flex-shrink:0;color:var(--sg-icon)}
    .card{padding:0;gap:12px;overflow:hidden}.card>.icon{align-self:stretch;min-height:68px;width:58px;
      background:color-mix(in srgb,var(--sg-icon) 8%,var(--sg-bg));border-inline-end:1px solid var(--sg-border)}
    .card .copy{padding:10px 0}.units{color:var(--sg-secondary);font-size:11px;margin-inline-start:auto;
      margin-inline-end:12px;white-space:nowrap;padding:4px 6px;border:1px solid var(--sg-border);border-radius:4px}
    @media(max-width:360px){.card{gap:8px}.card>.icon{width:45px}.units{margin-inline-end:8px;padding:3px}}
    @media(prefers-reduced-motion:reduce){button{transition:none}}`;
  const node = (tag, text, cls) => {const element=document.createElement(tag);
    if (text !== undefined) element.textContent=text;if (cls) element.className=cls;return element;};
  function ruler() {
    const icon=node('span',undefined,'icon');icon.setAttribute('aria-hidden','true');
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');
    const group=document.createElementNS(ns,'g');group.setAttribute('transform','rotate(-35 12 12)');
    const rect=document.createElementNS(ns,'rect');
    for (const [key,value] of Object.entries({x:2,y:7,width:20,height:10,rx:1.5})) rect.setAttribute(key,value);
    group.append(rect);
    for (const x of [6,10,14,18]) {const line=document.createElementNS(ns,'path');line.setAttribute('d',`M${x} 7v${x===10||x===18?5:3}`);group.append(line);}
    svg.append(group);icon.append(svg);return icon;
  }
  function render(host, raw, guide={}, onClick=()=>{}) {
    const settings=normalize(raw),root=host.shadowRoot||host.attachShadow({mode:'open'});
    root.replaceChildren();host.dataset.design=settings.design;
    const style=node('style',css),button=node('button',undefined,settings.design);button.type='button';
    button.setAttribute('aria-haspopup','dialog');
    for (const [key,variable] of Object.entries({background_color:'bg',text_color:'text',border_color:'border',icon_color:'icon',secondary_text_color:'secondary'}))
      button.style.setProperty('--sg-'+variable,settings[key]);
    const copy=node('span',undefined,'copy'),label=node('span',settings.label||guide.button_label||'دليل المقاسات','label');
    copy.append(label);
    if (['band','card'].includes(settings.design) && settings.subtitle) copy.append(node('span',settings.subtitle,'sub'));
    button.append(ruler(),copy);
    if(settings.design==='band'){const arrow=node('span','←','arrow');arrow.setAttribute('aria-hidden','true');button.append(arrow);}
    if(settings.design==='card'){const units=node('span','سم / إنش','units');units.setAttribute('aria-hidden','true');button.append(units);}
    button.addEventListener('click',onClick);root.append(style,button);
    return {button,settings};
  }
  window.SizeGuideButton={designs,colors,defaults,normalize,render};
})();
