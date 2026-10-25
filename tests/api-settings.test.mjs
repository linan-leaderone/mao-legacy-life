import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSettings,activeConnection,normalizeBaseUrl,resetProviderConnection,migrateBundledGemini,connectionFingerprint,GEMINI_RELAY_URL,GEMINI_OFFICIAL_URL,DEFAULT_MODELS} from '../src/api-settings.js';

const defaults={
  deepseek:{apiKey:'placeholder-deepseek',model:'deepseek-flash'},
  gemini:{apiKey:'placeholder-gemini',model:'gemini-4-argon',baseUrl:GEMINI_RELAY_URL,protocol:'gemini'},
  custom:{apiKey:'placeholder-custom',model:'test-model',baseUrl:'https://example.test/v1beta',protocol:'gemini'}
};

test('provider defaults initialize independent profiles and retain custom protocol',()=>{
  const s=normalizeSettings(undefined,defaults);
  assert.equal(s.provider,'deepseek');assert.equal(s.mode,'online');assert.equal(s.providerRevision,7);
  assert.deepEqual(s.providers,defaults);
  s.providers.deepseek.apiKey='changed';assert.equal(defaults.deepseek.apiKey,'placeholder-deepseek');
  assert.equal(s.providers.gemini.apiKey,'placeholder-gemini');
});

test('legacy provider and offline settings preserve only the matching credential',()=>{
  for(const provider of ['deepseek','gemini']){
    const legacy={mode:provider,apiKey:`legacy-${provider}`,model:`${provider}-test`};
    const s=normalizeSettings(legacy,defaults);
    assert.equal(s.provider,provider);assert.equal(s.mode,'online');
    assert.equal(s.providers[provider].apiKey,legacy.apiKey);assert.equal(s.providers[provider].model,legacy.model);
    const other=provider==='gemini'?'deepseek':'gemini';assert.deepEqual(s.providers[other],defaults[other]);
    const offline=normalizeSettings({...legacy,mode:'offline'},defaults);
    assert.equal(offline.mode,'offline');assert.equal(offline.provider,provider);assert.equal(offline.providers[provider].apiKey,legacy.apiKey);
  }
  const c=normalizeSettings({apiKey:'legacy-custom',model:'vendor/model:latest',baseURL:'http://localhost:11434/v1'},defaults);
  assert.equal(c.provider,'custom');assert.equal(c.providers.custom.apiKey,'legacy-custom');assert.equal(c.providers.custom.baseUrl,'http://localhost:11434/v1');
});

test('saved empty key and model do not resurrect defaults or cross provider boundaries',()=>{
  for(const provider of ['deepseek','gemini','custom']){
    const s=normalizeSettings({provider,mode:'online',providers:{[provider]:{apiKey:'',model:''}}},defaults);
    assert.equal(s.providers[provider].apiKey,'');assert.equal(s.providers[provider].model,'');
    const restored=normalizeSettings(JSON.parse(JSON.stringify(s)),defaults);
    assert.deepEqual(restored,s);
    for(const other of ['deepseek','gemini','custom'].filter(p=>p!==provider))assert.equal(s.providers[other].apiKey,defaults[other].apiKey);
  }
});

test('switching the selected provider changes only the active connection',()=>{
  const s=normalizeSettings({},defaults),snapshot=structuredClone(s.providers);
  for(const provider of ['custom','gemini','deepseek','gemini']){
    const active=activeConnection({...s,provider});
    assert.equal(active.provider,provider);assert.equal(active.apiKey,defaults[provider].apiKey);
    assert.equal(active.model,defaults[provider].model);assert.deepEqual(s.providers,snapshot);
    if(provider==='deepseek'){assert.equal(active.protocol,'openai');assert.equal(active.baseUrl,'https://api.deepseek.com');}
    if(provider==='gemini'){assert.equal(active.protocol,'gemini');assert.equal(active.baseUrl,GEMINI_RELAY_URL);}
  }
});

