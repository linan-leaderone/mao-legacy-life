import test from 'node:test';
import assert from 'node:assert/strict';
import {territoryActionChanges,validateTerritorialState} from '../src/territory-actions.js';
import {deriveTerritorySituation} from '../src/world-territories.js';
import lore from '../src/data/lore.json' with {type:'json'};
const county='AFG-17698898B88962028797570';
const state=()=>({id:'p',seed:'frontline-review',month:0,location:'阿富汗',profile:{name:'林青',identity:{nationality:'中国'}},person:{},seenEvents:[],seenNews:[],newsHistory:[],eventMonths:{},worldOverrides:{},worldDynamics:{},territoryOverrides:{[county]:{controllerId:'faction:AFG',controller:'阿富汗共和国政府',month:0,source:'personal_action'}}});

test('an explicit attack preserves the defender and records the named invader until peace',()=>{
  const s=state();
  const [change]=territoryActionChanges(s,{custom:true,label:'我率领塔利班在Kohsan交战'});
  assert.equal(change.patch.controllerId,undefined);
  Object.assign(s.territoryOverrides[county],change.patch);
  validateTerritorialState(s);
  const result=deriveTerritorySituation(s,county,lore);
  assert.equal(result.ownerId,'faction:AFG');assert.equal(result.attackerId,'faction:TAL');assert.equal(result.frontline,true);
  Object.assign(s.territoryOverrides[county],territoryActionChanges(s,{custom:true,label:'Kohsan已经停火'})[0].patch);
  const peace=deriveTerritorySituation(s,county,lore);
  assert.equal(peace.ownerId,'faction:AFG');assert.equal(peace.attackerId,null);assert.equal(peace.frontline,false);
});

test('an unspecified battle never turns nationality into its attacking faction',()=>{
  const s=state(),change=territoryActionChanges(s,{custom:true,label:'我在Kohsan交战'})[0];
  assert.equal(change.patch.attackerId,undefined);
  for(const label of ['我没有进攻Kohsan','我计划进攻Kohsan','如果我进攻Kohsan'])assert.deepEqual(territoryActionChanges(s,{custom:true,label}),[]);
});

test('malformed attacker metadata is rejected when loading a save',()=>{
  const s=state();s.territoryOverrides[county].attackerId={name:'wrong'};
  assert.throws(()=>validateTerritorialState(s),/领土变更记录/);
});
