/* The size-guide window: themed per category, with subtle 3D depth. Shared by the storefront and the dashboard preview. */
(() => {
'use strict';
const categories=[
  {id:'general',name:'عام',emblem:'tape'},{id:'women',name:'نسائي',emblem:'dress'},{id:'men',name:'رجالي',emblem:'shirt'},
  {id:'kids',name:'أطفال',emblem:'kids'},{id:'shoes',name:'أحذية',emblem:'shoe'},{id:'pets',name:'حيوانات أليفة',emblem:'paw'},{id:'accessories',name:'إكسسوارات',emblem:'ring'}];
const categoryNames={general:'General',women:'Women',men:'Men',kids:'Kids',shoes:'Shoes',pets:'Pets',accessories:'Accessories'};
/* head: 'tint' = soft header, 'solid' = header filled with the accent. pattern decorates the hero band only. */
const themes=[
  {id:'classic',name:'كلاسيكي',accent:'#177e65',paper:'#ffffff',ink:'#20372b',muted:'#667a6e',line:'#e2eae4',head:'tint',pattern:'none',cats:['general','women','men']},
  {id:'rose',name:'وردي ناعم',accent:'#b4456a',paper:'#fffafb',ink:'#4a2332',muted:'#8a6270',line:'#f1dde4',head:'tint',pattern:'dots',cats:['women','kids']},
  {id:'velvet',name:'مخمل عنابي',accent:'#7b2338',paper:'#fffbfa',ink:'#3d1a22',muted:'#86606a',line:'#f0dde0',head:'solid',pattern:'none',cats:['women']},
  {id:'gold',name:'ذهبي فاخر',accent:'#a8812c',paper:'#fffdf7',ink:'#3a2f14',muted:'#7f7048',line:'#efe6cd',head:'tint',pattern:'diagonal',cats:['women','general','accessories']},
  {id:'tailor',name:'خياطة رجالية',accent:'#23375b',paper:'#fbfcfe',ink:'#1c2a45',muted:'#5d6b85',line:'#dde3ee',head:'solid',pattern:'pinstripe',cats:['men']},
  {id:'slate',name:'فحمي',accent:'#3d4a56',paper:'#f8f9fa',ink:'#1f262d',muted:'#5f6b75',line:'#dfe3e6',head:'solid',pattern:'none',cats:['men','general']},
  {id:'sport',name:'رياضي',accent:'#d9480f',paper:'#ffffff',ink:'#201a17',muted:'#6d625c',line:'#efe3dc',head:'solid',pattern:'diagonal',cats:['shoes','men']},
  {id:'leather',name:'جلد طبيعي',accent:'#8a5a35',paper:'#fffaf5',ink:'#3a2a1c',muted:'#7d6650',line:'#eddfd0',head:'tint',pattern:'none',cats:['shoes','men']},
  {id:'paws',name:'مخالب مرحة',accent:'#d9701a',paper:'#fffbf5',ink:'#43290f',muted:'#87684a',line:'#f4e3cc',head:'tint',pattern:'paws',cats:['pets']},
  {id:'mint',name:'نعناع منعش',accent:'#1b8f7c',paper:'#f9fffd',ink:'#123b34',muted:'#587a73',line:'#d6efe9',head:'tint',pattern:'dots',cats:['pets','kids']},
  {id:'night',name:'ليلي',accent:'#7be0c3',paper:'#1d2326',ink:'#eef3f4',muted:'#a9b6ba',line:'#364045',head:'tint',pattern:'dots',dark:true,cats:['general','shoes','accessories']},
  {id:'minimal',name:'بسيط',accent:'#2b2b2b',paper:'#ffffff',ink:'#1c1c1c',muted:'#6b6b6b',line:'#ebebeb',head:'tint',pattern:'none',cats:['general','accessories']},
];
const emblems={
  dress:'<path class="body" d="M23 6 18 14l4 7 4-3-1 15-11 21q18 6 36 0L39 33l-1-15 4 3 4-7-5-8q-9 10-18 0Z"/>',
  shirt:'<path class="body" d="M22 6 8 14l5 11 7-3v32h24V22l7 3 5-11-14-8q-10 8-20 0Z"/>',
  kids:'<path class="body" d="M23 9 11 16l4 9 6-2.5V52h22V22.5l6 2.5 4-9-12-7q-8 6-16 0Z"/><path class="spark" d="m32 28 2.5 5.6 6.1.6-4.6 4.1 1.4 6-5.4-3.2-5.4 3.2 1.4-6-4.6-4.1 6.1-.6Z"/>',
  shoe:'<path class="body" d="M6 38v-8q0-3 3-3h8l7-11 7 6h6q17 0 21 16v4q0 2-2 2H8q-2 0-2-2Z"/><path class="sole" d="M6 46h52v4q0 2-2 2H8q-2 0-2-2Z"/>',
  paw:'<circle class="body" cx="14" cy="27" r="5.5"/><circle class="body" cx="25" cy="16" r="5.5"/><circle class="body" cx="39" cy="16" r="5.5"/><circle class="body" cx="50" cy="27" r="5.5"/><path class="body" d="M32 29c-10 0-18 8-18 16 0 6 5 9 10 9 4 0 5-1.500 8-1.500S36 54 40 54c5 0 10-3 10-9 0-8-8-16-18-16Z"/>',
  ring:'<path class="body" fill-rule="evenodd" d="M32 22a17 17 0 1 0 0 34 17 17 0 1 0 0-34Zm0 7a10 10 0 1 1 0 20 10 10 0 1 1 0-20Z"/><path class="sole" d="m32 5 8 8-8 10-8-10Z"/>',
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
const HEX=/^#[0-9a-fA-F]{6}$/,custom=value=>HEX.test(value||'')?value:'';
const channels=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16));
const mix=(from,to,amount)=>{const a=channels(from),b=channels(to);return '#'+a.map((x,i)=>Math.round(x*(1-amount)+b[i]*amount).toString(16).padStart(2,'0')).join('');};
function pattern(kind,accent){
  const soft=pct=>`color-mix(in srgb,${accent} ${pct}%,transparent)`;
  if(kind==='pinstripe')return `repeating-linear-gradient(90deg,transparent 0 13px,${soft(12)} 13px 14px)`;
  if(kind==='diagonal')return `repeating-linear-gradient(135deg,transparent 0 11px,${soft(11)} 11px 22px)`;
  if(kind==='dots')return `radial-gradient(${soft(20)} 1.3px,transparent 1.7px) 0 0/15px 15px`;
  if(kind==='paws')return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='46' height='46' viewBox='0 0 64 64' fill='${accent}' fill-opacity='.2'><circle cx='14' cy='27' r='5.5'/><circle cx='25' cy='16' r='5.5'/><circle cx='39' cy='16' r='5.5'/><circle cx='50' cy='27' r='5.5'/><path d='M32 29c-10 0-18 8-18 16 0 6 5 9 10 9 4 0 5-1.5 8-1.5S36 54 40 54c5 0 10-3 10-9 0-8-8-16-18-16Z'/></svg>`)}") 0 0/46px 46px`;
  return 'none';
}
/* Every colour of the table as hex: the theme gives the defaults, the merchant's own choices win. */
const HEAD_STYLES=['tint','solid','plain','line'];
function palette(guide){
  const t=theme(guide.theme),accent=custom(guide.color)||t.accent,paper=custom(guide.paper_color)||t.paper,ink=custom(guide.text_color)||t.ink;
  const headStyle=HEAD_STYLES.includes(guide.header_style)?guide.header_style:t.head;
  const defaultHead=headStyle==='solid'?accent:headStyle==='tint'?mix(paper,accent,.13):paper;
  const headBg=custom(guide.header_bg)||defaultHead;
  const headInk=custom(guide.header_text)||(headStyle==='solid'||custom(guide.header_bg)?readable(headBg):headStyle==='tint'?mix(ink,accent,.62):ink);
  const alt=custom(guide.row_alt)||mix(paper,accent,.08),chipBg=custom(guide.size_bg)||mix(paper,accent,.08);
  const line=custom(guide.border_color)||(guide.border_style==='strong'?mix(t.line,ink,.3):t.line);
  return {theme:t,headStyle,accent,paper,ink,muted:guide.text_color?mix(ink,paper,.42):t.muted,line,headBg,headInk,alt,chipBg,
    chipInk:custom(guide.size_text)||(custom(guide.size_bg)?readable(chipBg):mix(ink,accent,.72)),accentInk:mix(ink,accent,.72)};
}
/* Tokens for a guide: the theme supplies surfaces, the guide's own colours override them. */
function tokens(guide){
  const p=palette(guide);
  return {theme:p.theme,vars:{'--accent':p.accent,'--on-accent':readable(p.accent),'--paper':p.paper,'--ink':p.ink,'--muted':p.muted,'--line':p.line,
    '--head-bg':p.headBg,'--head-ink':p.headInk,'--alt':p.alt,'--chip-bg':p.chipBg,'--chip-ink':p.chipInk,'--accent-ink':p.accentInk,'--pattern':pattern(p.theme.pattern,p.accent)}};
}
const css=`:host{font-family:PingARLT,Tahoma,Arial,sans-serif;direction:rtl;line-height:1.7;color-scheme:light dark}*{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer;color:inherit}
.wrap{--r:14px;--pad-y:13px;--pad-x:16px;--fs:.92rem;position:relative;overflow:hidden;isolation:isolate;background:var(--paper);color:var(--ink);border-radius:calc(var(--r) * 1.3)}
.wrap[data-corners=sharp]{--r:3px}.wrap[data-corners=round]{--r:22px}.wrap[data-density=compact]{--pad-y:8px;--pad-x:11px}
.wrap[data-font=small]{--fs:.8rem}.wrap[data-font=large]{--fs:1.05rem}
.hero{position:relative;display:flex;align-items:center;gap:18px;padding:26px 28px 22px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 17%,var(--paper)),var(--paper) 75%)}
.hero:before{content:'';position:absolute;inset:0;z-index:-1;background:var(--pattern);opacity:.7;pointer-events:none;-webkit-mask-image:linear-gradient(90deg,transparent,#000 60%);mask-image:linear-gradient(90deg,transparent,#000 60%)}
.emblem{flex:0 0 84px;width:84px;height:84px;color:var(--accent);overflow:visible;filter:drop-shadow(0 12px 10px color-mix(in srgb,var(--accent) 32%,transparent))}
.emblem .body{fill:currentColor}.emblem .sole{fill:color-mix(in srgb,var(--accent) 45%,#000)}.emblem .hole{fill:var(--paper)}.emblem .tick{stroke:var(--paper);stroke-width:1.4;stroke-linecap:round}
.emblem .spark{fill:#fff;fill-opacity:.85}.emblem .floor{fill:#000;fill-opacity:.14}.emblem .shine .body,.emblem .shine .sole{fill:inherit}.emblem .shine{pointer-events:none}
.logo{flex:0 0 auto;max-width:120px;max-height:56px;object-fit:contain;border-radius:8px}
.wrap[data-depth="1"] .emblem{animation:float 5.5s ease-in-out infinite}
@keyframes float{50%{transform:translateY(-5px) rotate(-2.5deg)}}
.titles{flex:1;min-width:0}h2{font-size:1.6rem;margin:0;line-height:1.35;letter-spacing:0}.product{font-size:.9rem;color:var(--muted);margin:2px 0 10px}
.chips{display:flex;gap:7px;flex-wrap:wrap}.tag{font-size:.74rem;padding:2px 12px;border-radius:999px;background:color-mix(in srgb,var(--accent) 12%,var(--paper));color:var(--accent-ink);border:1px solid color-mix(in srgb,var(--accent) 24%,transparent)}
.close{flex:0 0 42px;width:42px;height:42px;border-radius:50%;border:1px solid var(--line);background:var(--paper);font-size:1.6rem;line-height:1;align-self:flex-start;display:grid;place-items:center;padding:0}
.wrap[data-depth="1"] .close{box-shadow:0 2px 0 var(--line),0 6px 10px -5px #0004}.close:active{transform:translateY(1px)}
.body{padding:20px 28px 28px}
.tabs{display:inline-flex;flex-wrap:wrap;gap:4px;padding:4px;background:var(--alt);border:1px solid var(--line);border-radius:999px;max-width:100%}
.tabs button{border:0;background:none;min-height:40px;padding:6px 18px;border-radius:999px;color:var(--muted);transition:background-color .18s,color .18s,box-shadow .18s}
.tabs button[aria-selected=true]{background:var(--paper);color:var(--accent-ink);font-weight:600;box-shadow:0 1px 3px #0002}
.wrap[data-depth="1"] .tabs button[aria-selected=true]{box-shadow:inset 0 1px 0 #fff8,0 2px 0 var(--line),0 6px 10px -5px #0004}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:18px 0 12px;flex-wrap:wrap}.bar .legend{font-size:.8rem;color:var(--muted)}
.units{display:inline-flex;padding:3px;border:1px solid var(--line);border-radius:12px;background:var(--alt);gap:3px}
.units button{min-height:38px;min-width:58px;padding:3px 14px;border:0;border-radius:9px;background:none;font-size:.82rem;color:var(--muted)}
.units button[aria-pressed=true]{background:var(--accent);color:var(--on-accent);font-weight:600}
.wrap[data-depth="1"] .units button[aria-pressed=true]{box-shadow:inset 0 1px 0 #fff5,0 2px 0 color-mix(in srgb,var(--accent) 60%,#000)}
.scroll{overflow:auto;max-width:100%;border:1px solid var(--line);border-radius:var(--r);background:var(--paper)}.scroll:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.wrap[data-depth="1"] .scroll{box-shadow:0 1px 0 #fff inset,0 14px 24px -18px #0006}
table{border-collapse:separate;border-spacing:0;width:100%;font-size:var(--fs);text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums}
th,td{padding:var(--pad-y) var(--pad-x);border-bottom:1px solid var(--line)}tbody tr:last-child>*{border-bottom:0}
thead th{background:var(--head-bg);color:var(--head-ink);font-weight:600;font-size:.88em}
.wrap[data-head=plain] thead th{border-bottom:1px solid var(--line)}.wrap[data-head=line] thead th{border-bottom:2px solid var(--accent)}
tbody th{position:sticky;inset-inline-start:0;z-index:1;background:var(--paper);font-weight:700}.wrap[data-sticky="0"] tbody th{position:static}
.chip{display:inline-block;min-width:2.8em;padding:.12em .8em;border-radius:999px;color:var(--chip-ink);background:var(--chip-bg);border:1px solid color-mix(in srgb,var(--chip-ink) 22%,transparent)}
.wrap[data-depth="1"][data-sizestyle=chip] .chip{background:linear-gradient(180deg,color-mix(in srgb,var(--chip-bg) 55%,#fff),var(--chip-bg));box-shadow:inset 0 1px 0 #fff,0 2px 0 color-mix(in srgb,var(--chip-ink) 30%,transparent)}
[data-sizestyle=pill] .chip{box-shadow:none}[data-sizestyle=square] .chip{border-radius:8px;box-shadow:none}
[data-sizestyle=underline] .chip{background:none;border:0;border-bottom:2px solid var(--accent);border-radius:0;padding-inline:.3em;box-shadow:none}
[data-sizestyle=plain] .chip{background:none;border:0;box-shadow:none;padding-inline:.2em}
[data-table=zebra] tbody tr:nth-child(even)>td,[data-table=zebra] tbody tr:nth-child(even)>th{background:var(--alt)}
[data-table=plain] th,[data-table=plain] td{border-bottom-color:transparent}
.wrap[data-border=none] th,.wrap[data-border=none] td{border-bottom-color:transparent}.wrap[data-border=none] .scroll{border-color:transparent}
.wrap[data-border=strong] th,.wrap[data-border=strong] td{border-bottom-width:2px}.wrap[data-border=strong] .scroll{border-width:2px}
.wrap[data-table=cards] .scroll{border:0;background:none;box-shadow:none!important}[data-table=cards] table{border-spacing:0 8px}[data-table=cards] thead th{border:0}
[data-table=cards] thead th:first-child,[data-table=cards] tbody>tr>:first-child{border-start-start-radius:var(--r);border-end-start-radius:var(--r)}
[data-table=cards] thead th:last-child,[data-table=cards] tbody>tr>:last-child{border-start-end-radius:var(--r);border-end-end-radius:var(--r)}
[data-table=cards] tbody th,[data-table=cards] tbody td{background:var(--alt);border:0}
.wrap[data-depth="1"][data-table=cards] tbody td,.wrap[data-depth="1"][data-table=cards] tbody th{box-shadow:0 1px 0 #fff8 inset}
.wrap[data-depth="1"] tbody tr:hover>*{background:color-mix(in srgb,var(--accent) 13%,var(--paper))}
tbody tr.hit>*{background:color-mix(in srgb,var(--accent) 22%,var(--paper))!important;font-weight:700}
.notes{font-size:.82rem;color:var(--muted);white-space:pre-wrap;margin:16px 0 0;padding:11px 14px;background:var(--alt);border-radius:var(--r);border-inline-start:3px solid var(--accent)}
.instructions{white-space:pre-wrap;font-size:.95rem;line-height:2;padding:6px 2px}.hint{font-size:.72rem;color:var(--muted);margin:12px 0 0}
.how-media{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:16px}
.how-media img{display:block;width:100%;height:auto;max-height:260px;object-fit:contain;background:var(--alt);border:1px solid var(--line);border-radius:var(--r)}
.video{margin-top:16px;aspect-ratio:16/9;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;background:#000}.video iframe{display:block;width:100%;height:100%;border:0}
.finder p{margin:0 0 14px;color:var(--muted);font-size:.9rem}.fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.field label{display:block;font-size:.82rem;margin-bottom:6px;color:var(--ink)}.field input{width:100%;min-height:46px;padding:8px 12px;border:1px solid var(--line);border-radius:calc(var(--r) * .7);background:var(--paper);color:var(--ink);direction:ltr;text-align:center}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.primary,.ghost{min-height:44px;padding:8px 20px;border-radius:calc(var(--r) * .8);border:1px solid var(--accent)}
.primary{background:var(--accent);color:var(--on-accent);font-weight:600}.wrap[data-depth="1"] .primary{box-shadow:inset 0 1px 0 #fff5,0 3px 0 color-mix(in srgb,var(--accent) 60%,#000)}.ghost{background:none;color:var(--accent-ink)}
.result{margin-top:16px;padding:14px 16px;border-radius:var(--r);background:var(--alt);border-inline-start:3px solid var(--accent);min-height:24px}.result strong{font-size:1.25rem;color:var(--accent-ink)}.result small{display:block;color:var(--muted);margin-top:4px}
dialog{border:0;padding:0;background:transparent;width:min(780px,calc(100vw - 24px));max-height:92dvh;overflow:auto;border-radius:24px;box-shadow:0 1px 0 #fff4 inset,0 36px 70px -24px #000c,0 14px 28px -14px #0008;color:var(--ink)}
dialog[open]{animation:pop .3s cubic-bezier(.2,.9,.3,1)}dialog::backdrop{background:#0b1713b8;backdrop-filter:blur(4px)}
@keyframes pop{from{opacity:0;transform:perspective(900px) translateY(20px) rotateX(9deg) scale(.96)}}
[hidden]{display:none!important}
@media(max-width:560px){.hero{padding:20px 18px 16px;gap:12px}.emblem{flex-basis:58px;width:58px;height:58px}h2{font-size:1.25rem}.body{padding:16px 14px 22px}.tabs button{padding:6px 12px}}
@media(prefers-reduced-motion:reduce){dialog[open],.wrap .emblem{animation:none!important}.tabs button,.wrap tbody tr{transition:none!important}}`;
const words={
  ar:{size:'المقاس',table:'جدول المقاسات',how:'طريقة القياس',finder:'اعرف مقاسك',close:'إغلاق دليل المقاسات',unit:'وحدة القياس',cm:'سم',inch:'إنش',
    scroll:'مرّر الجدول جانبيًا على الشاشات الصغيرة',tableLabel:'جدول المقاسات، يمكن تمريره أفقيًا',body:'قياسات الجسم',garment:'قياسات القطعة نفسها',
    noHow:'لم تتم إضافة تعليمات خاصة لهذا المنتج. تواصل مع المتجر إذا احتجت مساعدة في القياس.',
    hint:'التحويل بين سم وإنش يشمل الأرقام والنطاقات الرقمية؛ العبارات النصية تبقى كما أدخلها المتجر.',
    intro:'أدخل قياساتك لنقترح عليك المقاس الأنسب من جدول المتجر.',find:'اعرف مقاسي',clear:'مسح',show:'عرض في الجدول',
    fit:'المقاس الأنسب لك',near:'أقرب مقاس لقياساتك',none:'أدخل قياسًا واحدًا على الأقل.',nomatch:'لم نجد مقاسًا قريبًا من قياساتك.',
    note:'النتيجة تقريبية وتعتمد على جدول المتجر.',video:'فيديو طريقة القياس',image:'صورة توضيحية لطريقة القياس',names:{}},
  en:{size:'Size',table:'Size chart',how:'How to measure',finder:'Find my size',close:'Close size guide',unit:'Unit',cm:'cm',inch:'in',
    scroll:'Scroll the table sideways on small screens',tableLabel:'Size chart, scrollable horizontally',body:'Body measurements',garment:'Garment measurements',
    noHow:'No special instructions were added for this product. Contact the store if you need help measuring.',
    hint:'Converting between cm and in covers numbers and numeric ranges; text values stay as the store entered them.',
    intro:'Enter your measurements and we will suggest the best size from the store\'s chart.',find:'Find my size',clear:'Clear',show:'Show in chart',
    fit:'Your best size',near:'Closest size to your measurements',none:'Enter at least one measurement.',nomatch:'We could not find a size close to your measurements.',
    note:'This is an estimate based on the store\'s chart.',video:'How-to-measure video',image:'How-to-measure illustration',names:categoryNames},
};
const language=guide=>guide.language==='en'?'en':guide.language==='auto'?((document.documentElement.lang||'ar').toLowerCase().startsWith('en')?'en':'ar'):'ar';
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
const DIGITS=c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c);
const normalizeNumber=value=>String(value).trim().replace(/[٠-٩]/g,c=>DIGITS(c)).replace(/[۰-۹]/g,c=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(c)).replace(/٫/g,'.');
function convert(value,from,to){if(from===to)return value;let v=normalizeNumber(value);if(!/^\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?$/.test(v))return value;return v.split(/\s*[-–]\s*/).map(x=>{let n=Number(x)*(from==='cm'?1/2.54:2.54);return Number(n.toFixed(1)).toString()}).join(' – ')}
/* Size finder: rank the rows by how close the shopper's numbers are to each row's cells (a single number covers half a step either side). */
function cellRange(value){const m=normalizeNumber(value).match(/^(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?$/);if(!m)return null;const a=Number(m[1]),b=m[2]===undefined?a:Number(m[2]);return [Math.min(a,b),Math.max(a,b)];}
function recommend(guide,inputs){
  const cols=Object.keys(inputs).map(Number).filter(i=>guide.columns[i]?.kind==='measurement'&&Number.isFinite(inputs[i])&&inputs[i]>0);
  if(!cols.length)return null;
  const info={};
  for(const i of cols){
    const mids=guide.rows.map(r=>cellRange(r.values[i])).filter(Boolean).map(([lo,hi])=>(lo+hi)/2).sort((a,b)=>a-b);
    if(!mids.length)continue;
    const steps=mids.slice(1).map((x,k)=>x-mids[k]).filter(x=>x>0);
    info[i]={spread:(mids[mids.length-1]-mids[0])||1,tolerance:steps.length?Math.min(...steps)/2:0};
  }
  let best=null;
  guide.rows.forEach((row,index)=>{
    let primary=0,secondary=0,used=0;
    for(const i of cols){
      const range=cellRange(row.values[i]);if(!range||!info[i])continue;used++;
      const tol=range[0]===range[1]?info[i].tolerance:0,x=inputs[i],low=range[0]-tol,high=range[1]+tol;
      primary+=(x<low?low-x:x>high?x-high:0)/info[i].spread;secondary+=Math.abs(x-(range[0]+range[1])/2)/info[i].spread;
    }
    if(!used)return;
    if(!best||primary<best.primary-1e-9||(Math.abs(primary-best.primary)<1e-9&&secondary<best.secondary))best={index,primary,secondary};
  });
  return best&&{index:best.index,exact:best.primary<1e-9};
}
function videoEmbed(url){
  const youtube=url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{5,20})/),vimeo=url.match(/vimeo\.com\/(?:video\/)?([A-Za-z0-9_-]{5,20})/);
  return youtube?'https://www.youtube-nocookie.com/embed/'+youtube[1]:vimeo?'https://player.vimeo.com/video/'+vimeo[1]:'';
}
const HTTPS=/^https:\/\/[^\s"'<>\\]{4,480}$/;
function render(host,guide,productName,close){
  host.replaceChildren();const {theme:t,vars}=tokens(guide),p=palette(guide),lang=language(guide),w=words[lang];let unit=guide.unit;
  const box=el('div',undefined,'wrap');for(const [key,value] of Object.entries(vars))box.style.setProperty(key,value);box.dir=lang==='en'?'ltr':'rtl';
  box.dataset.table=guide.table_style||'zebra';box.dataset.density=guide.density||'comfortable';box.dataset.corners=guide.corners||'soft';box.dataset.depth=guide.depth3d===false?'0':'1';box.dataset.theme=t.id;
  box.dataset.sizestyle=['chip','pill','square','underline','plain'].includes(guide.size_style)?guide.size_style:'chip';box.dataset.head=p.headStyle;
  box.dataset.border=['none','thin','strong'].includes(guide.border_style)?guide.border_style:'thin';box.dataset.font=['small','large'].includes(guide.font_scale)?guide.font_scale:'medium';box.dataset.sticky=guide.sticky_size===false?'0':'1';
  const cat=category(guide.category),hero=el('div',undefined,'hero'),titles=el('div',undefined,'titles');
  if(typeof guide.logo_url==='string'&&HTTPS.test(guide.logo_url)){const logo=el('img',undefined,'logo');logo.alt='';logo.referrerPolicy='no-referrer';logo.src=guide.logo_url;hero.append(logo);}
  else if(guide.header_icon!==false)hero.append(emblem(cat.id));
  const title=el('h2',guide.title);title.id='size-guide-title';
  const chips=el('div',undefined,'chips');if(cat.id!=='general')chips.append(el('span',lang==='en'?(w.names[cat.id]||cat.name):cat.name,'tag'));chips.append(el('span',guide.measurement_type==='body'?w.body:w.garment,'tag'));
  titles.append(title,el('p',productName,'product'),chips);hero.append(titles);
  if(close){const b=el('button','×','close');b.type='button';b.setAttribute('aria-label',w.close);b.onclick=close;hero.append(b)}
  const body=el('div',undefined,'body'),tabs=el('div',undefined,'tabs');tabs.setAttribute('role','tablist');
  const measured=guide.columns.map((c,i)=>c.kind==='measurement'?i:-1).filter(i=>i>=0),hasFinder=guide.calculator===true&&measured.length>0;
  const tabDefs=[['table',w.table],['how',w.how],...(hasFinder?[['finder',w.finder]]:[])],tabButtons=[],panels={};
  const grid=el('div'),how=el('div'),finder=el('div',undefined,'finder');panels.table=grid;panels.how=how;panels.finder=finder;
  how.append(el('div',guide.instructions||w.noHow,'instructions'));
  const images=(guide.how_images||[]).filter(u=>HTTPS.test(u)).slice(0,4);
  if(images.length){const media=el('div',undefined,'how-media');for(const u of images){const img=el('img');img.loading='lazy';img.alt=w.image;img.referrerPolicy='no-referrer';img.src=u;media.append(img)}how.append(media)}
  const embed=guide.how_video?videoEmbed(guide.how_video):'';
  if(embed){const wrapper=el('div',undefined,'video'),frame=el('iframe');frame.src=embed;frame.title=w.video;frame.loading='lazy';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');wrapper.append(frame);how.append(wrapper)}
  body.append(tabs,grid,how,finder);box.append(hero,body);
  function select(name){tabDefs.forEach(([id],i)=>{const on=id===name;panels[id].hidden=!on;tabButtons[i].setAttribute('aria-selected',String(on));tabButtons[i].tabIndex=on?0:-1;});}
  tabDefs.forEach(([id,label],i)=>{
    const b=el('button',label);b.type='button';b.id='sg-'+id+'-tab';b.setAttribute('role','tab');b.setAttribute('aria-controls','sg-'+id);tabs.append(b);tabButtons.push(b);
    const panel=panels[id];panel.id='sg-'+id;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);
    b.onclick=()=>select(id);
    b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?tabDefs.length-1:(i+(e.key==='ArrowRight'?(lang==='en'?1:-1):(lang==='en'?-1:1))+tabDefs.length)%tabDefs.length;tabButtons[next].click();tabButtons[next].focus()}};
  });
  let hit=-1,refreshLabels=()=>{};
  function draw(){
    refreshLabels();grid.replaceChildren();const bar=el('div',undefined,'bar'),units=el('div',undefined,'units');units.setAttribute('role','group');units.setAttribute('aria-label',w.unit);
    for(const [code,label] of [['cm',w.cm],['in',w.inch]]){const b=el('button',label);b.type='button';b.setAttribute('aria-pressed',String(unit===code));b.onclick=()=>{unit=code;draw()};units.append(b)}
    bar.append(el('span',w.scroll,'legend'),units);grid.append(bar);
    const scroll=el('div',undefined,'scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label',w.tableLabel);
    const table=el('table'),thead=el('thead'),tr=el('tr');tr.append(el('th',guide.size_label||w.size));
    for(const c of guide.columns)tr.append(el('th',c.label+(c.kind==='measurement'?' ('+(unit==='cm'?w.cm:w.inch)+')':'')));
    for(const x of tr.children)x.scope='col';thead.append(tr);table.append(thead);
    const tb=el('tbody');guide.rows.forEach((r,index)=>{const row=el('tr',undefined,index===hit?'hit':''),label=el('th');label.scope='row';label.append(el('span',r.size||'—','chip'));row.append(label);
      r.values.forEach((v,i)=>row.append(el('td',guide.columns[i]?.kind==='measurement'?convert(v,guide.unit,unit):v)));tb.append(row)});
    table.append(tb);scroll.append(table);grid.append(scroll);if(guide.notes)grid.append(el('p',guide.notes,'notes'));
    grid.append(el('p',w.hint,'hint'));
  }
  if(hasFinder){
    finder.append(el('p',w.intro));const fields=el('div',undefined,'fields'),inputs={},result=el('div',undefined,'result');result.setAttribute('aria-live','polite');
    const labels={};refreshLabels=()=>{for(const i of measured)labels[i].textContent=guide.columns[i].label+' ('+(unit==='cm'?w.cm:w.inch)+')';};
    for(const i of measured){const f=el('div',undefined,'field'),label=el('label'),input=el('input');
      input.type='text';input.inputMode='decimal';input.autocomplete='off';input.id='sg-find-'+i;label.htmlFor=input.id;labels[i]=label;inputs[i]=input;f.append(label,input);fields.append(f)}
    refreshLabels();
    const actions=el('div',undefined,'actions'),find=el('button',w.find,'primary'),clear=el('button',w.clear,'ghost'),show=el('button',w.show,'ghost');for(const b of [find,clear,show])b.type='button';show.hidden=true;actions.append(find,clear,show);
    find.onclick=()=>{
      const values={};for(const [i,input] of Object.entries(inputs)){const n=Number(normalizeNumber(input.value));if(input.value.trim()&&Number.isFinite(n)&&n>0)values[i]=unit===guide.unit?n:(unit==='in'?n*2.54:n/2.54);}
      result.replaceChildren();show.hidden=true;hit=-1;
      if(!Object.keys(values).length){result.append(el('span',w.none));return}
      const found=recommend(guide,values);
      if(!found){result.append(el('span',w.nomatch));return}
      hit=found.index;result.append(el('small',found.exact?w.fit:w.near),el('strong',guide.rows[found.index].size||'—'),el('small',w.note));show.hidden=false;draw();
      window.SizeGuideUI?.onEvent?.('recommend');
    };
    clear.onclick=()=>{for(const input of Object.values(inputs))input.value='';result.replaceChildren();show.hidden=true;hit=-1;draw();};
    show.onclick=()=>{select('table');tabButtons[0].focus()};
    finder.append(fields,actions,result);
  }
  draw();select('table');host.append(box);
}
function shadow(host){const root=host.shadowRoot||host.attachShadow({mode:'open'});root.replaceChildren();root.append(el('style',css));return root}
function preview(host,guide,name){let root=shadow(host),surface=el('div');root.append(surface);render(surface,guide,name)}
function open(guide,name){const previous=document.activeElement;const host=el('div');host.style.cssText='position:relative;z-index:2147483647';document.body.append(host);const root=shadow(host),dialog=el('dialog');dialog.dir=language(guide)==='en'?'ltr':'rtl';dialog.setAttribute('aria-labelledby','size-guide-title');const close=()=>dialog.close();root.append(dialog);render(dialog,guide,name,close);dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}});dialog.addEventListener('close',()=>{host.remove();previous?.focus()},{once:true});dialog.showModal()}
window.SizeGuideUI={preview,open,convert,recommend,categories,themes,emblem,tokens,palette,mix,language};
})();
