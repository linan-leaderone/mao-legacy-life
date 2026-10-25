import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,nextContext,localEvent,advance,exportSave,importSave,resolveAction,currentAge,isDecisionMonth,validateResponse,ageLabel} from '../src/engine.js';
import {findPersona} from '../src/personas.js';
import {buildPrompt,generateMonth} from '../src/deepseek.js';
import {proseIssues} from '../src/narrative.js';

const passive={label:'照常生活',passive:true};
const profile={age:20,place:'福建',background:'ordinary',points:{intelligence:5,family:5,fitness:5,appearance:5},seed:'special-life-test'};
const game=name=>createGame({...profile,name},lore);
function tick(s,action=passive){const c=nextContext(s,lore,action);return advance(s,action,localEvent(c.state,lore,action),null,lore);}
const custom=label=>({label,custom:true});

test('exact hidden names enter the specified physical openings with locked history and canonical statistics',()=>{
  const mao=game('毛泽东'),deng=game('邓小平');
  assert.equal(mao.location,'北京·毛主席纪念堂');assert.equal(currentAge(mao).years,126);assert.equal(mao.specialLife.kind,'mao_resurrection');assert.equal(mao.specialLife.body,'preserved');assert.match(mao.current.narrative,/水晶棺/);
  assert.equal(deng.location,'太平洋');assert.equal(currentAge(deng).years,115);assert.equal(deng.specialLife.body,'small_fish');assert.match(deng.current.narrative,/水滴鱼/);
  for(const s of [mao,deng]){assert.equal(s.current.options.length,4);assert.equal(s.ended,false);assert.equal(s.stats.health,findPersona(s.profile.name).stats.health);assert.equal(s.stats.funds,0);assert.deepEqual(importSave(exportSave(s),lore),s);}
  assert.equal(game('毛泽东的邻居').specialLife,undefined);assert.equal(game('小邓').specialLife,undefined);
});

test('revival happens in the action month, keeps chronological age and survives later months and saves',()=>{
  const before=game('毛泽东'),a=custom('我要复活，站起来说话'),snapshot=JSON.stringify(before);
  const preview=nextContext(before,lore,a);assert.equal(JSON.stringify(before),snapshot);
  assert.equal(preview.state.specialLife.resurrected,true);assert.equal(preview.state.specialLife.body,'human');assert.equal(preview.state.location,'北京');
  let after=tick(before,a);assert.deepEqual(after.specialLife,preview.state.specialLife);assert.equal(after.month,1);assert.equal(after.specialLife.bodyAge,45);assert.match(after.history[0].consequence,/独立行走/);assert.equal(after.ended,false);
  after=tick(after);assert.equal(after.specialLife.resurrected,true);assert.match(after.person.occupation,/重新生活/);assert.deepEqual(importSave(exportSave(after),lore).specialLife,after.specialLife);
  after=tick(after,custom('公开接受采访'));assert.equal(after.specialLife.stage,4);assert.match(after.person.status,/没有自动获得/);
});

test('passive care progresses through several physical stages without immediately ending an old historical figure',()=>{
  let s=game('毛泽东');const stages=new Set([s.specialLife.stage]);
  for(let i=0;i<18;i++){s=tick(s);stages.add(s.specialLife.stage);assert.equal(s.ended,false);validateResponse(s.current,{decision:isDecisionMonth(s)});}
  assert.deepEqual([...stages],[0,1,2,3]);assert.ok(currentAge(s).years>=127);assert.equal(s.specialLife.resurrected,true);
});

