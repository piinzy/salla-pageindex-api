// Quick product lookup: the standalone tab, the search box inside the editor, editing product data, linking and copying.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const file=name=>fs.readFileSync(path.join(__dirname,'static',name),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const settle=async()=>{for(let i=0;i<8;i++)await flush();};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const LIB='aaaaaaaaaaaa';
const guide={title:'دليل',button_label:'دليل',unit:'cm',measurement_type:'body',columns:[{label:'الصدر',kind:'measurement'}],rows:[{size:'M',values:['94']}],notes:'',instructions:'',color:'#123456'};

function makeApp(url){
  const errors=[],virtual=new VirtualConsole();virtual.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(file('dashboard.html'),{url,runScripts:'dangerously',virtualConsole:virtual}),w=dom.window;
  w.structuredClone=structuredClone;w.confirm=()=>state.confirmed;
  const state={confirmed:true,fail:null,calls:[],catalog:[
    {product_id:'42',title:'فستان كريب',sku:'DR-42',price:240,currency:'SAR',quantity:5,status:'sale',image:'https://cdn.example.com/a.jpg',url:'https://shop.example.com/p42',has_guide:false,library_id:null,library_name:null,is_published:false,has_changes:false},
    {product_id:'43',title:'حذاء رياضي',sku:'SH-43',price:310,currency:'SAR',quantity:0,status:'out',image:null,url:null,has_guide:true,library_id:null,library_name:null,is_published:true,has_changes:false},
    {product_id:'44',title:'طوق جلدي',sku:'PT-44',price:59.5,currency:'SAR',quantity:null,status:'hidden',image:null,url:null,has_guide:true,library_id:LIB,library_name:'فساتين',is_published:true,has_changes:false}]};
  w.fetch=async(url,options={})=>{
    const u=new URL(url,'https://app.test'),p=u.pathname.replace('/dashboard-api/',''),method=options.method||'GET',body=options.body?JSON.parse(options.body):null;
    state.calls.push({method,path:p,search:u.search,body});
    if(state.fail&&method==='PUT'){const detail=state.fail;state.fail=null;return {ok:false,status:403,json:async()=>({detail})}}
    let data=[];
    if(p==='stores')data=[{merchant_id:'123',store_name:'متجر',product_count:3,connected:true}];
    else if(p==='products'&&method==='GET')data={items:[],pages:1,total:0};
    else if(p==='product-lookup'){const q=(u.searchParams.get('q')||'').toLowerCase();data={items:state.catalog.filter(x=>!q||x.title.toLowerCase().includes(q)||x.sku.toLowerCase().includes(q))}}
    else if(/^products\/\d+$/.test(p)&&method==='PUT'){const item=state.catalog.find(x=>x.product_id===p.split('/')[1]);Object.assign(item,{...(body.name&&{title:body.name}),...(body.price&&{price:body.price}),...(body.quantity!==undefined&&{quantity:body.quantity})});data={product:{...item},changed:{}}}
    else if(p==='button-settings')data={settings:{design:'outline'},version:0};
    else if(p==='size-guides')data=state.catalog.filter(x=>x.has_guide).map(x=>({product_id:x.product_id,title:x.title,sku:x.sku,version:2,is_published:x.is_published,has_changes:false,library_id:x.library_id,library_name:x.library_name}));
    else if(p==='size-library'&&method==='GET')data=[{library_id:LIB,name:'فساتين',version:2,is_published:true,has_changes:false,category:'women',theme:'rose',product_count:1}];
    else if(p===`size-library/${LIB}`&&method==='GET')data={library_id:LIB,name:'فساتين',guide,version:2,is_published:true,products:[]};
    else if(p.startsWith('size-library/')&&p.endsWith('/link'))data={linked:body.product_ids,skipped:[]};
    else if(p==='size-guides/unlink')data={unlinked:body.product_ids,skipped:[]};
    else if(p==='size-guides/copy')data={copied:body.product_ids,skipped:[]};
    else if(p==='size-guides/bulk')data={updated:state.bulkSkip?[]:body.product_ids,skipped:state.bulkSkip?[{product_id:body.product_ids[0],reason:'أكمل جميع الخلايا قبل النشر.'}]:[]};
    else if(/^size-guides\/\d+$/.test(p)&&method==='PUT')data={version:body.version+1,is_published:body.action==='publish'};
    else if(/^size-guides\/\d+$/.test(p)){const item=state.catalog.find(x=>x.product_id===p.split('/')[1]);data={product:{product_id:item.product_id,title:item.title,sku:item.sku},guide:item.has_guide?guide:null,version:item.has_guide?2:0,is_published:item.is_published,library:item.library_id?{library_id:item.library_id,name:item.library_name}:null}}
    else if(p==='size-presets')data={styles:[],phrases:[]};
    return {ok:true,json:async()=>JSON.parse(JSON.stringify(data))};
  };
  for(const name of ['size-guide-renderer.js','size-guide-catalog.js','size-guide-import.js','size-guide-button.js','size-guide-placement.js','button-settings-admin.js','size-guide-admin.js','size-guide-quick.js']){
    const script=w.document.createElement('script');script.textContent=file(name);w.document.body.append(script);
  }
  return {dom,w,d:w.document,state,errors,call:(method,part)=>state.calls.filter(c=>c.method===method&&c.path.includes(part))};
}

