// DOM integration tests; no merchant session, live requests or browser required.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const file=name=>fs.readFileSync(path.join(__dirname,'static',name),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const tick=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const guide={title:'دليل',button_label:'مقاسات المنتج',unit:'cm',columns:[{label:'الصدر',kind:'measurement'}],rows:[{size:'S',values:['90']}]};

async function adminTests(){
  const dom=new JSDOM(file('dashboard.html'),{url:'https://test/dashboard',runScripts:'outside-only'}),w=dom.window;
  try{
    w.structuredClone=structuredClone;w.eval(file('size-guide-button.js'));w.eval(file('size-guide-placement.js'));w.merchant='123';
    let opened=null,fail=false,confirmed=false;const writes=[],stores=new Map();
    w.SizeGuideUI={open:(...args)=>{opened=args;}};w.toast=()=>{};w.confirmAction=async()=>confirmed;
    w.api=async(route,options={})=>{
      const id=new URL('https://test/'+route).searchParams.get('merchant');
      if(options.method==='PUT'){
        if(fail)throw Error('تغيرت النسخة؛ أعد التحميل');
        const body=JSON.parse(options.body);writes.push({id,...body});
        stores.set(id,{settings:body.settings,version:body.version+1});
      }
      return structuredClone(stores.get(id)||{settings:w.SizeGuideButton.defaults(),version:0});
    };
    w.eval(file('button-settings-admin.js'));await w.SizeGuideSettings.load();
    const id=x=>w.document.getElementById(x),input=(x,value)=>{id(x).value=value;id(x).dispatchEvent(new w.Event('input',{bubbles:true}));};
    assert.equal(w.document.querySelectorAll('[name="button-design"]').length,16);
    assert.equal(id('saveButtonSettings').disabled,true);
    assert.equal(w.document.querySelectorAll('[name="button-placement"]').length,15);
    assert.equal(w.document.querySelectorAll('[data-palette]').length,10);
    id('previewMobile').click();assert.equal(w.SizeGuideSettings.isDirty(),false);id('previewDesktop').click();
    for(const design of w.SizeGuideButton.designs){
      w.document.querySelector(`[name="button-design"][value="${design.id}"]`).click();
      assert.equal(id('buttonLivePreview').dataset.design,design.id);
      assert.equal(id('buttonLivePreview').dataset.placement,'above_price');
    }
    w.document.querySelector('[name="button-design"][value="card"]').click();
    w.document.querySelector('[name="button-placement"][value="image_top_right"]').click();
    assert.equal(id('buttonLivePreview').parentNode,id('previewImage'));
    id('buttonMobilePlacement').value='below_price';id('buttonMobilePlacement').dispatchEvent(new w.Event('change'));
    id('previewMobile').click();assert.equal(id('buttonLivePreview').previousElementSibling,id('previewPrice'));
    id('previewDesktop').click();assert.equal(id('buttonLivePreview').parentNode,id('previewImage'));
    input('globalButtonLabel','<img src=x onerror=alert(1)>');
    input('button-hex-text_color','#123456');input('button-hex-background_color','#fedcba');
    let button=id('buttonLivePreview').shadowRoot.querySelector('button');
    assert.equal(button.style.getPropertyValue('--sg-text'),'#123456');
    assert.equal(button.style.getPropertyValue('--sg-bg'),'#fedcba');
    assert.equal(button.querySelector('img'),null);assert.match(button.textContent,/<img/);
    button.click();assert.equal(opened[0].rows[0].values[0],'—');
    assert.equal(writes.length,0,'preview must never save');
    // size, depth, shape and icon controls drive the rendered button
    w.document.querySelector('[name="button-depth"][value="deep"]').click();
    w.document.querySelector('[name="button-icon"][value="shoe"]').click();
    w.document.querySelector('[name="button-width"][value="full"]').click();
    input('buttonScale','120');input('buttonRadius','20');
    button=id('buttonLivePreview').shadowRoot.querySelector('button');
    assert.equal(button.dataset.depth,'deep');assert.equal(button.dataset.width,'full');
    assert.equal(button.style.getPropertyValue('--sg-scale'),'1.2');assert.equal(button.style.getPropertyValue('--sg-radius'),'20px');
    assert.ok(button.querySelector('.icon svg path'),'icon is drawn');
    assert.equal(id('buttonScaleOut').textContent,'120%');
    // a second button is edited independently, shows in the preview and can be device-specific
    w.document.querySelector('.strip-add').click();
    assert.equal(id('buttonLivePreview-2')!==null,true);
    w.document.querySelector('[name="button-design"][value="glass"]').click();
    w.document.querySelector('[name="button-devices"][value="mobile"]').click();
    assert.equal(id('buttonLivePreview').dataset.design,'card','main button untouched');
    assert.equal(id('buttonLivePreview-2').dataset.design,'glass');
    assert.equal(id('buttonLivePreview-2').style.display,'none','mobile-only button hidden in desktop preview');
    id('previewMobile').click();assert.notEqual(id('buttonLivePreview-2').style.display,'none');id('previewDesktop').click();
    assert.equal(w.document.querySelectorAll('.strip-chip').length,2);
    for(let i=0;i<3;i++)w.document.querySelector('.strip-add').click();
    assert.equal(w.document.querySelectorAll('.strip-chip').length,4,'main button plus three extras at most');
    assert.equal(w.document.querySelector('.strip-add').disabled,true);
    confirmed=true;w.document.querySelectorAll('.strip-x')[2].click();await flush();await flush();confirmed=false;
    assert.equal(w.document.querySelectorAll('.strip-chip').length,3);
    w.document.querySelectorAll('.strip-x')[1].click();await flush();await flush();
    assert.equal(w.document.querySelectorAll('.strip-chip').length,3,'declined delete keeps the button');
    confirmed=true;w.document.querySelectorAll('.strip-x')[1].click();await flush();await flush();confirmed=false;
    assert.equal(w.document.querySelectorAll('.strip-chip').length,2);
    w.document.querySelector('.strip-chip button').click();
    await id('saveButtonSettings').onclick();
    assert.equal(writes.length,1);assert.equal(writes[0].id,'123');assert.equal(writes[0].settings.design,'card');
    assert.equal(writes[0].settings.placement,'image_top_right');assert.equal(writes[0].settings.depth,'deep');assert.equal(writes[0].settings.extra_buttons.length,1);assert.equal(writes[0].settings.extra_buttons[0].devices,'mobile');assert.equal(writes[0].settings.mobile_placement,'below_price');assert.equal(writes[0].settings.text_color,'#123456');assert.equal(w.SizeGuideSettings.isDirty(),false);
    w.document.querySelector('[data-pane="colors"]').click();assert.equal(w.document.querySelector('.studio-pane[data-pane="colors"]').hidden,false);assert.equal(w.document.querySelector('.studio-pane[data-pane="design"]').hidden,true);
    input('button-hex-text_color','invalid');assert.equal(id('saveButtonSettings').disabled,true);
    assert.equal(w.SizeGuideSettings.isDirty(),true);
    id('resetButtonPalette').click();assert.equal(id('button-hex-text_color').checkValidity(),true);
    fail=true;await id('saveButtonSettings').onclick();assert.equal(w.SizeGuideSettings.isDirty(),true);
    assert.match(id('buttonSettingsState').textContent,/تغيرت/);
    await id('reloadButtonSettings').onclick();assert.equal(w.SizeGuideSettings.isDirty(),true,'cancel reload retains edits');
    confirmed=true;fail=false;await id('reloadButtonSettings').onclick();
    assert.equal(id('button-hex-text_color').value,'#123456');assert.equal(w.SizeGuideSettings.isDirty(),false);
    w.merchant='999';await w.SizeGuideSettings.load();assert.equal(id('buttonLivePreview').dataset.design,'outline');
    assert.equal(id('globalButtonLabel').value,'');
    w.merchant='123';await w.SizeGuideSettings.load();assert.equal(id('buttonLivePreview').dataset.design,'card');
    assert.equal(id('button-hex-text_color').value,'#123456');
  }finally{dom.window.close();}
}

