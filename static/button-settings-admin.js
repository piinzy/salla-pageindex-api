(() => {
  'use strict';
  const byId=id=>document.getElementById(id),UI=window.SizeGuideButton;
  const fields=[['background_color','الخلفية'],['text_color','النص الرئيسي'],['border_color','الإطار'],['icon_color','الأيقونة والسهم'],['secondary_text_color','النص المساعد']];
  const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  let settings=UI.normalize(UI.defaults()),saved=structuredClone(settings),version=0,store='',loaded=false,busy=false,requestId=0,current=0;
  let device=window.matchMedia?.('(max-width:969px)').matches?'mobile':'desktop';
  const target=()=>current===0?settings:(settings.extra_buttons[current-1]||settings);
  const sample={title:'دليل المقاسات',button_label:'دليل المقاسات',unit:'cm',measurement_type:'garment',
    columns:[{label:'الصدر',kind:'measurement'},{label:'الخصر',kind:'measurement'},{label:'الطول',kind:'measurement'}],
    rows:['S','M','L','XL'].map(size=>({size,values:['—','—','—']})),color:'#177e65',category:'general',theme:'classic',
    notes:'هذه معاينة للشكل فقط. القياسات الفعلية تُدخل في جدول كل منتج.',instructions:''};
  /* Every configured button has its own preview host and placement engine, so overlaps show exactly as in the store. */
  const surface=byId('buttonPreviewSurface'),hosts=[],engines=[];
  const anchors=()=>({root:surface,title:byId('previewTitle'),price:byId('previewPrice'),gallery:byId('previewImage'),
    options:byId('previewOptions'),size:byId('previewSizeLabel'),cart:byId('previewCart')});
  function ensureHosts(count){
    while(hosts.length<count){
      let host=hosts.length===0?byId('buttonLivePreview'):el('span');if(hosts.length)host.id='buttonLivePreview-'+(hosts.length+1);
      if(!host.parentNode)surface.append(host);hosts.push(host);
      engines.push(window.SizeGuidePlacement.create({surface,viewport:()=>device==='mobile',anchors}));
    }
    while(hosts.length>count){engines.pop().reset();hosts.pop().remove();}
  }
  const valid=()=>fields.every(([key])=>byId('button-hex-'+key).checkValidity())&&['buttonEdgeOffset','buttonBottomOffset'].every(id=>byId(id).checkValidity());
  const isDirty=()=>loaded&&(JSON.stringify(settings)!==JSON.stringify(saved)||!valid());
  function status(message){byId('buttonSettingsState').textContent=message;}
  function controls(){byId('buttonSettingsFields').disabled=!loaded||busy;byId('saveButtonSettings').disabled=!loaded||busy||(version>0&&!isDirty())||!valid();byId('reloadButtonSettings').disabled=busy;strip();}
  function luminance(hex){const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
  function contrast(){
    const s=target(),a=luminance(s.design==='icon'?s.icon_color:s.text_color),b=luminance(s.background_color);
    const low=(Math.max(a,b)+.05)/(Math.min(a,b)+.05)<4.5&&!['link','row','glass'].includes(s.design);
    byId('buttonContrastHint').hidden=!low;byId('buttonContrastHint').textContent='تباين اللونين منخفض. اختر لون نص أو خلفية أوضح لسهولة القراءة.';
  }
  /* Segmented controls: one radio group per property of the button being edited. */
  const segs=[];
  function seg(id,name,key,options,numeric){
    const box=byId(id);
    for(const [value,label,glyph] of options){
      const wrap=el('label'),radio=el('input');radio.type='radio';radio.name=name;radio.value=String(value);
      wrap.append(radio);if(glyph)wrap.append(glyph);wrap.append(el('span',label));box.append(wrap);
      radio.onchange=()=>{if(radio.checked){target()[key]=numeric?Number(value):value;changed();}};
    }
    segs.push({box,key});
  }
  const dropdowns=[];
  function syncSegs(){for(const {box,key} of segs)box.querySelectorAll('input').forEach(radio=>{radio.checked=radio.value===String(target()[key]);radio.closest('label').classList.toggle('selected',radio.checked);});dropdowns.forEach(refresh=>refresh());}
  /* The icon choices live in a dropdown: the trigger shows the chosen icon, the panel fades in (150ms) and out (100ms) with no movement. */
  function iconDropdown(panel){
    const wrap=el('div',undefined,'icon-dd'),trigger=el('button',undefined,'icon-dd-trigger secondary'),glyph=el('span',undefined,'dd-glyph'),name=el('span',undefined,'dd-name'),caret=el('span','▾','dd-caret');
    trigger.type='button';trigger.setAttribute('aria-haspopup','true');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls',panel.id);caret.setAttribute('aria-hidden','true');
    trigger.append(glyph,name,caret);panel.before(wrap);wrap.append(trigger,panel);panel.classList.add('dd-panel');panel.setAttribute('aria-label','أيقونة الزر');
    const radios=()=>[...panel.querySelectorAll('input')];let open=false;
    function refresh(){const chosen=radios().find(r=>r.checked);glyph.replaceChildren();if(!chosen)return;const label=chosen.closest('label'),svg=label.querySelector('.icon');if(svg)glyph.append(svg.cloneNode(true));name.textContent=label.querySelector('span:last-child').textContent}
    const set=value=>{open=value;panel.classList.toggle('open',value);trigger.setAttribute('aria-expanded',String(value))};
    const close=focus=>{if(!open)return;set(false);if(focus)trigger.focus()};
    const openIt=()=>{set(true);(radios().find(r=>r.checked)||radios()[0])?.focus()};
    trigger.onclick=()=>open?close(false):openIt();
    trigger.onkeydown=event=>{if(event.key==='ArrowDown'&&!open){event.preventDefault();openIt()}};
    panel.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true)}else if(event.key==='Tab')close(false)});
    panel.addEventListener('change',()=>{refresh();close(true)});
    document.addEventListener('pointerdown',event=>{if(open&&!wrap.contains(event.target))close(false)});
    dropdowns.push(refresh);refresh();
  }
  const tiles=[];
  const families={line:'روابط وسطور',frame:'أزرار مؤطّرة',fill:'أزرار ممتلئة',badge:'بطاقات وشارات',
    paper:'ورق وملصقات',measure:'أدوات القياس',iconwork:'أيقونات بارزة',rows:'صفوف إرشادية',geometry:'أشكال هندسية',fabric:'تفاصيل الأقمشة'};
  function currentPalette(s){
    const matches=source=>UI.colors.every(key=>source[key].toLowerCase()===s[key].toLowerCase());
    const palette=UI.palettes.find(p=>matches(UI.paletteColors(p.id,s.design)));
    if(palette)return palette.id;
    return matches(UI.defaults(s.design))?'default':'custom';
  }
  function shapeColors(s,id,palette){
    const source=palette==='default'?UI.defaults(id):palette==='custom'?s:UI.paletteColors(palette,id);
    return Object.fromEntries(UI.colors.map(key=>[key,source[key]]));
  }
  function renderTiles(){
    if(!loaded)return;
    const s=target(),palette=currentPalette(s);
    for(const tile of tiles){
      const paint=shapeColors(s,tile.id,palette);
      const signature=JSON.stringify([s.label,s.subtitle,s.icon,s.radius,s.depth,s.effect,paint]);
      if(tile.signature===signature)continue;
      UI.render(tile.example,{...s,...paint,design:tile.id,size:'small',scale:100,width:'auto'},sample);
      tile.signature=signature;
    }
  }
  function strip(){
    const box=byId('buttonStrip');box.replaceChildren();
    [settings,...settings.extra_buttons].forEach((s,i)=>{
      const chip=el('span',undefined,'strip-chip'+(i===current?' active':'')),pick=el('button',i===0?'الزر الرئيسي':'الزر '+(i+1));
      pick.type='button';pick.setAttribute('aria-pressed',String(i===current));pick.onclick=()=>{current=i;populate();};chip.append(pick);
      if(i>0){const x=el('button','×','strip-x');x.type='button';x.setAttribute('aria-label','حذف الزر '+(i+1));x.onclick=()=>removeExtra(i);chip.append(x);}
      box.append(chip);
    });
    const add=el('button','+ إضافة زر','strip-add');add.type='button';add.disabled=!loaded||busy||settings.extra_buttons.length>=UI.MAX_EXTRA;add.onclick=addExtra;box.append(add);
  }
  function addExtra(){if(settings.extra_buttons.length>=UI.MAX_EXTRA)return;settings.extra_buttons.push({...UI.defaults('icon'),placement:'image_bottom_left'});current=settings.extra_buttons.length;populate();changed();}
  async function removeExtra(index){
    if(!(await confirmAction('حذف هذا الزر من المتجر؟')))return;
    settings.extra_buttons.splice(index-1,1);current=Math.min(current,settings.extra_buttons.length);populate();changed();
  }
  function preview(){
    const all=[settings,...settings.extra_buttons],s=target();ensureHosts(all.length);surface.dataset.device=device;
    const open=()=>window.SizeGuideUI.open(sample,'معاينة التصميم');let result=null;
    all.forEach((item,i)=>{
      UI.render(hosts[i],item,sample,open);hosts[i].dataset.index=String(i);hosts[i].classList.toggle('editing',all.length>1&&i===current);
      const placed=engines[i].apply(hosts[i],{id:'preview'},item);if(i===current)result=placed;
    });
    const name=UI.placements.find(p=>p.id===result.placement)?.name||'';
    byId('buttonPlacementHint').textContent=(all.length>1?(current===0?'الزر الرئيسي — ':'الزر '+(current+1)+' — '):'')+(device==='mobile'?'الجوال: ':'الكمبيوتر: ')+name+
      (result.requested==='mobile_bar'&&device!=='mobile'?' — الشريط الثابت يظهر على الجوال فقط.':'')+(result.hidden?' — هذا الزر لا يظهر على '+(device==='mobile'?'الجوال':'الكمبيوتر')+'.':'');
    byId('previewDesktop').setAttribute('aria-pressed',String(device==='desktop'));byId('previewMobile').setAttribute('aria-pressed',String(device==='mobile'));
    byId('buttonLinkHint').hidden=!['link','row'].includes(s.design);byId('buttonSubtitleGroup').hidden=!UI.hasSubtitle(s.design);
    for(const [key] of fields){const inactive=(['link','row'].includes(s.design)&&key==='background_color')||(s.design==='link'&&key==='border_color')||(key==='secondary_text_color'&&!UI.hasSubtitle(s.design));byId('button-color-'+key).disabled=inactive;byId('button-hex-'+key).disabled=inactive;}
    for(const [name,value] of [['button-design',s.design],['button-placement',s.placement]])document.querySelectorAll(`[name="${name}"]`).forEach(radio=>{radio.checked=radio.value===value;radio.closest('label').classList.toggle('selected',radio.checked);});
    document.querySelectorAll('[data-palette]').forEach(button=>{const palette=UI.paletteColors(button.dataset.palette,s.design);const selected=UI.colors.every(key=>palette[key].toLowerCase()===s[key].toLowerCase());button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});
    byId('buttonScaleOut').textContent=s.scale+'%';byId('buttonRadiusOut').textContent=s.radius<0?'حسب الشكل':s.radius+'px';
    byId('buttonQuickIcons').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.icon===s.icon)));
    syncSegs();renderTiles();contrast();controls();
  }
  function changed(){status('تعديلات غير محفوظة');preview();}
  function populate(){
    const s=target();
    byId('globalButtonLabel').value=s.label;byId('globalButtonSubtitle').value=s.subtitle;
    for(const [key] of fields){byId('button-color-'+key).value=s[key];byId('button-hex-'+key).value=s[key];}
    for(const [id,key] of [['buttonMobilePlacement','mobile_placement'],['buttonScale','scale'],['buttonRadius','radius'],['buttonEdgeOffset','edge_offset'],['buttonBottomOffset','bottom_offset']])byId(id).value=s[key];
    preview();
  }
  function discard(){settings=structuredClone(saved);current=0;populate();status(loaded?'الإعدادات المحفوظة':'اختر متجرًا أولًا.');}
  async function load(force=false){
    const targetStore=merchant;if(!targetStore)return;if(store===targetStore&&loaded&&!force)return;
    const id=++requestId;store=targetStore;loaded=false;busy=true;controls();status('جارٍ تحميل إعدادات الأزرار…');
    try{const data=await api('button-settings?'+new URLSearchParams({merchant:targetStore}));if(id!==requestId||merchant!==targetStore)return;
      settings=UI.normalize(data.settings);saved=structuredClone(settings);version=data.version;loaded=true;current=0;populate();
      status(version?'الإعدادات المحفوظة للمتجر':'اختر شكل الزر ومكانه ثم احفظ.');
    }catch(error){if(id===requestId){status('تعذر تحميل الإعدادات. اضغط «إعادة التحميل» للمحاولة.');toast(error.message);}}
    finally{if(id===requestId){busy=false;controls();}}
  }
  async function save(){
    if(!loaded||busy||(version>0&&!isDirty())||!valid()||store!==merchant)return;
    busy=true;controls();status('جارٍ حفظ الأزرار…');const targetStore=merchant,id=requestId;
    try{const data=await api('button-settings?'+new URLSearchParams({merchant:targetStore}),{method:'PUT',body:JSON.stringify({version,settings})});
      if(id!==requestId||merchant!==targetStore)return;
      settings=UI.normalize(data.settings);saved=structuredClone(settings);version=data.version;current=Math.min(current,settings.extra_buttons.length);populate();status('تم الحفظ. حدّث صفحة المنتج لرؤية التغييرات.');toast('تم حفظ إعدادات أزرار المتجر.');window.dispatchEvent(new Event('guide-button-saved'));
    }catch(error){if(id===requestId){status(error.message);toast(error.message);}}
    finally{if(id===requestId){busy=false;controls();}}
  }
  // Design tiles show the current colours, icon and depth so choosing a shape is a real preview.
  const arabicNumber=new Intl.NumberFormat('ar-SA-u-nu-arab');
  byId('buttonDesignCount').textContent=arabicNumber.format(UI.designs.length)+' شكلًا';
  for(const [key,name] of Object.entries(families)){
    const section=el('section',undefined,'shape-family'),heading=el('h4',name);
    heading.id='buttonFamily-'+key;heading.tabIndex=-1;section.setAttribute('aria-labelledby',heading.id);
    const members=UI.designs.filter(item=>item.family===key);
    const start=tiles.length+1,end=tiles.length+members.length;
    const range=el('bdi',arabicNumber.format(start)+'–'+arabicNumber.format(end),'shape-range');
    heading.append(range);
    const grid=el('div',undefined,'button-design-choices');
    const option=el('option',name+' ('+range.textContent+')');option.value=heading.id;byId('buttonFamilyJumps').append(option);
    section.append(heading,grid);byId('buttonDesignChoices').append(section);
    for(const design of members){
      const label=el('label',undefined,'button-design-option'),head=el('span',undefined,'button-design-head');
      const radio=el('input');radio.type='radio';radio.name='button-design';radio.value=design.id;
      const ordinal=tiles.length+1;
      label.id='button-shape-'+ordinal;
      const number=el('bdi',arabicNumber.format(ordinal),'shape-number');number.setAttribute('aria-hidden','true');
      head.append(radio,el('span',design.name),number);
      const example=el('div',undefined,'button-design-sample');example.inert=true;example.setAttribute('aria-hidden','true');
      tiles.push({id:design.id,example});
      label.append(example,head);label.title=design.hint;grid.append(label);
      radio.onchange=()=>{
        if(!radio.checked)return;
        const s=target();Object.assign(s,shapeColors(s,design.id,currentPalette(s)),{design:design.id});
        populate();status('تعديلات غير محفوظة');
      };
    }
  }
  seg('buttonIconChoices','button-icon','icon',UI.icons.map(i=>[i.id,i.name,i.id==='none'?null:UI.icon(i.id)]));
  iconDropdown(byId('buttonIconChoices'));
  for(const key of ['ruler','tape_coil','hanger','dress','mannequin','pattern']){
    const def=UI.icons.find(i=>i.id===key),b=el('button');b.type='button';b.dataset.icon=key;
    b.append(UI.icon(key),el('span',def.name));b.onclick=()=>{target().icon=key;changed();};
    byId('buttonQuickIcons').append(b);
  }
  function goTo(element,focus=element){
    if(!element)return;
    focus?.focus({preventScroll:true});
    element.scrollIntoView?.({block:'start'});
  }
  function showNewDesigns(){goTo(byId('buttonFamily-paper'));}
  byId('jumpNewButtons').onclick=showNewDesigns;
  byId('buttonSectionJump').onchange=event=>{
    const destination=byId(event.target.value);
    if(destination)goTo(destination,destination.querySelector('h3')||destination);
    event.target.value='';
  };
  byId('showProductPreview').onclick=()=>{
    device='mobile';preview();goTo(byId('buttonProductPreview'));
  };
  byId('backToShape').onclick=()=>{
    const picked=byId('buttonDesignChoices').querySelector('input:checked');
    if(picked)goTo(picked.closest('label'),picked);
  };
  for(const [group,title] of [['details','داخل تفاصيل المنتج'],['image','على الصورة الرئيسية'],['floating','مواضع ثابتة على الشاشة']]){
    byId('buttonPlacementChoices').append(el('p',title,'placement-group-label'));
    const grid=el('div',undefined,'placement-choices');
    for(const place of UI.placements.filter(p=>p.group===group)){
      const label=el('label',undefined,'studio-choice'),radio=el('input');radio.type='radio';radio.name='button-placement';radio.value=place.id;
      const map=el('span',undefined,'place-map');map.dataset.place=place.id;map.setAttribute('aria-hidden','true');label.append(radio,map,el('span',place.name));grid.append(label);
      radio.onchange=()=>{if(radio.checked){target().placement=place.id;changed();}};
    }
    byId('buttonPlacementChoices').append(grid);
  }
  for(const p of UI.placements){const option=el('option',p.name);option.value=p.id;byId('buttonMobilePlacement').append(option);}
  for(const palette of UI.palettes){
    const button=el('button',undefined,'palette-choice');button.type='button';button.dataset.palette=palette.id;button.setAttribute('aria-label','مجموعة ألوان '+palette.name);
    const dot=el('span',undefined,'palette-dot');dot.style.setProperty('--c',palette.color);dot.setAttribute('aria-hidden','true');button.append(dot,el('span',palette.name));
    button.onclick=()=>{Object.assign(target(),UI.paletteColors(palette.id,target().design));populate();changed();};byId('buttonPaletteChoices').append(button);
  }
  for(const [key,title] of fields){
    const field=el('div',undefined,'button-color-field'),label=el('label',title);label.htmlFor='button-color-'+key;
    const pair=el('div',undefined,'button-color-pair'),color=el('input'),hex=el('input');
    color.type='color';color.id='button-color-'+key;hex.type='text';hex.id='button-hex-'+key;hex.dir='ltr';hex.maxLength=7;hex.pattern='#[0-9a-fA-F]{6}';hex.required=true;hex.setAttribute('aria-label','رمز لون '+title+' HEX');
    color.oninput=()=>{target()[key]=color.value;hex.value=color.value;changed();};
    hex.oninput=()=>{if(hex.checkValidity()){target()[key]=hex.value;color.value=hex.value;changed();}else{status('اكتب اللون بصيغة HEX مثل #263a30.');controls();}};
    pair.append(color,hex);field.append(label,pair);byId('buttonColorFields').append(field);
  }
  seg('segSize','button-size','size',[['small','صغير'],['medium','متوسط'],['large','كبير']]);
  seg('segWidth','button-width','width',[['auto','حسب النص'],['full','عرض كامل']]);
  seg('segAlignment','button-alignment','alignment',[['start','البداية'],['center','الوسط'],['end','النهاية']]);
  seg('segDepth','button-depth','depth',UI.depths.map(d=>[d.id,d.name]));
  seg('segEffect','button-effect','effect',UI.effects.map(d=>[d.id,d.name]));
  seg('segDevices','button-devices','devices',[['all','الكل'],['desktop','الكمبيوتر'],['mobile','الجوال']]);
  byId('buttonMobilePlacement').onchange=()=>{target().mobile_placement=byId('buttonMobilePlacement').value;changed();};
  for(const [id,key] of [['buttonScale','scale'],['buttonRadius','radius']]){const input=byId(id);input.oninput=()=>{target()[key]=Number(input.value);changed();};}
  for(const [id,key] of [['buttonEdgeOffset','edge_offset'],['buttonBottomOffset','bottom_offset']]){const input=byId(id);input.required=true;input.oninput=()=>{if(input.checkValidity()){target()[key]=Number(input.value);changed();}else{status('أدخل مسافة صحيحة ضمن النطاق الموضح.');controls();}};}
  byId('globalButtonLabel').oninput=()=>{target().label=byId('globalButtonLabel').value;changed();};
  byId('globalButtonSubtitle').oninput=()=>{target().subtitle=byId('globalButtonSubtitle').value;changed();};
  byId('resetButtonPalette').onclick=()=>{const palette=UI.defaults(target().design);for(const [key] of fields)target()[key]=palette[key];populate();changed();};
  byId('previewDesktop').onclick=()=>{device='desktop';preview();};byId('previewMobile').onclick=()=>{device='mobile';preview();};
  byId('saveButtonSettings').onclick=save;byId('reloadButtonSettings').onclick=async()=>{if(busy)return;if(isDirty()&&!(await confirmAction('تجاهل تعديلات الأزرار وإعادة تحميل النسخة المحفوظة؟')))return;await load(true);};
  // Preview products: the merchant can judge the button on a dress, a shirt, a shoe or a pet item.
  const products={
    shirt:{name:'قميص',title:'قميص أكسفورد قطني',section:'القمصان',color:'أزرق سماوي',swatch:'#a3bbd8',cat:'men',sizes:['S','M','L','XL']},
    dress:{name:'فستان',title:'فستان يومي',section:'الفساتين',color:'رمادي',swatch:'#a5a6a8',cat:'women',sizes:['S','M','L','XL']},
    shoe:{name:'حذاء',title:'حذاء رياضي',section:'الأحذية',color:'رمادي',swatch:'#a6a9aa',cat:'shoes',sizes:['39','40','41','42']},
    pet:{name:'طوق',title:'طوق جلدي',section:'مستلزمات الحيوانات',color:'بني',swatch:'#865c45',cat:'pets',sizes:['XS','S','M','L']}
  };
  function setProduct(kind){
    const item=products[kind],photo=byId('previewImage');
    byId('previewTitle').textContent=item.title;surface.querySelector('.preview-category').textContent=item.section;
    byId('previewColorName').textContent=item.color;surface.querySelector('.preview-tone i').style.background=item.swatch;
    const sizeBox=surface.querySelector('.button-preview-sizes');
    sizeBox.replaceChildren(...item.sizes.map((size,i)=>{
      const b=el('button',size);b.type='button';b.setAttribute('aria-pressed',String(i===1));
      b.onclick=()=>sizeBox.querySelectorAll('button').forEach(chip=>chip.setAttribute('aria-pressed',String(chip===b)));
      return b;
    }));
    photo.querySelector('.sample-visual')?.remove();
    let visual;
    if(kind==='shirt'){
      visual=el('img');visual.src='/brand-assets/preview-oxford-shirt.webp';visual.alt='قميص أكسفورد أزرق للتوضيح';visual.width=640;visual.height=960;visual.loading='lazy';
    }else visual=window.SizeGuideUI?.emblem?.(item.cat,'preview-emblem')||UI.icon(({dress:'dress',shoe:'shoe',pet:'paw'})[kind]);
    visual.classList.add('sample-visual');photo.prepend(visual);
    sample.category=item.cat;sample.rows=item.sizes.map(size=>({size,values:sample.columns.map(()=>'—')}));
    photo.dataset.kind=kind;byId('previewProducts').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.kind===kind)));
    preview();
  }
  const productBar=el('div',undefined,'preview-products');productBar.id='previewProducts';productBar.setAttribute('role','group');productBar.setAttribute('aria-label','منتج المعاينة');
  for(const [kind,item] of Object.entries(products)){const b=el('button',item.name);b.type='button';b.dataset.kind=kind;b.setAttribute('aria-pressed',String(kind==='shirt'));b.onclick=()=>setProduct(kind);productBar.append(b);}
  document.querySelector('#buttonSettings .preview-header').after(productBar);
  setProduct('shirt');populate();status('اختر متجرًا لتحميل إعدادات الأزرار.');
  window.SizeGuideSettings={configured:merchantId=>loaded&&store===merchantId&&version>0,load,isDirty,isBusy:()=>busy,discard,showNewDesigns};
})();
