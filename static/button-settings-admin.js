(() => {
  'use strict';
  const byId=id=>document.getElementById(id),UI=window.SizeGuideButton;
  const fields=[['background_color','الخلفية'],['text_color','النص الرئيسي'],['border_color','الإطار'],['icon_color','الأيقونة والسهم'],['secondary_text_color','النص المساعد']];
  let settings=UI.defaults(),saved=structuredClone(settings),version=0,store='',loaded=false,busy=false,requestId=0,device='desktop';
  const sample={title:'دليل المقاسات',button_label:'دليل المقاسات',unit:'cm',measurement_type:'garment',
    columns:[{label:'الصدر',kind:'measurement'},{label:'الخصر',kind:'measurement'},{label:'الطول',kind:'measurement'}],
    rows:['S','M','L','XL'].map(size=>({size,values:['—','—','—']})),color:'#177e65',
    notes:'هذه معاينة للشكل فقط. القياسات الفعلية تُدخل في جدول كل منتج.',instructions:''};
  const engine=window.SizeGuidePlacement.create({surface:byId('buttonPreviewSurface'),viewport:()=>device==='mobile',anchors:()=>({
    root:byId('buttonPreviewSurface'),title:byId('previewTitle'),price:byId('previewPrice'),gallery:byId('previewImage'),
    options:byId('previewOptions'),size:byId('previewSizeLabel'),cart:byId('previewCart')})});
  const valid=()=>fields.every(([key])=>byId('button-hex-'+key).checkValidity())&&['buttonEdgeOffset','buttonBottomOffset'].every(id=>byId(id).checkValidity());
  const isDirty=()=>loaded&&(JSON.stringify(settings)!==JSON.stringify(saved)||!valid());
  function status(message){byId('buttonSettingsState').textContent=message;}
  function controls(){byId('buttonSettingsFields').disabled=!loaded||busy;byId('saveButtonSettings').disabled=!loaded||busy||!isDirty()||!valid();byId('reloadButtonSettings').disabled=busy;}
  function luminance(hex){const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
  function contrast(){
    const a=luminance(settings.design==='icon'?settings.icon_color:settings.text_color),b=luminance(settings.background_color);
    const low=(Math.max(a,b)+.05)/(Math.min(a,b)+.05)<4.5&&!['link','row'].includes(settings.design);
    byId('buttonContrastHint').hidden=!low;byId('buttonContrastHint').textContent='تباين اللونين منخفض. اختر لون نص أو خلفية أوضح لسهولة القراءة.';
  }
  function preview(){
    const host=byId('buttonLivePreview');UI.render(host,settings,sample,()=>window.SizeGuideUI.open(sample,'معاينة التصميم'));
    byId('buttonPreviewSurface').dataset.device=device;
    const result=engine.apply(host,{id:'preview'},settings);
    const name=UI.placements.find(p=>p.id===result.placement)?.name||'';
    byId('buttonPlacementHint').textContent=(device==='mobile'?'الجوال: ':'الكمبيوتر: ')+name+(result.requested==='mobile_bar'&&device!=='mobile'?' — الشريط الثابت يظهر على الجوال فقط.':'');
    byId('previewDesktop').setAttribute('aria-pressed',String(device==='desktop'));byId('previewMobile').setAttribute('aria-pressed',String(device==='mobile'));
    byId('buttonLinkHint').hidden=!['link','row'].includes(settings.design);byId('buttonSubtitleGroup').hidden=!UI.hasSubtitle(settings.design);
    for(const [key] of fields){const inactive=(['link','row'].includes(settings.design)&&key==='background_color')||(settings.design==='link'&&key==='border_color')||(key==='secondary_text_color'&&!UI.hasSubtitle(settings.design));byId('button-color-'+key).disabled=inactive;byId('button-hex-'+key).disabled=inactive;}
    for(const [name,value] of [['button-design',settings.design],['button-placement',settings.placement]])document.querySelectorAll(`[name="${name}"]`).forEach(radio=>{radio.checked=radio.value===value;radio.closest('label').classList.toggle('selected',radio.checked);});
    document.querySelectorAll('[data-palette]').forEach(button=>{const palette=UI.paletteColors(button.dataset.palette,settings.design);const selected=UI.colors.every(key=>palette[key].toLowerCase()===settings[key].toLowerCase());button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
    contrast();controls();
  }
  function changed(){status('تعديلات غير محفوظة');preview();}
  function populate(){
    byId('globalButtonLabel').value=settings.label;byId('globalButtonSubtitle').value=settings.subtitle;
    for(const [key] of fields){byId('button-color-'+key).value=settings[key];byId('button-hex-'+key).value=settings[key];}
    for(const [id,key] of [['buttonMobilePlacement','mobile_placement'],['buttonSize','size'],['buttonAlignment','alignment'],['buttonEdgeOffset','edge_offset'],['buttonBottomOffset','bottom_offset']])byId(id).value=settings[key];
    preview();
  }
  function discard(){settings=structuredClone(saved);populate();status(loaded?'الإعدادات المحفوظة':'اختر متجرًا أولًا.');}
  async function load(force=false){
    const target=merchant;if(!target)return;if(store===target&&loaded&&!force)return;
    const id=++requestId;store=target;loaded=false;busy=true;controls();status('جارٍ تحميل إعدادات الزر…');
    try{const data=await api('button-settings?'+new URLSearchParams({merchant:target}));if(id!==requestId||merchant!==target)return;
      settings=UI.normalize(data.settings);saved=structuredClone(settings);version=data.version;loaded=true;populate();
      status(version?'الإعدادات المحفوظة للمتجر':'اختر شكل الزر ومكانه ثم احفظ.');
    }catch(error){if(id===requestId){status('تعذر تحميل الإعدادات. اضغط «إعادة التحميل» للمحاولة.');toast(error.message);}}
    finally{if(id===requestId){busy=false;controls();}}
  }
  async function save(){
    if(!loaded||busy||!isDirty()||!valid()||store!==merchant)return;
    busy=true;controls();status('جارٍ حفظ الشكل والمكان والألوان…');const target=merchant,id=requestId;
    try{const data=await api('button-settings?'+new URLSearchParams({merchant:target}),{method:'PUT',body:JSON.stringify({version,settings})});
      if(id!==requestId||merchant!==target)return;
      settings=UI.normalize(data.settings);saved=structuredClone(settings);version=data.version;populate();status('تم الحفظ. حدّث صفحة المنتج لرؤية التغييرات.');toast('تم حفظ إعدادات زر المتجر.');
    }catch(error){if(id===requestId){status(error.message);toast(error.message);}}
    finally{if(id===requestId){busy=false;controls();}}
  }
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  for(const design of UI.designs){
    const label=el('label',undefined,'button-design-option'),head=el('span',undefined,'button-design-head');
    const radio=el('input');radio.type='radio';radio.name='button-design';radio.value=design.id;head.append(radio,el('span',design.name));
    const example=el('div',undefined,'button-design-sample');example.inert=true;example.setAttribute('aria-hidden','true');
    UI.render(example,{...UI.defaults(design.id),size:'small'},sample);
    label.append(example,head);label.title=design.hint;byId('buttonDesignChoices').append(label);
    radio.onchange=()=>{if(radio.checked){settings.design=design.id;populate();changed();}};
  }
  for(const [group,title] of [['details','داخل تفاصيل المنتج'],['image','على الصورة الرئيسية'],['floating','مواضع ثابتة على الشاشة']]){
    byId('buttonPlacementChoices').append(el('p',title,'placement-group-label'));
    const grid=el('div',undefined,'placement-choices');
    for(const place of UI.placements.filter(p=>p.group===group)){
      const label=el('label',undefined,'studio-choice'),radio=el('input');radio.type='radio';radio.name='button-placement';radio.value=place.id;
      const map=el('span',undefined,'place-map');map.dataset.place=place.id;map.setAttribute('aria-hidden','true');label.append(radio,map,el('span',place.name));grid.append(label);
      radio.onchange=()=>{if(radio.checked){settings.placement=place.id;changed();}};
    }
    byId('buttonPlacementChoices').append(grid);
  }
  for(const p of UI.placements){const option=el('option',p.name);option.value=p.id;byId('buttonMobilePlacement').append(option);}
  for(const palette of UI.palettes){
    const button=el('button',undefined,'palette-choice');button.type='button';button.dataset.palette=palette.id;button.setAttribute('aria-label','مجموعة ألوان '+palette.name);
    const dot=el('span',undefined,'palette-dot');dot.style.backgroundColor=palette.color;dot.setAttribute('aria-hidden','true');button.append(dot,el('span',palette.name));
    button.onclick=()=>{Object.assign(settings,UI.paletteColors(palette.id,settings.design));populate();changed();};byId('buttonPaletteChoices').append(button);
  }
  for(const [key,title] of fields){
    const field=el('div',undefined,'button-color-field'),label=el('label',title);label.htmlFor='button-color-'+key;
    const pair=el('div',undefined,'button-color-pair'),color=el('input'),hex=el('input');
    color.type='color';color.id='button-color-'+key;hex.type='text';hex.id='button-hex-'+key;hex.dir='ltr';hex.maxLength=7;hex.pattern='#[0-9a-fA-F]{6}';hex.required=true;hex.setAttribute('aria-label','رمز لون '+title+' HEX');
    color.oninput=()=>{settings[key]=color.value;hex.value=color.value;changed();};
    hex.oninput=()=>{if(hex.checkValidity()){settings[key]=hex.value;color.value=hex.value;changed();}else{status('اكتب اللون بصيغة HEX مثل #263a30.');controls();}};
    pair.append(color,hex);field.append(label,pair);byId('buttonColorFields').append(field);
  }
  for(const [id,key] of [['buttonMobilePlacement','mobile_placement'],['buttonSize','size'],['buttonAlignment','alignment']])byId(id).onchange=()=>{settings[key]=byId(id).value;changed();};
  for(const [id,key] of [['buttonEdgeOffset','edge_offset'],['buttonBottomOffset','bottom_offset']]){const input=byId(id);input.required=true;input.oninput=()=>{if(input.checkValidity()){settings[key]=Number(input.value);changed();}else{status('أدخل مسافة صحيحة ضمن النطاق الموضح.');controls();}};}
  byId('globalButtonLabel').oninput=()=>{settings.label=byId('globalButtonLabel').value;changed();};
  byId('globalButtonSubtitle').oninput=()=>{settings.subtitle=byId('globalButtonSubtitle').value;changed();};
  byId('resetButtonPalette').onclick=()=>{const palette=UI.defaults(settings.design);for(const [key] of fields)settings[key]=palette[key];populate();changed();};
  byId('previewDesktop').onclick=()=>{device='desktop';preview();};byId('previewMobile').onclick=()=>{device='mobile';preview();};
  byId('saveButtonSettings').onclick=save;byId('reloadButtonSettings').onclick=async()=>{if(busy)return;if(isDirty()&&!(await confirmAction('تجاهل تعديلات الزر وإعادة تحميل النسخة المحفوظة؟')))return;await load(true);};
  populate();status('اختر متجرًا لتحميل إعدادات الزر.');
  window.SizeGuideSettings={load,isDirty,isBusy:()=>busy,discard};
})();
