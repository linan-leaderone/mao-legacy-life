import test from 'node:test';
import assert from 'node:assert/strict';
import {ENCOUNTER_DURATION_MS,classifyWork,getEncounterOffer,createEncounterModel,performEncounterAction,stepEncounterGame,encounterGameResult,validateEncounterResult,encounterResultEffect,openEncounterGame} from '../src/encounter-games.js';
import {getPortrait} from '../src/portraits.js';

const state=(overrides={})=>({seed:'encounter-test',turn:6,month:66,location:'河南',stats:{health:85,fitness:50,intelligence:60},profile:{name:'小张',backgroundText:'普通家庭'},person:{occupation:'配送员',skills:[],facts:[],status:'住在城区'},current:{narrative:'你整理了本周的工作安排。'},seenEvents:[],employment:{kind:'外卖配送员',monthlyIncome:5000},...overrides});
const fight=(overrides={},label='我在街口遇到三只丧尸')=>getEncounterOffer(state(overrides),{custom:true,label});
// Older in-flight v1 encounters retain their original simulation contract.
const legacyFight=(...args)=>{const {combatMode,allyCount,participantCount,...offer}=fight(...args);return {...offer,version:1,durationMs:ENCOUNTER_DURATION_MS};};
const advance=(model,ms,input={})=>{for(let n=0;n<ms;n+=50)stepEncounterGame(model,Math.min(50,ms-n),input);return model;};

