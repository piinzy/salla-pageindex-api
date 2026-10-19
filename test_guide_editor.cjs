// Guide editor: category, template, theme and style options, driven through the real dashboard markup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const file=name=>fs.readFileSync(path.join(__dirname,'static',name),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function settle(){for(let i=0;i<6;i++)await flush();}

(async()=>{
  const errors=[],console_=new VirtualConsole();console_.on('jsdomError',e=>errors.push(e));
  const dom=new JSDOM(file('dashboard.html'),{url:'https://app.test/dashboard',runScripts:'dangerously',virtualConsole:console_}),w=dom.window,d=w.document;
  try{
    w.structuredClone=structuredClone;let confirmed=true;w.confirm=()=>confirmed;
    const puts=[];let stored=null;
    w.fetch=async(url,options={})=>{
      const u=new URL(url,'https://app.test'),p=u.pathname;let data=[];
      if(p.endsWith('/stores'))data=[{merchant_id:'123',store_name:'متجر',product_count:2,connected:true}];
      else if(p.endsWith('/products'))data={items:[{product_id:'42',title:'منتج',sku:'S1',price:10,currency:'SAR',quantity:2,status:'sale'},{product_id:'43',title:'منتج قديم',sku:'S2',price:10,currency:'SAR',quantity:2,status:'sale'}],pages:1,total:2};
      else if(p.endsWith('/button-settings'))data={settings:{design:'outline'},version:0};
      else if(p.endsWith('/size-guides/42')&&options.method==='PUT'){const body=JSON.parse(options.body);puts.push(body);stored=body.guide;data={version:body.version+1,is_published:body.action==='publish'};}
      else if(p.endsWith('/size-guides/42'))data={product:{product_id:'42',title:'منتج',sku:'S1'},guide:null,version:0,is_published:false};
      else if(p.endsWith('/size-guides/43'))data={product:{product_id:'43',title:'منتج قديم',sku:'S2'},version:3,is_published:true,
        guide:{title:'دليل قديم',button_label:'دليل',unit:'cm',measurement_type:'body',columns:[{label:'الصدر',kind:'measurement'}],rows:[{size:'M',values:['94']}],notes:'',instructions:'',color:'#123456'}};
      return {ok:true,json:async()=>data};
    };
    for(const name of ['size-guide-renderer.js','size-guide-catalog.js','size-guide-button.js','size-guide-placement.js','button-settings-admin.js','size-guide-admin.js']){
      const script=d.createElement('script');script.textContent=file(name);d.body.append(script);
    }
    await settle();assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));
    const $=s=>d.querySelector(s),all=s=>[...d.querySelectorAll(s)],input=(s,v)=>{$(s).value=v;$(s).dispatchEvent(new w.Event('input',{bubbles:true}));};
    const guideWrap=()=>$('#guidePreview').shadowRoot.querySelector('.wrap');
    assert.equal(all('#categoryChoices [name="guide-category"]').length,6);

    // a brand-new guide starts as a women's dress guide with its own theme and template list
    $('[data-edit="42"]').click();await settle();
    assert.equal($('#editor').classList.contains('hidden'),false);
    assert.equal($('[name="guide-category"]:checked').value,'women');assert.equal($('[name="guide-theme"]:checked').value,'rose');
    assert.equal(all('#themeChoices [name="guide-theme"]').length,12);
    assert.equal($('#themeChoices .theme-card [name="guide-theme"]').value,'rose','recommended themes come first');
    assert.ok($('#themeChoices .theme-card small'),'recommended badge');
    assert.deepEqual(all('#template option').map(o=>o.value),['women-dresses','women-tops','women-pants','women-skirts','women-abaya']);
    assert.equal(all('#gridEditor thead th input').length,4);assert.equal(guideWrap().dataset.theme,'rose');
    assert.ok($('#guidePreview').shadowRoot.querySelector('svg.emblem'));

    // an untouched guide follows the category: shoes bring their structure, theme and colour
    $('[name="guide-category"][value="shoes"]').click();await settle();
    assert.deepEqual(all('#gridEditor thead th input').map(i=>i.value),['UK','US','طول القدم','عرض القدم']);
    assert.equal($('[name="guide-theme"]:checked').value,'sport');assert.equal($('#guideColor').value,'#d9480f');
    assert.ok(all('#template option').some(o=>o.value==='shoes-sneakers'));
    assert.equal(all('#gridEditor tbody tr').length,6);

    // theme, colour and style options reach the preview
    $('[name="guide-theme"][value="leather"]').click();await settle();
    assert.equal(guideWrap().dataset.theme,'leather');assert.equal($('#guideColor').value,'#8a5a35');
    input('#guideColor','#336699');assert.equal(guideWrap().style.getPropertyValue('--accent'),'#336699');
    $('[name="guide-table_style"][value="cards"]').click();$('[name="guide-density"][value="compact"]').click();$('[name="guide-corners"][value="round"]').click();
    assert.equal(guideWrap().dataset.table,'cards');assert.equal(guideWrap().dataset.density,'compact');assert.equal(guideWrap().dataset.corners,'round');
    $('#depth3d').checked=false;$('#depth3d').dispatchEvent(new w.Event('change'));assert.equal(guideWrap().dataset.depth,'0');
    $('#headerIcon').checked=false;$('#headerIcon').dispatchEvent(new w.Event('change'));assert.equal($('#guidePreview').shadowRoot.querySelector('svg.emblem'),null);
    assert.equal($('[name="guide-table_style"]:checked').closest('label').classList.contains('selected'),true);

    // once numbers are entered, changing the category keeps them
    input('#gridEditor [data-row="0"][data-cell="2"]','24.5');input('#guideTitle','دليل الأحذية');
    $('[name="guide-category"][value="pets"]').click();await settle();
    assert.equal($('#gridEditor [data-row="0"][data-cell="2"]').value,'24.5','entered data is never discarded');
    assert.equal($('[name="guide-theme"]:checked').value,'paws','a theme that does not suit the new category is swapped');
    assert.ok(all('#template option').some(o=>o.value==='pets-dog'));

    // starter template + suggested instructions are explicit actions
    $('#template').value='pets-dog';confirmed=false;$('#applyTemplate').click();await settle();
    assert.equal(all('#gridEditor thead th input').length,4,'declined replacement keeps the table');
    assert.equal($('#gridEditor thead th input').value,'UK');
    confirmed=true;$('#applyTemplate').click();await settle();
    assert.deepEqual(all('#gridEditor thead th input').map(i=>i.value),['محيط الرقبة','محيط الصدر','طول الظهر','الوزن (كجم)']);
    assert.equal($('#instructions').value,'');$('#suggestTips').click();await settle();assert.match($('#instructions').value,/الأرجل الأمامية/);

    // saving sends the new fields in the draft
    $('#saveDraft').click();await settle();
    assert.equal(puts.length,1);const saved=puts[0].guide;
    assert.deepEqual([saved.category,saved.theme,saved.table_style,saved.density,saved.corners,saved.depth3d,saved.header_icon],['pets','paws','cards','compact','round',false,false]);
    assert.equal(puts[0].action,'draft');assert.equal(saved.title,'دليل الأحذية');assert.equal(saved.columns.length,4);

    // a guide saved before these options existed opens with defaults and is not altered by opening it
    $('#backCatalog').click();await settle();$('[data-edit="43"]').click();await settle();
    assert.equal($('[name="guide-category"]:checked').value,'general');assert.equal($('[name="guide-theme"]:checked').value,'classic');
    assert.equal($('#guideColor').value,'#123456');assert.equal($('#depth3d').checked,true);assert.equal(guideWrap().dataset.table,'zebra');
    assert.equal(all('#template option').length,1,'general category has its own starter');
    $('#previewModal').click();
  }finally{dom.window.close();}
  console.log('PASS: guide editor categories, templates, themes, style options, data safety, suggested tips and draft payload.');
})().catch(error=>{console.error(error);process.exitCode=1;});
