/* One renderer for the storefront and the merchant's live preview. */
(() => {
  'use strict';
  const designs = [
    {id:'link',name:'رابط تحريري',hint:'خط دقيق تحت الاسم',family:'line'},
    {id:'row',name:'سطر بسهم',hint:'سطر مستقل بسهم نهاية',family:'line'},
    {id:'bracket',name:'زوايا مفتوحة',hint:'أربع زوايا تحيط بالعنوان',family:'line'},
    {id:'bookmark',name:'علامة الهامش',hint:'شريط صغير بعلامة مطوية',family:'line'},
    {id:'chip',name:'وسم المقاس',hint:'وسم صغير بأيقونة ونقطة طرفية',family:'line'},
    {id:'outline',name:'إطار رفيع',hint:'إطار واحد بزوايا شبه مستقيمة',family:'frame'},
    {id:'doubleline',name:'إطار مزدوج',hint:'خطّان متوازيان حول الزر',family:'frame'},
    {id:'dashed',name:'غرزة الحافة',hint:'إطار داخلي بغرز متقطعة',family:'frame'},
    {id:'split',name:'خانة الأيقونة',hint:'حيّز مستقل للأيقونة',family:'frame'},
    {id:'ticket',name:'تذكرة القياس',hint:'حافة مثقّبة تفصل طرف التذكرة',family:'frame'},
    {id:'solid',name:'حبر مصمت',hint:'كتلة لونية بزوايا مستقيمة',family:'fill'},
    {id:'pill',name:'كبسولة',hint:'طرفان مستديران ومساحة واسعة',family:'fill'},
    {id:'soft',name:'ورق مطفأ',hint:'خلفية خفيفة وشريط جانبي',family:'fill'},
    {id:'gradient',name:'ساتان',hint:'تدرج خفيف ولمعة مائلة',family:'fill'},
    {id:'raised',name:'حافة بارزة',hint:'حافة سفلية تمنح الزر عمقًا',family:'fill'},
    {id:'band',name:'شريط إرشادي',hint:'سطر مساعد وسهم للفتح',family:'badge'},
    {id:'card',name:'بطاقة القياس',hint:'وصف مع وحدات القياس',family:'badge'},
    {id:'tile',name:'بطاقة عمودية',hint:'أيقونة كبيرة فوق العنوان',family:'badge'},
    {id:'glass',name:'شارة زجاجية',hint:'خلفية شفافة تناسب صور المنتجات',family:'badge'},
    {id:'icon',name:'ختم دائري',hint:'أيقونة فقط داخل حلقة',family:'badge'},
    {id:'folio',name:'لسان الفهرس',hint:'بطاقة لها لسان قصير أعلى الحافة',family:'paper'},
    {id:'dogear',name:'طرف مطوي',hint:'ورقة بزاوية مطوية',family:'paper'},
    {id:'binder',name:'دفتر الحلقتين',hint:'حلقتان على طرف الغلاف',family:'paper'},
    {id:'hangtag',name:'بطاقة تعليق',hint:'ثقب صغير في رأس بطاقة مدبّب',family:'paper'},
    {id:'stack',name:'أوراق متراكبة',hint:'ورقتان بإزاحة خفيفة خلف العنوان',family:'paper'},
    {id:'ruleredge',name:'تدريج المسطرة',hint:'تدريج منتظم أسفل الاسم',family:'measure'},
    {id:'dimensionline',name:'خط الأبعاد',hint:'خط قياس ينتهي بعلامتين على الطرفين',family:'measure'},
    {id:'caliper',name:'فكّا المقياس',hint:'طرفان متقابلان بارتفاعين مختلفين',family:'measure'},
    {id:'draftgrid',name:'شبكة الباترون',hint:'مربع شبكي يفصل الأيقونة عن النص',family:'measure'},
    {id:'stitchpath',name:'مسار الخياطة',hint:'مسار متقطع يصل الأيقونة بطرف الزر',family:'measure'},
    {id:'medallion',name:'ميدالية جانبية',hint:'أيقونة محاطة بحلقتين عند طرف العنوان',family:'iconwork'},
    {id:'lozenge',name:'معيّن الأيقونة',hint:'أيقونة داخل معيّن بلون الحبر',family:'iconwork'},
    {id:'archmark',name:'نافذة مقوّسة',hint:'إطار مقوّس مستقل حول الأيقونة',family:'iconwork'},
    {id:'satellite',name:'حلقة مدارية',hint:'حلقة مائلة خلف رمز دائري',family:'iconwork'},
    {id:'bookend',name:'غلاف جانبي',hint:'مساحة ممتلئة تلتف حول الأيقونة',family:'iconwork'},
    {id:'plusrow',name:'سطر بعلامة الجمع',hint:'خط فاصل وعلامة فتح في طرف السطر',family:'rows'},
    {id:'arrowblock',name:'سهم في مربع',hint:'خانة مستقلة للسهم في نهاية الصف',family:'rows'},
    {id:'dotleader',name:'فهرس منقّط',hint:'نقاط تصل العنوان بعلامة الفتح',family:'rows'},
    {id:'guidepost',name:'لافتة اتجاه',hint:'رأس سهم في نهاية الشريط',family:'rows'},
    {id:'captionline',name:'عنوان فوق الخط',hint:'عنوان ووصف قصير بين خطين',family:'rows'},
    {id:'chamfer',name:'زوايا مشطوفة',hint:'مستطيل بأربع زوايا مقطوعة',family:'geometry'},
    {id:'archway',name:'بوابة مقوّسة',hint:'قوس علوي عريض وقاعدة مستقيمة',family:'geometry'},
    {id:'stadiumcut',name:'نصف كبسولة',hint:'طرف دائري وطرف مستقيم',family:'geometry'},
    {id:'facet',name:'واجهة مائلة',hint:'إطار مائل حول عنوان مستقيم',family:'geometry'},
    {id:'petal',name:'ورقة هندسية',hint:'زاويتان متقابلتان بانحناء كبير',family:'geometry'},
    {id:'selvedge',name:'حاشية منسوجة',hint:'شريط نسج رفيع يحدّ الطرفين',family:'fabric'},
    {id:'herringbone',name:'نسيج متعرّج',hint:'تفصيل متعرّج على جانب الزر',family:'fabric'},
    {id:'pleats',name:'طيات متوازية',hint:'ثلاث طيّات عند طرف الشارة',family:'fabric'},
    {id:'patch',name:'رقعة قماش',hint:'رقعة مستديرة بغرزة داخلية',family:'fabric'},
    {id:'hem',name:'ثنية الحافة',hint:'لسان مرفوع أسفل الطرف',family:'fabric'},
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
    {id:'paw',name:'مخلب'},{id:'tape',name:'شريط قياس'},
    {id:'ruler_flat',name:'مسطرة أفقية'},{id:'ruler_tall',name:'مسطرة عمودية'},{id:'ruler_double',name:'مسطرة سم وإنش'},{id:'ruler_pencil',name:'مسطرة وقلم'},{id:'ruler_set',name:'مسطرة مثلثة'},
    {id:'tape_case',name:'شريط بعلبة'},{id:'tape_retract',name:'شريط سحب'},{id:'tape_coil',name:'شريط ملفوف'},{id:'tape_wave',name:'شريط مرن'},{id:'tape_body',name:'شريط الخياطة'},
    {id:'hanger',name:'علّاقة'},
    {id:'dress',name:'فستان'},
    {id:'mannequin',name:'مانيكان'},
    {id:'spool',name:'بكرة خيط'},
    {id:'french_curve',name:'مسطرة منحنيات'},
    {id:'scissors',name:'مقص خياطة'},
    {id:'pattern',name:'باترون'},
    {id:'dimension',name:'عرض القطعة'},
    {id:'none',name:'بدون'},
  ];
  const depths = [{id:'flat',name:'مسطح'},{id:'soft',name:'ناعم'},{id:'raised',name:'بارز'},{id:'deep',name:'عميق'}];
  const effects = [{id:'none',name:'بدون'},{id:'lift',name:'رفع'},{id:'tilt',name:'إمالة 3D'}];
  const MAX_EXTRA = 3, colors = ['background_color','text_color','border_color','icon_color','secondary_text_color'];
  const hasSubtitle = design => ['band','card','captionline'].includes(design);
  const SOLID = ['solid','pill','icon','gradient','raised','guidepost','chamfer','stadiumcut','petal','pleats','hem'], SOFT = ['soft','band','chip','folio','binder','stitchpath','bookend','patch','herringbone'];
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
    const quiet = [
      'link','outline','dashed','row','tile','split','card','doubleline','bracket','bookmark','ticket',
      'folio','dogear','binder','hangtag','stack','ruleredge','dimensionline','caliper','draftgrid','stitchpath',
      'medallion','lozenge','archmark','satellite','bookend','plusrow','arrowblock','dotleader','captionline',
      'archway','facet','selvedge'
    ].includes(design);
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
    .chip{border-radius:var(--sg-radius,999px);padding:.4em 1.05em;gap:.55em;min-height:44px}
    button[data-depth=soft]{box-shadow:0 1px 2px #15181512}
    .link{text-decoration:none}.link .label{text-decoration:underline;text-underline-offset:.34em;text-decoration-thickness:1px}
    .row .arrow,.band .arrow{font-family:system-ui;font-size:1.25em;font-weight:400;line-height:1}
    .outline,.solid,.row{border-radius:var(--sg-radius,2px)}.outline{border-color:color-mix(in srgb,var(--sg-border) 65%,var(--sg-icon))}
    .chip{gap:.45em;border-radius:var(--sg-radius,.35em);padding:.45em .75em}.chip .icon{display:inline-flex}.chip .icon svg{width:1.15em}
    .chip:after{content:'';width:.32em;height:.32em;border-radius:50%;background:var(--sg-icon)}
    .dashed,.doubleline{border-radius:var(--sg-radius,3px);border:1px solid var(--sg-border);padding:.77em 1.35em}
    .dashed:after,.doubleline:after,.icon-only:after{content:'';position:absolute;inset:3px;border:1px solid var(--sg-icon);opacity:.52;border-radius:inherit;pointer-events:none}
    .dashed:after{border-style:dashed;inset:3px}.doubleline:after{inset:3px;border-color:var(--sg-border);opacity:1}
    .split{border-radius:var(--sg-radius,3px)}.split>.icon{padding:0 .7em}
    .bracket{border:0;border-radius:var(--sg-radius,0);background-color:var(--sg-bg);background-image:linear-gradient(var(--sg-icon),var(--sg-icon)),linear-gradient(var(--sg-icon),var(--sg-icon)),linear-gradient(var(--sg-icon),var(--sg-icon)),linear-gradient(var(--sg-icon),var(--sg-icon));background-repeat:no-repeat;background-size:7px 1px;background-position:left top,left bottom,right top,right bottom;border-inline:1px solid var(--sg-icon)}
    .bookmark{background:var(--sg-bg);border:0;border-radius:var(--sg-radius,0);padding-inline-start:1.7em}
    .bookmark:before{content:'';position:absolute;inset-inline-start:0;top:20%;width:.72em;height:58%;background:var(--sg-icon);clip-path:polygon(0 0,100% 0,100% 100%,50% 77%,0 100%)}
    .ticket{border-radius:var(--sg-radius,5px);padding-inline-end:2.2em;border-color:var(--sg-icon)}.ticket:after{content:'';position:absolute;inset-inline-end:.9em;top:.35em;bottom:.35em;border-inline-end:1px dashed var(--sg-icon);opacity:.7}
    .soft{border-radius:var(--sg-radius,3px);border-inline-start:3px solid var(--sg-icon)}.band{border-inline-start:3px solid var(--sg-icon);border-radius:var(--sg-radius,3px)}
    .card{border-radius:var(--sg-radius,4px)}.card .units{padding:.15em .4em;border-radius:2px}.tile{border-radius:var(--sg-radius,4px)}
    .glass{border-radius:var(--sg-radius,999px);background:color-mix(in srgb,var(--sg-bg) 70%,transparent);border:1px solid color-mix(in srgb,var(--sg-icon) 25%,var(--sg-border));backdrop-filter:blur(10px)}
    .raised{border-radius:var(--sg-radius,4px)}.gradient{border-radius:var(--sg-radius,.35em);background:linear-gradient(118deg,var(--sg-bg) 8%,color-mix(in srgb,var(--sg-bg) 78%,white) 38%,var(--sg-bg) 65%)}
    .icon-only:after{border-color:var(--sg-icon);border-radius:50%;opacity:.42}
    .card .copy:first-child,.split .copy:first-child{padding-inline-start:.9em}
    /* Paper, labels and bookbinding details. */
    .folio,.dogear,.binder,.hangtag,.stack{border-radius:var(--sg-radius,2px)}
    .folio{margin-top:.32em;border-block-start:2px solid var(--sg-icon)}
    .folio:before{content:'';position:absolute;bottom:100%;inset-inline-start:.65em;width:2.2em;height:.35em;border-radius:2px 2px 0 0;background:var(--sg-icon)}
    .dogear{padding-inline-end:1.65em;background:linear-gradient(45deg,transparent 48%,var(--sg-border) 50%,var(--sg-bg) 88%) left top/.95em .95em no-repeat,var(--sg-bg)}
    .dogear:after{content:'';position:absolute;inset:0 auto auto 0;width:.9em;height:.9em;border-right:1px solid var(--sg-icon);border-bottom:1px solid var(--sg-icon)}
    .binder{margin-inline-start:3px;padding-inline-start:1.6em;border-inline-start:.32em solid var(--sg-icon)}
    .binder:before,.binder:after{content:'';position:absolute;inset-inline-start:-.56em;width:.65em;height:.18em;border-radius:4px;background:var(--sg-icon);outline:1px solid var(--sg-bg)}
    .binder:before{top:25%}.binder:after{bottom:25%}
    .hangtag{border-color:var(--sg-icon);border-start-start-radius:var(--sg-radius,1.7em);border-end-start-radius:var(--sg-radius,1.7em);padding-inline-start:1.8em}
    .hangtag:before{content:'';position:absolute;inset-inline-start:.55em;width:.4em;height:.4em;border:1px solid var(--sg-icon);border-radius:50%}
    .stack{margin:0 0 5px 5px;border-color:var(--sg-icon)}
    .stack:before,.stack:after{content:'';position:absolute;inset:3px 2px -3px -3px;border:solid var(--sg-icon);border-width:0 0 1px 1px;border-radius:inherit;pointer-events:none}
    .stack:after{inset:6px 4px -6px -6px;opacity:.45}
    /* Measurement marks and technical drawings. */
    .ruleredge,.dimensionline,.caliper,.draftgrid,.stitchpath{border-radius:var(--sg-radius,2px)}
    .ruleredge{padding-block-end:1em}.ruleredge:after{content:'';position:absolute;inset:auto .4em 1px;height:.36em;background:repeating-linear-gradient(90deg,var(--sg-icon) 0 1px,transparent 1px .38em)}
    .dimensionline{border:0;padding-bottom:1.15em}.dimensionline:after{content:'';position:absolute;bottom:.25em;inset-inline:.4em;height:.6em;border-inline:1px solid var(--sg-icon);background:linear-gradient(var(--sg-icon),var(--sg-icon)) center/100% 1px no-repeat}
    .caliper{border:0;border-block-start:2px solid var(--sg-icon)}
    .caliper:before,.caliper:after{content:'';position:absolute;top:0;width:.45em;border-block-end:2px solid var(--sg-icon)}
    .caliper:before{inset-inline-start:0;height:80%;border-inline-start:2px solid var(--sg-icon)}
    .caliper:after{inset-inline-end:0;height:45%;border-inline-end:2px solid var(--sg-icon)}
    .draftgrid{padding-inline-start:3em;isolation:isolate}.draftgrid>.icon{position:absolute;inset-inline-start:.56em}
    .draftgrid:before{content:'';position:absolute;z-index:-1;inset-block:0;inset-inline-start:0;width:2.65em;border-inline-end:1px solid var(--sg-border);background-image:linear-gradient(var(--sg-border) 1px,transparent 1px),linear-gradient(90deg,var(--sg-border) 1px,transparent 1px);background-size:.45em .45em}
    .stitchpath{padding-inline-end:2.2em;border:0}.stitchpath:after{content:'';position:absolute;inset-inline-end:.45em;bottom:.4em;width:1.2em;height:50%;border:1px dashed var(--sg-icon);border-inline-start:0;border-top:0;border-end-end-radius:1em}
    /* Icon-led silhouettes. */
    .medallion,.lozenge,.archmark,.satellite,.bookend{gap:.8em;padding:.25em .42em .25em .85em}
    :is(.medallion,.lozenge,.archmark,.satellite,.bookend)>.icon{position:relative;width:2.5em;height:2.5em}
    .medallion{border-radius:var(--sg-radius,2em);border-width:0 0 1px}.medallion>.icon{border:3px double var(--sg-icon);border-radius:50%}
    .lozenge{border:0;border-block-end:1px solid var(--sg-border);border-radius:var(--sg-radius,0);padding-inline-start:.65em}
    .lozenge>.icon{isolation:isolate;color:var(--sg-bg);width:2.2em}.lozenge>.icon:before{content:'';position:absolute;z-index:-1;inset:.28em .14em;background:var(--sg-icon);transform:rotate(45deg);border-radius:2px}
    .archmark{border-radius:var(--sg-radius,2px)}.archmark>.icon{border:1px solid var(--sg-icon);border-radius:55% 55% 0 0;background:color-mix(in srgb,var(--sg-icon) 7%,var(--sg-bg))}
    .satellite{border:0;border-radius:var(--sg-radius,1.7em);padding-inline-start:.6em}.satellite>.icon{border-radius:50%;background:color-mix(in srgb,var(--sg-icon) 12%,var(--sg-bg))}
    .satellite>.icon:after{content:'';position:absolute;inset:.65em -.24em;border:1px solid var(--sg-icon);border-radius:50%;transform:rotate(-33deg);pointer-events:none}
    .bookend{padding:0;border-radius:var(--sg-radius,3px);overflow:hidden}.bookend>.icon{align-self:stretch;height:auto;min-height:3.2em;background:var(--sg-icon);color:var(--sg-bg);border-end-end-radius:1.5em}
    .bookend .copy{padding:.65em .8em}.bookend>.icon+.copy{padding-inline-start:0}
    /* Rows with clear end marks. */
    .plusrow,.arrowblock,.dotleader,.captionline{width:100%;justify-content:flex-start;border-radius:var(--sg-radius,0)}
    .plusrow{border-width:1px 0 0;padding-inline:.2em}.plusrow>.arrow{width:1.35em;height:1.35em;display:grid;place-items:center;border-radius:50%;border:1px solid var(--sg-icon);font:1.15em/1 Arial,sans-serif}
    .arrowblock{border-color:var(--sg-icon);padding:0 .75em 0 0;gap:.5em}.arrowblock>.arrow{align-self:stretch;display:grid;place-items:center;width:2em;color:var(--sg-bg);background:var(--sg-icon)}
    .dotleader{border:0;padding-inline:.15em;gap:.4em}.dotleader:after{content:'';min-width:.75em;flex:1;border-bottom:2px dotted var(--sg-icon);opacity:.55;order:2}.dotleader>.arrow{order:3;margin:0}
    .guidepost{border:0;padding-inline-end:1.85em;background:transparent;isolation:isolate;border-radius:var(--sg-radius,0)}
    .guidepost:before,.chamfer:before{content:'';position:absolute;inset:0;z-index:-1;background:var(--sg-bg);border-radius:inherit}
    .guidepost:before{clip-path:polygon(.8em 0,100% 0,100% 100%,.8em 100%,0 50%)}
    .captionline{border-width:1px 0;padding:.55em .4em}.captionline .sub{font-size:.76em;letter-spacing:0}
    /* Geometric profiles. */
    .chamfer{border:0;background:transparent;isolation:isolate;border-radius:var(--sg-radius,0)}
    .chamfer:before{clip-path:polygon(.55em 0,calc(100% - .55em) 0,100% .55em,100% calc(100% - .55em),calc(100% - .55em) 100%,.55em 100%,0 calc(100% - .55em),0 .55em)}
    .archway{border-radius:var(--sg-radius,50% 50% 2px 2px / 80% 80% 2px 2px);padding:1em 1.6em .45em;border-color:var(--sg-icon)}
    .stadiumcut{border-radius:var(--sg-radius,2em 2px 2px 2em);padding-inline:1.3em}
    .facet{background:transparent;border:0;isolation:isolate;padding-inline:1.4em}
    .facet:before{content:'';position:absolute;z-index:-1;inset:0 .27em;border:1px solid var(--sg-icon);background:var(--sg-bg);border-radius:var(--sg-radius,1px);transform:skewX(-13deg)}
    .petal{border-radius:var(--sg-radius,1.6em .1em);padding-inline:1.4em}
    /* Woven trims and seam finishes. */
    .selvedge{border-radius:var(--sg-radius,1px);padding-inline:1.35em}
    .selvedge:before,.selvedge:after{content:'';position:absolute;inset-block:0;width:.32em;background:repeating-linear-gradient(0deg,var(--sg-icon) 0 2px,var(--sg-bg) 2px 4px)}
    .selvedge:before{inset-inline-start:2px}.selvedge:after{inset-inline-end:2px}
    .herringbone{padding-inline-start:1.85em;border-radius:var(--sg-radius,3px)}
    .herringbone:before{content:'';position:absolute;inset-inline-start:.28em;inset-block:3px;width:.85em;background:repeating-linear-gradient(38deg,transparent 0 2px,var(--sg-icon) 2px 3px,transparent 3px 5px) left/50% 100% no-repeat,repeating-linear-gradient(-38deg,transparent 0 2px,var(--sg-icon) 2px 3px,transparent 3px 5px) right/50% 100% no-repeat}
    .pleats{padding-inline-end:2.15em;border-radius:var(--sg-radius,2px)}
    .pleats:after{content:'';position:absolute;inset-inline-end:.2em;inset-block:0;width:1.45em;background:repeating-linear-gradient(105deg,transparent 0 .28em,color-mix(in srgb,var(--sg-text) 38%,transparent) .32em,transparent .44em)}
    .patch{border:2px solid var(--sg-border);border-radius:var(--sg-radius,1.15em .65em);padding:.65em 1.3em}
    .patch:after{content:'';position:absolute;inset:3px;border:1px dashed var(--sg-icon);border-radius:inherit;opacity:.7}
    .hem{border-radius:var(--sg-radius,2px);margin-bottom:.32em}.hem:after{content:'';position:absolute;inset-inline-end:.38em;bottom:-.36em;width:1.4em;height:.5em;background:color-mix(in srgb,var(--sg-bg) 70%,var(--sg-text));clip-path:polygon(0 0,100% 0,77% 100%,0 100%)}
    @media(prefers-reduced-motion:reduce){button{transition:none;transform:none!important}}`;
  // The storefront and all gallery thumbnails share one parsed stylesheet per document.
  const sheets=new WeakMap();
  function styleRoot(root){
    const doc=root.ownerDocument;
    if('adoptedStyleSheets' in root && doc.defaultView?.CSSStyleSheet?.prototype.replaceSync){
      let sheet=sheets.get(doc);
      if(!sheet){
        sheet=new doc.defaultView.CSSStyleSheet();
        sheet.replaceSync(css);
        sheets.set(doc,sheet);
      }
      if(!root.adoptedStyleSheets.includes(sheet))root.adoptedStyleSheets=[...root.adoptedStyleSheets,sheet];
    }else root.append(node('style',css));
  }
  const NS = 'http://www.w3.org/2000/svg';
  const glyphs = {
    hanger:[['path','M9.5 7a2.5 2.5 0 1 1 4.2 1.8L12 10v2L3.3 17.1A1.1 1.1 0 0 0 3.9 19h16.2a1.1 1.1 0 0 0 .6-1.9L12 12']],
    dress:[['path','M9 3 7 6l2.6 4.5v2L5 21q7 2 14 0l-4.6-8.5v-2L17 6l-2-3q-3 4-6 0ZM9.6 12.5h4.8']],
    mannequin:[['path','M10 2h4v3l3 2-1.6 5L18 17q-6 2-12 0l2.6-5L7 7l3-2zM12 18v4m-3 0h6']],
    spool:[['path','M7 4h10v3H7zM7 17h10v3H7zM8.5 7v10m7-10v10m-7-7 7-2m-7 5 7-2m-7 5 7-2M17 19c4 0 2 4 5 3']],
    french_curve:[['path','M5 19c-3-2-2.2-6 .8-6.5 3.5-.6 5-4.3 5.4-6.6.7-4.6 5.4-5 7.5-1.7s-.8 6.6-3.6 6c-2.9-.5-4 2.4-3 4.7 1.4 3.8-3.2 7-7.1 4.1Zm10.3-13.4.1-.1']],
    scissors:[['path','M9 14.3 20 3m-9.4 8.2L20 20M9 9.7l2.7 2.5M9.3 7.1a3.1 3.1 0 1 1-6.2 0 3.1 3.1 0 0 1 6.2 0Zm0 9.6a3.1 3.1 0 1 1-6.2 0 3.1 3.1 0 0 1 6.2 0Z']],
    pattern:[['path','M5 3h9c-.3 3 1.1 5.4 4.2 6.3L20 20l-14.2 1L4 11l2-3zM9 6l-.8 3m-.7 3 .4 3m.4 2.5 2.8-.2m3-.2 2.4-.2']],
    dimension:[['path','M3 5v14m18-14v14M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4']],

    shirt:[['path','M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z']],
    shoe:[['path','M3 17v-4.5A1.5 1.5 0 0 1 4.5 11H8l2-3.5 2.5 2.5H15a6 6 0 0 1 6 6V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z'],['path','M3 20.5h18']],
    paw:[['circle',{cx:5.5,cy:10.5,r:1.8}],['circle',{cx:9.5,cy:5.8,r:1.8}],['circle',{cx:14.5,cy:5.8,r:1.8}],['circle',{cx:18.5,cy:10.5,r:1.8}],
      ['path','M12 11c-3 0-5.5 3-5.5 5.5 0 2 1.5 3 3 3 1 0 1.5-.5 2.5-.5s1.5.5 2.5.5c1.5 0 3-1 3-3C17.5 14 15 11 12 11z']],
    tape:[['circle',{cx:9,cy:12,r:6}],['circle',{cx:9,cy:12,r:1.8}],['path','M15 14h7M17.5 14v2.5M20 14v1.5']],
    ruler_flat:[['rect',{x:2,y:7,width:20,height:10,rx:1.6}],['path','M6 7v3.5M10 7v2M14 7v3.5M18 7v2']],
    ruler_tall:[['rect',{x:7,y:2,width:10,height:20,rx:1.6}],['path','M7 6h3.5M7 10h2M7 14h3.5M7 18h2']],
    ruler_double:[['rect',{x:2,y:6,width:20,height:12,rx:1.6}],['path','M6 6v3M9 6v2M12 6v3M15 6v2M18 6v3M5 18v-3M10 18v-2M15 18v-3M20 18v-2']],
    ruler_pencil:[['rect',{x:2,y:16,width:14,height:6,rx:1.4}],['path','M6 16v2.2M9.5 16v1.4M13 16v2.2'],
      ['path','M8 16l1-4 8.8-8.8a1.7 1.7 0 0 1 2.4 0l.6.6a1.7 1.7 0 0 1 0 2.4L12 15z'],['path','M15.5 5.5l3 3']],
    ruler_set:[['path','M3.5 20.5v-17l17 17z'],['path','M3.5 8h2.6M3.5 12h1.6M3.5 16h2.6M8 20.5v-2.6M12 20.5v-1.6M16 20.5v-2.6']],
    tape_case:[['rect',{x:2.5,y:5,width:13.5,height:14,rx:4.5}],['circle',{cx:9.2,cy:12,r:2.6}],['path','M16 10h5.5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-.5.5H16'],['path','M18.5 10v1.7M20.5 10v1']],
    tape_retract:[['path','M4 7h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z'],['path','M7.5 12h6M7.5 15h4M17 13h4.5M21.5 11v4']],
    tape_coil:[['path','M20 12a8 8 0 1 1-8-8'],['path','M17 12a5 5 0 1 1-5-5'],['path','M14 12a2 2 0 1 1-2-2'],['path','M20 12h2.5M21 12v-1.7']],
    tape_wave:[['path','M2 14c3-6 6-6 10-2s7 4 10-2'],['path','M2 20c3-6 6-6 10-2s7 4 10-2'],['path',{d:'M2 17c3-6 6-6 10-2s7 4 10-2','stroke-dasharray':'0.01 3','stroke-width':2.6}]],
    tape_body:[['path','M8.5 3 4.5 6l2 3.2V21h11V9.2l2-3.2-4-3a4.2 4.2 0 0 1-7 0z'],['rect',{x:6.5,y:12.5,width:11,height:3.2}],['path','M9 12.5v1.3M11.5 12.5v.8M14 12.5v1.3M16.5 12.5v.8']],
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
    styleRoot(root);
    const button = node('button', undefined, settings.design === 'icon' ? 'icon-only' : settings.design); button.type = 'button';
    const flat = ['link','row','bracket','bookmark'].includes(settings.design);
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
    if (['band','row','plusrow','arrowblock','dotleader'].includes(settings.design)) { const arrow = node('span', settings.design==='plusrow' ? '+' : '←', 'arrow'); arrow.setAttribute('aria-hidden', 'true'); button.append(arrow); }
    if (settings.design === 'card') button.append(node('span', 'سم / إنش', 'units'));
    if (settings.effect === 'tilt') tilt(button);
    button.addEventListener('click', event => { event.stopPropagation(); onClick(event); });
    button.addEventListener('pointerdown', event => event.stopPropagation());
    root.append(button); return {button, settings};
  }
  window.SizeGuideButton = {designs, placements, palettes, icons, icon, depths, effects, MAX_EXTRA, colors, defaults, normalize, normalizeOne, paletteColors, hasSubtitle, render};
})();