async function widgetSetup(settings,options={}){
  const dom=new JSDOM('<body><salla-product-options product-id="42"></salla-product-options></body>',{
    url:'https://store.test/p42',runScripts:'outside-only'}),w=dom.window;
  w.AbortController=AbortController;w.eval(file('size-guide-button.js'));w.eval(file('size-guide-placement.js'));
  let response={guide,product_name:'منتج',...(settings?{button_settings:settings}:{})};const opened=[],calls=[];
  w.SizeGuideUI={open:(...args)=>opened.push(args)};
  w.fetch=async(url,opts)=>{calls.push({url,opts});if(options.wait)await options.wait;
    return {ok:response!==null,status:response===null?404:200,json:async()=>structuredClone(response)};};
  Object.defineProperty(w.document,'currentScript',{value:{src:'https://app.test/size-guide-widget.js',dataset:{merchant:'123',base:'https://app.test'}}});
  Object.defineProperty(w.document,'readyState',{value:'complete'});
  w.eval(file('size-guide-widget.js'));await flush();await flush();
  return {dom,w,opened,calls,setResponse:value=>{response=value;},host:()=>w.document.getElementById('product-size-guide')};
}

async function widgetTests(){
  for(const design of ['link','outline','pill','band','floating','card']){
    const fixture=await widgetSetup({design,background_color:'#112233',text_color:'#ffffff'});
    try{
      const {w,host,opened,calls}=fixture;
      assert.equal(host().dataset.design,design==='floating'?'pill':design);assert.equal(host().style.position==='fixed',design==='floating');
      assert.equal(host().shadowRoot.querySelector('button').style.getPropertyValue('--sg-bg'),'#112233');
      assert.equal(calls[0].opts.credentials,'omit');assert.equal(calls[0].opts.cache,'no-store');
      fixture.setResponse({guide,product_name:'منتج',button_settings:{design:'card',text_color:'#123456'}});
      host().shadowRoot.querySelector('button').click();await flush();await flush();
      assert.equal(opened.length,1);assert.equal(host().dataset.design,'card');
      assert.equal(host().shadowRoot.querySelector('button').style.getPropertyValue('--sg-text'),'#123456');
      w.eval(file('size-guide-widget.js'));await flush();assert.equal(w.document.querySelectorAll('#product-size-guide').length,1);
      fixture.setResponse(null);host().shadowRoot.querySelector('button').click();await flush();await flush();
      assert.equal(host(),null);assert.equal(opened.length,1,'unpublished guide must not open');
    }finally{fixture.dom.window.close();}
  }
  const multi=await widgetSetup({design:'pill',extra_buttons:[{design:'icon',placement:'image_top_left',label:'قياسات'},{design:'chip',devices:'mobile'}]});try{
    const hosts=multi.w.document.querySelectorAll('#product-size-guide,[data-size-guide-extra]');
    assert.equal(hosts.length,3,'main button plus two extras');assert.equal(multi.w.document.querySelectorAll('#product-size-guide').length,1);
    assert.equal(hosts[1].dataset.design,'icon');assert.equal(hosts[2].dataset.design,'chip');
    assert.equal(hosts[2].style.display,'none','mobile-only extra is hidden on desktop');
    hosts[1].shadowRoot.querySelector('button').click();await flush();await flush();
    assert.equal(multi.opened.length,1,'any button opens the guide once');
    assert.equal(multi.w.document.querySelectorAll('#product-size-guide,[data-size-guide-extra]').length,3,'buttons are rebuilt without duplicates');
    multi.setResponse(null);multi.w.document.querySelector('#product-size-guide').shadowRoot.querySelector('button').click();await flush();await flush();
    assert.equal(multi.w.document.querySelectorAll('#product-size-guide,[data-size-guide-extra]').length,0,'unpublished guide removes every button');
  }finally{multi.dom.window.close();}
  const legacy=await widgetSetup();try{
    assert.equal(legacy.host().dataset.design,'outline');
    assert.equal(legacy.host().shadowRoot.querySelector('.label').textContent,'مقاسات المنتج');
  }finally{legacy.dom.window.close();}
  let release;const wait=new Promise(resolve=>{release=resolve;});
  const pending=await widgetSetup({design:'pill'},{wait});try{
    pending.w.history.replaceState(null,'','/p43');pending.w.dispatchEvent(new pending.w.PopStateEvent('popstate'));
    release();await tick(350);await flush();
    assert.ok(pending.calls.some(c=>c.url.endsWith('/123/43')),'navigation during request must fetch new product');
    assert.equal(pending.opened.length,0);
  }finally{pending.dom.window.close();}
}

