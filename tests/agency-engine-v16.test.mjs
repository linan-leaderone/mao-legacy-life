import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,nextContext,localEvent,advance,currentAge,dateLabel,exportSave,importSave,timelineEvents} from '../src/engine.js';
import {regionContext} from '../src/regions.js';

const passive={label:'照常生活',passive:true};
const routes={china:'cn_han_cyber',taiwan:'tw_dpp',japan:'jp_ldp',europe:'eu_nato'};
const game=(extra={})=>createGame({name:'林安',age:25,place:'北京',background:'ordinary',backgroundText:'我在当地生活，与家人保持联系。',freedom:'unlimited',seed:'agency-engine-v16',routes,...extra},lore);
const custom=label=>({label,custom:true});
function checkNet(before,after){
  const actual=Object.fromEntries(Object.keys(after.stats).filter(k=>after.stats[k]!==before.stats[k]).map(k=>[k,after.stats[k]-before.stats[k]]));
  assert.deepEqual(Object.fromEntries(after.statChanges.map(c=>[c.key,c.delta])),actual);
  for(const c of after.statChanges){assert.equal(c.before,before.stats[c.key]);assert.equal(c.after,after.stats[c.key]);assert.ok(Array.isArray(c.reasons));}
  assert.deepEqual(after.history.at(-1).delta,actual);
}
function tick(s,action=passive){
  const before=structuredClone(s),context=nextContext(s,lore,action);
  assert.deepEqual(s,before,'preview must not commit a turn');
  const after=advance(s,action,localEvent(context.state,lore,action),null,lore);
  assert.deepEqual(s,before,'commit returns an independent save');
  assert.equal(after.turn,s.turn+1);assert.equal(after.history.length,after.turn);checkNet(s,after);
  return after;
}
const reload=s=>importSave(exportSave(s),lore);
function months(s,count){for(let i=0;i<count;i++)s=tick(s);return s;}

test('travel to 1976 changes calendar and institutions while age, turn and save continuity survive',()=>{
  const initial=game(),oldAge=currentAge(initial);
  let s=tick(initial,custom('我已经穿越时空到1976年1月'));
  assert.equal(s.month,-528);assert.equal(s.turn,1);assert.deepEqual(currentAge(s),oldAge);
  assert.match(dateLabel(s.month),/1976 年 01 月/);assert.match(regionContext(s,lore).government,/文化大革命/);
  assert.equal(s.newsHistory.some(e=>e.month>=0),false);assert.ok(s.timeJournals.length);
  s=reload(s);assert.equal(s.month,-528);assert.equal(s.history[0].targetMonth,-528);
  s=tick(s);assert.equal(s.month,-527);assert.deepEqual(currentAge(s),{years:25,months:1});
  s=reload(s);assert.equal(s.turn,2);assert.equal(s.history[1].month,-528);assert.equal(s.month,-527);
});

test('a declared fifteen-year-old body ages by experienced months through twelve months and reloads',()=>{
  let s=tick(game({age:60}),custom('我已经返老还童到15岁'));
  assert.deepEqual(currentAge(s),{years:15,months:0});assert.equal(s.stats.promiscuity,0);
  s=months(s,6);s=reload(s);assert.deepEqual(currentAge(s),{years:15,months:6});
  s=months(s,6);assert.deepEqual(currentAge(s),{years:16,months:0});
  assert.deepEqual(currentAge(reload(s)),{years:16,months:0});assert.equal(s.profile.age,60);
});

test('joining Afterglow and declaring Japanese civil war create persistent identity, relationships and public facts',()=>{
  let s=tick(game({place:'日本'}),custom('我已经加入Afterglow，我亲自发动日本内战'));
  assert.match(s.person.occupation,/Afterglow/);assert.equal(s.person.relationships.filter(r=>/美竹兰|羽泽鸫|青叶摩卡|上原绯玛丽|宇田川巴/.test(r)).length,5);
  assert.match(s.worldOverrides.japan.conflict,/日本内战/);assert.match(regionContext(s,lore).conflict,/日本内战/);
  assert.ok(s.current.news.some(n=>n.source==='personal_action'&&/日本内战/.test(n.title)));
  s=months(reload(s),3);assert.match(s.person.occupation,/Afterglow/);assert.match(regionContext(s,lore).conflict,/日本内战/);
  assert.match(reload(s).worldOverrides.japan.conflict,/日本内战/);
});

