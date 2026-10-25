import {affirmedClauses} from './agency.js';
import {regionForPlace} from './regions.js';
import {detectLocalBattle} from './battle-offer.js';
import {createBattleModel,performBattleAction,stepBattleGame,battleGameResult,validateBattleResult,battleResultEffect} from './battle-game.js';
import {openBattleGame} from './battle-view.js';
import {createMinigameAvatar,mountMinigameIdentity,drawMinigameAvatar} from './minigame-avatar.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));
const integer=(value,min,max)=>Math.round(clamp(value,min,max));
const hash=text=>{let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const positive=text=>affirmedClauses(text).join('，');
export const ENCOUNTER_DURATION_MS=45000;
const WIDTH=960,HEIGHT=540;
const WORK_KINDS=['delivery','quality','service','office'];
const TITLES={zombie:'街口的感染者',delivery:'把这一批订单送到',quality:'检查这一批零件',service:'完成柜台的订单',office:'核对今天的账单'};
const INSTRUCTIONS={zombie:'拖动地图或用方向键 / WASD 移动。靠近后可以挥击，射击会瞄准最近的感染者；投出诱饵能暂时引开它们。返回左侧绿色出口后可撤离。',delivery:'沿街道移动到亮起的收件点，依次送完这一批订单。拖动地图或用方向键 / WASD 移动，建筑物和施工围挡会阻挡通行。',quality:'查看传送台上的零件。发现裂纹、缺口或红色故障点就拣出，其余放行。也可按 1 放行、2 拣出。',service:'按照订单从左到右准备食物。点击对应食物或按 1、2、3，完成一份后接下一份。',office:'对照左侧原单与右侧录入，找出数值不一致的一行。点击对应行或按 1、2、3、4。'};

const joinedValues=values=>values.flatMap(value=>Array.isArray(value)?value:[typeof value==='object'&&value!==null?JSON.stringify(value):value]).filter(Boolean).join('。');
const ownText=value=>String(value||'').split(/[。！？；;\n]/).filter(clause=>!/(?:父亲|母亲|家人|朋友|邻居|同事)/.test(clause)).map(positive).filter(Boolean).join('。');
function equipmentText(state){
  // The present inventory is authoritative, including an explicitly empty inventory.
  if(state.encounterState&&Object.hasOwn(state.encounterState,'equipment'))return positive(joinedValues([state.encounterState.equipment]));
  if(state.person&&Object.hasOwn(state.person,'equipment'))return positive(joinedValues([state.person.equipment]));
  return ownText(joinedValues([state.person?.facts,state.person?.status,state.profile?.backgroundText,state.equipment]));
}
function explicitLocalEncounter(text){
  return String(text||'').split(/[。！？；;\n]/).map(positive).some(clause=>!/(?:新闻|报道|电视|广播|消息|远方|国外|传闻|游戏里|电影里|上月|上个月|此前|曾经|回忆|回想|已结束|已经结束|已经消灭|已经清除|早已消灭|曾遇到|那次遭遇)/.test(clause)&&/(?:你|我|身边|附近|周围|眼前|街口|门外|路上|迎面).{0,30}(?:遭遇|遇到|遇见|发现|出现|围住|扑来|丧尸|感染者)|(?:丧尸|感染者).{0,20}(?:围住你|扑向你|向你靠近|正在追你)/.test(clause)&&/丧尸|感染者/.test(clause));
}
function numberOfEnemies(text,seed){
  const match=text.match(/(\d{1,3}|一|两|二|三|四|五|六|七|八|九|十)\s*(?:只|名|个|头)\s*(?:丧尸|感染者)/);
  const chinese={一:1,两:2,二:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10};
  return match?integer(chinese[match[1]]??Number(match[1]),1,24):/尸群|成群|大批/.test(text)?12:4+seed%4;
}
export function classifyWork(text){
  const job=positive(text);
  if(/快递|配送|外卖|送货|送餐|跑腿|运输|货车|邮递/.test(job))return 'delivery';
  if(/工厂|工人|流水线|制造|质检|维修|机械|零件|仓库|分拣|务农|采摘|农场/.test(job))return 'quality';
  if(/餐饮|服务员|餐厅|饭店|咖啡|奶茶|厨师|店员|收银|便利店|面包|甜品/.test(job))return 'service';
  if(/办公|文员|会计|行政|程序员|工程师|编辑|记者|研究员|教师|护士|医生|公务员|录入|校对|打工|兼职|上班|工作|受雇/.test(job))return 'office';
  return null;
}
export function getEncounterOffer(state,action={}){
  if(!state||state.ended||action.meta?.encounterGame||state.person?.deceased)return null;
  if(state.specialLife&&state.specialLife.body!=='human')return null;
  const text=positive(action.label),current=String(state.current?.narrative||''),region=regionForPlace(state.location);
  const seed=hash(`${state.seed}:${state.turn??state.history?.length??0}:${action.label||''}:encounter`);
  const localCrisis=state.encounterState?.zombieCrisis===true||state.worldOverrides?.[region]?.zombieCrisis===true||(region==='china'&&(state.seenEvents||[]).includes('cn_zombie_outbreak'));
  const battle=detectLocalBattle(state,action);
  const explicit=battle?.enemyKind==='zombie';
  const outdoors=/外出|出门|搜寻|搜索|采购|运送|巡逻|救援|撤离|上街|穿过街|找物资|寻找物资/.test(text);
  const zombies=explicit||(!battle&&localCrisis&&outdoors&&seed%100<62);
  let kind=battle?(battle.enemyKind==='zombie'?'zombie':'combat'):zombies?'zombie':null;
  const workIntent=!action.passive&&/打工|兼职|上班|工作|务工|做工|接单|送货|送餐|送外卖|送快递|派送|值班|流水线|质检|收银|校对|务农|采摘/.test(text)&&!/辞职|离职|停止工作|放假|休息/.test(text);
  const requestedJob=classifyWork(text.replace(/继续上班|正常上班|上班|继续工作|正常工作|工作|打工|兼职|务工|做工|接单/g,''));
  if(!kind&&workIntent)kind=requestedJob||classifyWork(state.employment?.kind||state.person?.occupation||'')||'office';
  if(!kind)return null;
  const gear=equipmentText(state),experience=ownText(joinedValues([state.person?.skills,state.person?.facts,state.person?.status,state.person?.occupation])),stats=state.stats||{},fitness=clamp(stats.fitness,0,100),intelligence=clamp(stats.intelligence,0,100);
  const rifle=/步枪|冲锋枪|机枪|霰弹枪|rifle|shotgun/i.test(gear),pistol=rifle||/手枪|枪械|配枪|pistol/i.test(gear),trained=/射击|军人|士兵|步兵|军官|特种|格斗|搏击/.test(experience);
  const immunityRecord=`${experience}。${ownText(state.profile?.backgroundText)}`;
  const declaredImmunity=/(?:丧尸|感染|病毒).{0,8}免疫|免疫.{0,8}(?:丧尸|感染|病毒)/.test(immunityRecord)&&!/不免疫|并非.{0,6}免疫|失去.{0,6}免疫|丧失.{0,6}免疫|免疫.{0,5}消失/.test(immunityRecord);
  const immune=typeof state.encounterState?.immune==='boolean'?state.encounterState.immune:typeof state.person?.immune==='boolean'?state.person.immune:declaredImmunity;
  const armor=/装甲|外骨骼|重甲/.test(gear)?9:/防护服|防咬服|护甲|防弹衣/.test(gear)?5:/头盔|护具|皮夹克/.test(gear)?2:0;
  const salary=clamp(state.employment?.monthlyIncome,0,1e12);
  const description=battle?battle.description:zombies?'外出经过街口时，附近的感染者开始靠近。':`${state.employment?.kind||state.person?.occupation||'工作'}：${text}`.slice(0,240);
  const carriedAmmo=Number.isFinite(state.encounterState?.ammo)?integer(state.encounterState.ammo,0,120):pistol?(rifle?30:12):0,ammo=pistol?carriedAmmo:0;
  const relevantSkills=(state.person?.skills||[]).filter(skill=>kind==='delivery'?/驾驶|骑车|骑行|路线|配送|体能/.test(skill):kind==='quality'?/维修|机械|制造|质检|农业|采摘/.test(skill):kind==='service'?/烹饪|咖啡|烘焙|服务|沟通/.test(skill):/会计|办公|计算|编程|校对|统计/.test(skill)).length;
  const skill=integer((fitness+intelligence)/2+Math.min(25,relevantSkills*8),0,100);
  const enemyCount=battle?.enemyCount??(zombies?numberOfEnemies(description,seed):0),allyCount=battle?.allyCount??0,participantCount=1+enemyCount+allyCount;
  const combat=kind==='zombie'||kind==='combat',combatMode=combat?(participantCount<=10?'turn-based':'realtime'):undefined;
  return {version:combat?2:1,id:`encounter-${seed.toString(16)}`,kind,seed,durationMs:combat?(combatMode==='realtime'?60000:0):ENCOUNTER_DURATION_MS,...(combat?{combatMode,allyCount,participantCount}:{}),title:combat?(kind==='zombie'?'眼前的感染者':'眼前的交锋'):TITLES[kind],description,job:state.employment?.kind||state.person?.occupation||'临时工作',bonusPerTask:integer((salary||3000)/120*(.75+skill/200),5,125),workStepMs:integer(420-skill*1.8,240,420),terrain:/公园|山林|树林|草地/.test(description)?'park':/工厂|仓库|车间/.test(description)?'industrial':['street','park','industrial'][seed%3],enemyCount,enemyType:kind==='combat'?'human':/奔跑|敏捷|快速/.test(description)?'runner':/重型|巨大|强壮/.test(description)?'brute':'mixed',player:{health:integer(stats.health??100,1,100),speed:140+fitness*1.05+(trained?18:0),meleeDamage:integer(15+fitness*.23+(trained?10:0)+(/刀|棍|斧|撬棍|长矛/.test(gear)?12:0),12,62),rangedDamage:pistol?(rifle?50:34)+(trained?12:0):0,ammo,carriedAmmo,armor,immune,infected:state.encounterState?.infected===true,trained,skill,bait:2}};
}

function random(model){model.rng=(Math.imul(model.rng,1664525)+1013904223)>>>0;return model.rng/4294967296;}
function obstructed(model,x,y,r=13){return model.obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);}
function move(model,actor,dx,dy,distance){
  const size=Math.hypot(dx,dy);if(!size)return false;
  const terrain=model.slowZones?.find(zone=>actor.x>=zone.x&&actor.x<=zone.x+zone.w&&actor.y>=zone.y&&actor.y<=zone.y+zone.h);if(terrain)distance*=terrain.factor;
  const x=clamp(actor.x+dx/size*distance,actor.r,WIDTH-actor.r),y=clamp(actor.y+dy/size*distance,actor.r,HEIGHT-actor.r);
  let moved=false;
  if(!obstructed(model,x,actor.y,actor.r)){moved||=x!==actor.x;actor.x=x;}
  if(!obstructed(model,actor.x,y,actor.r)){moved||=y!==actor.y;actor.y=y;}
  return moved;
}
function lineBlocked(model,a,b){
  const steps=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/9);
  for(let i=1;i<steps;i++)if(obstructed(model,a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,1))return true;
  return false;
}
function nextWorkTask(model){
  if(model.offer.kind==='quality')model.task={defective:random(model)<.48,variant:Math.floor(random(model)*3),serial:1000+Math.floor(random(model)*8000)};
  if(model.offer.kind==='service')model.task={order:Array.from({length:3},()=>Math.floor(random(model)*3)),cursor:0};
  if(model.offer.kind==='office'){
    const wrong=Math.floor(random(model)*4);model.task={wrong,rows:Array.from({length:4},(_,i)=>{const original=100+Math.floor(random(model)*890),entered=i===wrong?original+1+Math.floor(random(model)*8):original;return {original,entered};})};
  }
}
export function createEncounterModel(offer){
  if(offer?.combatMode)return createBattleModel(offer);
  if(!offer||!['zombie',...WORK_KINDS].includes(offer.kind)||!offer.player)throw new Error('无法开始这一段经历。');
  const model={offer:structuredClone(offer),width:WIDTH,height:HEIGHT,rng:offer.seed>>>0,elapsedMs:0,paused:false,done:false,score:0,mistakes:0,kills:0,hits:0,damageTaken:0,ammoUsed:0,escaped:false,attackAt:-9999,baitAt:-9999,workAt:-9999,collisionAt:-9999,player:{x:65,y:HEIGHT/2,r:14,health:offer.player.health,ammo:offer.player.ammo,bait:offer.player.bait},obstacles:[],slowZones:[],enemies:[],baits:[],flashes:[],targets:[],targetIndex:0};
  if(['zombie','delivery'].includes(offer.kind)){
    // A connected street remains between every row and around all map edges.
    model.obstacles=Array.from({length:8},(_,i)=>({x:175+(i%4)*175+Math.floor(random(model)*25),y:i<4?85:340,w:90+Math.floor(random(model)*35),h:95+Math.floor(random(model)*30)}));
    model.slowZones=[offer.terrain==='park'?{x:390,y:210,w:145,h:110,factor:.48,label:'泥地',color:'#726547'}:offer.terrain==='industrial'?{x:550,y:225,w:125,h:90,factor:.65,label:'散落货物',color:'#68616a'}:{x:390,y:230,w:115,h:85,factor:.62,label:'碎石',color:'#837f70'}];
  }
  if(offer.kind==='zombie'){
    model.enemies=Array.from({length:offer.enemyCount},(_,i)=>{
      const type=offer.enemyType==='mixed'?(i%5===0?'runner':i%7===0?'brute':'walker'):offer.enemyType;
      const e={id:i,type,x:540+random(model)*380,y:35+random(model)*(HEIGHT-70),r:type==='brute'?18:12,health:type==='brute'?90:40,speed:type==='runner'?88:type==='brute'?41:57,hitAt:-9999};
      let attempts=0;while(obstructed(model,e.x,e.y,e.r)&&attempts++<60){e.x=510+random(model)*400;e.y=30+random(model)*(HEIGHT-60);}if(obstructed(model,e.x,e.y,e.r))e.y=260;return e;
    });
  }
  if(offer.kind==='delivery'){
    model.targets=[{x:340,y:265},{x:875,y:265},{x:875,y:40},{x:500,y:35},{x:90,y:490},{x:680,y:490},{x:875,y:265},{x:80,y:265}];
    if(offer.seed%2)model.targets=[...model.targets.slice(0,3),...model.targets.slice(3).reverse()];
  }
  nextWorkTask(model);return model;
}
function nearestEnemy(model,max=Infinity){return model.enemies.filter(e=>e.health>0&&Math.hypot(e.x-model.player.x,e.y-model.player.y)<=max&&!lineBlocked(model,model.player,e)).sort((a,b)=>Math.hypot(a.x-model.player.x,a.y-model.player.y)-Math.hypot(b.x-model.player.x,b.y-model.player.y))[0];}
export function performEncounterAction(model,action){
  if(model.offer?.combatMode)return performBattleAction(model,action);
  if(model.paused||model.done)return false;
  const kind=model.offer.kind,p=model.player;
  if(kind==='zombie'){
    if(action==='escape'){
      if(p.x<100&&Math.abs(p.y-HEIGHT/2)<95){model.escaped=true;model.done=true;return true;}return false;
    }
    if(action==='bait'){
      if(!p.bait||model.elapsedMs-model.baitAt<400)return false;
      p.bait--;model.baitAt=model.elapsedMs;
      const target=nearestEnemy(model),x=clamp(p.x+(target?target.x-p.x:150)*.7,30,WIDTH-30),y=clamp(p.y-100,30,HEIGHT-30);
      model.baits.push({x,y,expires:model.elapsedMs+6500});return true;
    }
    if(!['melee','ranged'].includes(action)||model.elapsedMs-model.attackAt<(model.offer.player.trained?350:500))return false;
    const ranged=action==='ranged';if(ranged&&!p.ammo)return false;
    const enemy=nearestEnemy(model,ranged?430:66);if(!enemy)return false;
    model.attackAt=model.elapsedMs;
    if(ranged){p.ammo--;model.ammoUsed++;}
    enemy.health-=ranged?model.offer.player.rangedDamage:model.offer.player.meleeDamage;
    model.flashes.push({x:p.x,y:p.y,toX:enemy.x,toY:enemy.y,ranged,expires:model.elapsedMs+180});
    if(enemy.health<=0){model.kills++;model.score++;}
    if(model.enemies.every(e=>e.health<=0))model.done=true;
    return true;
  }
  if(kind==='delivery'||model.elapsedMs-model.workAt<(model.offer.workStepMs||320))return false;
  const selection=typeof action==='number'?action:Number(action);if(!Number.isInteger(selection))return false;
  if(kind==='quality'&&![0,1].includes(selection))return false;
  if(kind==='service'&&(selection<0||selection>2))return false;
  if(kind==='office'&&(selection<0||selection>3))return false;
  model.workAt=model.elapsedMs;
  if(kind==='quality'){
    if((selection===1)===model.task.defective)model.score++;else model.mistakes++;
    nextWorkTask(model);
  }else if(kind==='service'){
    if(selection===model.task.order[model.task.cursor]){model.task.cursor++;if(model.task.cursor===3){model.score++;nextWorkTask(model);}}
    else {model.mistakes++;model.task.cursor=0;}
  }else if(kind==='office'){
    if(selection===model.task.wrong)model.score++;else model.mistakes++;
    nextWorkTask(model);
  }
  return true;
}
export function stepEncounterGame(model,deltaMs,input={}){
  if(model.offer?.combatMode)return stepBattleGame(model,deltaMs,input);
  if(model.paused||model.done)return model;
  const ms=Math.min(clamp(deltaMs,0,80),ENCOUNTER_DURATION_MS-model.elapsedMs),dt=ms/1000;if(ms<=0)return model;
  model.elapsedMs+=ms;
  const kind=model.offer.kind,p=model.player;
  if(['zombie','delivery'].includes(kind)){
    let dx=Number(input.dx)||0,dy=Number(input.dy)||0;
    if(!dx&&!dy&&Number.isFinite(input.x)&&Number.isFinite(input.y)){dx=input.x-p.x;dy=input.y-p.y;}
    const distance=Math.min(Math.hypot(dx,dy),model.offer.player.speed*dt);
    const moved=move(model,p,dx,dy,distance);
    if(kind==='delivery'&&!moved&&distance>0&&model.elapsedMs-model.collisionAt>1200){model.mistakes++;model.collisionAt=model.elapsedMs;}
    if(kind==='delivery'){
      const destination=model.targets[model.targetIndex];
      if(destination&&Math.hypot(p.x-destination.x,p.y-destination.y)<27){model.score++;model.targetIndex++;if(model.targetIndex===model.targets.length)model.done=true;}
    }else{
      model.baits=model.baits.filter(b=>b.expires>model.elapsedMs);model.flashes=model.flashes.filter(f=>f.expires>model.elapsedMs);
      for(const enemy of model.enemies){
        if(enemy.health<=0)continue;
        const target=model.baits.reduce((closest,b)=>Math.hypot(enemy.x-b.x,enemy.y-b.y)<300?b:closest,p);
        const ex=target.x-enemy.x,ey=target.y-enemy.y;
        if(Math.hypot(ex,ey)>enemy.r+p.r-3){
          const moved=move(model,enemy,ex,ey,enemy.speed*dt);
          if(!moved)move(model,enemy,enemy.id%2?ey:-ey,enemy.id%2?-ex:ex,enemy.speed*dt);
        }
        if(target===p&&Math.hypot(enemy.x-p.x,enemy.y-p.y)<enemy.r+p.r+4&&model.elapsedMs-enemy.hitAt>=1000){
          enemy.hitAt=model.elapsedMs;const damage=Math.max(0,(enemy.type==='brute'?14:8)-model.offer.player.armor);
          if(damage>0){model.hits++;const taken=Math.min(p.health,damage);p.health-=taken;model.damageTaken+=taken;}
          if(p.health<=0){model.done=true;break;}
        }
      }
    }
  }
  if(model.elapsedMs>=ENCOUNTER_DURATION_MS)model.done=true;return model;
}
export function encounterGameResult(model){
  if(model.offer?.combatMode)return battleGameResult(model);
  return validateEncounterResult(model.offer,{version:1,offerId:model.offer.id,kind:model.offer.kind,elapsedMs:model.elapsedMs,completed:model.done,score:model.score,mistakes:model.mistakes,kills:model.kills,hits:model.hits,damageTaken:model.damageTaken,ammoUsed:model.ammoUsed,escaped:model.escaped});
}
export function validateEncounterResult(offer,result){
  if(offer?.combatMode)return validateBattleResult(offer,result);
  if(!offer||!result||result.version!==1||result.offerId!==offer.id||result.kind!==offer.kind)throw new Error('这次经历的记录不匹配，请重新确认。');
  for(const key of ['elapsedMs','score','mistakes','kills','hits','damageTaken','ammoUsed'])if(!Number.isFinite(result[key])||result[key]<0)throw new Error('这次经历的记录不完整。');
  const elapsedMs=integer(result.elapsedMs,0,ENCOUNTER_DURATION_MS),zombie=offer.kind==='zombie';
  const cadence=offer.workStepMs||320,maxTasks=offer.kind==='delivery'?8:offer.kind==='service'?Math.floor(elapsedMs/(cadence*3))+1:Math.floor(elapsedMs/cadence)+1;
  const kills=zombie&&elapsedMs>0?integer(result.kills,0,offer.enemyCount):0,hits=zombie?integer(result.hits,0,Math.min(200,Math.ceil(elapsedMs/1000)*offer.enemyCount)):0;
  const damageTaken=hits?integer(result.damageTaken,1,Math.min(offer.player.health,hits*14)):0;
  const score=zombie?kills:integer(result.score,0,elapsedMs>0?Math.min(160,maxTasks):0);
  return {version:1,offerId:offer.id,kind:offer.kind,elapsedMs,completed:!!result.completed,score,mistakes:zombie?0:integer(result.mistakes,0,elapsedMs>0?160:0),kills,hits,damageTaken,ammoUsed:zombie?integer(result.ammoUsed,0,offer.player.ammo):0,escaped:zombie&&!!result.escaped,infected:zombie&&!offer.player.immune&&(hits>0||offer.player.infected)};
}
export function encounterResultEffect(offer,result){
  if(offer?.combatMode)return battleResultEffect(offer,result);
  const r=validateEncounterResult(offer,result);
  if(offer.kind==='zombie'){
    if(!r.completed||!(r.escaped||r.kills>=offer.enemyCount||r.elapsedMs>=ENCOUNTER_DURATION_MS||r.damageTaken>=offer.player.health))throw new Error('眼前的险情还没有结束，请先返回出口撤离，或处理完附近的感染者。');
    const infection=r.infected?'伤口已经受到感染，需要尽快处理。':offer.player.immune&&r.hits?'身体挡住了感染，伤口仍需照料。':'暂时没有受到感染。';
    const injury=r.damageTaken>=30?'伤势较重，行走时需要他人照应。':r.damageTaken?'身上留下了伤口，需要清洁和包扎。':'';
    return {delta:{health:-r.damageTaken,fitness:r.kills>0?1:0,stress:Math.min(8,Math.ceil(r.hits/2))},incomeBonus:0,summary:`你遇到${offer.enemyCount}名感染者，制服了${r.kills}名${r.escaped?'，随后从街口撤离':'。这次交锋已经结束'}。${injury}${infection}`,encounterState:{lastEncounterId:offer.id,infected:r.infected,immune:offer.player.immune,ammo:Math.max(0,(offer.player.carriedAmmo??offer.player.ammo)-r.ammoUsed)}};
  }
  // The ordinary employment ledger still pays the salary exactly once. This is only task bonus.
  const incomeBonus=integer(Math.max(0,r.score-r.mistakes)*offer.bonusPerTask,0,6000);
  const task={delivery:'处派送',quality:'件检验',service:'份订单',office:'张核对单'}[offer.kind];
  return {delta:{stress:Math.min(4,Math.floor(r.mistakes/3)),...(r.score>=3?offer.kind==='delivery'?{fitness:1}:{intelligence:1}:{})},incomeBonus,summary:`你完成了${r.score}${task}${r.mistakes?`，处理时出现${r.mistakes}次差错`:''}。${incomeBonus?`这批工作另有${incomeBonus}元奖金，随本月工资一同入账。`:'本月工资照常结算。'}`,encounterState:{lastEncounterId:offer.id}};
}

