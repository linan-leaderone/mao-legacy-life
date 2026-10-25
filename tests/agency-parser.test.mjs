import test from 'node:test';
import assert from 'node:assert/strict';
import {affirmedClauses,declarationPlan,settlementPlan} from '../src/agency.js';

const state=(extra={})=>({profile:{name:'林安',freedom:'unlimited'},location:'日本',person:{occupation:'普通居民'},stats:{intelligence:50,fitness:50},...extra});
const plan=(label,s=state())=>declarationPlan(s,{label,custom:true},{region:'japan',ageMonths:300});

test('negative and hypothetical declarations cannot start wars, change jobs, age or travel',()=>{
  for(const label of ['我不发动日本内战','我并未发动日本内战','我没发动日本内战','我不同意发动日本内战','我无法发动日本内战','我反对发动日本内战','我不辞职','我不会辞职','我不返老还童到10岁','我不穿越到1976年','如果我加入afterglow，发动日本内战','我如果回到1976，我成为日本首相','我想象自己发动日本内战']){
    const p=plan(label);assert.deepEqual(p.worldChanges,[],label);assert.equal(p.employment,null,label);assert.equal(p.ageMonths,null,label);assert.equal(p.dateMonth,null,label);
  }
  assert.deepEqual(affirmedClauses('我加入afterglow，如果我有军队，我发动日本内战。现在我去打工。'),['我加入afterglow','现在我去打工']);
  assert.deepEqual(affirmedClauses('我没有辞职，我继续工作'),['我继续工作']);
  assert.deepEqual(affirmedClauses('我决定不去越狱，继续等待司法程序'),['继续等待司法程序']);
  assert.deepEqual(affirmedClauses('我不愿去越狱。家人没有参军。'),[]);
});

test('affirmed joining and civil-war declarations remain actionable',()=>{
  const p=plan('我已经加入afterglow并自己发动日本内战');
  assert.equal(p.occupation,'Afterglow成员');assert.equal(p.relationships.length,5);
  assert.equal(p.worldChanges.length,1);assert.equal(p.worldChanges[0].conflict,'日本内战');
  assert.equal(plan('我穿越时空到1976').dateMonth,-528);assert.equal(plan('我返老还童到10岁').ageMonths,120);
});

test('a supported faction wins against its named opponent irrespective of catalogue ordering',()=>{
  for(const [label,winner]of [
    ['我帮助丰川祥子击败羽泽鸫','丰川祥子'],['我帮助羽泽鸫击败丰川祥子','羽泽鸫'],
    ['我帮助国民党打败民进党','韩国瑜'],['我帮助民进党打败国民党','赖清德'],
    ['羽泽鸫被丰川祥子击败','丰川祥子'],['国民党输给民进党','赖清德'],
    ['我带领基进党取得胜利','陈奕齐']
  ]){const changes=plan(label).worldChanges;assert.equal(changes.length,1,label);assert.equal(changes[0].leader,winner,label);assert.equal(changes[0].kind,'victory');}
  assert.deepEqual(plan('我击败羽泽鸫').worldChanges,[],'An unrecognized victor must not award victory to the defeated person.');
  assert.deepEqual(plan('我帮助丰川祥子在下棋比赛中击败羽泽鸫').worldChanges,[]);
});

test('party, band and army leadership does not appoint the player head of state',()=>{
  for(const role of ['民进党领导人','国民党主席','日本民主联合军领导人','台湾左翼联盟负责人','Afterglow负责人','中国共产党领导人']){
    const p=plan('我已经成为'+role);assert.equal(p.occupation,role);assert.equal(p.worldChanges.length,0,role);
  }
  for(const role of ['日本首相','台湾总统','中国国家主席','中共中央总书记']){
    const p=plan('我已经成为'+role);assert.equal(p.worldChanges[0]?.kind,'leadership',role);assert.equal(p.worldChanges[0].leader,'林安');
  }
});

test('ending a specified conflict yields a persistent conflict identity without starting it',()=>{
  for(const [label,conflict,region]of [
    ['我结束台海战争','台海战争','taiwan'],['我结束日本内战','日本内战','japan'],
    ['我叫停大亚洲战争','大亚洲战争','global'],['我停止发动日本内战','日本内战','japan'],['我阻止日本内战爆发','日本内战','japan'],
    ['我实现世界永久和平','all','global']
  ]){const c=plan(label).worldChanges;assert.equal(c.length,1,label);assert.equal(c[0].kind,'peace');assert.equal(c[0].terminatedConflict,conflict);assert.equal(c[0].region,region);}
  assert.equal(plan('我帮助国民党打败民进党').worldChanges[0].terminatedConflict,'台湾内战');
});

test('explicit profession and salary establish persistent monthly income',()=>{
  const s=state(),a={custom:true,label:'我成为程序员，月薪10000元'},p=plan(a.label,s);
  assert.equal(p.occupation,'程序员');assert.deepEqual(p.employment,{kind:'程序员',monthlyIncome:10000,monthlyExpenses:1800});
  const first=settlementPlan(s,a,p,true);assert.equal(first.entries.reduce((n,e)=>n+e.amount,0),8200);
  const continued={...s,employment:first.job};const passive=settlementPlan(continued,{passive:true},plan('',continued),true);
  assert.deepEqual(passive.entries,first.entries);
  const keep=plan('我继续打工',continued);assert.deepEqual(keep.employment,p.employment);
  assert.equal(plan('我成为教师，每月工资2万元').employment.monthlyIncome,20000);
  assert.equal(plan('我加入Afterglow，我的月薪10000元').occupation,'Afterglow成员');
});

test('negated resignation preserves the job, actual resignation and rehire follow statement order',()=>{
  const s=state({employment:{kind:'程序员',monthlyIncome:10000,monthlyExpenses:1800}});
  for(const label of ['我不辞职','我没有辞职，我继续工作','我在家休息，没有辞职']){
    const p=plan(label,s),settled=settlementPlan(s,{custom:true,label},p,true);
    assert.deepEqual(settled.job,s.employment,label);assert.equal(settled.entries[0].amount,10000,label);
  }
  for(const label of ['我辞职','我不再打工','我停止工作'])assert.equal(plan(label,s).employment.monthlyIncome,0,label);
  assert.equal(plan('我辞职，然后入职教师，月薪8000元',s).employment.monthlyIncome,8000);
  assert.equal(plan('我继续工作，然后辞职',s).employment.monthlyIncome,0);
  assert.deepEqual(settlementPlan(s,{custom:true},plan('我辞职',s),false).job,s.employment,'An unsuccessful constrained action must not terminate employment.');
});

test('explicit money earned is booked once instead of also paying the normal salary',()=>{
  const s=state({employment:{kind:'雇员',monthlyIncome:5000,monthlyExpenses:1500}}),p=plan('我本月打工赚了6000元',s);
  const settlement=settlementPlan(s,{custom:true},p,true);
  assert.deepEqual(settlement.job,s.employment);assert.equal(settlement.entries.filter(e=>e.amount>0).length,1);
  assert.equal(settlement.entries[0].amount,6000);assert.equal(settlement.entries[1].amount,-1500);
});