test('fish consumption persists across multiple growth stages and can become a human on land',()=>{
  let s=game('邓小平');const stages=new Set([s.specialLife.stage]);
  for(let i=0;i<4;i++){s=tick(s,custom('吞噬合适的鱼群，继续进化'));stages.add(s.specialLife.stage);assert.equal(s.location,'太平洋');assert.equal(s.stats.funds,0);assert.ok(s.current.news.every(n=>n.exposure.level==='none'));}
  assert.deepEqual([...stages],[0,1,2,3]);assert.equal(s.specialLife.body,'sea_creature');assert.ok(s.stats.fitness>20);
  s=tick(s,custom('在海岸化形，变成人后登陆'));assert.equal(s.specialLife.stage,4);assert.equal(s.specialLife.body,'human');assert.equal(s.location,'日本');assert.match(s.history.at(-1).consequence,/双脚行走/);
  const restored=importSave(exportSave(s),lore);assert.deepEqual(restored.specialLife,s.specialLife);
  s=tick(restored,custom('成为教师'));assert.equal(s.person.occupation,'教师');s=tick(s);assert.equal(s.person.occupation,'教师');assert.equal(s.specialLife.body,'human');
});

test('explicit gradual and negated arrangements do not immediately revive or land',()=>{
  let mao=tick(game('毛泽东'),custom('配合照护，逐渐恢复身体'));assert.ok(mao.specialLife.stage<3);
  mao=tick(game('毛泽东'),custom('我不复活，先观察周围'));assert.ok(mao.specialLife.stage<3);
  const deng=tick(game('邓小平'),custom('不上岸，不化形，留在海里'));assert.equal(deng.location,'太平洋');assert.notEqual(deng.specialLife.body,'human');
});

test('chosen shore and later moves keep their real location and can return to the ocean',()=>{
  for(const [label,place]of [['游到福建，化形后上岸','福建'],['去台湾上岸','中国台湾'],['去香港上岸','香港']]){
    let s=tick(game('邓小平'),custom(label));assert.equal(s.location,place);assert.match(s.person.status,new RegExp(place));assert.match(s.current.narrative,new RegExp(place));assert.doesNotMatch(s.current.narrative,/日本/);
    s=tick(s);assert.equal(s.location,place);
    s=tick(s,custom('回到海里，重返海洋'));assert.equal(s.location,'太平洋');assert.equal(s.specialLife.body,'sea_creature');assert.equal(s.specialLife.stage,3);assert.deepEqual(importSave(exportSave(s),lore).specialLife,s.specialLife);
  }
  let mao=tick(game('毛泽东'),custom('复活'));mao=tick(mao,custom('成为国家主席'));mao=tick(mao,custom('公开接受采访'));assert.equal(mao.person.occupation,'国家主席');
  const combined=tick(game('毛泽东'),custom('复活以后成为国家主席'));assert.equal(combined.specialLife.resurrected,true);assert.equal(combined.person.occupation,'国家主席');assert.match(combined.history[0].consequence,/国家主席/);
  let deng=tick(game('邓小平'),custom('变成人后去福建上岸'));deng=tick(deng,custom('成为教师'));deng=tick(deng,custom('回家吃饭'));assert.equal(deng.person.occupation,'教师');assert.equal(deng.location,'福建');
});

test('attributes determine physical progression costs and choice months mostly remain quiet',()=>{
  const low=game('邓小平'),high=game('邓小平');for(const k of ['intelligence','fitness','health']){low.stats[k]=10;high.stats[k]=90;}
  const action=custom('寻找鱼群吞噬'),a=resolveAction(low,action),b=resolveAction(high,action);assert.equal(a.quality,'costly');assert.equal(b.quality,'smooth');assert.ok(a.specialTransition.experience<b.specialTransition.experience);assert.ok(a.delta.stress>b.delta.stress);
  let s=game('邓小平'),quiet=0,choices=0;for(let i=0;i<24;i++){s=tick(s);if(s.current.options.length)choices++;else quiet++;}assert.ok(quiet>choices);
  for(let i=0;i<20;i++){const opening=createGame({...profile,name:'邓小平',seed:`opening-${i}`},lore);const count=[0,1,2,3].filter(month=>isDecisionMonth({...opening,month})).length;assert.ok(count>=1&&count<=2);assert.equal(isDecisionMonth(opening),true);}
});

