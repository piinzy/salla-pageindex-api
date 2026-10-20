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
    const calls=[];let aiAvailable=true;const presets={styles:[{preset_id:'s00000000001',name:'تصميم قديم',style:{theme:'velvet',color:'#7b2338',table_style:'cards',density:'compact',corners:'round',depth3d:false,header_icon:true,size_style:'square',header_style:'solid',border_style:'none',font_scale:'small',sticky_size:true,header_bg:'',header_text:'',row_alt:'',border_color:'',text_color:'',paper_color:'',size_bg:'',size_text:''}}],phrases:[{preset_id:'f00000000001',name:'جملتي',text:'جملة محفوظة من التاجر'}],n:1};
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
      else if(p==='size-presets'&&method==='GET')data={styles:presets.styles,phrases:presets.phrases};
      else if(p==='size-presets'&&method==='POST'){const item={preset_id:'p'+(presets.n++).toString(16).padStart(11,'0'),name:body.name,...(body.kind==='style'?{style:body.style}:{text:body.text})};presets[body.kind==='style'?'styles':'phrases'].push(item);data=item}
      else if(p.startsWith('size-presets/')&&method==='DELETE'){const id=p.split('/')[1].split('?')[0];presets.styles=presets.styles.filter(x=>x.preset_id!==id);presets.phrases=presets.phrases.filter(x=>x.preset_id!==id);data={deleted:true}}
      else if(p==='size-guide-ai-status')data={available:aiAvailable};
      else if(p==='size-guide-ai-import')data={columns:[{label:'الصدر',kind:'measurement'},{label:'EU',kind:'text'}],rows:[{size:'S',values:['86','36']},{size:'M',values:['','38']}],unit:'in',notes:'ملاحظة من الصورة',warnings:['خانة فارغة'],title:'عنوان من الصورة',size_label:'المقاس',measurement_type:'garment',category:'pets',language:'ar',instructions:'تعليمات من الصورة'};
      else if(p==='size-guide-stats')data={days:+u.searchParams.get('days'),opens:12,calcs:3,published_guides:2,daily:[{day:new Date().toISOString().slice(0,10),opens:12,calcs:3}],top:[{product_id:'43',title:'منتج قديم',opens:12,calcs:3}]};
      return {ok:true,json:async()=>JSON.parse(JSON.stringify(data))};   // a real response is never the server's own object
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
    // everything else the photo said is offered, and what the guide already holds is not replaced by surprise
    assert.equal($('#importExtras').hidden,false);const extra=key=>$(`#importExtraList input[data-key="${key}"]`);
    assert.deepEqual(all('#importExtraList input').map(i=>i.dataset.key),['title','size_label','unit','measurement_type','category','language','instructions','notes']);
    assert.deepEqual(all('#importExtraList input').map(i=>i.checked),[false,false,true,true,true,true,false,true],'filled fields start unticked');
    assert.match(extra('title').closest('label').textContent,/عنوان من الصورة.*سيستبدل/s);assert.match(extra('unit').closest('label').textContent,/إنش/);assert.match(extra('measurement_type').closest('label').textContent,/قياسات القطعة/);
    extra('size_label').checked=false;
    $('#importApply').click();await settle();
    assert.equal($('#guideTitle').value,'دليل الأحذية','an unticked field is left alone');assert.equal($('#instructions').value.includes('تعليمات من الصورة'),false);assert.equal($('#sizeLabel').value,'الحجم');assert.equal($('#measureType').value,'garment');
    assert.equal($('#importExtras').hidden,true,'the panel closes after applying');
    assert.equal($('#guideUnit').value,'in');assert.equal($('#notes').value,'ملاحظة من الصورة');assert.deepEqual(all('#gridEditor thead th input').map(i=>i.value),['الصدر','EU']);assert.equal($('#gridEditor [data-row="1"][data-cell="0"]').value,'');

    // a second photo with every box ticked replaces the texts too
    $('#importPanel').dispatchEvent(paste);$('#aiRun').click();await settle();
    for(const box of all('#importExtraList input'))box.checked=true;$('#importApply').click();await settle();confirmed=true;
    assert.deepEqual([$('#guideTitle').value,$('#sizeLabel').value,$('#instructions').value],['عنوان من الصورة','المقاس','تعليمات من الصورة']);assert.equal(guideWrap().querySelector('h2').textContent,'عنوان من الصورة');
    input('#guideTitle','دليل الأحذية');input('#sizeLabel','الحجم');

    // ---- saving sends everything
    $('#saveDraft').click();await settle();
    const put=call('PUT','size-guides/42')[0].body;assert.equal(put.action,'draft');
    const g=put.guide;assert.deepEqual([g.category,g.theme,g.table_style,g.density,g.corners,g.depth3d,g.header_icon],['pets','paws','cards','compact','round',false,false]);
    assert.deepEqual([g.size_style,g.header_style,g.border_style,g.font_scale,g.sticky_size,g.size_label,g.language,g.calculator],['underline','solid','strong','large',false,'الحجم','ar',true]);
    assert.deepEqual([g.header_bg,g.row_alt,g.border_color,g.size_bg],['','','#ff0000',''],'colours reset to automatic are saved empty; the one picked afterwards is kept');
    assert.deepEqual([g.how_video,g.logo_url],['https://youtu.be/dQw4w9WgXcQ','https://cdn.example.com/logo.png']);assert.deepEqual(g.how_images,['https://cdn.example.com/a.jpg','https://cdn.example.com/b.jpg','1','2']);
    // missing server key: the AI button explains itself
    aiAvailable=false;

    // ---- ready-made looks change only the appearance, and can be undone
    const before={rows:JSON.stringify(guideCopy().rows),columns:JSON.stringify(guideCopy().columns),title:$('#guideTitle').value};
    function guideCopy(){return {rows:all('#gridEditor tbody tr').map(tr=>[...tr.querySelectorAll('input')].map(i=>i.value)),columns:all('#gridEditor thead th input').map(i=>i.value)}}
    assert.equal(all('#presetChoices .preset-card').length,6);assert.equal(all('#myPresets .preset-card').length,1);assert.ok($('#presetChoices .preset-mini'));
    assert.equal($('#undoStyle').classList.contains('hidden'),true);
    const oldStyle=[$('[name="guide-table_style"]:checked').value,$('[name="guide-size_style"]:checked').value,$('#guideColor').value];
    all('#presetChoices .preset-pick').find(b=>/جريء/.test(b.textContent)).click();
    assert.deepEqual([$('[name="guide-table_style"]:checked').value,$('[name="guide-size_style"]:checked').value,$('[name="guide-header_style"]:checked').value,$('[name="guide-corners"]:checked').value,$('[name="guide-font_scale"]:checked').value],['zebra','square','solid','sharp','large']);
    assert.equal($('[name="guide-theme"]:checked').value,'slate');assert.equal($('#guideColor').value,'#3d4a56');assert.equal(guideWrap().dataset.theme,'slate');assert.equal(guideWrap().dataset.corners,'sharp');
    assert.ok(all('#tableColors .color-field').every(f=>!f.classList.contains('custom')),'a look clears custom colours');
    assert.deepEqual([JSON.stringify(guideCopy().rows),JSON.stringify(guideCopy().columns),$('#guideTitle').value],[before.rows,before.columns,before.title],'the table itself is untouched');
    assert.equal($('#undoStyle').classList.contains('hidden'),false);$('#undoStyle').click();
    assert.deepEqual([$('[name="guide-table_style"]:checked').value,$('[name="guide-size_style"]:checked').value,$('#guideColor').value],oldStyle,'undo restores the previous look');assert.equal($('#undoStyle').classList.contains('hidden'),true);
    // a saved look applies like a built-in one
    all('#myPresets .preset-pick').find(b=>/تصميم قديم/.test(b.textContent)).click();assert.equal($('[name="guide-theme"]:checked').value,'velvet');assert.equal($('[name="guide-density"]:checked').value,'compact');$('#undoStyle').click();
    // the store's colour
    $('#brandColor').value='#ffe9a8';$('#applyBrand').click();
    assert.notEqual($('#guideColor').value,'#ffe9a8','a pale brand colour is darkened to stay readable');assert.match($('[name="guide-header_style"]:checked').value,/solid|tint/);
    $('#brandColor').value='#7b2338';$('#applyBrand').click();assert.equal($('#guideColor').value,'#7b2338');assert.equal($('[name="guide-header_style"]:checked').value,'solid');assert.equal(w.localStorage.getItem('sg-brand-123'),'#7b2338');
    $('#undoStyle').click();assert.notEqual($('#guideColor').value,'#7b2338');
    // saving the current look as a named design
    $('#savePreset').click();await settle();assert.equal(call('POST','size-presets').length,0,'a name is required');
    $('[name="guide-theme"][value="gold"]').click();$('[name="guide-table_style"][value="lines"]').click();input('#presetName','تصميم متجري');$('#savePreset').click();await settle();
    const savedLook=call('POST','size-presets')[0].body;assert.equal(savedLook.kind,'style');assert.equal(savedLook.name,'تصميم متجري');assert.equal(savedLook.style.theme,'gold');assert.equal(savedLook.style.table_style,'lines');
    assert.equal('title' in savedLook.style||'columns' in savedLook.style||'rows' in savedLook.style||'language' in savedLook.style,false,'only appearance is saved');
    assert.equal(all('#myPresets .preset-card').length,2);assert.equal($('#presetName').value,'');
    confirmed=false;$('#myPresets .preset-x').click();await settle();assert.equal(call('DELETE','size-presets/').length,0);confirmed=true;$('#myPresets .preset-x').click();await settle();assert.equal(call('DELETE','size-presets/').length,1);assert.equal(all('#myPresets .preset-card').length,1);

    // ---- quick phrases under the notes
    const phrases=all('#phraseChips .phrase-pick');assert.ok(phrases.length>=5);assert.ok(phrases.some(b=>b.title==='جملة محفوظة من التاجر'),'saved phrases are listed');
    const first=phrases[0].title;input('#notes','');phrases[0].click();assert.equal($('#notes').value,first);phrases[1].click();assert.equal($('#notes').value,first+'\n'+phrases[1].title);
    const lines=$('#notes').value;phrases[0].click();assert.equal($('#notes').value,lines,'a phrase is never added twice');
    input('#notes','x'.repeat(1995));phrases[0].click();assert.equal($('#notes').value.length,1995,'the 2000-character limit is respected');input('#notes','');
    input('#phraseText','   ');$('#savePhrase').click();await settle();assert.equal(call('POST','size-presets').length,1,'an empty phrase is not saved');
    input('#phraseText','شحن مجاني للمقاسات الكبيرة');$('#savePhrase').click();await settle();assert.equal(call('POST','size-presets')[1].body.kind,'phrase');assert.equal(call('POST','size-presets')[1].body.text,'شحن مجاني للمقاسات الكبيرة');
    assert.ok(all('#phraseChips .phrase-pick').some(b=>b.title==='شحن مجاني للمقاسات الكبيرة'));
    $('#phraseChips .preset-x').click();await settle();assert.equal(call('DELETE','size-presets/').length,2);
    assert.equal(all('#phraseChips .phrase-pick').some(b=>b.title==='جملة محفوظة من التاجر'),false);

    // ---- completing a column and pasting blocks of cells
    $('[name="guide-category"][value="women"]').click();await settle();$('#template').value='women-dresses';confirmed=true;$('#applyTemplate').click();await settle();
    const cell=(r,c)=>$(`#gridEditor [data-row="${r}"][data-cell="${c}"]`);
    $('[data-fill="0"]').click();assert.equal(cell(2,0).value,'','nothing happens without two numbers');
    input('#gridEditor [data-row="0"][data-cell="0"]','86-90');input('#gridEditor [data-row="1"][data-cell="0"]','90-94');$('[data-fill="0"]').click();
    assert.deepEqual([2,3,4].map(r=>cell(r,0).value),['94-98','98-102','102-106']);assert.equal(guideWrap().querySelectorAll('tbody tr').length,5);
    input('#gridEditor [data-row="0"][data-cell="1"]','70');input('#gridEditor [data-row="1"][data-cell="1"]','74');input('#gridEditor [data-row="3"][data-cell="1"]','99');$('[data-fill="1"]').click();
    assert.deepEqual([2,3,4].map(r=>cell(r,1).value),['78','99','86'],'only empty cells are filled');
    const pasteInto=(selector,text)=>{const event=new w.Event('paste',{bubbles:true,cancelable:true});event.clipboardData={getData:()=>text};$(selector).dispatchEvent(event);return event};
    let ev=pasteInto('#gridEditor [data-row="0"][data-cell="2"]','95\t100\n98\t104\n');
    assert.equal(ev.defaultPrevented,true);assert.deepEqual([cell(0,2).value,cell(0,3).value,cell(1,2).value,cell(1,3).value],['95','100','98','104']);
    ev=pasteInto('#gridEditor [data-size="3"]','XL\t1\t2\t3\t4\t5\t6\nXXL\t7\t8\t9\t10\nXXXL\t11');
    assert.equal($('#gridEditor [data-size="3"]').value,'XL');assert.equal($('#gridEditor [data-size="4"]').value,'XXL');assert.equal(all('#gridEditor tbody tr').length,6,'rows are added for the pasted block');assert.equal($('#gridEditor [data-size="5"]').value,'XXXL');
    assert.equal(cell(3,0).value,'1');assert.equal(cell(3,3).value,'4');assert.equal(cell(5,0).value,'11');
    ev=pasteInto('#gridEditor [data-row="0"][data-cell="0"]','777');assert.equal(ev.defaultPrevented,false,'a single value pastes normally');assert.equal(cell(0,0).value,'86-90');
    ev=pasteInto('#gridEditor [data-row="0"][data-cell="0"]','a\nb\nc'.repeat(1)+'\n'+Array.from({length:40},(_,i)=>'r'+i).join('\n'));assert.equal(all('#gridEditor tbody tr').length,30,'the 30-row limit is respected');
    ev=pasteInto('#guideTitle','a\tb\nc\td');assert.equal(ev.defaultPrevented,false,'only the table grid takes blocks');

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
    $('#deleteLibrary').click();await settle();assert.equal(call('DELETE','size-library/').length,1);assert.equal(hidden('#library'),false);
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
