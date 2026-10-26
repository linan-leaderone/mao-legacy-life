/* This template is filled by build-ios-web.mjs; no user records or API replies are cached. */
const VERSION=__BUILD_VERSION__;
const ASSETS=__PRECACHE_ASSETS__;
const CACHE='mao-life-ios-'+VERSION;
const ROOT=new URL('./',self.registration.scope);
const PAGE=new URL('index.html',ROOT).href;
const READY=new URL('__offline-ready__',ROOT).href;
const urls=new Map(ASSETS.map(asset=>[new URL(asset.path,ROOT).href,asset]));

async function populate(){
  const cache=await caches.open(CACHE);
  try{
    for(const [url,asset] of urls){
      if(asset.lazy)continue;
      // Static hosting canonicalizes /index.html to /. Fetch that canonical URL directly.
      const source=asset.path==='index.html'?ROOT.href:url;
      const response=await fetch(new Request(source,{cache:'reload',credentials:'same-origin',redirect:'error'}));
      if(!response.ok||response.redirected)throw new Error('Asset unavailable');
      const data=await response.clone().arrayBuffer();
      if(asset.path==='index.html'){
        const html=new TextDecoder().decode(data);
        if(!html.includes('name="mao-life-build" content="ios-pwa"')||!html.includes('name="mao-life-release" content="'+VERSION+'"'))throw new Error('Application page unavailable');
      }else{
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
        if(digest!==asset.sha256)throw new Error('Asset version mismatch');
      }
      await cache.put(url,response);
    }
    await cache.put(READY,new Response(VERSION));
  }catch(error){await caches.delete(CACHE);throw error;}
}
self.addEventListener('install',event=>event.waitUntil(populate()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith('mao-life-ios-')&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
  for(const client of await self.clients.matchAll({type:'window'}))client.postMessage({type:'MAO_OFFLINE_STATUS',ready:true,version:VERSION});
})()));
self.addEventListener('message',event=>{
  if(event.data?.type!=='MAO_CACHE_STATUS')return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE),ready=!!(await cache.match(READY));
    const reply={type:'MAO_OFFLINE_STATUS',ready,version:VERSION};
    if(event.ports?.[0])event.ports[0].postMessage(reply);else event.source?.postMessage(reply);
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==ROOT.origin)return;
  // Authentication, external APIs and unknown paths always go to the network.
  const isPage=(url.pathname===ROOT.pathname||url.pathname===new URL(PAGE).pathname)&&!url.search;
  const key=isPage?PAGE:url.href;
  if(!urls.has(key))return;
  event.respondWith((async()=>{
    const cached=await (await caches.open(CACHE)).match(key);
    if(cached)return cached;
    const asset=urls.get(key);
    const response=await fetch(asset.lazy?new Request(request,{redirect:'error',cache:'no-cache'}):request);
    if(asset.lazy&&response.ok&&!response.redirected){
      const bytes=await response.clone().arrayBuffer();
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==asset.sha256)throw new Error('Map version mismatch');
      await (await caches.open(CACHE)).put(key,response.clone());
    }
    return response;
  })());
});
