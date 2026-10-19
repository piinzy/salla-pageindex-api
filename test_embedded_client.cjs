// Real vendored SDK in a browser-like VM, plus mocked app integration boundaries.
// No browser session or store data is accessed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'static/salla-embedded.js'),'utf8');

async function checkVendoredSdk() {
  const listeners = new Map(), messages = [];
  const parent = {postMessage(message) { messages.push(message); }};
  const window = {
    parent, location:{search:'?token=temporary-salla-token'},
    addEventListener(type,callback) {
      if (!listeners.has(type)) listeners.set(type,new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type,callback) { listeners.get(type)?.delete(callback); },
  };
  const context = vm.createContext({window,
    document:{documentElement:{scrollHeight:600}},
    console,URL,URLSearchParams,setTimeout,clearTimeout,queueMicrotask,
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname,'static/salla-embedded-sdk-0.2.6.js'),'utf8'),context);
  const sdk = context.SallaEmbeddedSDK.embedded;
  const dispatch = (event,payload,origin='https://s.salla.sa',extra={}) => {
    const data = {event,payload,timestamp:Date.now(),source:'merchant-dashboard',...extra};
    for (const callback of listeners.get('message') || []) callback({origin,source:parent,data});
  };
  try {
    assert.equal(typeof context.process,'undefined','a browser must not need a Node process global');
    const pending = sdk.init();
    assert.equal(messages.at(-1).event,'embedded::iframe.ready');
    dispatch('embedded::context.provide',{layout:{theme:'light'}},'https://s.salla.sa.evil.example');
    await Promise.resolve();
    assert.equal(sdk.isReady(),false,'an untrusted origin must not complete the handshake');
    // This valid host message used to throw ReferenceError: process is not defined.
    dispatch('embedded::context.provide',{layout:{theme:'dark'}});
    assert.equal((await pending).layout.theme,'dark');
    assert.equal(sdk.auth.getToken(),'temporary-salla-token');
    assert.equal(messages.some(message=>message.event==='embedded::ready'),false);
    sdk.ready(); sdk.ready();
    assert.equal(messages.filter(message=>message.event==='embedded::ready').length,1);
    let theme = 'dark'; sdk.onThemeChange(value=>{ theme=value; });
    dispatch('embedded::theme.change',{theme:'light'},'https://untrusted.example');
    assert.equal(theme,'dark','the production origin filter must remain active');
    dispatch('embedded::theme.change',{theme:'light'});
    assert.equal(theme,'light');
    const nav = sdk.nav.addNavItem({title:'Products',value:'catalog',url:'/embedded/app/755502526/size-guide'});
    const request = messages.at(-1);
    dispatch('embedded::nav.addItem.response',{item:{value:'catalog'}},'https://s.salla.sa',{requestId:request.requestId});
    assert.equal((await nav).value,'catalog');
  } finally { sdk.destroy(); }
  assert.equal(listeners.get('message').size,0);
  console.log('Vendored SDK checks passed without process: host handshake, origin filtering, ready, theme and navigation.');
}

function setup({exchangeOk=true, framed=true}={}) {
  const nodes = new Map(), calls = [], elements = [];
  function element(tag='div') {
    const x = {tag,children:[],dataset:{},classList:{add(){},remove(){}},
      append(...items){this.children.push(...items);for(const v of items)if(v.id)nodes.set(v.id,v);},
      prepend(...items){this.children.unshift(...items);for(const v of items)if(v.id)nodes.set(v.id,v);},
      replaceChildren(){this.children=[];},setAttribute(){},remove(){nodes.delete(this.id);},click(){}};
    elements.push(x);return x;
  }
  const body=element('body'),main=element('main'),app=element();nodes.set('app',app);
  const document={documentElement:{dataset:{}},body,createElement:element,
    getElementById:id=>nodes.get(id),querySelector:selector=>selector==='main'?main:element()};
  let themeCallback;
  const sdk={init:async()=>({layout:{theme:'dark'}}),onThemeChange:fn=>{themeCallback=fn;},
    auth:{getToken:()=> 'temporary-salla-token',refresh:()=>calls.push('refresh')},
    page:{setTitle:()=>{}},ready:()=>calls.push('ready'),isReady:()=>true,destroy:()=>calls.push('destroy'),
    ui:{toast:{info:()=>{},error:()=>{}},confirm:async()=>({confirmed:false})},
    nav:{addNavItem:async()=>{},updateNavItem:()=>{},onNavItemClick:()=>{}}};
  const window={parent:{},SallaEmbeddedSDK:{embedded:sdk}};if(!framed)window.parent=window;
  let apiStatus=200;
  const context=vm.createContext({window,document,URL,URLSearchParams,Headers,
    location:{href:'https://test/salla/embedded?token=temporary-salla-token&theme=dark',search:'?token=temporary-salla-token&theme=dark'},
    history:{replaceState:(_a,_b,url)=>calls.push({url})},poll:null,clearInterval(){},
    mayLeave:async()=>true,dirty:false,view:'catalog',show(){},loadProducts:async()=>{},loadJobs:async()=>{},toast(){},
    fetch:async(url,options)=>{
      calls.push({url,options});
      if(url.endsWith('embedded-session'))return {ok:exchangeOk,json:async()=>exchangeOk?{session_token:'app-session',app_id:'755502526'}:{detail:'Invalid session'}};
      return {ok:apiStatus===200,status:apiStatus,json:async()=>apiStatus===200?{ok:true}:{detail:'Expired'}};
    }});
  vm.runInContext(source,context);
  return {client:window.SizeGuideEmbedded,calls,document,main,nodes,theme:v=>themeCallback(v),failApi:()=>{apiStatus=401;}};
}

(async()=>{
  await checkVendoredSdk();
  const ok=setup();
  await ok.client.start(async()=>ok.calls.push('boot'));
  assert.ok(ok.calls.indexOf('boot')<ok.calls.indexOf('ready'));
  assert.equal(ok.document.documentElement.dataset.theme,'dark');
  ok.theme('light');assert.equal(ok.document.documentElement.dataset.theme,'light');
  assert.ok(ok.calls.some(c=>c.url==='/salla/embedded?theme=dark'));
  await ok.client.request('products?merchant=123');
  const request=ok.calls.at(-1);assert.equal(request.options.credentials,'omit');
  assert.equal(request.options.headers.get('Authorization'),'Bearer app-session');
  assert.equal(await ok.client.confirm('discard?'),false);
  ok.failApi();await assert.rejects(ok.client.request('products?merchant=123'));
  assert.ok(ok.main.children.some(x=>x.className==='embedded-session-notice'));
  assert.ok(!ok.calls.includes('refresh'),'no automatic reload that loses edits');
  const denied=setup({exchangeOk:false});let booted=false;
  await denied.client.start(async()=>{booted=true;});assert.equal(booted,false);
  assert.ok(!denied.calls.includes('ready'));assert.ok(denied.calls.includes('destroy'));
  const direct=setup({framed:false});await direct.client.start(async()=>{throw Error('must not boot');});
  assert.equal(direct.calls.length,0);
  console.log('Embedded client checks passed: verification, readiness, theme changes, bearer requests, expiry and direct-link handling.');
})().catch(error=>{console.error(error);process.exitCode=1;});
