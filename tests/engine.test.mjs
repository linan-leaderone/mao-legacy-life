import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PLACES,POINT_STATS,createGame,chooseRoutes,dateLabel,ageLabel,currentAge,timelineEvents,worldHistory,nextContext,localEvent,advance,resolveAction,isDecisionMonth,cleanDelta,validateResponse,exportSave,importSave} from '../src/engine.js';
import {buildPrompt,generateMonth,listModels,DEFAULT_MODEL,responseSchema} from '../src/deepseek.js';
import {findPersona,personaAge} from '../src/personas.js';
const json=async path=>JSON.parse((await readFile(new URL(path,import.meta.url),'utf8')).replace(/^\uFEFF/,''));
const lore=await json('../src/data/lore.json'),news=await json('../src/data/news.json'),life=await json('../src/data/life-events.json');
const routes={china:'cn_han_cyber',taiwan:'tw_dpp',japan:'jp_ldp',europe:'eu_nato'};
const profile={name:'林安',age:18,place:'福建',background:'ordinary',backgroundText:'一名希望继续学习的普通人。',goal:'记录时代并照顾家人',seed:'reproducible-test',narrative:'balanced',routes};
const passive={label:'照常生活',passive:true},game=o=>createGame({...profile,...o},lore);
function tick(s,a=passive,d=lore){const c=nextContext(s,d,a);return advance(s,a,localEvent(c.state,d,a),null,d);}
function until(s,m,d=lore){while(s.month<m)s=tick(s,passive,d);return s;}
function tamper(s,f){const x=JSON.parse(exportSave(s));f(x.game);return JSON.stringify(x);}
const ai=decision=>({title:'新的一个月',narrative:'清晨的街道渐渐有了人声。你把要读的书放在桌边，处理了家里的杂事，也给远方的朋友写了一封信。',consequence:'你照着原先的安排处理了手头的事务，家人的生活渐渐安定下来。',location:'福建',memory:'',actionDelta:{},options:decision?[{label:'继续学习',description:'整理笔记并阅读资料。',delta:{intelligence:3}},{label:'联系家人',description:'询问彼此近况。',delta:{connections:2}},{label:'休息几天',description:'照顾自己的身体。',delta:{health:2}}]:[]});
const settings={apiKey:'test-only-placeholder',model:DEFAULT_MODEL};
const response=v=>({ok:true,status:200,json:async()=>v,text:async()=>JSON.stringify(v)}),envelope=v=>({choices:[{message:{content:JSON.stringify(v)},finish_reason:'stop'}]});
const event=(id,earliestMonth,extra={})=>({id,title:id,description:'远处传来的消息让街头的人们停下来交谈，许多家庭开始调整生活安排。',earliestMonth,...extra});
const fixture=events=>({routes:[{id:'fixture',region:'china',milestones:[]}],worldEvents:events});
function validChoices(s){const n=s.current.options.length;if(isDecisionMonth(s))assert.ok(n>=3&&n<=5);else assert.equal(n,0);assert.equal(new Set(s.current.options.map(o=>o.label)).size,n);}
function success(s,label='推动民主改革'){
  for(let i=0;i<100;i++){const a={label:`${label}，第${i+1}次准备`,custom:true,check:{stat:'intelligence',difficulty:10}};if(resolveAction(s,a).success)return a;}
  assert.fail('No successful deterministic action found');
}

test('default player-led custom actions happen while attribute-dependent quality and balanced failures remain meaningful',()=>{
  let lowSmooth=0,highSmooth=0,balancedFailures=0,presetFailures=0;
  for(let i=0;i<60;i++){
    const low=game({seed:`quality-${i}`,narrative:undefined}),high=structuredClone(low);low.stats.fitness=0;low.stats.intelligence=0;high.stats.fitness=100;high.stats.intelligence=100;
    const a={label:'参加体能训练',custom:true,check:{stat:'fitness',difficulty:60}},l=resolveAction(low,a),h=resolveAction(high,a);
    assert.equal(low.profile.narrative,'player');assert.equal(l.success,true);assert.equal(h.success,true);assert.equal(l.playerLed,true);assert.ok(['smooth','costly'].includes(l.quality));if(l.quality==='smooth')lowSmooth++;if(h.quality==='smooth')highSmooth++;
    const balanced=structuredClone(low);balanced.profile.narrative='balanced';if(!resolveAction(balanced,a).success)balancedFailures++;
    if(!resolveAction(low,{...a,custom:false,delta:{fitness:2}}).success)presetFailures++;
  }
  assert.ok(highSmooth>lowSmooth);assert.ok(lowSmooth<60);assert.ok(balancedFailures>0);assert.ok(presetFailures>0);
});

test('decision blocks vary by life and date but persist deterministically after save and reload',()=>{
  const patterns=new Set();
  for(let i=0;i<30;i++){const s=game({seed:`decisions-${i}`});let schedule='';for(let block=0;block<8;block++){let count=0;for(let offset=0;offset<4;offset++){const n=isDecisionMonth({...s,month:block*4+offset});if(n)count++;schedule+=Number(n);}assert.ok(count===1||count===2,`${i}:${block}`);}patterns.add(schedule);const restored=importSave(exportSave(s),lore);for(let month=0;month<32;month++)assert.equal(isDecisionMonth({...s,month}),isDecisionMonth({...restored,month}));}
  assert.ok(patterns.size>10);const lives=Array.from({length:30},()=>game({seed:undefined}));assert.equal(new Set(lives.map(s=>s.seed)).size,lives.length);assert.equal(new Set(lives.map(s=>s.id)).size,lives.length);
});

test('full birthday and stored month age control current age instead of stale profile age',()=>{
  const s=game({age:18});s.profile.startAgeMonths=18*12+8;s.month=6;assert.deepEqual(currentAge(s),{years:19,months:2});assert.equal(ageLabel(s),'19 岁 2 个月');
  s.profile.birthDate='1955-07-03';s.profile.age=18;s.month=6;assert.deepEqual(currentAge(s),{years:64,months:11});s.month=7;assert.deepEqual(currentAge(s),{years:65,months:0});
});

test('adult opening occupations do not mistake family mentions of study for the persons own student identity',()=>{
  for(const place of ['福建','中国台湾','日本']){const s=game({age:30,place,background:'ordinary',backgroundText:''});assert.notEqual(s.person.occupation,'学生',place);}
  for(const [description,occupation]of [['我是一名教师，平时喜欢读书。','教师'],['我已经是工程师，晚上继续读书提升自己。','工程师']])assert.equal(game({age:30,backgroundText:description}).person.occupation,occupation);
  assert.equal(game({age:25,backgroundText:'我目前是研究生，正在大学读书。'}).person.occupation,'学生');
});