test('explicit provider selection wins over model-name heuristics and obsolete flat fields',()=>{
  const s=normalizeSettings({provider:'custom',mode:'online',apiKey:'stale-key',model:'gemini-obsolete',providers:{custom:{apiKey:'new-custom',model:'gemini-compatible',baseUrl:'https://gateway.test/v1',protocol:'openai'},gemini:{apiKey:'saved-google',model:'gemini-test'}}},defaults);
  const a=activeConnection(s);assert.equal(a.provider,'custom');assert.equal(a.apiKey,'new-custom');assert.equal(a.protocol,'openai');assert.equal(a.model,'gemini-compatible');
  assert.equal(s.providers.gemini.apiKey,'saved-google');
});

test('invalid storage shapes normalize without sharing mutable profile state',()=>{
  for(const value of [null,0,'bad',[],{providers:null},{providers:{gemini:null,custom:'bad'}}]){
    const s=normalizeSettings(value,defaults);assert.ok(['deepseek','gemini','custom'].includes(s.provider));
    for(const p of ['deepseek','gemini','custom'])assert.equal(typeof s.providers[p].apiKey,'string');
  }
});

test('custom service URLs normalize full generation and model endpoints without duplicating paths',()=>{
  for(const [url,protocol,expected] of [
    ['https://gateway.test','openai','https://gateway.test/v1'],
    ['https://gateway.test/v1/chat/completions/','openai','https://gateway.test/v1'],
    ['https://gateway.test/api/openai/v1/models','openai','https://gateway.test/api/openai/v1'],
    ['https://gateway.test','anthropic','https://gateway.test/v1'],
    ['https://gateway.test/proxy/v1/messages','anthropic','https://gateway.test/proxy/v1'],
    ['https://gateway.test/v1/models','anthropic','https://gateway.test/v1'],
    ['https://gateway.test','gemini','https://gateway.test/v1beta'],
    ['https://gateway.test/v1beta/models','gemini','https://gateway.test/v1beta'],
    ['https://gateway.test/v1beta/models/gemini-test:generateContent','gemini','https://gateway.test/v1beta'],
    ['http://localhost:11434/v1/chat/completions','openai','http://localhost:11434/v1'],
    ['http://127.0.0.1:8080/v1','openai','http://127.0.0.1:8080/v1'],
    ['http://[::1]:8080/v1','openai','http://[::1]:8080/v1']
  ])assert.equal(normalizeBaseUrl(url,protocol),expected,url);
});

test('custom service URLs reject credentials, query keys, fragments and unsafe transport',()=>{
  for(const url of ['', 'gateway.test', 'https://', 'file:///tmp/api','ftp://gateway.test/v1','javascript:alert(1)','http://gateway.test/v1','http://localhost.example.test/v1','https://user:password@gateway.test/v1','https://user@gateway.test/v1','https://gateway.test/v1?key=placeholder','https://gateway.test/v1#fragment'])assert.throws(()=>normalizeBaseUrl(url,'openai'),undefined,url);
  assert.throws(()=>normalizeBaseUrl('https://gateway.test/v1','unknown'));
});

test('new Gemini profiles use the verified relay model without acquiring another provider key',()=>{
  const s=normalizeSettings({provider:'gemini'}),active=activeConnection(s);
  assert.equal(active.model,'gemini-4-argon');assert.equal(active.model,DEFAULT_MODELS.gemini);
  assert.equal(active.baseUrl,GEMINI_RELAY_URL);assert.equal(active.protocol,'gemini');assert.equal(active.apiKey,'');
  const personal=normalizeSettings({},defaults);assert.equal(personal.providers.gemini.apiKey,'placeholder-gemini');
});

test('legacy stored Google credentials never migrate silently to the third-party relay',()=>{
  for(const saved of [
    {providerRevision:4,provider:'gemini',providers:{gemini:{apiKey:'saved-google',model:'gemini-3.5-flash'}}},
    {mode:'gemini',apiKey:'saved-google',model:'gemini-3.5-flash'}
  ]){
    const s=normalizeSettings(saved,defaults),active=activeConnection(s);
    assert.equal(active.baseUrl,GEMINI_OFFICIAL_URL);assert.equal(active.protocol,'gemini');
    assert.equal(active.apiKey,'saved-google');assert.equal(active.model,'gemini-3.5-flash');
    assert.deepEqual(normalizeSettings(s,defaults),s);
  }
});