function drawText(ctx,text,x,y,size=20,color='#f0eee5',align='left'){ctx.font=`${size}px sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(text,x,y);}
function drawMap(ctx,model,avatar){
  const palette={street:['#343e44','#69757a','#202c34'],park:['#3e5549','#6c7d58','#283e34'],industrial:['#3b3c43','#74747e','#242731']}[model.offer.terrain]||['#343e44','#69757a','#202c34'];
  ctx.fillStyle=palette[0];ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.strokeStyle='#ffffff0d';ctx.lineWidth=1;
  for(let x=0;x<WIDTH;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,HEIGHT);ctx.stroke();}
  for(let y=0;y<HEIGHT;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
  for(const zone of model.slowZones){ctx.fillStyle=zone.color;ctx.fillRect(zone.x,zone.y,zone.w,zone.h);drawText(ctx,zone.label,zone.x+zone.w/2,zone.y+zone.h/2+6,17,'#efe6cd','center');}
  for(const o of model.obstacles){
    ctx.fillStyle=palette[2];ctx.fillRect(o.x+5,o.y+7,o.w,o.h);ctx.fillStyle=palette[1];ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeStyle='#c6c5aa44';ctx.strokeRect(o.x+6,o.y+6,o.w-12,o.h-12);
    if(model.offer.terrain==='park'){ctx.fillStyle='#39573b';for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(o.x+o.w*(i%2?.7:.3),o.y+o.h*(i<2?.3:.7),24,0,Math.PI*2);ctx.fill();}}
    else if(model.offer.terrain==='industrial'){ctx.strokeStyle='#d4c9a355';for(let x=o.x+15;x<o.x+o.w-10;x+=15){ctx.beginPath();ctx.moveTo(x,o.y+10);ctx.lineTo(x,o.y+o.h-10);ctx.stroke();}}
    else {ctx.fillStyle='#a1b8b3';for(let i=0;i<4;i++)ctx.fillRect(o.x+15+(i%2)*45,o.y+20+Math.floor(i/2)*48,20,23);}
  }
  if(model.offer.kind==='zombie'){
    ctx.fillStyle='#72b49550';ctx.fillRect(5,HEIGHT/2-95,90,190);drawText(ctx,'撤离点',50,HEIGHT/2,19,'#e7f9d6','center');
    for(const b of model.baits){ctx.fillStyle='#e9d37a';ctx.beginPath();ctx.arc(b.x,b.y,9,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e9d37a55';ctx.beginPath();ctx.arc(b.x,b.y,32,0,Math.PI*2);ctx.stroke();}
    for(const e of model.enemies){if(e.health<=0)continue;ctx.fillStyle=e.type==='brute'?'#a86c64':e.type==='runner'?'#d4a769':'#92aa79';ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#2b3f2d';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(e.x-4,e.y-3);ctx.lineTo(e.x+4,e.y+3);ctx.stroke();}
    for(const f of model.flashes){ctx.strokeStyle=f.ranged?'#f4df8c':'#dce7de';ctx.lineWidth=f.ranged?2:8;ctx.beginPath();ctx.moveTo(f.x,f.y);ctx.lineTo(f.toX,f.toY);ctx.stroke();}
  }else{
    model.targets.forEach((t,i)=>{ctx.fillStyle=i<model.targetIndex?'#71947c':i===model.targetIndex?'#efd07d':'#677579';ctx.beginPath();ctx.arc(t.x,t.y,i===model.targetIndex?22:16,0,Math.PI*2);ctx.fill();drawText(ctx,String(i+1),t.x,t.y+6,17,'#1a2c35','center');});
  }
  const p=model.player;drawMinigameAvatar(ctx,avatar,p.x,p.y,Math.max(20,p.r),{ring:'#f7dfa0'});drawText(ctx,'你',p.x,Math.max(17,p.y-31),16,'#fff','center');
}
function drawWork(ctx,model,avatar){
  ctx.fillStyle='#26363e';ctx.fillRect(0,0,WIDTH,HEIGHT);
  const kind=model.offer.kind,t=model.task;
  drawMinigameAvatar(ctx,avatar,51,51,28);drawText(ctx,avatar?.name||'你',95,59,19,'#f0eee5');
  if(kind==='quality'){
    ctx.fillStyle='#18262d';ctx.fillRect(70,130,820,230);ctx.strokeStyle='#89989e';ctx.lineWidth=5;
    for(let x=90;x<880;x+=34){ctx.beginPath();ctx.moveTo(x,140);ctx.lineTo(x,350);ctx.stroke();}
    ctx.fillStyle='#c3c8be';ctx.fillRect(340,150,280,190);ctx.strokeStyle='#e7eee2';ctx.lineWidth=7;ctx.strokeRect(355,165,250,160);
    if(t.defective){ctx.strokeStyle='#b84f45';ctx.fillStyle='#ba5648';ctx.lineWidth=7;
      if(t.variant===0){ctx.beginPath();ctx.moveTo(420,170);ctx.lineTo(470,230);ctx.lineTo(445,263);ctx.lineTo(515,318);ctx.stroke();}
      else if(t.variant===1){ctx.fillStyle='#18262d';ctx.fillRect(570,150,50,60);}
      else{ctx.beginPath();ctx.arc(490,240,22,0,Math.PI*2);ctx.fill();}
    }
    drawText(ctx,`零件 ${t.serial}`,480,85,26,'#eeeadd','center');drawText(ctx,'裂纹、缺口、红色故障点均需拣出',480,415,22,'#d6ded9','center');
  }else if(kind==='service'){
    const foods=['饭团','热饮','甜点'],colors=['#dfcc95','#b68a68','#d89d9a'];
    drawText(ctx,'当前订单',480,80,27,'#eeeadd','center');
    t.order.forEach((food,i)=>{const x=260+i*220;ctx.fillStyle=i<t.cursor?'#60856f':'#40535d';ctx.fillRect(x-88,135,176,180);drawText(ctx,foods[food],x,228,30,colors[food],'center');drawText(ctx,i<t.cursor?'已备好':i===t.cursor?'正在准备':'待准备',x,285,19,'#e4e6dc','center');});
    drawText(ctx,'从左到右配齐一份订单',480,405,23,'#d6ded9','center');
  }else{
    drawText(ctx,'原单金额',355,75,25,'#dddccc','center');drawText(ctx,'录入金额',640,75,25,'#dddccc','center');
    t.rows.forEach((row,i)=>{const y=120+i*86;ctx.fillStyle=i%2?'#344b57':'#3f5661';ctx.fillRect(145,y,670,70);drawText(ctx,String(i+1),185,y+44,23,'#e4c887','center');drawText(ctx,String(row.original),355,y+44,27,'#f1ede2','center');drawText(ctx,String(row.entered),640,y+44,27,'#f1ede2','center');});
    drawText(ctx,'点击金额不一致的一行',480,510,20,'#d6ded9','center');
  }
}
function drawScene(ctx,model,avatar){
  if(['zombie','delivery'].includes(model.offer.kind))drawMap(ctx,model,avatar);else drawWork(ctx,model,avatar);
  if(model.paused||model.done){ctx.fillStyle='#101d25cc';ctx.fillRect(0,0,WIDTH,HEIGHT);drawText(ctx,model.done?(model.player.health<=0?'同伴正在把你送离现场':model.escaped?'你已经离开这条街':'这次安排结束了'):'已暂停',WIDTH/2,HEIGHT/2-12,30,'#f1ece0','center');drawText(ctx,model.done?'点击「记录这次经历」继续。':'点击「继续」返回。',WIDTH/2,HEIGHT/2+33,19,'#e7ded0','center');}
}

export function openEncounterGame(offer,{document:doc=globalThis.document,window:win=globalThis.window,playerState=null}={}){
  if(offer?.combatMode)return openBattleGame(offer,{document:doc,window:win,playerState});
  return new Promise(resolve=>{
    if(!doc?.createElement||!win?.requestAnimationFrame){resolve(null);return;}
    const model=createEncounterModel(offer),dialog=doc.createElement('dialog');dialog.className='encounter-dialog';dialog.setAttribute('aria-labelledby','encounter-title');
    dialog.innerHTML='<div class="modal-header"><div><span class="eyebrow" data-encounter-subtitle></span><h2 id="encounter-title"></h2><div data-minigame-identity></div></div><button type="button" data-encounter-exit aria-label="退出，不记录">×</button></div><p class="encounter-instructions" id="encounter-help"></p><div class="encounter-hud" aria-live="off"><span data-encounter-score></span><span data-encounter-health></span><span data-encounter-time></span></div><canvas class="encounter-canvas" width="960" height="540" tabindex="0" aria-describedby="encounter-help"></canvas><div class="encounter-actions"></div><p class="encounter-status" role="status"></p><div class="encounter-buttons"><button type="button" class="quiet" data-encounter-exit>退出，不记录</button><button type="button" class="secondary" data-encounter-pause>暂停</button><button type="button" class="primary" data-encounter-finish>记录这次经历 →</button></div>';
    doc.body.append(dialog);
    dialog.querySelector('#encounter-title').textContent=offer.title||TITLES[offer.kind];
    dialog.querySelector('[data-encounter-subtitle]').textContent=offer.kind==='zombie'?'身边的险情':'工作中的一段安排';
    dialog.querySelector('#encounter-help').textContent=INSTRUCTIONS[offer.kind];
    const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d');
    if(!ctx){dialog.remove();resolve(null);return;}
    const avatar=createMinigameAvatar(playerState,{window:win});
    mountMinigameIdentity(dialog.querySelector('[data-minigame-identity]'),avatar,doc);
    canvas.setAttribute('aria-label',TITLES[offer.kind]);
    const buttons=dialog.querySelector('.encounter-actions'),status=dialog.querySelector('.encounter-status'),pause=dialog.querySelector('[data-encounter-pause]'),record=dialog.querySelector('[data-encounter-finish]');
    record.disabled=offer.kind==='zombie';
    const controls=offer.kind==='zombie'?[['挥击 (1)','melee'],['射击 (2)','ranged'],['诱饵 (3)','bait'],['撤离 (4)','escape']]:offer.kind==='quality'?[['放行 (1)',0],['拣出 (2)',1]]:offer.kind==='service'?[['饭团 (1)',0],['热饮 (2)',1],['甜点 (3)',2]]:offer.kind==='office'?[['第 1 行',0],['第 2 行',1],['第 3 行',2],['第 4 行',3]]:[];
    let frame=0,last=0,settled=false,displayed='',touchId=null;const keys=new Set(),input={},listeners=[];
    const listen=(target,event,fn,opts)=>{target.addEventListener(event,fn,opts);listeners.push(()=>target.removeEventListener(event,fn,opts));};
    const finish=result=>{if(settled)return;settled=true;avatar.dispose();win.cancelAnimationFrame(frame);listeners.forEach(remove=>remove());if(dialog.open)dialog.close();dialog.remove();resolve(result);};
    const setPaused=value=>{if(model.done)return;model.paused=value;keys.clear();delete input.x;delete input.y;pause.textContent=value?'继续':'暂停';status.textContent=value?'动作与计时都已停下。':'继续处理眼前的事情。';};
    const useAction=action=>{const used=performEncounterAction(model,action);record.disabled=offer.kind==='zombie'&&!model.done;if(!used&&offer.kind==='zombie'&&action==='escape')status.textContent='先返回地图左侧的绿色出口。';else if(!used&&action==='ranged'&&!model.player.ammo)status.textContent='身上没有可用的弹药。';canvas.focus({preventScroll:true});};
    controls.forEach(([label,action])=>{const button=doc.createElement('button');button.type='button';button.className='secondary';button.textContent=label;buttons.append(button);listen(button,'click',()=>useAction(action));});
    listen(dialog,'cancel',event=>{event.preventDefault();finish(null);});listen(dialog,'close',()=>finish(null));
    dialog.querySelectorAll('[data-encounter-exit]').forEach(button=>listen(button,'click',()=>finish(null)));
    listen(pause,'click',()=>{setPaused(!model.paused);canvas.focus({preventScroll:true});});
    listen(record,'click',()=>{if(offer.kind==='zombie'&&!model.done){status.textContent='眼前的险情还没有结束，可以先返回绿色出口撤离。';return;}finish(encounterGameResult(model));});
    const point=event=>{const r=canvas.getBoundingClientRect();if(r.width&&r.height)return {x:(event.clientX-r.left)/r.width*WIDTH,y:(event.clientY-r.top)/r.height*HEIGHT};return null;};
    listen(canvas,'pointerdown',event=>{
      event.preventDefault();canvas.focus({preventScroll:true});const p=point(event);if(!p)return;
      if(offer.kind==='office'){const row=Math.floor((p.y-120)/86);if(p.x>=145&&p.x<=815&&row>=0&&row<4&&(p.y-120)%86<70)useAction(row);}
      else if(['zombie','delivery'].includes(offer.kind)){touchId=event.pointerId;canvas.setPointerCapture?.(event.pointerId);Object.assign(input,p);}
    });
    listen(canvas,'pointermove',event=>{if(['zombie','delivery'].includes(offer.kind)&&(event.pointerType==='mouse'||event.pointerId===touchId&&event.buttons)){const p=point(event);if(p)Object.assign(input,p);}});
    listen(canvas,'pointerup',event=>{if(event.pointerId===touchId)touchId=null;});listen(canvas,'pointercancel',()=>{touchId=null;delete input.x;delete input.y;});
    listen(canvas,'keydown',event=>{
      const key=event.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)){event.preventDefault();keys.add(key);}
      if(event.code==='Space'){event.preventDefault();if(!event.repeat)setPaused(!model.paused);}
      if(/^[1-4]$/.test(key)&&!event.repeat){const chosen=controls[Number(key)-1];if(chosen){event.preventDefault();useAction(chosen[1]);}}
    });
    listen(win,'keyup',event=>keys.delete(event.key.toLowerCase()));listen(win,'blur',()=>setPaused(true));listen(doc,'visibilitychange',()=>{if(doc.hidden)setPaused(true);});
    const tick=now=>{
      if(settled)return;
      input.dx=((keys.has('arrowright')||keys.has('d'))?1000:0)-((keys.has('arrowleft')||keys.has('a'))?1000:0);input.dy=((keys.has('arrowdown')||keys.has('s'))?1000:0)-((keys.has('arrowup')||keys.has('w'))?1000:0);
      stepEncounterGame(model,last?now-last:0,input);last=now;drawScene(ctx,model,avatar);
      dialog.querySelector('[data-encounter-score]').textContent=offer.kind==='zombie'?`已制服 ${model.kills} / ${offer.enemyCount}`:`已完成 ${model.score} · 差错 ${model.mistakes}`;
      dialog.querySelector('[data-encounter-health]').textContent=offer.kind==='zombie'?`健康 ${model.player.health} · 弹药 ${model.player.ammo} · 诱饵 ${model.player.bait}`:'工资另按本月工作结算';
      dialog.querySelector('[data-encounter-time]').textContent=`剩余 ${Math.ceil((ENCOUNTER_DURATION_MS-model.elapsedMs)/1000)} 秒`;
      const next=`${model.score}:${model.mistakes}:${model.hits}:${model.done}`;
      if(next!==displayed){displayed=next;status.textContent=model.done?'这段经历已经结束，可以继续接下来的生活。':offer.kind==='zombie'?(model.hits?(offer.player.immune?'免疫能力阻止了感染，伤口仍在。':'伤口受到感染，需要尽快离开并处理。'):'留意感染者的位置，也可以从出口撤离。'):model.mistakes?`已完成 ${model.score} 项，继续留意眼前的细节。`:`已完成 ${model.score} 项。`;}
      pause.disabled=model.done;record.disabled=offer.kind==='zombie'&&!model.done;if(!model.done)frame=win.requestAnimationFrame(tick);
    };
    dialog.showModal();canvas.focus({preventScroll:true});frame=win.requestAnimationFrame(tick);
  });
}