test('all eleven known identities lock opening facts, preserve specific starting locations and can round-trip saves',()=>{
  for(const name of ['蔡徐坤','孙笑川','李克强','李在明','习近平','薄熙来','安倍晋三','朴槿惠','蔡英文','赖清德','温家宝']){
    const p=findPersona(name),s=game({name,age:8,place:'福建',background:'custom',backgroundText:'我是一名学生',points:{intelligence:0,family:0,fitness:0,appearance:0}});
    assert.equal(s.profile.lockedPersonaId,p.id);assert.equal(s.location,p.startLocation);assert.equal(s.profile.place,p.place);assert.equal(s.profile.backgroundText,p.backgroundText);assert.equal(s.person.occupation,p.occupation);assert.equal(s.person.custody,!!p.custody);assert.deepEqual(currentAge(s),personaAge(p,0));assert.equal(s.stats.influence,p.stats.influence);assert.deepEqual(importSave(exportSave(s),lore),s);
  }
});

test('a public figure loses a superseded office after the coup instead of resuming old duties',()=>{
  let s=game({name:'习近平',routes:{...routes,china:'cn_chen_security'}});assert.match(s.person.occupation,/国家主席/);
  const coup=timelineEvents(s,lore).find(e=>e.id==='cn_zhang_coup').resolvedMonth;s=until(s,coup);
  assert.ok(/原|前|卸任|失去|不再|解除|撤|过渡|问责/.test(`${s.person.occupation} ${s.person.status}`));assert.equal(s.current.dailyId.startsWith('personal_office'),false);
  const n=tick(s);assert.equal(n.current.dailyId.startsWith('personal_office'),false);
});

test('Bo taking office in published history releases custody and updates his current occupation',()=>{
  let s=game({name:'薄熙来',routes:{...routes,china:'cn_bo_deity'}});assert.equal(s.person.custody,true);
  const elected=timelineEvents(s,lore).find(e=>e.id==='cn_bo_elected').resolvedMonth;s=until(s,elected);
  assert.equal(s.person.custody,false);assert.match(`${s.person.occupation} ${s.person.status}`,/主席|领袖|领导|执政/);assert.equal(s.current.dailyId.startsWith('personal_custody'),false);
  const r=importSave(exportSave(s),lore);assert.deepEqual(r.person,s.person);
});

test('occupation, skills, projects and relationships survive later months and save reloads',()=>{
  let s=game({narrative:'player'});s=until(s,18);
  s=tick(s,{label:'参军并学习军事训练',custom:true});assert.match(s.person.occupation,/入伍|军|自卫队/);assert.match(s.person.status,/训练/);assert.ok(s.person.skills.length);assert.ok(s.person.facts.length);
  const occupation=s.person.occupation;s=tick(s);assert.equal(s.person.occupation,occupation);assert.match(s.current.dailyId,/personal_service/);
  const a={label:'研发新的通信设备',custom:true},c=nextContext(s,lore,a),r={...localEvent(c.state,lore,a),personUpdate:{skills:['通信设计'],projects:['通信原型已完成测试'],relationships:['陈老师提供工程指导'],facts:['本月与陈老师建立联系']}};
  s=advance(s,a,r,null,lore);assert.ok(s.person.projects.some(x=>/通信/.test(x)));assert.ok(s.person.relationships.includes('陈老师提供工程指导'));
  const restored=importSave(exportSave(s),lore);assert.deepEqual(restored.person,s.person);assert.deepEqual(tick(restored).person,s.person);
});

test('failed balanced actions cannot use model identity updates to grant the failed job or escape',()=>{
  let s=game({narrative:'balanced'}),action;
  for(let i=0;i<100;i++){const a={label:`应聘成为工程师${i}`,custom:true,check:{stat:'intelligence',difficulty:95}};if(!resolveAction(s,a).success){action=a;break;}}
  assert.ok(action);const c=nextContext(s,lore,action),n=advance(s,action,{...ai(c.decision),personUpdate:{occupation:'工程师',status:'已经入职工程师岗位'}},null,lore);assert.equal(n.person.occupation,s.person.occupation);
  s=game({name:'薄熙来',narrative:'balanced'});for(let i=0;i<100;i++){const a={label:`越狱离开监狱${i}`,custom:true,check:{stat:'fitness',difficulty:95}};if(!resolveAction(s,a).success){action=a;break;}}assert.equal(resolveAction(s,action).success,false);const x=nextContext(s,lore,action);assert.equal(advance(s,action,{...ai(x.decision),personUpdate:{}},null,lore).person.custody,true);
});

test('negated enlistment, job changes and escape keep the stated existing identity and custody',()=>{
  const teacher=game({narrative:'player',backgroundText:'我在学校担任教师'});
  for(const label of ['我不想参军，只想继续在学校教书','我拒绝成为工程师，继续做教师','我暂时不参加军队，继续工作']){
    const n=tick(teacher,{label,custom:true});assert.equal(n.person.occupation,'教师',label);
  }
  const detained=game({name:'薄熙来',narrative:'player'});assert.equal(detained.person.custody,true);
  for(const label of ['我决定不去越狱，继续等待司法程序','暂缓离开监狱，继续和律师联系'])assert.equal(tick(detained,{label,custom:true}).person.custody,true,label);
});

test('v3 upgrading preserves all already applied news impacts and accumulated identity-independent state',()=>{
  const s=until(game(),27),old=structuredClone(s);old.timelineVersion=3;delete old.person;delete old.profile.startAgeMonths;
  const restored=importSave(exportSave(old),lore);assert.equal(restored.timelineVersion,5);assert.deepEqual(restored.stats,s.stats);assert.deepEqual(restored.newsHistory,s.newsHistory);assert.deepEqual(restored.seenEvents,s.seenEvents);assert.deepEqual(restored.seenNews,s.seenNews);assert.deepEqual(restored.history,s.history);assert.equal(restored.profile.startAgeMonths,18*12);assert.ok(restored.person);
  const n=tick(restored);assert.equal(n.month,28);assert.equal(n.current.news.some(e=>e.id==='news_dong'),false);
});

test('AI prompt uses action-date and current birthdays plus current identity, excluding the original profile age',()=>{
  let s=game({name:'李克强'});s=until(s,6);const d=JSON.parse(buildPrompt(s,passive,lore).user);
  assert.equal(d.actionAgeYears,64);assert.equal(d.currentAgeYears,65);assert.equal(d.currentAgeMonths,0);assert.equal(Object.hasOwn(d.profile,'age'),false);assert.equal(Object.hasOwn(d.profile,'startAgeMonths'),false);assert.match(d.currentIdentity.occupation,/国务院总理/);assert.equal(d.location,'北京');assert.ok(d.localSituation.institutions.length);
});

test('all 35 birthplaces start in January 2020 with personal life and separate opening news',()=>{
  assert.equal(PLACES.length,35);
  for(const place of PLACES){const s=game({place});assert.equal(s.timelineVersion,5);assert.equal(s.month,0);assert.equal(s.location,place);assert.equal(s.profile.backgroundText,profile.backgroundText);assert.ok(!s.current.majorId);assert.ok(s.current.dailyId);validChoices(s);const e=s.current.news.find(e=>e.id==='world_opening');assert.match(e.description,/疫情|新冠/);assert.match(e.description,/民进党/);assert.equal(s.eventMonths.world_opening,0);assert.ok([31,32,33].includes(s.calendar.straitEnd));}
  assert.equal(dateLabel(0),'2020 年 01 月');for(const age of [-1,91,1.5,'invalid'])assert.throws(()=>game({age}));assert.throws(()=>game({place:'invalid'}));
});

