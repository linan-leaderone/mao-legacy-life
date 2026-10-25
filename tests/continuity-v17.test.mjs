import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,nextContext,localEvent,advance} from '../src/engine.js';
import {buildPrompt} from '../src/deepseek.js';
import {continuityNarrative,continuityIssues,buildContinuityContext} from '../src/continuity.js';
import {proseIssues} from '../src/narrative.js';
import {resolveSpecialAction} from '../src/special-lives.js';

const game=(overrides={})=>createGame({name:'林安',age:25,place:'日本',background:'ordinary',backgroundText:'在当地生活。',freedom:'unlimited',seed:'continuity-v17',...overrides},lore);
const base={title:'周末的散步',narrative:'你离开住处去公园散步，回来时买了些食物。',options:[],consequence:'',source:'local'};
const hunt=(eaten,growth)=>({custom:true,label:'继续吃小鱼',meta:{fishGame:{eaten,growth,elapsedMs:10000}}});

test('shared prompt carries exact current outcome, prior action and settled income without mutating source',()=>{
  const s=game(),before=structuredClone(s),action={custom:true,label:'我已经在餐厅打工，月薪6000'},prompt=buildPrompt(s,action,lore),p=JSON.parse(prompt.user);
  assert.equal(p.continuation.action,action.label);assert.equal(p.continuation.outcome,p.actionOutcome.summary);
  assert.equal(p.continuation.income,6000);assert.equal(p.continuation.employment.monthlyIncome,6000);
  assert.equal(p.continuation.previousNarrative,s.current.narrative.replace(/\s+/g,' ').trim());
  assert.deepEqual(prompt.validationContext.continuation,p.continuation);assert.deepEqual(s,before);
  assert.match(prompt.system,/第一句就交代/);assert.match(prompt.system,/不能另起无关生活|不另起无关生活|无关的散步/);
});

test('quiet work months follow the established job and report actual ledger amounts',()=>{
  const s=game(),action={custom:true,label:'我已经做外卖配送员，月薪6000'},context=nextContext(s,lore,action);
  const event=continuityNarrative(context.state,action,context.actionResult,base);
  assert.match(event.narrative,/配送|送货/);assert.match(event.narrative,/6000/);assert.match(event.narrative,/1800/);assert.doesNotMatch(event.narrative,/公园散步/);
  const after=advance(s,action,event,null,lore),passive={passive:true,label:'下个月'},next=nextContext(after,lore,passive);
  const ongoing=continuityNarrative(next.state,passive,next.actionResult,base);
  assert.match(ongoing.narrative,/地址|送货|配送/);assert.equal(buildContinuityContext(after,next.state,passive).thread,action.label);
});

test('a completed public action replaces a worker routine while retaining the actual new office',()=>{
  const s=game();s.employment={kind:'配送员',monthlyIncome:6000,monthlyExpenses:1800};
  const action={custom:true,label:'我已经成为日本首相，并结束日本内战'},context=nextContext(s,lore,action),event=continuityNarrative(context.state,action,context.actionResult,base);
  assert.match(event.narrative,/公共安排|执行|职责/);assert.doesNotMatch(event.narrative,/送货|地址|配送/);
});

test('a resurrected historical identity can move from care into an actual newly acquired office',()=>{
  const s=game({name:'毛泽东'}),revive={custom:true,label:'我已经复活'},first=nextContext(s,lore,revive),after=advance(s,revive,localEvent(first.state,lore,revive),null,lore);
  const action={custom:true,label:'我已经成为中国国家主席'},next=nextContext(after,lore,action),event=localEvent(next.state,lore,action);
  assert.match(event.narrative,/公共安排|执行|职责/);assert.doesNotMatch(event.narrative,/照护人员|确认你的回应/);
});

test('fish zero catch continues an unsuccessful hunt instead of restarting or inventing growth',()=>{
  const s=game({name:'邓小平'}),action=hunt(0,0),context=nextContext(s,lore,action),event=localEvent(context.state,lore,action);
  assert.match(event.narrative,/原先|追逐|经过/);assert.match(event.narrative,/水流|食物|追逐/);
  assert.doesNotMatch(event.narrative,/醒来|第一次|大了一圈|鳞片/);assert.equal(context.state.specialLife.growth,0);
  assert.equal(proseIssues(event,buildPrompt(s,action,lore).validationContext).length,0);
});

test('fish capture changes the next concrete task while preserving fish game choices',()=>{
  const s=game({name:'邓小平'}),action=hunt(1,1),context=nextContext(s,lore,action),event=localEvent(context.state,lore,action);
  assert.match(event.narrative,/已有的体型|躲藏处/);assert.doesNotMatch(event.narrative,/吃下了1条|醒来|鳞片/);
  if(event.options.length)assert.match(event.options[0].label,/吞噬|猎物/);
  const rest=resolveSpecialAction(s,{custom:true,label:'我留在岩石后面休息，不吃小鱼'});
  assert.equal(rest.specialTransition.experience,0);assert.equal(rest.specialTransition.stage,0);
  assert.doesNotMatch(rest.summary,/吞食得到|新的身体变化/);
});

test('consecutive working months have different follow-up tasks and do not repeat settled amounts',()=>{
  let s=game();const narratives=[];
  for(const action of [{custom:true,label:'我已经成为餐厅服务员，月薪6000'},{passive:true,label:'下个月'},{passive:true,label:'下个月'}]){
    const context=nextContext(s,lore,action),event=localEvent(context.state,lore,action);
    assert.match(event.consequence,/6000/);assert.doesNotMatch(event.narrative,/6000|1800/);assert.match(event.narrative,/订单|备餐|物料/);
    assert.equal((event.consequence+event.narrative).match(/6000/g)?.length,action.custom?2:1);
    narratives.push(event.narrative);s=advance(s,action,event,null,lore);
  }
  assert.equal(new Set(narratives).size,3);
});

