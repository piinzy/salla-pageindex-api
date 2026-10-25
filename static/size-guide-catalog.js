/* Starter structures per product category. They contain column names and size labels only: measurements are always entered by the merchant. */
(() => {
'use strict';
const m=label=>({label,kind:'measurement'}),t=label=>({label,kind:'text'});
const LETTERS=['XS','S','M','L','XL'],ADULT=['S','M','L','XL','XXL'];
const templates=[
  {id:'women-dresses',category:'women',name:'فساتين',columns:[m('محيط الصدر'),m('محيط الخصر'),m('محيط الأرداف'),m('طول القطعة')],sizes:LETTERS,
    tips:'محيط الصدر: عند أعرض نقطة. محيط الخصر: عند أنحف نقطة. محيط الأرداف: عند أعرض نقطة. طول القطعة: من أعلى الكتف حتى الحافة السفلية.'},
  {id:'women-tops',category:'women',name:'بلايز وقمصان',columns:[m('محيط الصدر'),m('عرض الكتف'),m('طول القطعة'),m('طول الكم')],sizes:LETTERS,
    tips:'ضعي القطعة مفرودة على سطح مستوٍ وقيسي من حافة إلى حافة. عرض الكتف من خط الدرز إلى الدرز الآخر.'},
  {id:'women-pants',category:'women',name:'بناطيل',columns:[m('محيط الخصر'),m('محيط الأرداف'),m('الطول الداخلي'),m('الطول الخارجي')],sizes:LETTERS,
    tips:'الطول الداخلي من نقطة التقاء الساقين حتى الحافة السفلية. الطول الخارجي من أعلى الخصر حتى الحافة السفلية.'},
  {id:'women-skirts',category:'women',name:'تنانير',columns:[m('محيط الخصر'),m('محيط الأرداف'),m('طول القطعة')],sizes:LETTERS,
    tips:'طول القطعة من أعلى الخصر حتى الحافة السفلية للتنورة.'},
  {id:'women-lingerie',category:'women',name:'ملابس داخلية',columns:[m('محيط الصدر'),m('محيط تحت الصدر'),t('حجم الكأس')],sizes:['70','75','80','85','90'],
    tips:'محيط تحت الصدر: مباشرة تحت الصدر بشريط مشدود. محيط الصدر: عند أعرض نقطة.'},
  {id:'women-abaya',category:'women',name:'عبايات',columns:[m('الطول'),m('عرض الكتف'),m('طول الكم'),m('محيط الصدر')],sizes:ADULT,
    tips:'الطول من أعلى الكتف حتى الحافة السفلية. طول الكم من نهاية الكتف حتى طرف الكم.'},
  {id:'men-shirts',category:'men',name:'قمصان وتيشيرتات',columns:[m('محيط الصدر'),m('عرض الكتف'),m('طول القطعة'),m('طول الكم')],sizes:ADULT,
    tips:'قيسي القطعة مفرودة: الصدر تحت الإبطين من حافة إلى حافة، والطول من أعلى الكتف حتى الحافة السفلية.'},
  {id:'men-pants',category:'men',name:'بناطيل',columns:[m('محيط الخصر'),m('محيط الفخذ'),m('الطول الداخلي'),m('الطول الخارجي')],sizes:ADULT,
    tips:'محيط الخصر من أعلى حزام البنطال. الطول الداخلي من نقطة التقاء الساقين حتى الحافة السفلية.'},
  {id:'men-thobe',category:'men',name:'ثياب',columns:[m('طول الثوب'),m('عرض الكتف'),m('طول الكم'),m('محيط الصدر')],sizes:ADULT,
    tips:'طول الثوب من أعلى الكتف حتى الحافة السفلية. طول الكم من نهاية الكتف حتى طرف الكم.'},
  {id:'men-jackets',category:'men',name:'جاكيتات',columns:[m('محيط الصدر'),m('عرض الكتف'),m('طول القطعة'),m('طول الكم')],sizes:ADULT,
    tips:'قيسي الجاكيت مغلقًا ومفرودًا على سطح مستوٍ.'},
  {id:'kids-clothes',category:'kids',name:'ملابس أطفال',columns:[m('الطول'),m('محيط الصدر'),m('محيط الخصر'),t('الوزن')],sizes:['0-3 شهور','3-6 شهور','6-12 شهرًا','1-2 سنة','2-3 سنوات'],
    tips:'قيسي الطفل وهو واقف باستقامة دون حذاء. استخدمي شريطًا ناعمًا دون شد.'},
  {id:'kids-shoes',category:'kids',name:'أحذية أطفال',columns:[t('UK'),t('US'),m('طول القدم')],sizes:['26','27','28','29','30','31'],
    tips:'ضعي قدم الطفل على ورقة وارسمي حدودها، ثم قيسي من الكعب إلى أطول إصبع.'},
  {id:'shoes-women',category:'shoes',name:'أحذية نسائية',columns:[t('UK'),t('US'),m('طول القدم'),m('عرض القدم')],sizes:['36','37','38','39','40','41'],
    tips:'قفي على ورقة وارسمي حدود القدم، ثم قيسي من الكعب إلى أطول إصبع. المقاس في الصف هو مقاس EU.'},
  {id:'shoes-men',category:'shoes',name:'أحذية رجالية',columns:[t('UK'),t('US'),m('طول القدم'),m('عرض القدم')],sizes:['40','41','42','43','44','45','46'],
    tips:'قف على ورقة وارسم حدود القدم، ثم قس من الكعب إلى أطول إصبع. المقاس في الصف هو مقاس EU.'},
  {id:'shoes-sneakers',category:'shoes',name:'أحذية رياضية',columns:[t('UK'),t('US'),m('طول القدم')],sizes:['38','39','40','41','42','43','44'],
    tips:'قس القدم في آخر اليوم عند أكبر حجم لها، وبالجورب الذي ترتديه عادةً مع الحذاء.'},
  {id:'pets-dog',category:'pets',name:'ملابس الكلاب',columns:[m('محيط الرقبة'),m('محيط الصدر'),m('طول الظهر'),t('الوزن (كجم)')],sizes:LETTERS,
    tips:'محيط الصدر عند أعرض نقطة خلف الأرجل الأمامية. طول الظهر من أسفل الرقبة حتى بداية الذيل.'},
  {id:'pets-cat',category:'pets',name:'ملابس القطط',columns:[m('محيط الرقبة'),m('محيط الصدر'),m('طول الظهر'),t('الوزن (كجم)')],sizes:['XS','S','M','L'],
    tips:'استخدمي شريطًا ناعمًا ودعي إصبعًا واحدًا بين الشريط وجسم الحيوان.'},
  {id:'pets-collar',category:'pets',name:'أطواق وياقات',columns:[m('محيط الرقبة'),m('عرض الطوق'),t('الوزن المناسب (كجم)')],sizes:LETTERS,
    tips:'قيسي محيط الرقبة حيث يستقر الطوق عادةً، واتركي مسافة إصبعين للراحة.'},
  {id:'pets-harness',category:'pets',name:'أحزمة وسترات',columns:[m('محيط الصدر'),m('محيط الرقبة'),t('الوزن (كجم)')],sizes:LETTERS,
    tips:'محيط الصدر عند أعرض نقطة خلف الأرجل الأمامية.'},
  {id:'pets-bed',category:'pets',name:'أسرّة وبيوت',columns:[m('الطول'),m('العرض'),t('الوزن الأقصى (كجم)')],sizes:['S','M','L','XL'],
    tips:'قيسي الحيوان وهو ممدد من الأنف إلى أسفل الظهر، وأضيفي بضعة سنتيمترات للراحة.'},
  {id:'acc-rings',category:'accessories',name:'خواتم',columns:[m('القطر الداخلي'),m('المحيط'),t('US'),t('EU')],sizes:['6','7','8','9'],
    tips:'قيسي محيط الإصبع عند القاعدة بخيط رفيع، أو قيسي القطر الداخلي لخاتم يناسبك.'},
  {id:'acc-bracelets',category:'accessories',name:'أساور وساعات',columns:[m('محيط المعصم'),m('طول السوار')],sizes:['S','M','L'],
    tips:'لفّي شريطًا رفيعًا حول المعصم عند مكان السوار، وأضيفي مساحة للراحة إن رغبتِ.'},
  {id:'acc-belts',category:'accessories',name:'أحزمة',columns:[m('محيط الخصر'),m('الطول الكلي'),t('المقاس')],sizes:['S','M','L','XL'],
    tips:'قس الطول الكلي للحزام من طرف الإبزيم حتى الثقب المستخدم.'},
  {id:'acc-hats',category:'accessories',name:'قبعات',columns:[m('محيط الرأس'),t('المقاس')],sizes:['S','M','L'],
    tips:'قس محيط الرأس فوق الحاجبين مباشرة وحول الجزء الأعرض من الجمجمة.'},
  {id:'general-basic',category:'general',name:'جدول عام',columns:[m('القياس الأول'),m('القياس الثاني'),m('القياس الثالث')],sizes:['S','M','L','XL'],tips:''},
];
const defaults={general:{theme:'classic',color:'#177e65'},women:{theme:'rose',color:'#b4456a'},men:{theme:'tailor',color:'#23375b'},
  kids:{theme:'mint',color:'#1b8f7c'},shoes:{theme:'sport',color:'#d9480f'},pets:{theme:'paws',color:'#d9701a'},accessories:{theme:'gold',color:'#a8812c'}};
/* Ready-made looks. They change the appearance only, never the table's numbers or texts. */
const STYLE_FIELDS=['theme','color','table_style','density','corners','depth3d','header_icon','size_style','header_style','border_style','font_scale','sticky_size','header_bg','header_text','row_alt','border_color','text_color','paper_color','size_bg','size_text'];
const noCustomColors={header_bg:'',header_text:'',row_alt:'',border_color:'',text_color:'',paper_color:'',size_bg:'',size_text:''};
/* The ready-made looks are the store owner's own designs, added here as {id,name,hint,style}; none ship by default. */
const stylePresets=[
].map(p=>({...p,style:{...noCustomColors,sticky_size:true,...p.style}}));
/* Short notes a store tends to repeat under its tables; the merchant can add their own. */
const phraseSets={
  general:['القياسات مأخوذة والقطعة مفرودة على سطح مستوٍ.','قد يختلف القياس الفعلي من 1 إلى 2 سم.','راجع «طريقة القياس» قبل اختيار المقاس.','المقاسات بالسنتيمتر ما لم يُذكر غير ذلك.'],
  women:['قماش مطاطي: يمكنك اختيار مقاسك المعتاد.','القَصّة واسعة قليلًا عند الأكمام.'],
  men:['القَصّة مستقيمة (Regular Fit).','القماش قطني وقد ينكمش قليلًا بعد الغسيل الأول.'],
  kids:['قياسات الأطفال تقريبية وتختلف بحسب نموّ الطفل.'],
  shoes:['المقاسات حسب طول القدم؛ إن كنت بين مقاسين فاختر الأكبر.','قِس القدم في آخر اليوم وبالجورب الذي ترتديه عادةً.'],
  pets:['قِس الحيوان وهو واقف وأضف مساحة للراحة.','اترك مسافة إصبعين بين الطوق والرقبة.'],
  accessories:['المقاسات تقريبية؛ قِس بشريط ناعم لأفضل دقة.'],
};
const phrasesFor=category=>category==='general'?[...phraseSets.general]:[...phraseSets.general,...(phraseSets[category]||[])];
const forCategory=category=>templates.filter(item=>item.category===category);
/* Style fields every guide has; guides saved before they existed read as these values (the finder stays off for them). */
const styleDefaults={body_table:null,category:'general',theme:'classic',table_style:'zebra',density:'comfortable',corners:'soft',depth3d:true,header_icon:true,
  size_style:'chip',header_style:'auto',border_style:'auto',font_scale:'medium',sticky_size:true,size_label:'',header_bg:'',header_text:'',row_alt:'',
  border_color:'',text_color:'',paper_color:'',size_bg:'',size_text:'',calculator:false,language:'ar',how_images:[],how_art:'auto',layout_type:'tabs',fit_level:'',cell_styles:[],side_layout:'auto',side_3d:true,col_widths:[],side_image:'',side_image_back:'',how_video:'',logo_url:''};
/* A new guide for a category; blank cells keep the "enter your own numbers" rule. */
function fresh(templateId,category='general'){
  const item=templates.find(x=>x.id===templateId)||forCategory(category)[0]||templates[templates.length-1],base=defaults[item.category]||defaults.general;
  return {...JSON.parse(JSON.stringify(styleDefaults)),title:'دليل المقاسات',button_label:'دليل المقاسات',unit:'cm',measurement_type:'garment',
    columns:item.columns.map(c=>({...c})),rows:item.sizes.map(size=>({size,values:item.columns.map(()=> '')})),
    notes:'',instructions:'',color:base.color,category:item.category,theme:base.theme,calculator:true};
}
/* Painted parts follow their rows and columns: the removed one's styles go, later ones move up by one. */
function shiftPaint(styles,kind,index){
  const field=kind==='row'?'row':'col';
  return (Array.isArray(styles)?styles:[]).filter(x=>x[field]!==index).map(x=>x[field]>index?{...x,[field]:x[field]-1}:x);
}
window.SizeGuideCatalog={shiftPaint,templates,defaults,styleDefaults,stylePresets,STYLE_FIELDS,phrasesFor,forCategory,fresh,find:id=>templates.find(x=>x.id===id)};
})();
