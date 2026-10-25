// Guide window, category catalog and themes; DOM only, no network or browser.
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const read=n=>fs.readFileSync(path.join(__dirname,'static',n),'utf8');
const dom=new JSDOM('<body></body>',{url:'https://store.test/p42',runScripts:'outside-only'});
const w=dom.window,d=w.document;
(async()=>{try{
  w.eval(read('size-guide-renderer.js'));w.eval(read('size-guide-catalog.js'));
  const UI=w.SizeGuideUI,Catalog=w.SizeGuideCatalog;
  assert.equal(UI.categories.length,7);assert.equal(UI.themes.length,13);

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
  // ready-made measuring drawing per category; uploaded images allowed, svg/html data URLs are not
  {const host=d.createElement('div');
   for(const cat of ['women','men','kids','shoes','pets','accessories','general']){UI.preview(host,{...guide,instructions:'',category:cat,how_art:'auto'},'منتج');const r=shadow(host);
     assert.ok(r.querySelector('.measure img,.measure svg'),cat+' drawing');assert.ok(r.querySelectorAll('.measure li').length>=1);assert.equal(r.querySelector('.measure svg script'),null)}
   for(const art of ['women','men','kids']){UI.preview(host,{...guide,category:'shoes',how_art:art},'منتج');assert.match(shadow(host).querySelector('.measure img').src,/^data:image\/webp;base64,/)}
   UI.preview(host,{...guide,how_art:'none'},'منتج');assert.equal(shadow(host).querySelector('.measure'),null);UI.preview(host,{...guide},'منتج');assert.equal(shadow(host).querySelector('.measure'),null,'old guides unchanged');
   UI.preview(host,{...guide,instructions:'',how_art:'auto',language:'en'},'x');assert.match(shadow(host).querySelector('.measure li').textContent,/[A-Za-z]/);
   {UI.preview(host,{...guide,category:'women',how_art:'auto',instructions:'الصدر: قياس أكبر جزء'},'منتج');const r=shadow(host);
    assert.equal(r.querySelector('.measure .instructions.beside').textContent,'الصدر: قياس أكبر جزء');assert.equal(r.querySelectorAll('#sg-how .instructions').length,1,'text only once, beside the picture');assert.equal(r.querySelector('.measure li'),null);
    UI.preview(host,{...guide,category:'women',how_art:'none',instructions:'نص'},'منتج');assert.equal(shadow(host).querySelector('.measure'),null);assert.equal(shadow(host).querySelector('#sg-how .instructions').textContent,'نص');
    assert.equal(UI.tipsFor('auto','men','ar').tips.length,4);}
   {const lin={...guide,theme:'linen',category:'women'},img='https://cdn.example.com/tee.png',back='data:image/jpeg;base64,'+'B'.repeat(60),W=()=>shadow(host).querySelector('.wrap');
    UI.preview(host,lin,'x');let r=shadow(host);assert.equal(W().dataset.split,'end');assert.ok(r.querySelector('#sg-table .tcol table'));assert.ok(r.querySelector('#sg-table .side svg.figure'),'category drawing when no photo');assert.equal(r.querySelector('.side .views'),null);assert.equal(r.querySelector('.side').dataset.threed,'0');
    UI.preview(host,{...lin,side_image:img},'x');r=shadow(host);assert.equal(r.querySelector('.side img.art').src,img);
    UI.preview(host,{...lin,side_image:'javascript:alert(1)',side_image_back:back},'x');assert.equal(shadow(host).querySelector('.side img'),null,'bad urls ignored');
    UI.preview(host,{...lin,side_image:img,side_image_back:back,side_3d:true},'x');r=shadow(host);assert.equal(r.querySelector('.side').dataset.threed,'1');assert.ok(r.querySelector('.stage .floor'));
    const views=r.querySelectorAll('.side .views button');assert.equal(views.length,2);views[1].click();assert.equal(views[1].getAttribute('aria-pressed'),'true');assert.equal(views[0].getAttribute('aria-pressed'),'false');
    assert.ok(r.querySelector('.stage').classList.contains('turning'),'flips');await new Promise(ok=>setTimeout(ok,200));assert.equal(r.querySelector('.side img.art').src,back);assert.equal(r.querySelector('.stage').classList.contains('turning'),false);
    r.querySelector('.stage').dispatchEvent(new w.Event('pointermove'));views[0].click();await new Promise(ok=>setTimeout(ok,200));assert.equal(r.querySelector('.side img.art').src,img);
    // placement is the guide's own choice, whatever the theme
    UI.preview(host,{...guide,side_layout:'start',side_image:img},'x');assert.equal(W().dataset.split,'start');
    UI.preview(host,{...guide,side_layout:'none',side_image:img,theme:'linen'},'x');assert.equal(W().dataset.split,'none');assert.equal(shadow(host).querySelector('.side'),null);
    UI.preview(host,{...guide,side_image:img},'x');assert.equal(W().dataset.split,'end','a picture alone opens a side panel');
    UI.preview(host,guide,'x');assert.equal(W().dataset.split,'none');assert.equal(shadow(host).querySelector('.side'),null,'other guides unchanged');
    // column widths: only when they line up with the columns
    const gw={...guide,columns:[{label:'a',kind:'measurement'},{label:'b',kind:'measurement'}],rows:[{size:'S',values:['1','2']}]};
    UI.preview(host,{...gw,col_widths:[20,30,50]},'x');r=shadow(host);assert.deepEqual([...r.querySelectorAll('col')].map(c=>c.style.width),['20%','30%','50%']);assert.equal(r.querySelector('table').style.tableLayout,'fixed');
    for(const bad of [[20,80],[1,2,3],[20,30,'x'],[20,30,500]]){UI.preview(host,{...gw,col_widths:bad},'x');assert.equal(shadow(host).querySelector('col'),null,JSON.stringify(bad))}}
   const up='data:image/jpeg;base64,'+'A'.repeat(60);UI.preview(host,{...guide,how_images:[up,'data:image/svg+xml;base64,'+'A'.repeat(60),'data:text/html;base64,'+'A'.repeat(60)]},'منتج');
   const imgs=[...shadow(host).querySelectorAll('.how-media img')];assert.equal(imgs.length,1);assert.equal(imgs[0].src,up);}
  // painted parts: narrower rules win, text turns readable on a painted background, picks report the clicked part
  {const host=d.createElement('div'),g={...guide,instructions:'',columns:[{label:'الصدر',kind:'measurement'},{label:'EU',kind:'text'}],rows:[{size:'S',values:['90','36']},{size:'M',values:['94','38']}],
     cell_styles:[{target:'col',row:-1,col:0,bg:'#112233',fg:'',bold:false,align:''},{target:'row',row:1,col:-1,bg:'#ffeeaa',fg:'',bold:true,align:''},{target:'cell',row:1,col:0,bg:'#00ff00',fg:'#101010',bold:false,align:'center'},
       {target:'head',row:-1,col:-1,bg:'#222222',fg:'',bold:false,align:''},{target:'head',row:-1,col:1,bg:'#ff0000',fg:'',bold:false,align:''},{target:'size',row:0,col:-1,bg:'#abcdef',fg:'',bold:false,align:''},
       {target:'cell',row:0,col:1,bg:'red',fg:'url(x)',bold:'yes',align:'left'},{target:'bogus',row:0,col:0,bg:'#123456'}]};
   const rgb=h=>{const n=parseInt(h.slice(1),16);return `rgb(${n>>16}, ${(n>>8)&255}, ${n&255})`};
   UI.preview(host,g,'x');let r=shadow(host);const cells=[...r.querySelectorAll('tbody tr')].map(tr=>[...tr.children]),heads=[...r.querySelectorAll('thead th')];
   assert.equal(cells[0][1].style.background,rgb('#112233'),'column colour');assert.equal(cells[0][1].style.color,'rgb(255, 255, 255)','readable text on a dark background');
   assert.equal(cells[1][2].style.background,rgb('#ffeeaa'),'row beats nothing else here');assert.equal(cells[1][2].style.fontWeight,'700');
   assert.equal(cells[1][1].style.background,rgb('#00ff00'),'cell beats row and column');assert.equal(cells[1][1].style.color,'rgb(16, 16, 16)');assert.equal(cells[1][1].style.textAlign,'center');
   assert.equal(heads[0].style.background,rgb('#222222'));assert.equal(heads[1].style.background,rgb('#222222'));assert.equal(heads[2].style.background,rgb('#ff0000'),'one header beats all headers');
   assert.equal(cells[0][0].querySelector('.chip').style.background,rgb('#abcdef'));assert.equal(cells[0][2].style.background,'','bad colours and unknown targets are ignored');assert.equal(cells[0][2].style.color,'');
   assert.equal(r.querySelector('.pick'),null,'not clickable outside paint mode');
   const picks=[];UI.preview(host,g,'x',{onPick:p=>picks.push(p),selected:{part:'cell',row:1,col:0}});r=shadow(host);
   r.querySelectorAll('tbody tr')[1].children[1].click();r.querySelector('thead th:nth-child(3)').click();r.querySelectorAll('tbody tr')[0].querySelector('.chip').click();r.querySelector('thead th').click();
   assert.deepEqual(picks.map(p=>JSON.stringify(p)),['{"part":"cell","row":1,"col":0}','{"part":"head","row":-1,"col":1}','{"part":"size","row":0,"col":-1}','{"part":"head","row":-1,"col":-2}']);
   assert.equal(r.querySelectorAll('.sel').length,1);}
  // layout types, the fit scale, a size-system switch and the column highlight
  {const host=d.createElement('div'),base={...guide,instructions:'',calculator:true,columns:[{label:'الصدر',kind:'measurement'},{label:'US',kind:'text'},{label:'EU',kind:'text'}],rows:[{size:'S',values:['90','4','36']},{size:'M',values:['94','6','38']}]},R=()=>shadow(host);
   UI.preview(host,{...base,layout_type:'tabs'},'x');assert.equal(R().querySelector('.wrap').dataset.layout,'tabs');assert.equal(R().querySelectorAll('[role=tab]').length,3);
   UI.preview(host,{...base,layout_type:'page'},'x');assert.equal(R().querySelector('.wrap').dataset.layout,'page');assert.equal(R().querySelector('[role=tab]'),null,'no tab strip');
   assert.deepEqual([...R().querySelectorAll('details.fold-section>summary')].map(x=>x.textContent),['اعرف مقاسك','طريقة القياس'],'help folds away, the table comes first');assert.ok(R().querySelector('#sg-table,.tcol table'));
   UI.preview(host,{...base,layout_type:'compact'},'x');assert.equal(R().querySelector('[role=tab]'),null);assert.equal(R().querySelector('details'),null);assert.equal(R().querySelector('.finder'),null);assert.ok(R().querySelector('table'));
   UI.preview(host,{...base,layout_type:'cards'},'x');assert.equal(R().querySelectorAll('.size-card').length,2);assert.equal(R().querySelector('.tcol table'),null);assert.match(R().querySelector('.size-card').textContent,/90/);assert.equal(R().querySelectorAll('[role=tab]').length,3);
   UI.preview(host,{...base,layout_type:'bogus'},'x');assert.equal(R().querySelector('.wrap').dataset.layout,'tabs','an unknown layout falls back to tabs');
   // fit scale
   UI.preview(host,{...base,fit_level:'slim'},'x');assert.equal(R().querySelector('.fit').dataset.level,'slim');assert.match(R().querySelector('.fit').getAttribute('aria-label'),/قصة ضيقة/);assert.equal(R().querySelectorAll('.fit-track span').length,3);assert.equal(R().querySelector('.fit-track span.on').textContent,'قصة ضيقة');
   UI.preview(host,{...base,fit_level:''},'x');assert.equal(R().querySelector('.fit'),null);UI.preview(host,{...base,fit_level:'huge'},'x');assert.equal(R().querySelector('.fit'),null);
   UI.preview(host,{...base,fit_level:'loose',language:'en'},'x');assert.match(R().querySelector('.fit-title').textContent,/Fit/);
   // size systems: US and EU become choices that replace the size label, the original size moves into a column
   UI.preview(host,base,'x');let sel=R().querySelector('select.sys');assert.deepEqual([...sel.options].map(o=>o.textContent),['المقاس','US','EU']);
   assert.deepEqual([...R().querySelectorAll('tbody tr:first-child .chip')].map(x=>x.textContent),['S']);
   sel.value='2';sel.dispatchEvent(new w.Event('change'));sel=R().querySelector('select.sys');assert.equal(sel.value,'2','the choice survives the redraw');
   assert.deepEqual([...R().querySelectorAll('thead th')].map(x=>x.textContent.replace(/\s*\(.*\)/,'')),['EU','الصدر','US','المقاس'],'EU leads, the old size label takes the EU column');
   assert.equal(R().querySelector('tbody tr:first-child .chip').textContent,'36');assert.equal(R().querySelector('tbody tr:first-child td:last-child').textContent,'S');
   UI.preview(host,{...base,columns:[{label:'الصدر',kind:'measurement'}],rows:[{size:'S',values:['90']}]},'x');assert.equal(R().querySelector('select.sys'),null,'no switch without size-system columns');
   UI.preview(host,{...base,columns:[{label:'USA مقاس',kind:'text'},{label:'EUR',kind:'measurement'}],rows:[{size:'S',values:['4','5']}]},'x');assert.equal(R().querySelector('select.sys'),null,'only text columns named like a size system count');
   // the column under the pointer is lit, and cleared when it leaves
   UI.preview(host,base,'x');{const t=R().querySelector('table'),cell=t.querySelectorAll('tbody tr')[1].children[1];cell.dispatchEvent(new w.Event('pointerover',{bubbles:true}));
    assert.equal(t.querySelectorAll('.col-hl').length,3,'header and both rows of that column');assert.ok(t.rows[0].cells[1].classList.contains('col-hl'));
    t.dispatchEvent(new w.Event('pointerleave'));assert.equal(t.querySelectorAll('.col-hl').length,0);}
  }
  // painted parts follow their rows and columns when one is removed
  {const st=[{target:'cell',row:0,col:0,bg:'#111111'},{target:'cell',row:2,col:1,bg:'#222222'},{target:'row',row:1,col:-1,bg:'#333333'},{target:'col',row:-1,col:2,bg:'#444444'},{target:'head',row:-1,col:-1,bg:'#555555'},{target:'head',row:-1,col:1,bg:'#666666'},{target:'size',row:-1,col:-1,bg:'#777777'}];
   const C=w.SizeGuideCatalog;const rows=C.shiftPaint(st,'row',1);assert.deepEqual(rows.map(x=>[x.target,x.row,x.col]),[['cell',0,0],['cell',1,1],['col',-1,2],['head',-1,-1],['head',-1,1],['size',-1,-1]],'row 1 styles go, row 2 becomes row 1');
   const cols=C.shiftPaint(st,'col',1);assert.deepEqual(cols.map(x=>[x.target,x.row,x.col]),[['cell',0,0],['row',1,-1],['col',-1,1],['head',-1,-1],['size',-1,-1]],'column 1 styles go, column 2 becomes column 1, global ones stay');
   assert.equal(C.shiftPaint(undefined,'row',0).length,0);assert.equal(st.length,7,'the input is not changed');}
  // live editing: cells, headers and sizes become text fields; rows and columns can be added and removed
  {const host=d.createElement('div'),log=[],focusKeys=['cell:1:0'],edit={set(meta,text){log.push(['set',meta.part,meta.row,meta.col,text]);return text!=='BAD'},add(what){log.push(['add',what])},remove(what,i){log.push(['remove',what,i])},takeFocus(){return focusKeys.shift()||null}},R=()=>shadow(host);
   const g={...guide,instructions:'',calculator:false,unit:'cm',columns:[{label:'الصدر',kind:'measurement'},{label:'EU',kind:'text'}],rows:[{size:'S',values:['90','36']},{size:'M',values:['94','38']}]};
   UI.preview(host,g,'x',{edit});let r=R();const spans=[...r.querySelectorAll('.ed')];
   assert.equal(spans.length,1+2+2+4,'size label, two headers, two sizes and four cells');assert.ok(spans.every(x=>x.getAttribute('role')==='textbox'&&x.contentEditable!=='false'));assert.equal(r.querySelectorAll('.unit-suffix').length,2);
   assert.equal(r.querySelector('.units'),null,'no unit switch while editing');assert.match(r.querySelector('.unit-note').textContent,/سم/);assert.equal(r.querySelector('select.sys'),null);
   assert.equal(r.querySelectorAll('tbody tr .ed-del').length,2);assert.equal(r.querySelectorAll('thead .ed-del-col').length,2);assert.ok(r.querySelector('thead .ed-add-col'));assert.ok(r.querySelector('.ed-add'));
   const cell=(row,col)=>r.querySelector(`.ed[data-part="cell"][data-row="${row}"][data-col="${col}"]`);
   // values are shown raw, never converted
   UI.preview(host,{...g,unit:'in'},'x',{edit});r=R();assert.equal(cell(0,0).textContent,'90','no cm/in conversion while editing');assert.match(r.querySelector('.unit-note').textContent,/إنش/);
   UI.preview(host,g,'x',{edit});r=R();
   // typing and leaving the cell commits; nothing re-renders (focus stays where the user clicks)
   const c=cell(0,0);c.dispatchEvent(new w.Event('focusin',{bubbles:true}));c.textContent='  91 ';c.dispatchEvent(new w.Event('focusout',{bubbles:true}));assert.deepEqual(log.pop(),['set','cell',0,0,'91']);assert.ok(R().querySelector('.ed')===r.querySelector('.ed'),'the same nodes are still there');
   c.dispatchEvent(new w.Event('focusout',{bubbles:true}));assert.equal(log.length,0,'unchanged text is not committed twice');
   const head=r.querySelector('.ed[data-part="head"][data-col="1"]');head.dispatchEvent(new w.Event('focusin',{bubbles:true}));head.textContent='BAD';head.dispatchEvent(new w.Event('focusout',{bubbles:true}));assert.equal(head.textContent,'EU','a refused value goes back');log.length=0;
   // Enter commits and moves down the column, Escape puts the old text back
   const first=cell(0,1);first.dispatchEvent(new w.Event('focusin',{bubbles:true}));first.textContent='37';let moved=null;cell(1,1).focus=()=>{moved='cell(1,1)'};
   const enter=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});first.dispatchEvent(enter);assert.equal(enter.defaultPrevented,true,'no line break');assert.deepEqual(log.pop(),['set','cell',0,1,'37']);assert.equal(moved,'cell(1,1)');
   const esc=cell(1,0);esc.dispatchEvent(new w.Event('focusin',{bubbles:true}));esc.textContent='oops';esc.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(esc.textContent,'94');
   const long=cell(0,0);long.textContent='x'.repeat(80);long.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(long.textContent.length,40,'values stop at 40 characters');
   // controls
   r.querySelector('.ed-add').click();r.querySelector('thead .ed-add-col').click();r.querySelectorAll('tbody tr .ed-del')[1].click();r.querySelectorAll('thead .ed-del-col')[0].click();
   assert.deepEqual(log.filter(x=>x[0]!=='set'),[['add','row'],['add','column'],['remove','row',1],['remove','column',0]]);
   // focus requested by the editor lands on the new field
   focusKeys.push('size:2:-1');UI.preview(host,{...g,rows:[...g.rows,{size:'',values:['','']}]},'x',{edit});await wait(20);
   // cards and the paint picker are untouched by editing
   UI.preview(host,{...g,layout_type:'cards'},'x',{edit});assert.equal(R().querySelector('.ed'),null,'cards are not editable');assert.ok(R().querySelector('.size-card'));
   const picks=[];UI.preview(host,g,'x',{onPick:p=>picks.push(p)});assert.equal(R().querySelector('.ed'),null);R().querySelector('tbody td').click();assert.equal(picks.length,1);
  }
  // the store's colour: kept when readable, nudged when not, header suited to its weight
  {const b=UI.brandStyle('#7b2338');assert.equal(b.color,'#7b2338');assert.equal(b.adjusted,false);assert.equal(b.header_style,'solid');
   const pale=UI.brandStyle('#ffe9a8');assert.equal(pale.adjusted,true);assert.ok(UI.contrast(pale.color,'#ffffff')>=3,'a pale brand colour is darkened until it reads');
   const onDark=UI.brandStyle('#202020','#1d2326');assert.equal(onDark.adjusted,true);assert.ok(UI.contrast(onDark.color,'#1d2326')>=3,'and lightened on a dark table');
   assert.equal(UI.brandStyle('#177e65').header_style,'solid');assert.equal(UI.brandStyle('#ffffff').adjusted,true,'white on white is darkened to a usable colour');
   for(const bad of ['red','#12345','','javascript:x',null,undefined])assert.equal(UI.brandStyle(bad),null);
   assert.ok(Math.abs(UI.contrast('#000000','#ffffff')-21)<.01);}
  // ready-made looks only touch appearance fields and render with every theme
  {const C=w.SizeGuideCatalog,allowed=new Set(C.STYLE_FIELDS);assert.equal(C.stylePresets.length,7);
   for(const preset of C.stylePresets){
     assert.ok(Object.keys(preset.style).every(k=>allowed.has(k)),'only appearance fields: '+preset.id);
     for(const key of ['header_bg','header_text','row_alt','border_color','text_color','paper_color','size_bg','size_text'])assert.equal(preset.style[key],'','no leftover custom colours: '+preset.id);
     assert.ok(UI.themes.some(t=>t.id===preset.style.theme));
     const host=d.createElement('div');UI.preview(host,{...guide,...preset.style,color:UI.themes.find(t=>t.id===preset.style.theme).accent},'منتج');assert.ok(shadow(host).querySelector('table'));
   }
   assert.equal(C.STYLE_FIELDS.filter(k=>['title','columns','rows','notes','instructions','category','language','calculator'].includes(k)).length,0,'content never travels with a look');
   for(const c of UI.categories){const list=C.phrasesFor(c.id);assert.ok(list.length>=4);assert.ok(list.every(x=>x.length<=300&&x.trim()));assert.equal(new Set(list).size,list.length)}}
  console.log('PASS: 7 categories x 13 themes x 4 table styles, starter templates, safe fallbacks, accent contrast, escaping, units, tabs, custom colours, size-cell styles, languages, size finder, media, brand colour, ready-made looks and dialog.');
}finally{w.close();}})().catch(error=>{console.error(error);process.exit(1)});