test('ordinary life avoids repeating the current event or the recent eight archived months',()=>{
  let s=game();
  for(let i=0;i<24;i++){
    const prior=new Set([s.current.dailyId,...s.history.slice(-8).map(h=>h.event.dailyId)]);
    s=tick(s);assert.ok(!prior.has(s.current.dailyId),s.current.dailyId);
  }
});

test('creation requires exactly twenty integer points across four bounded attributes',()=>{
  assert.deepEqual(POINT_STATS,['intelligence','family','fitness','appearance']);
  for(const points of [{intelligence:6,family:5,fitness:5,appearance:5},{intelligence:4,family:5,fitness:5,appearance:5},{intelligence:11,family:4,fitness:3,appearance:2},{intelligence:-1,family:7,fitness:7,appearance:7},{intelligence:5.5,family:4.5,fitness:5,appearance:5},{intelligence:5,family:5,fitness:5}])assert.throws(()=>game({points}),/20 点/);
  const points={intelligence:10,family:0,fitness:3,appearance:7},s=game({points});for(const k of POINT_STATS)assert.equal(s.stats[k],points[k]*10);assert.equal(game({points:{...points,influence:100}}).stats.influence,s.stats.influence);
});

test('influence derives from family resources, identity and age',()=>{
  const poor=game({points:{intelligence:5,family:0,fitness:5,appearance:10}}),rich=game({points:{intelligence:5,family:10,fitness:5,appearance:0}});assert.ok(rich.stats.influence>poor.stats.influence);assert.ok(rich.stats.funds>poor.stats.funds);
  const leader=game({background:'cadre',backgroundText:'现任省长，长期参与公共事务。'});assert.ok(leader.stats.influence>game().stats.influence);assert.ok(game({age:8,background:'cadre',backgroundText:'现任省长'}).stats.influence<leader.stats.influence);
});

test('every four-month block contains one or two choices and manual action works every month',()=>{
  let s=game(),choices=0,quiet=0;for(let i=0;i<12;i++){validChoices(s);if(s.current.options.length)choices++;else quiet++;const a={label:'每天早晨阅读并记录所见',custom:true};s=tick(s,a);assert.equal(s.history.at(-1).action.label,a.label);}
  assert.ok(choices>=3&&choices<=6);assert.equal(choices+quiet,12);assert.ok(quiet>=choices);assert.equal(s.month,12);assert.equal(dateLabel(s.month),'2021 年 01 月');assert.equal(ageLabel(s),'19 岁 0 个月');assert.equal(ageLabel(until(game({age:0}),12)),'1 岁 0 个月');
});

test('preview and commit resolve one identical action without mutating previous state',()=>{
  const s=game(),before=structuredClone(s),a=success(s,'练习阅读'),c=nextContext(s,lore,a);assert.deepEqual(s,before);assert.equal(c.major,null);assert.equal(c.state.month,1);
  const n=advance(s,a,localEvent(c.state,lore,a),null,lore);assert.deepEqual(s,before);assert.equal(n.month,1);assert.equal(n.history.length,1);assert.deepEqual(n.stats,c.state.stats);assert.deepEqual(n.current.news,c.news);assert.deepEqual(n.history[0].actionResult,c.actionResult);assert.equal(n.history[0].action.label,a.label);assert.ok(n.current.consequence.includes(a.label));
});

test('passive life and custom intent both receive resolved consequences',()=>{
  const s=game(),p=tick(s),a={label:'申请继续读书并联系家人',custom:true},n=tick(s,a);assert.equal(p.history[0].action.passive,true);assert.match(p.current.consequence,/生活节奏/);assert.equal(n.history[0].action.custom,true);assert.match(n.current.consequence,/申请继续读书/);assert.ok(n.memories.at(-1).text.includes(a.label));assert.deepEqual(n.history[0].actionResult,nextContext(s,lore,a).actionResult);
});

test('attributes affect success chances; saving and retrying cannot reroll the same action',()=>{
  const low=game(),high=structuredClone(low),a={label:'练习体能',custom:true,check:{stat:'fitness',difficulty:55}};low.stats.fitness=5;high.stats.fitness=95;assert.ok(resolveAction(high,a).chance>resolveAction(low,a).chance);
  const before=structuredClone(low),first=resolveAction(low,a),restored=importSave(exportSave(low),lore);for(let i=0;i<4;i++)assert.deepEqual(resolveAction(restored,a),first);assert.deepEqual(low,before);assert.deepEqual(tick(low,a).history[0].actionResult,tick(restored,a).history[0].actionResult);
});

test('AI cannot award statistics twice or override custom action mechanics',()=>{
  const s=game(),a=success(s,'申请继续学习'),c=nextContext(s,lore,a),r=ai(c.decision);r.actionDelta={funds:999999,influence:100,intelligence:100};const n=advance(s,{...a,delta:{funds:999999}},r,null,lore);assert.deepEqual(n.stats,c.state.stats);assert.deepEqual(validateResponse(r,{decision:c.decision}).actionDelta,{});
});

test('statistics stay bounded and exhausted health ends the life',()=>{
  assert.deepEqual(cleanDelta({funds:1e9,health:-1e9,knowledge:Infinity,stress:'2'}),{health:-10,funds:100000});const s=game();s.stats.health=3;s.stats.intelligence=99;const n=tick(s,{label:'处理难题',delta:{health:-10,intelligence:10}});assert.equal(n.stats.health,0);assert.ok(n.stats.intelligence<=100);assert.equal(n.ended,true);assert.throws(()=>tick(n));assert.throws(()=>tick(game(),{label:' '}));
});

test('a model cannot relocate a person without a successful explicit migration intent',()=>{
  const s=game(),ordinary=success(s,'继续阅读'),move=success(s,'搬到上海继续生活');
  for(const a of [passive,ordinary]){const r=ai(nextContext(s,lore,a).decision);r.location='上海';assert.equal(advance(s,a,r,null,lore).location,'福建');}
  const r=ai(nextContext(s,lore,move).decision);r.location='上海';assert.equal(advance(s,move,r,null,lore).location,'上海');
  let failed;for(let i=0;i<100;i++){const a={label:`搬到上海并安排住处${i}`,custom:true,check:{stat:'influence',difficulty:95}};if(!resolveAction(s,a).success){failed=a;break;}}assert.ok(failed);assert.equal(advance(s,failed,{...ai(nextContext(s,lore,failed).decision),location:'上海'},null,lore).location,'福建');
});

test('successful explicit migration precedes next-month local news and also works without an API',()=>{
  for(const [origin,destination,exposed]of [['福建','河南',true],['河南','福建',false]]){
    const s=until(game({place:origin}),17),a=success(s,`搬到${destination}定居`),c=nextContext(s,lore,a),r=localEvent(c.state,lore,a),n=advance(s,a,r,null,lore);
    assert.equal(c.state.location,destination);assert.equal(n.location,destination);assert.equal(n.month,18);
    const flood=n.current.news.find(e=>e.id==='news_zhengzhou_flood');assert.ok(flood);
    if(exposed)assert.equal(flood.impact.stress,6);else assert.ok((flood.impact.stress||0)<=1);
    assert.equal(r.location,destination);assert.equal(n.history.at(-1).actionResult.success,true);
  }
});

