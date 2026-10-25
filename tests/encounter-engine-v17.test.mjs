import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,actionEncounter,nextContext,localEvent,advance,exportSave,importSave} from '../src/engine.js';
import {createEncounterModel,stepEncounterGame,performEncounterAction,encounterGameResult,encounterResultEffect} from '../src/encounter-games.js';
import {prepareEncounterState} from '../src/encounter-state.js';

const routes={china:'cn_han_cyber',taiwan:'tw_dpp',japan:'jp_ldp',europe:'eu_nato'};
const game=(extra={})=>createGame({name:'林原青',age:25,place:'日本',background:'ordinary',backgroundText:'我在当地生活，与家人保持联系。',freedom:'unlimited',seed:'encounter-engine-v17',routes,...extra},lore);
const custom=label=>({label,custom:true});
const passive={label:'照常生活',passive:true};
const reload=s=>importSave(exportSave(s),lore);
function tick(s,action=passive){
  const before=structuredClone(s),context=nextContext(s,lore,action),response=localEvent(context.state,lore,action),after=advance(s,action,response,null,lore);
  assert.deepEqual(s,before,'preview and submission must leave the source save untouched');
  assert.equal(after.turn,s.turn+1);assert.equal(after.history.length,after.turn);
  const actual=Object.fromEntries(Object.keys(after.stats).filter(k=>after.stats[k]!==before.stats[k]).map(k=>[k,after.stats[k]-before.stats[k]]));
  assert.deepEqual(Object.fromEntries(after.statChanges.map(change=>[change.key,change.delta])),actual);
  assert.deepEqual(after.history.at(-1).delta,actual);return after;
}
function elapsed(model,ms){for(let i=0;i<ms;i+=50)stepEncounterGame(model,Math.min(50,ms-i));}
function combat(s,action=custom('我在街口遇到了三只丧尸'),{hit=false,shots=0}={}){
  const {offer}=actionEncounter(s,action);assert.equal(offer?.kind,'zombie');
  const m=createEncounterModel(offer);m.obstacles=[];m.slowZones=[];
  m.player.x=65;m.player.y=270;
  for(const enemy of m.enemies)Object.assign(enemy,{type:'walker',x:850,y:270,r:12,health:1000,maxHealth:1000,unitHealth:1000,count:1,speed:0,ranged:false,hitAt:-9999});
  Object.assign(m.enemies[0],{x:m.player.x+(hit?20:120),y:m.player.y});
  // In a turn-based fight, waiting cannot cause a hit. A deliberate small move
  // gives the nearby enemy exactly one response before it is moved out of reach.
  if(hit){performEncounterAction(m,{type:'move',dx:0,dy:1});m.enemies[0].x=m.player.x+120;}
  for(let n=0;n<shots;n++){assert.equal(performEncounterAction(m,'ranged'),true);elapsed(m,550);}
  if(!m.done)assert.equal(performEncounterAction(m,'escape'),true);
  const result=encounterGameResult(m);return {offer,result,action:{...action,meta:{encounterGame:result}}};
}
function work(s,action=custom('我继续上班打工'),count=3){
  const {offer}=actionEncounter(s,action);assert.equal(offer?.kind,'office');const m=createEncounterModel(offer);elapsed(m,50);
  for(let n=0;n<count;n++){assert.equal(performEncounterAction(m,m.task.wrong),true);elapsed(m,450);}
  const result=encounterGameResult(m);assert.equal(result.score,count);return {offer,result,action:{...action,meta:{encounterGame:result}}};
}

