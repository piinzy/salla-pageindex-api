/* The size-guide window: themed per category, with subtle 3D depth. Shared by the storefront and the dashboard preview. */
(() => {
'use strict';
const categories=[
  {id:'general',name:'عام',emblem:'tape'},{id:'women',name:'نسائي',emblem:'dress'},{id:'men',name:'رجالي',emblem:'shirt'},
  {id:'kids',name:'أطفال',emblem:'kids'},{id:'shoes',name:'أحذية',emblem:'shoe'},{id:'pets',name:'حيوانات أليفة',emblem:'paw'}];
/* head: 'tint' = soft header, 'solid' = header filled with the accent. pattern decorates the hero band only. */
const themes=[
  {id:'classic',name:'كلاسيكي',accent:'#177e65',paper:'#ffffff',ink:'#20372b',muted:'#667a6e',line:'#e2eae4',head:'tint',pattern:'none',cats:['general','women','men']},
  {id:'rose',name:'وردي ناعم',accent:'#b4456a',paper:'#fffafb',ink:'#4a2332',muted:'#8a6270',line:'#f1dde4',head:'tint',pattern:'dots',cats:['women','kids']},
  {id:'velvet',name:'مخمل عنابي',accent:'#7b2338',paper:'#fffbfa',ink:'#3d1a22',muted:'#86606a',line:'#f0dde0',head:'solid',pattern:'none',cats:['women']},
  {id:'gold',name:'ذهبي فاخر',accent:'#a8812c',paper:'#fffdf7',ink:'#3a2f14',muted:'#7f7048',line:'#efe6cd',head:'tint',pattern:'diagonal',cats:['women','general']},
  {id:'tailor',name:'خياطة رجالية',accent:'#23375b',paper:'#fbfcfe',ink:'#1c2a45',muted:'#5d6b85',line:'#dde3ee',head:'solid',pattern:'pinstripe',cats:['men']},
  {id:'slate',name:'فحمي',accent:'#3d4a56',paper:'#f8f9fa',ink:'#1f262d',muted:'#5f6b75',line:'#dfe3e6',head:'solid',pattern:'none',cats:['men','general']},
  {id:'sport',name:'رياضي',accent:'#d9480f',paper:'#ffffff',ink:'#201a17',muted:'#6d625c',line:'#efe3dc',head:'solid',pattern:'diagonal',cats:['shoes','men']},
  {id:'leather',name:'جلد طبيعي',accent:'#8a5a35',paper:'#fffaf5',ink:'#3a2a1c',muted:'#7d6650',line:'#eddfd0',head:'tint',pattern:'none',cats:['shoes','men']},
  {id:'paws',name:'مخالب مرحة',accent:'#d9701a',paper:'#fffbf5',ink:'#43290f',muted:'#87684a',line:'#f4e3cc',head:'tint',pattern:'paws',cats:['pets']},
  {id:'mint',name:'نعناع منعش',accent:'#1b8f7c',paper:'#f9fffd',ink:'#123b34',muted:'#587a73',line:'#d6efe9',head:'tint',pattern:'dots',cats:['pets','kids']},
  {id:'night',name:'ليلي',accent:'#7be0c3',paper:'#1d2326',ink:'#eef3f4',muted:'#a9b6ba',line:'#364045',head:'tint',pattern:'dots',dark:true,cats:['general','shoes']},
  {id:'minimal',name:'بسيط',accent:'#2b2b2b',paper:'#ffffff',ink:'#1c1c1c',muted:'#6b6b6b',line:'#ebebeb',head:'tint',pattern:'none',cats:['general']},
];
const emblems={
  dress:'<path class="body" d="M23 6 18 14l4 7 4-3-1 15-11 21q18 6 36 0L39 33l-1-15 4 3 4-7-5-8q-9 10-18 0Z"/>',
  shirt:'<path class="body" d="M22 6 8 14l5 11 7-3v32h24V22l7 3 5-11-14-8q-10 8-20 0Z"/>',
  kids:'<path class="body" d="M23 9 11 16l4 9 6-2.5V52h22V22.5l6 2.5 4-9-12-7q-8 6-16 0Z"/><path class="spark" d="m32 28 2.5 5.6 6.1.6-4.6 4.1 1.4 6-5.4-3.2-5.4 3.2 1.4-6-4.6-4.1 6.1-.6Z"/>',
  shoe:'<path class="body" d="M6 38v-8q0-3 3-3h8l7-11 7 6h6q17 0 21 16v4q0 2-2 2H8q-2 0-2-2Z"/><path class="sole" d="M6 46h52v4q0 2-2 2H8q-2 0-2-2Z"/>',
  paw:'<circle class="body" cx="14" cy="27" r="5.5"/><circle class="body" cx="25" cy="16" r="5.5"/><circle class="body" cx="39" cy="16" r="5.5"/><circle class="body" cx="50" cy="27" r="5.5"/><path class="body" d="M32 29c-10 0-18 8-18 16 0 6 5 9 10 9 4 0 5-1.500 8-1.500S36 54 40 54c5 0 10-3 10-9 0-8-8-16-18-16Z"/>',
  tape:'<circle class="body" cx="26" cy="32" r="20"/><circle class="hole" cx="26" cy="32" r="8"/><path class="sole" d="M44 36h16v10q0 2-2 2H44Z"/><path class="tick" d="M49 36v5M53 36v3M57 36v5"/>',
};
let emblemCount=0;
function svgEl(markup,className){
  const id='sgShine'+(++emblemCount),doc=new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></linearGradient></defs><ellipse class="floor" cx="32" cy="58.500" rx="19" ry="3.200"/>${markup}<g fill="url(#${id})" class="shine">${markup.replace(/ class="[^"]*"/g,'')}</g></svg>`,'image/svg+xml');
  const svg=document.importNode(doc.documentElement,true);svg.setAttribute('class',className);return svg;
}
const category=id=>categories.find(c=>c.id===id)||categories[0];
const theme=id=>themes.find(t=>t.id===id)||themes[0];
function emblem(categoryId,className='emblem'){return svgEl(emblems[category(categoryId).emblem],className);}
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
const readable=hex=>luminance(hex)>.42?'#1b1b1b':'#ffffff';
const HEX=/^#[0-9a-fA-F]{6}$/;
function pattern(kind,accent){
  const mix=pct=>`color-mix(in srgb,${accent} ${pct}%,transparent)`;
  if(kind==='pinstripe')return `repeating-linear-gradient(90deg,transparent 0 13px,${mix(12)} 13px 14px)`;
  if(kind==='diagonal')return `repeating-linear-gradient(135deg,transparent 0 11px,${mix(11)} 11px 22px)`;
  if(kind==='dots')return `radial-gradient(${mix(20)} 1.3px,transparent 1.7px) 0 0/15px 15px`;
  if(kind==='paws')return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='46' height='46' viewBox='0 0 64 64' fill='${accent}' fill-opacity='.2'><circle cx='14' cy='27' r='5.5'/><circle cx='25' cy='16' r='5.5'/><circle cx='39' cy='16' r='5.5'/><circle cx='50' cy='27' r='5.5'/><path d='M32 29c-10 0-18 8-18 16 0 6 5 9 10 9 4 0 5-1.5 8-1.5S36 54 40 54c5 0 10-3 10-9 0-8-8-16-18-16Z'/></svg>`)}") 0 0/46px 46px`;
  return 'none';
}
/* Tokens for a guide: the theme supplies surfaces, the guide's own colour is the accent. */
function tokens(guide){
  const t=theme(guide.theme),accent=HEX.test(guide.color)?guide.color:t.accent;
  return {theme:t,vars:{'--accent':accent,'--on-accent':readable(accent),'--paper':t.paper,'--ink':t.ink,'--muted':t.muted,'--line':t.line,
    '--head-bg':t.head==='solid'?accent:`color-mix(in srgb,${accent} 13%,${t.paper})`,
    '--head-ink':t.head==='solid'?readable(accent):`color-mix(in srgb,${accent} 62%,${t.ink})`,
    '--pattern':pattern(t.pattern,accent)}};
}
const css=`:host{font-family:PingARLT,Tahoma,Arial,sans-serif;direction:rtl;line-height:1.7;color-scheme:light dark}*{box-sizing:border-box}button{font:inherit;cursor:pointer;color:inherit}
.wrap{--r:14px;--pad-y:13px;--pad-x:16px;--tint:color-mix(in srgb,var(--accent) 8%,var(--paper));--accent-ink:color-mix(in srgb,var(--accent) 72%,var(--ink));position:relative;overflow:hidden;isolation:isolate;background:var(--paper);color:var(--ink);border-radius:calc(var(--r) * 1.3)}
.wrap[data-corners=sharp]{--r:3px}.wrap[data-corners=round]{--r:22px}.wrap[data-density=compact]{--pad-y:8px;--pad-x:11px}
.hero{position:relative;display:flex;align-items:center;gap:18px;padding:26px 28px 22px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 17%,var(--paper)),var(--paper) 75%)}
.hero:before{content:'';position:absolute;inset:0;z-index:-1;background:var(--pattern);opacity:.7;pointer-events:none;-webkit-mask-image:linear-gradient(90deg,transparent,#000 60%);mask-image:linear-gradient(90deg,transparent,#000 60%)}
.emblem{flex:0 0 84px;width:84px;height:84px;color:var(--accent);overflow:visible;filter:drop-shadow(0 12px 10px color-mix(in srgb,var(--accent) 32%,transparent))}
.emblem .body{fill:currentColor}.emblem .sole{fill:color-mix(in srgb,var(--accent) 45%,#000)}.emblem .hole{fill:var(--paper)}.emblem .tick{stroke:var(--paper);stroke-width:1.4;stroke-linecap:round}
.emblem .spark{fill:#fff;fill-opacity:.85}.emblem .floor{fill:#000;fill-opacity:.14}.emblem .shine .body,.emblem .shine .sole{fill:inherit}.emblem .shine{pointer-events:none}
.wrap[data-depth="1"] .emblem{animation:float 5.5s ease-in-out infinite}
@keyframes float{50%{transform:translateY(-5px) rotate(-2.500deg)}}
.titles{flex:1;min-width:0}h2{font-size:1.6rem;margin:0;line-height:1.35;letter-spacing:0}.product{font-size:.9rem;color:var(--muted);margin:2px 0 10px}
.chips{display:flex;gap:7px;flex-wrap:wrap}.tag{font-size:.74rem;padding:2px 12px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,var(--paper));color:var(--accent-ink);border:1px solid color-mix(in srgb,var(--accent) 24%,transparent)}
.close{flex:0 0 42px;width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:var(--paper);font-size:1.6rem;line-height:1;align-self:flex-start;display:grid;place-items:center;padding:0}
.wrap[data-depth="1"] .close{box-shadow:0 2px 0 var(--line),0 6px 10px -5px #0004}.close:active{transform:translateY(1px)}
.body{padding:20px 28px 28px}
.tabs{display:inline-flex;gap:4px;padding:4px;background:var(--tint);border:1px solid var(--line);border-radius:999px}
.tabs button{border:0;background:none;min-height:40px;padding:6px 20px;border-radius:999px;color:var(--muted);transition:background-color .18s,color .18s,box-shadow .18s}
.tabs button[aria-selected=true]{background:var(--paper);color:var(--accent-ink);font-weight:600;box-shadow:0 1px 3px #0002}
.wrap[data-depth="1"] .tabs button[aria-selected=true]{box-shadow:inset 0 1px 0 #fff8,0 2px 0 var(--line),0 6px 10px -5px #0004}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0 12px;flex-wrap:wrap}.bar .legend{font-size:.8rem;color:var(--muted)}
.units{display:inline-flex;padding:3px;border:1px solid var(--line);border-radius:12px;background:var(--tint);gap:3px}
.units button{min-height:38px;min-width:58px;padding:3px 14px;border:0;border-radius:9px;background:none;font-size:.82rem;color:var(--muted)}
.units button[aria-pressed=true]{background:var(--accent);color:var(--on-accent);font-weight:600}
.wrap[data-depth="1"] .units button[aria-pressed=true]{box-shadow:inset 0 1px 0 #fff5,0 2px 0 color-mix(in srgb,var(--accent) 60%,#000)}
.scroll{overflow:auto;max-width:100%;border:1px solid var(--line);border-radius:var(--r);background:var(--paper)}.scroll:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.wrap[data-depth="1"] .scroll{box-shadow:0 1px 0 #fff inset,0 14px 24px -18px #0006}
table{border-collapse:separate;border-spacing:0;width:100%;font-size:.92rem;text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums}
th,td{padding:var(--pad-y) var(--pad-x);border-bottom:1px solid var(--line)}tbody tr:last-child>*{border-bottom:0}
thead th{background:var(--head-bg);color:var(--head-ink);font-weight:600;font-size:.82rem}
tbody th{position:sticky;right:0;z-index:1;background:var(--paper);font-weight:700}
.chip{display:inline-block;min-width:2.8em;padding:.12em .8em;border-radius:999px;color:var(--accent-ink);background:var(--tint);border:1px solid color-mix(in srgb,var(--accent) 22%,transparent)}
.wrap[data-depth="1"] .chip{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 20%,#fff),color-mix(in srgb,var(--accent) 7%,var(--paper)));box-shadow:inset 0 1px 0 #fff,0 2px 0 color-mix(in srgb,var(--accent) 32%,transparent)}
[data-table=zebra] tbody tr:nth-child(even)>td{background:var(--tint)}[data-table=zebra] tbody tr:nth-child(even)>th{background:var(--tint)}
[data-table=plain] th,[data-table=plain] td{border-bottom-color:transparent}
.wrap[data-table=cards] .scroll{border:0;background:none;box-shadow:none!important}[data-table=cards] table{border-spacing:0 8px}[data-table=cards] thead th{border:0}
[data-table=cards] thead th:first-child,[data-table=cards] tbody>tr>:first-child{border-start-start-radius:var(--r);border-end-start-radius:var(--r)}
[data-table=cards] thead th:last-child,[data-table=cards] tbody>tr>:last-child{border-start-end-radius:var(--r);border-end-end-radius:var(--r)}
[data-table=cards] tbody th,[data-table=cards] tbody td{background:var(--tint);border:0}
.wrap[data-depth="1"][data-table=cards] tbody tr{transition:transform .18s}.wrap[data-depth="1"][data-table=cards] tbody td,.wrap[data-depth="1"][data-table=cards] tbody th{box-shadow:0 1px 0 #fff8 inset}
.wrap[data-depth="1"] tbody tr:hover>*{background:color-mix(in srgb,var(--accent) 13%,var(--paper))}
.notes{font-size:.82rem;color:var(--muted);white-space:pre-wrap;margin:16px 0 0;padding:11px 14px;background:var(--tint);border-radius:var(--r);border-inline-start:3px solid var(--accent)}
.instructions{white-space:pre-wrap;font-size:.95rem;line-height:2;padding:6px 2px}.hint{font-size:.72rem;color:var(--muted);margin:12px 0 0}
dialog{border:0;padding:0;background:transparent;width:min(780px,calc(100vw - 24px));max-height:92dvh;overflow:auto;border-radius:24px;box-shadow:0 1px 0 #fff4 inset,0 36px 70px -24px #000c,0 14px 28px -14px #0008;color:var(--ink)}
dialog[open]{animation:pop .3s cubic-bezier(.2,.9,.3,1)}dialog::backdrop{background:#0b1713b8;backdrop-filter:blur(4px)}
@keyframes pop{from{opacity:0;transform:perspective(900px) translateY(20px) rotateX(9deg) scale(.96)}}
[hidden]{display:none!important}
@media(max-width:560px){.hero{padding:20px 18px 16px;gap:12px}.emblem{flex-basis:58px;width:58px;height:58px}h2{font-size:1.25rem}.body{padding:16px 14px 22px}}
@media(prefers-reduced-motion:reduce){dialog[open],.wrap .emblem{animation:none!important}.tabs button,.wrap tbody tr{transition:none!important}}`;
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
function convert(value,from,to){if(from===to)return value;let v=String(value).trim().replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/٫/g,'.');if(!/^\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?$/.test(v))return value;return v.split(/\s*[-–]\s*/).map(x=>{let n=Number(x)*(from==='cm'?1/2.54:2.54);return Number(n.toFixed(1)).toString()}).join(' – ')}
function render(host,guide,productName,close){
  host.replaceChildren();const {theme:t,vars}=tokens(guide);let unit=guide.unit;
  const box=el('div',undefined,'wrap');for(const [key,value] of Object.entries(vars))box.style.setProperty(key,value);
  box.dataset.table=guide.table_style||'zebra';box.dataset.density=guide.density||'comfortable';box.dataset.corners=guide.corners||'soft';box.dataset.depth=guide.depth3d===false?'0':'1';box.dataset.theme=t.id;
  const cat=category(guide.category),hero=el('div',undefined,'hero'),titles=el('div',undefined,'titles');
  if(guide.header_icon!==false)hero.append(emblem(cat.id));
  const title=el('h2',guide.title);title.id='size-guide-title';
  const chips=el('div',undefined,'chips');if(cat.id!=='general')chips.append(el('span',cat.name,'tag'));chips.append(el('span',guide.measurement_type==='body'?'قياسات الجسم':'قياسات القطعة نفسها','tag'));
  titles.append(title,el('p',productName,'product'),chips);hero.append(titles);
  if(close){const b=el('button','×','close');b.type='button';b.setAttribute('aria-label','إغلاق دليل المقاسات');b.onclick=close;hero.append(b)}
  const body=el('div',undefined,'body'),tabs=el('div',undefined,'tabs');tabs.setAttribute('role','tablist');
  const tableTab=el('button','جدول المقاسات'),howTab=el('button','طريقة القياس');tabs.append(tableTab,howTab);
  const grid=el('div'),how=el('div',guide.instructions||'لم تتم إضافة تعليمات خاصة لهذا المنتج. تواصل مع المتجر إذا احتجت مساعدة في القياس.','instructions');how.hidden=true;
  body.append(tabs,grid,how);box.append(hero,body);
  tableTab.id='sg-table-tab';howTab.id='sg-how-tab';grid.id='sg-grid';how.id='sg-how';
  [tableTab,howTab].forEach((b,i)=>{b.type='button';b.setAttribute('role','tab');b.setAttribute('aria-controls',i?'sg-how':'sg-grid');b.setAttribute('aria-selected',String(!i));b.tabIndex=i?-1:0;
    b.onclick=()=>{grid.hidden=!!i;how.hidden=!i;tableTab.setAttribute('aria-selected',String(!i));howTab.setAttribute('aria-selected',String(!!i));tableTab.tabIndex=i?-1:0;howTab.tabIndex=i?0:-1};
    b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const x=e.key==='Home'?tableTab:e.key==='End'?howTab:i?tableTab:howTab;x.click();x.focus()}}});
  grid.setAttribute('role','tabpanel');grid.setAttribute('aria-labelledby',tableTab.id);how.setAttribute('role','tabpanel');how.setAttribute('aria-labelledby',howTab.id);
  function draw(){
    grid.replaceChildren();const bar=el('div',undefined,'bar'),units=el('div',undefined,'units');units.setAttribute('role','group');units.setAttribute('aria-label','وحدة القياس');
    for(const [code,label] of [['cm','سم'],['in','إنش']]){const b=el('button',label);b.type='button';b.setAttribute('aria-pressed',String(unit===code));b.onclick=()=>{unit=code;draw()};units.append(b)}
    bar.append(el('span','مرّر الجدول جانبيًا على الشاشات الصغيرة','legend'),units);grid.append(bar);
    const scroll=el('div',undefined,'scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','جدول المقاسات، يمكن تمريره أفقيًا');
    const table=el('table'),thead=el('thead'),tr=el('tr');tr.append(el('th','المقاس'));
    for(const c of guide.columns)tr.append(el('th',c.label+(c.kind==='measurement'?' ('+(unit==='cm'?'سم':'إنش')+')':'')));
    for(const x of tr.children)x.scope='col';thead.append(tr);table.append(thead);
    const tb=el('tbody');for(const r of guide.rows){const row=el('tr'),label=el('th');label.scope='row';label.append(el('span',r.size||'—','chip'));row.append(label);
      r.values.forEach((v,i)=>row.append(el('td',guide.columns[i]?.kind==='measurement'?convert(v,guide.unit,unit):v)));tb.append(row)}
    table.append(tb);scroll.append(table);grid.append(scroll);if(guide.notes)grid.append(el('p',guide.notes,'notes'));
    grid.append(el('p','التحويل بين سم وإنش يشمل الأرقام والنطاقات الرقمية؛ العبارات النصية تبقى كما أدخلها المتجر.','hint'));
  }
  draw();host.append(box);
}
function shadow(host){const root=host.shadowRoot||host.attachShadow({mode:'open'});root.replaceChildren();root.append(el('style',css));return root}
function preview(host,guide,name){let root=shadow(host),surface=el('div');root.append(surface);render(surface,guide,name)}
function open(guide,name){const previous=document.activeElement;const host=el('div');host.style.cssText='position:relative;z-index:2147483647';document.body.append(host);const root=shadow(host),dialog=el('dialog');dialog.dir='rtl';dialog.setAttribute('aria-labelledby','size-guide-title');const close=()=>dialog.close();root.append(dialog);render(dialog,guide,name,close);dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});dialog.addEventListener('close',()=>{host.remove();previous?.focus()},{once:true});dialog.showModal()}
window.SizeGuideUI={preview,open,convert,categories,themes,emblem,tokens};
})();
