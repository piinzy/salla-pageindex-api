(() => {
  'use strict';
  const byId=id=>document.getElementById(id),UI=window.SizeGuideButton;
  const fields=[['background_color','الخلفية'],['text_color','النص الرئيسي'],['border_color','الإطار'],
    ['icon_color','الأيقونة والسهم'],['secondary_text_color','النص المساعد']];
  let settings=UI.defaults(),saved=structuredClone(settings),version=0,store='',loaded=false,busy=false,requestId=0;
  const sample={title:'دليل المقاسات',button_label:'دليل المقاسات',unit:'cm',measurement_type:'garment',
    columns:[{label:'الصدر',kind:'measurement'},{label:'الخصر',kind:'measurement'},{label:'الطول',kind:'measurement'}],
    rows:['S','M','L','XL'].map(size=>({size,values:['—','—','—']})),color:'#177e65',
    notes:'هذه معاينة للشكل فقط. القياسات الفعلية تُدخل في جدول كل منتج.',instructions:''};
  const isDirty=()=>loaded&&(JSON.stringify(settings)!==JSON.stringify(saved)||!validColors());
  const validColors=()=>fields.every(([key])=>byId('button-hex-'+key).checkValidity());
  function status(message){byId('buttonSettingsState').textContent=message;}
  function controls() {
    byId('buttonSettingsFields').disabled=!loaded||busy;
    byId('saveButtonSettings').disabled=!loaded||busy||!isDirty()||!validColors();
    byId('reloadButtonSettings').disabled=busy;
  }
  function preview() {
    const host=byId('buttonLivePreview');
    host.classList.toggle('floating-preview',settings.design==='floating');
    UI.render(host,settings,sample,()=>window.SizeGuideUI.open(sample,'معاينة التصميم'));
    byId('buttonPlacementHint').textContent=settings.design==='floating'
      ?'موضع ثابت أسفل يسار صفحة المنتج.'
      :'بجانب خيارات المنتج عند توفر الموضع؛ يظهر عائمًا إذا لم يوفر القالب موضعًا مناسبًا.';
    byId('buttonLinkHint').hidden=settings.design!=='link';
    byId('buttonSubtitleGroup').hidden=!['band','card'].includes(settings.design);
    for(const [key] of fields){
      const inactive=(settings.design==='link'&&['background_color','border_color'].includes(key))
        ||(key==='secondary_text_color'&&!['band','card'].includes(settings.design));
      byId('button-color-'+key).disabled=inactive;
      byId('button-hex-'+key).disabled=inactive;
    }
    document.querySelectorAll('[name="button-design"]').forEach(radio=>{
      radio.checked=radio.value===settings.design;
      radio.closest('.button-design-option').classList.toggle('selected',radio.checked);
    });
    controls();
  }
  function changed(){status('تعديلات غير محفوظة');preview();}
  function populate(){
    byId('globalButtonLabel').value=settings.label;byId('globalButtonSubtitle').value=settings.subtitle;
    for(const [key] of fields){byId('button-color-'+key).value=settings[key];byId('button-hex-'+key).value=settings[key];}
    preview();
  }
  function discard(){settings=structuredClone(saved);populate();status(loaded?'الإعدادات المحفوظة':'اختر متجرًا أولًا.');}
  async function load(force=false){
    const target=merchant;if(!target)return;
    if(store===target&&loaded&&!force)return;
    const id=++requestId;store=target;loaded=false;busy=true;controls();status('جارٍ تحميل إعدادات الزر…');
    try {
      const data=await api('button-settings?'+new URLSearchParams({merchant:target}));
      if(id!==requestId||merchant!==target)return;
      settings=UI.normalize(data.settings);saved=structuredClone(settings);version=data.version;loaded=true;
      populate();status(version?'الإعدادات المحفوظة للمتجر':'التصميم الافتراضي؛ اختر ما يناسب متجرك ثم احفظ.');
    } catch(error){if(id===requestId){status('تعذر تحميل الإعدادات. اضغط «إعادة التحميل» للمحاولة.');toast(error.message);}}
    finally{if(id===requestId){busy=false;controls();}}
  }
  async function save(){
    if(!loaded||busy||!isDirty()||!validColors()||store!==merchant)return;
    busy=true;controls();status('جارٍ حفظ التصميم والألوان…');
    const target=merchant;
    try{
      const data=await api('button-settings?'+new URLSearchParams({merchant:target}),{
        method:'PUT',body:JSON.stringify({version,settings})});
      settings=UI.normalize(data.settings);saved=structuredClone(settings);version=data.version;populate();
      status('تم الحفظ. حدّث صفحة المنتج في المتجر لرؤية التصميم.');toast('تم حفظ إعدادات الزر لجميع منتجات هذا المتجر.');
    }catch(error){status(error.message);toast(error.message);}
    finally{busy=false;controls();}
  }
  for(const design of UI.designs){
    const label=document.createElement('label');label.className='button-design-option';
    const head=document.createElement('span');head.className='button-design-head';
    const radio=document.createElement('input');radio.type='radio';radio.name='button-design';radio.value=design.id;
    const name=document.createElement('span');name.textContent=design.name;head.append(radio,name);
    const example=document.createElement('div');example.className='button-design-sample';example.inert=true;example.setAttribute('aria-hidden','true');
    UI.render(example,UI.defaults(design.id),sample);
    const hint=document.createElement('small');hint.textContent=design.hint;label.append(head,example,hint);
    byId('buttonDesignChoices').append(label);
    radio.onchange=()=>{if(!radio.checked)return;settings.design=design.id;
      const palette=UI.defaults(design.id);for(const [key] of fields)settings[key]=palette[key];populate();changed();};
  }
  for(const [key,title] of fields){
    const field=document.createElement('div');field.className='button-color-field';
    const label=document.createElement('label');label.htmlFor='button-color-'+key;label.textContent=title;
    const pair=document.createElement('div');pair.className='button-color-pair';
    const color=document.createElement('input');color.type='color';color.id='button-color-'+key;
    const hex=document.createElement('input');hex.type='text';hex.id='button-hex-'+key;hex.dir='ltr';hex.maxLength=7;
    hex.pattern='#[0-9a-fA-F]{6}';hex.required=true;hex.setAttribute('aria-label','رمز لون '+title+' HEX');
    color.oninput=()=>{settings[key]=color.value;hex.value=color.value;changed();};
    hex.oninput=()=>{if(hex.checkValidity()){settings[key]=hex.value;color.value=hex.value;changed();}
      else{status('اكتب اللون بصيغة HEX مثل #263a30.');controls();}};
    pair.append(color,hex);field.append(label,pair);byId('buttonColorFields').append(field);
  }
  byId('globalButtonLabel').oninput=()=>{settings.label=byId('globalButtonLabel').value;changed();};
  byId('globalButtonSubtitle').oninput=()=>{settings.subtitle=byId('globalButtonSubtitle').value;changed();};
  byId('resetButtonPalette').onclick=()=>{const palette=UI.defaults(settings.design);
    for(const [key] of fields)settings[key]=palette[key];populate();changed();};
  byId('saveButtonSettings').onclick=save;
  byId('reloadButtonSettings').onclick=async()=>{
    if(busy)return;if(isDirty()&&!(await confirmAction('تجاهل تعديلات الزر وإعادة تحميل النسخة المحفوظة؟')))return;
    await load(true);
  };
  populate();status('اختر متجرًا لتحميل إعدادات الزر.');
  window.SizeGuideSettings={load,isDirty,isBusy:()=>busy,discard};
})();
