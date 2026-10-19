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
    w.structuredClone=structuredClone;w.eval(file('size-guide-button.js'));w.merchant='123';
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
    assert.equal(w.document.querySelectorAll('[name="button-design"]').length,6);
    assert.equal(id('saveButtonSettings').disabled,true);
    for(const design of w.SizeGuideButton.designs){
      w.document.querySelector(`[name="button-design"][value="${design.id}"]`).click();
      assert.equal(id('buttonLivePreview').dataset.design,design.id);
      assert.equal(id('buttonLivePreview').classList.contains('floating-preview'),design.id==='floating');
    }
    input('globalButtonLabel','<img src=x onerror=alert(1)>');
    input('button-hex-text_color','#123456');input('button-hex-background_color','#fedcba');
    let button=id('buttonLivePreview').shadowRoot.querySelector('button');
    assert.equal(button.style.getPropertyValue('--sg-text'),'#123456');
    assert.equal(button.style.getPropertyValue('--sg-bg'),'#fedcba');
    assert.equal(button.querySelector('img'),null);assert.match(button.textContent,/<img/);
    button.click();assert.equal(opened[0].rows[0].values[0],'—');
    assert.equal(writes.length,0,'preview must never save');
    await id('saveButtonSettings').onclick();
    assert.equal(writes.length,1);assert.equal(writes[0].id,'123');assert.equal(writes[0].settings.design,'card');
    assert.equal(writes[0].settings.text_color,'#123456');assert.equal(w.SizeGuideSettings.isDirty(),false);
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
  w.AbortController=AbortController;w.eval(file('size-guide-button.js'));
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
      assert.equal(host().dataset.design,design);assert.equal(host().style.position==='fixed',design==='floating');
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
    for(const name of ['size-guide-button.js','button-settings-admin.js','size-guide-admin.js']){
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

(async()=>{await adminTests();await widgetTests();await dashboardIntegration();console.log('Button DOM checks passed: six designs, colors, persistence, conflicts, preview, legacy settings, storefront, navigation and unsaved-change protection.');})()
  .catch(error=>{console.error(error);process.exitCode=1;});
