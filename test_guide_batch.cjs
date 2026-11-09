const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');

(async () => {
  const source = name => fs.readFileSync(path.join(__dirname, 'static', name), 'utf8');
  const dom = new JSDOM(source('dashboard.html'), {url:'https://example.test',runScripts:'outside-only'});
  const w = dom.window, d = w.document;
  const $ = id => d.getElementById(id);
  const products = [{product_id:'a',sku:'001-7',title:'فستان'},{product_id:'b',sku:'001-8',title:'تنورة'}];
  const writes = [], reads = [], versions = {a:3,b:0};
  const requests = new Map();
  try {
    w.merchant='tenant';w.qs=()=>'?merchant=tenant';w.url=()=>'';w.confirmAction=async()=>true;
    w.URL.createObjectURL=file=>'blob:'+file.name;w.URL.revokeObjectURL=()=>{};
    w.eval(source('size-guide-import.js'));w.eval(source('size-guide-catalog.js'));w.fresh=w.SizeGuideCatalog.fresh;
    w.SizeGuideImport.imageToDataUrl=async f=>f.name;
    w.api=async (route,options={})=>{
      const u=new URL(route,'https://example.test/'),sku=u.searchParams.get('q');
      assert.equal(u.searchParams.get('merchant'),'tenant');
      if(u.pathname==='/product-lookup')return {items:products.filter(p=>u.searchParams.get('exact')==='true'?p.sku===sku:p.sku.includes(sku))};
      if(u.pathname==='/size-guide-ai-import'){const name=JSON.parse(options.body).image;reads.push(name);return requests.get(name);}
      if(u.pathname==='/size-guides')return [];
      const id=u.pathname.split('/').pop();
      if(options.method!=='PUT')return {guide:id==='a'?{...w.fresh(),color:'#654321'}:null,version:versions[id],library:null};
      const body=JSON.parse(options.body);
      if(body.version!==versions[id])throw Error('تغيّر إصدار الجدول');
      writes.push({id,...body});versions[id]++;return {version:versions[id]};
    };
    w.eval(source('size-guide-batch.js'));
    const scan=(sku,size,cols,vals)=>({product_sku:sku,columns:cols.map(label=>({label,kind:'measurement'})),rows:[{size,values:vals}],unit:'cm',measurement_type:'garment'});
    function upload(files){
      Object.defineProperty($('batchFiles'),'files',{configurable:true,value:files.map(name=>({name,type:'image/png',size:123,lastModified:1}))});
      $('batchFiles').dispatchEvent(new w.Event('change'));
    }
    async function click(id){
      const target=typeof id==='string'?$(id):id;target.click();
      for(let i=0;w.SizeGuideBatch.busy()&&i<60;i++)await new Promise(r=>setTimeout(r,0));
      assert.equal(w.SizeGuideBatch.busy(),false);
    }
    requests.set('001-7-S.png',scan('001-7','S',['صدر','خصر'],['88','70']));
    requests.set('001-7-M.png',scan('001-7','M',['خصر','صدر'],['74','92']));
    requests.set('photo.png',scan('001-8','L',['طول'],['85']));
    upload([...requests.keys()]);await click('batchRead');await click('batchReview');
    let checks=[...$('batchGroups').querySelectorAll('input')];
    assert.equal(checks.length,2);assert.equal(writes.length,0);
    checks.forEach(c=>c.click());versions.b++;
    await click('batchDraft');
    assert.equal(writes.length,1);assert.equal(writes[0].action,'draft');assert.equal(writes[0].guide.color,'#654321');
    assert.deepEqual(writes[0].guide.rows.map(r=>r.values),[['88','70'],['92','74']]);
    assert.match($('batchGroups').textContent,/تغيّر إصدار/);
    await click('batchReview');$('batchGroups').querySelector('input').click();await click('batchPublish');
    assert.deepEqual(writes.map(x=>x.id),['a','b']);assert.equal(writes[1].version,1);
    w.SizeGuideBatch.reset();
    requests.set('001-7.png',scan('001-8','S',['صدر'],['88']));
    upload(['001-7.png']);await click('batchRead');await click('batchReview');
    assert.equal($('batchReviewBox').hidden,true);assert.match($('batchItems').textContent,/يختلف عن كود/);
    const manual=$('batchItems').querySelector('input[type=search]');manual.value='001-8';
    await click(manual.parentElement.querySelector('button'));manual.parentElement.querySelector(':scope > div > button').click();
    await click('batchReview');assert.equal($('batchGroups').querySelectorAll('input').length,1);
    w.SizeGuideBatch.reset();
    requests.set('001-7-S.png',scan('001-7','L',['صدر'],['90']));
    upload(['001-7-S.png']);await click('batchRead');await click('batchReview');assert.equal($('batchGroups').querySelectorAll('input').length,0);
    assert.match($('batchGroups').textContent,/المقاس في اسم/);
    w.SizeGuideBatch.reset();
    requests.set('001-7.png',scan('001-7','S',['صدر'],['90']));
    requests.set('photo.png',scan('001-7','S',['صدر'],['90']));
    upload(['001-7.png','photo.png']);await click('batchRead');await click('batchReview');
    assert.match($('batchGroups').textContent,/مكرر/);assert.equal($('batchPublish').disabled,true);
    assert.ok(reads.length>=6);
    console.log('PASS: batch upload, exact SKU, OCR mismatch, manual selection, size conflict, aligned columns, selective approval and version-safe retry.');
  }finally{dom.window.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
