import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGame} from '../src/engine.js';
import {buildPrompt} from '../src/deepseek.js';
import {normalizeSettings,GEMINI_RELAY_URL} from '../src/api-settings.js';
import {generateMonth,listModels} from '../src/api.js';
import {requestJSON} from '../src/api-transport.js';

const lore=JSON.parse((await readFile(new URL('../src/data/lore.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const state=()=>createGame({name:'林安',age:18,place:'福建',background:'ordinary',backgroundText:'我在当地生活，平时读书。',goal:'照顾家人',seed:'api-provider-test'},lore);
const action={label:'照常生活',passive:true};
const settings=(provider,protocol='openai',extra={})=>normalizeSettings({provider,mode:'online',providers:{
  deepseek:{apiKey:'placeholder-deepseek',model:'deepseek-flash'},gemini:{apiKey:'placeholder-google',model:'gemini-3.5-flash'},
  custom:{apiKey:'placeholder-custom',model:protocol==='gemini'?'models/gemini-test':'vendor/model:latest',baseUrl:protocol==='gemini'?'https://gateway.test/proxy/v1beta/models/gemini-test:generateContent':'https://gateway.test/proxy/v1',protocol,...extra}
}});
const valid=s=>({title:'新近的生活',narrative:'早晨，你把借来的几本书放在桌上，按自己的安排读完了其中两章。午后家里来了一位老朋友，你和他聊了近来的工作，晚饭后整理了书桌。',consequence:'你按原先的安排处理了家里的杂事，给家人准备晚饭，抽空把借来的书读完。几件拖延的小事已经办好，接下来可以继续照顾日常生活。',location:s.location,memory:'',actionDelta:{},options:buildPrompt(s,action,lore).decision?[{label:'继续读完借来的书',description:'整理已经读过的章节。',delta:{intelligence:1}},{label:'联系熟悉的朋友',description:'约一个合适的时间见面。',delta:{connections:1}},{label:'在家做些整理',description:'把积存的杂物收拾好。',delta:{stress:-1}}]:[]});
const envelope=(protocol,v)=>protocol==='gemini'?{candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(v)}]}}]}:protocol==='anthropic'?{content:[{type:'text',text:JSON.stringify(v)}],stop_reason:'end_turn'}:{choices:[{message:{content:JSON.stringify(v)},finish_reason:'stop'}]};
const response=(value,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(value),json:async()=>value});
async function withFetch(fn,run){const original=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=original;}}

test('DeepSeek and Gemini select distinct official endpoints and only their own keys',async()=>{
  for(const provider of ['deepseek','gemini']){
    const s=state(),before=structuredClone(s),requests=[];
    const result=await withFetch(async(url,init)=>{requests.push({url:String(url),...init,body:JSON.parse(init.body)});return response(envelope(provider==='gemini'?'gemini':'openai',valid(s)));},()=>generateMonth(s,action,lore,null,settings(provider)));
    assert.equal(requests.length,1);assert.equal(result.title,'新近的生活');assert.deepEqual(s,before);
    const r=requests[0],h=new Headers(r.headers);
    if(provider==='deepseek'){assert.match(r.url,/^https:\/\/api\.deepseek\.com\/(?:v1\/)?chat\/completions$/);assert.equal(h.get('authorization'),'Bearer placeholder-deepseek');assert.equal(h.get('x-goog-api-key'),null);assert.equal(r.body.model,'deepseek-flash');}
    else{assert.match(r.url,/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash:generateContent$/);assert.equal(h.get('x-goog-api-key'),'placeholder-google');assert.equal(h.get('authorization'),null);assert.ok(r.body.systemInstruction);assert.ok(Array.isArray(r.body.contents));}
    assert.equal(r.url.includes('placeholder'),false);assert.equal(r.body.apiKey,undefined);
    for(const other of provider==='deepseek'?['placeholder-google','placeholder-custom']:['placeholder-deepseek','placeholder-custom'])assert.equal(JSON.stringify(r).includes(other),false);
  }
});

test('custom OpenAI preserves slash model IDs and sends a minimal compatible chat request',async()=>{
  const s=state();let request;
  await withFetch(async(url,init)=>{request={url,headers:new Headers(init.headers),body:JSON.parse(init.body)};return response(envelope('openai',valid(s)));},()=>generateMonth(s,action,lore,null,settings('custom','openai',{baseUrl:'https://gateway.test/proxy/v1/chat/completions'})));
  assert.equal(request.url,'https://gateway.test/proxy/v1/chat/completions');assert.equal(request.headers.get('authorization'),'Bearer placeholder-custom');assert.equal(request.body.model,'vendor/model:latest');
  assert.ok(Array.isArray(request.body.messages));assert.equal(request.body.messages[0].role,'system');
  for(const unsupported of ['thinking','response_format','temperature'])assert.equal(request.body[unsupported],undefined);
});