async function dashboardIntegration(){
  const errors=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error));
  const dom=new JSDOM(file('dashboard.html'),{url:'https://app.test/dashboard',runScripts:'dangerously',virtualConsole:console}),w=dom.window;
  try{
    w.structuredClone=structuredClone;w.SizeGuideUI={preview(){},open(){}};let confirmed=false;
    w.confirm=()=>confirmed;
    w.fetch=async url=>{
      const pathname=new URL(url,'https://app.test').pathname;
      const data=pathname.endsWith('/stores')?[{merchant_id:'123',store_name:'متجر',product_count:0,connected:true}]
        :pathname.endsWith('/products')?{items:[],pages:1,total:0}
        :pathname.endsWith('/button-settings')?{settings:{design:'outline'},version:0}:[];
      return {ok:true,json:async()=>data};
    };
    for(const name of ['size-guide-button.js','size-guide-placement.js','button-settings-admin.js','size-guide-admin.js']){
      const script=w.document.createElement('script');script.textContent=file(name);w.document.body.append(script);
    }
    await flush();await flush();await flush();
    assert.equal(errors.length,0,errors.map(e=>e.message).join('\n'));
    const tab=name=>w.document.querySelector(`[data-tab="${name}"]`);
    tab('buttonSettings').click();await flush();
    assert.equal(w.document.getElementById('buttonSettings').classList.contains('hidden'),false);
    w.document.querySelector('[name="button-design"][value="pill"]').click();
    const unload=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(unload);assert.equal(unload.defaultPrevented,true);
    tab('catalog').click();await flush();
    assert.equal(w.document.getElementById('buttonSettings').classList.contains('hidden'),false,'cancel navigation must preserve edits');
    confirmed=true;tab('catalog').click();await flush();
    assert.equal(w.document.getElementById('catalog').classList.contains('hidden'),false);
    assert.equal(w.SizeGuideSettings.isDirty(),false);
  }finally{dom.window.close();}
}

(async()=>{await adminTests();await widgetTests();await dashboardIntegration();console.log('Button DOM checks passed: sixteen designs, extra buttons, depth/size controls, colors, persistence, conflicts, preview, legacy settings, storefront, navigation and unsaved-change protection.');})()
  .catch(error=>{console.error(error);process.exitCode=1;});
