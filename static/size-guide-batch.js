/* Product guides are written only from the approval screen, using the version seen there. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  if (!el('batchFields')) return;
  const node = (tag, text, cls) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (cls) element.className = cls;
    return element;
  };
  const items = [], groups = [], expected = new Map();
  let operation = null, generation = 0, codeInput = '';
  const message = text => {el('batchMessage').textContent = text;};
  const norm = value => String(value || '').trim().toLowerCase();
  const same = (a,b) => norm(a) === norm(b);
  const digits = text => text.replace(/[٠-٩۰-۹]/g, c => String(c.charCodeAt(0) % 16));
  const sizes = /^(.*)[-_](XXXS|XXS|XS|S|M|L|XL|XXL|XXXL|[2-6]XL|[0-9]{1,3})$/i;
  const post = (method, body) => ({method, body:JSON.stringify(body)});
  function checkStore(){
    if(!operation || operation.generation!==generation || operation.merchant!==merchant)throw Error('تغيّر المتجر. افتح الدفعة في المتجر الصحيح.');
  }
  async function request(path, options){
    checkStore();
    const response=await api(path,options);
    checkStore();return response;
  }
  const guidePath = id => 'size-guides/'+encodeURIComponent(id)+qs();
  const lookup = async (q, exact) => (await request('product-lookup'+qs()+'&q='+encodeURIComponent(q)+(exact?'&exact=true':''))).items || [];
  const label = p => [p.title,p.sku].filter(Boolean).join(' · ');
  function button(text, run, cls='secondary small'){
    const b=node('button',text,cls);b.type='button';b.onclick=run;return b;
  }
  function invalidate(){
    groups.length=0;el('batchReviewBox').hidden=true;el('batchGroups').replaceChildren();
  }
  function reset(){
    generation++;
    for(const item of items) if(item.url?.startsWith('blob:')) URL.revokeObjectURL(item.url);
    items.length=0;expected.clear();codeInput='';el('batchCodes').value='';el('batchFiles').value='';
    invalidate();renderItems();message('');
  }
  async function run(fn){
    if(operation)return;
    if(!merchant){message('اختر متجرًا مربوطًا أولًا.');return;}
    operation={merchant,generation};el('batchFields').disabled=true;
    try{await fn();}
    catch(error){if(operation.generation===generation)message(error.message || 'تعذر إكمال العملية.');}
    finally{operation=null;el('batchFields').disabled=false;}
  }
  async function exactHits(code){
    let hits=await lookup(code,true);
    const normalized=digits(code);
    if(!hits.length && normalized!==code) hits=await lookup(normalized,true);
    return hits;
  }
  async function match(item){
    if(item.manual)return;
    const stem=item.name.replace(/\.[^.]+$/,'').trim();
    const suffix=stem.match(sizes);
    const fullHits=await exactHits(stem);
    let nameHits=fullHits;
    item.sizeHint='';
    if(!fullHits.length && suffix){
      nameHits=await exactHits(suffix[1]);
      if(nameHits.length===1)item.sizeHint=suffix[2].toUpperCase();
    }
    const sku=String(item.scan?.product_sku || '').trim();
    const readHits=sku ? await exactHits(sku) : [];
    item.product=null;
    if(nameHits.length>1 || readHits.length>1){
      item.matchNote='الكود مكرر في الكتالوج. حدّد المنتج يدويًا.';
    }else if(sku && nameHits.length && (!readHits.length || String(nameHits[0].product_id)!==String(readHits[0].product_id))){
      item.matchNote='كود الصورة يختلف عن كود اسم الملف. تحقّق وحدّد المنتج.';
    }else{
      item.product=nameHits[0] || readHits[0] || null;
      item.matchNote=item.product ? (nameHits.length?'تطابق كود اسم الملف':'تطابق الكود المكتوب داخل الصورة') : 'يحتاج تحديد المنتج من الكتالوج.';
    }
  }
  function toText(scan,hint){
    const rows=scan.rows.map(r=>[r.size || (scan.rows.length===1?hint:''),...r.values]);
    return [[scan.size_label || 'المقاس',...scan.columns.map(c=>c.label)],...rows].map(r=>r.join('\t')).join('\n');
  }
  function parse(item){
    const raw=SizeGuideImport.parseRows(item.text);
    if(raw.length<2 || raw[0].length<2)throw Error('أدخل عناوين الأعمدة وصف مقاس واحدًا على الأقل.');
    if(raw.length>31 || raw[0].length>11)throw Error('الجدول يدعم حتى 30 مقاسًا و10 أعمدة قياس.');
    const header=raw[0].slice(1);
    if(header.some(x=>!x || x.length>40) || new Set(header.map(norm)).size!==header.length)throw Error('أدخل أسماء أعمدة واضحة وغير مكررة (حتى 40 حرفًا).');
    if(raw.slice(1).some(r=>r.length!==raw[0].length || r[0].length>30 || r.slice(1).some(v=>v.length>60)))throw Error('تحقّق من طول الخلايا وعددها في كل صف.');
    const grid=SizeGuideImport.toGrid(item.text);
    for(const col of grid.columns){
      const original=item.scan?.columns.find(c=>same(c.label,col.label));
      if(original?.kind==='text' || /^(eu|uk|us|fr|it|de|jp|cn|au|size|مقاس)\b/i.test(col.label))col.kind='text';
    }
    return grid;
  }
  function table(grid){
    const wrap=node('div',undefined,'batch-sheet'),t=node('table'),head=t.createTHead().insertRow();
    for(const caption of ['المقاس',...grid.columns.map(c=>c.label)])head.append(node('th',caption));
    const body=t.createTBody();
    for(const r of grid.rows){const tr=body.insertRow();[r.size,...r.values].forEach(v=>tr.append(node('td',v || '—')));}
    wrap.append(t);return wrap;
  }
  function invalidateText(item, preview){
    invalidate();preview.replaceChildren();
    try{preview.append(table(parse(item)));}catch(e){preview.append(node('small',e.message));}
  }
  function choice(title, options, current, change){
    const l=node('label',title),s=node('select');
    for(const [value,text] of options){const o=node('option',text);o.value=value;s.append(o);}
    s.value=current || '';s.onchange=()=>{change(s.value);invalidate();};l.append(s);return l;
  }
  function productView(p){
    const box=node('div',undefined,'batch-product');
    if(p.image && (url(p.image) || /^\/[^/]/.test(p.image))){const im=node('img');im.loading='lazy';im.src=p.image;im.alt='صورة المنتج';box.append(im);}
    
    box.append(node('strong',label(p)));return box;
  }
  function picker(item){
    const d=node('details'),s=node('summary',item.product?'تغيير المنتج':'تحديد المنتج يدويًا');
    const input=node('input');input.type='search';input.placeholder='اسم المنتج أو SKU';input.setAttribute('aria-label','بحث المنتج للصورة '+item.name);
    const res=node('div');const search=button('بحث',()=>run(async()=>{
      const q=input.value.trim();if(!q){res.textContent='اكتب اسمًا أو كودًا للبحث.';return;}
      const hits=await lookup(q,false);res.replaceChildren();
      if(!hits.length)res.textContent='لا توجد نتيجة في كتالوج المتجر.';
      for(const p of hits)res.append(button(label(p)+' · '+p.product_id,()=>{item.product=p;item.manual=true;item.matchNote='اختيار يدوي';invalidate();renderItems();}));
    }));
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();search.click();}};
    d.append(s,input,search,res);return d;
  }
  function itemCard(item){
    const card=node('article',undefined,'batch-entry'),src=node('div'),content=node('div');
    const image=node('img');image.loading='lazy';image.src=item.url;image.alt='جدول المقاسات الأصلي '+item.name;
    const link=node('a');link.href=item.url;link.target='_blank';link.rel='noopener';link.append(image,node('small','فتح الصورة الأصلية'));
    src.append(link);content.append(node('h4',item.name));
    if(item.product)content.append(productView(item.product));
    content.append(node('small',item.matchNote || 'بانتظار القراءة والمطابقة.'));
    if(item.done){content.append(node('strong',item.done));card.append(src,content);return card;}
    content.append(picker(item));
    if(item.error)content.append(node('p',item.error,'batch-issue'));
    if(item.scan?.warnings?.length)content.append(node('small',item.scan.warnings.join(' '),'batch-issue'));
    let mismatch=null;
    if(item.sizeHint){
      content.append(node('small','المقاس في اسم الملف: '+item.sizeHint));
      const check=node('input');check.type='checkbox';check.checked=!!item.confirmSize;
      check.onchange=()=>{item.confirmSize=check.checked;invalidate();};
      mismatch=node('label');
      mismatch.append(check,document.createTextNode('عند اختلاف اسم الملف، أعتمد المقاسات الظاهرة في الجدول'));
      content.append(mismatch);
    }
    const meta=node('div',undefined,'batch-meta');
    meta.append(choice('الوحدة',[['','حدّد الوحدة'],['cm','سم'],['in','إنش']],item.unit,v=>item.unit=v),
      choice('نوع القياسات',[['','حدّد النوع'],['garment','القطعة'],['body','الجسم']],item.type,v=>item.type=v));
    const preview=node('div');
    if(item.text)try{preview.append(table(parse(item)));}catch(e){preview.append(node('small',e.message));}
    const edit=node('details'), editTitle=node('summary',item.text?'تعديل الأرقام':'إدخال القياسات يدويًا');
    const help=node('label','الصق من الشيت، أو افصل الأعمدة بفاصلة. أول عمود للمقاس.');const area=node('textarea');
    area.rows=4;area.value=item.text;area.placeholder='المقاس,الصدر,الخصر\nS,88,70';help.append(area);
    function updateSizeNotice(){
      if(!mismatch)return;
      const rows=SizeGuideImport.parseRows(item.text).slice(1);
      mismatch.hidden=!rows.length || (rows.length===1 && same(rows[0][0],item.sizeHint));
    }
    updateSizeNotice();
    area.oninput=()=>{item.text=area.value;item.edited=true;item.confirmSize=false;
      if(mismatch)mismatch.querySelector('input').checked=false;
      updateSizeNotice();invalidateText(item,preview);
    };
    edit.append(editTitle,help);
    const remove=button('إزالة الصورة',()=>{
      if(item.url.startsWith('blob:'))URL.revokeObjectURL(item.url);
      items.splice(items.indexOf(item),1);invalidate();renderItems();
    });
    content.append(meta,preview,edit,remove);card.append(src,content);return card;
  }
  function renderCodes(){
    const ul=el('batchCodeList');ul.replaceChildren();
    for(const [code,hits] of expected){
      const p=hits.length===1?hits[0]:null;
      const linked=p && items.some(i=>String(i.product?.product_id)===String(p.product_id));
      ul.append(node('li',code+' · '+(p? p.title+' · '+(linked?'له صورة في الدفعة':'بانتظار صورة')+' · '+(p.is_published?'جدول منشور':p.has_guide?'له مسودة':'بلا جدول'):hits.length?'الكود مكرر':'لم يوجد في الكتالوج')));
    }
  }
  function renderItems(){
    el('batchWork').hidden=!items.length;
    el('batchItems').replaceChildren(...items.map(itemCard));renderCodes();
  }
  function add(entries){
    invalidate();
    for(const entry of entries)items.push({...entry,text:'',unit:'',type:'',product:null,matchNote:'',error:'',done:''});
    renderItems();message('أُضيفت الصور. اضغط قراءة الصور ومطابقة المنتجات للمتابعة.');
  }
  async function readImages(){
    invalidate();let errors=0;
    for(const [idx,item] of items.entries()){
      checkStore();if(item.done)continue;
      item.error='';message('معالجة الصورة '+(idx+1)+' من '+items.length+' · '+item.name);
      if(!item.scan && !item.edited){
        try{
          item.scan=item.example || await request('size-guide-ai-import'+qs(),post('POST',{image:await SizeGuideImport.imageToDataUrl(item.file)}));
          if(!item.scan?.columns?.length || !item.scan?.rows?.length)throw Error('لم تُرجع القراءة جدولًا صالحًا.');
        }catch(e){item.scan=null;item.error=e.message;errors++;}
      }
      try{await match(item);}catch(e){item.matchNote='تعذرت مطابقة المنتج. '+e.message;errors++;}
      if(item.scan && !item.edited && !item.text){
        item.text=toText(item.scan,item.sizeHint);
        item.unit ||= item.scan.unit || '';item.type ||= item.scan.measurement_type || '';
      }
    }
    checkStore();renderItems();message(errors?'انتهت المحاولة. راجع ملاحظات الصور أو أدخل القياسات يدويًا.':'اكتملت المطابقة. راجع الصور والوحدات، ثم اضغط «مراجعة الجداول».');
  }
  function merge(entries){
    const first=entries[0],grid=parse(first),columns=grid.columns.map(c=>({...c})),rows=[],seen=new Set();
    if(!first.unit || !first.type)throw Error('حدّد الوحدة ونوع القياسات لكل صورة.');
    for(const item of entries){
      if(item.unit!==first.unit || item.type!==first.type)throw Error('تختلف الوحدة أو نوع القياس بين صور المنتج. راجع المصدر والقيم قبل الدمج.');
      const part=parse(item);
      if(item.sizeHint && !item.confirmSize && (part.rows.length!==1 || !same(part.rows[0].size,item.sizeHint)))
        throw Error('المقاس في اسم '+item.name+' يختلف عن صفوف الصورة. صحّحه أو أكّد استخدام المقاسات المقروءة.');
      const order=columns.map(c=>part.columns.findIndex(o=>same(c.label,o.label)));
      if(part.columns.length!==columns.length || order.includes(-1))throw Error('عناوين الأعمدة مختلفة بين صور المنتج. وحّدها قبل الدمج.');
      for(const r of part.rows){
        if(!r.size || seen.has(norm(r.size)))throw Error('يوجد مقاس فارغ أو مكرر. صحّح الصفوف أو أزل الصورة المكررة.');
        seen.add(norm(r.size));rows.push({size:r.size,values:order.map(i=>r.values[i])});
      }
      order.forEach((src,dest)=>{if(part.columns[src].kind==='text')columns[dest].kind='text';});
    }
    if(rows.length>30)throw Error('يزيد الجدول المجمّع عن 30 مقاسًا.');
    return {columns,rows,unit:first.unit,measurement_type:first.type};
  }
  function buildGuide(record,grid,entries){
    const prior=record.guide, base=prior || fresh(undefined,entries[0].scan?.category || 'general');
    if(prior?.body_table && (prior.unit!==grid.unit || prior.measurement_type!==grid.measurement_type))
      throw Error('لهذا المنتج جدول جسم إضافي. يلزم تعديل الوحدة أو نوع القياس من محرر المنتج.');
    const sameOrder=prior && prior.rows.length===grid.rows.length && prior.columns.length===grid.columns.length &&
      prior.rows.every((r,i)=>same(r.size,grid.rows[i].size)) && prior.columns.every((c,i)=>same(c.label,grid.columns[i].label));
    return {...base,...grid,cell_styles:sameOrder?base.cell_styles || []:[],col_widths:sameOrder?base.col_widths || []:[]};
  }
  async function prepare(){
    invalidate();const active=items.filter(i=>!i.done);
    if(!active.length){message('أضف صورًا جديدة للمراجعة.');return;}
    if(active.some(i=>!i.product || !i.text.trim())){
      message('كل صورة تحتاج منتجًا وجدولًا. أكمل الصور المعلّقة أو أزلها من هذه الدفعة.');return;
    }
    const byProduct=new Map();
    for(const i of active){const id=String(i.product.product_id);if(!byProduct.has(id))byProduct.set(id,[]);byProduct.get(id).push(i);}
    for(const [id,entries] of byProduct){
      const g={id,entries,approved:false,product:entries[0].product};
      try{
        if(items.some(i=>i.done && String(i.product.product_id)===id))throw Error('تم حفظ هذا المنتج في الدفعة. ابدأ دفعة جديدة لإعادة تعديله.');
        const grid=merge(entries),record=await request(guidePath(id));
        if(record.library)throw Error('مرتبط بجدول مشترك. عدّله من مكتبة الجداول أو افصل الربط من محرر المنتج.');
        g.version=record.version;g.existing=!!record.guide;g.guide=buildGuide(record,grid,entries);
      }catch(e){g.error=e.message;}
      checkStore();groups.push(g);
    }
    renderGroups();
    message('راجع كل جدول مجمّع وحدّد الجداول التي تعتمدها.');
    el('batchReviewBox').scrollIntoView?.({block:'start'});
  }
  function renderGroups(){
    const host=el('batchGroups');host.replaceChildren();el('batchReviewBox').hidden=!groups.length;
    for(const g of groups){
      const box=node('section',undefined,'batch-group');
      box.append(productView(g.product),node('small',g.entries.map(i=>i.name).join(' · ')));
      if(g.guide){
        box.append(node('small',(g.guide.measurement_type==='body'?'قياسات الجسم':'قياسات القطعة')+' · '+(g.guide.unit==='cm'?'سم':'إنش')),table(g.guide));
        if(g.existing)box.append(node('small','يوجد جدول لهذا المنتج. ستستبدل الدفعة بيانات المقاسات الأساسية عند الحفظ.','batch-issue'));
      }
      if(g.error)box.append(node('p',g.error,'batch-issue'));
      if(g.done)box.append(node('strong',g.done));
      if(g.guide && !g.done && !g.blocked){
        const check=node('input');check.type='checkbox';check.checked=g.approved;
        check.onchange=()=>{g.approved=check.checked;updateActions();};
        const l=node('label');l.append(check,document.createTextNode('راجعت المنتج والقياسات وأعتمد هذا الجدول'));box.append(l);
      }
      host.append(box);
    }
    updateActions();
  }
  function updateActions(){
    const any=groups.some(g=>g.approved && !g.done && !g.blocked);
    el('batchDraft').disabled=!any;el('batchPublish').disabled=!any;
  }
  async function saveGroups(action){
    const chosen=groups.filter(g=>g.approved && !g.done && !g.blocked);
    if(!chosen.length)return;
    const publish=action==='publish';
    if(publish && !await confirmAction('نشر '+chosen.length+' من جداول المقاسات المعتمدة للعملاء؟'))return;
    let saved=0;
    for(const g of chosen){
      message('جارٍ حفظ '+label(g.product));g.error='';
      try{
        await request(guidePath(g.id),post('PUT',{version:g.version,guide:g.guide,action}));
        g.done=publish?'منشور':'حُفظ كمسودة';g.approved=false;
        for(const i of g.entries)i.done=g.done;
        saved++;
      }catch(e){g.error=e.message+' · أعد مراجعة الجدول قبل المحاولة مجددًا.';g.blocked=true;g.approved=false;}
    }
    checkStore();renderItems();renderGroups();message('تم '+(publish?'نشر ':'حفظ ')+saved+' من '+chosen.length+'.'+(saved<chosen.length?' راجع ملاحظات الجداول المتبقية.':''));
    if(saved){
      try{guideIndex=await api('size-guides'+qs());await loadProducts();}
      catch{/* Refresh the catalog next time the merchant opens it. */}
    }
  }
  el('batchFiles').onchange=e=>{
    const entries=[], rejected=[];
    for(const f of e.target.files){
      if(!/^image\/(png|jpeg|webp)$/.test(f.type)){rejected.push(f.name);continue;}
      if(items.some(i=>i.file?.name===f.name && i.file?.size===f.size && i.file?.lastModified===f.lastModified))continue;
      entries.push({name:f.name,file:f,url:URL.createObjectURL(f)});
    }
    e.target.value='';if(entries.length)add(entries);if(rejected.length)message('صيغة غير مدعومة: '+rejected.join('، '));
  };
  el('batchRead').onclick=()=>run(readImages);el('batchReview').onclick=()=>run(prepare);
  el('batchDraft').onclick=()=>run(()=>saveGroups('draft'));el('batchPublish').onclick=()=>run(()=>saveGroups('publish'));
  el('batchReset').onclick=async()=>{if(await confirmAction('تفريغ قائمة الصور والمراجعة لهذه الدفعة؟'))reset();};
  el('batchCodes').oninput=()=>{codeInput=el('batchCodes').value;expected.clear();renderCodes();};
  el('batchCheckCodes').onclick=()=>run(async()=>{
    const codes=[...new Set(codeInput.split(/[\n\t,،;]+/).map(s=>s.trim()).filter(Boolean))];
    if(!codes.length){message('الصق أكواد المنتجات أولًا.');return;}
    expected.clear();for(const code of codes)expected.set(code,await exactHits(code));
    renderCodes();message('تم التحقق من قائمة الأكواد.');
  });
  window.SizeGuideBatch={
    busy:()=>!!operation, pending:()=>items.some(i=>!i.done) || !!operation,
    reset,async leaveStore(){if((items.some(i=>!i.done) || codeInput.trim()) && !await confirmAction('مغادرة الدفعة وتفريغ الصور غير المحفوظة؟'))return false;reset();return true;}
  };
  if(el('batchExample'))window.SizeGuideBatch.addExamples=examples=>{if(!operation && !items.length)add(examples);};
})();