test('a perfect delivery never invents an earlier wrong turn or a task mistake',()=>{
  const s=game();s.employment={kind:'配送员',monthlyIncome:6000,monthlyExpenses:1800};s.monthlyLedger=[{label:'工资收入',amount:6025},{label:'日常开支',amount:-1800}];
  const action={custom:true,label:'继续送外卖'},resolution={success:true,summary:'完成1单，未出现差错。',encounterGame:{kind:'delivery',score:1,mistakes:0}};s.actionResult=resolution;
  const event=continuityNarrative(s,action,resolution,{...base,consequence:'本月收入6025，日常开支1800。'});
  assert.doesNotMatch(event.narrative,/走错|出现差错|出错的部分|6025|1800/);
  resolution.encounterGame.mistakes=2;
  assert.match(continuityNarrative(s,action,resolution,base).narrative,/出错的部分/);
});

test('a completed personal construction moves to maintenance without quoting the whole action twice',()=>{
  const s=game(),action={custom:true,label:'我已经造出了一艘宇宙飞船并成功登上火星'},context=nextContext(s,lore,action),event=localEvent(context.state,lore,action);
  assert.match(event.consequence,/宇宙飞船/);assert.doesNotMatch(event.narrative,/我已经造出/);assert.match(event.narrative,/设备|补给|联系/);
});

test('explicit time travel uses arrival conditions as the next task',()=>{
  const s=game(),action={custom:true,label:'我已经穿越到1976年1月'},context=nextContext(s,lore,action),event=continuityNarrative(context.state,action,context.actionResult,base);
  assert.match(event.narrative,/1976年1月/);assert.match(event.narrative,/安顿|联系/);assert.doesNotMatch(event.narrative,/疫情|智能手机/);
});

test('encounter injuries and already settled facts reach continuation without invented healing',()=>{
  const s=game(),target=structuredClone(s);target.encounterState={infected:true,health:50};
  target.actionResult={success:true,summary:'你离开遭遇地点。',encounterGame:{kind:'zombie',hits:1},encounterSummary:'被丧尸击中，出现感染。'};
  const action={custom:true,label:'沿街道撤离'},context=buildContinuityContext(s,target,action),event=continuityNarrative(target,action,target.actionResult,base);
  assert.equal(context.encounterState.infected,true);assert.equal(context.encounter.hits,1);
  assert.match(event.narrative,/感染|伤势/);assert.doesNotMatch(event.narrative,/痊愈|没有受伤/);
  assert.ok(continuityIssues({narrative:'你已经痊愈，伤口完全恢复正常。'},context).some(e=>/感染/));
  assert.deepEqual(continuityIssues({narrative:'你把检查伤口和寻找照护排进原有的工作里，感染仍未解除。'},context),[]);
});

test('uninfected encounters and work do not become infection through prose keyword matching',()=>{
  const s=game();s.encounterState={infected:false,immune:false};
  const action={custom:true,label:'我撤离街口'},resolution={success:true,encounterGame:{kind:'zombie',hits:0,damageTaken:0},encounterSummary:'暂时没有受到感染。'};
  const event=continuityNarrative(s,action,resolution,{...base,consequence:resolution.encounterSummary});assert.equal((event.consequence+event.narrative).match(/没有受到感染/g)?.length,1);assert.doesNotMatch(event.narrative,/感染迹象|原有伤势/);
  const work=continuityNarrative(s,{custom:true,label:'打工'}, {...resolution,encounterGame:{kind:'office'}},base);
  assert.match(work.narrative,/工作|交接/);assert.doesNotMatch(work.narrative,/交战|丧尸/);
  s.encounterState.infected=true;
  const quiet=continuityNarrative(s,{passive:true,label:'下个月'},{success:true},base);
  assert.match(quiet.narrative,/感染仍未解除/);
});

test('continuity validation catches actual contradiction and copy rather than demanding exact keywords',()=>{
  const context={income:6000,outcome:'本次工作完成，工资到账。',previousNarrative:'你核对工作台上的材料，按照上次留下的记录处理交接。新的订单陆续到来，你把同事已经核实的要求写在旁边，先完成有明确期限的部分，再整理仍需补充的资料。下班前，你确认待办事项已交给接班的人，留出时间吃饭和休息。'};
  assert.ok(continuityIssues({narrative:'你仍然没有工作，每天到附近寻找招聘消息。'},context).some(e=>/工资/));
  assert.ok(continuityIssues({narrative:context.previousNarrative},context).some(e=>/重复/));
  assert.deepEqual(continuityIssues({narrative:'新来的同事带着旧单据找你核实，你把前一天已经确认的数量交给他，约定下午一起检查剩余的部分。'},context),[]);
  assert.deepEqual(continuityIssues({narrative:'你去照看刚住院的母亲，原先约定的交接改由同事接手。收到他的确认后，你留在医院等检查结果。'},context),[]);
});

test('zero-catch validation rejects invented fish growth but allows a truthful negative sentence',()=>{
  const context={fishHarvest:{eaten:0,growth:0}};
  assert.ok(continuityIssues({narrative:'你吃下了大量小鱼，身体比上次更大。'},context).length);
  assert.deepEqual(continuityIssues({narrative:'这次没有捕到小鱼，身体没有长大。你把体力留给返回藏身处的路。'},context),[]);
  assert.deepEqual(continuityIssues({narrative:'你在附近等待鱼群，不再长距离追逐。'},context),[]);
});