test('errands, negated moves and arbitrary AI destinations do not move a person; city aliases resolve consistently',()=>{
  const s=game();
  for(const text of ['我今天去菜市场买菜','想去上海定居，但我暂时不去，留在福建看书','我本来打算搬到上海，但是暂缓搬家，继续住在福建']){
    const a=success(s,text),c=nextContext(s,lore,a),n=advance(s,a,{...ai(c.decision),location:'上海'},null,lore);assert.equal(c.state.location,'福建',text);assert.equal(n.location,'福建',text);
  }
  for(const [city,province]of [['杭州','浙江'],['东京','日本'],['台北','中国台湾']]){
    const a=success(s,`搬到${city}定居`),c=nextContext(s,lore,a),n=advance(s,a,{...ai(c.decision),location:'其他地方'},null,lore);assert.equal(c.state.location,province,city);assert.equal(n.location,province,city);
  }
});

test('archived actions retain their own consequences, including prompt history and older-save migration',()=>{
  const original=game(),a=success(original,'申请参加识字课堂'),ca=nextContext(original,lore,a),resultA='你参加了社区的识字课堂并认识了两位新同学。';
  const first=advance(original,a,{...ai(ca.decision),consequence:resultA},null,lore),b=success(first,'联系亲友讨论近况'),cb=nextContext(first,lore,b),resultB='你联系了远方的亲友，并约好年末回家探望。';
  const second=advance(first,b,{...ai(cb.decision),consequence:resultB},null,lore);
  assert.equal(second.history[0].consequence,resultA);assert.equal(second.history[1].consequence,resultB);
  const context=JSON.parse(buildPrompt(second,passive,lore).user);assert.ok(JSON.stringify(context.recentHistory[0]).includes(resultA));assert.ok(JSON.stringify(context.recentHistory[1]).includes(resultB));
  for(const version of [2,3]){const old=structuredClone(second);old.timelineVersion=version;for(const h of old.history)delete h.consequence;const restored=importSave(exportSave(old),lore);assert.equal(restored.history[0].consequence,resultA);assert.equal(restored.history[1].consequence,resultB);}
});

test('several world events coexist in one personal month without postponing later events',()=>{
  const d=fixture([event('opening',0),event('fixed',1,{fixedMonth:true}),event('parent',1),event('sibling',1),event('child',1,{after:'parent',delayMonths:3}),event('joined',0,{requires:['parent','child']})]);
  let s=tick(createGame({...profile,routes:{china:'fixture'}},d),passive,d);assert.equal(s.month,1);assert.deepEqual(new Set(s.current.news.filter(e=>e.kind==='world').map(e=>e.id)),new Set(['fixed','parent','sibling']));assert.ok(s.current.dailyId);assert.equal(s.history.length,1);assert.equal(s.eventMonths.parent,1);assert.equal(timelineEvents(s,d).find(e=>e.id==='child').resolvedMonth,4);s=until(s,4,d);assert.equal(s.eventMonths.child,4);s=tick(s,passive,d);assert.equal(s.eventMonths.joined,5);
});

test('relative random delays vary across seeds after resolving all anchors without reversing prerequisite intervals',()=>{
  const d=fixture([event('anchor',10),event('requirement',14),event('relative',0,{after:'anchor',delayMonths:3,requires:['requirement'],randomDelayMonths:[0,3]}),event('followup',0,{after:'relative',delayMonths:2,requires:['relative'],randomDelayMonths:[0,1]}),event('fixed',9,{fixedMonth:true,randomDelayMonths:[5,8]})]);
  const months=new Set();
  for(let i=0;i<32;i++){
    let s=createGame({...profile,seed:`relative-jitter-${i}`,routes:{china:'fixture'}},d),planned=timelineEvents(s,d),byId=new Map(planned.map(e=>[e.id,e.resolvedMonth]));
    months.add(byId.get('relative'));assert.ok(byId.get('relative')>=15&&byId.get('relative')<=18);assert.ok(byId.get('followup')>=byId.get('relative')+2);assert.ok(byId.get('followup')<=byId.get('relative')+3);assert.equal(byId.get('fixed'),9);
    assert.deepEqual(timelineEvents(importSave(exportSave(s),d),d).map(e=>[e.id,e.resolvedMonth]),planned.map(e=>[e.id,e.resolvedMonth]));
    s=until(s,byId.get('followup'),d);assert.equal(s.eventMonths.relative,byId.get('relative'));assert.equal(s.eventMonths.followup,byId.get('followup'));assert.ok(s.eventMonths.relative>=s.eventMonths.anchor+3);assert.ok(s.eventMonths.relative>s.eventMonths.requirement);
  }
  assert.deepEqual([...months].sort((a,b)=>a-b),[15,16,17,18]);
});

test('news effects happen once; repeated world views and previews have no side effects',()=>{
  const d=fixture([event('local-shock',1,{category:'war',region:'china',impact:{funds:-400,stress:4}})]),s=createGame({...profile,routes:{china:'fixture'}},d),before=structuredClone(s),a={label:'处理手头小事',delta:{}};assert.deepEqual(nextContext(s,d,a),nextContext(s,d,a));assert.deepEqual(s,before);
  const n=tick(s,a,d),snapshot=structuredClone(n),card=n.current.news.find(e=>e.id==='local-shock');assert.equal(n.stats.funds,s.stats.funds+card.impact.funds);assert.equal(n.stats.stress,s.stats.stress+card.impact.stress);
  for(let i=0;i<10;i++){const rows=worldHistory(n,d);assert.ok(rows.some(e=>e.id==='local-shock'));rows[0].title='external edit';}assert.deepEqual(n,snapshot);const later=tick(n,a,d);assert.equal(later.current.news.some(e=>e.id==='local-shock'),false);assert.equal(later.newsHistory.filter(e=>e.id==='local-shock').length,1);
});

test('family resources and location modify the same news impact',()=>{
  const d=fixture([event('regional-shock',1,{category:'war',region:'china',impact:{funds:-400,stress:4}})]),base=createGame({...profile,routes:{china:'fixture'}},d),poor=structuredClone(base),rich=structuredClone(base),distant=structuredClone(base);poor.stats.family=0;rich.stats.family=100;distant.location='日本';
  const shock=s=>nextContext(s,d,{label:'照顾家人',delta:{}}).news.find(e=>e.id==='regional-shock').impact;assert.ok(Math.abs(shock(rich).funds)<Math.abs(shock(poor).funds));assert.ok((shock(distant).stress||0)<(shock(base).stress||0));
});

