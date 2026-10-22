'use strict';
const $=s=>document.querySelector(s);
let stores=[],merchant='',page=1,pages=1,poll,timer,guideIndex=[],editing=null,guide=null,dirty=false,version=0,published=false,view='catalog',saving=false;
// An editor session is either one product's guide or a shared ("library") guide that many products follow.
let mode='product',libraryId=null,libraryName='',linkedTo=null,libraries=[],libraryProducts=[],pending=null,aiBlob=null,aiChecked=false;
const selected=new Set();
let savedStyles=[],savedPhrases=[],styleSnapshot=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=s=>{try{let u=new URL(s);return u.protocol==='https:'?u.href:''}catch{return ''}};
const date=s=>s?new Date(s).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'}):'لم تبدأ بعد';
const labels={sale:'معروض للبيع',hidden:'مخفي',out:'نفدت الكمية','out-and-notify':'نفدت مع التنبيه',queued:'في الانتظار',running:'قيد التنفيذ',success:'مكتملة',failed:'لم تكتمل'};
const Catalog=window.SizeGuideCatalog,UIX=window.SizeGuideUI,Import=window.SizeGuideImport;
const styleDefaults=Catalog?.styleDefaults||{category:'general',theme:'classic',table_style:'zebra',density:'comfortable',corners:'soft',depth3d:true,header_icon:true};
const withDefaults=g=>({...JSON.parse(JSON.stringify(styleDefaults)),...g});
const legacyTemplates={dresses:['محيط الصدر','محيط الخصر','محيط الأرداف','طول القطعة']};
const qs=()=>'?'+new URLSearchParams({merchant});
const mk=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
function fresh(templateId,category='women'){
  if(Catalog)return Catalog.fresh(templateId,category);
  const cols=legacyTemplates.dresses;
  return {...withDefaults({}),title:'دليل المقاسات',button_label:'دليل المقاسات',unit:'cm',measurement_type:'garment',columns:cols.map(label=>({label,kind:'measurement'})),rows:['S','M','L','XL'].map(size=>({size,values:cols.map(()=> '')})),notes:'',instructions:'',color:'#177e65'};
}
function toast(s){if(window.SizeGuideEmbedded?.toast(s))return;$('#toast').textContent=s;$('#toast').classList.remove('hidden');setTimeout(()=>$('#toast').classList.add('hidden'),7000)}
async function api(path,options={}){if(window.SizeGuideEmbedded)return window.SizeGuideEmbedded.request(path,options);let r=await fetch('/dashboard-api/'+path,{...options,headers:{'Content-Type':'application/json','X-Dashboard-Request':'1',...options.headers},cache:'no-store'});let d=await r.json();if(!r.ok){if(r.status===401&&!path.startsWith('login')){clearInterval(poll);poll=null;$('#app').classList.add('hidden');$('#login').classList.remove('hidden')}let detail=typeof d.detail==='string'?d.detail:Array.isArray(d.detail)?'راجعي حقول الجدول: '+d.detail.map(x=>x.msg).join('، '):'تعذر تنفيذ الطلب.';throw Error(detail)}return d}
async function confirmAction(message){return window.SizeGuideEmbedded?window.SizeGuideEmbedded.confirm(message):window.confirm(message)}
async function mayLeave(){if(saving||window.SizeGuideSettings?.isBusy()){toast('انتظر اكتمال العملية أولًا.');return false}if(!dirty&&!window.SizeGuideSettings?.isDirty())return true;const confirmed=await confirmAction('لديك تعديلات غير محفوظة. هل تريد المغادرة دون حفظها؟');if(confirmed)window.SizeGuideSettings?.discard();return confirmed}
function show(tab){
  view=tab;if(tab==='buttonSettings')window.SizeGuideSettings?.load();
  if(tab==='quick')window.SizeGuideQuick?.open();if(tab==='library')loadLibrary().catch(e=>toast(e.message));if(tab==='stats')loadStats().catch(e=>toast(e.message));
  window.SizeGuideEmbedded?.navigate(tab);
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('hidden',t.id!==tab));
  document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===(tab==='editor'?(mode==='library'?'library':'catalog'):tab)));
}
function changed(){dirty=true;$('#editState').textContent=(published?'يوجد جدول منشور · ':'مسودة · ')+'تعديلات غير محفوظة';syncColors();preview()}
function preview(){if(guide)window.SizeGuideUI.preview($('#guidePreview'),guide,editing?.title||'')}

/* ---------- store, catalog and bulk actions ---------- */
async function boot(){
  await bootStores();
  // A dedicated Salla page can open straight on one tool: ...?view=quick
  const wanted=new URLSearchParams(location.search).get('view');if(['quick','library','stats'].includes(wanted))show(wanted);
}
async function bootStores(){stores=await api('stores');$('#store').innerHTML=stores.map(s=>`<option value="${esc(s.merchant_id)}">${esc(s.store_name===s.merchant_id?'متجر سلة • '+s.merchant_id:s.store_name)}</option>`).join('');$('#login').classList.add('hidden');$('#app').classList.remove('hidden');if(stores.length){merchant=$('#store').value;await load()}else{$('#sync').disabled=true;$('#empty').classList.remove('hidden');$('#empty').textContent='لا يوجد متجر مربوط. أعد إرسال رمز الوصول من تطبيق سلة.'}}
async function load(){let s=stores.find(s=>s.merchant_id===merchant);if(!s)return;$('#count').textContent=Number(s.product_count).toLocaleString('ar');$('#connection').textContent=s.connected?'متصل بسلة':'غير متصل';$('#merchant').textContent='معرّف المتجر: '+merchant;$('#last').textContent=date(s.last_sync);guideIndex=await api('size-guides'+qs());await Promise.all([loadLibraryIndex(),loadPresets(),loadProducts(),loadJobs(),window.SizeGuideSettings?.load()])}
function stateOf(g){
  if(!g)return ['بدون جدول',false];
  const base=g.is_published?(g.has_changes?'منشور + تعديلات مسودة':'منشور'):'مسودة';
  return [g.library_id?'مرتبط · '+(g.library_name||'جدول مشترك')+(g.is_published?'':' (غير منشور)'):base,!g.is_published];
}
async function loadProducts(){
  let current=merchant;let d=await api('products?'+new URLSearchParams({merchant,q:$('#filter').value,status:$('#status').value,page}));if(current!==merchant)return;pages=d.pages;
  $('#rows').innerHTML=d.items.map(p=>{
    const g=guideIndex.find(g=>g.product_id===p.product_id),[state,draft]=stateOf(g);
    return `<tr><td class="select-col"><input type="checkbox" data-select="${esc(p.product_id)}" ${selected.has(p.product_id)?'checked':''} aria-label="تحديد ${esc(p.title)}"></td><td><div class="product">${url(p.image)?`<img loading="lazy" src="${esc(url(p.image))}" alt="">`:'<div class="placeholder"></div>'}<div>${url(p.url)?`<a href="${esc(url(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.title)} ↗</a>`:esc(p.title)}<small>#${esc(p.product_id)}</small></div></div></td><td dir="ltr">${esc(p.sku)||'—'}</td><td>${p.price===null?'—':Number(p.price).toLocaleString('ar',{maximumFractionDigits:2})} ${esc(p.currency)}</td><td>${p.quantity===null?'—':esc(p.quantity)}</td><td><span class="tag ${p.status!=='sale'?'warn':''}">${esc(labels[p.status]||p.status||'—')}</span></td><td><span class="tag ${draft?'badgeDraft':''}">${esc(state)}</span></td><td><div class="row-actions"><button class="secondary" data-edit="${esc(p.product_id)}">${g?(g.library_id?'عرض الجدول':'تعديل الجدول'):'إضافة مقاسات'}</button><button class="secondary" data-edit-data="${esc(p.product_id)}" data-find="${esc(p.sku||p.title)}">تعديل البيانات</button></div></td></tr>`;
  }).join('');
  $('#empty').classList.toggle('hidden',d.items.length>0);$('#empty').textContent=Number(stores.find(s=>s.merchant_id===merchant).product_count)?'لا توجد منتجات تطابق البحث.':'اضغط «مزامنة المنتجات» ثم أضف جدولًا للمنتج المطلوب.';
  $('#pageLabel').textContent=`${page} / ${pages} · ${d.total} منتج`;$('#prev').disabled=page<=1;$('#next').disabled=page>=pages;
  $('#rows').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openEditor(b.dataset.edit).catch(e=>toast(e.message)));
  $('#rows').querySelectorAll('[data-edit-data]').forEach(b=>b.onclick=()=>window.SizeGuideQuick?.focus(b.dataset.editData,b.dataset.find));
  $('#rows').querySelectorAll('[data-select]').forEach(box=>box.onchange=()=>{box.checked?selected.add(box.dataset.select):selected.delete(box.dataset.select);updateBulk()});
  updateBulk();
}
function updateBulk(){
  const boxes=[...document.querySelectorAll('#rows [data-select]')],on=boxes.filter(b=>b.checked).length;
  $('#bulkBar').classList.toggle('hidden',selected.size===0);$('#bulkCount').textContent=selected.size.toLocaleString('ar')+' منتج محدد';
  $('#selectAll').checked=boxes.length>0&&on===boxes.length;$('#selectAll').indeterminate=on>0&&on<boxes.length;
  $('#bulkSource').innerHTML='<option value="">اختر منتجًا له جدول…</option>'+guideIndex.map(g=>`<option value="${esc(g.product_id)}">${esc(g.title)}${g.sku?' • '+esc(g.sku):''}</option>`).join('');
  $('#bulkLibrary').innerHTML='<option value="">اختر جدولًا مشتركًا…</option>'+libraries.map(l=>`<option value="${esc(l.library_id)}">${esc(l.name)}</option>`).join('');
}
async function runBulk(path,body,message,summary){
  if(selected.size===0)return;if(message&&!(await confirmAction(message)))return;
  try{
    const data=await api(path+qs(),{method:'POST',body:JSON.stringify({...body,product_ids:[...selected]})});
    selected.clear();guideIndex=await api('size-guides'+qs());await Promise.all([loadProducts(),loadLibraryIndex()]);toast(summary(data));
  }catch(e){toast(e.message)}
}
const skippedNote=(list,hint)=>list.length?` · تخطي ${list.length}${hint?' ('+hint+')':''}`:'';
$('#selectAll').onchange=()=>{document.querySelectorAll('#rows [data-select]').forEach(b=>{b.checked=$('#selectAll').checked;b.checked?selected.add(b.dataset.select):selected.delete(b.dataset.select)});updateBulk()};
$('#bulkClear').onclick=()=>{selected.clear();document.querySelectorAll('#rows [data-select]').forEach(b=>b.checked=false);updateBulk()};
$('#bulkCopy').onclick=()=>{const source=$('#bulkSource').value;if(!source)return toast('اختر المنتج المصدر.');const overwrite=$('#bulkOverwrite').checked,publish=$('#bulkPublishCopy').checked;
  runBulk('size-guides/copy',{source_product_id:source,overwrite,publish},`نسخ الجدول إلى ${selected.size} منتج كنسخ مستقلة${publish?' ونشرها للعملاء':''}${overwrite?'، مع استبدال الجداول الموجودة':''}؟`,d=>`تم نسخ الجدول إلى ${d.copied.length} منتج`+skippedNote(d.skipped,overwrite?'':'لهم جدول؛ فعّل الاستبدال لتغييرها'))};
