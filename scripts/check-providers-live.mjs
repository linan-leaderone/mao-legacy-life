import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {normalizeSettings} from '../src/api-settings.js';
import {listModels,generateMonth} from '../src/api.js';
import {createGame,advance} from '../src/engine.js';

const read=async path=>JSON.parse((await fs.readFile(new URL(path,import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const privateSettings=await read('../.private/settings.json');
const lore=await read('../src/data/lore.json');
const results=[];
for(const provider of ['deepseek','gemini']){
  const settings=normalizeSettings({provider},privateSettings.providers);
  const state=createGame({name:'林远',place:'中国台湾',age:20,background:'worker',seed:'api-v14-live',goal:'学好自动化，照顾家人。',points:{intelligence:6,family:5,fitness:5,appearance:4}},lore);
  const action={custom:true,label:'我在家学习自动化课程，把笔记整理好，给正在找工作的朋友打电话聊聊近况。'};
  const start=Date.now(),record={provider,model:settings.providers[provider].model};
  try{
    const models=await listModels(settings);
    record.modelCount=models.length;record.selectedModelListed=models.includes(record.model);
    const response=await generateMonth(state,action,lore,null,settings);
    const next=advance(state,action,response,null,lore);
    assert.equal(next.month,1);assert.equal(next.current.source,provider);
    Object.assign(record,{ok:true,elapsedMs:Date.now()-start,month:next.month,title:response.title,consequence:response.consequence,narrative:response.narrative,options:response.options.length});
  }catch(error){
    // Adapters expose only fixed messages; scrub configuration values as a second guard.
    let message=String(error.message);
    for(const profile of Object.values(settings.providers))if(profile.apiKey)message=message.replaceAll(profile.apiKey,'[redacted]');
    Object.assign(record,{ok:false,elapsedMs:Date.now()-start,error:message});
  }
  results.push(record);
  console.log(JSON.stringify({...record,consequence:undefined,narrative:undefined}));
}
await fs.writeFile(new URL('../docs/API-LIVE-v1.4.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2)+'\n');
if(results.some(item=>!item.ok))process.exitCode=1;