test('attribute gates exclude unavailable opportunities and permit qualified people to encounter them',()=>{
  const gates=life.events.filter(e=>Object.keys(e.minStats||{}).length||Object.keys(e.maxStats||{}).length);assert.ok(gates.length>=4,'attribute-gated opportunities must exist');
  for(const target of gates){const s=game({age:Math.max(18,target.minAge),place:target.places?.[0]||'福建'});s.month=0;s.history=[];for(const [k,v]of Object.entries(target.minStats||{}))s.stats[k]=v;for(const [k,v]of Object.entries(target.maxStats||{}))s.stats[k]=v;let appeared=false;for(let i=0;i<300;i++){s.seed=`gate-${target.id}-${i}`;if(localEvent(s,lore).dailyId===target.id){appeared=true;break;}}assert.ok(appeared,`${target.id} unreachable when qualified`);const [key,bound]=Object.entries(target.minStats||{})[0]||Object.entries(target.maxStats||{})[0];s.stats[key]=Object.hasOwn(target.minStats||{},key)?bound-1:bound+1;for(let i=0;i<60;i++){s.seed=`excluded-${i}`;assert.notEqual(localEvent(s,lore).dailyId,target.id,`${target.id} ignores ${key}`);}}
});

test('greater influence gives successful public action a larger actual world effect',()=>{
  const low=game(),high=structuredClone(low);low.stats.influence=5;high.stats.influence=90;const a=success(low,'推动公共民主改革'),l=resolveAction(low,a),h=resolveAction(high,a);assert.equal(l.success,true);assert.equal(h.success,true);assert.ok(h.worldDelta.reform>l.worldDelta.reform);assert.equal(l.scope,'local');assert.equal(h.scope,'international');assert.equal(nextContext(high,lore,a).state.worldPressure.reform,h.worldDelta.reform);assert.ok(resolveAction(low,{label:'立即推翻全国政府并建立政权',custom:true}).chance<=0.16);
});

test('public influence changes a pending direction but cannot rewrite established political facts',()=>{
  let s=game({routes:{...routes,china:'cn_han_cyber'}});s=until(s,timelineEvents(s,lore).find(e=>e.id==='cn_hu_inauguration').resolvedMonth);assert.ok(s.seenEvents.includes('cn_hu_inauguration'));assert.equal(s.seenEvents.includes('cn_hu_stability'),false);s.worldPressure.reform=11;s.stats.influence=95;s.stats.intelligence=90;s.stats.stress=0;
  const past=worldHistory(s,lore),n=tick(s,success(s,'推动公共民主改革'));assert.ok(n.worldPressure.reform>=12);assert.notEqual(n.routes.china,s.routes.china);assert.ok(timelineEvents(n,lore).some(e=>e.id==='cn_hu_reform'));assert.equal(timelineEvents(n,lore).some(e=>e.id==='cn_hu_stability'),false);assert.deepEqual(worldHistory(n,lore).filter(e=>e.month<=s.month),past);
  const fixed=until(game({routes:{...routes,china:'cn_han_cyber'}}),43);assert.ok(fixed.seenEvents.includes('cn_hu_stability'));fixed.worldPressure.reform=100;assert.equal(tick(fixed).routes.china,fixed.routes.china);
});

test('route selection is deterministic, region-correct and covers all three war-ending months',()=>{
  assert.deepEqual(chooseRoutes(lore,{},'same seed'),chooseRoutes(lore,{},'same seed'));for(let i=0;i<100;i++)for(const [region,id]of Object.entries(chooseRoutes(lore,{},String(i))))assert.equal(lore.routes.find(r=>r.id===id)?.region,region);assert.deepEqual([...new Set(Array.from({length:100},(_,i)=>game({seed:`calendar-${i}`}).calendar.straitEnd))].sort(),[31,32,33]);
});

test('requested China endings remain present and mutually exclusive',()=>{
  const endings={cn_chen_security:'cn_chen_totalitarian',cn_han_cyber:'cn_cyber_order',cn_han_zombie:'cn_zombie_cooperation',cn_han_duel:'cn_duel_aftermath',cn_hu_socialdem:'cn_socialist_international',cn_zhang_mass:'cn_mass_world',cn_li_police:'cn_li_police',cn_wang_police:'cn_wang_police',cn_bo_deity:'cn_bo_deity',cn_whn_cyberchen:'cn_cyber_chen',cn_mao_mao_chair:'cn_front_mao_chair',cn_mao_yue_chair:'cn_front_yue_chair',cn_mao_han_chair:'cn_front_han_chair',cn_mao_ling_victory:'cn_ling_victory',cn_mao_bo_victory:'cn_bo_stolen_victory',cn_mao_li_junta:'cn_red_junta',cn_long_commune:'cn_peoples_commune',cn_long_qin_center:'cn_qin_center_reform',cn_long_qin_left:'cn_qin_ultraleft_order',cn_long_qin_traditional:'cn_longmarch_second_revolution',cn_collapse:'cn_collapse_relief'};
  const exclusive=[['cn_hu_stability','cn_hu_reform','cn_hu_economy'],['cn_economic_success','cn_economic_failure'],['cn_constituent_left','cn_constituent_right'],['cn_qin_center','cn_qin_ultraleft','cn_qin_traditional'],['cn_front_mao_chair','cn_front_yue_chair','cn_front_han_chair','cn_ling_victory','cn_bo_stolen_victory','cn_red_junta']];
  for(const [id,end]of Object.entries(endings)){assert.ok(lore.routes.some(r=>r.id===id),`missing ${id}`);const events=timelineEvents(game({routes:{...routes,china:id}}),lore),ids=new Set(events.map(e=>e.id));assert.ok(ids.has(end));for(const group of exclusive)assert.ok(group.filter(e=>ids.has(e)).length<=1,`${id} mixes ${group}`);if(id.startsWith('cn_mao_'))assert.ok(events.find(e=>e.id==='cn_second_cultural').resolvedMonth>events.find(e=>e.id==='world_asia_end').resolvedMonth);}
});

test('existing non-Chen Japanese and European alternatives all complete without importing their rivals',()=>{
  for(const route of lore.routes.filter(r=>['japan','europe'].includes(r.region)&&r.selectionOnly!=='chen')){
    let s=game({routes:{...routes,[route.region]:route.id}});assert.equal(s.routes[route.region],route.id);const planned=timelineEvents(s,lore);s=until(s,Math.max(...planned.map(e=>e.resolvedMonth))+1);const own=new Set(route.milestones.map(e=>e.id));
    for(const e of route.milestones)assert.ok(s.seenEvents.includes(e.id),`${route.id} missed ${e.id}`);for(const rival of lore.routes.filter(r=>r.region===route.region&&r.id!==route.id))for(const e of rival.milestones)if(!own.has(e.id))assert.equal(s.seenEvents.includes(e.id),false,`${route.id} imports ${e.id}`);
  }
});

