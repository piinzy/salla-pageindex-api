// Guide window, category catalog and themes; DOM only, no network or browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const read=n=>fs.readFileSync(path.join(__dirname,'static',n),'utf8');
const dom=new JSDOM('<body></body>',{url:'https://store.test/p42',runScripts:'outside-only'});
const w=dom.window,d=w.document;
try{
  w.eval(read('size-guide-renderer.js'));w.eval(read('size-guide-catalog.js'));
  const UI=w.SizeGuideUI,Catalog=w.SizeGuideCatalog;
  assert.equal(UI.categories.length,7);assert.equal(UI.themes.length,12);

  // every starter template satisfies the server's grid rules and ships no invented measurements
  for(const t of Catalog.templates){
    const labels=t.columns.map(c=>c.label.trim().toLowerCase());
    assert.ok(t.columns.length>=1&&t.columns.length<=10,t.id);assert.equal(new Set(labels).size,labels.length,'unique columns '+t.id);
    assert.ok(t.columns.every(c=>c.label.length<=40&&['measurement','text'].includes(c.kind)),t.id);
    assert.ok(t.sizes.length>=1&&t.sizes.length<=30&&t.sizes.every(s=>s.length<=30),t.id);assert.ok(UI.categories.some(c=>c.id===t.category),t.id);
    const g=Catalog.fresh(t.id);assert.equal(g.category,t.category);assert.ok(g.rows.every(r=>r.values.length===g.columns.length&&r.values.every(v=>v==='')),'blank cells '+t.id);
    assert.ok(UI.themes.some(x=>x.id===g.theme),'default theme exists '+t.id);
  }
  for(const c of UI.categories)assert.ok(Catalog.forCategory(c.id).length>=1,'templates for '+c.id);
  for(const id of ['women','men','shoes','pets'])assert.ok(Catalog.forCategory(id).length>=3,id);

  const guide={title:'دليل المقاسات',button_label:'دليل',unit:'cm',measurement_type:'garment',
    columns:[{label:'الصدر',kind:'measurement'},{label:'EU',kind:'text'}],rows:[{size:'S',values:['90','36']},{size:'M',values:['94-98','38']}],notes:'ملاحظة',instructions:'خطوات القياس',color:'#177e65'};
  const shadow=host=>host.shadowRoot;
  for(const category of UI.categories)for(const theme of UI.themes)for(const table_style of ['zebra','lines','cards','plain']){
    const host=d.createElement('div');UI.preview(host,{...guide,category:category.id,theme:theme.id,table_style},'منتج');
    const wrap=shadow(host).querySelector('.wrap');assert.equal(wrap.dataset.theme,theme.id);assert.equal(wrap.dataset.table,table_style);
    assert.equal(shadow(host).querySelectorAll('tbody tr').length,2);assert.equal(shadow(host).querySelectorAll('thead th').length,3);
    assert.ok(shadow(host).querySelector('svg.emblem'),'category emblem');
  }
  // old guides without the new fields still render with safe defaults
  {const host=d.createElement('div');UI.preview(host,guide,'منتج');const wrap=shadow(host).querySelector('.wrap');
   assert.equal(wrap.dataset.theme,'classic');assert.equal(wrap.dataset.table,'zebra');assert.equal(wrap.dataset.depth,'1');assert.equal(wrap.dataset.corners,'soft');}
  {const host=d.createElement('div');UI.preview(host,{...guide,theme:'nope',category:'nope',header_icon:false,depth3d:false,density:'compact',corners:'round'},'منتج');
   const wrap=shadow(host).querySelector('.wrap');assert.equal(wrap.dataset.theme,'classic');assert.equal(shadow(host).querySelector('svg.emblem'),null);
   assert.equal(wrap.dataset.depth,'0');assert.equal(wrap.dataset.density,'compact');assert.equal(wrap.dataset.corners,'round');}
  // accent colour and readable header text
  {const dark=UI.tokens({...guide,theme:'velvet',color:'#7b2338'}).vars,light=UI.tokens({...guide,theme:'velvet',color:'#f2c9d7'}).vars,bad=UI.tokens({...guide,color:'red;url(x)'}).vars;
   assert.equal(dark['--accent'],'#7b2338');assert.equal(dark['--head-ink'],'#ffffff');assert.equal(light['--head-ink'],'#1b1b1b');assert.equal(bad['--accent'],'#177e65','invalid colours are ignored');}
  // text is never interpreted as markup
  {const host=d.createElement('div');UI.preview(host,{...guide,title:'<img src=x onerror=alert(1)>',notes:'<b>x</b>',columns:[{label:'<i>c</i>',kind:'text'},{label:'EU',kind:'text'}],rows:[{size:'<u>S</u>',values:['<s>1</s>','2']}]},'<svg onload=alert(1)>');
   assert.equal(shadow(host).querySelector('img'),null);assert.equal(shadow(host).querySelector('b'),null);assert.equal(shadow(host).querySelector('u'),null);assert.equal(shadow(host).querySelector('svg[onload]'),null);
   assert.match(shadow(host).querySelector('h2').textContent,/<img/);}
  // units and tabs
  {const host=d.createElement('div');UI.preview(host,guide,'منتج');const root=shadow(host);
   const unit=name=>[...root.querySelectorAll('.units button')].find(b=>b.textContent===name);
   assert.equal(root.querySelector('tbody td').textContent,'90');unit('إنش').click();assert.equal(root.querySelector('tbody td').textContent,'35.4');assert.equal(unit('إنش').getAttribute('aria-pressed'),'true');
   assert.match(root.querySelector('thead th:nth-child(2)').textContent,/إنش/);unit('سم').click();assert.equal(root.querySelector('tbody td').textContent,'90');
   const [table,how]=root.querySelectorAll('[role=tab]');assert.equal(table.getAttribute('aria-selected'),'true');how.click();
   assert.equal(root.querySelector('#sg-table').hidden,true);assert.equal(root.querySelector('#sg-how').hidden,false);assert.equal(how.getAttribute('aria-selected'),'true');}
  // the window: labelled dialog with a close control and focus restoration
  {w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
   w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
   const opener=d.createElement('button');d.body.append(opener);opener.focus();UI.open({...guide,category:'shoes',theme:'sport'},'حذاء');
   const dialog=d.body.lastElementChild.shadowRoot.querySelector('dialog');assert.equal(dialog.getAttribute('aria-labelledby'),'size-guide-title');assert.ok(dialog.hasAttribute('open'));
   const close=dialog.querySelector('.close');assert.equal(close.getAttribute('aria-label'),'إغلاق دليل المقاسات');close.click();
   assert.equal([...d.body.children].filter(n=>n.shadowRoot).length,0,'window removed after closing');assert.equal(d.activeElement,opener);}
  // the merchant's own colours win over the theme, and header text stays readable
  {const base={...guide,theme:'classic',color:'#177e65'},plain=UI.palette(base);
   const own=UI.palette({...base,header_bg:'#101010',row_alt:'#fafafa',border_color:'#ff0000',text_color:'#222222',paper_color:'#fefefe',size_bg:'#0a0a0a'});
   assert.equal(own.headBg,'#101010');assert.equal(own.headInk,'#ffffff','white text on a dark custom header');assert.equal(own.alt,'#fafafa');assert.equal(own.line,'#ff0000');assert.equal(own.ink,'#222222');assert.equal(own.paper,'#fefefe');assert.equal(own.chipBg,'#0a0a0a');assert.equal(own.chipInk,'#ffffff');
   assert.equal(UI.palette({...base,header_bg:'#f0f0f0'}).headInk,'#1b1b1b');assert.equal(UI.palette({...base,header_bg:'javascript:x'}).headBg,plain.headBg,'invalid colours are ignored');
   assert.equal(UI.palette({...base,header_text:'#abcdef'}).headInk,'#abcdef');
   assert.equal(UI.palette({...base,header_style:'solid'}).headBg,'#177e65');assert.equal(UI.palette({...base,header_style:'plain'}).headBg,plain.paper);
   assert.equal(UI.mix('#000000','#ffffff',.5),'#808080');
   const host=d.createElement('div');UI.preview(host,{...base,header_bg:'#101010',size_text:'#ff00ff'},'منتج');const wrap=shadow(host).querySelector('.wrap');
   assert.equal(wrap.style.getPropertyValue('--head-bg'),'#101010');assert.equal(wrap.style.getPropertyValue('--chip-ink'),'#ff00ff');}
  // size cell, header, border, font and sticky options reach the markup
  {const host=d.createElement('div');UI.preview(host,{...guide,size_style:'underline',header_style:'line',border_style:'strong',font_scale:'large',sticky_size:false,size_label:'الحجم'},'منتج');
   const wrap=shadow(host).querySelector('.wrap');assert.deepEqual([wrap.dataset.sizestyle,wrap.dataset.head,wrap.dataset.border,wrap.dataset.font,wrap.dataset.sticky],['underline','line','strong','large','0']);
   assert.equal(shadow(host).querySelector('thead th').textContent,'الحجم');
   UI.preview(host,{...guide,size_style:'bogus',header_style:'bogus',border_style:'bogus',font_scale:'bogus'},'منتج');
   const fallback=shadow(host).querySelector('.wrap');assert.deepEqual([fallback.dataset.sizestyle,fallback.dataset.border,fallback.dataset.font,fallback.dataset.sticky],['chip','thin','medium','1']);
   assert.equal(shadow(host).querySelector('thead th').textContent,'المقاس');}
  // language: Arabic by default, English on request, automatic from the page
  {const host=d.createElement('div');UI.preview(host,{...guide,language:'en',category:'shoes',calculator:true},'Product');const root=shadow(host);
   assert.equal(root.querySelector('.wrap').dir,'ltr');assert.equal(root.querySelector('thead th').textContent,'Size');
   assert.deepEqual([...root.querySelectorAll('[role=tab]')].map(b=>b.textContent),['Size chart','How to measure','Find my size']);
   assert.match(root.querySelector('.tag').textContent,/Shoes/);assert.match(root.querySelector('.hint').textContent,/Converting/);
   d.documentElement.lang='en-US';assert.equal(UI.language({language:'auto'}),'en');d.documentElement.lang='ar';assert.equal(UI.language({language:'auto'}),'ar');assert.equal(UI.language({}),'ar');}
  // size finder maths
  {const chart={unit:'cm',columns:[{label:'الصدر',kind:'measurement'},{label:'الخصر',kind:'measurement'},{label:'EU',kind:'text'}],
     rows:[{size:'S',values:['86-90','66','36']},{size:'M',values:['90-94','70','38']},{size:'L',values:['94-98','74','40']},{size:'XL',values:['98-102','78','42']}]};
   const r=(inputs)=>UI.recommend(chart,inputs);
   assert.equal(JSON.stringify(r({0:92})),'{"index":1,"exact":true}');assert.deepEqual(r({0:98}).exact,true);
   assert.equal(r({0:88,1:74}).exact,false,'conflicting measurements give the closest row, flagged as approximate');
   assert.equal(r({0:120}).index,3);assert.equal(r({0:120}).exact,false);assert.equal(r({0:40}).index,0);
   assert.equal(r({1:70}).index,1,'a single number covers half a step either side');assert.equal(r({1:71}).index,1);assert.equal(r({1:72.5}).index,2);
   assert.equal(r({2:38}),null,'text columns are never used');assert.equal(r({}),null);assert.equal(r({0:NaN}),null);assert.equal(r({0:-5}),null);
   assert.equal(UI.recommend({columns:[{label:'x',kind:'measurement'}],rows:[{size:'S',values:['—']}]},{0:5}),null,'cells without numbers cannot match');
   assert.equal(UI.recommend({unit:'cm',columns:[{label:'x',kind:'measurement'}],rows:[{size:'S',values:['٩٠']},{size:'M',values:['٩٦']}]},{0:96}).index,1,'Arabic digits in the chart');
   // in the window: input in inches is converted to the chart's unit, the row is highlighted and the hook fires once
   const host=d.createElement('div'),events=[];UI.onEvent=type=>events.push(type);UI.preview(host,{...guide,...chart,calculator:true,title:'t',notes:'',instructions:''},'منتج');const root=shadow(host);
   assert.equal([...root.querySelectorAll('[role=tab]')].length,3);
   const [chest]=root.querySelectorAll('.finder input');assert.match(root.querySelector('.finder label').textContent,/سم/);
   root.querySelectorAll('.units button')[1].click();   // show the table in inches: the finder follows
   assert.match(root.querySelector('.finder label').textContent,/إنش/);
   chest.value='36.2';root.querySelector('.finder .primary').click();   // 36.2 in is about 92 cm
   assert.equal(root.querySelector('.result strong').textContent,'M','36.2 in is 92 cm');
   assert.equal(root.querySelector('tbody tr.hit th').textContent,'M');
   assert.equal(events.length,1);delete UI.onEvent;
   assert.equal(UI.recommend(chart,{0:36.2*2.54}).index,1);
   const none=d.createElement('div');UI.preview(none,{...guide,calculator:false},'منتج');assert.equal(shadow(none).querySelectorAll('[role=tab]').length,2,'finder is opt-in');
   const textOnly=d.createElement('div');UI.preview(textOnly,{...guide,columns:[{label:'EU',kind:'text'}],rows:[{size:'S',values:['36']}],calculator:true},'منتج');assert.equal(shadow(textOnly).querySelectorAll('[role=tab]').length,2,'no finder without measurements');}
  // finder inside the window: highlight + jump to the table
  {const chart={...guide,columns:[{label:'الصدر',kind:'measurement'}],rows:[{size:'S',values:['86-90']},{size:'M',values:['90-94']}],calculator:true};
   const host=d.createElement('div');UI.preview(host,chart,'منتج');const root=shadow(host);
   root.querySelector('.finder input').value='٩٣';root.querySelector('.finder .primary').click();
   assert.equal(root.querySelector('.result strong').textContent,'M');assert.ok(root.querySelector('.finder .ghost:last-child').hidden===false);
   assert.equal(root.querySelector('tbody tr.hit th').textContent,'M');root.querySelector('.finder .ghost:last-child').click();assert.equal(root.querySelector('#sg-table').hidden,false);
   root.querySelector('.finder .ghost:nth-child(2)').click();assert.equal(root.querySelector('tbody tr.hit'),null);}
  // media: only https images, real video hosts, sandboxed frame
  {const host=d.createElement('div');UI.preview(host,{...guide,how_images:['https://cdn.example.com/a.png','http://insecure.example.com/b.png','javascript:alert(1)'],how_video:'https://youtu.be/dQw4w9WgXcQ',logo_url:'https://cdn.example.com/logo.png'},'منتج');const root=shadow(host);
   const imgs=[...root.querySelectorAll('.how-media img')];assert.equal(imgs.length,1);assert.equal(imgs[0].src,'https://cdn.example.com/a.png');assert.equal(imgs[0].loading,'lazy');
   const frame=root.querySelector('.video iframe');assert.equal(frame.src,'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');assert.match(frame.getAttribute('sandbox'),/allow-scripts/);assert.doesNotMatch(frame.getAttribute('sandbox'),/top-navigation|popups/);
   assert.equal(root.querySelector('img.logo').src,'https://cdn.example.com/logo.png');assert.equal(root.querySelector('svg.emblem'),null,'a logo replaces the category emblem');
   UI.preview(host,{...guide,how_video:'https://evil.example.com/watch?v=xxxxxxxxxxx',logo_url:'javascript:alert(1)'},'منتج');
   const bad=shadow(host);assert.equal(bad.querySelector('iframe'),null);assert.equal(bad.querySelector('img.logo'),null);assert.ok(bad.querySelector('svg.emblem'));
   UI.preview(host,{...guide,how_video:'https://vimeo.com/123456789'},'منتج');assert.equal(shadow(host).querySelector('iframe').src,'https://player.vimeo.com/video/123456789');}
  console.log('PASS: 7 categories x 12 themes x 4 table styles, starter templates, safe fallbacks, accent contrast, escaping, units, tabs, custom colours, size-cell styles, languages, size finder, media and dialog.');
}finally{w.close();}
