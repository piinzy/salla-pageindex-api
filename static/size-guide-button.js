/* One renderer for the storefront and the merchant's live preview. */
(() => {
  'use strict';
  const designs = [
    {id:'link',name:'رابط أنيق',hint:'نص واضح مع خط سفلي'},
    {id:'outline',name:'إطار رفيع',hint:'حدود هادئة ومساحة بيضاء'},
    {id:'solid',name:'ممتلئ',hint:'لون قوي وحواف ناعمة'},
    {id:'pill',name:'الكبسولة',hint:'حواف دائرية بالكامل'},
    {id:'soft',name:'لمسة ناعمة',hint:'خلفية خفيفة بلون الهوية'},
    {id:'dashed',name:'إطار متقطع',hint:'إيحاء بشريط القياس'},
    {id:'split',name:'زر مقسوم',hint:'مساحة مستقلة للأيقونة'},
    {id:'band',name:'شريط إرشادي',hint:'عرض كامل مع نص مساعد'},
    {id:'card',name:'بطاقة القياس',hint:'بطاقة مع وصف ووحدات القياس'},
    {id:'icon',name:'أيقونة دائرية',hint:'زر مختصر مناسب لصورة المنتج'},
    {id:'row',name:'صف بسهم',hint:'نص وسهم وخط سفلي'},
    {id:'tile',name:'مربع عمودي',hint:'أيقونة فوق النص'},
    {id:'gradient',name:'متدرج',hint:'تدرج لوني ناعم يمنح عمقًا'},
    {id:'glass',name:'زجاجي',hint:'شفاف مع تمويه، مناسب فوق الصورة'},
    {id:'raised',name:'مجسّم',hint:'زر بارز بحافة سفلية يضغط عند اللمس'},
    {id:'chip',name:'شارة صغيرة',hint:'شارة مدمجة بنقطة لونية'},
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
  const icons = [
    {id:'ruler',name:'مسطرة'},{id:'shirt',name:'قميص'},{id:'shoe',name:'حذاء'},
    {id:'paw',name:'مخلب'},{id:'tape',name:'شريط قياس'},{id:'none',name:'بدون'},
  ];
  const depths = [{id:'flat',name:'مسطح'},{id:'soft',name:'ناعم'},{id:'raised',name:'بارز'},{id:'deep',name:'عميق'}];
  const effects = [{id:'none',name:'بدون'},{id:'lift',name:'رفع'},{id:'tilt',name:'إمالة 3D'}];
  const MAX_EXTRA = 3, colors = ['background_color','text_color','border_color','icon_color','secondary_text_color'];
  const hasSubtitle = design => ['band','card'].includes(design);
  const SOLID = ['solid','pill','icon','gradient','raised'], SOFT = ['soft','band','chip'];
  const pick = (value, list, fallback) => list.includes(value) ? value : fallback;
  const ids = list => list.map(item => item.id);

  function defaults(design = 'outline') {
    const legacy = design === 'floating';
    if (legacy) design = 'pill';
    if (!designs.some(d => d.id === design)) design = 'outline';
    const s = {design, label:'', subtitle:'اختاري مقاسك بثقة', placement:legacy ? 'floating_left' : 'above_price',
      mobile_placement:'inherit', devices:'all', alignment:'start', size:'medium', scale:100, width:'auto', radius:-1,
      depth:'soft', effect:'lift', icon:'ruler', edge_offset:16, bottom_offset:legacy ? 24 : 88,
      background_color:'#ffffff', text_color:'#243c30', border_color:'#d9e3dc', icon_color:'#243c30', secondary_text_color:'#63756a'};
    if (SOLID.includes(design)) Object.assign(s, {background_color:'#263a30', text_color:'#ffffff', border_color:'#263a30', icon_color:'#ffffff', secondary_text_color:'#e5eee7'});
    if (SOFT.includes(design)) Object.assign(s, {background_color:'#edf4ef', border_color:'#edf4ef'});
    if (design === 'glass') Object.assign(s, {background_color:'#ffffff', border_color:'#ffffff', text_color:'#1f2f27', icon_color:'#1f2f27'});
    return s;
  }
  function normalizeOne(raw = {}) {
    const s = defaults(raw?.design);
    for (const key of colors) if (/^#[0-9a-fA-F]{6}$/.test(raw?.[key])) s[key] = raw[key];
    for (const [key, max] of [['label',40],['subtitle',80]]) if (typeof raw?.[key] === 'string') s[key] = raw[key].trim().slice(0, max);
    if (placements.some(p => p.id === raw?.placement)) s.placement = raw.placement;
    if (raw?.mobile_placement === 'inherit' || placements.some(p => p.id === raw?.mobile_placement)) s.mobile_placement = raw.mobile_placement;
    s.devices = pick(raw?.devices, ['all','desktop','mobile'], s.devices);
    s.alignment = pick(raw?.alignment, ['start','center','end'], s.alignment);
    s.size = pick(raw?.size, ['small','medium','large'], s.size);
    s.width = pick(raw?.width, ['auto','full'], s.width);
    s.depth = pick(raw?.depth, ids(depths), s.depth);
    s.effect = pick(raw?.effect, ids(effects), s.effect);
    s.icon = pick(raw?.icon, ids(icons), s.icon);
    for (const [key, min, max] of [['edge_offset',0,48],['bottom_offset',0,240],['scale',70,150],['radius',-1,32]])
      if (Number.isInteger(raw?.[key]) && raw[key] >= min && raw[key] <= max) s[key] = raw[key];
    return s;
  }
  function normalize(raw = {}) {
    const s = normalizeOne(raw);
    s.extra_buttons = Array.isArray(raw?.extra_buttons) ? raw.extra_buttons.slice(0, MAX_EXTRA).map(normalizeOne) : [];
    return s;
  }
  function paletteColors(id, design) {
    const p = palettes.find(item => item.id === id) || palettes[0];
    const quiet = ['link','outline','dashed','row','tile','split','card'].includes(design);
    const ink = p.id === 'white' ? '#283532' : (quiet && ['gold','rose','cream'].includes(p.id) ? p.text : p.color);
    return {background_color:quiet ? '#ffffff' : p.color, text_color:quiet ? ink : p.text,
      border_color:quiet ? ink : (p.id === 'white' ? '#dce3df' : p.color), icon_color:quiet ? ink : p.text,
      secondary_text_color:quiet ? ink : p.text};
  }
  const css = `:host{display:block;direction:rtl;max-width:100%;color-scheme:light;font-family:inherit}*{box-sizing:border-box}
    button{--fs:14px;--ty:0px;--rx:0deg;--ry:0deg;--sg-edge:color-mix(in srgb,var(--sg-bg) 78%,#000);position:relative;display:inline-flex;align-items:center;justify-content:center;gap:.65em;max-width:100%;
      font-size:calc(var(--fs) * var(--sg-scale,1));min-height:max(44px,3.15em);padding:.7em 1.15em;border:1px solid var(--sg-border);
      border-radius:var(--sg-radius,.6em);background:var(--sg-bg);color:var(--sg-text);font-family:inherit;line-height:1.5;cursor:pointer;text-align:right;
      overflow-wrap:anywhere;vertical-align:middle;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
      transform:translateY(var(--ty)) perspective(640px) rotateX(var(--rx)) rotateY(var(--ry));
      transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s,filter .15s}
    button[data-size=small]{--fs:12px}button[data-size=large]{--fs:16px}
    button[data-width=full]{width:100%;justify-content:center}
    button[data-depth=soft]{box-shadow:0 1px 2px #0000001f,0 6px 14px -6px #00000045}
    button[data-depth=raised]{margin-bottom:3px;box-shadow:inset 0 1px 0 #ffffff59,0 3px 0 var(--sg-edge),0 9px 14px -7px #0000004d}
    button[data-depth=deep]{margin-bottom:5px;box-shadow:inset 0 1px 0 #ffffff73,inset 0 -2px 0 #0000001f,0 5px 0 var(--sg-edge),0 18px 26px -10px #00000070}
    @media(hover:hover){button[data-effect=lift]:hover:not(:disabled){--ty:-2px}button[data-effect=none]:hover:not(:disabled){filter:brightness(.95)}
      button[data-depth=soft][data-effect=lift]:hover:not(:disabled){box-shadow:0 2px 3px #00000024,0 12px 20px -8px #00000055}}
    button:active:not(:disabled){--ty:1px;--rx:0deg;--ry:0deg}
    button[data-depth=raised]:active:not(:disabled){--ty:3px;box-shadow:inset 0 1px 0 #ffffff40,0 0 0 var(--sg-edge),0 2px 5px -2px #0000004d}
    button[data-depth=deep]:active:not(:disabled){--ty:4px;box-shadow:inset 0 1px 0 #ffffff40,0 1px 0 var(--sg-edge),0 4px 8px -4px #0000004d}
    button:disabled{opacity:.65;cursor:wait}button:focus-visible{outline:3px solid var(--sg-icon);outline-offset:3px}
    .icon{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--sg-icon)}
    .icon svg{display:block;width:1.5em;height:1.5em;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}
    .copy{display:flex;flex-direction:column;min-width:0;gap:2px}.label{font-weight:600}.sub{color:var(--sg-secondary);font-size:.86em;font-weight:400}
    .link{background:transparent;border:0;border-radius:0;padding:.4em .15em;text-decoration:underline;text-underline-offset:.35em}
    .pill{border-radius:var(--sg-radius,999px);padding-inline:1.5em}.solid{border-radius:var(--sg-radius,.5em)}.soft{border-color:transparent;border-radius:var(--sg-radius,.7em)}
    .dashed{border-style:dashed;border-width:1.5px}
    .split{padding:0;gap:0;overflow:hidden}.split>.icon{align-self:stretch;background:var(--sg-icon);color:var(--sg-bg);padding:0 .9em}
    .split .copy{padding:.65em 1.1em}.band,.card,.row{width:100%;justify-content:flex-start}
    .band{padding:.9em 1.15em;border-radius:var(--sg-radius,.7em)}.arrow{margin-inline-start:auto;font-size:1.4em;flex-shrink:0;color:var(--sg-icon)}
    .card{padding:0;gap:.85em;overflow:hidden;border-radius:var(--sg-radius,.85em)}
    .card>.icon{align-self:stretch;min-height:4.6em;width:3.7em;background:color-mix(in srgb,var(--sg-icon) 9%,var(--sg-bg))}
    .card .copy{padding:.7em 0}.units{color:var(--sg-secondary);font-size:.72em;margin-inline-start:auto;margin-inline-end:.9em;white-space:nowrap;padding:.3em .5em;border:1px solid var(--sg-border);border-radius:.4em}
    button.icon-only{width:max(44px,3.3em);height:max(44px,3.3em);min-width:44px;padding:0;border-radius:50%}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    .row{border-width:0 0 1px;border-radius:0;background:transparent;padding:.8em .15em}
    .tile{flex-direction:column;gap:.35em;min-width:7em;max-width:13em;padding:.85em;border-radius:var(--sg-radius,.85em);text-align:center}
    .tile .icon svg{width:1.8em;height:1.8em}.tile .label{font-size:.86em}
    .gradient{border-color:transparent;border-radius:var(--sg-radius,.75em);
      background:linear-gradient(135deg,color-mix(in srgb,var(--sg-bg) 78%,#fff),var(--sg-bg) 52%,color-mix(in srgb,var(--sg-bg) 80%,#000))}
    .glass{background:color-mix(in srgb,var(--sg-bg) 58%,transparent);-webkit-backdrop-filter:blur(12px) saturate(1.4);backdrop-filter:blur(12px) saturate(1.4);
      border-color:color-mix(in srgb,var(--sg-border) 55%,transparent);border-radius:var(--sg-radius,.9em)}
    .raised{border-radius:var(--sg-radius,.8em);border-color:var(--sg-edge)}
    .chip{border-radius:var(--sg-radius,999px);padding:.4em 1.05em;gap:.55em;min-height:44px}.chip .icon{display:none}
    .chip:before{content:'';width:.6em;height:.6em;border-radius:50%;background:var(--sg-icon);box-shadow:0 0 0 .24em color-mix(in srgb,var(--sg-icon) 22%,transparent)}
    @media(prefers-reduced-motion:reduce){button{transition:none;transform:none!important}}`;
  const NS = 'http://www.w3.org/2000/svg';
  const glyphs = {
    shirt:[['path','M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z']],
    shoe:[['path','M3 17v-4.5A1.5 1.5 0 0 1 4.5 11H8l2-3.5 2.5 2.5H15a6 6 0 0 1 6 6V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z'],['path','M3 20.5h18']],
    paw:[['circle',{cx:5.5,cy:10.5,r:1.8}],['circle',{cx:9.5,cy:5.8,r:1.8}],['circle',{cx:14.5,cy:5.8,r:1.8}],['circle',{cx:18.5,cy:10.5,r:1.8}],
      ['path','M12 11c-3 0-5.5 3-5.5 5.5 0 2 1.5 3 3 3 1 0 1.5-.5 2.5-.5s1.5.5 2.5.5c1.5 0 3-1 3-3C17.5 14 15 11 12 11z']],
    tape:[['circle',{cx:9,cy:12,r:6}],['circle',{cx:9,cy:12,r:1.8}],['path','M15 14h7M17.5 14v2.5M20 14v1.5']],
  };
  function node(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
  function shape(svg, tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(typeof attrs === 'string' ? {d:attrs} : attrs)) e.setAttribute(key, value);
    svg.append(e);
  }
  function icon(name) {
    const holder = node('span', undefined, 'icon'); holder.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 24 24');
    if (glyphs[name]) for (const [tag, attrs] of glyphs[name]) shape(svg, tag, attrs);
    else {
      const group = document.createElementNS(NS, 'g'); group.setAttribute('transform', 'rotate(-35 12 12)');
      shape(group, 'rect', {x:2, y:7, width:20, height:10, rx:1.5});
      for (const x of [6,10,14,18]) shape(group, 'path', `M${x} 7v${x === 10 || x === 18 ? 5 : 3}`);
      svg.append(group);
    }
    holder.append(svg); return holder;
  }
  function tilt(button) {
    if (!window.matchMedia?.('(hover:hover) and (prefers-reduced-motion:no-preference)').matches) return;
    button.addEventListener('pointermove', event => {
      const box = button.getBoundingClientRect(), x = (event.clientX - box.left) / box.width - .5, y = (event.clientY - box.top) / box.height - .5;
      button.style.setProperty('--ry', (x * 10).toFixed(1) + 'deg'); button.style.setProperty('--rx', (-y * 8).toFixed(1) + 'deg'); button.style.setProperty('--ty', '-2px');
    });
    button.addEventListener('pointerleave', () => { for (const key of ['--ry','--rx','--ty']) button.style.removeProperty(key); });
  }
  function render(host, raw, guide = {}, onClick = () => {}) {
    const settings = normalizeOne(raw), root = host.shadowRoot || host.attachShadow({mode:'open'});
    root.replaceChildren(); host.dataset.design = settings.design;
    const style = node('style', css), button = node('button', undefined, settings.design === 'icon' ? 'icon-only' : settings.design); button.type = 'button';
    const flat = ['link','row'].includes(settings.design);
    button.dataset.size = settings.size; button.dataset.width = settings.width; button.dataset.effect = settings.effect;
    button.dataset.depth = flat ? 'flat' : settings.design === 'raised' && ['flat','soft'].includes(settings.depth) ? 'raised' : settings.depth;
    button.setAttribute('aria-haspopup', 'dialog');
    const text = settings.label || guide.button_label || 'دليل المقاسات'; button.setAttribute('aria-label', text); button.title = text;
    for (const [key, variable] of Object.entries({background_color:'bg', text_color:'text', border_color:'border', icon_color:'icon', secondary_text_color:'secondary'})) button.style.setProperty('--sg-' + variable, settings[key]);
    if (settings.scale !== 100) button.style.setProperty('--sg-scale', String(settings.scale / 100));
    if (settings.radius >= 0 && settings.design !== 'icon') button.style.setProperty('--sg-radius', settings.radius + 'px');
    const copy = node('span', undefined, settings.design === 'icon' ? 'copy sr-only' : 'copy'); copy.append(node('span', text, 'label'));
    if (hasSubtitle(settings.design) && settings.subtitle) copy.append(node('span', settings.subtitle, 'sub'));
    const glyph = settings.icon === 'none' && settings.design !== 'icon' ? null : icon(settings.icon === 'none' ? 'ruler' : settings.icon);
    if (glyph) button.append(glyph);
    button.append(copy);
    if (['band','row'].includes(settings.design)) { const arrow = node('span', '←', 'arrow'); arrow.setAttribute('aria-hidden', 'true'); button.append(arrow); }
    if (settings.design === 'card') button.append(node('span', 'سم / إنش', 'units'));
    if (settings.effect === 'tilt') tilt(button);
    button.addEventListener('click', event => { event.stopPropagation(); onClick(event); });
    button.addEventListener('pointerdown', event => event.stopPropagation());
    root.append(style, button); return {button, settings};
  }
  window.SizeGuideButton = {designs, placements, palettes, icons, icon, depths, effects, MAX_EXTRA, colors, defaults, normalize, normalizeOne, paletteColors, hasSubtitle, render};
})();
