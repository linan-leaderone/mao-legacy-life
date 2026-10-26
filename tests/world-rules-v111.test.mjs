import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import lore from '../src/data/lore.json' with {type:'json'};
import {regionContext,deriveGovernmentState,normalizeWorldOverrides} from '../src/regions.js';
import {getPoliticalActors,findPersona} from '../src/personas.js';
import {createOpeningScenario,applyOpeningScenario,scenarioRegionPatch,scenarioMonthlyEvents,scenarioAllowsEvent,scenarioAdaptEvent,scenarioContext} from '../src/scenario.js';
import {POLICY_CATALOG,eligibleMonthlyPolicies,selectMonthlyPolicies,enactedPolicyContext} from '../src/policies.js';
import {validateSpecialLife} from '../src/special-lives.js';
const state=(location='中国台湾',month=60)=>({seed:'regime-proof',month,turn:0,location,profile:{name:'林安',language:'zh-CN'},person:{facts:[]},stats:{influence:10},seenEvents:[],seenNews:[],newsHistory:[],worldOverrides:{},eventMonths:{}});
function publish(s,id,month=s.month-5){s.seenEvents.push(id);s.eventMonths[id]=month;s.newsHistory.push({id,month,title:id,description:''});}

test('Taiwan left victory and Japan administrations replace obsolete 2020 ideology',()=>{
 const s=state();publish(s,'tw_civil_war',45);publish(s,'tw_left_end',50);
 const c=regionContext(s,lore);assert.equal(c.factionId,'taiwan_left');assert.match(c.ideology,/社会主义|劳工/);assert.doesNotMatch(c.ideology,/社会自由|民进党/);assert.equal(c.conflict,null);
 s.location='日本';publish(s,'jp_emergency_committee',50);assert.equal(regionContext(s,lore).factionId,'japan_toyokawa');assert.doesNotMatch(regionContext(s,lore).ideology,/自民党/);
 publish(s,'jp_hazawa_end',57);assert.equal(regionContext(s,lore).factionId,'japan_left');assert.match(regionContext(s,lore).ideology,/羽泽鸫/);
});
test('old declared winners with missing or copied ideology are repaired without altering explicit beliefs',()=>{
 const s=state();s.worldOverrides.taiwan={leader:'左翼联盟',government:'台湾社会主义共和国临时政府',ideology:'社会自由主义；民进党台湾进步主义',conflict:null};
 const before=structuredClone(s),overrides=normalizeWorldOverrides(s);assert.equal(overrides.taiwan.factionId,'taiwan_left');assert.doesNotMatch(overrides.taiwan.ideology,/民进党/);assert.deepEqual(s,before);
 assert.equal(deriveGovernmentState(s,lore).taiwan.ideology,overrides.taiwan.ideology);
 s.worldOverrides.taiwan.ideology='本人提出的新社会主义纲领';assert.equal(regionContext(s,lore).ideology,'本人提出的新社会主义纲领');
});
test('ordinary musicians cannot issue autonomous government announcements before political involvement',()=>{
 const s=state('日本',0);for(const actor of getPoliticalActors(s).filter(a=>/Afterglow/.test(a.role)))assert.equal(actor.autonomyEligible,false,actor.name);
 publish(s,'rs_tw_afterglow_records',0);publish(s,'rs_tw_afterglow_departure',0);assert.equal(getPoliticalActors(s).find(a=>a.name==='美竹兰').autonomyEligible,false);
 publish(s,'jp_hazawa_toyokawa_war',0);assert.equal(getPoliticalActors(s).find(a=>a.name==='美竹兰').autonomyEligible,true);
 const explicit=state('日本',3);explicit.worldOverrides.japan={leader:'美竹兰',government:'新政府'};assert.equal(getPoliticalActors(explicit).find(a=>a.name==='美竹兰').autonomyEligible,true);
});
test('April timeline is immutable opening metadata and does not activate on an old language-only save',()=>{
 const s=state('北京',0);s.profile.language='shuihu';assert.deepEqual(scenarioRegionPatch(s,'china'),{});assert.equal(scenarioContext(s),null);
 s.profile.scenario=createOpeningScenario(s.profile);applyOpeningScenario(s);assert.equal(regionContext(s,lore).leader,'薄熙来');
 s.profile.language='en';assert.equal(regionContext(s,lore).leader,'薄熙来');
 assert.equal(scenarioAllowsEvent(s,{id:'cn_hu_inauguration'}),false);assert.equal(scenarioAllowsEvent(s,{id:'world_strait_war'}),true);
 assert.doesNotMatch(scenarioAdaptEvent(s,{id:'world_opening',description:'民进党连任'}).description,/连任/);
 const actors=getPoliticalActors(s);assert.ok(actors.some(a=>a.name==='薄熙来'));assert.equal(actors.some(a=>a.name==='习近平'),false);
});
test('hidden Mao inhabits the requested body, validates and never duplicates the coffin identity',()=>{
 const s=state('北京',0);s.profile={name:'毛泽东',lockedPersonaId:'mao_zedong',language:'shuihu',scenario:createOpeningScenario({language:'shuihu'})};
 applyOpeningScenario(s);assert.equal(s.location,'中国台湾');assert.equal(s.person.bodyIdentity,'赖清德');assert.equal(s.specialLife.body,'human');assert.equal(s.person.ageOverride.months,722);
 assert.doesNotMatch(s.profile.backgroundText,/你仍在北京|身体暂时不能/);assert.match(s.person.occupation,/台湾总统/);
 validateSpecialLife(s,findPersona('毛泽东'));const before=structuredClone(s);applyOpeningScenario(s);assert.deepEqual(s,before);
 assert.equal(getPoliticalActors(s).some(a=>a.name==='赖清德'),false);
 const bo=state('北京·秦城监狱',0);bo.profile={name:'薄熙来',scenario:createOpeningScenario({language:'shuihu'})};applyOpeningScenario(bo);assert.equal(bo.location,'北京');assert.equal(bo.person.custody,false);assert.match(bo.profile.backgroundText,/现已担任中国国家主席/);
});
test('April institutions develop in sequence and stop when the player replaces their government',()=>{
 const s=state('中国台湾',0);s.profile.scenario=createOpeningScenario({language:'shuihu'});applyOpeningScenario(s);
 let events=scenarioMonthlyEvents(s);assert.deepEqual(events.map(e=>e.id),['april_opening']);s.newsHistory.push(...events);
 s.month=7;events=scenarioMonthlyEvents(s);assert.deepEqual(events.map(e=>e.id),['april_public_assemblies']);s.newsHistory.push(...events);
 // No advance to planned economics until the relevant publication exists.
 assert.equal(regionContext(s,lore).factionId,'taiwan_april_lai');s.month=8;assert.equal(scenarioMonthlyEvents(s).length,0);s.month=10;events=scenarioMonthlyEvents(s);s.newsHistory.push(...events);assert.equal(regionContext(s,lore).factionId,'taiwan_april_commune');
 s.worldOverrides.taiwan={source:'player',leader:'林安'};assert.equal(scenarioMonthlyEvents(s).length,0);
});
test('policies are regime-gated, source-bound and do not infer future focus completion',()=>{
 const s=state('中国台湾');const original=structuredClone(s);const initial=eligibleMonthlyPolicies(s,lore);
 assert.equal(initial.some(p=>p.factions.includes('taiwan_left')&&p.region==='taiwan'),false);
 publish(s,'tw_left_end',50);const left=eligibleMonthlyPolicies(s,lore).filter(p=>p.region==='taiwan');assert.ok(left.length);assert.ok(left.every(p=>p.factions.includes('taiwan_left')));assert.equal(left.some(p=>p.focusId==='TZL_TWW_FOCUS_70'),false);
 const previous={...POLICY_CATALOG.find(p=>p.focusId==='TZL_TWW_FOCUS_47'),source:'focus_policy',month:54};s.newsHistory.push(previous);
 assert.ok(eligibleMonthlyPolicies(s,lore).some(p=>p.focusId==='TZL_TWW_FOCUS_70'));
 assert.equal(enactedPolicyContext(s).some(p=>p.id===previous.id),true);
 assert.deepEqual(selectMonthlyPolicies(original,lore),selectMonthlyPolicies(original,lore));assert.deepEqual(original,state());
});
test('policy global and regional cooldowns, exclusive choices and war requirements hold',()=>{
 const s=state('中国台湾');publish(s,'tw_left_end',45);
 const plan=POLICY_CATALOG.find(p=>p.focusId==='TZL_TWW_FOCUS_45');s.newsHistory.push({...plan,source:'focus_policy',month:59});assert.equal(eligibleMonthlyPolicies(s,lore).length,0);
 s.month=61;assert.equal(eligibleMonthlyPolicies(s,lore).some(p=>p.region==='taiwan'),false);
 s.month=66;s.newsHistory.push({...POLICY_CATALOG.find(p=>p.focusId==='TZL_TWW_FOCUS_70'),source:'focus_policy',month:54});assert.equal(eligibleMonthlyPolicies(s,lore).some(p=>p.focusId==='TZL_TWW_FOCUS_72'),false);
 assert.equal(eligibleMonthlyPolicies(s,lore).some(p=>p.war),false);
});
test('policy catalog references real MOD focus and localisation keys when authoring source exists',()=>{
 const root=new URL('../../TFR-xinzuo-rebuild/',import.meta.url);assert.ok(POLICY_CATALOG.length>=40);
 if(!existsSync(root))return;
 for(const policy of POLICY_CATALOG)for(const ref of policy.sourceRefs){const file=new URL(ref.file,root);assert.ok(existsSync(file),ref.file);assert.ok(readFileSync(file,'utf8').includes(ref.key),ref.key);}
});