test('custom Gemini removes models prefix once and supplies its own native request',async()=>{
  const s=state();let request;
  await withFetch(async(url,init)=>{request={url,headers:new Headers(init.headers),body:JSON.parse(init.body)};return response(envelope('gemini',valid(s)));},()=>generateMonth(s,action,lore,null,settings('custom','gemini')));
  assert.equal(request.url,'https://gateway.test/proxy/v1beta/models/gemini-test:generateContent');assert.equal(request.headers.get('x-goog-api-key'),'placeholder-custom');assert.equal(request.headers.get('authorization'),null);
  assert.ok(request.body.systemInstruction.parts[0].text.includes('currentAgeYears'));assert.equal(request.body.contents[0].role,'user');assert.ok(request.body.contents[0].parts[0].text);
});

test('custom Anthropic uses Messages headers and an independent system prompt',async()=>{
  const s=state();let request;
  await withFetch(async(url,init)=>{request={url,headers:new Headers(init.headers),body:JSON.parse(init.body)};return response(envelope('anthropic',valid(s)));},()=>generateMonth(s,action,lore,null,settings('custom','anthropic',{model:'claude-test',baseUrl:'https://gateway.test/proxy/v1/messages'})));
  assert.equal(request.url,'https://gateway.test/proxy/v1/messages');assert.equal(request.headers.get('x-api-key'),'placeholder-custom');assert.ok(request.headers.get('anthropic-version'));assert.equal(request.headers.get('authorization'),null);assert.equal(request.body.model,'claude-test');assert.ok(request.body.max_tokens>0);assert.equal(typeof request.body.system,'string');assert.equal(request.body.messages[0].role,'user');
});

test('all providers reject truncated or malformed output without mutating the current month',async()=>{
  for(const protocol of ['openai','gemini','anthropic']){
    for(const type of ['length','json']){
      const s=state(),before=structuredClone(s),reply=envelope(protocol,valid(s));
      if(protocol==='openai'){if(type==='length')reply.choices[0].finish_reason='length';else reply.choices[0].message.content='{incomplete';}
      if(protocol==='gemini'){if(type==='length')reply.candidates[0].finishReason='MAX_TOKENS';else reply.candidates[0].content.parts[0].text='{incomplete';}
      if(protocol==='anthropic'){if(type==='length')reply.stop_reason='max_tokens';else reply.content[0].text='{incomplete';}
      let calls=0;await withFetch(async()=>{calls++;return response(reply);},()=>assert.rejects(generateMonth(s,action,lore,null,settings('custom',protocol))));
      assert.equal(calls,1,`${protocol}:${type}`);assert.deepEqual(s,before);
    }
  }
});

test('style correction retries once using the same month and action without mutating state',async()=>{
  for(const protocol of ['openai','gemini','anthropic']){
    const s=state(),before=structuredClone(s),requests=[];
    await withFetch(async(url,init)=>{const body=JSON.parse(init.body);requests.push(body);const v=valid(s);if(requests.length===1)v.narrative='你的心情很沉。'+v.narrative;return response(envelope(protocol,v));},()=>generateMonth(s,action,lore,null,settings('custom',protocol)));
    assert.equal(requests.length,2);assert.deepEqual(s,before);
    const user=b=>protocol==='gemini'?b.contents[0].parts[0].text:b.messages[0].role==='system'?b.messages[1].content:b.messages[0].content;
    assert.equal(user(requests[0]),user(requests[1]));assert.match(JSON.stringify(requests[1]),/不要推进时间|不推进时间|同一/);
    const roles=protocol==='gemini'?requests[1].contents.map(x=>x.role):requests[1].messages.map(x=>x.role);
    assert.ok(roles.includes(protocol==='gemini'?'model':'assistant'));
  }
});

test('a second style failure stops after two requests and leaves the saved state untouched',async()=>{
  const s=state(),before=structuredClone(s);let calls=0;
  await withFetch(async()=>{calls++;return response(envelope('openai',{...valid(s),narrative:'你的心情很沉。'+valid(s).narrative}));},()=>assert.rejects(generateMonth(s,action,lore,null,settings('custom'))));
  assert.equal(calls,2);assert.deepEqual(s,before);
});

