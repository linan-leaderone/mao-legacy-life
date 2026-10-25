import test from 'node:test';
import assert from 'node:assert/strict';
import {exportJSONFile} from '../src/file-export.js';

test('iPhone export shares the actual JSON file using a user initiated system sheet',async()=>{
  let payload;const nav={userAgent:'iPhone',canShare:({files})=>files[0].type==='application/json',share:async p=>{payload=p;}};
  assert.equal(await exportJSONFile('人生档案-甲.json','{"month":2}',{host:{},nav}),true);
  assert.equal(payload.files[0].name,'人生档案-甲.json');assert.equal(await payload.files[0].text(),'{"month":2}');
});
test('cancelling iPhone share does not start another download',async()=>{
  const nav={userAgent:'iPhone',canShare:()=>true,share:async()=>{throw new DOMException('cancel','AbortError');}};
  assert.equal(await exportJSONFile('a.json','{}',{host:{},nav,doc:{createElement:()=>assert.fail('unexpected fallback')}}),false);
});
test('unsupported file sharing falls back to an attached download and delayed cleanup',async()=>{
  let clicked=false,removed=false,cleaned=false,delay;const a={click(){clicked=true;},remove(){removed=true;}};
  const doc={createElement:()=>a,body:{append:el=>assert.equal(el,a)}};
  const nav={userAgent:'iPad',canShare:()=>false,share:()=>assert.fail('unsupported share')};
  await exportJSONFile('a.json','{}',{host:{},nav,doc,urlAPI:{createObjectURL:()=> 'blob:test',revokeObjectURL:url=>{assert.equal(url,'blob:test');cleaned=true;}},schedule:(fn,ms)=>{delay=ms;fn();}});
  assert.ok(clicked&&removed&&cleaned);assert.equal(delay,60000);assert.equal(a.download,'a.json');
});
test('existing desktop and Android exports retain native priority',async()=>{
  for(const name of ['desktopBridge','NativeBridge']){
    let called=false;await exportJSONFile('a.json','{}',{host:{[name]:{saveText:(file,body)=>{assert.equal(file,'a.json');assert.equal(body,'{}');called=true;}}},nav:{}});assert.ok(called);
  }
});