test('personal Chinese leadership and an ended civil war persist past the old preselected political takeover',()=>{
  let s=tick(game(),custom('我发动中国内战'));
  s=tick(s,custom('我成为中国国家主席，我已经结束中国内战'));
  assert.equal(s.worldOverrides.china.leader,'林安');assert.equal(regionContext(s,lore).conflict,null);
  assert.match(s.person.occupation,/国家主席/);assert.ok(s.stats.influence>=80);
  s=months(reload(s),58);
  assert.equal(regionContext(s,lore).leader,'林安');assert.equal(regionContext(s,lore).conflict,null);
  assert.match(s.person.occupation,/国家主席/);assert.equal(s.seenEvents.includes('cn_zhang_coup'),false);
  const loaded=reload(s);assert.equal(loaded.worldOverrides.china.leader,'林安');assert.equal(loaded.worldOverrides.china.conflict,null);
});

test('permanent world peace prevents new scheduled wars across one hundred months',()=>{
  let s=tick(game(),custom('我已经实现世界永久和平，所有战争都结束'));
  const declaredMonth=s.month;assert.equal(s.worldDynamics.lastingPeace,true);
  s=months(reload(s),100);assert.equal(s.worldDynamics.lastingPeace,true);
  const forbidden=['world_strait_war','world_usa_civil_war','world_europe_war','world_asia_war','world_japan_civil','jp_hazawa_toyokawa_war','tw_civil_war','cn_longmarch_civil','cn_total_civil_war'];
  assert.deepEqual(s.newsHistory.filter(e=>e.month>declaredMonth&&forbidden.includes(e.id)),[]);
  assert.equal(reload(s).worldDynamics.lastingPeace,true);
});

test('helping Toyokawa defeat Hazawa records the subject as winner and retains that result',()=>{
  let s=tick(game({place:'日本'}),custom('我发动日本内战'));
  s=tick(s,custom('我已经帮助丰川祥子击败羽泽鸫，丰川祥子获得日本内战胜利'));
  assert.equal(s.worldOverrides.japan.leader,'丰川祥子');assert.equal(s.worldOverrides.japan.conflict,null);
  assert.equal(s.routes.japan,'jp_toyokawa');assert.ok(s.seenEvents.includes('jp_toyokawa_end'));
  assert.equal(s.seenEvents.includes('jp_hazawa_end'),false);
  s=months(reload(s),3);assert.equal(regionContext(s,lore).leader,'丰川祥子');assert.equal(regionContext(s,lore).conflict,null);
});

test('employment pays the stated salary each month, resignation stops it, and statChanges equal actual balances',()=>{
  const initial=game();let s=tick(initial,custom('我已经开始打工，月薪6000元'));
  assert.equal(s.employment.monthlyIncome,6000);assert.ok(s.monthlyLedger.some(e=>e.amount===6000));
  assert.ok(s.stats.funds>initial.stats.funds);assert.ok(s.statChanges.find(c=>c.key==='funds').reasons.some(r=>/收入/.test(r)));
  s=reload(s);const previous=s.stats.funds;s=tick(s);
  assert.ok(s.monthlyLedger.some(e=>e.amount===6000));assert.ok(s.stats.funds>previous);
  s=tick(s,custom('我已经辞职，不再打工'));assert.equal(s.employment.monthlyIncome,0);
  assert.equal(s.monthlyLedger.some(e=>e.amount>0),false);
  s=tick(reload(s));assert.equal(s.monthlyLedger.some(e=>e.amount>0),false);
});

test('the Great Asian War leaves at least eighteen months after the actual constituent assembly',()=>{
  for(const route of ['cn_long_commune','cn_long_qin_center']){
    let s=game({seed:'constitution-interval:'+route,routes:{...routes,china:route}});
    const scheduled=timelineEvents(s,lore),constitution=scheduled.find(e=>e.id==='cn_constituent'),war=scheduled.find(e=>e.id==='world_asia_war');
    assert.ok(constitution&&war,route);assert.ok(war.resolvedMonth-constitution.resolvedMonth>=18,route);
    const limit=war.resolvedMonth+24;
    while(s.month<limit&&!s.seenEvents.includes('world_asia_war'))s=tick(s);
    assert.ok(Number.isInteger(s.eventMonths.cn_constituent),`${route}: constituent assembly did occur`);
    assert.ok(Number.isInteger(s.eventMonths.world_asia_war),`${route}: regional war eventually occurred`);
    assert.ok(s.eventMonths.world_asia_war-s.eventMonths.cn_constituent>=18,`${route}: actual chronological interval`);
    const restored=reload(s);assert.equal(restored.eventMonths.world_asia_war,s.eventMonths.world_asia_war);
  }
});

