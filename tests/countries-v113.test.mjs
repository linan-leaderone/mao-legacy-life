import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import catalog from '../src/data/countries.json' with {type:'json'};
import {countryByTag,getCountryContext,getFactionContext} from '../src/countries.js';

test('ZZZ cross-country history updates all affected opening governments and leaders',()=>{
 const prk=countryByTag('PRK');
 assert.equal(prk.government,'法西斯专政');assert.equal(prk.ideologyGroup,'national_socialist');
 assert.equal(prk.leader,'金正恩');assert.equal(prk.economy,'指令经济');
 assert.equal(prk.governmentResolution.method,'explicit-transition');
 assert.match(prk.governmentResolution.source.file,/ZZZ - Anarchy/);
 assert.ok(prk.governmentResolution.activeGovernmentIdeaIds.includes('ZZZ_communist_party_state'));
 for(const tag of ['NEP','LAO','VIN','CUB','PRC'])assert.equal(countryByTag(tag).governmentTypeId,'ZZZ_presidential_dictatorship',tag);
 assert.equal(countryByTag('VIN').leader,'苏林');assert.match(countryByTag('NEP').leader,/班达里/);
 assert.match(countryByTag('CUB').leader,/劳尔/);assert.equal(countryByTag('CUB').economy,'党国资本主义');
 assert.equal(countryByTag('PRC').ideologyId,'xjp_thought');
 assert.ok(prk.openingChanges.some(c=>c.field==='ruling_party'&&c.value==='national_socialist'));
});

test('opening transfer, province control and wars retain source evidence',()=>{
 const mariupol=catalog.openingStates.find(s=>s.id===1374);
 assert.equal(mariupol.ownerTag,'BYA');assert.equal(mariupol.controllerTag,'BYA');
 assert.equal(countryByTag('BYA').cosmeticTag,'YASHUYING');assert.equal(countryByTag('BYA').startingStatus,'active');
 assert.ok(catalog.openingWars.some(w=>w.attackerTag==='DPR'&&w.defenderTag==='BYA'));
 assert.ok(catalog.openingWars.some(w=>w.attackerTag==='TAL'&&w.defenderTag==='AFG'));
 assert.ok(catalog.openingStates.some(s=>s.ownerTag==='AFG'&&Object.values(s.provinceControllers).includes('TAL')));
 for(const state of catalog.openingStates){assert.ok(state.sourceRefs.length);for(const province of Object.keys(state.provinceControllers))assert.ok(state.provinceIds.includes(Number(province)));}
});

test('faction context keeps rival administrations separate and accepts explicit updates',()=>{
 const government=getCountryContext({},'AFG'),taliban=getFactionContext({},'TAL');
 assert.notEqual(government.leader,taliban.leader);assert.equal(taliban.tag,'TAL');
 assert.equal(taliban.government,'神权制');assert.ok(taliban.conflict);
 const revised=getFactionContext({month:4,worldOverrides:{tal:{leader:'新领导',ideology:'新思想',cosmeticTag:'NEW'}},factionConflicts:{tal:null}},'TAL');
 assert.equal(revised.leader,'新领导');assert.equal(revised.cosmeticTag,'NEW');assert.equal(revised.conflict,null);
 assert.notEqual(revised.baseline.leader,'新领导');assert.equal(revised.headOfGovernment,null);
 assert.equal(getFactionContext({month:-12},'TAL').leader,null);
 assert.equal(getCountryContext({worldOverrides:{prk:{cosmeticTag:'NEW'}}},'PRK').cosmeticTag,'NEW');
});

test('opening metadata includes timed ideas and declared default game rules without future events',()=>{
 assert.equal(catalog.counts.countryHistoryFiles,693);
 assert.equal(catalog.openingAudit.defaultGameRules.april_fools_content,'DEFAULT');
 const fires=countryByTag('AST').nationalSpirits.find(s=>s.id==='AST_ongoing_wildfires');
 assert.equal(fires.initialDurationDays,150);
 assert.equal(countryByTag('TSU').startingStatus,'not-present');assert.equal(countryByTag('TZL').startingStatus,'not-present');
 assert.ok(countryByTag('PRC').initialEventRefs.some(e=>e.id==='PRC_MAO2.35'&&e.days===46));
 assert.ok(catalog.openingAudit.loadOrder.some(x=>x.file==='history/countries/ZZZ - Anarchy.txt'));
 assert.ok(catalog.openingAudit.unresolvedConditions.length>0);
 assert.ok(catalog.sourceFiles.some(x=>x.path.startsWith('common/scripted_effects/')));
});

