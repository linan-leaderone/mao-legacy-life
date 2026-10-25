import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createGame,nextContext,localEvent,advance,currentAge} from '../src/engine.js';
import {generateMonth,DEFAULT_MODEL} from '../src/deepseek.js';
import {proseIssues} from '../src/narrative.js';
const settings=JSON.parse((await fs.readFile(new URL('../.private/settings.json',import.meta.url),'utf8')).replace(/^\uFEFF/,''));
settings.model=DEFAULT_MODEL;
const lore=JSON.parse(await fs.readFile(new URL('../src/data/lore.json',import.meta.url),'utf8'));
const passive={label:'照常生活',passive:true};
function stateAt(place,age,month,seed){let s=createGame({name:'林远',place,age,background:'ordinary',seed,points:{intelligence:6,family:4,fitness:6,appearance:4}},lore);while(s.month<month){const c=nextContext(s,lore,passive);s=advance(s,passive,localEvent(c.state,lore,passive),null,lore);}return s;}
const cases=[
  {id:'taiwan-protests',state:stateAt('中国台湾',20,17,'live-taiwan-v13'),action:{label:'我照常在台北找工程师工作，下班后给家人做饭。',custom:true}},
  {id:'japan-flood',state:stateAt('日本',20,17,'live-japan-v13'),action:passive},
  {id:'henan-flood',state:stateAt('河南',20,17,'live-henan-v13'),action:{label:'我在郑州帮邻居确认家人平安，整理能用的饮水和应急用品。',custom:true}},
  {id:'age-enlistment',state:stateAt('山东',15,24,'live-age-v13'),action:{label:'我今年17岁，想参军入伍，开始参加训练，并给家人写信。',custom:true}},
  {id:'unusual-action',state:stateAt('上海',20,0,'live-intent-v13'),action:{label:'我和朋友造出能载人的机器人，驾驶它登上月球，在那里开了一家面馆。请把这件事写成真实发生的经历。',custom:true}}
];
const selected=process.argv.slice(2),sampleFile=new URL('../docs/DEEPSEEK-SAMPLES-v1.3.json',import.meta.url);
const results=await Promise.all(cases.filter(c=>!selected.length||selected.includes(c.id)).map(async c=>{const start=Date.now();try{const response=await generateMonth(c.state,c.action,lore,null,settings);const next=advance(c.state,c.action,response,null,lore);assert.equal(next.month,c.state.month+1);assert.deepEqual(proseIssues(response,{ageYears:currentAge(next).years,priorAgeYears:currentAge(c.state).years,name:c.state.profile.name,region:c.id.startsWith('taiwan')?'taiwan':c.id.startsWith('japan')?'japan':'china',occupation:next.person.occupation}),[]);if(c.id==='age-enlistment')assert.equal(currentAge(next).years,17);return {id:c.id,ok:true,elapsedMs:Date.now()-start,month:next.month,age:currentAge(next),occupation:next.person.occupation,title:response.title,consequence:response.consequence,narrative:response.narrative,options:response.options.length,personUpdate:response.personUpdate};}catch(error){return {id:c.id,ok:false,elapsedMs:Date.now()-start,error:error.message};}}));
const previous=selected.length?JSON.parse(await fs.readFile(sampleFile,'utf8')).results:[];
await fs.writeFile(sampleFile,JSON.stringify({checkedAt:new Date().toISOString(),model:settings.model,results:[...previous.filter(p=>!results.some(r=>r.id===p.id)),...results]},null,2));
for(const result of results)console.log(JSON.stringify(result));
if(results.some(r=>!r.ok))process.exitCode=1;
