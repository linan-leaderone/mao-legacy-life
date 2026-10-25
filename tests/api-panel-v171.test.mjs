import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {normalizeLanguage,translateUI} from '../src/language.js';
import {normalizeSettings,migrateBundledGemini,connectionFingerprint,activeConnection,normalizeBaseUrl,GEMINI_OFFICIAL_URL,GEMINI_RELAY_URL} from '../src/api-settings.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .+;\r?\n/gm,'').replace(/initializeIOSInstall\(\);\s*render\(\);\s*$/,'');
const fixtureKey='test-authorized-relay-key';
function form(){
  const nodes=new Map(),saved=new Map(),requests=[];
  const get=selector=>{
    if(!nodes.has(selector))nodes.set(selector,{value:'',checked:false,isConnected:true,textContent:'',classList:{remove(){},add(){}},addEventListener(name,fn){this['on'+name]=fn;}});
    return nodes.get(selector);
  };
  const panel={dataset:{provider:'gemini'},querySelector:get,querySelectorAll:selector=>selector==='[data-provider-choice]'?[]:selector.split(',').map(get)};
  const scope={structuredClone,normalizeLanguage,translateUI,localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
    normalizeSettings:(value,defaults)=>normalizeSettings(migrateBundledGemini(value,defaults,[],[connectionFingerprint(fixtureKey)]),defaults),
    activeConnection,normalizeBaseUrl,panel,listModels:async settings=>{requests.push(activeConnection(settings));return ['gemini-4-argon'];}};
  vm.createContext(scope);vm.runInContext(source,scope);
  vm.runInContext("settings=normalizeSettings({provider:'gemini',providers:{gemini:{apiKey:'visitor-google-key',baseUrl:'https://generativelanguage.googleapis.com/v1beta',protocol:'gemini',model:'gemini-3.5-flash'}}});bindApiPanel(panel);",scope);
  get('[data-api-url]').value=GEMINI_OFFICIAL_URL;get('[data-api-protocol]').value='gemini';get('[data-api-model]').value='gemini-3.5-flash';
  return {get,saved,requests,panel};
}

test('editing the key preserves the draft, then blur repairs and saves all visible connection fields',()=>{
  const f=form(),key=f.get('[data-api-key]');
  key.value=fixtureKey;key.oninput();
  assert.equal(f.get('[data-api-url]').value,GEMINI_OFFICIAL_URL);
  key.onchange();
  assert.equal(f.get('[data-api-url]').value,GEMINI_RELAY_URL);
  assert.equal(f.get('[data-api-model]').value,'gemini-4-argon');
  const saved=JSON.parse(f.saved.get('mao-life-settings-v1'));
  assert.equal(saved.providers.gemini.apiKey,fixtureKey);assert.equal(saved.providers.gemini.baseUrl,GEMINI_RELAY_URL);
  assert.equal(f.saved.has('mao-life-save-v1'),false);
});

test('test-connection repairs a stale form before sending and shows the same endpoint that was used',async()=>{
  const f=form();f.get('[data-api-key]').value=fixtureKey;
  await f.get('[data-test-api]').onclick();
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].baseUrl,GEMINI_RELAY_URL);
  assert.equal(f.requests[0].model,'gemini-4-argon');assert.equal(f.requests[0].apiKey,fixtureKey);
  assert.equal(f.get('[data-api-url]').value,f.requests[0].baseUrl);
  assert.match(f.get('[data-api-status]').textContent,/连接成功/);
});