test('special save records cannot be added to ordinary lives or lose their physical facts',()=>{
  const ordinary=game('陈小青'),mao=game('毛泽东');
  const tamper=(s,fn)=>{const data=JSON.parse(exportSave(s));fn(data.game);return JSON.stringify(data);};
  assert.throws(()=>importSave(tamper(ordinary,s=>{s.specialLife=mao.specialLife;s.profile.specialScenario='mao_resurrection';}),lore),/身体经历/);
  assert.throws(()=>importSave(tamper(mao,s=>delete s.specialLife),lore),/身体变化/);
  assert.throws(()=>importSave(tamper(mao,s=>{s.specialLife.stage=3;s.specialLife.body='preserved';}),lore),/苏醒经历/);
});

test('ordinary age restrictions and health termination remain while special chronological age can pass 120',()=>{
  assert.throws(()=>createGame({...profile,name:'普通老人',age:91},lore),/0–90/);
  const ordinary=createGame({...profile,name:'普通老人',age:90,freedom:'grounded',narrative:'balanced'},lore);ordinary.month=359;assert.equal(currentAge(ordinary).years,119);assert.equal(tick(ordinary).ended,true);
  const deng=game('邓小平');deng.month=60;assert.ok(currentAge(deng).years>=120);assert.equal(tick(deng).ended,false);
  const revived=tick(game('毛泽东'),custom('复活'));revived.stats.health=0;assert.equal(tick(revived).ended,true);
});

test('all API providers share explicit body continuity and ordinary prompts keep their realistic tone',()=>{
  const mao=game('毛泽东'),deng=game('邓小平');
  const p=buildPrompt(mao,custom('复活'),lore),q=buildPrompt(deng,passive,lore),plain=buildPrompt(game('陈小青'),passive,lore);
  assert.equal(JSON.parse(p.user).specialLife.resurrected,true);assert.equal(JSON.parse(p.user).currentAgeYears,126);assert.equal(p.validationContext.specialLife.body,'human');assert.match(p.system,/复活或吞噬进化/);
  assert.equal(JSON.parse(q.user).specialLife.body,'small_fish');assert.match(JSON.parse(q.user).specialLife.instruction,/没有人类工作/);
  assert.equal(JSON.parse(plain.user).specialLife,null);assert.match(plain.system,/不主动增加修仙和魔法/);
  const wrong={title:'日常安排',narrative:'你回家做饭，准备第二天去办公室处理日常工作。原有的文件放在桌上，家人帮你整理了房间。',consequence:'你处理了原来的事务。',options:[]};
  assert.ok(proseIssues(wrong,q.validationContext).some(x=>x.includes('海中的生物')));
  const changed={...wrong,narrative:'你身体的体貌恢复到45岁时的状态，能够独立行走。照护人员送来新的记录，你根据实际需要安排后续会面。'};
  assert.equal(proseIssues(changed,p.validationContext).filter(x=>x.includes('当前年龄')).length,0);
});

test('API cancellation and failed responses never commit special physical evolution',async()=>{
  const s=game('邓小平'),snapshot=JSON.stringify(s),action=custom('吞噬并变成人');const original=globalThis.fetch;
  try{globalThis.fetch=async()=>{throw new Error('test network failure');};await assert.rejects(generateMonth(s,action,lore,null,{apiKey:'test-only-key',model:'deepseek-flash'}));assert.equal(JSON.stringify(s),snapshot);
    const controller=new AbortController();controller.abort();await assert.rejects(generateMonth(s,action,lore,null,{apiKey:'test-only-key',model:'deepseek-flash'},controller.signal));assert.equal(JSON.stringify(s),snapshot);
  }finally{globalThis.fetch=original;}
});

test('imprecise birthdays never display an invented exact month age',()=>{
  const s=game('陈小青');for(const precision of ['month','year','estimated']){s.profile.birthDatePrecision=precision;assert.equal(ageLabel(s),'约 20 岁');}
});
