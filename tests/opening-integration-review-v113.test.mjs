import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createTerritoryContext,deriveTerritorySituation,geographyUnits} from '../src/world-territories.js';
import {territoryActionChanges} from '../src/territory-actions.js';
import {selectFactionFlag} from '../src/faction-flags.js';

const state=(patch={})=>({id:'review',month:0,location:'法国',profile:{name:'林青'},seenEvents:[],seenNews:[],newsHistory:[],eventMonths:{},worldOverrides:{},worldDynamics:{},...patch});

test('a MOD belligerent has the same war exposure in individual and prepared map projections',()=>{
 const s=state({territoryOverrides:{'country:FRA':{controller:'塔利班',controllerId:'faction:TAL',month:0,source:'personal_action'}}});
 const individual=deriveTerritorySituation(s,'country:FRA',lore);
 const prepared=deriveTerritorySituation(s,'country:FRA',lore,createTerritoryContext(s,lore));
 assert.equal(individual.conflict,prepared.conflict);
 assert.equal(individual.war,true);
 assert.equal(individual.severity,prepared.severity);
});

test('a new civil war cannot silently preserve exclusive 2020 control of the entire country',()=>{
 const s=state({location:'日本',month:30,worldOverrides:{japan:{conflict:'日本内战',stage:'civil_war',source:'player',month:30}}});
 const situation=deriveTerritorySituation(s,'country:JPN',lore);
 assert.equal(situation.war,true);
 assert.equal(situation.uncertain,true);
 assert.notEqual(situation.controllerId,'japan_ldp');
 const local=deriveTerritorySituation(s,geographyUnits.find(unit=>unit.country==='JPN'&&unit.role==='city'),lore);
 assert.equal(local.uncertain,false);assert.ok(['japan_left','japan_toyokawa'].includes(local.ownerId));
});

test('helping a named existing MOD faction take territory retains its official identity and government',()=>{
 const s=state(),changes=territoryActionChanges(s,{custom:true,label:'我帮助塔利班占领法国'});
 assert.equal(changes.length,1);
 s.territoryOverrides=Object.fromEntries(changes.map(change=>[change.unitId,change.patch]));
 const situation=deriveTerritorySituation(s,'country:FRA',lore);
 assert.equal(situation.controllerTag,'TAL');
 assert.match(situation.government,/神权/);
 assert.equal(selectFactionFlag(situation.flagContext).adapted,false);
 const previousGovernment=state({location:'中国台湾',worldOverrides:{taiwan:{leader:'此前的新政府',government:'新的行政体系',month:0}},territoryOverrides:{'country:TWN':changes[0].patch}});
 const takeover=deriveTerritorySituation(previousGovernment,'country:TWN',lore);
 assert.equal(takeover.controllerTag,'TAL');
 assert.equal(selectFactionFlag(takeover.flagContext).adapted,false,'previous local player changes do not make a known occupying faction invented');
});

test('territory projections survive JSON round trips and ended MOD faction wars stay ended abroad',()=>{
 const s=state({worldOverrides:{afg:{conflict:null,month:0}},territoryOverrides:{'country:FRA':{controller:'塔利班',controllerId:'faction:TAL',month:0,source:'personal_action'}}});
 for(const prepared of [undefined,createTerritoryContext(s,lore)]){
  const situation=deriveTerritorySituation(s,'country:FRA',lore,prepared);
  assert.equal(situation.war,false);
  assert.deepEqual(JSON.parse(JSON.stringify(situation)),situation);
 }
 const opening=deriveTerritorySituation(state(),'country:FRA',lore);
 assert.deepEqual(JSON.parse(JSON.stringify(opening)),opening);
});
