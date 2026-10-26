import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,nextContext,localEvent,advance,exportSave,importSave} from '../src/engine.js';
import {relationshipBehaviorDelta,relationshipEncounterChance,personalRelationshipOpportunity} from '../src/adult-relationships.js';
import {storyParagraphs,storyOverlap} from '../src/story-flow.js';
import {territoryActionChanges} from '../src/territory-actions.js';
import {buildPrompt} from '../src/deepseek.js';
import {getPortrait} from '../src/portraits.js';
import {regionContext} from '../src/regions.js';
import {territoryExposure,resolveTerritoryTargets} from '../src/world-territories.js';
const make=(extra={})=>createGame({name:'林远',age:25,place:'上海',seed:'v111-integration',background:'ordinary',...extra},lore);
const run=(s,label)=>{const action={label,custom:true},preview=nextContext(s,lore,action);return advance(s,action,localEvent(preview.state,lore,action),null,lore);};
test('adult relationship choices change statistics once and survive save/reload',()=>{
  const start=make(),next=run(start,'我与明确成年的朋友约会，双方自愿开始恋爱关系');
  assert.ok(next.stats.promiscuity>start.stats.promiscuity);assert.equal(start.stats.promiscuity,0);
  assert.ok(next.statChanges.some(c=>c.key==='promiscuity'));
  assert.equal(importSave(exportSave(next),lore).stats.promiscuity,next.stats.promiscuity);
  assert.ok(run(next,'我决定保持专一').stats.promiscuity<next.stats.promiscuity);
});
test('relationship preferences never reward minors, coercion or an immature body',()=>{
  const state=make();const action='我与朋友约会';
  assert.equal(relationshipBehaviorDelta(state,action,{ageMonths:17*12}),0);
  assert.equal(relationshipBehaviorDelta(state,'我与25岁朋友约会',{ageMonths:300}),1);
  assert.equal(relationshipBehaviorDelta(state,'我用信息素迫使她与我约会',{ageMonths:300}),0);
  assert.equal(relationshipBehaviorDelta(state,'我与17岁朋友约会',{ageMonths:300}),0);
  state.specialLife={body:'human',bodyAge:12};assert.equal(relationshipBehaviorDelta(state,action,{ageMonths:300}),0);
  assert.equal(personalRelationshipOpportunity(state,300),null);
  assert.ok(relationshipEncounterChance(90)>relationshipEncounterChance(5));
});
test('continued prose drops repeated actions but retains new consequences',()=>{
  const event={consequence:'你在公司核对新一批单据，同事检查后确认记录无误。女老板给你发了工资。',narrative:'你又把单据逐项核对，确认这批材料处理完毕。主管发来通知，要求你下月到新办公室办理交接。'};
  assert.equal(storyOverlap(event.consequence,event.narrative).length,1);
  const prose=storyParagraphs(event);assert.equal((prose.match(/核对/g)||[]).length,1);assert.match(prose,/新办公室/);
});
test('Shuihu creates a separate opening, preserves it in saves and uses Lai body for Mao',()=>{
  const s=make({name:'毛泽东',language:'shuihu'});assert.equal(s.profile.scenario.id,'mao-april');assert.equal(s.location,'中国台湾');
  assert.match(regionContext({...s,location:'上海'},lore).leader,/薄熙来/);assert.match(regionContext(s,lore).leader,/赖清德/);
  assert.equal(s.specialLife.body,'human');assert.notEqual(getPortrait(s).src,'./characters/mao-zedong-pixel.webp');
  const saved=importSave(exportSave(s),lore);assert.equal(saved.profile.language,'shuihu');assert.equal(saved.profile.scenario.id,'mao-april');
  assert.equal(JSON.parse(buildPrompt(s,{label:'处理公务',custom:true},lore).user).scenario.bodyIdentity,'赖清德');
  const legacy=make();legacy.profile.language='shuihu';delete legacy.profile.scenario;assert.equal(importSave(exportSave(legacy),lore).profile.scenario.id,'standard');
});
test('explicit county control is persistent and map exposure affects one monthly ledger',()=>{
  const s=make();const next=run(s,'我率领先锋队占领台湾板桥区并在台湾板桥区开战');
  const unit=resolveTerritoryTargets('台湾板桥区')[0];assert.ok(unit);assert.ok(!unit.id.startsWith('country:'));assert.ok(next.territoryOverrides[unit.id]);
  assert.equal(next.territoryOverrides[unit.id].controller,'先锋队');
  const loaded=importSave(exportSave(next),lore);assert.equal(loaded.territoryOverrides[unit.id].frontline,true);
  const local={...loaded,location:'台湾板桥区'};assert.equal(territoryExposure(local,local.location,lore).frontline,true);
  const preview=nextContext(local,lore,{label:'照常生活',passive:true}).state;
  assert.equal(preview.monthlyLedger.filter(e=>e.label==='战时物资与交通支出').length,1);
  assert.equal(loaded.monthlyLedger.filter(e=>e.label==='战时物资与交通支出').length,0);
});

test('denied or planned occupation does not transfer territory',()=>{for(const label of ['我不占领台湾板桥区','我未攻占台湾板桥区','我计划占领台湾板桥区'])assert.deepEqual(territoryActionChanges(make(),{label,custom:true}),[]);});

test('deduplication preserves new losses and new job status in an otherwise repeated sentence',()=>{const consequence='你在公司核对了十张单据。老板给你发了工资。';for(const narrative of ['你把单据逐项核对完，同事指出你漏记了五万元，财务因此暂停了你的权限。','你把单据逐项核对完，主管因此升任你为财务主任。','老板给你发工资时，银行因账户涉嫌诈骗冻结了余额。']){const text=storyParagraphs({consequence,narrative});assert.match(text,/五万元|财务主任|冻结/);}});

test('ending a regional war clears explicit local frontlines and stops wartime charges',()=>{let s=make({place:'中国台湾'});s=run(s,'我率领先锋队占领台湾并在台湾开战');assert.equal(territoryExposure(s,s.location,lore).war,true);s=run(s,'我结束台湾战争');assert.equal(territoryExposure(s,s.location,lore).war,false);assert.equal(s.monthlyLedger.filter(e=>e.label==='战时物资与交通支出').length,0);});

test('a validated foreign-language peace result also removes preview war costs',()=>{const s=make({place:'中国台湾',language:'en'});s.worldOverrides.taiwan={month:0,conflict:'台湾战争'};const action={label:'I ended the war in Taiwan.',custom:true},ctx=nextContext(s,lore,action),response=localEvent(ctx.state,lore,action);response.worldUpdates=[{region:'taiwan',kind:'peace',conflict:null,title:'Peace returns',description:'The parties cease fighting in Taiwan.'}];const next=advance(s,action,response,null,lore);assert.equal(next.territoryStatus.war,false);assert.equal(next.monthlyLedger.filter(e=>e.kind==='territory').length,0);});