test('every China leaf completes exactly once at causal dates alongside personal life without future leakage',()=>{
  for(const china of lore.routes.filter(r=>r.region==='china')){
    let s=game({routes:{...routes,china:china.id}});const seen=new Map(),last=Math.max(...timelineEvents(s,lore).map(e=>e.resolvedMonth))+3;
    for(let month=0;month<=last;month++){
      const events=timelineEvents(s,lore),byId=new Map(events.map(e=>[e.id,e]));assert.equal(byId.size,events.length);assert.ok(s.current.dailyId,`${china.id} loses personal month ${month}`);validChoices(s);
      for(const card of s.current.news.filter(e=>e.kind==='world')){const e=byId.get(card.id);assert.ok(e,`${china.id} unexpected ${card.id}`);assert.equal(seen.has(e.id),false,`${china.id} repeats ${e.id}`);assert.equal(month,e.resolvedMonth,`${china.id} delayed/early ${e.id}`);assert.equal(s.eventMonths[e.id],month);if(e.after){const anchor=e.after==='strait_end'?'world_strait_end':e.after;assert.ok(seen.has(anchor),`${e.id} missing ${anchor}`);assert.ok(month>=seen.get(anchor)+(e.delayMonths??1));}for(const id of e.requires||[])assert.ok(seen.has(id)&&seen.get(id)<month,`${e.id} missing prior ${id}`);seen.set(e.id,month);}
      assert.deepEqual(new Map(worldHistory(s,lore).filter(e=>e.kind==='world').map(e=>[e.id,e.month])),seen);assert.ok(worldHistory(s,lore).every(e=>e.month<=month));if(month<last)s=tick(s);
    }
    for(const e of timelineEvents(s,lore))assert.ok(seen.has(e.id),`${china.id} missed ${e.id}`);for(const [id,m]of Object.entries({world_opening:0,world_protests:18,world_usa_civil_war:19,world_strait_war:21,world_europe_war:29}))assert.equal(seen.get(id),m,china.id);assert.equal(seen.get('world_strait_end'),s.calendar.straitEnd);if(seen.has('cn_longmarch_birth'))assert.ok(seen.get('cn_longmarch_birth')>=48);if(seen.has('world_asia_war'))assert.ok(seen.get('world_asia_war')>=72);if(seen.has('cn_qin_elected'))assert.ok(seen.get('cn_qin_elected')>=96&&seen.get('cn_qin_elected')<108);
  }
});

test('three war-end months retain distinct outcomes and defer the coup',()=>{
  const seeds=new Map();for(let i=0;seeds.size<3&&i<100;i++){const seed=`calendar-${i}`;seeds.set(game({seed}).calendar.straitEnd,seed);}for(const [m,seed]of seeds)for(const [china,description]of [['cn_victory_chen',/巨大代价.*胜利/],['cn_chen_security',/失败/],['cn_collapse',/经济全面崩溃/]]){const s=until(game({seed,routes:{...routes,china}}),m),card=s.current.news.find(e=>e.id==='world_strait_end');assert.ok(card);assert.match(card.description,description);assert.ok(s.current.dailyId);assert.equal(s.eventMonths.cn_zhang_coup,undefined);const later=until(s,38);if(china!=='cn_collapse')assert.ok(later.eventMonths.cn_zhang_coup>=m+2);}
});

test('Chen paths force both civil wars and bind every Taiwan outcome to its Japanese winner',()=>{
  const c=lore.couplings;assert.equal(c.taiwanRoutes.length,4);
  for(const china of c.chenChinaIds)for(const taiwan of c.taiwanRoutes){let s=game({routes:{...routes,china,taiwan,japan:'jp_ldp'}});const japan=taiwan===c.taiwanLeftId?c.japanLeftId:c.japanRightId;assert.equal(s.routes.taiwan,taiwan);assert.equal(s.routes.japan,japan);const selected=lore.routes.filter(r=>[taiwan,japan].includes(r.id)),planned=timelineEvents(s,lore);for(const id of ['tw_civil_war','jp_hazawa_toyokawa_war'])assert.ok(planned.find(e=>e.id===id).resolvedMonth>s.calendar.straitEnd);s=until(s,Math.max(...planned.map(e=>e.resolvedMonth))+1);for(const r of selected)for(const e of r.milestones)assert.ok(s.seenEvents.includes(e.id),`${taiwan} misses ${e.id}`);const allowed=new Set(selected.flatMap(r=>r.milestones.map(e=>e.id)));for(const other of lore.routes.filter(r=>['taiwan','japan'].includes(r.region)&&!selected.includes(r)))for(const e of other.milestones)if(!allowed.has(e.id))assert.equal(s.seenEvents.includes(e.id),false,`${taiwan} leaks ${e.id}`);assert.throws(()=>importSave(tamper(s,g=>g.routes.japan=japan===c.japanLeftId?c.japanRightId:c.japanLeftId),lore));}
  for(let i=0;i<80;i++){const s=game({seed:`non-chen-${i}`,routes:{...routes,china:'cn_han_cyber'}});assert.equal(c.taiwanRoutes.includes(s.routes.taiwan),false);assert.equal([c.japanLeftId,c.japanRightId].includes(s.routes.japan),false);}
});

test('regional influence can change a pending Taiwan outcome, retaining paired Japan and completed facts',()=>{
  const c=lore.couplings,s=game({place:'中国台湾',routes:{...routes,china:c.chenChinaIds[0],taiwan:c.taiwanRoutes.find(id=>id!==c.taiwanLeftId)}});s.worldPressure.left=17;s.stats.influence=95;s.stats.intelligence=90;s.stats.stress=0;const n=tick(s,success(s,'组织左翼公共互助'));assert.equal(n.routes.taiwan,c.taiwanLeftId);assert.equal(n.routes.japan,c.japanLeftId);assert.deepEqual(worldHistory(n,lore).filter(e=>e.month===0),worldHistory(s,lore));const finished=until(n,90),prior={...finished.routes};finished.worldPressure.left=-100;assert.deepEqual(tick(finished).routes,prior);
});

test('requested social news has sources and pictures, coexisting with world events and personal action',()=>{
  for(const title of [/故宫.*奔驰/,/董志民/]){const e=news.events.find(e=>title.test(e.title));assert.ok(e);assert.ok(e.sourceRefs.length);assert.ok(e.art);}const s=until(game(),25);assert.ok(s.newsHistory.some(e=>/董志民/.test(e.title)));assert.ok(s.newsHistory.some(e=>/故宫.*奔驰/.test(e.title)));assert.ok(s.newsHistory.every(e=>typeof e.art==='string'&&e.art));assert.equal(new Set(s.newsHistory.map(e=>e.id)).size,s.newsHistory.length);const july=until(game(),18);assert.ok(july.current.news.some(e=>e.id==='world_protests'));assert.ok(july.current.news.filter(e=>e.kind==='news').length>=2);assert.ok(july.current.dailyId);assert.equal(july.history.length,18);
});

test('save round-trip preserves personal and world history and deterministic future outcomes',()=>{
  const s=until(game(),27);s.pins=['家人仍住在福建'];s.memories=[{month:2,text:'已经申请入学'}];const r=importSave(exportSave(s),lore);assert.deepEqual(r,s);r.pins.push('另一个事实');assert.equal(s.pins.length,1);assert.deepEqual(tick(r).stats,tick(s).stats);assert.equal(exportSave(s).includes(settings.apiKey),false);
});

