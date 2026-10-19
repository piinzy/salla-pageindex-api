const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const read=n=>fs.readFileSync(path.join(__dirname,'static',n),'utf8');
const dom=new JSDOM(`<body><salla-product-card><div class="product-price">other</div></salla-product-card><div id="product-42">
<salla-slider data-testid="store-product-image-slider"><div class="s-slider-container"><a class="swiper-slide"><img alt="product"></a></div></salla-slider>
<section><h1 data-testid="store-product-title">Product</h1><div data-testid="store-product-price"><p>240</p></div>
<salla-product-options product-id="42"><label for="size">المقاس</label><select id="size"><option>S</option></select></salla-product-options>
<salla-add-product-button product-id="42"></salla-add-product-button></section></div></body>`,{url:'https://shop.test/p42',runScripts:'outside-only'});
const w=dom.window,d=w.document;w.eval(read('size-guide-button.js'));w.eval(read('size-guide-placement.js'));
try{
 const UI=w.SizeGuideButton,P=w.SizeGuidePlacement,host=d.createElement('span');host.id='product-size-guide';
 const ctx={id:'42'},a=P.anchors(ctx);let mobile=false;const engine=P.create({viewport:()=>mobile});
 assert.equal(a.size,d.querySelector('label'));
 const originalCartParent=a.cart.parentNode;
 for(const placement of UI.placements.map(p=>p.id)){
  const settings={...UI.defaults('pill'),placement};UI.render(host,settings);
  const result=engine.apply(host,ctx,settings);
  assert.equal(result.placement,placement==='mobile_bar'?'above_price':placement);
  const parent=host.parentNode;const count=d.querySelectorAll('[data-dalilak-layout]').length;
  engine.apply(host,ctx,settings);assert.equal(host.parentNode,parent);assert.equal(d.querySelectorAll('[data-dalilak-layout]').length,count,'idempotent wrappers');
  if(placement.startsWith('image_')){assert.equal(host.parentNode,a.gallery);assert.equal(host.style.position,'absolute');assert.ok(!a.gallery.querySelector('a').contains(host));}
  if(placement==='above_price')assert.equal(host.nextElementSibling,a.price);
  if(placement==='below_price')assert.equal(host.previousElementSibling,a.price);
  if(placement==='below_title')assert.equal(host.previousElementSibling,a.title);
  if(placement==='before_options')assert.equal(host.nextElementSibling,a.options);
  if(placement==='above_cart')assert.equal(host.nextElementSibling,a.cart);
  if(placement==='beside_cart')assert.equal(a.cart.parentNode,host.parentNode);
  if(placement==='beside_size'){assert.equal(a.size.parentNode,host.parentNode);assert.ok(!a.size.contains(host),'button must not activate size input label');}
 }
 engine.reset();assert.equal(a.cart.parentNode,originalCartParent);assert.equal(a.cart.style.flex,'');assert.equal(a.gallery.style.position,'');assert.equal(d.querySelectorAll('[data-dalilak-layout]').length,0);
 const responsive={...UI.defaults('pill'),placement:'above_price',mobile_placement:'image_bottom_left'};
 mobile=true;assert.equal(engine.apply(host,ctx,responsive).placement,'image_bottom_left');mobile=false;assert.equal(engine.apply(host,ctx,responsive).placement,'above_price');
 mobile=true;assert.equal(engine.apply(host,ctx,{...responsive,mobile_placement:'mobile_bar'}).placement,'mobile_bar');assert.equal(host.style.position,'fixed');
 engine.reset();a.gallery.parentNode.remove();assert.equal(engine.apply(host,ctx,{placement:'image_top_right'}).placement,'above_price');assert.equal(host.nextElementSibling,a.price);
 engine.reset();
 const legacy=UI.normalize({design:'floating',text_color:'#123456'});assert.equal(legacy.design,'pill');assert.equal(legacy.placement,'floating_left');assert.equal(legacy.bottom_offset,24);assert.equal(legacy.text_color,'#123456');
 for(const design of UI.designs){let clicks=0;const {button}=UI.render(host,{design:design.id,label:'<img onerror=alert(1)>'},{},()=>clicks++);assert.equal(button.type,'button');assert.equal(button.getAttribute('aria-haspopup'),'dialog');assert.equal(button.getAttribute('aria-label'),'<img onerror=alert(1)>');assert.equal(host.shadowRoot.querySelector('img'),null);button.click();assert.equal(clicks,1);}
 // two buttons beside the same cart button share one row; the theme is restored only when the last one leaves
 {const second=d.createElement('span'),third=d.createElement('span'),one=P.create({viewport:()=>mobile}),two=P.create({viewport:()=>mobile});mobile=false;
  const settings={...UI.defaults('pill'),placement:'beside_cart'};UI.render(second,settings);UI.render(third,{...settings,design:'chip'});
  one.apply(second,ctx,settings);two.apply(third,ctx,{...settings,design:'chip'});
  assert.equal(d.querySelectorAll('[data-dalilak-layout]').length,1,'one shared row');assert.equal(second.parentNode,third.parentNode);assert.equal(a.cart.parentNode,second.parentNode);
  one.reset();assert.equal(d.querySelectorAll('[data-dalilak-layout]').length,1,'row stays while another button uses it');
  two.reset();assert.equal(d.querySelectorAll('[data-dalilak-layout]').length,0);assert.equal(a.cart.parentNode,originalCartParent);assert.equal(a.cart.style.flex,'');
  const mobileOnly={...UI.defaults('pill'),devices:'mobile'},desktopOnly={...UI.defaults('pill'),devices:'desktop'};
  mobile=false;assert.equal(one.apply(second,ctx,mobileOnly).hidden,true);assert.match(second.style.cssText,/display:\s*none/);
  assert.equal(one.apply(second,ctx,desktopOnly).hidden,false);assert.doesNotMatch(second.style.cssText,/display:\s*none/);
  mobile=true;assert.equal(one.apply(second,ctx,mobileOnly).hidden,false);assert.equal(one.apply(second,ctx,desktopOnly).hidden,true);one.reset();mobile=false;}
 // size, depth, radius and icon reach the rendered button; unknown values fall back safely
 {const {button}=UI.render(host,{design:'raised',scale:130,radius:12,icon:'paw',width:'full',effect:'tilt',depth:'deep'});
  assert.equal(button.dataset.depth,'deep');assert.equal(button.style.getPropertyValue('--sg-scale'),'1.3');assert.equal(button.style.getPropertyValue('--sg-radius'),'12px');
  assert.equal(button.querySelectorAll('.icon circle').length,4,'paw icon');assert.equal(button.dataset.width,'full');
  assert.equal(UI.render(host,{design:'raised',depth:'flat'}).button.dataset.depth,'raised','the 3D design keeps its raised edge');
  assert.equal(UI.render(host,{design:'link',depth:'deep'}).button.dataset.depth,'flat','text-only designs have no depth');
  const bad=UI.normalize({scale:500,radius:99,depth:'x',effect:'x',icon:'x',devices:'x',width:'x',extra_buttons:[{design:'glass'},{},{},{},{}]});
  assert.deepEqual([bad.scale,bad.radius,bad.depth,bad.effect,bad.icon,bad.devices,bad.width],[100,-1,'soft','lift','ruler','all','auto']);
  assert.equal(bad.extra_buttons.length,3,'at most three extra buttons');assert.equal(bad.extra_buttons[0].design,'glass');assert.equal(bad.extra_buttons[0].extra_buttons,undefined);}
 console.log('PASS: 15 placements, mobile override, four gallery corners, label/cart restoration, fallback, legacy migration, shared multi-button rows, device visibility, 3D/size options and 16 accessible designs.');
}finally{w.close();}