test('cancelled loadout preview changes neither original money, equipment, clock nor history',()=>{
  const s=game(),before=structuredClone(s),action=custom('我已经买到手枪，携带12发子弹，我已经对丧尸病毒免疫，我在街口遇到三只丧尸');
  const first=actionEncounter(s,action),again=actionEncounter(s,action);assert.deepEqual(first,again);assert.deepEqual(s,before);
  assert.equal(first.offer.player.ammo,12);assert.equal(first.offer.player.immune,true);assert.equal(first.state.encounterState.equipment.includes('手枪'),true);
  assert.equal(first.state.turn,s.turn);assert.equal(first.state.month,s.month);assert.equal(first.state.stats.funds,s.stats.funds);assert.deepEqual(first.state.history,s.history);
  const failed=prepareEncounterState(s,action,false);assert.deepEqual(failed.encounterState,s.encounterState);assert.deepEqual(s,before);
});

test('monthly salary, expenses and task bonus enter one ledger exactly once despite preview retries',()=>{
  let s=game();s.employment={kind:'会计文员',monthlyIncome:6000,monthlyExpenses:1400};s.person.occupation='会计文员';
  const before=s.stats.funds,{offer,result,action}=work(s),bonus=encounterResultEffect(offer,result).incomeBonus;
  const first=nextContext(s,lore,action),again=nextContext(s,lore,action);assert.deepEqual(first.state,again.state);assert.equal(s.stats.funds,before);
  s=tick(s,action);assert.equal(s.monthlyLedger.filter(row=>row.amount===6000).length,1);assert.equal(s.monthlyLedger.filter(row=>row.label==='本月工作奖金').length,1);
  assert.equal(s.monthlyLedger.find(row=>row.label==='本月工作奖金').amount,bonus);
  assert.equal(s.stats.funds-before,6000-1400+bonus);assert.equal(s.history.length,1);
  const loaded=reload(s);assert.deepEqual(loaded.monthlyLedger,s.monthlyLedger);assert.equal(loaded.stats.funds,s.stats.funds);
  const second=tick(loaded);assert.equal(second.stats.funds-loaded.stats.funds,6000-1400);assert.equal(second.monthlyLedger.some(row=>row.label==='本月工作奖金'),false);
});

test('shot ammunition persists through submission, save/reload and the following encounter',()=>{
  const s=game({backgroundText:'我携带手枪，配备12发子弹。'});assert.equal(s.encounterState.ammo,12);
  const one=combat(s,undefined,{shots:2}),after=tick(s,one.action);assert.equal(one.result.ammoUsed,2);assert.equal(after.encounterState.ammo,10);
  assert.equal(after.history.at(-1).actionResult.encounterGame.ammoUsed,2);
  const loaded=reload(after);assert.equal(loaded.encounterState.ammo,10);assert.deepEqual(loaded.encounterState.equipment,after.encounterState.equipment);
  const two=combat(loaded,custom('我在另一条街遇到了三只丧尸'),{shots:1});assert.equal(two.offer.player.ammo,10);
  const final=tick(loaded,two.action);assert.equal(final.encounterState.ammo,9);assert.equal(reload(final).encounterState.ammo,9);
});

test('discarded weapons and removed armor cannot return from the opening background or remembered facts',()=>{
  const s=game({backgroundText:'我携带手枪，穿着外骨骼，配备12发子弹。'});s.person.facts.push('我曾经拥有手枪和外骨骼');
  const discarded=tick(s,custom('我已经丢弃手枪，我已经脱下外骨骼'));assert.deepEqual(discarded.encounterState.equipment,[]);assert.equal(discarded.encounterState.ammo,0);
  const {offer}=actionEncounter(reload(discarded),custom('我在街口遇到三只丧尸'));assert.equal(offer.player.armor,0);assert.equal(offer.player.rangedDamage,0);assert.equal(offer.player.ammo,0);
  const bulletsOnly=tick(discarded,custom('我买到12发子弹'));const armed=actionEncounter(bulletsOnly,custom('我在街口遇到三只丧尸')).offer;
  assert.equal(armed.player.rangedDamage,0);assert.equal(armed.player.ammo,0);
});

