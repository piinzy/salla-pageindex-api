// Interface motion helpers: rolling numbers, progress fill, drawn line, list FLIP, spring pill, toast stack, icon nudge, reduced motion.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(path.join(__dirname,'static','ui-motion.js'),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const norm=t=>String(t).replace(/[٠-٩]/g,c=>'٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[٬,،]/g,'');   // digits may print as Arabic-Indic or Latin
function make({reduced=false,animate=true,dir='rtl'}={}){
  const dom=new JSDOM(`<html dir="${dir}"><body><div id="toast" class="hidden"></div></body></html>`,{url:'https://app.test/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  if(reduced)w.matchMedia=q=>({matches:/reduce/.test(q)});
  if(!animate)delete w.requestAnimationFrame;
  w.eval(source);return {dom,w,d:w.document,M:w.UIMotion};
}
const rect=(left,top,width=100,height=40)=>({left,top,width,height,right:left+width,bottom:top+height,x:left,y:top});
(async()=>{
  // easing is the same curve as CSS: starts at 0, ends at 1, and is far along by the middle
  {const {dom,M}=make();try{
    assert.equal(M.easeOutExpo(0),0);assert.equal(M.easeOutExpo(1),1);assert.ok(M.easeOutExpo(.5)>.85);assert.ok(M.easeOutExpo(.1)<M.easeOutExpo(.2));
  }finally{dom.window.close()}}

  // numbers roll from the old value to the new one over ~1.2s, rounded every frame, and land exactly
  {const {dom,w,d,M}=make();try{
    const el=d.createElement('b');d.body.append(el);M.rollTo(el,0);assert.equal(norm(el.textContent),'0');
    M.rollTo(el,1000);const seen=[];await new Promise(done=>{const tick=()=>{seen.push(el.textContent);if(el.dataset.n==='1000'&&norm(el.textContent)==='1000'||seen.length>200)return done();setTimeout(tick,30)};setTimeout(tick,30)});
    assert.equal(norm(el.textContent),'1000');assert.ok(seen.length>3,'it moved through steps');assert.ok(el.classList.contains('num'),'tabular figures');
    const nums=seen.map(t=>Number(norm(t)));assert.ok(nums.every((n,i)=>i===0||n>=nums[i-1]),'it only goes up');assert.ok(nums.every(n=>Number.isInteger(n)),'whole numbers every frame');
    // a new value in mid-roll continues from where it is, never from zero
    M.rollTo(el,2000);await wait(100);M.rollTo(el,500);await wait(1400);assert.equal(norm(el.textContent),'500');
    // any number, custom formats, junk values
    M.rollTo(el,7,{format:n=>Math.round(n)+'%'});await wait(1400);assert.equal(el.textContent,'7%');M.rollTo(el,NaN);assert.equal(el.textContent,'NaN');
  }finally{dom.window.close()}}
  for(const mode of [{reduced:true},{animate:false}]){const {dom,d,M}=make(mode);try{
    const el=d.createElement('b');M.rollTo(el,4321);assert.equal(norm(el.textContent),'4321','instant when motion is off');
  }finally{dom.window.close()}}

  // progress fill moves only the fill, clamped
  {const {dom,d,M}=make();try{const i=d.createElement('i');M.fill(i,.5);assert.equal(i.style.transform,'scaleX(0.5000)');M.fill(i,3);assert.equal(i.style.transform,'scaleX(1.0000)');M.fill(i,-1);assert.equal(i.style.transform,'scaleX(0.0000)');M.fill(i,NaN);assert.equal(i.style.transform,'scaleX(0.0000)');
  }finally{dom.window.close()}}

  // a line chart that draws itself: path length 1, area beside it, values sanitised
  {const {dom,d,M}=make();try{
    const host=d.createElement('div'),svg=M.sparkline(host,[0,3,'5',NaN,2,9],'اتجاه');
    assert.equal(svg.getAttribute('aria-label'),'اتجاه');assert.equal(svg.querySelector('path.line').getAttribute('pathLength'),'1');assert.match(svg.querySelector('path.line').getAttribute('d'),/^M[\d. ]+( L[\d. ]+){4}$/);assert.ok(svg.querySelector('path.area').getAttribute('d').endsWith('Z'));
    assert.equal(M.sparkline(host,[4]),null);assert.equal(host.children.length,0);
    assert.equal(M.sparkline(d.createElement('div'),[1,2]).getAttribute('aria-hidden'),'true','decorative without a label');
  }finally{dom.window.close()}}

  // lists: survivors glide (FLIP), a new row fades in, a removed row fades out of layout
  {const {dom,w,d,M}=make();try{
    const list=d.createElement('div');d.body.append(list);const row=(k,top)=>{const e=d.createElement('div');e.dataset.key=k;e.textContent=k;e.getBoundingClientRect=()=>rect(0,top());return e};
    let layout={a:0,b:50,c:100};const A=row('a',()=>layout.a),B=row('b',()=>layout.b),C=row('c',()=>layout.c),seenStart=[],plain=C.getBoundingClientRect;C.getBoundingClientRect=()=>{seenStart.push(C.style.transform);return plain()};list.append(A,B,C);list.getBoundingClientRect=()=>rect(0,0,300,200);
    M.flip(list,()=>{layout={a:0,c:50,n:100};const Nw=row('n',()=>layout.n);list.replaceChildren(A,C,Nw)});
    assert.ok(seenStart.includes('translate(0px,50px)'),'the survivor starts where it was, then glides');assert.match(C.style.transition,/transform \.26s/);assert.ok([...list.children].find(e=>e.dataset.key==='n').classList.contains('motion-in'),'new row fades in');
    const ghost=[...list.children].find(e=>e.dataset.key==='b');assert.ok(ghost&&ghost.classList.contains('motion-out')&&ghost.style.position==='absolute','the removed row leaves layout and fades');
    await wait(320);assert.equal([...list.children].some(e=>e.dataset.key==='b'),false,'the ghost is gone');assert.equal(C.style.transform,'');
    assert.equal(A.style.transform,'','a row that did not move is left alone');
    M.flip(null,()=>{});
  }finally{dom.window.close()}
  const {dom:d2,w:w2,d:doc2,M:M2}=make({reduced:true});try{
    const list=doc2.createElement('div'),x=doc2.createElement('div');x.dataset.key='x';list.append(x);doc2.body.append(list);M2.flip(list,()=>list.replaceChildren());assert.equal(list.children.length,0,'instant when motion is off');
  }finally{d2.window.close()}}

  // the pill: one shared element, springs to the active item, snaps when reduced
  for(const reduced of [false,true]){const {dom,w,d,M}=make({reduced});try{
    const nav=d.createElement('div'),btns=[0,1,2].map(i=>{const b=d.createElement('button');b.textContent=i;for(const [k,v] of Object.entries({offsetLeft:i*110,offsetTop:0,offsetWidth:100,offsetHeight:40}))Object.defineProperty(b,k,{value:v});return b});
    nav.append(...btns);btns[0].classList.add('active');d.body.append(nav);
    M.pill(nav,'button.active');M.pill(nav,'button.active');assert.equal(nav.querySelectorAll('.motion-pill').length,1,'a single shared pill');
    const pill=nav.querySelector('.motion-pill');assert.equal(pill.style.transform,'translate(0px,0px) scale(1,1)');assert.equal(pill.style.opacity,'1');
    btns[0].classList.remove('active');btns[2].classList.add('active');await wait(30);
    if(reduced)assert.equal(pill.style.transform,'translate(220px,0px) scale(1,1)','snaps with no travel');
    else{const mid=Number(/translate\(([-\d.]+)px/.exec(pill.style.transform)[1]);assert.ok(mid>=0&&mid<=330,'it is travelling');await wait(1200);assert.equal(pill.style.transform,'translate(220px,0px) scale(1,1)','it lands exactly');}
    assert.ok(pill.getAttribute('aria-hidden')==='true');
  }finally{dom.window.close()}}
  {const {dom,d,M}=make();try{const nav=d.createElement('div'),b=d.createElement('button');b.className='active';nav.append(b);d.body.append(nav);M.pill(nav,'button.active');assert.equal(nav.querySelector('.motion-pill').style.opacity,'0','hidden while the item has no size yet');}finally{dom.window.close()}}

  // toasts: newest on top, rise in, pause on hover, tap to dismiss, a small cap
  {const {dom,w,d,M}=make();try{
    const host=d.getElementById('toast');assert.equal(M.toast('الأول',5000),true);assert.equal(host.classList.contains('hidden'),false);M.toast('الثاني',5000);
    let items=[...host.querySelectorAll('.toast-item')];assert.deepEqual(items.map(e=>e.textContent),['الثاني','الأول'],'newest first');assert.ok(items[0].classList.contains('toast-in'));assert.equal(items[0].getAttribute('role'),'status');
    items[0].click();await wait(300);assert.deepEqual([...host.querySelectorAll('.toast-item')].map(e=>e.textContent),['الأول'],'tapping dismisses and the ghost is cleared');
    for(let i=0;i<6;i++)M.toast('t'+i,5000);await wait(300);assert.ok(host.querySelectorAll('.toast-item:not(.motion-out)').length<=4,'at most four at once');
    for(const e of [...host.querySelectorAll('.toast-item')])e.click();await wait(400);assert.equal(host.classList.contains('hidden'),true,'an empty stack hides itself');
    M.toast('يختفي',150);await wait(40);const t=host.querySelector('.toast-item');t.dispatchEvent(new w.Event('mouseenter'));await wait(350);assert.equal(t.isConnected,true,'hover pauses the timer');
    t.dispatchEvent(new w.Event('mouseleave'));await wait(700);assert.equal(t.isConnected,false,'it goes after the hover ends');
    assert.equal(make({}).M.toast.length>=1,true);
  }finally{dom.window.close()}
  const nohost=new JSDOM('<body></body>',{runScripts:'outside-only'});nohost.window.eval(source);assert.equal(nohost.window.UIMotion.toast('x'),false,'no host: the caller falls back');nohost.window.close();
  const {dom:r,d:rd,M:rM}=make({reduced:true});try{rM.toast('فوري',100);const t=rd.querySelector('.toast-item');assert.equal(t.classList.contains('toast-in'),false,'no rise when reduced');await wait(160);assert.equal(t.isConnected,false,'timers still run');assert.equal(rd.getElementById('toast').classList.contains('hidden'),true);}finally{r.window.close()}}

  // icon nudge: one arrow, only added once, pointing the right way on a right-to-left page
  for(const dir of ['rtl','ltr']){const {dom,d,M}=make({dir});try{
    const mk=kind=>{const b=d.createElement('button');b.dataset.nudge=kind;b.textContent='نص';d.body.append(b);return b};const f=mk('forward'),bk=mk('back'),dn=mk('down'),bad=mk('sideways');
    M.enhance();M.enhance();for(const b of [f,bk,dn])assert.equal(b.querySelectorAll('svg.nudge-ico').length,1);assert.equal(bad.querySelector('svg'),null);
    const nx=b=>b.querySelector('svg').style.getPropertyValue('--nx'),ny=b=>b.querySelector('svg').style.getPropertyValue('--ny');
    assert.equal(nx(f),dir==='rtl'?'-4px':'4px');assert.equal(nx(bk),dir==='rtl'?'4px':'-4px');assert.equal(ny(dn),'4px');assert.equal(nx(dn),'0px');
    assert.equal(f.querySelector('svg').parentNode,f);assert.equal(bk.firstChild.tagName.toLowerCase(),'svg','a back arrow leads the label');assert.equal(f.lastChild.tagName.toLowerCase(),'svg');assert.equal(f.querySelector('svg').getAttribute('aria-hidden'),'true');
    assert.equal(f.childNodes.length,2);assert.equal(f.firstChild.textContent,'نص','the label is untouched');
  }finally{dom.window.close()}}
  console.log('PASS: ui motion (easing, rolling numbers, progress fill, drawn line, list FLIP, spring pill, toast stack, icon nudge, reduced motion).');
})().catch(error=>{console.error(error);process.exitCode=1});