test('occupations select four distinct tasks and a nonworking action opens nothing',()=>{
  assert.equal(classifyWork('外卖配送员'),'delivery');assert.equal(classifyWork('工厂流水线工人'),'quality');assert.equal(classifyWork('咖啡馆服务员'),'service');assert.equal(classifyWork('会计文员'),'office');
  for(const [job,kind] of [['快递员','delivery'],['工厂质检','quality'],['餐厅服务员','service'],['办公室会计','office']]){
    const s=state({employment:{kind:job,monthlyIncome:4000},person:{occupation:job,skills:[],facts:[]}});
    assert.equal(getEncounterOffer(s,{label:'继续上班打工'}).kind,kind);
    assert.equal(getEncounterOffer(s,{label:'本月在家休息'}),null);
    assert.equal(getEncounterOffer(s,{label:'辞职停止工作'}),null);
    assert.equal(getEncounterOffer(s,{label:'继续上班',passive:true}),null);
  }
});
test('a distant zombie story cannot create a local encounter',()=>{
  const s=state({location:'日本',seenEvents:['cn_zombie_outbreak'],current:{narrative:'你在电视新闻里看到了中国大陆丧尸爆发的报道。'},pendingNews:[{id:'cn_zombie_outbreak',description:'附近出现大批丧尸',exposure:{level:'remote'}}]});
  assert.equal(getEncounterOffer(s,{label:'出门采购'}),null);
  assert.equal(getEncounterOffer(s,{label:'听说中国有丧尸，我在家读书'}),null);
  assert.equal(getEncounterOffer(state(),{label:'假如我在街口遇到三只丧尸'}),null);
  assert.equal(getEncounterOffer(state(),{label:'我没有遇到丧尸'}),null);
});
test('a remembered or resolved encounter is not replayed, and fresh nearby danger remains eligible',()=>{
  for(const narrative of ['上月你在街口遇到了三只丧尸。','此前你遇到了丧尸，回忆起那次遭遇。','你已经消灭了门外的丧尸。','你回想曾经遭遇感染者的事情。'])assert.equal(getEncounterOffer(state({current:{narrative}}),{label:'在家读书'}),null);
  const s=state({current:{narrative:'上月你在街口遇到了三只丧尸。门外现在有两只丧尸正在向你靠近。'}});assert.equal(getEncounterOffer(s,{label:'查看门外'}).kind,'zombie');
});
test('a current direct encounter opens even without a national crisis and parsed numbers are bounded',()=>{
  assert.equal(fight().kind,'zombie');assert.equal(fight().enemyCount,3);
  assert.equal(fight({},'我在街口遇到99只丧尸').enemyCount,99);
  const s=state({location:'日本',current:{narrative:'门外出现了两只丧尸，正在向你靠近。'}});
  assert.equal(getEncounterOffer(s,{label:'我离开房间'}).enemyCount,2);
  assert.equal(getEncounterOffer(state({specialLife:{kind:'deng_ocean',body:'small_fish'}}),{label:'我遇到了丧尸'}),null);
});
test('local outbreak only generates an outdoor encounter on its reproducible sample',()=>{
  let found=0,quiet=0;
  for(let turn=1;turn<=30;turn++){
    const s=state({turn,seenEvents:['cn_zombie_outbreak']});
    if(getEncounterOffer(s,{label:'出门寻找物资'}))found++;else quiet++;
    assert.equal(getEncounterOffer(s,{label:'留在屋里看书'}),null);
  }
  assert.ok(found>0);assert.ok(quiet>0);
});
test('offers and maps are deterministic, serializable, and tied to the action and turn',()=>{
  const offer=fight(),same=fight();assert.deepEqual(offer,same);assert.deepEqual(JSON.parse(JSON.stringify(offer)),offer);
  assert.deepEqual(createEncounterModel(offer),createEncounterModel(same));
  assert.notEqual(fight({turn:7}).id,offer.id);assert.notEqual(fight({},'我在街口遇到四只丧尸').id,offer.id);
  assert.equal(getEncounterOffer(state(),{label:'我在街口遇到三只丧尸',meta:{encounterGame:{offerId:offer.id}}}),null);
});
test('saved equipment, skills, health, fitness and remaining ammunition shape the loadout',()=>{
  const unarmed=fight(),armed=fight({stats:{health:49,fitness:92,intelligence:60},encounterState:{equipment:['步枪','防弹衣','撬棍'],ammo:7,immune:true},person:{occupation:'士兵',skills:['射击训练'],facts:[]}});
  assert.equal(unarmed.player.ammo,0);assert.equal(armed.player.ammo,7);assert.equal(armed.player.health,49);assert.equal(armed.player.immune,true);
  assert.ok(armed.player.meleeDamage>unarmed.player.meleeDamage);assert.ok(armed.player.rangedDamage>0);assert.ok(armed.player.armor>0);assert.ok(armed.player.speed>unarmed.player.speed);
  const denied=fight({profile:{backgroundText:'我没有步枪。我并未对丧尸病毒免疫。'},person:{skills:[],facts:['我没有手枪'],occupation:'学生'}});
  assert.equal(denied.player.ammo,0);assert.equal(denied.player.immune,false);
});
test('explicit loss of immunity overrides old facts and a job change overrides the old occupation',()=>{
  const old={occupation:'配送员',skills:[],facts:['我对丧尸病毒免疫']};
  assert.equal(fight({person:old,encounterState:{immune:false}}).player.immune,false);
  for(const text of ['我对丧尸病毒不免疫','我并非对丧尸病毒免疫','我已经失去丧尸病毒免疫力'])assert.equal(fight({person:{occupation:'学生',skills:[],facts:[text]}}).player.immune,false);
  assert.equal(getEncounterOffer(state(),{label:'我去餐厅当服务员打工'}).kind,'service');assert.equal(getEncounterOffer(state(),{label:'我去工厂做工'}).kind,'quality');assert.equal(getEncounterOffer(state(),{label:'我去办公室做会计工作'}).kind,'office');
});
test('touching an attacking zombie causes persistent infection unless immune; immune people still take damage',()=>{
  for(const immune of [false,true]){
    const offer=legacyFight({encounterState:{immune}}),m=createEncounterModel(offer);m.obstacles=[];m.enemies=[{id:0,type:'walker',x:m.player.x+20,y:m.player.y,r:12,health:40,speed:0,hitAt:-9999}];
    stepEncounterGame(m,50);performEncounterAction(m,'escape');const r=encounterGameResult(m),effect=encounterResultEffect(offer,r);
    assert.equal(r.hits,1);assert.equal(r.damageTaken,8);assert.equal(r.infected,!immune);assert.equal(effect.delta.health,-8);assert.equal(effect.encounterState.infected,!immune);
  }
});
test('armor blocking every point of a strike prevents a new infection; old infection does not vanish',()=>{
  const offer=legacyFight({encounterState:{equipment:['外骨骼'],infected:false}}),m=createEncounterModel(offer);m.obstacles=[];m.enemies=[{id:0,type:'walker',x:m.player.x+20,y:m.player.y,r:12,health:40,speed:0,hitAt:-9999}];
  stepEncounterGame(m,50);assert.equal(encounterGameResult(m).hits,0);assert.equal(encounterGameResult(m).infected,false);
  const infected=legacyFight({encounterState:{infected:true}}),old=createEncounterModel(infected);advance(old,50);performEncounterAction(old,'escape');assert.equal(encounterResultEffect(infected,encounterGameResult(old)).encounterState.infected,true);
});
test('obstacles block movement and shots; melee, ranged ammo, bait and retreat have separate effects',()=>{
  const offer=legacyFight({encounterState:{equipment:['手枪'],ammo:2}}),m=createEncounterModel(offer);m.player.x=120;m.player.y=265;m.obstacles=[{x:150,y:200,w:25,h:130}];m.enemies=[{id:0,type:'walker',x:210,y:265,r:12,health:40,speed:0,hitAt:-9999}];
  assert.equal(performEncounterAction(m,'ranged'),false);assert.equal(m.player.ammo,2);
  advance(m,500,{dx:1000});assert.ok(m.player.x<150);
  m.obstacles=[];assert.equal(performEncounterAction(m,'ranged'),true);assert.equal(m.player.ammo,1);assert.equal(m.ammoUsed,1);
  assert.equal(performEncounterAction(m,'ranged'),false);
  assert.equal(performEncounterAction(m,'bait'),true);assert.equal(m.player.bait,1);assert.equal(m.baits.length,1);
  assert.equal(performEncounterAction(m,'escape'),false);m.player.x=50;m.player.y=265;assert.equal(performEncounterAction(m,'escape'),true);assert.equal(encounterGameResult(m).escaped,true);
});
test('mud, rubble and cargo affect movement while retaining passable routes around the map',()=>{
  for(const terrain of ['park','street','industrial']){
    const offer={...legacyFight(),terrain},m=createEncounterModel(offer);m.enemies=[];
    const zone=m.slowZones[0];assert.ok(zone.factor>0&&zone.factor<1);m.player.x=zone.x+20;m.player.y=zone.y+20;
    const before=m.player.x;stepEncounterGame(m,50,{dx:1000});const slow=m.player.x-before;
    m.player.x=65;m.player.y=265;stepEncounterGame(m,50,{dx:1000});assert.ok(m.player.x-65>slow);
  }
});
test('actual elimination is counted once and makes the encounter stop',()=>{
  const m=createEncounterModel(legacyFight());m.obstacles=[];m.enemies=[{id:0,type:'walker',x:m.player.x+38,y:m.player.y,r:12,health:10,speed:0,hitAt:-9999}];
  advance(m,50);assert.equal(performEncounterAction(m,'melee'),true);assert.equal(m.kills,1);assert.equal(m.done,true);assert.equal(performEncounterAction(m,'melee'),false);
  const before=structuredClone(m);advance(m,50000);assert.deepEqual(m,before);
});
test('pause, bounded frame time and final time cannot award hidden-time actions',()=>{
  const m=createEncounterModel(legacyFight());m.enemies=[];m.paused=true;const initial=structuredClone(m);stepEncounterGame(m,90000,{dx:1000});assert.deepEqual(m,initial);
  m.paused=false;stepEncounterGame(m,90000);assert.equal(m.elapsedMs,80);m.elapsedMs=ENCOUNTER_DURATION_MS-5;stepEncounterGame(m,80);assert.equal(m.elapsedMs,ENCOUNTER_DURATION_MS);assert.equal(m.done,true);
});
test('work input scores real tasks, ignores rapid duplicate input and never returns base salary',()=>{
  for(const [job,kind] of [['工厂质检','quality'],['咖啡馆服务员','service'],['会计文员','office']]){
    const offer=getEncounterOffer(state({employment:{kind:job,monthlyIncome:5000},person:{occupation:job,skills:[],facts:[]}}),{label:'继续上班'}),m=createEncounterModel(offer);assert.equal(offer.kind,kind);
    advance(m,300);
    if(kind==='quality'){assert.equal(performEncounterAction(m,m.task.defective?1:0),true);assert.equal(performEncounterAction(m,0),false);}
    if(kind==='office'){assert.equal(performEncounterAction(m,m.task.wrong),true);assert.equal(performEncounterAction(m,0),false);}
    if(kind==='service'){for(let i=0;i<3;i++){performEncounterAction(m,m.task.order[m.task.cursor]);advance(m,450);}}
    assert.equal(m.score,1);const effect=encounterResultEffect(offer,encounterGameResult(m));assert.equal(effect.incomeBonus,offer.bonusPerTask);assert.equal(effect.delta.funds,undefined);assert.ok(effect.incomeBonus<5000);
    const before=structuredClone(m);m.paused=true;performEncounterAction(m,0);m.paused=false;assert.deepEqual(m,before);
  }
});
test('relevant skills and current attributes increase work cadence and task rewards',()=>{
  const occupation={occupation:'会计文员',skills:[],facts:[]},low=getEncounterOffer(state({stats:{health:85,fitness:10,intelligence:10},employment:{kind:'会计文员',monthlyIncome:4000},person:occupation}),{label:'继续上班'});
  const high=getEncounterOffer(state({stats:{health:85,fitness:80,intelligence:85},employment:{kind:'会计文员',monthlyIncome:4000},person:{...occupation,skills:['会计业务训练','校对训练']}}),{label:'继续上班'});
  assert.ok(high.workStepMs<low.workStepMs);assert.ok(high.bonusPerTask>low.bonusPerTask);
  const a=createEncounterModel(low),b=createEncounterModel(high);performEncounterAction(a,a.task.wrong);performEncounterAction(b,b.task.wrong);advance(a,300);advance(b,300);
  assert.equal(performEncounterAction(a,a.task.wrong),false);assert.equal(performEncounterAction(b,b.task.wrong),true);
});
test('delivery requires reaching each destination in order',()=>{
  const offer=getEncounterOffer(state(),{label:'继续送外卖'}),m=createEncounterModel(offer);
  assert.equal(offer.kind,'delivery');m.obstacles=[];m.player.x=m.targets[1].x;m.player.y=m.targets[1].y;stepEncounterGame(m,50);assert.equal(m.score,0);
  for(const point of m.targets){m.player.x=point.x;m.player.y=point.y;stepEncounterGame(m,50);}
  assert.equal(m.score,8);assert.equal(m.done,true);assert.equal(encounterGameResult(m).score,8);
});
test('result validation rejects foreign or malformed payloads and derives infection instead of trusting it',()=>{
  const offer=legacyFight(),m=createEncounterModel(offer),r=encounterGameResult(m);
  assert.throws(()=>validateEncounterResult(offer,{...r,offerId:'other'}));assert.throws(()=>validateEncounterResult(offer,{...r,kind:'office'}));
  for(const value of [NaN,Infinity,-1,'4'])assert.throws(()=>validateEncounterResult(offer,{...r,kills:value}));
  const capped=validateEncounterResult(offer,{...r,elapsedMs:1e8,score:1e8,kills:1e8,hits:1e8,damageTaken:1e8,ammoUsed:1e8,infected:false});
  assert.equal(capped.elapsedMs,45000);assert.equal(capped.kills,3);assert.equal(capped.damageTaken,85);assert.equal(capped.ammoUsed,0);assert.equal(capped.infected,true);
  assert.equal(validateEncounterResult(offer,{...r,infected:true}).infected,false);
});
test('work results cannot create infection, damage or unbounded money and empty play has no reward',()=>{
  const offer=getEncounterOffer(state(),{label:'继续上班'}),m=createEncounterModel(offer),zero=encounterGameResult(m);
  assert.equal(encounterResultEffect(offer,zero).incomeBonus,0);
  const r=validateEncounterResult(offer,{...zero,elapsedMs:1e8,score:1e8,mistakes:0,kills:1e8,hits:1e8,damageTaken:1e8,ammoUsed:1e8,infected:true});
  assert.equal(r.score,8);assert.equal(r.damageTaken,0);assert.equal(r.infected,false);assert.equal(r.kills,0);assert.ok(encounterResultEffect(offer,r).incomeBonus<=6000);
});
test('an unfinished fight cannot be committed by relabeling the result as complete',()=>{
  const offer=legacyFight(),m=createEncounterModel(offer);m.enemies=[];advance(m,250);const r=encounterGameResult(m);
  assert.throws(()=>encounterResultEffect(offer,r),/险情还没有结束/);assert.throws(()=>encounterResultEffect(offer,{...r,completed:true}),/险情还没有结束/);
  performEncounterAction(m,'escape');assert.doesNotThrow(()=>encounterResultEffect(offer,encounterGameResult(m)));
  const timed=createEncounterModel(offer);timed.enemies=[];advance(timed,45000);assert.doesNotThrow(()=>encounterResultEffect(offer,encounterGameResult(timed)));
});

