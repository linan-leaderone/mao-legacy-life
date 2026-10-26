import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import vm from 'node:vm';
const template=readFileSync(new URL('../scripts/pwa-worker-template.js',import.meta.url),'utf8');
const html='<html><meta name="mao-life-build" content="ios-pwa"><meta name="mao-life-release" content="test"></html>';
const fixture=[{path:'index.html',text:html},{path:'assets/app.js',text:'const app=1;'},{path:'maps/FRA-ADM2-boundaries.json',text:'{"features":{}}',lazy:true}];
const assets=fixture.map(({path,text,lazy})=>({path,lazy,sha256:createHash('sha256').update(text).digest('hex')}));
function worker({fail=false,wrongHash=false,wrongMap=false}={}){
  const listeners={},stores=new Map(),calls=[],messages=[];let network=true;
  const caches={keys:async()=>[...stores.keys()],delete:async k=>stores.delete(k),open:async k=>{if(!stores.has(k))stores.set(k,new Map());const entries=stores.get(k);return {put:async(url,response)=>entries.set(String(url),response.clone()),match:async url=>entries.get(String(url))?.clone()};}};
  const self={registration:{scope:'https://example.test/app/'},clients:{claim:async()=>{},matchAll:async()=>[{postMessage:m=>messages.push(m)}]},addEventListener:(kind,fn)=>{listeners[kind]=fn;}};
  const fetch=async request=>{calls.push(request.url);if(!network||fail&&request.url.endsWith('app.js'))throw new Error('offline');if(request.url.endsWith('/index.html'))throw new Error('Hosting canonical redirect');const entry=request.url===self.registration.scope?fixture[0]:fixture.find(a=>request.url.endsWith(a.path));return new Response((wrongHash&&entry?.path.endsWith('.js'))||(wrongMap&&entry?.lazy)?'wrong bytes':entry?.text||'missing',{status:entry?200:404});};
  vm.runInNewContext(template.replace('__BUILD_VERSION__','"test"').replace('__PRECACHE_ASSETS__',JSON.stringify(assets)),{self,caches,fetch,URL,Request,Response,TextDecoder,crypto:webcrypto,Uint8Array,Array,Map});
  const lifecycle=kind=>{let promise;listeners[kind]({waitUntil:p=>promise=p});return promise;};
  return {listeners,stores,calls,messages,caches,lifecycle,offline:()=>network=false};
}
test('iOS cache becomes ready only after every versioned application asset is stored',async()=>{
  const w=worker();await w.lifecycle('install');assert.equal(w.calls.length,2);
  assert.equal(w.calls[0],'https://example.test/app/');
  let reply,promise;w.listeners.message({data:{type:'MAO_CACHE_STATUS'},ports:[{postMessage:r=>reply=r}],waitUntil:p=>promise=p});await promise;
  assert.equal(reply.ready,true);assert.equal(reply.version,'test');
  await w.lifecycle('activate');assert.equal(w.messages[0].ready,true);
});
test('offline navigation and bundled assets are served from the installed cache',async()=>{
  const w=worker();await w.lifecycle('install');w.offline();
  for(const url of ['https://example.test/app/','https://example.test/app/index.html','https://example.test/app/assets/app.js']){
    let response;w.listeners.fetch({request:new Request(url),respondWith:p=>response=p});assert.ok(response);assert.equal((await response).status,200);
  }
  assert.equal(w.calls.length,2);
});
test('authentication URLs, query strings, external requests and API posts are never intercepted',async()=>{
  const w=worker();await w.lifecycle('install');
  for(const [url,method]of [['https://example.test/signin-with-chatgpt','GET'],['https://example.test/app/?token=secret','GET'],['https://api.deepseek.com/chat/completions','POST'],['https://example.test/app/','POST'],['https://other.test/app/assets/app.js','GET']]){
    w.listeners.fetch({request:new Request(url,{method}),respondWith:()=>assert.fail('unexpected interception')});
  }
});
test('incomplete or mixed-version downloads roll back the new cache and preserve the older one',async()=>{
  for(const args of [{fail:true},{wrongHash:true}]){
    const w=worker(args);await w.caches.open('mao-life-ios-older');
    await assert.rejects(w.lifecycle('install'));
    assert.equal(w.stores.has('mao-life-ios-test'),false);assert.equal(w.stores.has('mao-life-ios-older'),true);
  }
});
test('activation cleans only this app old static caches and leaves user storage untouched',async()=>{
  const w=worker();await w.caches.open('unrelated-app');await w.caches.open('mao-life-ios-older');await w.lifecycle('install');await w.lifecycle('activate');
  assert.equal(w.stores.has('mao-life-ios-older'),false);assert.equal(w.stores.has('unrelated-app'),true);
  assert.doesNotMatch(template,/localStorage|indexedDB|skipWaiting/);
});

test('global county layers load on demand, verify their version, then work offline',async()=>{
  const w=worker();await w.lifecycle('install');assert.equal(w.calls.length,2);
  const url='https://example.test/app/maps/FRA-ADM2-boundaries.json';
  const read=()=>{let promise;w.listeners.fetch({request:new Request(url),respondWith:p=>promise=p});return promise;};
  assert.equal(await (await read()).text(),'{"features":{}}');assert.equal(w.calls.length,3);
  w.offline();assert.equal(await (await read()).text(),'{"features":{}}');assert.equal(w.calls.length,3);
  const bad=worker({wrongMap:true});await bad.lifecycle('install');let result;
  bad.listeners.fetch({request:new Request(url),respondWith:p=>result=p});await assert.rejects(result,/version mismatch/i);
  assert.ok(bad.stores.get('mao-life-ios-test').has('https://example.test/app/__offline-ready__'));
  assert.equal(bad.stores.get('mao-life-ios-test').has(url),false);
});