$('#bulkLink').onclick=()=>{const lib=$('#bulkLibrary').value;if(!lib)return toast('اختر الجدول المشترك.');
  runBulk('size-library/'+lib+'/link',{},`ربط ${selected.size} منتج بهذا الجدول المشترك؟ سيظهر لهم جدوله بدل جدولهم الحالي.`,d=>`تم ربط ${d.linked.length} منتج`+skippedNote(d.skipped))};
$('#bulkPublish').onclick=()=>runBulk('size-guides/bulk',{action:'publish'},`نشر مسودات المنتجات المحددة ليراها العملاء؟`,d=>`نُشر ${d.updated.length} جدول`+skippedNote(d.skipped,d.skipped[0]?.reason));
$('#bulkUnpublish').onclick=()=>runBulk('size-guides/bulk',{action:'unpublish'},`إيقاف ظهور جداول المنتجات المحددة مع الاحتفاظ بالمسودات؟`,d=>`أُوقف ظهور ${d.updated.length} جدول`+skippedNote(d.skipped,d.skipped[0]?.reason));
$('#bulkUnlink').onclick=()=>runBulk('size-guides/unlink',{},`فصل المنتجات المحددة عن الجدول المشترك؟ سيحتفظ كل منتج بنسخة مستقلة.`,d=>`تم فصل ${d.unlinked.length} منتج`+skippedNote(d.skipped,'غير مرتبطة'));
async function loadJobs(){let data=await api('jobs?'+new URLSearchParams({merchant}));$('#jobs').innerHTML=data.map(j=>`<tr><td>${date(j.started_at)}</td><td><span class="tag ${j.state==='failed'?'warn':''}">${esc(labels[j.state])}</span></td><td>${j.processed}${j.total!==null?' / '+j.total:''}</td><td style="white-space:normal;min-width:220px">${esc(j.message||'جارٍ جلب البيانات…')}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">لم تُنفّذ أي مزامنة بعد.</td></tr>';let active=data.find(j=>['queued','running'].includes(j.state)&&Date.now()-new Date(j.started_at)<3600000);$('#sync').disabled=!!active;$('#syncState').classList.toggle('hidden',!active);if(active){$('#syncState').textContent=`المزامنة جارية · ${active.processed} منتج${active.total?' من '+active.total:''}`;if(!poll)poll=setInterval(()=>loadJobs().catch(e=>toast(e.message)),4000)}else if(poll){clearInterval(poll);poll=null;stores=await api('stores');await load();toast('انتهت المزامنة. راجع السجل لمعرفة النتيجة.')}}

/* ---------- library and statistics tabs ---------- */
async function loadLibraryIndex(){libraries=await api('size-library'+qs());if(!Array.isArray(libraries))libraries=[];updateBulk()}
async function loadLibrary(){
  await loadLibraryIndex();const box=$('#libraryList');box.replaceChildren();$('#libraryEmpty').classList.toggle('hidden',libraries.length>0);
  for(const l of libraries){
    const card=mk('article','lib-card'),icon=mk('div','lib-emblem'),info=mk('div','lib-info'),chips=mk('div','chips'),actions=mk('div','bulk-buttons');
    if(UIX?.emblem){icon.style.color=Catalog?.defaults[l.category]?.color||'#177e65';icon.append(UIX.emblem(l.category||'general'))}
    chips.append(mk('span','tag '+(l.is_published?'':'badgeDraft'),l.is_published?(l.has_changes?'منشور + تعديلات مسودة':'منشور'):'مسودة'),mk('span','tag',Number(l.product_count).toLocaleString('ar')+' منتج'));
    info.append(mk('h3','',l.name),chips);const open=mk('button','','تعديل');open.type='button';open.onclick=()=>openLibrary(l.library_id).catch(e=>toast(e.message));actions.append(open);card.append(icon,info,actions);box.append(card);
  }
}
async function loadStats(){
  const days=Number($('#statsDays').value)||30,d=await api('size-guide-stats?'+new URLSearchParams({merchant,days}));
  const cards=[['فتح الجدول',d.opens],['استخدام «اعرف مقاسك»',d.calcs],['جداول منشورة',d.published_guides],['متوسط الفتح اليومي',(d.opens/days).toFixed(1)]];
  $('#statsCards').replaceChildren(...cards.map(([label,value])=>{const c=mk('article','card');c.append(mk('label','',label),mk('b','',Number(value).toLocaleString('ar')));return c}));
  const byDay=new Map(d.daily.map(x=>[String(x.day).slice(0,10),x.opens])),chart=$('#statsChart'),top=Math.max(1,...byDay.values());chart.replaceChildren();
  for(let i=days-1;i>=0;i--){const day=new Date(Date.now()-i*864e5).toISOString().slice(0,10),n=byDay.get(day)||0,bar=mk('span','bar');bar.style.height=Math.max(n?6:2,Math.round(n/top*100))+'%';bar.title=day+': '+n;chart.append(bar)}
  chart.setAttribute('aria-label',`رسم بياني: ${d.opens} فتحة للجدول خلال آخر ${days} يومًا`);
  $('#statsTop').innerHTML=d.top.map(t=>`<tr><td>${esc(t.title)}</td><td>${t.opens}</td><td>${t.calcs}</td></tr>`).join('')||'<tr><td colspan="3" class="empty">—</td></tr>';
  $('#statsEmpty').classList.toggle('hidden',d.opens+d.calcs>0);
}
$('#statsDays').onchange=()=>loadStats().catch(e=>toast(e.message));

/* ---------- editor: open, fill, save ---------- */
async function openEditor(id){
  if(!(await mayLeave()))return;const d=await api('size-guides/'+encodeURIComponent(id)+qs());
  mode='product';libraryId=null;libraryProducts=[];editing=d.product;linkedTo=d.library;guide=d.guide?withDefaults(d.guide):fresh();version=d.version;published=d.is_published;dirty=false;pending=null;
  fill();show('editor');$('#editor').scrollIntoView({behavior:'smooth',block:'start'});
}
async function openLibrary(id){
  if(!(await mayLeave()))return;mode='library';linkedTo=null;pending=null;
  if(id){const d=await api('size-library/'+id+qs());libraryId=id;libraryName=d.name;guide=withDefaults(d.guide);version=d.version;published=d.is_published;libraryProducts=d.products}
  else{libraryId=null;libraryName='';guide=fresh();version=0;published=false;libraryProducts=[]}
  editing={title:libraryName||'جدول مشترك جديد'};dirty=false;fill();show('editor');$('#editor').scrollIntoView({behavior:'smooth',block:'start'});
}
function applyMode(){
  const library=mode==='library';
  document.querySelectorAll('#editor .only-library').forEach(n=>n.classList.toggle('hidden',!library));document.querySelectorAll('#editor .only-product').forEach(n=>n.classList.toggle('hidden',library));
  $('#editorKind').textContent=library?'جدول مشترك':'تحرير دليل المنتج';$('#deleteLibrary').classList.toggle('hidden',!library||!libraryId);
  $('#editFields').disabled=!!linkedTo;$('#linkedBanner').classList.toggle('hidden',!linkedTo);$('#linkedName').textContent=linkedTo?.name||'';
  $('#saveNote').textContent=library?'نشر الجدول المشترك يحدّث كل المنتجات المرتبطة به فورًا؛ حفظ المسودة لا يغيّر ما يراه العملاء.':'حفظ المسودة لا يغيّر النسخة المنشورة. الزر يظهر فقط لمنتج له جدول منشور.';
  $('#libraryName').value=libraryName;$('#linkHint').textContent=libraryId?'ابحث عن المنتجات التي تريد أن تتبع هذا الجدول.':'احفظ الجدول أولًا ثم اربط المنتجات.';
  $('#linkSearch').disabled=!libraryId;$('#linkSelected').disabled=!libraryId;
}
function renderLibraryProducts(){
  const box=$('#libraryProducts');box.replaceChildren();if(mode!=='library')return;
  box.append(mk('strong','',libraryProducts.length?`المنتجات المرتبطة (${libraryProducts.length})`:'لا توجد منتجات مرتبطة بعد.'));
  for(const p of libraryProducts){
    const row=mk('div','link-row'),text=mk('span','',p.title+(p.sku?' • '+p.sku:'')),remove=mk('button','secondary small','فصل');remove.type='button';remove.setAttribute('aria-label','فصل '+p.title);
    remove.onclick=async()=>{if(!(await confirmAction('فصل هذا المنتج؟ سيحتفظ بنسخة مستقلة من الجدول الحالي.')))return;try{await api('size-guides/unlink'+qs(),{method:'POST',body:JSON.stringify({product_ids:[p.product_id]})});await reloadLibraryProducts();toast('تم فصل المنتج.')}catch(e){toast(e.message)}};
    row.append(text,remove);box.append(row);
  }
}
async function reloadLibraryProducts(){if(!libraryId)return;const d=await api('size-library/'+libraryId+qs());libraryProducts=d.products;guideIndex=await api('size-guides'+qs());renderLibraryProducts();renderLinkResults()}
let linkCandidates=[];
async function searchLinkable(){
  if(!libraryId)return;const d=await api('products?'+new URLSearchParams({merchant,q:$('#linkSearch').value,page:1}));
  linkCandidates=d.items.filter(p=>!libraryProducts.some(x=>x.product_id===p.product_id));renderLinkResults();
}
function renderLinkResults(){
  const box=$('#linkResults');box.replaceChildren();if(!libraryId)return;
  const keep=linkCandidates.filter(p=>!libraryProducts.some(x=>x.product_id===p.product_id));
  if(!keep.length){box.append(mk('p','micro','ابحث لتظهر المنتجات القابلة للربط.'));return}
  for(const p of keep){const label=mk('label','check'),box1=mk('input');box1.type='checkbox';box1.value=p.product_id;label.append(box1,document.createTextNode(' '+p.title+(p.sku?' • '+p.sku:'')));box.append(label)}
}
$('#linkSearch').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>searchLinkable().catch(e=>toast(e.message)),300)};
$('#linkPicker').addEventListener('toggle',()=>{if($('#linkPicker').open&&libraryId)searchLinkable().catch(e=>toast(e.message))});
$('#linkSelected').onclick=async()=>{
  const ids=[...document.querySelectorAll('#linkResults input:checked')].map(i=>i.value);if(!ids.length)return toast('حدد منتجًا واحدًا على الأقل.');
  if(published&&!(await confirmAction('سيظهر هذا الجدول المنشور فورًا لعملاء المنتجات المحددة. هل تتابع؟')))return;
  try{const d=await api('size-library/'+libraryId+'/link'+qs(),{method:'POST',body:JSON.stringify({product_ids:ids})});await reloadLibraryProducts();toast(`تم ربط ${d.linked.length} منتج`+skippedNote(d.skipped))}catch(e){toast(e.message)}
};
$('#libraryName').oninput=()=>{libraryName=$('#libraryName').value;if(editing)editing.title=libraryName||'جدول مشترك جديد';$('#editorTitle').textContent=editing.title;dirty=true;$('#editState').textContent=(published?'يوجد جدول منشور · ':'مسودة · ')+'تعديلات غير محفوظة'};
$('#openLibraryFromProduct').onclick=()=>openLibrary(linkedTo.library_id).catch(e=>toast(e.message));
$('#unlinkThis').onclick=async()=>{
  if(!linkedTo||!(await confirmAction('فصل هذا المنتج؟ سيحتفظ بنسخة مستقلة من الجدول المشترك الحالي ويمكنك تعديلها بحرية.')))return;
  try{await api('size-guides/unlink'+qs(),{method:'POST',body:JSON.stringify({product_ids:[editing.product_id]})});dirty=false;toast('تم فصل المنتج.');await openEditor(editing.product_id)}catch(e){toast(e.message)}
};
$('#newLibrary').onclick=()=>openLibrary(null).catch(e=>toast(e.message));
$('#deleteLibrary').onclick=async()=>{
  if(!libraryId||!(await confirmAction('حذف هذا الجدول المشترك نهائيًا؟ لا يمكن حذفه وهو مرتبط بمنتجات.')))return;
  try{await api('size-library/'+libraryId+qs(),{method:'DELETE'});dirty=false;toast('حُذف الجدول المشترك.');show('library')}catch(e){toast(e.message)}
};
/* ---------- faster data entry: complete a column, paste a block of cells ---------- */
function fillColumn(index){
  const result=Import?.fillSeries(guide.rows.map(r=>r.values[index]));
  if(!result)return toast('اكتب رقمين مختلفين في أول صفين من العمود (مثل 90 ثم 94)، وتأكد أن بقية الخانات فارغة.');
  guide.rows.forEach((r,i)=>r.values[index]=result.values[i]);drawGrid();changed();toast(`تمت تعبئة ${result.filled} خانة بنفس الفرق. راجع الأرقام.`);
}
$('#gridEditor').addEventListener('paste',event=>{
  const target=event.target,text=event.clipboardData?.getData('text')||'';
  if(!guide||!Import||!/[\t\n\r]/.test(text.trim()))return;                       // one value pastes normally
  const rows=Import.parseRows(text),row0=target.dataset.size!==undefined?+target.dataset.size:target.dataset.row!==undefined?+target.dataset.row:-1;
  if(row0<0||(rows.length===1&&rows[0].length===1))return;
  event.preventDefault();const col0=target.dataset.size!==undefined?-1:+target.dataset.cell;let cells=0,dropped=0;
  rows.forEach((line,a)=>{
    const i=row0+a;if(i>=30){dropped+=line.length;return}
    while(guide.rows.length<=i)guide.rows.push({size:'',values:guide.columns.map(()=> '')});
    line.forEach((cell,k)=>{const col=col0+k;if(col===-1)guide.rows[i].size=cell.slice(0,30);else if(col>=0&&col<guide.columns.length)guide.rows[i].values[col]=cell.slice(0,60);else{dropped++;return}cells++});
  });
  drawGrid();changed();toast(`لُصقت ${cells} خانة`+(dropped?` وتُجوهلت ${dropped} خارج حدود الجدول`:'')+'.');
});
/* ---------- looks: ready-made styles, the store's colour, saved designs and phrases ---------- */
async function loadPresets(){
  try{const d=await api('size-presets'+qs());savedStyles=Array.isArray(d?.styles)?d.styles:[];savedPhrases=Array.isArray(d?.phrases)?d.phrases:[]}catch{savedStyles=[];savedPhrases=[]}
}
const styleOf=g=>Object.fromEntries((Catalog?.STYLE_FIELDS||[]).filter(k=>k in g).map(k=>[k,g[k]]));
function miniTable(style){
  const full={...style};if(!/^#[0-9a-fA-F]{6}$/.test(full.color||''))full.color=UIX.themes.find(t=>t.id===full.theme)?.accent||'#177e65';
  const pal=UIX.palette(full),box=mk('div','preset-mini');
  for(const [k,v] of Object.entries({head:pal.headBg,headInk:pal.headInk,alt:pal.alt,line:pal.line,paper:pal.paper,chip:pal.chipBg,chipInk:pal.chipInk,accent:pal.accent}))box.style.setProperty('--m-'+k,v);
  Object.assign(box.dataset,{size:style.size_style||'chip',border:style.border_style||'thin',corners:style.corners||'soft',table:style.table_style||'zebra',head:pal.headStyle});
  const head=mk('div','m-row m-head');head.append(mk('i'),mk('i'),mk('i'));box.append(head);
  for(let r=0;r<3;r++){const row=mk('div','m-row');row.append(mk('b','m-chip'),mk('i'),mk('i'));box.append(row)}
  return box;
}
function renderPresets(){
  if(!UIX?.palette||!Catalog)return;
  const draw=(box,items,saved)=>{
    box.replaceChildren();
    for(const item of items){
      const card=mk('div','preset-card'),pick=mk('button','preset-pick');pick.type='button';pick.title=item.hint||item.name;pick.append(miniTable(item.style),mk('span','',item.name));
      pick.onclick=()=>applyStyle(item.style,item.name);card.append(pick);
      if(saved){const x=mk('button','preset-x','×');x.type='button';x.setAttribute('aria-label','حذف التصميم '+item.name);x.onclick=()=>removePreset(item.preset_id,item.name,'styles');card.append(x)}
      box.append(card);
    }
  };
  draw($('#presetChoices'),Catalog.stylePresets,false);
  draw($('#myPresets'),savedStyles.map(p=>({...p,style:p.style})),true);
  $('#myPresetsTitle').classList.toggle('hidden',savedStyles.length===0);$('#myPresets').classList.toggle('hidden',savedStyles.length===0);
}
function applyStyle(style,label){
  if(!guide)return;styleSnapshot=styleOf(guide);
  const next={...style};if(!/^#[0-9a-fA-F]{6}$/.test(next.color||''))next.color=UIX.themes.find(t=>t.id===next.theme)?.accent||guide.color;
  Object.assign(guide,styleOf(next));$('#guideColor').value=guide.color;syncChoices();changed();$('#undoStyle').classList.remove('hidden');toast('طُبّق النمط: '+label+'. جدولك لم يتغير.');
}
$('#undoStyle').onclick=()=>{if(!styleSnapshot||!guide)return;Object.assign(guide,styleSnapshot);styleSnapshot=null;$('#guideColor').value=guide.color;syncChoices();changed();$('#undoStyle').classList.add('hidden')};
const brandKey=()=>'sg-brand-'+merchant;
function rememberedBrand(){try{return localStorage.getItem(brandKey())||''}catch{return ''}}
$('#applyBrand').onclick=()=>{
  if(!guide)return;const hex=$('#brandColor').value,result=UIX.brandStyle(hex,UIX.palette(guide).paper);if(!result)return toast('اختر لونًا صالحًا.');
  styleSnapshot=styleOf(guide);guide.color=result.color;guide.header_style=result.header_style;for(const k of ['header_bg','header_text','row_alt','size_bg','size_text'])guide[k]='';
  try{localStorage.setItem(brandKey(),hex)}catch{/* optional convenience only */}
  $('#guideColor').value=guide.color;syncChoices();changed();$('#undoStyle').classList.remove('hidden');
  toast(result.adjusted?'عُدِّل اللون قليلًا ليكون مقروءًا على خلفية الجدول.':'طُبّق لون متجرك على الجدول.');
};
$('#savePreset').onclick=async()=>{
  const name=$('#presetName').value.trim();if(!guide)return;if(!name)return toast('اكتب اسمًا لتصميمك أولًا.');
  try{const d=await api('size-presets'+qs(),{method:'POST',body:JSON.stringify({kind:'style',name,style:styleOf(guide)})});savedStyles.push(d);$('#presetName').value='';renderPresets();toast('حُفظ التصميم «'+name+'» ويمكنك تطبيقه على أي جدول.')}catch(e){toast(e.message)}
};
async function removePreset(id,name,kind){
  if(!(await confirmAction('حذف «'+name+'» نهائيًا؟')))return;
  try{await api('size-presets/'+id+qs(),{method:'DELETE'});if(kind==='styles')savedStyles=savedStyles.filter(p=>p.preset_id!==id);else savedPhrases=savedPhrases.filter(p=>p.preset_id!==id);renderPresets();renderPhrases()}catch(e){toast(e.message)}
}
function renderPhrases(){
  const box=$('#phraseChips');box.replaceChildren();if(!guide)return;
  const add=(text,id)=>{
    const chip=mk('span','phrase-chip'),pick=mk('button','phrase-pick',text.length>44?text.slice(0,44)+'…':text);pick.type='button';pick.title=text;pick.onclick=()=>addPhrase(text);chip.append(pick);
    if(id){const x=mk('button','preset-x','×');x.type='button';x.setAttribute('aria-label','حذف الجملة');x.onclick=()=>removePreset(id,text.slice(0,30),'phrases');chip.append(x)}
    box.append(chip);
  };
  for(const text of Catalog?.phrasesFor(guide.category)||[])add(text);for(const p of savedPhrases)add(p.text,p.preset_id);
}
function addPhrase(text){
  const current=$('#notes').value;if(current.includes(text))return toast('هذه الجملة موجودة في الملاحظات.');
  const next=current.trim()?current.replace(/\s+$/,'')+'\n'+text:text;if(next.length>2000)return toast('الملاحظات ستتجاوز 2000 حرف.');
  $('#notes').value=next;guide.notes=next;changed();
}
$('#savePhrase').onclick=async()=>{
  const text=$('#phraseText').value.trim();if(!text)return toast('اكتب الجملة أولًا.');
  try{const d=await api('size-presets'+qs(),{method:'POST',body:JSON.stringify({kind:'phrase',name:text.slice(0,40),text})});savedPhrases.push(d);$('#phraseText').value='';renderPhrases();toast('حُفظت الجملة.')}catch(e){toast(e.message)}
};
function fill(){
  for(const [id,key] of [['guideTitle','title'],['buttonLabel','button_label'],['guideUnit','unit'],['measureType','measurement_type'],['guideColor','color'],['instructions','instructions'],['notes','notes']])$('#'+id).value=guide[key];
  $('#editorTitle').textContent=mode==='library'?(libraryName||'جدول مشترك جديد'):editing.title+(editing.sku?' • '+editing.sku:'');
  $('#editState').textContent=linkedTo?'هذا الجدول يتبع الجدول المشترك؛ التعديل من هناك.':published?'الجدول منشور للعميل؛ حفظ المسودة لا يغيّره.':version?'مسودة محفوظة؛ لا تظهر للعميل.':'جدول جديد؛ لم يُحفظ بعد.';
  $('#unpublish').disabled=!published;
  $('#copyFrom').innerHTML='<option value="">اختر المنتج المصدر…</option>'+guideIndex.filter(g=>g.product_id!==editing.product_id).map(g=>`<option value="${esc(g.product_id)}">${esc(g.title)} ${g.sku?'• '+esc(g.sku):''}</option>`).join('');
  applyMode();fillTemplates();renderThemes();syncChoices();syncAdvanced();styleSnapshot=null;$('#undoStyle').classList.add('hidden');$('#brandColor').value=rememberedBrand()||guide.color;renderPresets();renderPhrases();renderLibraryProducts();renderLinkResults();hidePending();drawGrid();preview();
}
function fillTemplates(){const list=Catalog?Catalog.forCategory(guide.category):[{id:'dresses',name:'فساتين'}];$('#template').innerHTML=list.map(t=>`<option value="${esc(t.id)}">${esc('هيكل '+t.name)}</option>`).join('')}
const recommended=theme=>theme.cats.includes(guide?.category);
function renderThemes(){
  const box=$('#themeChoices');box.replaceChildren();if(!UIX?.themes||!guide)return;
  const first=Catalog?.defaults[guide.category]?.theme,rank=t=>t.id===first?2:recommended(t)?1:0,sorted=[...UIX.themes].sort((a,b)=>rank(b)-rank(a));
  for(const theme of sorted){
    const label=mk('label','theme-card'),radio=mk('input');radio.type='radio';radio.name='guide-theme';radio.value=theme.id;radio.setAttribute('aria-label','ثيم '+theme.name);
    const mini=mk('div','theme-mini');for(const [k,v] of Object.entries({paper:theme.paper,line:theme.line,accent:theme.accent,head:theme.head==='solid'?theme.accent:`color-mix(in srgb,${theme.accent} 16%,${theme.paper})`}))mini.style.setProperty('--t-'+k,v);
    mini.append(mk('i','chipbar'),mk('i'),mk('i','row'),mk('i','row'),mk('i','row'));
    label.append(radio,mini,mk('span','',theme.name));if(recommended(theme))label.append(mk('small','','مقترح'));
    radio.onchange=()=>{if(!radio.checked)return;guide.theme=theme.id;guide.color=theme.accent;$('#guideColor').value=theme.accent;syncChoices();changed()};
    box.append(label);
  }
}
/* Radio groups drawn as segmented controls; every group edits one field of the guide. */
const SEGMENTS=[
  ['tableStyleSeg','table_style',[['zebra','مخطط'],['lines','خطوط'],['cards','بطاقات'],['plain','بسيط']]],
  ['densitySeg','density',[['comfortable','مريح'],['compact','مدمج']]],
  ['cornersSeg','corners',[['sharp','حادة'],['soft','ناعمة'],['round','دائرية']]],
  ['sizeStyleSeg','size_style',[['chip','شارة مجسمة'],['pill','كبسولة'],['square','مربع'],['underline','خط سفلي'],['plain','نص فقط']]],
  ['headerStyleSeg','header_style',[['auto','حسب الثيم'],['tint','هادئة'],['solid','ممتلئة'],['plain','شفافة'],['line','بخط']]],
  ['borderStyleSeg','border_style',[['auto','حسب الثيم'],['none','بلا'],['thin','رفيعة'],['strong','سميكة']]],
  ['fontScaleSeg','font_scale',[['small','صغير'],['medium','متوسط'],['large','كبير']]],
  ['howArtSeg','how_art',[['auto','حسب الفئة'],['women','نسائي'],['men','رجالي'],['kids','أطفال'],['none','بدون']]],
  ['languageSeg','language',[['ar','العربية'],['en','English'],['auto','حسب المتجر']]],
];
const COLOR_FIELDS=[['header_bg','headBg','خلفية الترويسة'],['header_text','headInk','نص الترويسة'],['row_alt','alt','الصفوف المتبادلة'],['border_color','line','الحدود'],
  ['text_color','ink','نص الجدول'],['paper_color','paper','خلفية الجدول'],['size_bg','chipBg','خلفية خانة المقاس'],['size_text','chipInk','نص خانة المقاس']];
/* Flat one-colour line icons for the category picker (the 3D emblems stay on the storefront header). */
const LINE_ICONS={general:'<path d="M4 9h16v6H4zM8 9v3M12 9v2M16 9v3"/>',women:'<path d="M9 3l-2 4 2 3-3 11h12l-3-11 2-3-2-4-3 2z"/>',men:'<path d="M8 4l-5 3 2 5 3-1v9h8v-9l3 1 2-5-5-3q-2 2-4 2T8 4z"/>',
  kids:'<path d="M9 5L4 8l1 4 3-1v9h8v-9l3 1 1-4-5-3q-2 2-6 0z"/><path d="M12 11.500l.9 1.800 2 .3-1.450 1.400.35 2-1.800-.950-1.800.950.35-2L9.100 13.600l2-.3z"/>',shoes:'<path d="M3 15v-4l4-1 3-4 3 2h3q4 1 5 6v2H4z"/><path d="M3 18h18"/>',
  pets:'<circle cx="6" cy="11" r="1.8"/><circle cx="10" cy="6.500" r="1.8"/><circle cx="14.500" cy="6.500" r="1.8"/><circle cx="18.500" cy="11" r="1.8"/><path d="M12 12c-3 0-5.500 2.500-5.500 5 0 2 1.700 2.800 3.200 2.500 1-.2 1.600-.6 2.300-.6s1.300.4 2.300.6c1.500.3 3.200-.5 3.200-2.500 0-2.500-2.500-5-5.500-5z"/>',
  accessories:'<circle cx="12" cy="15" r="6"/><path d="M9 4l-1.500 3h9L15 4z"/>'};
function catIcon(id){const d=LINE_ICONS[id]||LINE_ICONS.general,svg=new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`,'image/svg+xml');return document.importNode(svg.documentElement,true)}
const SPECIAL=['general','shoes','pets','accessories'],groupOf=id=>SPECIAL.includes(id)?'special':id;
function buildChoices(){
  const box=$('#categoryChoices');box.replaceChildren();
  const names=Object.fromEntries((UIX?.categories||[]).map(c=>[c.id,c.name]));
  const tiles=[['women','نسائي'],['men','رجالي'],['kids','أطفال'],['special','خاص']];
  for(const [id,name] of tiles){
    const label=mk('label','cat-card'),radio=mk('input'),icon=mk('span','cat-icon'),ico=catIcon(id==='special'?'general':id);radio.type='radio';radio.name='guide-category';radio.value=id;radio.setAttribute('aria-label',name);
    label.style.setProperty('--cat',Catalog?.defaults[id==='special'?'general':id]?.color||'#177e65');icon.append(ico);label.append(radio,icon,mk('span','cat-name',name),mk('span','cat-check','✓'));
    radio.onchange=()=>{if(radio.checked)setCategory(id==='special'?(SPECIAL.includes(guide?.category)?guide.category:'general'):id)};box.append(label);
  }
  const special=$('#specialType');special.replaceChildren(...SPECIAL.map(id=>{const o=mk('option','',names[id]||id);o.value=id;return o}));special.onchange=()=>setCategory(special.value);
  for(const [id,key,options] of SEGMENTS){
    const group=$('#'+id);group.replaceChildren();
    for(const [value,text] of options){const label=mk('label'),radio=mk('input');radio.type='radio';radio.name='guide-'+key;radio.value=value;label.append(radio,mk('span','',text));group.append(label);radio.onchange=()=>{if(radio.checked&&guide){guide[key]=value;syncChoices();changed()}}}
  }
  const colors=$('#tableColors');colors.replaceChildren();
  for(const [key,,title] of COLOR_FIELDS){
    const field=mk('div','color-field'),label=mk('label','',title),input=mk('input'),status=mk('small','','تلقائي'),reset=mk('button','secondary small','×');
    input.type='color';input.id='tc-'+key;label.htmlFor=input.id;status.id='tc-status-'+key;input.setAttribute('aria-describedby',status.id);reset.type='button';reset.setAttribute('aria-label','إعادة '+title+' إلى تلقائي');
    input.oninput=()=>{if(!guide)return;guide[key]=input.value;changed()};
    reset.onclick=()=>{if(!guide)return;guide[key]='';changed()};
    field.append(label,input,status,reset);colors.append(field);
  }
}
function syncChoices(){
  if(!guide)return;
  for(const [name,value] of [['guide-category',groupOf(guide.category)],['guide-theme',guide.theme],...SEGMENTS.map(([,key])=>['guide-'+key,guide[key]])])
    document.querySelectorAll(`#editor [name="${name}"]`).forEach(r=>{r.checked=r.value===value;r.closest('label').classList.toggle('selected',r.checked)});
  $('#specialRow').classList.toggle('hidden',!SPECIAL.includes(guide.category));$('#specialType').value=guide.category;
  $('#depth3d').checked=guide.depth3d!==false;$('#headerIcon').checked=guide.header_icon!==false;
}
/* Colour pickers show the colour in effect: the merchant's own, or the one the theme would use. */
function syncColors(){
  if(!guide)return;const pal=UIX?.palette?.(guide);
  for(const [key,prop] of COLOR_FIELDS){
    const input=$('#tc-'+key);if(!input)continue;const own=/^#[0-9a-fA-F]{6}$/.test(guide[key]||'');
    input.value=own?guide[key]:(pal?.[prop]||'#000000');$('#tc-status-'+key).textContent=own?'مخصص':'تلقائي';input.closest('.color-field').classList.toggle('custom',own);input.closest('.color-field').querySelector('button').disabled=!own;
  }
}
function syncAdvanced(){
  $('#sizeLabel').value=guide.size_label||'';$('#stickySize').checked=guide.sticky_size!==false;$('#calculator').checked=guide.calculator===true;
  $('#howVideo').value=guide.how_video||'';$('#logoUrl').value=guide.logo_url||'';$('#howImages').value=(guide.how_images||[]).filter(x=>!isUpload(x)).join('\n');drawUploads();syncColors();
}
function blankGrid(){return guide.rows.every(r=>r.values.every(v=>!String(v).trim()))}
function setCategory(id){
  if(!guide||guide.category===id)return;const blank=blankGrid(),base=Catalog?.defaults[id],fits=UIX?.themes.find(t=>t.id===guide.theme)?.cats.includes(id);
  guide.category=id;
  if(blank){const t=fresh(undefined,id);guide.columns=t.columns;guide.rows=t.rows}
  if(base&&(blank||!fits)){guide.theme=base.theme;guide.color=base.color;$('#guideColor').value=base.color}
  fillTemplates();renderThemes();syncChoices();drawGrid();changed();
  if(!blank)toast('تغيّرت الفئة والثيم فقط. اختر هيكلًا من القائمة ثم «استخدام الهيكل» إن أردت أعمدة جديدة.');
}
function drawGrid(){let html='<table><thead><tr><th>المقاس</th>'+guide.columns.map((c,i)=>`<th><input aria-label="اسم العمود ${i+1}" data-col="${i}" maxlength="40" value="${esc(c.label)}"><select aria-label="نوع العمود ${i+1}" data-kind="${i}"><option value="measurement" ${c.kind==='measurement'?'selected':''}>قياس: يتحول سم/إنش</option><option value="text" ${c.kind==='text'?'selected':''}>نص: EU / UK / غيره</option></select><button type="button" class="remove fill" data-fill="${i}" aria-label="إكمال العمود ${i+1} بنفس الفرق">أكمل العمود ⇣</button><button type="button" class="remove" data-remove-col="${i}" aria-label="حذف العمود ${i+1}">حذف العمود ×</button></th>`).join('')+'<th></th></tr></thead><tbody>'+guide.rows.map((r,i)=>`<tr><td><input aria-label="اسم المقاس ${i+1}" maxlength="30" data-size="${i}" value="${esc(r.size)}"></td>`+r.values.map((v,j)=>`<td><input aria-label="${esc(r.size)} ${esc(guide.columns[j].label)}" maxlength="60" data-row="${i}" data-cell="${j}" value="${esc(v)}" placeholder="—"></td>`).join('')+`<td><button type="button" class="remove" data-remove-row="${i}" aria-label="حذف المقاس ${esc(r.size)}">×</button></td></tr>`).join('')+'</tbody></table>';$('#gridEditor').innerHTML=html;
$('#gridEditor').querySelectorAll('[data-col]').forEach(x=>x.oninput=()=>{guide.columns[+x.dataset.col].label=x.value;changed()});$('#gridEditor').querySelectorAll('[data-kind]').forEach(x=>x.onchange=()=>{guide.columns[+x.dataset.kind].kind=x.value;changed()});$('#gridEditor').querySelectorAll('[data-size]').forEach(x=>x.oninput=()=>{guide.rows[+x.dataset.size].size=x.value;changed()});$('#gridEditor').querySelectorAll('[data-cell]').forEach(x=>x.oninput=()=>{guide.rows[+x.dataset.row].values[+x.dataset.cell]=x.value;changed()});$('#gridEditor').querySelectorAll('[data-fill]').forEach(x=>x.onclick=()=>fillColumn(+x.dataset.fill));$('#gridEditor').querySelectorAll('[data-remove-col]').forEach(x=>x.onclick=async()=>{if(guide.columns.length<=1)return toast('يجب إبقاء عمود قياس واحد على الأقل.');if(!(await confirmAction('حذف هذا العمود وقيمه من المسودة؟')))return;const i=+x.dataset.removeCol;guide.columns.splice(i,1);guide.rows.forEach(r=>r.values.splice(i,1));drawGrid();changed()});$('#gridEditor').querySelectorAll('[data-remove-row]').forEach(x=>x.onclick=async()=>{if(guide.rows.length<=1)return toast('يجب إبقاء مقاس واحد على الأقل.');if(!(await confirmAction('حذف صف المقاس من المسودة؟')))return;guide.rows.splice(+x.dataset.removeRow,1);drawGrid();changed()})}
async function save(action){
  if(!editing||saving||linkedTo)return;
  if(mode==='library'&&!libraryName.trim())return toast('اكتب اسمًا للجدول المشترك.');
  if(action==='publish'){
    const message=mode==='library'?`نشر هذا الجدول ليتحدث لدى ${libraryProducts.length} منتج مرتبط؟`:'نشر هذا الجدول ليظهر لعملاء المنتج المحدد؟';
    if(!(await confirmAction(message)))return;
  }
  saving=true;const savedSnapshot=JSON.stringify(guide);$('#saveDraft').disabled=true;$('#publish').disabled=true;
  try{
    let d;
    if(mode==='library'){
      const body=JSON.stringify({version,name:libraryName.trim(),guide,action});
      d=libraryId?await api('size-library/'+libraryId+qs(),{method:'PUT',body}):await api('size-library'+qs(),{method:'POST',body});
      if(!libraryId)libraryId=d.library_id;
    }else d=await api('size-guides/'+encodeURIComponent(editing.product_id)+qs(),{method:'PUT',body:JSON.stringify({version,guide,action})});
    version=d.version;published=d.is_published;dirty=JSON.stringify(guide)!==savedSnapshot;
    guideIndex=await api('size-guides'+qs());loadLibraryIndex().catch(()=>{});
    if(!dirty)fill();else{$('#editState').textContent='حُفظت النسخة السابقة؛ لديك تعديلات أحدث غير محفوظة.';$('#unpublish').disabled=!published}
    toast(action==='publish'?(mode==='library'?'نُشر الجدول المشترك لكل المنتجات المرتبطة.':'نُشر الجدول. سيظهر الزر بعد تركيب المقطع في سلة.'):'حُفظت المسودة دون تغيير النسخة المنشورة.');
  }catch(e){toast(e.message)}finally{saving=false;$('#saveDraft').disabled=false;$('#publish').disabled=false}
}

