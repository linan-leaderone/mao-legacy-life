// Battle state is detached from the life save. Only a completed result is committed.
export const BATTLE_DURATION_MS=60000;
const WIDTH=960,HEIGHT=540,MAX_ENEMY_MARKERS=48,MAX_ALLY_MARKERS=24;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
const integer=(v,min,max)=>Math.round(clamp(v,min,max));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const alive=actor=>actor.health>0;
const random=model=>{model.rng=(Math.imul(model.rng,1664525)+1013904223)>>>0;return model.rng/4294967296;};
const note=(model,text)=>{model.log.push(text);if(model.log.length>20)model.log.shift();};
function counts(offer){const enemyCount=integer(offer.enemyCount,1,1000000),allyCount=integer(offer.allyCount,0,1000000);return {enemyCount,allyCount,participantCount:1+enemyCount+allyCount};}
function modeFor(offer){return counts(offer).participantCount<=10?'turn-based':'realtime';}
function blocked(model,x,y,r=12){return model.obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);}
function lineBlocked(model,a,b){const steps=Math.ceil(distance(a,b)/10);for(let i=1;i<steps;i++)if(blocked(model,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,1))return true;return false;}
function move(model,actor,dx,dy,length){
  const magnitude=Math.hypot(dx,dy);if(!magnitude||!Number.isFinite(length)||length<=0)return false;
  const steps=Math.max(1,Math.ceil(length/8));let moved=false;
  for(let i=0;i<steps;i++){
    const zone=model.slowZones.find(z=>actor.x>=z.x&&actor.x<=z.x+z.w&&actor.y>=z.y&&actor.y<=z.y+z.h),amount=length/steps*(zone?.factor||1);
    const x=clamp(actor.x+dx/magnitude*amount,actor.r,WIDTH-actor.r),y=clamp(actor.y+dy/magnitude*amount,actor.r,HEIGHT-actor.r);
    if(!blocked(model,x,actor.y,actor.r)){moved=moved||x!==actor.x;actor.x=x;}
    if(!blocked(model,actor.x,y,actor.r)){moved=moved||y!==actor.y;actor.y=y;}
  }
  return moved;
}
function approach(model,actor,target,length){const dx=target.x-actor.x,dy=target.y-actor.y;if(move(model,actor,dx,dy,Math.min(length,Math.max(0,distance(actor,target)-28))))return;move(model,actor,actor.id%2?dy:-dy,actor.id%2?-dx:dx,length);}
function chooseTarget(model,action,range=Infinity){
  const candidates=model.enemies.filter(alive);
  if(action.targetId!==undefined)return candidates.find(e=>String(e.id)===String(action.targetId)&&distance(model.player,e)<=range);
  return candidates.filter(e=>distance(model.player,e)<=range).sort((a,b)=>distance(model.player,a)-distance(model.player,b))[0];
}
function groupActors(model,count,maxMarkers,side){
  const markers=Math.min(count,maxMarkers),actors=[];
  const armed=typeof model.offer.armedEnemies==='boolean'?model.offer.armedEnemies:String(model.offer.description||'').split(/[。！？；;\n]/).some(text=>/枪|射击|敌军|军队|部队|阵地|战场|士兵/.test(text)&&!/(?:没有|并未|未曾|并非|不是|不带|没带).{0,8}(?:枪|射击|敌军|军队|部队|士兵)/.test(text));
  for(let i=0;i<markers;i++){
    const n=Math.floor(count/markers)+(i<count%markers?1:0),enemy=side==='enemy';
    const type=!enemy?'ally':model.offer.kind==='combat'?'human':model.offer.enemyType==='mixed'?(i%5===0?'runner':i%7===0?'brute':'walker'):model.offer.enemyType||'walker';
    const hp=type==='brute'?90:type==='human'?65:enemy?42:75;
    const actor={id:enemy?i:`ally-${i}`,side,type,count:n,initialCount:n,unitHealth:hp,maxHealth:hp*n,health:hp*n,r:type==='brute'?18:enemy?12:13,speed:type==='runner'?88:type==='brute'?42:enemy?60:95,hitAt:-9999,ranged:armed&&type==='human'&&i%3===0};
    actor.x=enemy?(model.combatMode==='turn-based'?360+random(model)*340:550+random(model)*360):90+random(model)*90;
    actor.y=50+random(model)*440;
    let attempts=0;while(blocked(model,actor.x,actor.y,actor.r)&&attempts++<60){actor.x=enemy?380+random(model)*530:90+random(model)*90;actor.y=35+random(model)*470;}
    if(blocked(model,actor.x,actor.y,actor.r))actor.y=270;
    actors.push(actor);
  }
  return actors;
}
export function createBattleModel(offer){
  if(!offer||!['zombie','combat'].includes(offer.kind)||!offer.player)throw new Error('无法开始眼前的战斗。');
  const total=counts(offer),combatMode=modeFor(offer),copy={...structuredClone(offer),...total,version:2,combatMode,durationMs:combatMode==='realtime'?BATTLE_DURATION_MS:0};
  copy.player={...copy.player,health:integer(copy.player.health??100,1,100),ammo:integer(copy.player.ammo,0,100000),armor:clamp(copy.player.armor,0,100),skill:clamp(copy.player.skill,0,100),speed:clamp(copy.player.speed||170,30,600),meleeDamage:clamp(copy.player.meleeDamage||18,1,200),rangedDamage:clamp(copy.player.rangedDamage,0,500),bait:integer(copy.player.bait??2,0,10)};
  const model={offer:copy,...total,width:WIDTH,height:HEIGHT,combatMode,mode:combatMode,durationMs:copy.durationMs,rng:offer.seed>>>0,elapsedMs:0,paused:false,done:false,outcome:'ongoing',turn:0,actions:0,score:0,mistakes:0,kills:0,allyLosses:0,hits:0,damageTaken:0,healingUsed:0,healingReceived:0,ammoUsed:0,escaped:false,attackAt:-9999,utilityAt:-9999,log:[],obstacles:[],slowZones:[],baits:[],flashes:[],player:{x:combatMode==='turn-based'?220:65,y:270,r:14,health:copy.player.health,ammo:copy.player.ammo,bait:copy.player.bait,medkits:2,defending:false,defendUntil:0},exit:{x:5,y:175,w:90,h:190}};
  model.obstacles=Array.from({length:8},(_,i)=>({x:180+(i%4)*175,y:i<4?70:360,w:90+Math.floor(random(model)*28),h:90+Math.floor(random(model)*28)}));
  model.slowZones=[copy.terrain==='park'?{x:420,y:210,w:125,h:110,factor:.58,label:'泥地',color:'#726547'}:copy.terrain==='industrial'?{x:560,y:215,w:110,h:100,factor:.68,label:'散落货物',color:'#68616a'}:{x:420,y:230,w:110,h:80,factor:.7,label:'碎石',color:'#837f70'}];
  model.enemies=groupActors(model,total.enemyCount,MAX_ENEMY_MARKERS,'enemy');model.allies=groupActors(model,total.allyCount,MAX_ALLY_MARKERS,'ally');
  model.grouped=total.enemyCount>MAX_ENEMY_MARKERS||total.allyCount>MAX_ALLY_MARKERS;
  note(model,combatMode==='turn-based'?'先观察身边的人，再决定怎样行动。':'战斗已经开始，留意身边的掩体和撤离通道。');
  if(model.grouped)note(model,'地图上的标记旁显示该编组目前的人数。');
  return model;
}
function finish(model,outcome){model.done=true;model.outcome=outcome;model.player.defending=false;note(model,{cleared:'眼前的对手已经失去战斗能力。',escaped:'你沿撤离通道离开了现场。',fallen:'你倒在地上，无法再继续行动。',timeout:'一分钟过去，眼前这一段交锋结束了。'}[outcome]);}
function checkEnd(model){if(model.player.health<=0){finish(model,'fallen');return true;}if(model.kills>=model.enemyCount){finish(model,'cleared');return true;}return false;}
function hurtActor(model,actor,damage){
  const before=actor.count;actor.health=Math.max(0,actor.health-Math.max(0,damage));actor.count=Math.ceil(actor.health/actor.unitHealth);
  const lost=before-actor.count;if(actor.side==='enemy'){model.kills+=lost;model.score=model.kills;}else model.allyLosses+=lost;
}
function hurtPlayer(model,raw){
  const reduction=model.player.defending?.45:1,damage=Math.round(Math.max(0,raw-model.offer.player.armor)*reduction);
  if(damage<=0)return;
  const taken=Math.min(model.player.health,damage);model.player.health-=taken;model.damageTaken+=taken;model.hits++;
}
function nearest(actors,actor){return actors.filter(alive).sort((a,b)=>distance(actor,a)-distance(actor,b))[0];}
function aiAction(model,actor,dt,turnBased){
  if(!alive(actor)||model.done)return;
  const enemy=actor.side==='enemy';let target=enemy?nearest([model.player,...model.allies],actor):nearest(model.enemies,actor);if(!target)return;
  if(enemy&&model.offer.kind==='zombie')target=model.baits.filter(b=>distance(actor,b)<240).sort((a,b)=>distance(actor,a)-distance(actor,b))[0]||target;
  const ranged=actor.ranged&&!lineBlocked(model,actor,target)&&distance(actor,target)<290,reach=ranged?290:actor.r+(target.r||14)+10;
  if(distance(actor,target)>reach)approach(model,actor,target,turnBased?actor.speed*.9:actor.speed*dt);
  if(target.decoy)return;
  if(distance(actor,target)>reach||lineBlocked(model,actor,target))return;
  if(!turnBased&&model.elapsedMs-actor.hitAt<1100)return;
  actor.hitAt=model.elapsedMs;
  const multiplier=Math.min(3,Math.sqrt(actor.count));
  let damage=(enemy?(actor.type==='brute'?14:ranged?10:8):21)*multiplier;
  if(ranged&&random(model)>.74)return;
  if(target===model.player)hurtPlayer(model,damage);else hurtActor(model,target,damage);
  model.flashes.push({x:actor.x,y:actor.y,toX:target.x,toY:target.y,ranged,expires:model.elapsedMs+160});
  checkEnd(model);
}
function round(model){
  model.turn++;
  for(const ally of model.allies)aiAction(model,ally,1,true);
  for(const enemy of model.enemies)aiAction(model,enemy,1,true);
  model.baits=model.baits.filter(b=>b.untilTurn>model.turn);model.player.defending=false;
  if(!model.done)checkEnd(model);
}
function reject(model,text){note(model,text);return false;}
export function performBattleAction(model,input){
  if(model.paused||model.done)return false;
  const action=typeof input==='string'?{type:input}:input||{},p=model.player,turnBased=model.combatMode==='turn-based';let type=action.type;
  if(type==='attack'){const target=chooseTarget(model,action);type=p.ammo>0&&model.offer.player.rangedDamage>0&&target&&distance(p,target)<=480&&!lineBlocked(model,p,target)?'ranged':'melee';}
  if(['melee','ranged'].includes(type)){
    if(!turnBased&&model.elapsedMs-model.attackAt<(model.offer.player.trained?300:450))return false;
    const target=chooseTarget(model,action);if(!target)return reject(model,'眼前没有可以攻击的目标。');
    if(type==='ranged'){
      if(!p.ammo||!model.offer.player.rangedDamage)return reject(model,'没有可以使用的枪械或弹药。');
      if(distance(p,target)>480||lineBlocked(model,p,target))return reject(model,'目标被掩体挡住，或超出了射程。');
      p.ammo--;model.ammoUsed++;
      const accuracy=Math.min(.97,.68+model.offer.player.skill*.002+(model.offer.player.trained?.1:0));
      if(random(model)<accuracy){hurtActor(model,target,model.offer.player.rangedDamage);note(model,'射击击中了目标。');}else{model.mistakes++;note(model,'这一发没有击中。');}
    }else{
      if(turnBased&&distance(p,target)>65)approach(model,p,target,90);
      if(distance(p,target)>65||lineBlocked(model,p,target)){if(!turnBased)return reject(model,'距离太远，需要先靠近。');note(model,'你向对手靠近，寻找出手的位置。');}
      else{hurtActor(model,target,model.offer.player.meleeDamage);note(model,'你近身击中了对手。');}
    }
    model.attackAt=model.elapsedMs;model.flashes.push({x:p.x,y:p.y,toX:target.x,toY:target.y,ranged:type==='ranged',expires:model.elapsedMs+180});
  }else if(type==='move'){
    if(!turnBased){if(Number.isFinite(action.x)&&Number.isFinite(action.y))model.moveTarget={x:action.x,y:action.y};else model.moveTarget={x:p.x+(Number(action.dx)||0),y:p.y+(Number(action.dy)||0)};return true;}
    const dx=Number.isFinite(action.x)?action.x-p.x:Number(action.dx)||0,dy=Number.isFinite(action.y)?action.y-p.y:Number(action.dy)||0;
    if(!move(model,p,dx,dy,Math.min(Math.hypot(dx,dy),110)))return reject(model,'前方有障碍，需要换个方向。');
    note(model,'你换了一个位置。');
  }else if(type==='escape'){
    if(p.x<100&&Math.abs(p.y-270)<95){model.escaped=true;model.actions++;if(turnBased)model.turn++;finish(model,'escaped');return true;}
    if(!turnBased)return reject(model,'先走到左侧的绿色撤离通道。');
    approach(model,p,{x:55,y:270},120);note(model,'你向撤离通道退去。');
  }else if(['defend','heal','bait'].includes(type)){
    if(!turnBased&&model.elapsedMs-model.utilityAt<700)return false;
    if(type==='defend'){p.defending=true;p.defendUntil=model.elapsedMs+2400;note(model,'你收紧防护，留意对手的动作。');}
    if(type==='heal'){
      if(!p.medkits)return reject(model,'可用的包扎材料已经用完。');
      if(p.health>=100)return reject(model,'目前没有需要包扎的伤口。');
      const recovered=Math.min(100-p.health,20+Math.floor(model.offer.player.skill/10));p.health+=recovered;p.medkits--;model.healingUsed++;model.healingReceived+=recovered;note(model,`你包扎了伤口，恢复了 ${recovered} 点健康。`);
    }
    if(type==='bait'){
      if(!p.bait)return reject(model,'身上已经没有可用的诱饵。');
      if(model.offer.kind!=='zombie')return reject(model,'眼前的人不会被这种诱饵引开。');
      p.bait--;model.baits.push({x:clamp(p.x+120,25,935),y:clamp(p.y-100,25,515),decoy:true,r:7,health:1,expires:model.elapsedMs+6500,untilTurn:model.turn+3});note(model,'你把诱饵扔向旁边，感染者转头望去。');
    }
    model.utilityAt=model.elapsedMs;
  }else return false;
  model.actions++;
  if(checkEnd(model)){if(turnBased)model.turn++;return true;}
  if(turnBased)round(model);
  return true;
}
export function stepBattleGame(model,deltaMs,input={}){
  if(model.paused||model.done||model.combatMode==='turn-based')return model;
  // A delayed frame still counts its complete active duration; substeps avoid wall tunnelling.
  let remaining=Math.min(Math.max(0,Number(deltaMs)||0),BATTLE_DURATION_MS-model.elapsedMs);
  while(remaining>0&&!model.done){
    const ms=Math.min(40,remaining),dt=ms/1000;remaining-=ms;model.elapsedMs+=ms;
    const p=model.player,target=Number.isFinite(input.x)&&Number.isFinite(input.y)?input:model.moveTarget;
    let dx=Number(input.dx)||0,dy=Number(input.dy)||0;if(!dx&&!dy&&target){dx=target.x-p.x;dy=target.y-p.y;}
    const magnitude=Math.hypot(dx,dy);if(magnitude)move(model,p,dx,dy,Math.min(magnitude,model.offer.player.speed*dt));
    p.defending=p.defending&&model.elapsedMs<p.defendUntil;
    model.baits=model.baits.filter(b=>b.expires>model.elapsedMs);model.flashes=model.flashes.filter(f=>f.expires>model.elapsedMs);
    for(const ally of model.allies)aiAction(model,ally,dt,false);
    for(const enemy of model.enemies)aiAction(model,enemy,dt,false);
    if(!model.done&&model.elapsedMs>=BATTLE_DURATION_MS)finish(model,'timeout');
  }
  return model;
}
export function battleGameResult(model){
  return validateBattleResult(model.offer,{version:2,offerId:model.offer.id,kind:model.offer.kind,combatMode:model.combatMode,elapsedMs:model.elapsedMs,completed:model.done,score:model.score,mistakes:model.mistakes,kills:model.kills,allyLosses:model.allyLosses,hits:model.hits,damageTaken:model.damageTaken,healingUsed:model.healingUsed,healingReceived:model.healingReceived,healthAfter:model.player.health,ammoUsed:model.ammoUsed,escaped:model.escaped,turns:model.turn,actions:model.actions,outcome:model.outcome});
}
export function validateBattleResult(offer,result){
  const fail=()=>{throw new Error('这次战斗的记录不完整或不匹配，请重新确认。');};
  if(!offer||!result||result.version!==2||result.offerId!==offer.id||result.kind!==offer.kind||!['zombie','combat'].includes(offer.kind)||result.combatMode!==modeFor(offer))fail();
  const total=counts(offer),turnBased=result.combatMode==='turn-based',start=integer(offer.player.health??100,1,100),maxHeal=20+Math.floor(clamp(offer.player.skill,0,100)/10);
  for(const key of ['elapsedMs','score','mistakes','kills','allyLosses','hits','damageTaken','healingUsed','healingReceived','healthAfter','ammoUsed','turns','actions'])if(!Number.isFinite(result[key])||result[key]<0||(key!=='elapsedMs'&&!Number.isInteger(result[key])))fail();
  if(result.elapsedMs>BATTLE_DURATION_MS||turnBased&&result.elapsedMs!==0||result.turns>10000||!turnBased&&result.turns!==0||turnBased&&result.turns!==result.actions||result.kills>total.enemyCount||result.allyLosses>total.allyCount||result.score!==result.kills||result.healingUsed>2||result.healingReceived>result.healingUsed*maxHeal||result.healthAfter>100||result.damageTaken>start+result.healingReceived||result.healthAfter!==start+result.healingReceived-result.damageTaken||result.ammoUsed>integer(offer.player.ammo,0,100000)||result.ammoUsed>result.actions||result.healingUsed>result.actions||result.mistakes>result.ammoUsed)fail();
  if(result.hits===0&&result.damageTaken!==0||result.hits>0&&(result.damageTaken<result.hits||result.damageTaken>result.hits*42)||turnBased&&result.turns===0&&(result.kills||result.allyLosses||result.hits)||!turnBased&&result.ammoUsed>Math.floor(result.elapsedMs/(offer.player.trained?300:450))+1)fail();
  const expected=result.healthAfter<=0?'fallen':result.escaped?'escaped':result.kills===total.enemyCount?'cleared':!turnBased&&result.elapsedMs===BATTLE_DURATION_MS?'timeout':'ongoing';
  if(result.outcome!==expected||!!result.completed!==(expected!=='ongoing')||result.escaped&&expected!=='escaped')fail();
  const infected=!!offer.player.infected||(offer.kind==='zombie'&&!offer.player.immune&&result.hits>0);
  return {...result,version:2,offerId:offer.id,kind:offer.kind,combatMode:modeFor(offer),completed:!!result.completed,escaped:!!result.escaped,infected};
}
export function battleResultEffect(offer,result){
  const r=validateBattleResult(offer,result);if(!r.completed)throw new Error('眼前的战斗还没有结束，请先完成交锋或撤离。');
  const start=integer(offer.player.health??100,1,100),opponent=offer.kind==='zombie'?'感染者':'对手';
  let summary=offer.allyCount?`你和 ${offer.allyCount} 名同伴遭遇 ${counts(offer).enemyCount} 名${opponent}。`:`你遭遇了 ${counts(offer).enemyCount} 名${opponent}。`;
  if(r.kills)summary+=`对方有 ${r.kills} 人失去战斗能力。`;
  summary+=r.outcome==='escaped'?'你随后从通道撤离。':r.outcome==='fallen'?'你倒在地上，失去了行动能力。':r.outcome==='timeout'?'一分钟的交锋结束，现场仍有对手，接下来需要继续留意他们的动向。':'附近的对手已经失去战斗能力。';
  if(r.allyLosses)summary+=`同伴中有 ${r.allyLosses} 人受伤倒下。`;
  if(r.damageTaken)summary+=r.healthAfter===0?'身上的伤势让你无法起身。':r.healthAfter<35?'身上的伤势较重，行动需要他人照应。':'你在交锋中受了伤，需要继续照料伤口。';
  if(r.healingReceived)summary+='你用随身材料包扎了伤口。';
  if(r.ammoUsed)summary+=`你使用了 ${r.ammoUsed} 发弹药。`;
  if(r.infected)summary+=offer.player.infected?'此前的感染仍需处理。':'伤口受到感染，需要尽快处理。';
  else if(offer.kind==='zombie'&&r.hits&&offer.player.immune)summary+='免疫能力阻止了感染，身上的伤口仍需照料。';
  return {delta:{health:r.healthAfter-start,fitness:r.kills>0?1:0,stress:Math.min(8,Math.ceil(r.hits/2))},incomeBonus:0,summary,encounterState:{lastEncounterId:offer.id,infected:r.infected,immune:!!offer.player.immune,ammo:Math.max(0,(offer.player.carriedAmmo??offer.player.ammo??0)-r.ammoUsed)}};
}
