/* One renderer for the storefront and the merchant's live preview. */
(() => {
  'use strict';
  const designs = [
    {id:'link',name:'رابط أنيق',hint:'نص واضح مع خط سفلي'},
    {id:'outline',name:'إطار رفيع',hint:'حدود هادئة ومساحة بيضاء'},
    {id:'solid',name:'ممتلئ',hint:'لون قوي وحواف ناعمة'},
    {id:'pill',name:'الكبسولة الداكنة',hint:'حواف دائرية بالكامل'},
    {id:'soft',name:'لمسة ناعمة',hint:'خلفية خفيفة بلون الهوية'},
    {id:'dashed',name:'إطار متقطع',hint:'إيحاء بشريط القياس'},
    {id:'split',name:'زر مقسوم',hint:'مساحة مستقلة للأيقونة'},
    {id:'band',name:'شريط إرشادي',hint:'عرض كامل مع نص مساعد'},
    {id:'card',name:'بطاقة القياس',hint:'بطاقة مع وصف ووحدات القياس'},
    {id:'icon',name:'أيقونة دائرية',hint:'زر مختصر مناسب لصورة المنتج'},
    {id:'row',name:'صف بسهم',hint:'نص وسهم وخط سفلي'},
    {id:'tile',name:'مربع عمودي',hint:'أيقونة فوق النص'},
  ];
  const placements = [
    {id:'above_price',name:'فوق السعر',group:'details'},
    {id:'below_price',name:'تحت السعر',group:'details'},
    {id:'below_title',name:'تحت اسم المنتج',group:'details'},
    {id:'before_options',name:'قبل الخيارات',group:'details'},
    {id:'beside_size',name:'بجانب عنوان المقاس',group:'details'},
    {id:'above_cart',name:'فوق زر السلة',group:'details'},
    {id:'beside_cart',name:'بجانب زر السلة',group:'details'},
    {id:'image_top_right',name:'الصورة · أعلى اليمين',group:'image'},
    {id:'image_top_left',name:'الصورة · أعلى اليسار',group:'image'},
    {id:'image_bottom_right',name:'الصورة · أسفل اليمين',group:'image'},
    {id:'image_bottom_left',name:'الصورة · أسفل اليسار',group:'image'},
    {id:'floating_left',name:'عائم أسفل اليسار',group:'floating'},
    {id:'floating_right',name:'عائم أسفل اليمين',group:'floating'},
    {id:'side_tab',name:'لسان جانبي',group:'floating'},
    {id:'mobile_bar',name:'شريط ثابت للجوال',group:'floating'},
  ];
  const palettes = [
    {id:'ink',name:'أسود أنيق',color:'#202222',text:'#ffffff'},
    {id:'emerald',name:'زمردي',color:'#165b43',text:'#ffffff'},
    {id:'gold',name:'ذهبي هادئ',color:'#d2ad57',text:'#302713'},
    {id:'rose',name:'وردي ناعم',color:'#f2c9d7',text:'#5c2135'},
    {id:'cream',name:'بيج كريمي',color:'#ece1ca',text:'#493d2a'},
    {id:'navy',name:'كحلي ملكي',color:'#23375b',text:'#ffffff'},
    {id:'wine',name:'عنابي',color:'#76283b',text:'#ffffff'},
    {id:'white',name:'أبيض بسيط',color:'#ffffff',text:'#283532'},
    {id:'violet',name:'بنفسجي',color:'#5745a5',text:'#ffffff'},
    {id:'dusty',name:'روز هادئ',color:'#a96170',text:'#ffffff'},
  ];
  const colors=['background_color','text_color','border_color','icon_color','secondary_text_color'];
  const hasSubtitle=design=>['band','card'].includes(design);
  function defaults(design='outline') {
    const legacy=design==='floating';
    if(legacy)design='pill';
    if(!designs.some(d=>d.id===design))design='outline';
    const s={design,label:'',subtitle:'اختاري مقاسك بثقة',placement:legacy?'floating_left':'above_price',
      mobile_placement:'inherit',alignment:'start',size:'medium',edge_offset:16,bottom_offset:legacy?24:88,
      background_color:'#ffffff',text_color:'#243c30',border_color:'#d9e3dc',icon_color:'#243c30',secondary_text_color:'#63756a'};
    if(['solid','pill','icon'].includes(design))Object.assign(s,{background_color:'#263a30',text_color:'#ffffff',border_color:'#263a30',icon_color:'#ffffff',secondary_text_color:'#e5eee7'});
    if(['soft','band'].includes(design))Object.assign(s,{background_color:'#edf4ef',border_color:'#edf4ef'});
    return s;
  }
  function normalize(raw={}) {
    const s=defaults(raw?.design);
    for(const key of colors)if(/^#[0-9a-fA-F]{6}$/.test(raw?.[key]))s[key]=raw[key];
    for(const [key,max] of [['label',40],['subtitle',80]])if(typeof raw?.[key]==='string')s[key]=raw[key].trim().slice(0,max);
    if(placements.some(p=>p.id===raw?.placement))s.placement=raw.placement;
    if(raw?.mobile_placement==='inherit'||placements.some(p=>p.id===raw?.mobile_placement))s.mobile_placement=raw.mobile_placement;
    if(['start','center','end'].includes(raw?.alignment))s.alignment=raw.alignment;
    if(['small','medium','large'].includes(raw?.size))s.size=raw.size;
    for(const [key,max] of [['edge_offset',48],['bottom_offset',240]])if(Number.isInteger(raw?.[key])&&raw[key]>=0&&raw[key]<=max)s[key]=raw[key];
    return s;
  }
  function paletteColors(id,design) {
    const p=palettes.find(item=>item.id===id)||palettes[0];
    const quiet=['link','outline','dashed','row','tile','split','card'].includes(design);
    const ink=p.id==='white'?'#283532':(quiet&&['gold','rose','cream'].includes(p.id)?p.text:p.color);
    return {background_color:quiet?'#ffffff':p.color,text_color:quiet?ink:p.text,
      border_color:quiet?ink:(p.id==='white'?'#dce3df':p.color),icon_color:quiet?ink:p.text,
      secondary_text_color:quiet?ink:p.text};
  }
  const css=`:host{display:block;direction:rtl;max-width:100%;color-scheme:light;font-family:inherit}*{box-sizing:border-box}
    button{display:inline-flex;align-items:center;justify-content:center;gap:9px;max-width:100%;min-height:44px;
      padding:10px 16px;border:1px solid var(--sg-border);border-radius:8px;background:var(--sg-bg);color:var(--sg-text);
      font-family:inherit;font-size:14px;line-height:1.55;cursor:pointer;text-align:right;overflow-wrap:anywhere;vertical-align:middle;
      -webkit-tap-highlight-color:transparent;transition:filter .15s,box-shadow .15s;box-shadow:none}
    button:hover:not(:disabled){filter:brightness(.94)}button:disabled{opacity:.65;cursor:wait}
    button:focus-visible{outline:3px solid var(--sg-icon);outline-offset:3px}
    .icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sg-icon)}
    .icon svg{display:block;width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}
    .copy{display:flex;flex-direction:column;min-width:0;gap:2px}.label{font-weight:600}.sub{color:var(--sg-secondary);font-size:12px;font-weight:400}
    .link{background:transparent;border:0;border-radius:0;padding:6px 2px;text-decoration:underline;text-underline-offset:5px}
    .pill{border-radius:999px;padding-inline:21px}.solid{border-radius:7px}.soft{border-color:transparent;border-radius:10px}
    .dashed{border-style:dashed;border-width:1.5px;border-radius:8px}
    .split{padding:0;gap:0;overflow:hidden}.split>.icon{align-self:stretch;background:var(--sg-icon);color:var(--sg-bg);padding:12px}
    .split .copy{padding:9px 15px}.band,.card,.row{width:100%;justify-content:flex-start}
    .band{padding:13px 16px;border-radius:10px}.arrow{margin-inline-start:auto;font-size:20px;flex-shrink:0;color:var(--sg-icon)}
    .card{padding:0;gap:12px;overflow:hidden;border-radius:12px}.card>.icon{align-self:stretch;min-height:64px;width:52px;background:color-mix(in srgb,var(--sg-icon) 9%,var(--sg-bg))}
    .card .copy{padding:10px 0}.units{color:var(--sg-secondary);font-size:10px;margin-inline-start:auto;margin-inline-end:10px;white-space:nowrap;padding:4px 6px;border:1px solid var(--sg-border);border-radius:5px}
    button.icon-only{width:46px;height:46px;min-width:44px;padding:0;border-radius:50%;box-shadow:0 3px 12px #0002}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .row{border-width:0 0 1px;border-radius:0;background:transparent;padding:12px 2px}
    .tile{flex-direction:column;gap:5px;min-width:96px;max-width:180px;padding:12px;border-radius:12px;text-align:center}
    .tile .icon svg{width:25px;height:25px}.tile .label{font-size:12px}
    button[data-size=small]{font-size:12px;padding:8px 12px}button[data-size=large]{font-size:16px;min-height:50px;padding:12px 20px}
    .split[data-size]{padding:0}.icon-only[data-size]{padding:0}.icon-only[data-size=large]{width:52px;height:52px}
    .card[data-size]{padding:0}.tile[data-size=small]{padding:9px}
    @media(prefers-reduced-motion:reduce){button{transition:none}}`;
  function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
  function ruler(){
    const icon=node('span',undefined,'icon');icon.setAttribute('aria-hidden','true');
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');
    const group=document.createElementNS(ns,'g');group.setAttribute('transform','rotate(-35 12 12)');
    const rect=document.createElementNS(ns,'rect');for(const [key,value] of Object.entries({x:2,y:7,width:20,height:10,rx:1.5}))rect.setAttribute(key,value);
    group.append(rect);for(const x of [6,10,14,18]){const line=document.createElementNS(ns,'path');line.setAttribute('d',`M${x} 7v${x===10||x===18?5:3}`);group.append(line);}
    svg.append(group);icon.append(svg);return icon;
  }
  function render(host,raw,guide={},onClick=()=>{}){
    const settings=normalize(raw),root=host.shadowRoot||host.attachShadow({mode:'open'});
    root.replaceChildren();host.dataset.design=settings.design;
    const style=node('style',css),button=node('button',undefined,settings.design==='icon'?'icon-only':settings.design);button.type='button';button.dataset.size=settings.size;
    button.setAttribute('aria-haspopup','dialog');
    const text=settings.label||guide.button_label||'دليل المقاسات';button.setAttribute('aria-label',text);button.title=text;
    for(const [key,variable] of Object.entries({background_color:'bg',text_color:'text',border_color:'border',icon_color:'icon',secondary_text_color:'secondary'}))button.style.setProperty('--sg-'+variable,settings[key]);
    const copy=node('span',undefined,settings.design==='icon'?'copy sr-only':'copy');copy.append(node('span',text,'label'));
    if(hasSubtitle(settings.design)&&settings.subtitle)copy.append(node('span',settings.subtitle,'sub'));
    button.append(ruler(),copy);
    if(['band','row'].includes(settings.design)){const arrow=node('span','←','arrow');arrow.setAttribute('aria-hidden','true');button.append(arrow);}
    if(settings.design==='card')button.append(node('span','سم / إنش','units'));
    button.addEventListener('click',event=>{event.stopPropagation();onClick(event);});
    button.addEventListener('pointerdown',event=>event.stopPropagation());
    root.append(style,button);return {button,settings};
  }
  window.SizeGuideButton={designs,placements,palettes,colors,defaults,normalize,paletteColors,hasSubtitle,render};
})();