test('explicit Gemini endpoints and protocol survive normalization and default reset is isolated',()=>{
  const s=normalizeSettings({provider:'gemini',mode:'offline',providers:{gemini:{apiKey:'chosen-key',model:'chosen-model',baseUrl:'https://chosen.test/v1',protocol:'openai'},custom:{apiKey:'custom-saved'}}},defaults);
  assert.equal(activeConnection(s).baseUrl,'https://chosen.test/v1');assert.equal(activeConnection(s).protocol,'openai');
  const reset=resetProviderConnection(s,'gemini',defaults);
  assert.deepEqual(reset.providers.gemini,defaults.gemini);assert.equal(reset.mode,'offline');assert.equal(reset.provider,'gemini');
  assert.deepEqual(reset.providers.custom,s.providers.custom);assert.deepEqual(reset.providers.deepseek,s.providers.deepseek);
  assert.equal(s.providers.gemini.apiKey,'chosen-key');
  const publicReset=resetProviderConnection(s,'gemini',{});assert.equal(publicReset.providers.gemini.apiKey,'');assert.equal(publicReset.providers.gemini.baseUrl,GEMINI_RELAY_URL);
});

test('upgrades only an old bundled Google credential and preserves all other user settings',()=>{
  const oldKey='test-old-bundled-credential',fingerprints=[connectionFingerprint(oldKey)];
  const saved={providerRevision:5,provider:'gemini',mode:'offline',providers:{gemini:{apiKey:oldKey,model:'gemini-3.5-flash',baseUrl:GEMINI_OFFICIAL_URL},deepseek:{apiKey:'own-key',model:'own-model'}}};
  const result=migrateBundledGemini(saved,defaults,fingerprints);
  assert.deepEqual(result.providers.gemini,defaults.gemini);assert.equal(result.mode,'offline');
  assert.equal(result.providers.deepseek.apiKey,'own-key');assert.equal(saved.providers.gemini.apiKey,oldKey);
  const publicResult=migrateBundledGemini(saved,{},fingerprints);
  assert.equal(publicResult.providers.gemini.baseUrl,GEMINI_RELAY_URL);assert.equal(publicResult.providers.gemini.apiKey,'');
  for(const variant of [
    {...saved,providers:{gemini:{...saved.providers.gemini,apiKey:'my-own-google'}}},
    {...saved,providers:{gemini:{...saved.providers.gemini,baseUrl:'https://custom.example/v1beta'}}},
    {...saved,providers:{gemini:{...saved.providers.gemini,apiKey:''}}}
  ])assert.equal(migrateBundledGemini(variant,defaults,fingerprints),variant);
  const flat=migrateBundledGemini({mode:'gemini',apiKey:oldKey,model:'gemini-3.5-flash'},defaults,fingerprints);
  assert.equal(flat.provider,'gemini');assert.equal(flat.apiKey,undefined);assert.deepEqual(flat.providers.gemini,defaults.gemini);
});

test('revision stamps do not prevent repair of a stale bundled Google connection',()=>{
  const oldKey='test-old-bundled-credential',fingerprints=[connectionFingerprint(oldKey)];
  for(const providerRevision of [undefined,5,6,7,8]){
    const saved={providerRevision,provider:'deepseek',mode:'offline',providers:{gemini:{apiKey:oldKey,baseUrl:GEMINI_OFFICIAL_URL,model:'gemini-3.5-flash'},deepseek:{apiKey:'keep-deepseek',model:'keep-model'}}};
    const migrated=migrateBundledGemini(saved,defaults,fingerprints);
    assert.deepEqual(migrated.providers.gemini,defaults.gemini);
    assert.equal(migrated.provider,'deepseek');assert.equal(migrated.mode,'offline');
    assert.deepEqual(migrated.providers.deepseek,saved.providers.deepseek);
    const normalized=normalizeSettings(migrated,defaults);
    assert.deepEqual(normalizeSettings(normalized,defaults),normalized);
  }
});

