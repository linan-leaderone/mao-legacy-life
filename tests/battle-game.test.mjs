import test from 'node:test';
import assert from 'node:assert/strict';
import {BATTLE_DURATION_MS,createBattleModel,performBattleAction,stepBattleGame,battleGameResult,validateBattleResult,battleResultEffect} from '../src/battle-game.js';

const offer=(changes={})=>({version:2,id:'battle-fixture',seed:123,kind:'combat',combatMode:'turn-based',enemyCount:2,allyCount:0,participantCount:3,durationMs:0,terrain:'street',enemyType:'human',player:{health:100,speed:190,meleeDamage:35,rangedDamage:60,ammo:6,carriedAmmo:10,armor:0,immune:false,infected:false,trained:true,skill:80,bait:2},...changes});
function adjacent(model){model.obstacles=[];model.enemies.forEach((e,i)=>{e.x=model.player.x+29+i;e.y=model.player.y;e.ranged=false;});model.allies.forEach(a=>{a.x=900;a.y=500;});return model;}
function escape(model){model.player.x=55;model.player.y=270;assert.equal(performBattleAction(model,'escape'),true);return battleGameResult(model);}

test('ten total participants are turn-based; eleven are realtime, including allies and player',()=>{
  for(const [enemies,allies,mode] of [[9,0,'turn-based'],[8,1,'turn-based'],[10,0,'realtime'],[8,2,'realtime']]){
    const model=createBattleModel(offer({enemyCount:enemies,allyCount:allies,combatMode:'incorrect'}));
    assert.equal(model.combatMode,mode);assert.equal(model.participantCount,1+enemies+allies);assert.equal(model.durationMs,mode==='realtime'?60000:0);
  }
});
test('waiting and animation ticks never advance a turn-based battle',()=>{
  const model=adjacent(createBattleModel(offer())),before=structuredClone(model);
  stepBattleGame(model,600000,{dx:1000});assert.deepEqual(model,before);
  assert.equal(performBattleAction(model,'unknown'),false);assert.equal(model.turn,0);
});
test('a player action gives living enemies one response and dead enemies none',()=>{
  const model=adjacent(createBattleModel(offer({enemyCount:1,player:{...offer().player,meleeDamage:10}})));
  assert.equal(performBattleAction(model,'melee'),true);assert.equal(model.turn,1);assert.equal(model.hits,1);assert.equal(model.player.health,92);
  model.enemies[0].health=5;
  performBattleAction(model,'melee');assert.equal(model.turn,2);assert.equal(model.hits,1);assert.equal(model.kills,1);assert.equal(model.outcome,'cleared');
});
test('selected target receives the attack',()=>{
  const model=adjacent(createBattleModel(offer()));const first=model.enemies[0].health,second=model.enemies[1].health;
  performBattleAction(model,{type:'melee',targetId:model.enemies[1].id});assert.equal(model.enemies[0].health,first);assert.equal(model.enemies[1].health,second-35);
});
test('defending reduces harm, armor prevents harm, healing uses limited materials',()=>{
  const normal=adjacent(createBattleModel(offer({enemyCount:1}))),guarded=adjacent(createBattleModel(offer({enemyCount:1})));
  performBattleAction(normal,{type:'move',dx:1,dy:0});performBattleAction(guarded,'defend');assert.ok(guarded.damageTaken<normal.damageTaken);
  const armored=adjacent(createBattleModel(offer({enemyCount:1,player:{...offer().player,armor:100}})));performBattleAction(armored,'defend');assert.equal(armored.damageTaken,0);assert.equal(armored.hits,0);
  const healing=createBattleModel(offer({enemyCount:1,player:{...offer().player,health:40}}));healing.enemies[0].speed=0;healing.enemies[0].x=900;
  performBattleAction(healing,'heal');assert.equal(healing.player.health,68);performBattleAction(healing,'heal');assert.equal(healing.player.health,96);assert.equal(performBattleAction(healing,'heal'),false);assert.equal(healing.turn,2);
  const result=escape(healing),effect=battleResultEffect(healing.offer,result);assert.equal(result.healingUsed,2);assert.equal(effect.delta.health,56);
});
test('shots consume ammunition and armor/current skill are represented in battle state',()=>{
  const model=adjacent(createBattleModel(offer({enemyCount:1,player:{...offer().player,ammo:1,rangedDamage:10}})));model.rng=0;
  assert.equal(performBattleAction(model,'ranged'),true);assert.equal(model.player.ammo,0);assert.equal(model.ammoUsed,1);assert.equal(model.enemies[0].health,55);
  const turn=model.turn;assert.equal(performBattleAction(model,'ranged'),false);assert.equal(model.turn,turn);
  const result=escape(model);assert.equal(battleResultEffect(model.offer,result).encounterState.ammo,9);
});
test('real-time lasts exactly sixty seconds even after delayed frames, and pauses count no time',()=>{
  const model=createBattleModel(offer({enemyCount:10,player:{...offer().player,armor:100}}));
  model.paused=true;stepBattleGame(model,50000);assert.equal(model.elapsedMs,0);model.paused=false;
  stepBattleGame(model,32789);assert.equal(model.elapsedMs,32789);assert.equal(model.done,false);
  stepBattleGame(model,50000);assert.equal(model.elapsedMs,BATTLE_DURATION_MS);assert.equal(model.outcome,'timeout');assert.equal(battleGameResult(model).completed,true);
  stepBattleGame(model,5000);assert.equal(model.elapsedMs,60000);
});
test('realtime movement collides with cover and cannot tunnel through a delayed frame',()=>{
  const model=createBattleModel(offer({enemyCount:10,player:{...offer().player,armor:100}}));model.player.x=100;model.player.y=270;model.obstacles=[{x:150,y:0,w:100,h:540}];
  stepBattleGame(model,1000,{dx:1000,dy:0});assert.ok(model.player.x<=136);assert.equal(model.elapsedMs,1000);
});
test('a downed combatant cannot heal or resume, even with materials remaining',()=>{
  const model=adjacent(createBattleModel(offer({enemyCount:1,player:{...offer().player,health:1}})));performBattleAction(model,'defend');
  assert.equal(model.done,true);assert.equal(model.outcome,'fallen');assert.equal(performBattleAction(model,'heal'),false);assert.equal(model.player.health,0);
  const result=battleGameResult(model);assert.equal(result.healthAfter,0);assert.equal(battleResultEffect(model.offer,result).delta.health,-1);
});
test('infection only starts from zombie damage, preserves existing infection and honors immunity',()=>{
  for(const [kind,immune,infected,expected] of [['combat',false,false,false],['zombie',false,false,true],['zombie',true,false,false],['combat',true,true,true]]){
    const model=adjacent(createBattleModel(offer({kind,enemyCount:1,enemyType:'walker',player:{...offer().player,immune,infected}})));performBattleAction(model,'defend');const result=escape(model);
    assert.equal(result.infected,expected);assert.equal(battleResultEffect(model.offer,result).encounterState.infected,expected);
  }
});
test('cancel/previews do not mutate the offer, and incomplete records cannot be committed',()=>{
  const supplied=offer(),before=structuredClone(supplied),model=adjacent(createBattleModel(supplied));performBattleAction(model,'defend');
  assert.deepEqual(supplied,before);const result=battleGameResult(model);assert.equal(result.completed,false);assert.throws(()=>battleResultEffect(supplied,result),/还没有结束/);
});
test('group markers keep actual headcounts and never equate one hit with a whole group killed',()=>{
  const model=createBattleModel(offer({enemyCount:1000,allyCount:150,player:{...offer().player,meleeDamage:200}}));assert.equal(model.enemies.length,48);assert.equal(model.allies.length,24);assert.equal(model.grouped,true);
  assert.equal(model.enemies.reduce((sum,e)=>sum+e.count,0),1000);assert.equal(model.allies.reduce((sum,e)=>sum+e.count,0),150);
  model.obstacles=[];const target=model.enemies[0];target.x=model.player.x+30;target.y=model.player.y;const before=target.count;performBattleAction(model,{type:'melee',targetId:target.id});
  assert.ok(model.kills<=3);assert.equal(target.count,before-model.kills);assert.ok(target.health>0);assert.equal(model.done,false);
});
test('battle results reject mismatched identity, impossible health, early completion and fake counts',()=>{
  const model=createBattleModel(offer()),valid=escape(model);assert.equal(validateBattleResult(model.offer,valid).outcome,'escaped');
  for(const change of [{offerId:'another'},{combatMode:'realtime'},{healthAfter:101},{kills:999},{ammoUsed:7},{elapsedMs:1},{outcome:'cleared',escaped:false},{healingReceived:1},{infected:true,completed:false}])assert.throws(()=>validateBattleResult(model.offer,{...valid,...change}));
  const ongoing=createBattleModel(offer()),record=battleGameResult(ongoing);assert.throws(()=>validateBattleResult(ongoing.offer,{...record,completed:true}));
});
test('every terrain has usable cover, a slow zone and an exit',()=>{
  for(const terrain of ['street','park','industrial']){const model=createBattleModel(offer({terrain}));assert.equal(model.obstacles.length,8);assert.equal(model.slowZones.length,1);assert.ok(model.exit.w>0);}
});
test('ordinary fights do not invent guns; armed forces require the encounter description or explicit equipment',()=>{
  assert.equal(createBattleModel(offer({description:'街头两个人动手打架。'})).enemies.some(e=>e.ranged),false);
  assert.equal(createBattleModel(offer({description:'持枪士兵在阵地上射击。'})).enemies.some(e=>e.ranged),true);
  assert.equal(createBattleModel(offer({description:'对方没有枪。'})).enemies.some(e=>e.ranged),false);
  assert.equal(createBattleModel(offer({description:'士兵正和你徒手搏斗。',armedEnemies:false})).enemies.some(e=>e.ranged),false);
});
