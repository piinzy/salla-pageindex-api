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
const defaults={
  general:{theme:'atlas',color:'#373631'},
  women:{theme:'atelier',color:'#363732'},
  men:{theme:'precision',color:'#39383b'},
  kids:{theme:'measure',color:'#242425'},
  shoes:{theme:'continental',color:'#272821'},
  pets:{theme:'ranges',color:'#765657'},
  accessories:{theme:'numeric',color:'#584d40'}
};
/* Ready-made looks. They change the appearance only, never the table's numbers or texts. */
const STYLE_FIELDS=['layout_type','theme','color','table_style','density','corners','depth3d','header_icon','size_style','header_style','border_style','font_scale','font_family','sticky_size','header_bg','header_text','row_alt','border_color','text_color','paper_color','size_bg','size_text'];
const noCustomColors={font_family:'',header_bg:'',header_text:'',row_alt:'',border_color:'',text_color:'',paper_color:'',size_bg:'',size_text:''};
/* The ready-made looks are the store owner's own designs, added here as {id,name,hint,style}. */
const stylePresets=[];
// Palettes contain only color roles already persisted in the guide and shared style presets.
const colorPalettes=[
  {id:'garnet',name:'عنّاب وعاج',colors:{
    color:'#772c45',header_bg:'#502233',header_text:'#fff8ee',paper_color:'#fffaf1',text_color:'#2d2326',
    row_alt:'#f5ece3',border_color:'#d5beb5',size_bg:'#e9d7cc',size_text:'#502233'
  }},
  {id:'formal',name:'سادة رسمي',colors:{
    color:'#252525',header_bg:'#f2f2f2',header_text:'#191919',paper_color:'#ffffff',text_color:'#242424',
    row_alt:'#fafafa',border_color:'#cecece',size_bg:'#f3f3f3',size_text:'#222222'
  }},
  {id:'linen',name:'حبر وكتّان',colors:{
    color:'#383736',header_bg:'#2d3030',header_text:'#f9f5ec',paper_color:'#fbf8f0',text_color:'#252829',
    row_alt:'#eeeae0',border_color:'#c8c4b8',size_bg:'#ddd9ce',size_text:'#282c2a'
  }},
  {id:'olive',name:'زيتون ورمل',colors:{
    color:'#505b39',header_bg:'#465137',header_text:'#fff8e9',paper_color:'#faf8ed',text_color:'#282d23',
    row_alt:'#efefdf',border_color:'#c3c7ae',size_bg:'#dbe1c6',size_text:'#384329'
  }},
  {id:'porcelain',name:'خزف أزرق',colors:{
    color:'#315779',header_bg:'#dce8ef',header_text:'#21384b',paper_color:'#f8fbfc',text_color:'#263747',
    row_alt:'#eaf1f5',border_color:'#b5c9d7',size_bg:'#d3e1ec',size_text:'#284965'
  }},
  {id:'rose',name:'كاكاو وورد',colors:{
    color:'#744c4e',header_bg:'#503c38',header_text:'#fff5ef',paper_color:'#fff8f4',text_color:'#382725',
    row_alt:'#f5e6e3',border_color:'#d0b9b5',size_bg:'#ead2cf',size_text:'#543436'
  }},
  {id:'lilac',name:'لافندر وضباب',colors:{
    color:'#635377',header_bg:'#e4dceb',header_text:'#40324f',paper_color:'#fbf9fc',text_color:'#332d3b',
    row_alt:'#f1ebf4',border_color:'#cfc3d6',size_bg:'#e4d9eb',size_text:'#513c60'
  }},
  {id:'midnight',name:'ليل وشمبانيا',colors:{
    color:'#e3c89b',header_bg:'#d6bd98',header_text:'#252331',paper_color:'#20232c',text_color:'#f8f1e6',
    row_alt:'#2c303b',border_color:'#596171',size_bg:'#373d4b',size_text:'#f2d8ae'
  }},
  {id:'emerald',name:'زمرد ونحاس',colors:{
    color:'#e4bb9b',header_bg:'#1c453b',header_text:'#f5e7d7',paper_color:'#142d29',text_color:'#f6f0df',
    row_alt:'#1d3933',border_color:'#586f63',size_bg:'#304b40',size_text:'#f6d5b7'
  }}
];
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
const styleDefaults={compare_sizes:false,show_fit_details:false,fit_advice:'',lining_stretch:'',review_measurements:false,body_table:null,size_systems:null,font_family:'',category:'general',theme:'classic',table_style:'zebra',density:'comfortable',corners:'soft',depth3d:true,header_icon:true,
  size_style:'chip',header_style:'auto',border_style:'auto',font_scale:'medium',sticky_size:true,size_label:'',header_bg:'',header_text:'',row_alt:'',
  border_color:'',text_color:'',paper_color:'',size_bg:'',size_text:'',calculator:false,language:'ar',how_images:[],how_art:'auto',layout_type:'tabs',fit_level:'',cell_styles:[],side_layout:'auto',side_3d:true,col_widths:[],side_image:'',side_image_back:'',how_video:'',logo_url:''};
/* A new guide for a category; blank cells keep the "enter your own numbers" rule. */
function fresh(templateId,category='general'){
  const item=templates.find(x=>x.id===templateId)||forCategory(category)[0]||templates[templates.length-1],base=defaults[item.category]||defaults.general;
  return {...JSON.parse(JSON.stringify(styleDefaults)),title:'دليل المقاسات',button_label:'دليل المقاسات',unit:'cm',measurement_type:'garment',
    columns:item.columns.map(c=>({...c})),rows:item.sizes.map(size=>({size,values:item.columns.map(()=> '')})),
    header_icon:false,depth3d:false,corners:'sharp',size_style:'plain',notes:'',instructions:'',color:base.color,category:item.category,theme:base.theme,calculator:true,
    ...(item.category==='general'?plainStyle():{})};
}
/* A brand-new general guide starts like Salla's own size table: white, centred title, one thin-lined table, no drawing, no extra tabs. */
function plainStyle(){return {...noCustomColors,layout_type:'compact',size_systems:[],calculator:false,how_art:'none',header_icon:false,depth3d:false,corners:'sharp',size_style:'plain'}}
/* Painted parts follow their rows and columns: the removed one's styles go, later ones move up by one. */
function shiftPaint(styles,kind,index){
  const field=kind==='row'?'row':'col';
  return (Array.isArray(styles)?styles:[]).filter(x=>x[field]!==index).map(x=>x[field]>index?{...x,[field]:x[field]-1}:x);
}
window.SizeGuideCatalog={colorPalettes,shiftPaint,templates,defaults,styleDefaults,stylePresets,STYLE_FIELDS,phrasesFor,forCategory,fresh,find:id=>templates.find(x=>x.id===id)};
})();