function browserHarness(){
  class Element extends EventTarget{
    constructor(){super();this.removed=false;this.textContent='';this.disabled=false;this.children=[];}
    append(child){this.children.push(child);}remove(){this.removed=true;}focus(){}setAttribute(){}showModal(){this.open=true;}close(){this.open=false;this.dispatchEvent(new Event('close'));}
  }
  const window=new Element(),document=new Element(),dialog=new Element(),canvas=new Element(),noop=()=>{};
  const drawnImages=[],loadedImages=[],ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop}),drawImage:(image,...args)=>drawnImages.push({image,args})},{get:(target,key)=>target[key]||noop});canvas.getContext=()=>ctx;canvas.getBoundingClientRect=()=>({left:0,top:0,width:960,height:540});
  const controls=Object.fromEntries(['#encounter-title','[data-encounter-subtitle]','#encounter-help','.encounter-actions','.encounter-status','[data-encounter-pause]','[data-encounter-finish]','[data-encounter-score]','[data-encounter-health]','[data-encounter-time]'].map(k=>[k,new Element()]));
  const exits=[new Element(),new Element()];dialog.querySelector=key=>key==='canvas'?canvas:controls[key];dialog.querySelectorAll=()=>exits;document.body=new Element();document.createElement=tag=>tag==='dialog'?dialog:new Element();
  let scheduled,cancelled=0,id=0;window.requestAnimationFrame=fn=>{scheduled=fn;return ++id;};window.cancelAnimationFrame=()=>{scheduled=null;cancelled++;};
  window.Image=class{constructor(){this.complete=true;this.naturalWidth=64;this.naturalHeight=64;loadedImages.push(this);}};
  return {window,document,dialog,controls,exits,drawnImages,loadedImages,tick:now=>{const fn=scheduled;scheduled=null;fn?.(now);},cancelled:()=>cancelled};
}
test('every cancellation path returns null, removes listeners/frame and never mutates an offer or state',async()=>{
  for(const path of ['button','escape','close']){
    const s=state(),snapshot=structuredClone(s),offer=getEncounterOffer(s,{label:'继续上班'}),original=structuredClone(offer),env=browserHarness(),promise=openEncounterGame(offer,env);
    env.tick(100);env.tick(150);
    if(path==='button')env.exits[0].dispatchEvent(new Event('click'));else if(path==='escape')env.dialog.dispatchEvent(new Event('cancel',{cancelable:true}));else env.dialog.close();
    assert.equal(await promise,null);assert.deepEqual(s,snapshot);assert.deepEqual(offer,original);assert.equal(env.dialog.removed,true);assert.equal(env.cancelled(),1);
  }
});
test('acceptance resolves once and app hiding pauses interaction and elapsed time',async()=>{
  const env=browserHarness(),promise=openEncounterGame(getEncounterOffer(state(),{label:'继续上班'}),env);env.tick(100);env.document.hidden=true;env.document.dispatchEvent(new Event('visibilitychange'));env.tick(100000);
  assert.equal(env.controls['[data-encounter-pause]'].textContent,'继续');env.controls['[data-encounter-finish]'].dispatchEvent(new Event('click'));env.dialog.dispatchEvent(new Event('close'));
  const result=await promise;assert.equal(result.elapsedMs,0);assert.equal(result.infected,false);assert.equal(env.cancelled(),1);
  assert.equal(await openEncounterGame(legacyFight(),{document:null,window:null}),null);
});
test('recording is disabled during a live fight; exit withdrawal or cancellation remains available',async()=>{
  const env=browserHarness(),promise=openEncounterGame(legacyFight(),env),record=env.controls['[data-encounter-finish]'];
  assert.equal(record.disabled,true);record.dispatchEvent(new Event('click'));assert.equal(env.dialog.removed,false);assert.equal(env.cancelled(),0);
  assert.match(env.controls['.encounter-status'].textContent,/返回绿色出口/);
  env.controls['.encounter-actions'].children[3].dispatchEvent(new Event('click'));assert.equal(record.disabled,false);record.dispatchEvent(new Event('click'));
  const result=await promise;assert.equal(result.escaped,true);assert.equal(result.completed,true);assert.equal(env.cancelled(),1);
  const cancelled=browserHarness(),other=openEncounterGame(legacyFight(),cancelled);cancelled.exits[0].dispatchEvent(new Event('click'));assert.equal(await other,null);
});

test('delivery, quality, cafe, office and legacy encounters draw the actual player portrait without mutating state',async()=>{
  for(const job of ['外卖配送员','工厂质检','咖啡馆服务员','会计文员','legacy-zombie']){
    const playerState=state({profile:{name:'周晓',place:'浙江',age:23},employment:{kind:job,monthlyIncome:5000},person:{occupation:job,skills:[],facts:[]}});
    const before=structuredClone(playerState),source=job==='legacy-zombie'?legacyFight():getEncounterOffer(playerState,{label:'继续上班'}),env=browserHarness();
    const promise=openEncounterGame(source,{...env,playerState});env.tick(100);
    assert.ok(env.drawnImages.some(item=>item.image.src===getPortrait(playerState).src),job);
    env.exits[0].dispatchEvent(new Event('click'));assert.equal(await promise,null);assert.deepEqual(playerState,before);
    assert.ok(env.loadedImages.every(image=>image.onload===null&&image.onerror===null));
  }
});