test('HTTP failures and upstream error payloads never expose credentials or submit a month',async()=>{
  const s=state(),before=structuredClone(s);let calls=0;
  await withFetch(async()=>{calls++;return response({error:{message:'Rejected secret placeholder-custom from https://example.test?key=placeholder-custom'}},401);},()=>assert.rejects(generateMonth(s,action,lore,null,settings('custom')),e=>{assert.equal(e.message.includes('placeholder-custom'),false);assert.match(e.message,/身份|密钥|验证|401|认证/);return true;}));
  assert.equal(calls,1);assert.deepEqual(s,before);
});

test('pre-cancelled and in-flight requests stop without advancing or issuing repair requests',async()=>{
  const s=state(),before=structuredClone(s),pre=new AbortController();pre.abort();let calls=0;
  await withFetch(async()=>{calls++;throw new Error('unexpected request');},()=>assert.rejects(generateMonth(s,action,lore,null,settings('custom'),pre.signal)));
  assert.equal(calls,0);
  const pending=new AbortController();
  await withFetch(async(url,init)=>{calls++;return await new Promise((resolve,reject)=>{init.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true});queueMicrotask(()=>pending.abort());});},()=>assert.rejects(generateMonth(s,action,lore,null,settings('custom'),pending.signal),/取消/));
  assert.equal(calls,1);assert.deepEqual(s,before);
});

