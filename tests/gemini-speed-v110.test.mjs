import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame} from '../src/engine.js';
import {buildPrompt} from '../src/deepseek.js';
import {compactNarrativePrompt} from '../src/prompt-compact.js';

const game=extra=>createGame({name:'林远',age:22,place:'日本',background:'ordinary',seed:'gemini-speed-regression',...extra},lore);
const passive={label:'照常生活',passive:true};
test('compact prompt keeps all authoritative state and historical facts without changing source or validation',()=>{
  const state=game(),before=structuredClone(state),full=buildPrompt(state,passive,lore),original=JSON.parse(full.user),compact=compactNarrativePrompt(full),reduced=JSON.parse(compact.user);
  for(const key of ['targetDate','actionDate','currentAgeYears','actionAgeYears','identity','currentIdentity','localSituation','worldOverrides','worldHistory','news','modContext','pinnedFacts','longTermMemory','recentHistory','stats','statChanges','monthlyLedger','actionOutcome','intimacyAllowed','politicalActors'])assert.deepEqual(reduced[key],original[key],key);
  assert.deepEqual(state,before);assert.equal(compact.validationContext,full.validationContext);
  assert.equal(full.user,JSON.stringify(original));assert.ok(compact.system.length<full.system.length);
  assert.match(compact.system,/newsTranslations固定为\[\]/);assert.match(compact.system,/worldUpdates固定为\[\]/);
  assert.ok(!compact.system.includes('本人已经在targetDate身亡'));
});
test('compression retains special bodies, time travel, confirmed age and public action rules',()=>{
  const state=game({name:'邓小平'}),full=buildPrompt(state,{label:'我已经返老还童到25岁，并穿越到1976年1月',custom:true},lore),compact=compactNarrativePrompt(full),data=JSON.parse(compact.user);
  assert.ok(data.specialLife);assert.equal(data.timeTravel,true);assert.equal(data.currentAgeYears,25);assert.match(data.targetDate,/1976/);
  assert.match(compact.system,/eaten=0/);assert.match(compact.system,/currentIdentity.ageOverride/);
  assert.deepEqual(compact.validationContext,full.validationContext);
});
test('foreign news translation, choices and deceased rules stay active when needed',()=>{
  const full=buildPrompt(game({language:'en'}),passive,lore),data=JSON.parse(full.user);
  data.currentIdentity.deceased={month:1,cause:'test'};data.decision=true;
  const compact=compactNarrativePrompt({...full,user:JSON.stringify(data)});
  assert.match(compact.system,/newsTranslations只翻译/);assert.match(compact.system,/originalLabel/);assert.match(compact.system,/本人已经在targetDate身亡/);
});
test('contacts named by current thread survive relation projection and disconnected links are removed',()=>{
  const full=buildPrompt(game(),passive,lore),data=JSON.parse(full.user);
  data.relationshipGraph={version:1,nodes:[{id:'player',name:'林远'},...Array.from({length:95},(_,i)=>({id:'p'+i,name:'联系人'+i,detail:'已在工作中认识',firstMetMonth:0,lastContactMonth:1}))],edges:Array.from({length:95},(_,i)=>({source:'player',target:'p'+i,status:'朋友',detail:'共同处理工作',strength:50,kind:'friend'})),omittedPeople:12};
  data.continuation.thread='按照与联系人90的约定继续研究';
  data.relationshipGraph.edges[70].strength=100;
  const original=JSON.stringify(data),compact=compactNarrativePrompt({...full,user:original}),reduced=JSON.parse(compact.user),ids=new Set(reduced.relationshipGraph.nodes.map(n=>n.id));
  assert.ok(ids.has('p90'));assert.ok(ids.has('p70'));assert.ok(ids.has('player'));assert.ok(ids.size<40);
  assert.ok(reduced.relationshipGraph.edges.every(e=>ids.has(e.source)&&ids.has(e.target)));
  assert.equal(reduced.relationshipGraph.omittedPeople,12+96-ids.size);assert.equal(JSON.stringify(data),original);
});
test('exact duplicate continuity copies are omitted but differing historical facts are kept',()=>{
  const full=buildPrompt(game(),passive,lore),data=JSON.parse(full.user);
  data.continuation.previousNarrative='以前的事实';data.currentPersonalEvent.narrative='不一样的事实';
  data.encounterState={infected:true};data.continuation.encounterState={infected:false};
  const reduced=JSON.parse(compactNarrativePrompt({...full,user:JSON.stringify(data)}).user);
  assert.equal(reduced.currentPersonalEvent.narrative,'不一样的事实');assert.deepEqual(reduced.continuation.encounterState,{infected:false});
  assert.deepEqual(reduced.encounterState,{infected:true});
});
