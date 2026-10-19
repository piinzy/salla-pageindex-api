// Guide window, category catalog and themes; DOM only, no network or browser.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const read=n=>fs.readFileSync(path.join(__dirname,'static',n),'utf8');
const dom=new JSDOM('<body></body>',{url:'https://store.test/p42',runScripts:'outside-only'});
const w=dom.window,d=w.document;
try{
  w.eval(read('size-guide-renderer.js'));w.eval(read('size-guide-catalog.js'));
  const UI=w.SizeGuideUI,Catalog=w.SizeGuideCatalog;
  assert.equal(UI.categories.length,6);assert.equal(UI.themes.length,12);

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
   assert.equal(root.querySelector('#sg-grid').hidden,true);assert.equal(root.querySelector('#sg-how').hidden,false);assert.equal(how.getAttribute('aria-selected'),'true');}
  // the window: labelled dialog with a close control and focus restoration
  {w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
   w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
   const opener=d.createElement('button');d.body.append(opener);opener.focus();UI.open({...guide,category:'shoes',theme:'sport'},'حذاء');
   const dialog=d.body.lastElementChild.shadowRoot.querySelector('dialog');assert.equal(dialog.getAttribute('aria-labelledby'),'size-guide-title');assert.ok(dialog.hasAttribute('open'));
   const close=dialog.querySelector('.close');assert.equal(close.getAttribute('aria-label'),'إغلاق دليل المقاسات');close.click();
   assert.equal([...d.body.children].filter(n=>n.shadowRoot).length,0,'window removed after closing');assert.equal(d.activeElement,opener);}
  console.log('PASS: 6 categories x 12 themes x 4 table styles, starter templates, safe fallbacks, accent contrast, escaping, units, tabs and dialog.');
}finally{w.close();}
