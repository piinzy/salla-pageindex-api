// Dashboard shell: navigation, the home screen, the tidier catalog, and the product finder inside the guide editor.
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
    else if(p==='products'&&method==='GET')data={items:state.catalog.map(x=>({product_id:x.product_id,title:x.title,sku:x.sku,price:x.price,currency:x.currency,quantity:x.quantity,status:x.status,image:x.image,url:x.url})),pages:1,total:state.catalog.length};
    else if(p==='product-lookup'){const q=(u.searchParams.get('q')||'').toLowerCase();data={items:state.catalog.filter(x=>!q||x.title.toLowerCase().includes(q)||x.sku.toLowerCase().includes(q))}}
    else if(p==='size-rules')data={rules:[],categories:[],missing:1,latest:[]};
    else if(p==='size-guide-stats')data={days:30,opens:120,calcs:14,published_guides:2,daily:[],top:[]};
    else if(p==='size-insights')data={days:90,since:null,sold:0,returned:0,rate:0,alerts:[{kind:'size',product_id:'42',title:'x',size:'M',sold:9,returned:5,rate:.5,message:'m'}],products:[]};
    else if(p==='billing')data={enforced:true,plan:'trial',trial_days_left:2,price:389,paid_until:null,ai:{limit:3,used:0,plan_remaining:3,extra:0,remaining:3}};
    else if(p==='size-guide-snippet')data={javascript:'(() => {})();',generic:u.searchParams.get('generic')==='true'};
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

    // ---- five sections only; the product-data tool, the sync log tab and the install tab are gone
    assert.deepEqual(all('aside nav [data-tab]').map(b=>b.dataset.tab),['home','catalog','library','buttonSettings','stats'],'tab order');
    assert.ok(all('aside nav [data-tab] svg.nav-ico').length===5,'icons are vector, not emoji');
    for(const gone of ['#quick','#install','#activity','#quickSearch','#quickResults'])assert.equal($(gone),null,gone+' was removed');
    assert.equal(hidden('#home'),false);assert.equal(hidden('#catalog'),true);assert.equal($('aside nav [data-tab="home"]').classList.contains('active'),true);

    // ---- home: numbers, a short checklist and what needs attention
    assert.equal($('#count').textContent.replace(/\D/g,'').length>0,true);assert.match($('#kpiPublished').textContent,/2|٢/);assert.match($('#kpiOpens').textContent,/120|١٢٠/);assert.match($('#kpiPlan').textContent,/تجربة/);assert.match($('#kpiPlanNote').textContent,/2|٢/);
    assert.equal(all('#checklist li').length,3);assert.equal(all('#checklist li.done').length,2,'products synced and a guide published');
    const attention=$('#attention').textContent;assert.match(attention,/بلا جدول/);assert.match(attention,/تنبيه/);assert.match(attention,/تنتهي تجربتك/);
    assert.equal(call('GET','size-guide-stats').length>=1,true);
    all('#attention button').find(b=>b.textContent==='اعرضها').click();await settle();
    assert.equal(hidden('#catalog'),false);assert.equal($('#guideFilter').value,'none');assert.match(call('GET','products').pop().search,/guide=none/);
    $('#guideFilter').value='';$('#guideFilter').dispatchEvent(new w.Event('change'));await settle();
    $('[data-tab="home"]').click();await settle();assert.equal(hidden('#home'),false);assert.equal(hidden('#catalog'),true);
    $('#homeSync').click();await settle();assert.equal(call('POST','sync').length,1,'the home button runs the same sync');

    // ---- the catalog: product, status, guide, one action
    $('[data-tab="catalog"]').click();await settle();
    assert.equal(all('#catalog > .tablewrap thead th').length,5);assert.equal(all('#rows tr').length,3);
    for(const row of all('#rows tr')){const labels=[...row.querySelectorAll('.row-actions button')].map(b=>b.textContent);assert.equal(labels.length,1);assert.notEqual(labels[0],'تعديل البيانات')}
    assert.equal($('[data-edit="42"]').textContent,'إضافة مقاسات');assert.equal($('[data-edit="43"]').textContent,'تعديل الجدول');assert.match($('#rows tr').textContent,/DR-42/);
    assert.equal($('#rows [data-edit-data]'),null);assert.equal($('#catalog #activityBox').tagName,'DETAILS');assert.match($('#activityBox summary').textContent,/سجل المزامنة/);
    $('[data-tab="buttonSettings"]').click();await settle();
    assert.equal($('#buttonSettings #installBox').tagName,'DETAILS');$('#getSnippet').click();await settle();assert.equal(call('GET','size-guide-snippet').pop().search.includes('generic=true'),true,'one code for every store');assert.ok($('#snippet').value.length>0);

    // ---- the finder inside the editor: link, unlink, publish, copy
    $('[data-tab="catalog"]').click();await settle();$('[data-edit="42"]').click();await settle();assert.equal(hidden('#editor'),false);assert.equal($('#editorFind').value,'');
    await type('#editorFind','sh-4');assert.deepEqual(all('#editorFindResults .qtitle').map(x=>x.textContent),['حذاء رياضي'],'SKU search');
    await type('#editorFind','لا شيء مطلقا');assert.equal(all('#editorFindResults .qcard').length,0);assert.match($('#editorFindResults').textContent,/لا توجد منتجات تطابق/);
    await type('#editorFind','<img src=x onerror=alert(1)>');assert.equal($('#editorFindResults img[src="x"]'),null,'the search text is never rendered as markup');
    await type('#editorFind','حذاء');let card=cardOf('#editorFindResults','حذاء رياضي');
    assert.match(card.textContent,/SH-43/);assert.match(card.textContent,/نفدت الكمية/);assert.doesNotMatch(card.textContent,/310|السعر|الكمية:/,'no price or stock here any more');assert.equal([...card.querySelectorAll('button')].some(b=>b.textContent==='تعديل البيانات'),false);
    press(card,'إيقاف الظهور');await settle();const bulk=call('POST','size-guides/bulk')[0].body;assert.deepEqual([bulk.action,bulk.product_ids],['unpublish',['43']]);
    await type('#editorFind','طوق');card=cardOf('#editorFindResults','طوق جلدي');assert.match(card.textContent,/مرتبط · فساتين/);press(card,'فصل الارتباط');await settle();assert.deepEqual(call('POST','size-guides/unlink')[0].body.product_ids,['44']);
    await type('#editorFind','حذاء');card=cardOf('#editorFindResults','حذاء رياضي');
    press(card,'نسخ جدولي الحالي إليه');await settle();assert.equal(call('POST','size-guides/copy').length,0,'an unsaved guide cannot be copied');
    $('#saveDraft').click();await settle();state.catalog[0].has_guide=true;
    card=cardOf('#editorFindResults','حذاء رياضي')||(await type('#editorFind','حذاء'),cardOf('#editorFindResults','حذاء رياضي'));
    state.confirmed=false;press(card,'نسخ جدولي الحالي إليه');await settle();assert.equal(call('POST','size-guides/copy').length,0,'replacing an existing guide asks first');
    state.confirmed=true;press(card,'نسخ جدولي الحالي إليه');await settle();
    const copy=call('POST','size-guides/copy')[0].body;assert.deepEqual([copy.source_product_id,copy.product_ids,copy.overwrite,copy.publish],['42',['43'],true,false]);
    await type('#editorFind','كريب');assert.equal(cardOf('#editorFindResults','فستان كريب').textContent.includes('نسخ جدولي الحالي إليه'),false,'a product cannot be copied onto itself');
    await type('#editorFind','');assert.equal(all('#editorFindResults .qcard').length,0,'an empty search clears the results');

    // ---- inside a shared guide the same card links products to it
    $('[data-tab="library"]').click();await settle();$('#libraryList .lib-card button').click();await settle();assert.equal($('#libraryName').value,'فساتين');
    await type('#editorFind','طوق');card=cardOf('#editorFindResults','طوق جلدي');assert.equal([...card.querySelectorAll('button')].some(b=>b.textContent==='نسخ جدولي الحالي إليه'),false);
    press(card,'ربط بهذا الجدول');await settle();const link=call('POST',`size-library/${LIB}/link`).pop();assert.deepEqual(link.body.product_ids,['44']);
    assert.ok(call('GET',`size-library/${LIB}`).length>=2,'the shared guide reloads its product list');

    assert.equal(app.errors.length,0,app.errors.map(e=>e.message).join('\n'));
  }finally{app.dom.window.close();}

  // ---- a dedicated Salla page can open straight on one section; the retired quick link lands on the products
  for(const [view,shown] of [['stats','stats'],['library','library'],['home','home'],['buttonSettings','buttonSettings'],['quick','catalog'],['unknown','home']]){
    const deep=makeApp('https://app.test/salla/embedded?view='+view);
    try{await settle();assert.equal(deep.d.querySelector('#'+shown).classList.contains('hidden'),false,view+' opens '+shown);
      for(const other of ['home','catalog','library','stats','buttonSettings'])if(other!==shown)assert.equal(deep.d.querySelector('#'+other).classList.contains('hidden'),true,other+' is hidden for '+view);
      assert.equal(deep.errors.length,0,deep.errors.map(e=>e.message).join('\n'));}finally{deep.dom.window.close();}
  }
  console.log('PASS: dashboard shell (five sections, home, tidier catalog, developer folds) and the editor finder: SKU/name search, link/unlink/publish, copy rules, deep links.');
})().catch(error=>{console.error(error);process.exitCode=1;});
