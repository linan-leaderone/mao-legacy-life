import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {normalizeSettings} from '../src/api-settings.js';
import {generateMonth} from '../src/api.js';
import {createGame,advance} from '../src/engine.js';
const read=async path=>JSON.parse((await fs.readFile(new URL(path,import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const privateSettings=await read('../.private/settings.json'),lore=await read('../src/data/lore.json');
const settings=normalizeSettings({provider:'deepseek'},privateSettings.providers);
const results=[];
for(const [name,label]of [['毛泽东','我集中精神复活，站起来跟值守人员说话，询问现在是哪一年。'],['邓小平','我吞食较小的鱼群，吸收它们的力量，进化成游得更快的捕食鱼。'],['德仁','我在宫中整理年初的公开活动安排，和家人一起读书。']]){
  const state=createGame({name,seed:'v15-live-'+name},lore),action={label,custom:true},start=Date.now();
  try{
    const response=await generateMonth(state,action,lore,null,settings),next=advance(state,action,response,null,lore);
    assert.equal(next.month,1);assert.equal(next.current.source,'deepseek');
    if(name==='毛泽东')assert.equal(next.specialLife.resurrected,true);
    if(name==='邓小平')assert.ok(next.specialLife.stage>=1);
    const record={name,ok:true,elapsedMs:Date.now()-start,title:response.title,narrative:response.narrative,consequence:response.consequence,options:response.options.length,location:next.location,body:next.specialLife?.body};results.push(record);
    console.log(JSON.stringify({...record,narrative:undefined,consequence:undefined}));
  }catch(error){let message=String(error.message);for(const profile of Object.values(settings.providers))if(profile.apiKey)message=message.replaceAll(profile.apiKey,'[redacted]');const record={name,ok:false,elapsedMs:Date.now()-start,error:message};results.push(record);console.log(JSON.stringify(record));}
}
await fs.writeFile(new URL('../docs/API-SAMPLES-v1.5.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),provider:'deepseek',model:settings.providers.deepseek.model,results},null,2)+'\n');
if(results.some(item=>!item.ok))process.exitCode=1;
