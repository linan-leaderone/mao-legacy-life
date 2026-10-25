import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,actionEncounter,nextContext,localEvent,advance,exportSave,importSave} from '../src/engine.js';
import {createEncounterModel,stepEncounterGame,performEncounterAction,encounterGameResult} from '../src/encounter-games.js';

const routes={china:'cn_han_cyber',taiwan:'tw_dpp',japan:'jp_ldp',europe:'eu_nato'};
const game=(extra={})=>createGame({name:'藤原晴',age:27,place:'日本',background:'ordinary',backgroundText:'我在当地独立生活。',freedom:'unlimited',seed:'battle-engine-v18',routes,...extra},lore);
const custom=label=>({label,custom:true});
const reload=state=>importSave(exportSave(state),lore);
function submit(source,action){
  const before=structuredClone(source),context=nextContext(source,lore,action),response=localEvent(context.state,lore,action),after=advance(source,action,response,null,lore);
  assert.deepEqual(source,before,'battle preview and submission must leave the source save untouched');
  assert.equal(after.turn,source.turn+1);assert.equal(after.history.length,after.turn);
  const net=Object.fromEntries(Object.keys(after.stats).filter(key=>after.stats[key]!==before.stats[key]).map(key=>[key,after.stats[key]-before.stats[key]]));
  assert.deepEqual(Object.fromEntries(after.statChanges.map(change=>[change.key,change.delta])),net);
  assert.deepEqual(after.history.at(-1).delta,net);return after;
}
function prepare(source,action=custom('我在街口与三名歹徒交战')){
  const {offer}=actionEncounter(source,action);assert.equal(offer.kind,'combat');assert.equal(offer.version,2);
  const model=createEncounterModel(offer);model.obstacles=[];model.slowZones=[];model.player.x=65;model.player.y=270;
  for(const enemy of model.enemies)Object.assign(enemy,{x:850,y:270,health:1000,maxHealth:1000,unitHealth:1000,count:1,speed:0,ranged:false,hitAt:-9999});
  return {offer,model,action};
}
function resultAction(prepared){return {...prepared.action,meta:{encounterGame:encounterGameResult(prepared.model)}};}
function woundOnce(prepared){
  const {model}=prepared;Object.assign(model.enemies[0],{x:model.player.x+20,y:model.player.y});
  assert.equal(performEncounterAction(model,{type:'move',dx:0,dy:1}),true);
  model.enemies[0].x=850;assert.equal(model.damageTaken,8);
}
function finishByExit(prepared){assert.equal(performEncounterAction(prepared.model,'escape'),true);return resultAction(prepared);}

test('engine produces turn-based battles at ten total participants and realtime at eleven',()=>{
  const source=game(),before=structuredClone(source);
  for(const [label,total,mode] of [['我和九名敌人交战',10,'turn-based'],['我与十名敌人交战',11,'realtime'],['我带四名队友迎战五名敌军',10,'turn-based'],['我带五名队友迎战五名敌军',11,'realtime']]){
    const {offer}=actionEncounter(source,custom(label));assert.equal(offer.kind,'combat');assert.equal(offer.participantCount,total);assert.equal(offer.combatMode,mode);assert.equal(offer.durationMs,mode==='realtime'?60000:0);
  }
  assert.deepEqual(source,before);
});

test('cancelled human battle and completed-but-unsubmitted result leave the saved life unchanged',()=>{
  const source=game(),before=structuredClone(source),prepared=prepare(source,custom('我已经买到手枪并携带12发子弹。我在街口与三名歹徒交战'));
  assert.equal(prepared.offer.player.ammo,12);woundOnce(prepared);
  const incomplete=resultAction(prepared);assert.throws(()=>nextContext(source,lore,incomplete),/战斗还没有结束/);
  assert.deepEqual(source,before);
  const complete=finishByExit(prepared);assert.equal(complete.meta.encounterGame.completed,true);assert.deepEqual(source,before);
  const first=nextContext(source,lore,complete),again=nextContext(source,lore,complete);assert.deepEqual(first,again);assert.deepEqual(source,before);
  const after=submit(source,complete);assert.equal(after.encounterState.ammo,12);assert.equal(after.stats.health,before.stats.health-8);
});