test('opening importer respects load order, scoped scripts, real defaults and future/unknown barriers',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mao-countries-v113-'));
 const write=(file,text)=>{const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,text);};
 try{
  write('common/country_tags/test.txt','AAA = "countries/A.txt" BBB = "countries/B.txt" ZZZ = "countries/Z.txt"');
  write('common/ideologies/test.txt','ideologies = { conservative = { types = { constitutionalism = {} } } nationalist = { types = { test_nationalism = {} } } }');
  write('common/characters/test.txt','characters = { initial = { name = "initial" country_leader = { ideology = constitutionalism } } replacement = { name = "replacement" country_leader = { ideology = test_nationalism } } }');
  write('common/game_rules/test.txt','test_rule = { default = { name = KEEP } option = { name = REPLACE } }');
  write('common/scripted_effects/test.txt',`remove_gov_types = { remove_ideas = { ZZZ_fascist_dictatorship ZZZ_parliamentary_republic } }
change_government_type_fascist_dictatorship = { hidden_effect = { remove_gov_types = yes add_ideas = ZZZ_fascist_dictatorship } }
patch_country = { set_politics = { ruling_party = nationalist } recruit_character = replacement change_government_type_fascist_dictatorship = yes }
unused_future_effect = { AAA = { set_cosmetic_tag = FUTURE } }`);
  write('history/states/1-test.txt','state = { id = 1 name = PLACE provinces = { 101 102 } history = { owner = AAA BBB = { set_province_controller = 102 } } }');
  write('history/states/2-test.txt','state = { id = 2 name = OTHER provinces = { 103 } history = { owner = BBB } }');
  write('history/countries/AAA - A.txt','capital = 1 recruit_character = initial set_politics = { ruling_party = conservative } 2019.12.31 = { set_stability = 0.4 } 2020.10.1 = { set_cosmetic_tag = FUTURE_DATE }');
  write('history/countries/BBB - B.txt','set_politics = { ruling_party = conservative }');
  write('history/countries/ZZZ - Z.txt',`AAA = { patch_country = yes set_cosmetic_tag = OVERRIDE country_event = { id = future days = 1 } country_event = { id = present } }
BBB = { declare_war_on = { target = AAA type = annex_everything } }`);
  write('common/on_actions/00-start.txt',`on_actions = { on_startup = { effect = {
AAA = { add_ideas = ZZZ_parliamentary_republic
 if = { limit = { has_game_rule = { rule = test_rule option = REPLACE } } set_cosmetic_tag = WRONG_RULE }
 if = { limit = { unsupported_condition = yes } set_cosmetic_tag = UNKNOWN } else = { set_cosmetic_tag = WRONG_ELSE }
} } } }`);
  write('events/test.txt','country_event = { id = present immediate = { set_stability = 0.7 } option = { set_cosmetic_tag = WRONG_OPTION } } country_event = { id = future immediate = { set_cosmetic_tag = WRONG_EVENT } }');
  write('localisation/test_l_simp_chinese.yml','l_simp_chinese:\n ZZZ_fascist_dictatorship:0 "法西斯专政"\n ZZZ_parliamentary_republic:0 "议会制"\n initial:0 "初始人物"\n replacement:0 "覆盖人物"\n');
  const output=path.join(dir,'output.json');
  const result=spawnSync(process.execPath,['scripts/build-country-catalog.mjs','--mod='+dir,'--output='+output],{cwd:path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/(\w:)/,'$1')),encoding:'utf8',timeout:30000});
  assert.equal(result.status,0,result.stderr);const data=JSON.parse(fs.readFileSync(output,'utf8')),a=data.tags.AAA;
  assert.equal(a.cosmeticTag,'OVERRIDE');assert.equal(a.ideologyGroup,'nationalist');assert.equal(a.leader,'覆盖人物');assert.equal(a.government,'法西斯专政');assert.equal(a.stability,0.7);
  assert.equal(data.openingStates[0].provinceControllers[102],'BBB');
  assert.equal(data.openingWars[0].attackerTag,'BBB');assert.equal(data.openingWars[0].defenderTag,'AAA');
  assert.equal(data.openingAudit.defaultGameRules.test_rule,'KEEP');assert.ok(data.openingAudit.unresolvedConditions.some(x=>x.key==='unsupported_condition'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
