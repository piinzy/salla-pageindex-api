// Guide editor, shared library, bulk actions, imports and statistics, driven through the real dashboard markup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const file=name=>fs.readFileSync(path.join(__dirname,'static',name),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){for(let i=0;i<8;i++)await flush();}
const LIB='aaaaaaaaaaaa',NEWLIB='bbbbbbbbbbbb';
const oldGuide={title:'دليل قديم',button_label:'دليل',unit:'cm',measurement_type:'body',columns:[{label:'الصدر',kind:'measurement'}],rows:[{size:'M',values:['94']}],notes:'',instructions:'',color:'#123456'};

(async()=>{
  const errors=[],console_=new VirtualConsole();console_.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(file('dashboard.html'),{url:'https://app.test/dashboard',runScripts:'dangerously',virtualConsole:console_}),w=dom.window,d=w.document;
  try{
    w.structuredClone=structuredClone;let confirmed=true;w.confirm=()=>confirmed;
    const calls=[];let aiAvailable=true;
    const call=(method,part)=>calls.filter(c=>c.method===method&&c.path.includes(part));
    const guideIndex=()=>[{product_id:'43',title:'منتج قديم',sku:'S2',version:3,is_published:true,has_changes:false,library_id:null},
      {product_id:'44',title:'منتج مرتبط',sku:'S3',version:1,is_published:true,has_changes:false,library_id:LIB,library_name:'فساتين'}];
    w.fetch=async(url,options={})=>{
      const u=new URL(url,'https://app.test'),p=u.pathname.replace('/dashboard-api/',''),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
      calls.push({method,path:p+u.search,body});let data=[];
      if(p==='stores')data=[{merchant_id:'123',store_name:'متجر',product_count:3,connected:true}];
      else if(p==='products')data={items:[{product_id:'42',title:'منتج جديد',sku:'S1',price:10,currency:'SAR',quantity:2,status:'sale'},{product_id:'43',title:'منتج قديم',sku:'S2',price:10,currency:'SAR',quantity:2,status:'sale'},{product_id:'44',title:'منتج مرتبط',sku:'S3',price:10,currency:'SAR',quantity:2,status:'sale'}],pages:1,total:3};
      else if(p==='button-settings')data={settings:{design:'outline'},version:0};
      else if(p==='size-guides')data=guideIndex();
      else if(p==='size-guides/42'&&method==='PUT')data={version:body.version+1,is_published:body.action==='publish'};
      else if(p==='size-guides/42')data={product:{product_id:'42',title:'منتج جديد',sku:'S1'},guide:null,version:0,is_published:false,library:null};
      else if(p==='size-guides/43')data={product:{product_id:'43',title:'منتج قديم',sku:'S2'},version:3,is_published:true,library:null,guide:oldGuide};
      else if(p==='size-guides/44')data={product:{product_id:'44',title:'منتج مرتبط',sku:'S3'},version:1,is_published:true,library:{library_id:LIB,name:'فساتين'},guide:{...oldGuide,title:'من المكتبة'}};
      else if(p==='size-guides/unlink')data={unlinked:body.product_ids,skipped:[]};
      else if(p==='size-guides/copy')data={copied:body.product_ids.filter(x=>x!==body.source_product_id),skipped:['43']};
      else if(p==='size-guides/bulk')data={updated:body.product_ids.slice(0,1),skipped:body.product_ids.slice(1).map(product_id=>({product_id,reason:'لا يوجد جدول'}))};
      else if(p==='size-library'&&method==='GET')data=[{library_id:LIB,name:'فساتين',version:2,is_published:true,has_changes:false,category:'women',theme:'rose',product_count:1}];
      else if(p==='size-library'&&method==='POST')data={library_id:NEWLIB,version:1,is_published:body.action==='publish'};
      else if(p===`size-library/${LIB}`&&method==='GET')data={library_id:LIB,name:'فساتين',guide:{...oldGuide,title:'جدول مشترك'},version:2,is_published:true,products:[{product_id:'44',title:'منتج مرتبط',sku:'S3'}]};
      else if(p===`size-library/${NEWLIB}`&&method==='GET')data={library_id:NEWLIB,name:'جديد',guide:oldGuide,version:1,is_published:false,products:[{product_id:'42',title:'منتج جديد',sku:'S1'}]};
      else if(p===`size-library/${NEWLIB}/link`)data={linked:body.product_ids,skipped:[]};
      else if(p.startsWith('size-library/')&&p.endsWith('/link'))data={linked:body.product_ids,skipped:['x']};
      else if(p===`size-library/${NEWLIB}`&&method==='PUT')data={library_id:NEWLIB,version:body.version+1,is_published:body.action==='publish'};
      else if(p===`size-library/${NEWLIB}`&&method==='DELETE')data={deleted:true};
      else if(p==='size-guide-ai-status')data={available:aiAvailable};
      else if(p==='size-guide-ai-import')data={columns:[{label:'الصدر',kind:'measurement'},{label:'EU',kind:'text'}],rows:[{size:'S',values:['86','36']},{size:'M',values:['','38']}],unit:'in',notes:'ملاحظة من الصورة',warnings:['خانة فارغة']};
      else if(p==='size-guide-stats')data={days:+u.searchParams.get('days'),opens:12,calcs:3,published_guides:2,daily:[{day:new Date().toISOString().slice(0,10),opens:12,calcs:3}],top:[{product_id:'43',title:'منتج قديم',opens:12,calcs:3}]};
      return {ok:true,json:async()=>data};
    };
    for(const name of ['size-guide-renderer.js','size-guide-catalog.js','size-guide-import.js','size-guide-button.js','size-guide-placement.js','button-settings-admin.js','size-guide-admin.js']){
      const script=d.createElement('script');script.textContent=file(name);d.body.append(script);
    }
    await settle();assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));
    const $=s=>d.querySelector(s),all=s=>[...d.querySelectorAll(s)],input=(s,v)=>{$(s).value=v;$(s).dispatchEvent(new w.Event('input',{bubbles:true}));};
    const change=(s,checked)=>{$(s).checked=checked;$(s).dispatchEvent(new w.Event('change',{bubbles:true}));};
    const guideWrap=()=>$('#guidePreview').shadowRoot.querySelector('.wrap');
    const hidden=s=>$(s).classList.contains('hidden');
    assert.equal(all('#categoryChoices [name="guide-category"]').length,7);

    // ---- a brand-new guide starts as a women's dress guide with its own theme and template list
    $('[data-edit="42"]').click();await settle();
    assert.equal(hidden('#editor'),false);assert.equal($('[name="guide-category"]:checked').value,'women');assert.equal($('[name="guide-theme"]:checked').value,'rose');
    assert.equal(all('#themeChoices [name="guide-theme"]').length,12);assert.equal($('#themeChoices .theme-card [name="guide-theme"]').value,'rose','recommended themes come first');
    assert.ok($('#themeChoices .theme-card small'),'recommended badge');
    assert.deepEqual(all('#template option').map(o=>o.value),['women-dresses','women-tops','women-pants','women-skirts','women-lingerie','women-abaya']);
    assert.equal(all('#gridEditor thead th input').length,4);assert.equal(guideWrap().dataset.theme,'rose');assert.ok($('#guidePreview').shadowRoot.querySelector('svg.emblem'));
    assert.equal($('#calculator').checked,true,'new guides get the size finder');assert.equal(hidden('.only-library'),true);assert.equal(hidden('.only-product'),false);

    // ---- category follows an untouched guide
    $('[name="guide-category"][value="shoes"]').click();await settle();
    assert.deepEqual(all('#gridEditor thead th input').map(i=>i.value),['UK','US','طول القدم','عرض القدم']);
    assert.equal($('[name="guide-theme"]:checked').value,'sport');assert.equal($('#guideColor').value,'#d9480f');assert.equal(all('#gridEditor tbody tr').length,6);
    $('[name="guide-category"][value="accessories"]').click();await settle();
    assert.deepEqual(all('#template option').map(o=>o.value),['acc-rings','acc-bracelets','acc-belts','acc-hats']);assert.equal($('[name="guide-theme"]:checked').value,'gold');

    // ---- theme, colour and style options reach the preview
    $('[name="guide-category"][value="shoes"]').click();await settle();
    $('[name="guide-theme"][value="leather"]').click();await settle();
    assert.equal(guideWrap().dataset.theme,'leather');assert.equal($('#guideColor').value,'#8a5a35');
    input('#guideColor','#336699');assert.equal(guideWrap().style.getPropertyValue('--accent'),'#336699');
    $('[name="guide-table_style"][value="cards"]').click();$('[name="guide-density"][value="compact"]').click();$('[name="guide-corners"][value="round"]').click();
    assert.deepEqual([guideWrap().dataset.table,guideWrap().dataset.density,guideWrap().dataset.corners],['cards','compact','round']);
    change('#depth3d',false);assert.equal(guideWrap().dataset.depth,'0');change('#headerIcon',false);assert.equal($('#guidePreview').shadowRoot.querySelector('svg.emblem'),null);

    // ---- advanced table options: size cell, header, borders, font, sticky column, language, finder
    for(const [name,value] of [['size_style','underline'],['header_style','solid'],['border_style','strong'],['font_scale','large'],['language','en']])$(`[name="guide-${name}"][value="${value}"]`).click();
    input('#sizeLabel','الحجم');change('#stickySize',false);
    const wrap=guideWrap();assert.deepEqual([wrap.dataset.sizestyle,wrap.dataset.head,wrap.dataset.border,wrap.dataset.font,wrap.dataset.sticky],['underline','solid','strong','large','0']);
    assert.equal(wrap.dir,'ltr');
    $('[name="guide-language"][value="ar"]').click();assert.equal(guideWrap().dir,'rtl');assert.equal($('#guidePreview').shadowRoot.querySelector('thead th').textContent,'الحجم');
    change('#calculator',false);assert.equal($('#guidePreview').shadowRoot.querySelectorAll('[role=tab]').length,2);change('#calculator',true);assert.equal($('#guidePreview').shadowRoot.querySelectorAll('[role=tab]').length,3);
    // colours: automatic until the merchant picks one, and every colour can be reset
    assert.equal(all('#tableColors .color-field').length,8);assert.equal($('#tc-status-header_bg').textContent,'تلقائي');assert.equal($('#tc-header_bg').closest('.color-field').querySelector('button').disabled,true);
    const auto=$('#tc-row_alt').value;assert.match(auto,/^#[0-9a-f]{6}$/);
    input('#tc-header_bg','#101010');input('#tc-size_bg','#ffeeaa');
    assert.equal($('#tc-status-header_bg').textContent,'مخصص');assert.equal(guideWrap().style.getPropertyValue('--head-bg'),'#101010');assert.equal(guideWrap().style.getPropertyValue('--head-ink'),'#ffffff');assert.equal(guideWrap().style.getPropertyValue('--chip-bg'),'#ffeeaa');
    $('#tc-header_bg').closest('.color-field').querySelector('button').click();assert.equal($('#tc-status-header_bg').textContent,'تلقائي');assert.notEqual(guideWrap().style.getPropertyValue('--head-bg'),'#101010');
    input('#tc-text_color','#202020');$('#resetTableColors').click();assert.ok(all('#tableColors .color-field').every(f=>!f.classList.contains('custom')),'reset restores every colour');
    input('#tc-border_color','#ff0000');
    // media and logo
    input('#howVideo','https://youtu.be/dQw4w9WgXcQ');input('#logoUrl','https://cdn.example.com/logo.png');input('#howImages','https://cdn.example.com/a.jpg\n\n  https://cdn.example.com/b.jpg  \n1\n2\n3\n4');
    assert.ok($('#guidePreview').shadowRoot.querySelector('iframe'));assert.ok($('#guidePreview').shadowRoot.querySelector('img.logo'));

    // ---- once numbers are entered, the category keeps them
    input('#gridEditor [data-row="0"][data-cell="2"]','24.5');input('#guideTitle','دليل الأحذية');
    $('[name="guide-category"][value="pets"]').click();await settle();
    assert.equal($('#gridEditor [data-row="0"][data-cell="2"]').value,'24.5','entered data is never discarded');assert.equal($('[name="guide-theme"]:checked').value,'paws');assert.ok(all('#template option').some(o=>o.value==='pets-dog'));
    $('#template').value='pets-dog';confirmed=false;$('#applyTemplate').click();await settle();assert.equal($('#gridEditor thead th input').value,'UK','declined replacement keeps the table');
    confirmed=true;$('#applyTemplate').click();await settle();
    assert.deepEqual(all('#gridEditor thead th input').map(i=>i.value),['محيط الرقبة','محيط الصدر','طول الظهر','الوزن (كجم)']);
    $('#suggestTips').click();await settle();assert.match($('#instructions').value,/الأرجل الأمامية/);

    // ---- import: pasted Excel text
    assert.equal(hidden('#importPreview'),true);
    input('#pasteTable','المقاس\tالصدر\tالخصر\tEU\nS\t90-94\t70\t36\nM\t96\t74\t38\nL\t\t78\t40');$('#applyPaste').click();
    assert.equal(hidden('#importPreview'),false);assert.equal(all('#importTable tbody tr').length,3);assert.ok(all('#importWarnings li').some(li=>/فارغة/.test(li.textContent)));
    input('#gridEditor [data-row="0"][data-cell="0"]','31');   // the table now holds numbers, so replacing it needs a yes
    confirmed=false;$('#importApply').click();await settle();assert.equal($('#gridEditor thead th input').value,'محيط الرقبة','declined import keeps the table');
    confirmed=true;$('#importApply').click();await settle();
    assert.deepEqual(all('#gridEditor thead th input').map(i=>i.value),['الصدر','الخصر','EU']);assert.equal(all('#gridEditor tbody tr').length,3);assert.equal(hidden('#importPreview'),true);
    input('#pasteTable','only one line');$('#applyPaste').click();assert.equal(hidden('#importPreview'),true,'an unusable paste shows a message and no preview');
    // import: photo read by Gemini (the server is stubbed; the canvas step is replaced)
    w.SizeGuideImport.imageToDataUrl=async()=> 'data:image/jpeg;base64,/9j/AAAA';
    $('#importPanel').open=true;$('#importPanel').dispatchEvent(new w.Event('toggle'));await settle();assert.equal($('#aiRun').disabled,false);
    $('#aiRun').click();await settle();assert.equal(calls.filter(c=>c.path.startsWith('size-guide-ai-import')).length,0,'nothing is sent without an image');
    const paste=new w.Event('paste',{bubbles:true,cancelable:true});paste.clipboardData={items:[{type:'text/plain'},{type:'image/png',getAsFile:()=>new w.File(['x'],'chart.png',{type:'image/png'})}]};$('#importPanel').dispatchEvent(paste);assert.equal(paste.defaultPrevented,true);
    $('#aiRun').click();await settle();
    const ai=calls.find(c=>c.path.startsWith('size-guide-ai-import'));assert.equal(ai.method,'POST');assert.match(ai.body.image,/^data:image\/jpeg;base64,/);assert.deepEqual(Object.keys(ai.body),['image']);
    assert.equal(hidden('#importPreview'),false);assert.ok(all('#importWarnings li').some(li=>/الذكاء الاصطناعي/.test(li.textContent)));
    $('#importApply').click();await settle();
    assert.equal($('#guideUnit').value,'in');assert.equal($('#notes').value,'ملاحظة من الصورة');assert.deepEqual(all('#gridEditor thead th input').map(i=>i.value),['الصدر','EU']);assert.equal($('#gridEditor [data-row="1"][data-cell="0"]').value,'');

    // ---- saving sends everything
    $('#saveDraft').click();await settle();
    const put=call('PUT','size-guides/42')[0].body;assert.equal(put.action,'draft');
    const g=put.guide;assert.deepEqual([g.category,g.theme,g.table_style,g.density,g.corners,g.depth3d,g.header_icon],['pets','paws','cards','compact','round',false,false]);
    assert.deepEqual([g.size_style,g.header_style,g.border_style,g.font_scale,g.sticky_size,g.size_label,g.language,g.calculator],['underline','solid','strong','large',false,'الحجم','ar',true]);
    assert.deepEqual([g.header_bg,g.row_alt,g.border_color,g.size_bg],['','','#ff0000',''],'colours reset to automatic are saved empty; the one picked afterwards is kept');
    assert.deepEqual([g.how_video,g.logo_url],['https://youtu.be/dQw4w9WgXcQ','https://cdn.example.com/logo.png']);assert.deepEqual(g.how_images,['https://cdn.example.com/a.jpg','https://cdn.example.com/b.jpg','1','2']);
    // missing server key: the AI button explains itself
    aiAvailable=false;

    // ---- a guide saved before these options existed opens with defaults
    $('#backCatalog').click();await settle();$('[data-edit="43"]').click();await settle();
    assert.equal($('[name="guide-category"]:checked').value,'general');assert.equal($('[name="guide-theme"]:checked').value,'classic');assert.equal($('#guideColor').value,'#123456');
    assert.equal($('#depth3d').checked,true);assert.equal($('[name="guide-size_style"]:checked').value,'chip');assert.equal($('#calculator').checked,false,'older guides keep the finder off');assert.equal(all('#template option').length,1);
    assert.equal($('#tc-status-header_bg').textContent,'تلقائي');
    w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};
    $('#previewModal').click();

    // ---- a product linked to a shared guide is read-only and offers a way out
    $('#backCatalog').click();await settle();$('[data-edit="44"]').click();await settle();
    assert.equal(hidden('#linkedBanner'),false);assert.equal($('#linkedName').textContent,'فساتين');assert.equal($('#editFields').disabled,true);assert.equal(guideWrap().querySelector('h2').textContent,'من المكتبة');
    const savesBefore=calls.filter(c=>c.method==='PUT').length;$('#saveDraft').click();$('#publish').click();await settle();assert.equal(calls.filter(c=>c.method==='PUT').length,savesBefore,'nothing is saved while linked');
    confirmed=false;$('#unlinkThis').click();await settle();assert.equal(call('POST','size-guides/unlink').length,0,'declined unlink does nothing');
    confirmed=true;$('#unlinkThis').click();await settle();assert.deepEqual(call('POST','size-guides/unlink')[0].body.product_ids,['44']);

    // ---- bulk actions in the catalog
    $('#backCatalog').click();await settle();
    assert.equal(hidden('#bulkBar'),true);assert.match($('[data-select="44"]').closest('tr').textContent,/مرتبط · فساتين/);
    $('[data-select="42"]').checked=true;$('[data-select="42"]').dispatchEvent(new w.Event('change'));$('[data-select="44"]').checked=true;$('[data-select="44"]').dispatchEvent(new w.Event('change'));
    assert.equal(hidden('#bulkBar'),false);assert.match($('#bulkCount').textContent,/2/);assert.equal($('#selectAll').indeterminate,true);
    assert.ok(all('#bulkSource option').some(o=>o.value==='43'),'products that have guides can be a source');assert.ok(all('#bulkLibrary option').some(o=>o.value===LIB));
    $('#bulkCopy').click();await settle();assert.equal(call('POST','size-guides/copy').length,0,'a source is required');
    $('#bulkSource').value='43';$('#bulkPublishCopy').checked=true;confirmed=false;$('#bulkCopy').click();await settle();assert.equal(call('POST','size-guides/copy').length,0,'declined copy does nothing');
    confirmed=true;$('#bulkCopy').click();await settle();
    let copy=call('POST','size-guides/copy')[0].body;assert.deepEqual([copy.source_product_id,copy.product_ids,copy.overwrite,copy.publish],['43',['42','44'],false,true]);
    assert.equal(hidden('#bulkBar'),true,'selection clears after an action');
    $('#selectAll').checked=true;$('#selectAll').dispatchEvent(new w.Event('change'));assert.equal(all('#rows [data-select]:checked').length,3);
    $('#bulkLibrary').value=LIB;$('#bulkLink').click();await settle();assert.deepEqual(call('POST','size-library/'+LIB+'/link')[0].body.product_ids,['42','43','44']);
    $('#selectAll').checked=true;$('#selectAll').dispatchEvent(new w.Event('change'));$('#bulkPublish').click();await settle();assert.equal(call('POST','size-guides/bulk')[0].body.action,'publish');
    $('#selectAll').checked=true;$('#selectAll').dispatchEvent(new w.Event('change'));$('#bulkUnpublish').click();await settle();assert.equal(call('POST','size-guides/bulk')[1].body.action,'unpublish');
    $('#selectAll').checked=true;$('#selectAll').dispatchEvent(new w.Event('change'));$('#bulkUnlink').click();await settle();assert.equal(call('POST','size-guides/unlink').length,2);
    $('#selectAll').checked=true;$('#selectAll').dispatchEvent(new w.Event('change'));$('#bulkClear').click();assert.equal(hidden('#bulkBar'),true);assert.equal(all('#rows [data-select]:checked').length,0);

    // ---- library: list, create, link, edit, delete
    $('[data-tab="library"]').click();await settle();
    assert.equal(hidden('#library'),false);assert.equal(all('#libraryList .lib-card').length,1);assert.match($('#libraryList .lib-card').textContent,/فساتين/);assert.ok($('#libraryList svg.emblem'));
    $('#newLibrary').click();await settle();
    assert.equal(hidden('#editor'),false);assert.equal(hidden('.only-library'),false);assert.equal(hidden('.only-product'),true);assert.equal($('#editorKind').textContent,'جدول مشترك');assert.equal($('#linkSearch').disabled,true,'save first, then link');
    assert.equal($('[data-tab="library"]').classList.contains('active'),true);
    const putsBefore=calls.filter(c=>c.method==='POST'&&c.path.startsWith('size-library?')).length;$('#saveDraft').click();await settle();assert.equal(calls.filter(c=>c.method==='POST'&&c.path.startsWith('size-library?')).length,putsBefore,'a name is required');
    input('#libraryName','فساتين نسائية');assert.equal($('#editorTitle').textContent,'فساتين نسائية');$('#saveDraft').click();await settle();
    const created=calls.filter(c=>c.method==='POST'&&c.path.startsWith('size-library?')).pop().body;assert.deepEqual([created.version,created.name,created.action],[0,'فساتين نسائية','draft']);assert.ok(created.guide.columns.length);
    assert.equal($('#linkSearch').disabled,false);assert.equal(hidden('#deleteLibrary'),false);
    $('#linkPicker').open=true;$('#linkPicker').dispatchEvent(new w.Event('toggle'));await settle();
    assert.ok(all('#linkResults input').some(i=>i.value==='43'),'linkable products are listed');
    $('#linkResults input[value="43"]').checked=true;$('#linkSelected').click();await settle();
    assert.deepEqual(call('POST','size-library/'+NEWLIB+'/link')[0].body.product_ids,['43']);assert.ok(all('#libraryProducts .link-row').length>=1);
    input('#guideTitle','عنوان مشترك جديد');confirmed=true;$('#publish').click();await settle();
    const published=calls.filter(c=>c.method==='PUT'&&c.path.startsWith('size-library/'+NEWLIB)).pop().body;assert.deepEqual([published.version,published.action],[1,'publish']);
    $('#libraryProducts .link-row button').click();await settle();assert.equal(call('POST','size-guides/unlink').length,3);
    $('#deleteLibrary').click();await settle();assert.equal(calls.filter(c=>c.method==='DELETE').length,1);assert.equal(hidden('#library'),false);
    $('#libraryList .lib-card button').click();await settle();
    assert.equal($('#libraryName').value,'فساتين');assert.equal(guideWrap().querySelector('h2').textContent,'جدول مشترك');assert.equal($('#unpublish').disabled,false);
    $('#backCatalog').click();await settle();assert.equal(hidden('#library'),false,'back from a shared guide returns to the library');

    // ---- statistics
    $('[data-tab="stats"]').click();await settle();
    assert.equal(hidden('#stats'),false);assert.equal(all('#statsCards .card').length,4);assert.match($('#statsCards').textContent,/12|١٢/);assert.equal(all('#statsChart .bar').length,30);
    assert.match($('#statsTop').textContent,/منتج قديم/);assert.equal(hidden('#statsEmpty'),true);
    $('#statsDays').value='7';$('#statsDays').dispatchEvent(new w.Event('change'));await settle();assert.equal(all('#statsChart .bar').length,7);
    assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));
  }finally{dom.window.close();}
  console.log('PASS: guide editor (categories, themes, size cell, colours, language, finder, media), imports, shared library, linked products, bulk actions and statistics.');
})().catch(error=>{console.error(error);process.exitCode=1;});
