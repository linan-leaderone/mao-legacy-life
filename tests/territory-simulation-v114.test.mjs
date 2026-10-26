import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {getGeographyUnit,geographyUnits} from '../src/geography.js';
import {openingControlForUnit,getOpeningFaction} from '../src/opening-control.js';
import {deriveTerritorySituation,createTerritoryContext,fragmentedCountryIds,controllerColor} from '../src/world-territories.js';

const make=(patch={})=>({id:'life-114',seed:'v114',month:0,location:'阿富汗',profile:{name:'林青'},seenEvents:[],seenNews:[],newsHistory:[],eventMonths:{},worldOverrides:{},worldDynamics:{},...patch});
const kabul=getGeographyUnit('AFG-17698898B53195345217503');
const afg=geographyUnits.filter(unit=>unit.country==='AFG'&&unit.role==='county');
const tw=geographyUnits.filter(unit=>unit.country==='TWN'&&unit.role==='county');
const facts=s=>({ownerId:s.ownerId,ownerTag:s.ownerTag,attackerId:s.attackerId,frontline:s.frontline});

test('every ambiguous Afghan county gets an existing concrete faction while raw evidence is retained',()=>{
 const state=make(),before=JSON.stringify(state),prepared=createTerritoryContext(state,lore);
 for(const unit of afg){
  const raw=openingControlForUnit(unit),actual=deriveTerritorySituation(state,unit,lore,prepared);
  assert.equal(actual.uncertain,false,unit.id);assert.ok(actual.ownerId);assert.ok(['AFG','TAL'].includes(actual.ownerTag));
  if(raw.uncertain)assert.ok(raw.mixedControllers.some(row=>row.tag===actual.ownerTag),unit.id);
  else assert.equal(actual.ownerTag,raw.tag);
 }
 assert.equal(openingControlForUnit(kabul).uncertain,true);assert.equal(JSON.stringify(state),before);
});
test('map order, passive months and JSON save round trips preserve ownership and fronts',()=>{
 const state=make(),units=afg.slice(0,80),expected=new Map(units.map(unit=>[unit.id,facts(deriveTerritorySituation(state,unit,lore))]));
 for(const copy of [JSON.parse(JSON.stringify(state)),{...state,month:8}])for(const unit of [...units].reverse())assert.deepEqual(facts(deriveTerritorySituation(copy,unit,lore)),expected.get(unit.id));
 const old=make({seed:undefined});assert.deepEqual(facts(deriveTerritorySituation(old,kabul,lore)),facts(deriveTerritorySituation(JSON.parse(JSON.stringify(old)),kabul,lore)));
});
test('different lives vary the simulated uncertain counties without changing clear control',()=>{
 const a=make({seed:'a'}),b=make({seed:'b'});
 assert.ok(afg.some(unit=>deriveTerritorySituation(a,unit,lore).ownerTag!==deriveTerritorySituation(b,unit,lore).ownerTag));
 const crimea=geographyUnits.find(unit=>unit.country==='UKR'&&unit.role==='county'&&openingControlForUnit(unit)?.tag==='SOV');
 assert.ok(crimea);assert.equal(deriveTerritorySituation(a,crimea,lore).ownerTag,'SOV');assert.equal(deriveTerritorySituation(b,crimea,lore).ownerTag,'SOV');
});
test('war has rear areas and fronts; an attacker is a different actual belligerent',()=>{
 const state=make(),prepared=createTerritoryContext(state,lore),values=afg.map(unit=>deriveTerritorySituation(state,unit,lore,prepared));
 assert.ok(values.some(row=>row.frontline));assert.ok(values.some(row=>row.war&&!row.frontline));
 for(const row of values){if(row.frontline){assert.ok(row.attackerTag);assert.notEqual(row.ownerTag,row.attackerTag);assert.ok(getOpeningFaction(row.ownerTag).opponents.includes(row.attackerTag));}else assert.equal(row.attackerId,null);}
});
test('explicit occupation replaces simulation and does not inherit its attacking stripes',()=>{
 const state=make({territoryOverrides:{[kabul.id]:{controller:'新成立的星海联盟',controllerId:'star-sea',month:0,source:'personal_action'}}});
 const value=deriveTerritorySituation(state,kabul,lore);assert.equal(value.ownerId,'star-sea');assert.equal(value.ownerName,'新成立的星海联盟');assert.equal(value.simulation,null);assert.equal(value.frontline,false);assert.equal(value.attackerId,null);
 const later={...state,territoryOverrides:{[kabul.id]:{...state.territoryOverrides[kabul.id],month:3}}};assert.notEqual(deriveTerritorySituation(later,kabul,lore).ownerId,'star-sea');
});
test('explicit combat preserves the defender and names the attacking side',()=>{
 const base=make(),defender=deriveTerritorySituation(base,kabul,lore),attacker=defender.ownerTag==='AFG'?'TAL':'AFG';
 const state=make({territoryOverrides:{[kabul.id]:{conflict:'喀布尔战斗',frontline:true,attackerId:'faction:'+attacker,month:0}}});
 const value=deriveTerritorySituation(state,kabul,lore);assert.equal(value.ownerId,defender.ownerId);assert.equal(value.frontline,true);assert.equal(value.attackerTag,attacker);
 const rear=deriveTerritorySituation({...state,territoryOverrides:{[kabul.id]:{...state.territoryOverrides[kabul.id],frontline:false}}},kabul,lore);assert.equal(rear.frontline,false);assert.equal(rear.attackerId,null);
});
test('local, faction, regional and global ceasefires clear stale stripes without changing ownership',()=>{
 const initial=make(),owner=deriveTerritorySituation(initial,kabul,lore),stale={conflict:'喀布尔战斗',frontline:true,attackerId:owner.ownerTag==='AFG'?'faction:TAL':'faction:AFG',month:0};
 const variants=[{territoryOverrides:{[kabul.id]:{...stale,conflict:null}}},{territoryOverrides:{[kabul.id]:stale},factionConflicts:{['faction:'+owner.ownerTag]:null}},{territoryOverrides:{[kabul.id]:stale},worldOverrides:{afg:{conflict:null}}},{territoryOverrides:{[kabul.id]:stale},worldDynamics:{lastingPeace:true}},{territoryOverrides:{[kabul.id]:stale},worldDynamics:{terminatedConflicts:['afg']}}];
 for(const patch of variants){const state=make(patch);for(const prepared of [undefined,createTerritoryContext(state,lore)]){const row=deriveTerritorySituation(state,kabul,lore,prepared);assert.equal(row.ownerId,owner.ownerId);assert.equal(row.frontline,false);assert.equal(row.attackerId,null);assert.equal(row.war,false);}}
});
test('a peaceful split has concrete local factions and no frontlines',()=>{
 const state=make({location:'中国台湾',month:35,seenEvents:['tw_four_factions'],eventMonths:{tw_four_factions:35}}),prepared=createTerritoryContext(state,lore);
 const sides=new Set();for(const unit of tw){const row=deriveTerritorySituation(state,unit,lore,prepared);assert.equal(row.uncertain,false);assert.equal(row.frontline,false);assert.equal(row.attackerId,null);sides.add(row.ownerId);}
 assert.ok(sides.size>1);
});
test('a civil-war victory replaces the county allocation with the new unified government',()=>{
 const state=make({location:'中国台湾',month:45,seenEvents:['tw_civil_war','tw_left_end'],eventMonths:{tw_civil_war:35,tw_left_end:44}});
 for(const unit of tw.slice(0,15)){const row=deriveTerritorySituation(state,unit,lore);assert.equal(row.ownerId,'taiwan_left');assert.equal(row.frontline,false);assert.equal(row.simulation,null);}
 const player=make({location:'中国台湾',month:45,seenEvents:['tw_civil_war'],eventMonths:{tw_civil_war:35},worldOverrides:{taiwan:{factionId:'taiwan_kmt',leader:'国民党',government:'统一新政府',conflict:null,stage:'postwar',month:44}}});
 assert.equal(deriveTerritorySituation(player,tw[0],lore).ownerId,'taiwan_kmt');
});
test('fragmentation layer hints cover opening and later divided countries without future-war spoilers',()=>{
 const opening=fragmentedCountryIds(make());for(const iso of ['AFG','SYR','YEM','UKR'])assert.ok(opening.has(iso));assert.equal(opening.has('TWN'),false);assert.equal(opening.has('JPN'),false);
 const later=make({month:40,seenEvents:['tw_civil_war'],eventMonths:{tw_civil_war:35}});assert.ok(fragmentedCountryIds(later).has('TWN'));assert.deepEqual(fragmentedCountryIds(later),fragmentedCountryIds(later,createTerritoryContext(later,lore)));
 const occupation=make({territoryOverrides:{[tw[0].id]:{controller:'塔利班',controllerId:'faction:TAL',month:0}}});assert.ok(fragmentedCountryIds(occupation).has('TWN'));
 assert.equal(fragmentedCountryIds(make({month:-12})).has('AFG'),false);
});
test('competing factions have distinct stable colours, including primary country aliases',()=>{
 for(const tags of [['AFG','TAL'],['SYR','ROJ','HTS','FSA'],['YEM','HOU','AAS']]){const colors=tags.map(tag=>controllerColor('faction:'+tag));assert.equal(new Set(colors).size,tags.length);for(const tag of tags)assert.equal(controllerColor(tag),controllerColor('faction:'+tag));}
 assert.equal(controllerColor('afg'),controllerColor('faction:AFG'));assert.equal(controllerColor('syr'),controllerColor('faction:SYR'));assert.equal(controllerColor('yem'),controllerColor('faction:YEM'));
 const rows=afg.map(unit=>deriveTerritorySituation(make(),unit,lore));assert.deepEqual([...new Set(rows.filter(row=>row.ownerTag==='AFG').map(row=>row.ownerId))],['faction:AFG']);
 const later=make({month:45,seenEvents:['tw_civil_war','tw_left_end'],eventMonths:{tw_civil_war:35,tw_left_end:44}});assert.equal(deriveTerritorySituation(later,tw[0],lore).ownerId,'taiwan_left');
});
test('American counties split between the public Trump and Biden sides only after the outbreak',()=>{
 const units=geographyUnits.filter(row=>row.country==='USA'&&row.role==='county').slice(0,100),before=make({month:18});
 for(const unit of units.slice(0,5))assert.notEqual(deriveTerritorySituation(before,unit,lore).ownerTag,'USB');
 const state=make({month:19,seenEvents:['world_usa_civil_war'],eventMonths:{world_usa_civil_war:19}}),prepared=createTerritoryContext(state,lore),rows=units.map(unit=>deriveTerritorySituation(state,unit,lore,prepared));
 assert.deepEqual(new Set(rows.map(row=>row.ownerTag)),new Set(['USA','USB']));assert.ok(rows.every(row=>row.war&&!row.uncertain));
 for(const unit of units.slice(0,15))assert.deepEqual(facts(deriveTerritorySituation(state,unit,lore)),facts(deriveTerritorySituation(JSON.parse(JSON.stringify(state)),unit,lore,prepared)));
 assert.ok(rows.some(row=>row.frontline));assert.ok(rows.some(row=>!row.frontline));
 const ended={...state,worldOverrides:{usa:{factionId:'united-us',name:'统一政府',leader:'新政府',government:'统一联邦政府',stage:'postwar',conflict:null,month:19}}},unified=deriveTerritorySituation(ended,units[0],lore);assert.equal(unified.simulation,null);assert.match(unified.government,/统一联邦/);assert.equal(unified.war,false);assert.ok(!['faction:USA','faction:USB'].includes(unified.ownerId));
});
test('Chinese civil war rosters follow already published events and do not reveal later winners',()=>{
 const units=geographyUnits.filter(row=>row.country==='CHN'&&row.role==='county').slice(0,160);
 for(const [event,allowed] of [['cn_longmarch_coup',['china_leftfront','china_old_cpc']],['cn_total_civil_war',['china_mao','china_dissenting_military']]]){
  const state=make({month:120,seenEvents:[event],eventMonths:{[event]:110}}),prepared=createTerritoryContext(state,lore),rows=units.map(unit=>deriveTerritorySituation(state,unit,lore,prepared));
  assert.deepEqual(new Set(rows.map(row=>row.ownerId)),new Set(allowed));assert.ok(rows.every(row=>!row.uncertain&&row.war));assert.ok(rows.some(row=>row.frontline));
  assert.ok(rows.every(row=>!row.simulation.candidateIds.includes('china_ling')&&!row.simulation.candidateIds.includes('china_front')));
 }
 const collapsed=make({month:45,seenEvents:['cn_collapse_civil'],eventMonths:{cn_collapse_civil:40}}),rows=units.map(unit=>deriveTerritorySituation(collapsed,unit,lore));
 assert.ok(rows.some(row=>row.ownerId.startsWith('local-command:')));assert.ok(rows.every(row=>row.ownerId==='china_initial'||row.ownerId.startsWith('local-command:')));
 const formed=make({month:120,seenEvents:['cn_total_civil_war','cn_front_stalemate'],eventMonths:{cn_total_civil_war:110,cn_front_stalemate:115}});assert.ok(deriveTerritorySituation(formed,units[0],lore).simulation.candidateIds.includes('china_front'));
});
test('explicitly established player factions participate in the current local civil war',()=>{
 const units=geographyUnits.filter(row=>row.country==='CHN'&&row.role==='county').slice(0,100),state=make({month:120,seenEvents:['cn_longmarch_coup'],eventMonths:{cn_longmarch_coup:110},territoryOverrides:{[units[0].id]:{controller:'群星自治联盟',controllerId:'stars',month:118,source:'personal_action'}},factionConflicts:{stars:'中国内战'}});
 assert.equal(deriveTerritorySituation(state,units[0],lore).ownerId,'stars');
 const rows=units.slice(1).map(unit=>deriveTerritorySituation(state,unit,lore));assert.ok(rows.every(row=>row.simulation.candidateIds.includes('stars')));assert.ok(rows.some(row=>row.ownerId==='stars'));assert.ok(rows.some(row=>row.frontline&&row.attackerId==='stars'));
 const future={...state,territoryOverrides:{[units[0].id]:{...state.territoryOverrides[units[0].id],month:130}},factionConflicts:{}};assert.equal(deriveTerritorySituation(future,units[1],lore).simulation.candidateIds.includes('stars'),false);
});
test('specific war names survive the country catalog generic opening conflict',()=>{
 const state=make(),prepared=createTerritoryContext(state,lore);
 for(const unit of afg.slice(0,30))for(const view of [undefined,prepared]){const row=deriveTerritorySituation(state,unit,lore,view);assert.equal(row.conflict,'阿富汗战争');assert.doesNotMatch(JSON.stringify(row.description),/开局/);}
});