function tickWithWorldUpdates(s,action,worldUpdates){
  const before=structuredClone(s),context=nextContext(s,lore,action);
  const response={...localEvent(context.state,lore,action),worldUpdates};
  const after=advance(s,action,response,null,lore);
  assert.deepEqual(s,before);checkNet(s,after);
  return after;
}
const injectedWar={region:'japan',kind:'war',title:'不应发生的日本战争',description:'新的交战使交通中断。',conflict:'日本战争'};

test('passive narration cannot inject an unrequested war through worldUpdates',()=>{
  const s=tickWithWorldUpdates(game({place:'日本'}),passive,[injectedWar]);
  assert.equal(s.worldOverrides.japan,undefined);assert.equal(regionContext(s,lore).conflict,null);
  assert.equal(s.newsHistory.some(e=>e.title===injectedWar.title),false);
  assert.equal(reload(s).worldOverrides.japan,undefined);
});

test('ordinary employment cannot be upgraded to a war by an AI-supplied world update',()=>{
  const s=tickWithWorldUpdates(game({place:'日本'}),custom('我已经开始打工，月薪6000元'),[injectedWar]);
  assert.equal(s.employment.monthlyIncome,6000);assert.equal(s.worldOverrides.japan,undefined);
  assert.equal(regionContext(s,lore).conflict,null);assert.equal(s.newsHistory.some(e=>e.title===injectedWar.title),false);
});

test('helping another person take power does not grant the protagonist that office or its influence',()=>{
  const initial=game({place:'中国台湾'}),action=custom('我已经让陈信行掌握台湾政权');
  const expected=nextContext(initial,lore,action).state;
  const s=tickWithWorldUpdates(initial,action,[{region:'taiwan',kind:'leadership',title:'陈信行接掌台湾政府',description:'陈信行主持新的政府，各机关开始办理权力交接。',leader:'陈信行',government:'陈信行主持的台湾政府'}]);
  assert.equal(s.worldOverrides.taiwan.leader,'陈信行');assert.equal(regionContext(s,lore).leader,'陈信行');
  assert.equal(s.person.authorityOverride,undefined);assert.doesNotMatch(s.person.occupation,/国家主席|总统|首相/);
  assert.equal(s.stats.influence,expected.stats.influence);assert.ok(s.stats.influence<80);
  const restored=reload(s);assert.equal(restored.worldOverrides.taiwan.leader,'陈信行');assert.equal(restored.person.authorityOverride,undefined);
});

test('an AI world update cannot reverse the locally resolved winner in the same region',()=>{
  let s=tick(game({place:'日本'}),custom('我发动日本内战'));
  s=tickWithWorldUpdates(s,custom('我已经帮助丰川祥子击败羽泽鸫'),[{region:'japan',kind:'victory',title:'羽泽鸫反而取得胜利',description:'羽泽鸫取得胜利并接掌日本。',leader:'羽泽鸫',government:'羽泽鸫政府',conflict:null}]);
  assert.equal(s.worldOverrides.japan.leader,'丰川祥子');assert.equal(s.routes.japan,'jp_toyokawa');
  assert.ok(s.seenEvents.includes('jp_toyokawa_end'));assert.equal(s.seenEvents.includes('jp_hazawa_end'),false);
  assert.equal(s.newsHistory.some(e=>e.title==='羽泽鸫反而取得胜利'),false);
  assert.equal(regionContext(reload(s),lore).leader,'丰川祥子');
});

test('ending an already published Great Asian War clears its regional effect in China, Taiwan and Japan across saves',()=>{
  let s=game({seed:'asia-end-world-update'});
  while(s.month<120&&!s.seenEvents.includes('world_asia_war'))s=tick(s);
  assert.ok(s.seenEvents.includes('world_asia_war'),'the war must exist before the intervention');
  for(const location of ['北京','中国台湾','日本'])assert.equal(regionContext({...s,location},lore).regionalConflict,'大亚洲战争');
  s=tick(s,custom('我已经结束大亚洲战争，交战各方签署停火协议'));
  assert.ok(s.worldDynamics.terminatedConflicts.includes('asia'));
  for(const version of [s,reload(s),tick(reload(s))]){
    assert.ok(version.seenEvents.includes('world_asia_war'),'ending the war preserves its historical occurrence');
    for(const location of ['北京','中国台湾','日本'])assert.equal(regionContext({...version,location},lore).regionalConflict,null,location);
  }
});