test('family equipment never becomes the character inventory or protection',()=>{
  const s=game({backgroundText:'父亲携带步枪并穿着外骨骼。母亲随身带着防弹衣。'});assert.deepEqual(s.encounterState.equipment,[]);assert.equal(s.encounterState.ammo,0);
  const {offer,action,result}=combat(s,undefined,{hit:true});assert.equal(offer.player.armor,0);assert.equal(offer.player.rangedDamage,0);assert.equal(result.damageTaken,8);
  const after=tick(s,action);assert.equal(after.stats.health,s.stats.health-8);assert.equal(after.encounterState.infected,true);
});
test('explicit ammunition beside a firearm overrides the default without inheriting others or imagined gear',()=>{
  for(const count of [0,12,20,120,999]){
    const declaration=`我携带手枪和${count}发子弹，穿着防弹衣。`;
    const initialized=game({backgroundText:declaration});
    assert.equal(initialized.encounterState.ammo,Math.min(120,count));
    assert.deepEqual(new Set(initialized.encounterState.equipment),new Set(['手枪','防弹衣']));
    const source=game(),before=structuredClone(source),prepared=prepareEncounterState(source,custom(declaration));
    assert.equal(prepared.encounterState.ammo,Math.min(120,count));assert.deepEqual(source,before);
  }
  for(const declaration of ['父亲携带手枪和20发子弹','父亲携带手枪，配备20发子弹','我的父亲携带手枪和20发子弹','我朋友持有手枪和20发子弹','我没有携带手枪和20发子弹','假如我携带手枪和20发子弹','如果我买到手枪，就携带20发子弹']){
    const initialized=game({backgroundText:declaration}),prepared=prepareEncounterState(game(),custom(declaration));
    for(const candidate of [initialized,prepared]){assert.deepEqual(candidate.encounterState.equipment,[],declaration);assert.equal(candidate.encounterState.ammo,0,declaration);}
  }
  const own=game({backgroundText:'父亲携带步枪和30发子弹，我携带手枪和12发子弹。'});
  assert.deepEqual(own.encounterState.equipment,['手枪']);assert.equal(own.encounterState.ammo,12);
});

test('loose ammunition stays in inventory without a gun and cannot be fired',()=>{
  const s=game({backgroundText:'我随身携带12发子弹。'});assert.deepEqual(s.encounterState.equipment,[]);assert.equal(s.encounterState.ammo,12);
  const {offer,action,result}=combat(s);assert.equal(offer.player.carriedAmmo,12);assert.equal(offer.player.ammo,0);assert.equal(offer.player.rangedDamage,0);
  const model=createEncounterModel(offer);assert.equal(performEncounterAction(model,'ranged'),false);assert.equal(result.ammoUsed,0);
  const after=tick(s,action);assert.equal(after.encounterState.ammo,12);assert.equal(reload(after).encounterState.ammo,12);
});

test('new bites persist as infection unless already immune; immune characters still lose health',()=>{
  for(const immune of [false,true]){
    const s=game();s.encounterState.immune=immune;const {action,result}=combat(s,undefined,{hit:true});assert.equal(result.damageTaken,8);
    const after=tick(s,action);assert.equal(after.stats.health,s.stats.health-8);assert.equal(after.encounterState.infected,!immune);assert.equal(after.encounterState.immune,immune);
    assert.equal(after.history.at(-1).actionResult.encounterGame.infected,!immune);assert.deepEqual(reload(after).encounterState,after.encounterState);
    if(!immune)assert.equal(after.encounterState.infectionTurn,after.turn);
    assert.ok(after.statChanges.find(row=>row.key==='health').reasons.includes('遭遇与伤势'));
  }
});