test('cancellation in the launch turn prevents deferred browser and desktop requests from starting',async()=>{
  const originalWindow=globalThis.window;
  try{
    for(const native of [false,true]){
      let calls=0;const controller=new AbortController(),s=state();
      if(native)globalThis.window={desktopBridge:{requestApi:async()=>{calls++;return {status:200,body:JSON.stringify(envelope('openai',valid(s)))};},cancelApi:()=>{}}};
      else delete globalThis.window;
      await withFetch(async()=>{calls++;return response(envelope('openai',valid(s)));},async()=>{
        const promise=generateMonth(s,action,lore,null,settings('custom'),controller.signal);controller.abort();await assert.rejects(promise,/取消/);
      });
      assert.equal(calls,0,native?'desktop request started after cancellation':'browser request started after cancellation');
    }
  }finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('Gemini thought parts do not enter narration and thought signatures survive one repair',async()=>{
  const s=state();let calls=0,repair;
  await withFetch(async(url,init)=>{
    calls++;if(calls===2)repair=JSON.parse(init.body);
    const v=valid(s);if(calls===1)v.narrative='你的心情很沉。'+v.narrative;
    return response({candidates:[{finishReason:'STOP',content:{parts:[{text:'This private planning is not JSON.',thought:true},{text:JSON.stringify(v),thoughtSignature:'placeholder-signature'}]}}]});
  },()=>generateMonth(s,action,lore,null,settings('gemini')));
  assert.equal(calls,2);assert.equal(repair.contents[1].role,'model');assert.equal(repair.contents[1].parts[1].thoughtSignature,'placeholder-signature');
});

test('native or browser transport failures never disclose raw network error text',async()=>{
  const originalWindow=globalThis.window,s=state();
  try{
    delete globalThis.window;
    await withFetch(async()=>{throw new TypeError('placeholder-custom was rejected');},()=>assert.rejects(generateMonth(s,action,lore,null,settings('custom')),e=>{assert.equal(e.message.includes('placeholder-custom'),false);return true;}));
    globalThis.window={desktopBridge:{requestApi:async()=>{throw new Error('placeholder-custom was rejected');},cancelApi:()=>{}}};
    await assert.rejects(generateMonth(s,action,lore,null,settings('custom')),e=>{assert.equal(e.message.includes('placeholder-custom'),false);return true;});
  }finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('offline mode and invalid custom connection settings fail before network access',async()=>{
  const s=state();let calls=0;
  await withFetch(async()=>{calls++;throw new Error('should not connect');},async()=>{
    await assert.rejects(generateMonth(s,action,lore,null,{...settings('custom'),mode:'offline'}),/本地/);
    for(const override of [{baseUrl:'http://remote.test/v1'},{baseUrl:'https://user:password@gateway.test/v1'},{model:''},{model:'bad\nmodel'}])await assert.rejects(generateMonth(s,action,lore,null,settings('custom','openai',override)));
  });
  assert.equal(calls,0);
});

test('malformed model lists and repeated cursors terminate without exposing server payloads',async()=>{
  for(const protocol of ['openai','gemini','anthropic']){
    let calls=0;
    await withFetch(async()=>{calls++;if(protocol==='gemini')return response({models:[{name:'models/gemini-test',supportedGenerationMethods:['generateContent']}],nextPageToken:'same'});if(protocol==='anthropic')return response({data:[{id:'claude-test'}],has_more:true,last_id:'same'});return response({data:[null,{},42,{id:''}]});},()=>assert.rejects(listModels(settings('custom',protocol)),/模型|分页/));
    assert.equal(calls,protocol==='openai'?1:2);
  }
});

test('model queries honor the selected protocol, pagination and generation capability',async()=>{
  for(const [provider,protocol]of [['deepseek','openai'],['custom','openai'],['gemini','gemini'],['custom','anthropic']]){
    const calls=[];
    const models=await withFetch(async(url,init)=>{calls.push({url:String(url),headers:new Headers(init.headers),method:init.method});
      if(protocol==='gemini')return response(calls.length===1?{models:[{name:'models/gemini-test',supportedGenerationMethods:['generateContent']},{name:'models/embedding-test',supportedGenerationMethods:['embedContent']}],nextPageToken:'page-two'}:{models:[{name:'models/gemini-next',supportedGenerationMethods:['generateContent']}]});
      if(protocol==='anthropic')return response(calls.length===1?{data:[{id:'claude-test'}],has_more:true,last_id:'claude-test'}:{data:[{id:'claude-next'}],has_more:false});
      return response({data:[{id:provider==='deepseek'?'deepseek-flash':'vendor/model:latest'}]});
    },()=>listModels(settings(provider,protocol)));
    assert.ok(Array.isArray(models));assert.ok(models.length);for(const call of calls){assert.equal(call.method,'GET');assert.equal(call.url.includes('placeholder'),false);}
    if(protocol==='gemini'){assert.equal(calls.length,2);assert.ok(models.some(m=>m.replace(/^models\//,'')==='gemini-test'));assert.ok(models.some(m=>m.replace(/^models\//,'')==='gemini-next'));assert.equal(models.some(m=>/embedding/.test(m)),false);assert.match(calls[1].url,/pageToken=page-two/);assert.equal(calls[0].headers.get('x-goog-api-key'),'placeholder-google');}
    if(protocol==='anthropic'){assert.equal(calls.length,2);assert.deepEqual(models,['claude-test','claude-next']);assert.match(calls[1].url,/after_id=claude-test/);}
    if(provider==='custom'&&protocol==='openai')assert.deepEqual(models,['vendor/model:latest']);
  }
});

test('native desktop transport takes precedence and a failed native request never falls back to fetch',async()=>{
  const originalWindow=globalThis.window,s=state();let nativeCalls=0,fetchCalls=0,payload;
  try{
    globalThis.window={desktopBridge:{requestApi:async p=>{nativeCalls++;payload=p;return {status:200,body:JSON.stringify(envelope('openai',valid(s)))};},cancelApi:()=>{}}};
    await withFetch(async()=>{fetchCalls++;throw new Error('must not use browser transport');},()=>generateMonth(s,action,lore,null,settings('custom')));
    assert.equal(nativeCalls,1);assert.equal(fetchCalls,0);assert.equal(payload.url,'https://gateway.test/proxy/v1/chat/completions');assert.equal(payload.timeoutMs,60000);assert.equal(typeof payload.body,'string');
    globalThis.window.desktopBridge.requestApi=async()=>{nativeCalls++;return {error:true};};
    await withFetch(async()=>{fetchCalls++;throw new Error('must not fall back');},()=>assert.rejects(generateMonth(s,action,lore,null,settings('custom'))));
    assert.equal(fetchCalls,0);assert.equal(nativeCalls,2);
  }finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('Android bridge callbacks complete generation and cancellation ignores late replies',async()=>{
  const originalWindow=globalThis.window,s=state(),before=structuredClone(s);let fetchCalls=0,cancelledId,payload,controller;
  try{
    globalThis.window={NativeBridge:{requestApi:raw=>{payload=JSON.parse(raw);queueMicrotask(()=>window.__maoApiResponse(payload.id,{status:200,body:JSON.stringify(envelope('openai',valid(s)))}));},cancelApi:id=>{cancelledId=id;}}};
    await withFetch(async()=>{fetchCalls++;throw new Error('must not fetch');},()=>generateMonth(s,action,lore,null,settings('custom')));
    assert.equal(fetchCalls,0);assert.ok(payload.id);assert.equal(payload.timeoutMs,60000);
    controller=new AbortController();globalThis.window.NativeBridge.requestApi=raw=>{payload=JSON.parse(raw);queueMicrotask(()=>controller.abort());};
    await withFetch(async()=>{fetchCalls++;throw new Error('must not fetch');},()=>assert.rejects(generateMonth(s,action,lore,null,settings('custom'),controller.signal),/取消/));
    assert.equal(cancelledId,payload.id);window.__maoApiResponse(payload.id,{status:200,body:JSON.stringify(envelope('openai',valid(s)))});assert.deepEqual(s,before);assert.equal(fetchCalls,0);
  }finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('official DeepSeek generation and model discovery use both native transports with the DeepSeek key',async()=>{
  const originalWindow=globalThis.window,s=state(),before=structuredClone(s);let fetchCalls=0;
  try{
    for(const shell of ['desktop','android']){
      const requests=[];
      const reply=payload=>{requests.push(payload);return {status:200,body:JSON.stringify(payload.method==='GET'?{data:[{id:'deepseek-flash'},{id:'deepseek-pro'}]}:envelope('openai',valid(s)))};};
      globalThis.window=shell==='desktop'?{desktopBridge:{requestApi:async payload=>reply(payload),cancelApi:()=>{}}}:{NativeBridge:{requestApi:raw=>{const payload=JSON.parse(raw);queueMicrotask(()=>window.__maoApiResponse(payload.id,reply(payload)));},cancelApi:()=>{}}};
      await withFetch(async()=>{fetchCalls++;throw new Error('DeepSeek must use native transport');},async()=>{
        assert.deepEqual(await listModels(settings('deepseek')),['deepseek-flash','deepseek-pro']);
        const result=await generateMonth(s,action,lore,null,settings('deepseek'));assert.equal(result.source,'deepseek');
      });
      assert.equal(requests.length,2,shell);assert.equal(requests[0].url,'https://api.deepseek.com/models');assert.equal(requests[1].url,'https://api.deepseek.com/chat/completions');
      for(const r of requests){assert.equal(new Headers(r.headers).get('authorization'),'Bearer placeholder-deepseek');assert.equal(JSON.stringify(r).includes('placeholder-google'),false);assert.equal(JSON.stringify(r).includes('placeholder-custom'),false);}
    }
    assert.equal(fetchCalls,0);assert.deepEqual(s,before);
  }finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('new Gemini relay uses native headers and accepts its verified incomplete model metadata',async()=>{
  const config=normalizeSettings({provider:'gemini'}, {gemini:{apiKey:'placeholder-relay'}}),s=state(),requests=[];
  await withFetch(async(url,init)=>{
    requests.push({url,headers:new Headers(init.headers),method:init.method,body:init.body&&JSON.parse(init.body),redirect:init.redirect,credentials:init.credentials});
    return response(init.method==='GET'?{models:[{name:'gemini-4-argon'},{name:'not-generative',supportedGenerationMethods:['embedContent']}]}:envelope('gemini',valid(s)));
  },async()=>{
    assert.deepEqual(await listModels(config),['gemini-4-argon']);
    assert.equal((await generateMonth(s,action,lore,null,config)).source,'gemini');
  });
  assert.equal(requests[0].url,GEMINI_RELAY_URL+'/models');
  assert.equal(requests[1].url,GEMINI_RELAY_URL+'/models/gemini-4-argon:generateContent');
  for(const r of requests){assert.equal(r.headers.get('x-goog-api-key'),'placeholder-relay');assert.equal(r.headers.get('authorization'),null);assert.equal(r.redirect,'error');assert.equal(r.credentials,'omit');assert.equal(r.url.includes('placeholder'),false);}
});

test('Gemini OpenAI-compatible setting preserves the selected host, key, model and source',async()=>{
  const config=normalizeSettings({provider:'gemini',providers:{gemini:{apiKey:'placeholder-relay',model:'gemini-4-argon',baseUrl:'https://aiapi.shiwuyan.cn/v1',protocol:'openai'}}}),s=state(),requests=[];
  await withFetch(async(url,init)=>{requests.push({url,headers:new Headers(init.headers),body:init.body&&JSON.parse(init.body)});return response(init.method==='GET'?{data:[{id:'gemini-4-argon'}]}:envelope('openai',valid(s)));},async()=>{
    assert.deepEqual(await listModels(config),['gemini-4-argon']);assert.equal((await generateMonth(s,action,lore,null,config)).source,'gemini');
  });
  assert.equal(requests[0].url,'https://aiapi.shiwuyan.cn/v1/models');assert.equal(requests[1].url,'https://aiapi.shiwuyan.cn/v1/chat/completions');
  assert.equal(requests[1].body.model,'gemini-4-argon');for(const r of requests){assert.equal(r.headers.get('authorization'),'Bearer placeholder-relay');assert.equal(r.headers.get('x-goog-api-key'),null);}
});

test('the verified relay gets a bounded writing timeout and low thinking without changing other Gemini services',async()=>{
  const originalWindow=globalThis.window,s=state(),requests=[];
  try{
    globalThis.window={desktopBridge:{requestApi:async payload=>{requests.push(payload);return {status:200,body:JSON.stringify(envelope('gemini',valid(s)))};},cancelApi:()=>{}}};
    await generateMonth(s,action,lore,null,normalizeSettings({provider:'gemini'},{gemini:{apiKey:'placeholder-relay'}}));
    await generateMonth(s,action,lore,null,settings('gemini'));
    assert.equal(requests[0].timeoutMs,180000);assert.equal(requests[1].timeoutMs,60000);
    assert.deepEqual(JSON.parse(requests[0].body).generationConfig.thinkingConfig,{thinkingLevel:'low'});
    assert.equal(JSON.parse(requests[1].body).generationConfig.thinkingConfig,undefined);
    assert.equal(JSON.parse(requests[0].body).generationConfig.maxOutputTokens,6000);
    const relayBody=JSON.parse(requests[0].body),officialBody=JSON.parse(requests[1].body);
    assert.equal(relayBody.systemInstruction,undefined);
    assert.match(relayBody.contents[0].parts[0].text,/currentAgeYears/);
    assert.match(relayBody.contents[0].parts[0].text,/只输出一个合法 JSON 对象/);
    assert.doesNotThrow(()=>JSON.parse(officialBody.contents[0].parts[0].text));
  }finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('a longer writing timeout remains cancellable, ignores late native replies and caps at three minutes',async t=>{
  const originalWindow=globalThis.window;let payload,resolveNative,cancelledId;
  t.mock.timers.enable({apis:['setTimeout']});
  try{
    globalThis.window={desktopBridge:{requestApi:p=>{payload=p;return new Promise(resolve=>resolveNative=resolve);},cancelApi:id=>{cancelledId=id;}}};
    const pending=requestJSON('https://example.test/v1',{timeoutMs:999999,body:{}}),rejected=assert.rejects(pending,/180 秒/);
    await Promise.resolve();assert.equal(payload.timeoutMs,180000);
    t.mock.timers.tick(180000);await rejected;assert.equal(cancelledId,payload.id);
    resolveNative({status:200,body:'{}'});await Promise.resolve();
    const controller=new AbortController();const cancelledRequest=requestJSON('https://example.test/v1',{timeoutMs:180000,signal:controller.signal}),cancelled=assert.rejects(cancelledRequest,/取消/);
    await Promise.resolve();controller.abort();await cancelled;assert.equal(cancelledId,payload.id);
    resolveNative({status:200,body:'{}'});
  }finally{t.mock.timers.reset();if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;}
});

test('relay prose repair shares one three-minute deadline instead of starting a second full wait',async t=>{
  const originalWindow=globalThis.window,s=state(),requests=[];let now=1000000;
  t.mock.method(Date,'now',()=>now);
  try{
    globalThis.window={desktopBridge:{requestApi:async payload=>{
      requests.push(payload);now+=70000;
      const v=valid(s);if(requests.length===1)v.narrative='你的心情很沉。'+v.narrative;
      return {status:200,body:JSON.stringify(envelope('gemini',v))};
    },cancelApi:()=>{}}};
    const config=normalizeSettings({provider:'gemini'},{gemini:{apiKey:'placeholder-relay'}});
    await generateMonth(s,action,lore,null,config);
    assert.equal(requests.length,2);assert.equal(requests[0].timeoutMs,180000);assert.equal(requests[1].timeoutMs,110000);
    requests.length=0;
    window.desktopBridge.requestApi=async payload=>{
      requests.push(payload);now+=180000;
      return {status:200,body:JSON.stringify(envelope('gemini',{...valid(s),narrative:'你的心情很沉。'+valid(s).narrative}))};
    };
    await assert.rejects(generateMonth(s,action,lore,null,config),/180 秒/);
    assert.equal(requests.length,1);
  }finally{if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;t.mock.restoreAll();}
});