test('v1 and v2 saves migrate attributes, news and coupling without replaying past impacts',()=>{
  for(const v of [undefined,2]){const old=until(game({routes:{...routes,china:'cn_chen_security'}}),40),history=structuredClone(old.history),funds=old.stats.funds;old.timelineVersion=v;old.stats.knowledge=old.stats.intelligence;for(const k of POINT_STATS)delete old.stats[k];delete old.profile.points;delete old.seenNews;delete old.newsHistory;delete old.worldState;delete old.worldPressure;old.routes.taiwan='tw_dpp';old.routes.japan='jp_ldp';old.current.options=ai(true).options;old.current.majorId='cn_chen_emergency';delete old.current.news;if(v===undefined){delete old.calendar;delete old.eventMonths;}
    const r=importSave(exportSave(old),lore);assert.equal(r.timelineVersion,5);assert.deepEqual(r.history,history);assert.equal(r.stats.funds,funds);for(const k of POINT_STATS)assert.ok(Number.isFinite(r.stats[k]));assert.equal(Object.hasOwn(r.stats,'knowledge'),false);assert.ok(lore.couplings.taiwanRoutes.includes(r.routes.taiwan));assert.equal(r.routes.japan,r.routes.taiwan===lore.couplings.taiwanLeftId?lore.couplings.japanLeftId:lore.couplings.japanRightId);validChoices(r);assert.ok(r.current.dailyId);assert.ok(r.newsHistory.length);assert.equal(r.current.majorId,undefined);const n=tick(r);assert.equal(n.month,41);assert.ok(n.current.news.every(e=>!['world_opening','world_protests','world_strait_war','world_strait_end'].includes(e.id)));
  }
});

test('corrupt saves reject invalid dates, histories, routes and statistics',()=>{
  const s=tick(game());for(const f of [g=>g.month++,g=>g.month=-1,g=>g.profile.age=91,g=>g.profile.place='missing',g=>g.routes.china='missing',g=>delete g.routes.europe,g=>g.stats.health=101,g=>g.stats.intelligence=null,g=>g.history[0].month=8,g=>g.history[0].action.label=null,g=>g.pins=[{}],g=>g.calendar.straitEnd=30,g=>g.eventMonths.fake=2,g=>g.eventMonths.fake=-1,g=>g.worldPressure.left=101,g=>g.newsHistory[0].month=2,g=>g.ended='false',g=>{g.stats.health=0;g.ended=false;}])assert.throws(()=>importSave(tamper(s,f),lore));assert.throws(()=>importSave('{',lore));assert.throws(()=>importSave('x'.repeat(15000001),lore));
});

test('new saves reject missing world-pressure fields and unsupported timeline versions',()=>{
  const s=game();for(const key of ['reform','stability','economy','left','cooperation','tension'])assert.throws(()=>importSave(tamper(s,g=>delete g.worldPressure[key]),lore));assert.throws(()=>importSave(tamper(s,g=>g.timelineVersion=99),lore));
});

test('AI receives only observed history and next month, never hidden future route summaries',()=>{
  for(const china of lore.routes.filter(r=>r.region==='china')){const s=game({routes:{...routes,china:china.id}});s.pins=['我是一名普通学生'];const a={label:'申请继续读书',custom:true},prompt=buildPrompt(s,a,lore),d=JSON.parse(prompt.user);assert.equal(d.targetDate,'2020 年 02 月');assert.equal(d.action.label,a.label);assert.deepEqual(d.pinnedFacts,s.pins);assert.equal(Object.hasOwn(d,'routes'),false);assert.equal(d.worldHistory.length,worldHistory(s,lore).length);assert.deepEqual(d.stats,nextContext(s,lore,a).state.stats);assert.deepEqual(d.actionOutcome,nextContext(s,lore,a).actionResult);for(const word of ['第二次文革','2021年7月','2021年8月','2021年10月'])assert.equal(prompt.user.includes(word),false,`opening reveals ${word}`);for(const r of lore.routes)if(r.summary)assert.equal(prompt.user.includes(r.summary),false,`leaks ${r.id}`);for(const e of timelineEvents(s,lore).filter(e=>e.resolvedMonth>1))assert.equal(prompt.user.includes(e.description),false,`leaks ${e.id}`);assert.match(prompt.system,/不另行改变已经落实的时间旅行或再跨月份/);assert.match(prompt.system,/修仙/);assert.match(prompt.system,/不占用个人行动/);assert.match(prompt.system,/options必须是空数组/);}
});

test('due news and personal action reach AI together without overwriting one another',()=>{
  const s=until(game(),17),a={label:'和家人一起整理账目',custom:true},before=structuredClone(s),d=JSON.parse(buildPrompt(s,a,lore).user);assert.equal(d.targetDate,'2021 年 07 月');assert.ok(d.news.length>=3);assert.ok(d.news.some(e=>e.title===lore.worldEvents.find(e=>e.id==='world_protests').title));assert.equal(d.currentPersonalEvent.title,s.current.title);assert.equal(d.action.label,a.label);assert.deepEqual(s,before);
});

test('AI validation enforces quiet versus decision months and rejects repeated choices',()=>{
  assert.equal(responseSchema.properties.options.maxItems,5);assert.equal(validateResponse(ai(false),{decision:false}).options.length,0);assert.equal(validateResponse(ai(true),{decision:true}).options.length,3);assert.throws(()=>validateResponse(ai(true),{decision:false}));assert.throws(()=>validateResponse(ai(false),{decision:true}));const short=ai(true);short.options.pop();assert.throws(()=>validateResponse(short,{decision:true}));const repeat=ai(true);repeat.options[1]=repeat.options[0];assert.throws(()=>validateResponse(repeat,{decision:true}));const huge=ai(true);huge.options.push(...huge.options);assert.throws(()=>validateResponse(huge,{decision:true}));const legacy=ai(true);legacy.narrative+=' 玩家路线';assert.doesNotThrow(()=>validateResponse(legacy,{legacy:true}));
});

test('AI rejects game and developer language in prose, options and retained memory',()=>{
  for(const field of ['title','narrative','consequence','memory']){const r=ai(true);r[field]+=' 本局玩家触发事件，成功率得到属性加成。';assert.throws(()=>validateResponse(r,{decision:true}),undefined,field);}for(const field of ['label','description']){const r=ai(true);r.options[0][field]+=' 开发者视角解释游戏机制。';assert.throws(()=>validateResponse(r,{decision:true}));}
});

test('current identity updates cannot persist meta narration or an obsolete current age',()=>{
  const bad={...ai(false),personUpdate:{status:'本回合玩家已触发事件并解锁剧情。'}};assert.throws(()=>validateResponse(bad,{decision:false,context:{ageYears:24,priorAgeYears:24,name:'林安',region:'china'}}));
  const stale={...ai(false),personUpdate:{status:'你今年18岁，正在申请第一份工作。'}};assert.throws(()=>validateResponse(stale,{decision:false,context:{ageYears:24,priorAgeYears:24,name:'林安',region:'china'}}));
});

