/* Quick product lookup: a compact card per product with its data, its guide and the fastest ways to change either.
   Runs after size-guide-admin.js and shares its helpers (api, toast, openEditor, libraries ...). */
'use strict';
const SizeGuideQuick=(() => {
  const SURFACES={
    quick:{input:'#quickSearch',box:'#quickResults',count:'#quickCount',always:true},
    editor:{input:'#editorFind',box:'#editorFindResults',count:null,always:false},
  };
  let skipOpen=false;
  const timers={},statusText={sale:'معروض للبيع',hidden:'مخفي',out:'نفدت الكمية','out-and-notify':'نفدت مع التنبيه'};
  const money=value=>value===null||value===undefined?'—':Number(value).toLocaleString('ar',{maximumFractionDigits:2});
  const guideText=p=>!p.has_guide?'بدون جدول':p.library_id?'مرتبط · '+(p.library_name||'جدول مشترك')+(p.is_published?'':' (غير منشور)'):p.is_published?(p.has_changes?'منشور + تعديلات مسودة':'منشور'):'مسودة';

  async function run(surface){
    const target=SURFACES[surface],input=$(target.input),query=input.value.trim(),box=$(target.box);
    if(!target.always&&!query){box.replaceChildren();return}
    try{
      const data=await api('product-lookup?'+new URLSearchParams({merchant,q:query}));
      if(input.value.trim()!==query)return;                       // a newer search is already on its way
      box.replaceChildren();
      if(target.count)$(target.count).textContent=data.items.length?`${data.items.length.toLocaleString('ar')} نتيجة${data.items.length===8?' (الأولى)':''}`:'';
      if(!data.items.length)box.append(mk('p','micro empty-note',query?'لا توجد منتجات تطابق بحثك. جرّب جزءًا من الاسم أو الـSKU.':'لا توجد منتجات. اضغط «مزامنة المنتجات» أولًا.'));
      for(const product of data.items)box.append(card(product,surface));
    }catch(error){toast(error.message)}
  }
  function schedule(surface){clearTimeout(timers[surface]);timers[surface]=setTimeout(()=>run(surface),250)}
  /* After anything changes: refresh what the rest of the dashboard shows from the same data. */
  async function refresh(){
    guideIndex=await api('size-guides'+qs());await loadLibraryIndex();
    await Promise.all([run('quick'),run('editor'),view==='catalog'?loadProducts():null,view==='library'?loadLibrary():null].filter(Boolean));
  }
  function button(text,handler,cls='secondary small'){const b=mk('button',cls,text);b.type='button';b.onclick=handler;return b}
  function card(p,surface){
    const el=mk('article','qcard'),head=mk('div','qhead'),info=mk('div','qinfo'),chips=mk('div','chips');
    const thumb=url(p.image)?Object.assign(mk('img','qthumb'),{src:url(p.image),alt:'',loading:'lazy'}):mk('div','qthumb placeholder');
    const title=url(p.url)?Object.assign(mk('a','qtitle',p.title+' ↗'),{href:url(p.url),target:'_blank',rel:'noopener noreferrer'}):mk('strong','qtitle',p.title);
    const meta=mk('div','qmeta');
    for(const [label,value] of [['SKU',p.sku||'—'],['السعر',money(p.price)+' '+(p.currency||'')],['الكمية',p.quantity===null||p.quantity===undefined?'—':String(p.quantity)]]){const item=mk('span','',label+': ');item.append(Object.assign(mk('b','',value),label==='SKU'?{dir:'ltr'}:{}));meta.append(item)}
    chips.append(mk('span','tag '+(p.status!=='sale'?'warn':''),statusText[p.status]||p.status||'—'),mk('span','tag '+(p.has_guide&&p.is_published?'':'badgeDraft'),guideText(p)));
    info.append(title,meta,chips);head.append(thumb,info);
    const actions=mk('div','qactions'),editPanel=mk('div','qpanel hidden'),linkPanel=mk('div','qpanel hidden');
    actions.append(button(p.has_guide?(p.library_id?'عرض الجدول':'تعديل الجدول'):'إضافة جدول',()=>openEditor(p.product_id).catch(e=>toast(e.message)),'small'));
    const editData=button('تعديل البيانات',()=>{editPanel.classList.toggle('hidden');linkPanel.classList.add('hidden');if(!editPanel.classList.contains('hidden'))buildEdit(editPanel,p,el,surface)});
    editData.dataset.act='edit';el.dataset.product=p.product_id;actions.append(editData);
    actions.append(button(p.library_id?'تغيير الجدول المشترك':'ربط بجدول مشترك',()=>{linkPanel.classList.toggle('hidden');editPanel.classList.add('hidden');if(!linkPanel.classList.contains('hidden'))buildLink(linkPanel,p)}));
    if(p.library_id)actions.append(button('فصل الارتباط',()=>unlink(p)));
    else if(p.has_guide)actions.append(button(p.is_published&&!p.has_changes?'إيقاف الظهور':'نشر',()=>bulk(p,p.is_published&&!p.has_changes?'unpublish':'publish')));
    if(surface==='editor'&&guide){
      if(mode==='library'&&libraryId)actions.append(button('ربط بهذا الجدول',()=>linkToCurrent(p),'small accent'));
      else if(mode==='product'&&editing&&editing.product_id!==p.product_id)actions.append(button('نسخ جدولي الحالي إليه',()=>copyCurrent(p),'small accent'));
    }
    el.append(head,actions,editPanel,linkPanel);return el;
  }
  /* ---- edit the product's data in Salla ---- */
  function buildEdit(panel,p,el,surface){
    panel.replaceChildren();
    const form=mk('form','qedit'),error=mk('p','qerror hidden');error.setAttribute('role','alert');
    const field=(label,id,type,value,extra={})=>{const wrap=mk('label','',label),input=Object.assign(mk('input'),{id,type,value:value??'',...extra});wrap.append(input);form.append(wrap);return input};
    const name=field('اسم المنتج','qe-name-'+p.product_id,'text',p.title,{maxLength:255,required:true});
    const price=field('السعر ('+(p.currency||'SAR')+')','qe-price-'+p.product_id,'number',p.price??'',{min:'0.01',step:'0.01',inputMode:'decimal'});
    const quantity=field('الكمية','qe-qty-'+p.product_id,'number',p.quantity??'',{min:'0',step:'1',inputMode:'numeric'});
    const note=mk('p','micro','يُحدَّث المنتج في متجرك على سلة مباشرة. الـSKU والحالة لا تُعدَّلان من هنا. تُحفظ القيم القديمة في سجل داخلي.');
    const save=mk('button','','حفظ في سلة'),cancel=button('إلغاء',()=>panel.classList.add('hidden'));save.type='submit';
    const row=mk('div','bulk-buttons');row.append(save,cancel);form.append(note,row,error);panel.append(form);
    form.onsubmit=async event=>{
      event.preventDefault();error.classList.add('hidden');
      const body={},changes=[],newName=name.value.trim(),newPrice=price.value.trim(),newQty=quantity.value.trim();
      if(newName&&newName!==p.title){body.name=newName;changes.push(`الاسم: «${p.title}» ← «${newName}»`)}
      if(newPrice!==''&&Number(newPrice)!==Number(p.price)){body.price=Number(newPrice);changes.push(`السعر: ${money(p.price)} ← ${money(Number(newPrice))}`)}
      if(newQty!==''&&Number(newQty)!==Number(p.quantity)){body.quantity=Number(newQty);changes.push(`الكمية: ${p.quantity??'—'} ← ${newQty}`)}
      const fail=text=>{error.textContent=text;error.classList.remove('hidden')};
      if(!changes.length)return fail('لا يوجد تغيير عن القيم الحالية.');
      if(!form.checkValidity())return form.reportValidity();
      if(!(await confirmAction('تحديث المنتج في سلة الآن؟ '+changes.join(' · '))))return;
      save.disabled=true;
      try{
        const result=await api('products/'+encodeURIComponent(p.product_id)+qs(),{method:'PUT',body:JSON.stringify(body)});
        Object.assign(p,result.product);if(editing&&editing.product_id===p.product_id){editing.title=p.title;$('#editorTitle').textContent=p.title+(p.sku?' • '+p.sku:'')}
        toast('تم التحديث في سلة: '+changes.join(' · '));await refresh();
      }catch(e){fail(e.message);toast(e.message)}finally{save.disabled=false}
    };
    name.focus();
  }
  /* ---- link, unlink, publish, copy ---- */
  function buildLink(panel,p){
    panel.replaceChildren();
    if(!libraries.length){panel.append(mk('p','micro','لا توجد جداول مشتركة بعد. أنشئ جدولًا واحدًا ثم اربط به منتجات كثيرة.'),button('إنشاء جدول مشترك',()=>openLibrary(null).catch(e=>toast(e.message)),'small'));return}
    const select=mk('select');select.setAttribute('aria-label','الجدول المشترك');
    select.append(Object.assign(mk('option','','اختر جدولًا مشتركًا…'),{value:''}));
    for(const l of libraries)select.append(Object.assign(mk('option','',l.name+(l.is_published?'':' (غير منشور)')),{value:l.library_id,selected:l.library_id===p.library_id}));
    const row=mk('div','bulk-buttons');row.append(select,button('ربط',async()=>{
      if(!select.value)return toast('اختر الجدول المشترك.');if(select.value===p.library_id)return toast('المنتج مرتبط بهذا الجدول بالفعل.');
      const hasOwn=p.has_guide&&!p.library_id;
      if(!(await confirmAction(hasOwn?'لهذا المنتج جدول خاص؛ سيظهر للعملاء جدول المكتبة بدلًا منه (يبقى جدوله الخاص محفوظًا حتى تفصله). هل تتابع؟':'ربط المنتج بهذا الجدول المشترك؟')))return;
      try{await api('size-library/'+select.value+'/link'+qs(),{method:'POST',body:JSON.stringify({product_ids:[p.product_id]})});toast('تم الربط.');await refresh()}catch(e){toast(e.message)}
    },'small'));panel.append(row);
  }
  async function unlink(p){
    if(!(await confirmAction('فصل المنتج عن الجدول المشترك؟ سيحتفظ بنسخة مستقلة يمكنك تعديلها.')))return;
    try{await api('size-guides/unlink'+qs(),{method:'POST',body:JSON.stringify({product_ids:[p.product_id]})});toast('تم فصل المنتج.');await refresh()}catch(e){toast(e.message)}
  }
  async function bulk(p,action){
    if(!(await confirmAction(action==='publish'?'نشر جدول هذا المنتج ليراه العملاء؟':'إيقاف ظهور جدول هذا المنتج مع الاحتفاظ بالمسودة؟')))return;
    try{const d=await api('size-guides/bulk'+qs(),{method:'POST',body:JSON.stringify({action,product_ids:[p.product_id]})});
      toast(d.updated.length?(action==='publish'?'نُشر الجدول.':'أُوقف الظهور.'):(d.skipped[0]?.reason||'لم يتغير شيء.'));await refresh()}catch(e){toast(e.message)}
  }
  async function linkToCurrent(p){
    if(p.has_guide&&!p.library_id&&!(await confirmAction('لهذا المنتج جدول خاص؛ سيظهر للعملاء هذا الجدول المشترك بدلًا منه. هل تتابع؟')))return;
    try{const d=await api('size-library/'+libraryId+'/link'+qs(),{method:'POST',body:JSON.stringify({product_ids:[p.product_id]})});
      toast(d.linked.length?'تم ربط «'+p.title+'» بهذا الجدول.':'تعذر الربط.');await reloadLibraryProducts();await refresh()}catch(e){toast(e.message)}
  }
  async function copyCurrent(p){
    if(dirty||version===0)return toast('احفظ جدول هذا المنتج أولًا؛ يُنسخ آخر نسخة محفوظة.');
    const overwrite=p.has_guide;
    if(overwrite&&!(await confirmAction('«'+p.title+'» له جدول بالفعل. استبداله بنسخة من جدولك الحالي؟')))return;
    try{const d=await api('size-guides/copy'+qs(),{method:'POST',body:JSON.stringify({source_product_id:editing.product_id,product_ids:[p.product_id],overwrite,publish:false})});
      toast(d.copied.length?'نُسخ الجدول كمسودة مستقلة إلى «'+p.title+'». انشره من بطاقته.':'لم يُنسخ الجدول.');await refresh()}catch(e){toast(e.message)}
  }
  /* From a catalog row: open the tool on that product with its data form ready. */
  async function focus(productId,search){
    if(!(await mayLeave()))return;dirty=false;
    $('#quickSearch').value=search||'';skipOpen=true;show('quick');skipOpen=false;await run('quick');
    const card=[...document.querySelectorAll('#quickResults .qcard')].find(c=>c.dataset.product===String(productId));
    if(!card)return toast('لم أجد المنتج بهذا البحث. اكتب اسمه في خانة البحث.');
    card.scrollIntoView?.({behavior:'smooth',block:'center'});card.querySelector('[data-act="edit"]').click();
  }
  $('#quickSearch').oninput=()=>schedule('quick');$('#editorFind').oninput=()=>schedule('editor');
  return {run,refresh,focus,open:()=>skipOpen?undefined:run('quick'),clear:()=>{for(const s of Object.values(SURFACES))$(s.box).replaceChildren()}};
})();
window.SizeGuideQuick=SizeGuideQuick;