test('authorized relay key in a Google form repairs the whole connection and keeps the key in public builds',()=>{
  const key='test-authorized-relay-credential',relayFingerprints=[connectionFingerprint(key)];
  for(const providerRevision of [6,7])for(const endpoint of [undefined,'',GEMINI_OFFICIAL_URL,`${GEMINI_OFFICIAL_URL}/`,'https://generativelanguage.googleapis.com/v1','https://generativelanguage.googleapis.com/v1beta/models']){
    const source={apiKey:` ${key} `,model:'gemini-3.5-flash',protocol:'openai',...(endpoint===undefined?{}:{baseUrl:endpoint})};
    const saved={providerRevision,provider:'gemini',mode:'online',providers:{gemini:source,custom:{apiKey:'keep-custom',model:'keep-model',baseUrl:'https://custom.test/v1',protocol:'openai'}}};
    for(const buildDefaults of [{},defaults]){
      const result=migrateBundledGemini(saved,buildDefaults,[],relayFingerprints);
      assert.deepEqual(result.providers.gemini,{apiKey:key,model:DEFAULT_MODELS.gemini,baseUrl:GEMINI_RELAY_URL,protocol:'gemini'});
      assert.deepEqual(result.providers.custom,saved.providers.custom);
      assert.equal(saved.providers.gemini,source);
      const normalized=normalizeSettings(result,buildDefaults);
      assert.deepEqual(activeConnection(normalized),{provider:'gemini',mode:'online',...result.providers.gemini});
      assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(normalized)),buildDefaults),normalized);
      assert.equal(migrateBundledGemini(normalized,buildDefaults,[],relayFingerprints),normalized);
    }
  }
  const flat={provider:'gemini',mode:'offline',apiKey:key,baseURL:GEMINI_OFFICIAL_URL,model:'gemini-3.5-flash',protocol:'openai'};
  const migrated=migrateBundledGemini(flat,{},[],relayFingerprints);
  assert.equal(migrated.provider,'gemini');assert.equal(migrated.mode,'offline');
  for(const obsolete of ['apiKey','model','baseUrl','baseURL','protocol'])assert.equal(Object.hasOwn(migrated,obsolete),false);
  assert.equal(normalizeSettings(migrated).providers.gemini.apiKey,key);
});

test('relay repair never changes unknown keys, a cleared key or a chosen non-Google endpoint',()=>{
  const key='test-authorized-relay-credential',fingerprints=[connectionFingerprint(key)];
  for(const connection of [
    {apiKey:'saved-google',baseUrl:GEMINI_OFFICIAL_URL,model:'gemini-my-model'},
    {apiKey:'sk-unrelated-provider',baseUrl:GEMINI_OFFICIAL_URL},
    {apiKey:'',baseUrl:GEMINI_OFFICIAL_URL},
    {apiKey:key,baseUrl:'https://custom.test/v1',protocol:'openai'},
    {apiKey:key,baseUrl:'https://generativelanguage.googleapis.com.example.test/v1beta'},
    {apiKey:key,baseUrl:'https://generativelanguage.googleapis.com@custom.test/v1beta'},
    {apiKey:key,baseUrl:'invalid-address'},
    {apiKey:key,baseUrl:GEMINI_RELAY_URL,model:'manually-selected-model'}
  ]){
    const saved={providerRevision:6,provider:'gemini',providers:{gemini:connection}};
    assert.equal(migrateBundledGemini(saved,defaults,[],fingerprints),saved);
  }
});

test('migration respects flat provider selection and never resurrects obsolete flat credentials',()=>{
  const key='test-authorized-relay-credential',fingerprints=[connectionFingerprint(key)];
  for(const saved of [
    {provider:'custom',apiKey:key,model:'gemini-3.5-flash',baseUrl:GEMINI_OFFICIAL_URL},
    {provider:'deepseek',apiKey:key,model:'gemini-3.5-flash'},
    {mode:'custom',apiKey:key,model:'gemini-3.5-flash',baseUrl:GEMINI_OFFICIAL_URL},
    {apiKey:key,model:'gemini-3.5-flash',baseUrl:GEMINI_OFFICIAL_URL},
    {provider:'gemini',apiKey:key,model:'gemini-3.5-flash',providers:{gemini:{apiKey:''}}},
    {provider:'gemini',apiKey:key,model:'gemini-3.5-flash',providers:{}}
  ])assert.equal(migrateBundledGemini(saved,defaults,[],fingerprints),saved);
});
