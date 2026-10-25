import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame} from '../src/engine.js';
import {buildPrompt,responseSchema} from '../src/deepseek.js';
import {proseIssues} from '../src/narrative.js';
const game=(overrides={})=>createGame({name:'林安',age:24,place:'北京',background:'ordinary',backgroundText:'我在当地工作。',freedom:'unlimited',seed:'prompt-v16',...overrides},lore);
const result=(narrative,extra={})=>({title:'本月的生活',narrative,consequence:'你处理了手上的事情，联络熟悉的人确定以后的安排。',memory:'',options:[],...extra});

test('prompt follows authoritative travel dates, retained age and historical institutions',()=>{
  const s=game(),before=structuredClone(s),prompt=buildPrompt(s,{custom:true,label:'我已经穿越时空到1976年12月'},lore),p=JSON.parse(prompt.user);
  assert.match(p.targetDate,/1976 年 12 月/);assert.match(p.actionDate,/2020 年 01 月/);
  assert.equal(p.timeTravel,true);assert.equal(p.arrivalDate,p.targetDate);assert.equal(p.turn,1);
  assert.equal(p.currentAgeYears,24);assert.ok(p.currentIdentity.ageOverride);
  assert.doesNotMatch(p.localSituation.leader,/习近平/);assert.equal(p.politicalActors.length,0);
  assert.equal(p.worldHistory.some(e=>/2020 年/.test(e.date)),false);assert.deepEqual(s,before);
  assert.equal(proseIssues(result('1976年12月，你按照当地的条件安排住处，开始联系能够提供帮助的人。'),prompt.validationContext).length,0);
  assert.ok(proseIssues(result('2020年1月，你回到单位重新整理工作，街道通知居民准备防疫物资。'),prompt.validationContext).some(x=>/月份/.test(x)));
});
test('negative month validation uses December instead of a zero or negative month',()=>{
  const context={month:-529,priorMonth:0,timeTravel:true,ageYears:24,priorAgeYears:24};
  assert.equal(proseIssues(result('1975年12月，你在住处整理随身物品，记下已经了解到的事情。',{consequence:'1975年12月，你已抵达这里，向接待的人说明自己的需要。'}),context).length,0);
  assert.ok(proseIssues(result('1975年11月，你在住处整理随身物品，记下已经了解到的事情。'),context).some(x=>/月份/.test(x)));
});
test('rejuvenated age overrides birthday and prevents the old age or fantasy from replacing it',()=>{
  const prompt=buildPrompt(game({age:65}),{custom:true,label:'我已经返老还童到20岁'},lore),p=JSON.parse(prompt.user);
  assert.equal(p.currentAgeYears,20);assert.equal(p.actionAgeYears,65);assert.ok(p.currentIdentity.ageOverride);
  assert.equal(proseIssues(result('你今年20岁，按照新的身体条件安排活动，原来的工作和记忆仍然保留。'),prompt.validationContext).length,0);
  assert.ok(proseIssues(result('你今年65岁，按照原先安排出门工作，与同事聊了近来的事情。'),prompt.validationContext).some(x=>/年龄/.test(x)));
  assert.ok(proseIssues(result('返老还童只是幻想，你醒来后照常处理工作，之前的身体变化没有发生。'),prompt.validationContext).some(x=>/幻想/.test(x)));
});
test('income, changing attributes and ideology reach the shared prompt without being recalculated by AI',()=>{
  const prompt=buildPrompt(game(),{custom:true,label:'我已经开始打工，月薪6000，我信奉社会民主主义'},lore),p=JSON.parse(prompt.user);
  assert.equal(p.freedom,'unlimited');assert.ok(p.monthlyLedger.some(e=>e.amount===6000));
  assert.ok(p.statChanges.some(e=>e.key==='funds'&&e.delta>0));assert.match(p.currentIdentity.ideology,/社会民主主义/);
  for(const key of ['morality','promiscuity','charisma']){assert.equal(typeof p.stats[key],'number');assert.ok(responseSchema.properties.actionDelta.properties[key]);}
  assert.match(prompt.system,/actionDelta固定为\{\}/);assert.ok(responseSchema.properties.personUpdate.properties.ideology);
});
test('only current actor stages enter the prompt and successful public actions may supply extra facts',()=>{
  const prompt=buildPrompt(game({name:'羽泽鸫'}),{passive:true,label:'照常生活'},lore),p=JSON.parse(prompt.user);
  assert.equal(p.politicalActors.some(a=>a.name==='羽泽鸫'),false);
  assert.equal(p.politicalActors.some(a=>a.stages),false);assert.equal(prompt.user.includes('modPolitics'),false);
  assert.equal(prompt.user.includes('jp_hazawa_toyokawa_war'),false);
  assert.equal(p.canSuggestWorldUpdates,false);
  const updates=[{region:'japan',kind:'war',title:'战争爆发',description:'战事改变了交通与公共服务。'}];
  assert.ok(proseIssues(result('你整理了自己的东西，与伙伴一起安排下次排练。',{worldUpdates:updates}),prompt.validationContext).some(x=>/worldUpdates/.test(x)));
  const publicPrompt=buildPrompt(game({place:'日本'}),{custom:true,label:'我已经加入afterglow并发动日本内战'},lore),pub=JSON.parse(publicPrompt.user);
  assert.equal(pub.canSuggestWorldUpdates,true);assert.match(pub.worldOverrides.japan.conflict,/内战/);
  assert.ok(pub.actionOutcome.declarations.worldChanges.length);assert.ok(responseSchema.properties.worldUpdates);
});
test('intimacy permissions follow current and special-body age rather than historical adult identity',()=>{
  const minor=buildPrompt(game({age:16}),{passive:true,label:'照常生活'},lore);
  assert.equal(JSON.parse(minor.user).intimacyAllowed,false);
  assert.ok(proseIssues(result('你和朋友见面，安排之后的休息时间。',{options:[{label:'约会',description:'见面讨论日常。',delta:{promiscuity:1}}]}),minor.validationContext).some(x=>/亲密/.test(x)));
  assert.equal(JSON.parse(buildPrompt(game({age:25}),{passive:true,label:'照常生活'},lore).user).intimacyAllowed,true);
  const fish=buildPrompt(game({name:'邓小平'}),{passive:true,label:'照常生活'},lore);
  assert.equal(JSON.parse(fish.user).intimacyAllowed,false);
  const younger=buildPrompt(game({name:'毛泽东'}),{custom:true,label:'我复活并且身体变成17岁'},lore);
  assert.equal(JSON.parse(younger.user).intimacyAllowed,false);
});