/* ---------- editor controls ---------- */
for(const [id,key] of [['guideTitle','title'],['buttonLabel','button_label'],['measureType','measurement_type'],['guideColor','color'],['instructions','instructions'],['notes','notes'],['sizeLabel','size_label']])$('#'+id).oninput=()=>{if(!guide)return;guide[key]=$('#'+id).value;changed()};
for(const [id,key] of [['howVideo','how_video'],['logoUrl','logo_url']])$('#'+id).oninput=()=>{if(!guide)return;guide[key]=$('#'+id).value.trim();changed()};
const isUpload=value=>/^data:image\//.test(value);
function setHowImages(links,uploads){guide.how_images=[...links,...uploads].slice(0,4)}
function drawUploads(){
  const box=$('#howUploads');box.replaceChildren();if(!guide)return;
  (guide.how_images||[]).forEach((value,index)=>{if(!isUpload(value))return;
    const item=mk('div','upload-thumb'),img=mk('img'),remove=mk('button','secondary small','×');img.src=value;img.alt='صورة مرفوعة '+(index+1);remove.type='button';remove.setAttribute('aria-label','حذف الصورة');
    remove.onclick=()=>{guide.how_images=guide.how_images.filter((_,i)=>i!==index);drawUploads();changed()};item.append(img,remove);box.append(item)});
}
$('#howImages').oninput=()=>{if(!guide)return;const links=$('#howImages').value.split(/\n+/).map(x=>x.trim()).filter(Boolean),uploads=(guide.how_images||[]).filter(isUpload);setHowImages(links,uploads);changed()};
$('#howUploadBtn').onclick=()=>$('#howUploadFile').click();
$('#howUploadFile').onchange=async()=>{
  const file=$('#howUploadFile').files[0];$('#howUploadFile').value='';if(!file||!guide)return;
  if((guide.how_images||[]).length>=4)return toast('الحد الأقصى 4 صور. احذف صورة أولًا.');
  try{
    let data=await Import.imageToDataUrl(file,900,.8);if(data.length>280000)data=await Import.imageToDataUrl(file,640,.7);
    if(data.length>290000)return toast('الصورة كبيرة جدًا حتى بعد التصغير. استخدم صورة أبسط أو رابطًا.');
    const links=(guide.how_images||[]).filter(x=>!isUpload(x)),uploads=(guide.how_images||[]).filter(isUpload);
    if(links.length+uploads.length>=4)return toast('الحد الأقصى 4 صور. احذف صورة أولًا.');
    uploads.push(data);setHowImages(links,uploads);drawUploads();changed();toast('تمت إضافة الصورة. اضغط حفظ لتظهر للعملاء.');
  }catch(error){toast(error.message||'تعذر رفع الصورة.')}
};
for(const [id,key] of [['depth3d','depth3d'],['headerIcon','header_icon'],['stickySize','sticky_size'],['calculator','calculator']])$('#'+id).onchange=()=>{if(guide){guide[key]=$('#'+id).checked;changed()}};
$('#resetTableColors').onclick=()=>{if(!guide)return;for(const [key] of COLOR_FIELDS)guide[key]='';changed()};
$('#guideUnit').onchange=async()=>{const to=$('#guideUnit').value;if(!(await confirmAction('سيتم تحويل القيم الرقمية والنطاقات إلى الوحدة الجديدة. هل تتابع؟'))){$('#guideUnit').value=guide.unit;return}guide.rows.forEach(r=>r.values=r.values.map((v,i)=>guide.columns[i].kind==='measurement'?window.SizeGuideUI.convert(v,guide.unit,to):v));guide.unit=to;drawGrid();changed()};
$('#suggestTips').onclick=async()=>{const t=Catalog?.find($('#template').value);if(!t?.tips)return toast('لا يوجد نص مقترح لهذا الهيكل.');if($('#instructions').value.trim()&&!(await confirmAction('استبدال نص الإرشادات الحالي بالنص المقترح؟')))return;guide.instructions=t.tips;$('#instructions').value=t.tips;changed()};
buildChoices();
$('#addColumn').onclick=()=>{if(guide.columns.length>=10)return toast('الحد الأقصى 10 أعمدة.');guide.columns.push({label:'قياس '+(guide.columns.length+1),kind:'measurement'});guide.rows.forEach(r=>r.values.push(''));drawGrid();changed()};$('#addRow').onclick=()=>{if(guide.rows.length>=30)return toast('الحد الأقصى 30 مقاسًا.');guide.rows.push({size:'',values:guide.columns.map(()=> '')});drawGrid();changed()};$('#applyTemplate').onclick=async()=>{if(!(await confirmAction('استبدال صفوف وأعمدة المسودة بهيكل فارغ؟')))return;const t=fresh($('#template').value,guide.category);guide.columns=t.columns;guide.rows=t.rows;drawGrid();changed()};$('#copyGuide').onclick=async()=>{const id=$('#copyFrom').value;if(!id)return toast('اختر المنتج المصدر.');if(!(await confirmAction('استبدال محتوى المسودة بجدول المنتج الآخر؟')))return;try{const d=await api('size-guides/'+encodeURIComponent(id)+qs());if(!d.guide)return toast('لا يوجد جدول لهذا المنتج.');guide=withDefaults(JSON.parse(JSON.stringify(d.guide)));fill();changed()}catch(e){toast(e.message)}};$('#previewModal').onclick=()=>window.SizeGuideUI.open(guide,editing.title);$('#saveDraft').onclick=()=>save('draft');$('#publish').onclick=()=>save('publish');
$('#unpublish').onclick=async()=>{
  if(!published||saving||!(await confirmAction(mode==='library'?'إخفاء الجدول المشترك عن عملاء كل المنتجات المرتبطة مع الاحتفاظ بالمسودة؟':'إخفاء دليل المقاسات عن عملاء هذا المنتج مع الاحتفاظ بالمسودة؟')))return;
  try{const path=mode==='library'?'size-library/'+libraryId+'/unpublish':'size-guides/'+encodeURIComponent(editing.product_id)+'/unpublish';const d=await api(path+qs(),{method:'POST',body:JSON.stringify({version})});version=d.version;published=false;$('#unpublish').disabled=true;$('#editState').textContent=dirty?'أُوقف الظهور؛ لديك تعديلات غير محفوظة.':'أُوقف الظهور. المسودة محفوظة.';guideIndex=await api('size-guides'+qs());toast('أُوقف نشر الجدول.')}catch(e){toast(e.message)}
};