(async()=>{
  const app=makeApp('https://app.test/dashboard'),{w,d,state,call}=app;
  const $=s=>d.querySelector(s),all=s=>[...d.querySelectorAll(s)],hidden=s=>$(s).classList.contains('hidden');
  const type=async(selector,value)=>{$(selector).value=value;$(selector).dispatchEvent(new w.Event('input',{bubbles:true}));await wait(330);await settle()};
  const cardOf=(root,title)=>all(root+' .qcard').find(c=>c.textContent.includes(title));
  const press=(card,text)=>[...card.querySelectorAll('button')].find(b=>b.textContent.trim()===text).click();
  try{
    await settle();assert.equal(app.errors.length,0,app.errors.map(e=>e.message).join('\n'));

    // ---- the standalone tab: compact cards for the first products, then a search by name or SKU
    $('[data-tab="quick"]').click();await settle();
    assert.equal(hidden('#quick'),false);assert.equal(all('#quickResults .qcard').length,3);assert.match($('#quickCount').textContent,/3|٣/);
    const dress=cardOf('#quickResults','فستان كريب');
    assert.match(dress.textContent,/DR-42/);assert.match(dress.textContent,/240|٢٤٠/);assert.match(dress.textContent,/معروض للبيع/);assert.match(dress.textContent,/بدون جدول/);
    assert.equal(dress.querySelector('a.qtitle').href,'https://shop.example.com/p42');assert.equal(dress.querySelector('a.qtitle').rel,'noopener noreferrer');assert.equal(dress.querySelector('img.qthumb').src,'https://cdn.example.com/a.jpg');
    assert.match(cardOf('#quickResults','حذاء رياضي').textContent,/نفدت الكمية.*منشور|منشور.*نفدت الكمية/s);assert.match(cardOf('#quickResults','طوق جلدي').textContent,/مرتبط · فساتين/);
    await type('#quickSearch','sh-4');assert.deepEqual(all('#quickResults .qtitle').map(x=>x.textContent),['حذاء رياضي'],'SKU search');
    await type('#quickSearch','كريب');assert.equal(all('#quickResults .qcard').length,1);
    await type('#quickSearch','لا شيء مطلقا');assert.equal(all('#quickResults .qcard').length,0);assert.match($('#quickResults').textContent,/لا توجد منتجات تطابق/);
    await type('#quickSearch','<img src=x onerror=alert(1)>');assert.equal($('#quickResults img[src="x"]'),null,'the search text is never rendered as markup');
    await type('#quickSearch','');assert.equal(all('#quickResults .qcard').length,3);

    // ---- edit the product's data in Salla
    let card=cardOf('#quickResults','فستان كريب');press(card,'تعديل البيانات');
    assert.equal(card.querySelector('.qpanel.hidden'),card.querySelectorAll('.qpanel')[1],'only the edit panel is open');
    const panel=card.querySelector('.qedit'),[name,price,qty]=panel.querySelectorAll('input');assert.deepEqual([name.value,price.value,qty.value],['فستان كريب','240','5']);
    panel.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();assert.match(card.querySelector('.qerror').textContent,/لا يوجد تغيير/);assert.equal(call('PUT','products/').length,0);
    name.value='';price.value='199';panel.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();assert.equal(call('PUT','products/').length,0,'an empty name is not sent');
    name.value='فستان كريب';price.value='199.5';state.confirmed=false;panel.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();assert.equal(call('PUT','products/').length,0,'declining the confirmation sends nothing');
    state.confirmed=true;state.fail='سلة رفضت التعديل: لا توجد صلاحية';panel.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();
    assert.equal(call('PUT','products/').length,1);assert.match(card.querySelector('.qerror').textContent,/لا توجد صلاحية/);assert.equal(state.catalog[0].price,240,'a refused edit changes nothing');
    panel.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();
    const put=call('PUT','products/42')[1];assert.deepEqual(put.body,{price:199.5},'only what changed is sent');
    assert.match(cardOf('#quickResults','فستان كريب').textContent,/199/);assert.equal(cardOf('#quickResults','فستان كريب').querySelector('.qpanel:not(.hidden)'),null,'the card is redrawn with the saved values');
    press(cardOf('#quickResults','فستان كريب'),'تعديل البيانات');
    const again=cardOf('#quickResults','فستان كريب').querySelector('.qedit');again.querySelectorAll('input')[0].value='فستان جديد';again.querySelectorAll('input')[2].value='9';again.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();
    assert.deepEqual(call('PUT','products/42')[2].body,{name:'فستان جديد',quantity:9});

    // ---- link to a shared guide, unlink, publish
    card=cardOf('#quickResults','فستان جديد');press(card,'ربط بجدول مشترك');const select=card.querySelector('.qpanel:not(.hidden) select');assert.ok([...select.options].some(o=>o.value===LIB));
    const linkButton=[...card.querySelectorAll('.qpanel:not(.hidden) button')].find(b=>b.textContent==='ربط');linkButton.click();await settle();assert.equal(call('POST','/link').length,0,'a table must be chosen');
    select.value=LIB;state.confirmed=false;linkButton.click();await settle();assert.equal(call('POST','/link').length,0);state.confirmed=true;linkButton.click();await settle();
    assert.deepEqual(call('POST','/link')[0].body.product_ids,['42']);assert.equal(call('POST','/link')[0].path,`size-library/${LIB}/link`);
    press(cardOf('#quickResults','طوق جلدي'),'فصل الارتباط');await settle();assert.deepEqual(call('POST','size-guides/unlink')[0].body.product_ids,['44']);
    assert.equal([...cardOf('#quickResults','طوق جلدي').querySelectorAll('button')].some(b=>b.textContent==='نشر'),false,'a linked product has no publish button of its own');
    press(cardOf('#quickResults','حذاء رياضي'),'إيقاف الظهور');await settle();const bulk=call('POST','size-guides/bulk')[0].body;assert.deepEqual([bulk.action,bulk.product_ids],['unpublish',['43']]);
    state.catalog[1].is_published=false;await w.SizeGuideQuick.run('quick');await settle();state.bulkSkip=true;press(cardOf('#quickResults','حذاء رياضي'),'نشر');await settle();assert.equal(call('POST','size-guides/bulk')[1].body.action,'publish');state.bulkSkip=false;
    assert.equal(all('#quickResults .qcard').length,3,'results are refreshed after every action');

    // ---- open a guide from a card, then use the search box inside the editor
    press(cardOf('#quickResults','فستان جديد'),'إضافة جدول');await settle();assert.equal(hidden('#editor'),false);assert.equal($('#editorFind').value,'');
    await type('#editorFind','حذاء');assert.equal(all('#editorFindResults .qcard').length,1);
    card=cardOf('#editorFindResults','حذاء رياضي');
    press(card,'نسخ جدولي الحالي إليه');await settle();assert.equal(call('POST','size-guides/copy').length,0,'an unsaved guide cannot be copied');
    $('#saveDraft').click();await settle();state.catalog[0].has_guide=true;
    card=cardOf('#editorFindResults','حذاء رياضي')||(await type('#editorFind','حذاء'),cardOf('#editorFindResults','حذاء رياضي'));
    $('#guideTitle').value='x';$('#guideTitle').dispatchEvent(new w.Event('input',{bubbles:true}));press(card,'نسخ جدولي الحالي إليه');await settle();assert.equal(call('POST','size-guides/copy').length,0,'unsaved edits block the copy');
    $('#saveDraft').click();await settle();card=cardOf('#editorFindResults','حذاء رياضي')||(await type('#editorFind','حذاء'),cardOf('#editorFindResults','حذاء رياضي'));
    state.confirmed=false;press(card,'نسخ جدولي الحالي إليه');await settle();assert.equal(call('POST','size-guides/copy').length,0,'replacing an existing guide asks first');
    state.confirmed=true;press(card,'نسخ جدولي الحالي إليه');await settle();
    const copy=call('POST','size-guides/copy')[0].body;assert.deepEqual([copy.source_product_id,copy.product_ids,copy.overwrite,copy.publish],['42',['43'],true,false]);
    await type('#editorFind','فستان جديد');assert.equal(cardOf('#editorFindResults','فستان جديد').textContent.includes('نسخ جدولي الحالي إليه'),false,'a product cannot be copied onto itself');
    // data editing works from the editor too and keeps the open guide's title in step
    press(cardOf('#editorFindResults','فستان جديد'),'تعديل البيانات');const editorForm=cardOf('#editorFindResults','فستان جديد').querySelector('.qedit');editorForm.querySelectorAll('input')[0].value='فستان الربيع';editorForm.dispatchEvent(new w.Event('submit',{cancelable:true}));await settle();
    assert.match($('#editorTitle').textContent,/فستان الربيع/);
    await type('#editorFind','');assert.equal(all('#editorFindResults .qcard').length,0,'an empty search clears the editor results');

    // ---- inside a shared guide the same card links products to it
    $('[data-tab="library"]').click();await settle();$('#libraryList .lib-card button').click();await settle();assert.equal($('#libraryName').value,'فساتين');
    await type('#editorFind','طوق');card=cardOf('#editorFindResults','طوق جلدي');assert.equal([...card.querySelectorAll('button')].some(b=>b.textContent==='نسخ جدولي الحالي إليه'),false);
    press(card,'ربط بهذا الجدول');await settle();const link=call('POST',`size-library/${LIB}/link`).pop();assert.deepEqual(link.body.product_ids,['44']);
    assert.ok(call('GET',`size-library/${LIB}`).length>=2,'the shared guide reloads its product list');

    assert.equal(app.errors.length,0,app.errors.map(e=>e.message).join('\n'));
  }finally{app.dom.window.close();}

  // ---- a dedicated Salla page can open straight on the quick tool
  const deep=makeApp('https://app.test/salla/embedded?view=quick');
  try{
    await settle();assert.equal(deep.d.querySelector('#quick').classList.contains('hidden'),false);assert.equal(deep.d.querySelector('#catalog').classList.contains('hidden'),true);
    assert.equal(deep.d.querySelectorAll('#quickResults .qcard').length,3);assert.equal(deep.errors.length,0);
  }finally{deep.dom.window.close();}
  const plain=makeApp('https://app.test/dashboard?view=unknown');
  try{await settle();assert.equal(plain.d.querySelector('#catalog').classList.contains('hidden'),false,'an unknown view is ignored');}finally{plain.dom.window.close();}
  console.log('PASS: quick lookup (tab and editor search), SKU/name search, product data edit with confirmation and errors, link/unlink/publish, copy rules, deep link.');
})().catch(error=>{console.error(error);process.exitCode=1;});