test('human battle health and ammunition commit once and survive save/reload and the next battle',()=>{
  const source=game({backgroundText:'我携带手枪，配备12发子弹。'}),prepared=prepare(source);assert.equal(source.encounterState.ammo,12);woundOnce(prepared);
  prepared.model.enemies[0].x=prepared.model.player.x+120;
  for(let n=0;n<2;n++)assert.equal(performEncounterAction(prepared.model,'ranged'),true);
  const action=finishByExit(prepared),result=action.meta.encounterGame,after=submit(source,action);
  assert.equal(result.ammoUsed,2);assert.equal(result.damageTaken,8);assert.equal(after.stats.health,source.stats.health-8);assert.equal(after.encounterState.ammo,10);
  assert.equal(after.history.at(-1).actionResult.encounterGame.ammoUsed,2);
  assert.equal(after.statChanges.find(change=>change.key==='health').delta,-8);
  assert.deepEqual(after.statChanges.find(change=>change.key==='health').reasons,['遭遇与伤势']);
  const loaded=reload(after);assert.equal(loaded.stats.health,after.stats.health);assert.equal(loaded.encounterState.ammo,10);assert.deepEqual(loaded.history.at(-1).actionResult.encounterGame,result);
  const next=prepare(loaded,custom('我在公园与两名歹徒交战'));assert.equal(next.offer.player.ammo,10);assert.equal(next.offer.player.health,after.stats.health);
  next.model.enemies[0].x=next.model.player.x+120;performEncounterAction(next.model,'ranged');
  const last=submit(loaded,finishByExit(next));assert.equal(last.encounterState.ammo,9);assert.equal(last.stats.health,after.stats.health);assert.equal(reload(last).encounterState.ammo,9);
  assert.throws(()=>nextContext(after,lore,action),/记录|不匹配|不符/);
});

test('ordinary human injuries do not add a zombie infection or infection date',()=>{
  const source=game(),prepared=prepare(source);assert.equal(source.encounterState.infected,false);woundOnce(prepared);
  const action=finishByExit(prepared),after=submit(source,action),loaded=reload(after);
  assert.equal(action.meta.encounterGame.infected,false);assert.equal(after.encounterState.infected,false);assert.equal(after.encounterState.infectionTurn,undefined);
  assert.equal(loaded.encounterState.infected,false);assert.equal(loaded.stats.health,source.stats.health-8);
});

test('sixty-second expiry ends the encounter without awarding the ongoing civil war',()=>{
  const source=submit(game(),custom('我已经发动日本内战'));
  assert.ok(source.worldOverrides.japan.conflict);
  const before=structuredClone(source),prepared=prepare(source,custom('我在街口与十名敌人交战'));
  assert.equal(prepared.offer.combatMode,'realtime');stepEncounterGame(prepared.model,60000);
  const action=resultAction(prepared),result=action.meta.encounterGame;
  assert.equal(result.elapsedMs,60000);assert.equal(result.outcome,'timeout');assert.equal(result.kills,0);
  const after=submit(source,action);
  assert.deepEqual(source,before);assert.deepEqual(after.worldOverrides.japan,source.worldOverrides.japan);
  assert.deepEqual(after.worldDynamics.terminatedConflicts,source.worldDynamics.terminatedConflicts);
  assert.equal(after.routes.japan,source.routes.japan);assert.equal(after.worldOverrides.japan.conflict,source.worldOverrides.japan.conflict);
  assert.equal(after.history.at(-1).actionResult.encounterGame.outcome,'timeout');
  assert.match(after.history.at(-1).actionResult.summary,/现场仍有对手/);
  assert.equal(after.pendingNews?.some(item=>item.source==='personal_action'&&/胜利|停战|获胜/.test(item.title||''))||false,false);
});

test('bandaging settles final health rather than cumulative injury, without creating a false death',()=>{
  const source=game();source.stats.health=12;const prepared=prepare(source,custom('我在街口与一名歹徒交战'));
  woundOnce(prepared);assert.equal(prepared.model.player.health,4);
  prepared.model.enemies[0].x=prepared.model.player.x+20;prepared.model.enemies[0].y=prepared.model.player.y;
  assert.equal(performEncounterAction(prepared.model,'heal'),true);prepared.model.enemies[0].x=850;
  const action=finishByExit(prepared),result=action.meta.encounterGame;
  assert.equal(result.damageTaken,16);assert.ok(result.damageTaken>=source.stats.health);assert.ok(result.healthAfter>0);assert.equal(result.healingUsed,1);
  const preview=nextContext(source,lore,action);assert.equal(preview.state.stats.health,result.healthAfter);assert.equal(preview.state.terminalCause,undefined);
  const after=submit(source,action);assert.equal(after.stats.health,result.healthAfter);assert.equal(after.stats.health-source.stats.health,result.healingReceived-result.damageTaken);assert.equal(after.ended,false);
  assert.equal(after.statChanges.find(change=>change.key==='health').delta,result.healingReceived-result.damageTaken);
  const loaded=reload(after);assert.equal(loaded.stats.health,result.healthAfter);assert.equal(loaded.ended,false);assert.equal(loaded.history.at(-1).actionResult.encounterGame.healingUsed,1);
});