/* ---------- import: pasted Excel/CSV or a photo read by Gemini ---------- */
function hidePending(){pending=null;$('#importPreview').classList.add('hidden');$('#importExtras').hidden=true}
/* Everything the photo said besides the grid. Each item is optional; fields the guide already fills start unticked so nothing is replaced by surprise. */
const unitName={cm:'سنتيمتر',in:'إنش'},typeName={body:'قياسات الجسم',garment:'قياسات القطعة نفسها'},languageName={ar:'العربية',en:'English'};
const IMPORT_EXTRAS=[
  ['title','عنوان النافذة',()=>guide.title,v=>v,v=>{guide.title=v;$('#guideTitle').value=v}],
  ['size_label','عنوان عمود المقاس',()=>guide.size_label,v=>v,v=>{guide.size_label=v;$('#sizeLabel').value=v}],
  ['unit','وحدة القياس',()=>guide.unit,v=>unitName[v],v=>{guide.unit=v;$('#guideUnit').value=v}],
  ['measurement_type','نوع القياسات',()=>guide.measurement_type,v=>typeName[v],v=>{guide.measurement_type=v;$('#measureType').value=v}],
  ['category','الفئة',()=>guide.category,v=>UIX?.categories.find(c=>c.id===v)?.name,v=>{guide.category=v;fillTemplates();renderThemes();syncChoices()}],
  ['language','لغة النافذة',()=>guide.language,v=>languageName[v],v=>{guide.language=v;syncChoices()}],
  ['instructions','إرشادات طريقة القياس',()=>guide.instructions,v=>v,v=>{guide.instructions=v;$('#instructions').value=v}],
  ['notes','الملاحظات',()=>guide.notes,v=>v,v=>{guide.notes=v;$('#notes').value=v}],
];
function renderExtras(){
  const list=$('#importExtraList');list.replaceChildren();let count=0;
  for(const [key,label,current,show] of IMPORT_EXTRAS){
    const value=pending?.[key];if(!value)continue;const text=show(value);if(!text)continue;count++;
    const existing=current(),replaces=!!existing&&String(existing)!==String(value)&&!['unit','measurement_type','language','category'].includes(key)&&String(existing).trim()!==''&&!(key==='title'&&existing==='دليل المقاسات');
    const row=mk('label','check import-extra'),box=mk('input');box.type='checkbox';box.dataset.key=key;box.checked=!replaces;
    const body=mk('span','');body.append(mk('b','',label+': '),document.createTextNode(text.length>120?text.slice(0,120)+'…':text));if(replaces)body.append(mk('small','',' (سيستبدل المكتوب حاليًا)'));
    row.append(box,body);list.append(row);
  }
  $('#importExtras').hidden=count===0;
}
function showPending(extraWarnings=[]){
  const table=mk('table'),head=mk('tr');head.append(mk('th','','المقاس'));for(const c of pending.columns)head.append(mk('th','',c.label+(c.kind==='measurement'?' ⌀':'')));
  const thead=mk('thead');thead.append(head);table.append(thead);const body=mk('tbody');
  for(const r of pending.rows.slice(0,6)){const tr=mk('tr');tr.append(mk('td','',r.size||'—'));for(const v of r.values)tr.append(mk('td','',v||'—'));body.append(tr)}
  table.append(body);$('#importTable').replaceChildren(table);
  const warnings=[...(pending.warnings||[]),...extraWarnings];if(pending.rows.length>6)warnings.unshift(`تُعرض أول 6 صفوف من ${pending.rows.length}.`);
  $('#importWarnings').replaceChildren(...warnings.map(w=>mk('li','',w)));renderExtras();$('#importPreview').classList.remove('hidden');
}
$('#applyPaste').onclick=()=>{try{pending=Import.toGrid($('#pasteTable').value);showPending()}catch(e){hidePending();toast(e.message)}};
$('#importCancel').onclick=hidePending;
$('#importTranspose').onclick=()=>{
  if(!pending)return;
  try{const swapped=Import.transpose(pending);pending={...pending,...swapped,warnings:[...swapped.warnings]};showPending(['قُلبت الصفوف والأعمدة. اضغط «تبديل» مرة أخرى لإرجاعها.'])}catch(e){toast(e.message)}
};
$('#importApply').onclick=async()=>{
  if(!pending)return;if(!blankGrid()&&!(await confirmAction('استبدال أعمدة وصفوف الجدول الحالي بالجدول المستورد؟')))return;
  guide.columns=pending.columns;guide.rows=pending.rows;
  const ticked=new Set([...document.querySelectorAll('#importExtraList input:checked')].map(i=>i.dataset.key));let applied=0;
  for(const [key,,,,apply] of IMPORT_EXTRAS)if(ticked.has(key)&&pending[key]){apply(pending[key]);applied++}
  hidePending();drawGrid();changed();toast('طُبّق الجدول المستورد'+(applied?' مع '+applied+' من الحقول المقروءة':'')+'. راجع الأرقام والنصوص ثم احفظ.');
};
async function checkAi(){
  if(aiChecked)return;aiChecked=true;
  try{const d=await api('size-guide-ai-status'+qs());if(!d.available){$('#aiRun').disabled=true;$('#aiHint').textContent='القراءة بالذكاء الاصطناعي غير مفعّلة بعد: أضف المفتاح GEMINI_API_KEY في إعدادات الخادم (Render) ثم أعد تشغيل الخدمة.'}}catch{aiChecked=false}
}
$('#importPanel').addEventListener('toggle',()=>{if($('#importPanel').open)checkAi()});
$('#aiFile').onchange=()=>{aiBlob=null};
$('#importPanel').addEventListener('paste',event=>{const item=[...(event.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));if(!item)return;event.preventDefault();aiBlob=item.getAsFile();$('#aiStatus').textContent='تم لصق صورة. اضغط «قراءة الجدول من الصورة».'});
$('#aiRun').onclick=async()=>{
  const file=aiBlob||$('#aiFile').files[0];if(!file)return toast('اختر صورة أو الصقها أولًا.');
  $('#aiRun').disabled=true;$('#aiStatus').textContent='جارٍ قراءة الجدول… قد يستغرق ذلك نصف دقيقة.';
  try{
    const image=await Import.imageToDataUrl(file);
    pending=await api('size-guide-ai-import'+qs(),{method:'POST',body:JSON.stringify({image})});
    showPending(['قُرئ الجدول بالذكاء الاصطناعي وقد يخطئ في بعض الأرقام؛ راجع كل خانة قبل النشر.']);$('#aiStatus').textContent='تمت القراءة. راجع المعاينة وما قُرئ معها ثم اضغط «تطبيق على الجدول».';
  }catch(e){hidePending();$('#aiStatus').textContent='';toast(e.message)}finally{$('#aiRun').disabled=false}
};