test('current action immunity and newly acquired gear are identical in preview and committed outcome',()=>{
  const s=game(),plain=custom('我已经对丧尸病毒免疫，我已经买到步枪并携带8发子弹，我穿上防弹衣，我在街口遇到了三只丧尸');
  const {offer,action,result}=combat(s,plain,{hit:true,shots:1});assert.equal(offer.player.ammo,8);assert.equal(offer.player.immune,true);assert.ok(offer.player.armor>0);
  const before=JSON.stringify(s),preview=nextContext(s,lore,action),after=tick(s,action);assert.equal(JSON.stringify(s),before);
  assert.deepEqual(after.encounterState,preview.state.encounterState);assert.equal(after.encounterState.ammo,7);assert.equal(after.encounterState.infected,false);assert.equal(result.infected,false);
  assert.equal(after.stats.health,s.stats.health-result.damageTaken);assert.deepEqual(new Set(after.encounterState.equipment),new Set(['步枪','防弹衣']));
});

test('hypothetical or denied immunity never protects the current encounter',()=>{
  for(const declaration of ['我没有对丧尸病毒免疫','如果我对丧尸病毒免疫','我准备研究丧尸病毒免疫']){
    const s=game(),plain=custom(`${declaration}。我在街口遇到了三只丧尸`),{offer,action}=combat(s,plain,{hit:true});
    assert.equal(offer.player.immune,false);assert.equal(tick(s,action).encounterState.infected,true);
  }
});

test('infection continues across a month and a clear cure prevents further monthly damage',()=>{
  let s=game();s=tick(s,combat(s,undefined,{hit:true}).action);s=reload(s);const start=s.stats.health,infectedTurn=s.encounterState.infectionTurn;
  const ongoing=tick(s);assert.equal(ongoing.stats.health,start-3);assert.equal(ongoing.encounterState.infected,true);assert.equal(ongoing.encounterState.infectionTurn,infectedTurn);
  assert.match(ongoing.history.at(-1).actionResult.summary,/感染还没有消退/);
  const healed=tick(ongoing,custom('我已经彻底治愈了丧尸病毒感染'));assert.equal(healed.encounterState.infected,false);assert.equal(healed.encounterState.infectionTurn,undefined);assert.equal(healed.stats.health,ongoing.stats.health);
  const later=tick(reload(healed));assert.equal(later.encounterState.infected,false);assert.equal(later.stats.health,healed.stats.health);
});

test('fatal encounter injury stays at zero and produces a terminal life record',()=>{
  const s=game();s.stats.health=8;const {action,result}=combat(s,undefined,{hit:true});assert.equal(result.damageTaken,8);
  const preview=nextContext(s,lore,action);assert.equal(preview.state.stats.health,0);assert.equal(preview.state.terminalCause,'encounter');assert.equal(preview.decision,false);
  const after=tick(s,action);assert.equal(after.stats.health,0);assert.equal(after.ended,true);assert.equal(after.current.options.length,0);assert.match(after.current.narrative,/无法支撑|没能挽回/);
  const loaded=reload(after);assert.equal(loaded.ended,true);assert.equal(loaded.stats.health,0);assert.throws(()=>tick(loaded),/已经结束/);
});

test('retries are deterministic, a previous-month result cannot be reused and foreign results are rejected',()=>{
  const s=game(),played=combat(s,undefined,{hit:true});const a=nextContext(s,lore,played.action),b=nextContext(s,lore,played.action);assert.deepEqual(a,b);
  const after=tick(s,played.action),before=structuredClone(after);assert.throws(()=>nextContext(after,lore,played.action),/记录|不匹配|不符/);assert.deepEqual(after,before);
  const changedLabel={...played.action,label:'我在公园遇到了三只丧尸'};assert.throws(()=>nextContext(s,lore,changedLabel),/记录|不匹配|不符/);
  const forged={...played.action,meta:{encounterGame:{...played.result,offerId:'encounter-foreign'}}};assert.throws(()=>nextContext(s,lore,forged),/记录|不匹配|不符/);
  const unrelated={...played.action,label:'我在家读书'};assert.throws(()=>nextContext(s,lore,unrelated),/记录|不匹配|不符/);
  const corrupt=JSON.parse(exportSave(after));corrupt.game.encounterState.ammo=999;assert.throws(()=>importSave(JSON.stringify(corrupt),lore),/伤势与装备/);
});
