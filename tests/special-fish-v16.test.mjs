import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,nextContext,localEvent,advance,importSave,exportSave} from '../src/engine.js';
import {resolveSpecialAction,validateSpecialLife,specialLocalEvent,advanceSpecialLife} from '../src/special-lives.js';

const profile={name:'邓小平',place:'上海',age:20,background:'ordinary',seed:'fish-result-v16',points:{intelligence:5,family:5,fitness:5,appearance:5}};
const game=()=>createGame(profile,lore);
const hunting=fishGame=>({label:'继续捕食小鱼，在太平洋里长大',custom:true,meta:{fishGame}});

test('zero catches never earn automatic feeding experience or body growth',()=>{
  const s=game();const action=hunting({eaten:0,growth:20,elapsedMs:45000});
  const r=resolveSpecialAction(s,action);
  assert.equal(r.specialTransition.experience,s.specialLife.experience);
  assert.equal(r.specialTransition.growth,0);assert.equal(r.specialTransition.stage,0);
  assert.deepEqual(r.specialTransition.lastFishGame,{eaten:0,growth:0,elapsedMs:45000});
  assert.equal(r.delta.fitness,undefined);assert.match(r.summary,/没有捕到小鱼/);
});
test('submitted catches determine growth exactly and previews do not accumulate rewards',()=>{
  const s=game(),before=JSON.stringify(s),action=hunting({eaten:12,growth:9,elapsedMs:12000});
  const first=nextContext(s,lore,action),retry=nextContext(s,lore,action);
  assert.equal(JSON.stringify(s),before);assert.deepEqual(first.state.specialLife,retry.state.specialLife);
  assert.equal(first.state.specialLife.experience,9);assert.equal(first.state.specialLife.growth,9);
  assert.equal(first.state.specialLife.stage,1);assert.match(first.actionResult.summary,/12条小鱼/);
  const committed=advance(s,action,localEvent(first.state,lore,action),null,lore);
  assert.equal(committed.turn,1);assert.equal(committed.history.length,1);assert.equal(committed.specialLife.growth,9);
  assert.deepEqual(importSave(exportSave(committed),lore).specialLife,committed.specialLife);
});
test('harvest bounds, field types, wrong bodies, and negated actions are rejected',()=>{
  const s=game(),valid={eaten:12,growth:9,elapsedMs:12000};
  for(const fishGame of [null,{},[],{...valid,eaten:501},{...valid,growth:21},{...valid,elapsedMs:45001},{...valid,eaten:-1},{...valid,growth:1.5},{...valid,elapsedMs:'12'},{...valid,growth:NaN}])assert.throws(()=>resolveSpecialAction(s,hunting(fishGame)),/觅食/);
  for(const label of ['休息','不吃小鱼','我不想捕食','停止捕食'])assert.throws(()=>resolveSpecialAction(s,{...hunting(valid),label}),/觅食/);
  assert.throws(()=>resolveSpecialAction(s,{...hunting(valid),passive:true}),/觅食/);
  const human=structuredClone(s);human.specialLife.body='human';human.specialLife.stage=4;
  assert.throws(()=>resolveSpecialAction(human,hunting(valid)),/觅食/);
  const mao=createGame({...profile,name:'毛泽东'},lore);assert.throws(()=>resolveSpecialAction(mao,hunting(valid)),/觅食/);
});
test('old choices without harvest metadata retain legacy advancement and saves may lack growth',()=>{
  const s=game();delete s.specialLife.growth;
  const result=resolveSpecialAction(s,{label:'捕食鱼群，继续进化',custom:true});
  assert.ok(result.specialTransition.experience>=9);assert.equal(result.specialTransition.lastFishGame,undefined);
  assert.doesNotThrow(()=>validateSpecialLife(s,s.profile.persona));
});
test('negative calendar months validate by completed turns and print correct dates',()=>{
  const s=game();s.month=-1;s.turn=3;s.specialLife.monthsInBody=3;s.specialLife.bodyAge=999;
  assert.doesNotThrow(()=>validateSpecialLife(s,s.profile.persona));
  s.specialLife.monthsInBody=4;assert.throws(()=>validateSpecialLife(s,s.profile.persona),/身体变化/);s.specialLife.monthsInBody=3;
  s.specialLife.bodyAge=1000;assert.throws(()=>validateSpecialLife(s,s.profile.persona),/身体变化/);s.specialLife.bodyAge=0;
  delete s.turn;s.history=[{},{},{}];assert.doesNotThrow(()=>validateSpecialLife(s,s.profile.persona));
  const event=specialLocalEvent(s,true);assert.doesNotMatch(event.narrative,/undefined/);assert.match(event.dailyId,/_2$/);
  const result=resolveSpecialAction(s,hunting({eaten:1,growth:1,elapsedMs:300}));
  advanceSpecialLife(s,result,{label:'捕食小鱼',custom:true});assert.match(s.person.facts.at(-1),/^2019年12月：/);
});
test('explicit restored body age survives later public appearances, including ages above 150',()=>{
  const s=createGame({...profile,name:'毛泽东'},lore);
  const revived=resolveSpecialAction(s,{label:'复活',custom:true});advanceSpecialLife(s,revived,{label:'复活',custom:true});
  s.specialLife.bodyAge=300;
  const followup=resolveSpecialAction(s,{label:'公开接受采访',custom:true});assert.equal(followup.specialTransition.bodyAge,300);
});
test('remaining a small fish after one catch continues life without replaying the opening',()=>{
  const s=game();assert.match(s.current.narrative,/海水里醒来/);
  const action=hunting({eaten:1,growth:1,elapsedMs:500}),context=nextContext(s,lore,action);
  const after=advance(s,action,localEvent(context.state,lore,action),null,lore);
  assert.equal(after.specialLife.stage,0);assert.match(after.current.narrative,/继续在太平洋/);
  assert.doesNotMatch(after.current.narrative,/醒来|第一次进食|第一次发现/);
  after.month=0;assert.doesNotMatch(specialLocalEvent(after,true).narrative,/海水里醒来|第一次进食/);
});
test('Mao ongoing stages retain established awareness instead of rediscovering it',()=>{
  const s=createGame({...profile,name:'毛泽东'},lore);s.turn=1;s.month=1;s.specialLife.monthsInBody=1;
  assert.doesNotMatch(specialLocalEvent(s,true).narrative,/意识到自己|开始轮流|发现了你/);
  s.specialLife.stage=1;assert.match(specialLocalEvent(s,true).narrative,/按照已有记录/);
  for(const stage of [2,3,4]){s.specialLife.stage=stage;s.specialLife.body=stage>=3?'human':'recovering';s.person.occupation='恢复身体后重新生活的毛泽东';assert.doesNotMatch(specialLocalEvent(s,true).narrative,/意识到自己|第一次|海水里醒来/);}
});