/* ---------- navigation and session ---------- */
$('#backCatalog').onclick=async()=>{if(!(await mayLeave()))return;dirty=false;const back=mode==='library'?'library':'catalog';show(back);if(back==='catalog')loadProducts().catch(e=>toast(e.message))};document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=async()=>{if(!(await mayLeave()))return;dirty=false;show(b.dataset.tab);if(b.dataset.tab==='catalog')loadProducts().catch(e=>toast(e.message))});window.addEventListener('beforeunload',e=>{if(dirty||window.SizeGuideSettings?.isDirty()||window.SizeGuideSettings?.isBusy()){e.preventDefault();e.returnValue=''}});
$('#getSnippet').onclick=async()=>{try{let d=await api('size-guide-snippet'+qs());$('#snippet').value=d.javascript}catch(e){toast(e.message)}};$('#copySnippet').onclick=async()=>{if(!$('#snippet').value)return toast('ولّد الكود أولًا.');try{await navigator.clipboard.writeText($('#snippet').value);toast('تم نسخ الكود.')}catch{$('#snippet').select();toast('حدد الكود وانسخه يدويًا.')}};
$('#loginForm').onsubmit=async e=>{e.preventDefault();$('#loginButton').disabled=true;$('#error').textContent='';try{await api('login',{method:'POST',body:JSON.stringify({password:$('#password').value})});$('#password').value='';await boot()}catch(e){$('#error').textContent=e.message}finally{$('#loginButton').disabled=false}};$('#logout').onclick=async()=>{if(!(await mayLeave()))return;await api('logout',{method:'POST'});dirty=false;location.reload()};
$('#store').onchange=async()=>{if(!(await mayLeave())){$('#store').value=merchant;return}dirty=false;clearInterval(poll);poll=null;merchant=$('#store').value;page=1;selected.clear();libraries=[];savedStyles=[];savedPhrases=[];aiChecked=false;window.SizeGuideQuick?.clear();$('#snippet').value='';show('catalog');load().catch(e=>toast(e.message))};
$('#sync').onclick=async()=>{$('#sync').disabled=true;try{await api('sync'+qs(),{method:'POST'});await loadJobs();toast('بدأت مزامنة المنتجات.')}catch(e){toast(e.message);$('#sync').disabled=false}};$('#filter').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{page=1;loadProducts().catch(e=>toast(e.message))},300)};$('#status').onchange=()=>{page=1;loadProducts().catch(e=>toast(e.message))};$('#prev').onclick=()=>{page--;loadProducts().catch(e=>toast(e.message))};$('#next').onclick=()=>{page++;loadProducts().catch(e=>toast(e.message))};$('#refreshJobs').onclick=()=>loadJobs().catch(e=>toast(e.message));if(window.SizeGuideEmbedded){window.SizeGuideEmbedded.start(boot)}else{boot().catch(e=>{if(!e.message.includes('تسجيل الدخول'))$('#error').textContent=e.message})}