test('explicit turn resolution and unlock wording cannot enter immersive prose',()=>{
  for(const text of ['本回合系统判定成功，你获得了三点智力，并解锁了新的剧情路线。','你忙碌了一整个月，现在可以解锁剧情，进入下一段生活。']){const r={...ai(false),narrative:text};assert.throws(()=>validateResponse(r,{decision:false}),undefined,text);}
});

test('DeepSeek uses authenticated JSON chat and respects quiet and choice months',async()=>{
  const original=globalThis.fetch;try{for(const decision of [false,true]){let s=game();while(nextContext(s,lore,passive).decision!==decision)s=tick(s);const before=structuredClone(s);let req;globalThis.fetch=async(url,init)=>{req={url,init,body:JSON.parse(init.body)};return response(envelope(ai(decision)));};const r=await generateMonth(s,passive,lore,null,settings);assert.equal(req.url,'https://api.deepseek.com/chat/completions');assert.equal(req.init.headers.Authorization,`Bearer ${settings.apiKey}`);assert.equal(req.body.model,DEFAULT_MODEL);assert.deepEqual(req.body.response_format,{type:'json_object'});assert.equal(req.body.stream,false);assert.equal(JSON.parse(req.body.messages[1].content).decision,decision);assert.equal(r.options.length,decision?3:0);assert.equal(r.source,'deepseek');assert.deepEqual(s,before);assert.equal(advance(s,passive,r,null,lore).month,s.month+1);}}finally{globalThis.fetch=original;}
});

test('DeepSeek repairs incorrect age once, then returns a valid month without committing either request',async()=>{
  const original=globalThis.fetch,s=until(game(),24),before=structuredClone(s),a={label:'继续学习工程设计',custom:true},decision=nextContext(s,lore,a).decision;let calls=0;const requests=[];
  try{
    globalThis.fetch=async(_url,init)=>{requests.push(JSON.parse(init.body));calls++;return response(envelope(calls===1?{...ai(decision),narrative:'你今年18岁，在工厂学习机械设计，认真核对师傅交给你的每一份图纸。'}:{...ai(decision),narrative:'你今年20岁，在工厂学习机械设计，认真核对师傅交给你的每一份图纸。'}));};
    const r=await generateMonth(s,a,lore,null,settings);assert.equal(calls,2);assert.match(r.narrative,/20岁/);assert.ok(requests[1].messages.length>requests[0].messages.length);assert.deepEqual(s,before);assert.equal(advance(s,a,r,null,lore).month,25);
  }finally{globalThis.fetch=original;}
});

test('DeepSeek repairs forbidden prose once and rejects a second invalid response without further calls',async()=>{
  const original=globalThis.fetch,s=game(),before=structuredClone(s),decision=nextContext(s,lore,passive).decision;
  try{
    for(const repaired of [true,false]){let calls=0;globalThis.fetch=async()=>{calls++;return response(envelope(calls===2&&repaired?ai(decision):{...ai(decision),narrative:'你完成了手头的工作，而且联系了住在远方的朋友，准备整理家里的物品。'}));};
      if(repaired){const r=await generateMonth(s,passive,lore,null,settings);assert.equal(r.narrative.includes('而且'),false);}else await assert.rejects(()=>generateMonth(s,passive,lore,null,settings));
      assert.equal(calls,2);assert.deepEqual(s,before);
    }
  }finally{globalThis.fetch=original;}
});

test('an age mismatch remaining after the one repair does not advance time or alter identity',async()=>{
  const original=globalThis.fetch,s=until(game(),24),before=structuredClone(s),decision=nextContext(s,lore,passive).decision;let calls=0;
  try{globalThis.fetch=async()=>{calls++;return response(envelope({...ai(decision),narrative:'你今年十八岁，在学校跟着老师学习新课程，晚上完成作业后给家人写信。'}));};await assert.rejects(()=>generateMonth(s,passive,lore,null,settings));assert.equal(calls,2);assert.deepEqual(s,before);}finally{globalThis.fetch=original;}
});

test('cancellation during a prose repair cancels the second request and leaves the original month intact',async()=>{
  const original=globalThis.fetch,s=game(),before=structuredClone(s),decision=nextContext(s,lore,passive).decision,controller=new AbortController();let calls=0,start;
  const ready=new Promise(resolve=>start=resolve);
  try{globalThis.fetch=async(_url,init)=>{calls++;if(calls===1)return response(envelope({...ai(decision),narrative:'你完成了手头的工作，而且联系了住在远方的朋友，准备整理家里的物品。'}));start();return new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));};
    const pending=generateMonth(s,passive,lore,null,settings,controller.signal);await ready;controller.abort();await assert.rejects(()=>pending,/取消/);assert.equal(calls,2);assert.deepEqual(s,before);
  }finally{globalThis.fetch=original;}
});

test('DeepSeek JSON, validation, network and service failures leave month and action roll intact',async()=>{
  const original=globalThis.fetch,s=game(),a={label:'继续阅读',custom:true},before=structuredClone(s),roll=resolveAction(s,a),bad=ai(nextContext(s,lore,a).decision);bad.narrative='玩家进入游戏，开始触发事件和查看成功率。';const stubs=[()=>response({choices:[{message:{content:'{not-json'},finish_reason:'stop'}]}),()=>response({choices:[{message:{content:'{}'},finish_reason:'length'}]}),()=>response({choices:[]}),()=>response(envelope(bad)),()=>({ok:false,status:402}),()=>({ok:false,status:429}),()=>{throw new TypeError('network failure');}];try{for(const f of stubs){globalThis.fetch=async()=>f();await assert.rejects(()=>generateMonth(s,a,lore,null,settings));assert.deepEqual(s,before);assert.deepEqual(resolveAction(s,a),roll);}}finally{globalThis.fetch=original;}
});

test('DeepSeek cancellation before and during requests cannot advance the month',async()=>{
  const original=globalThis.fetch,s=game(),before=structuredClone(s),stopped=new AbortController();stopped.abort();let calls=0;try{globalThis.fetch=async()=>{calls++;throw new Error('must not fetch');};await assert.rejects(()=>generateMonth(s,passive,lore,null,settings,stopped.signal),/取消/);assert.equal(calls,0);let start;const ready=new Promise(r=>start=r),controller=new AbortController();globalThis.fetch=async(_url,init)=>{start();return new Promise((_r,reject)=>init.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));};const pending=generateMonth(s,passive,lore,null,settings,controller.signal);await ready;controller.abort();await assert.rejects(()=>pending,/取消/);assert.deepEqual(s,before);}finally{globalThis.fetch=original;}
});

test('DeepSeek model discovery filters IDs and invalid settings fail before network access',async()=>{
  const original=globalThis.fetch;let calls=0;try{globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.deepseek.com/models');assert.equal(init.method,'GET');return response({data:[{id:'deepseek-flash'},{id:'deepseek-pro'},{id:'../bad'},{id:12}]});};assert.deepEqual(await listModels(settings),['deepseek-flash','deepseek-pro']);await assert.rejects(()=>generateMonth(game(),passive,lore,null,{...settings,model:'bad'}));await assert.rejects(()=>generateMonth(game(),passive,lore,null,{...settings,apiKey:''}));assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
