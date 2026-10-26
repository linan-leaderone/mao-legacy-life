import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {openingControlForUnit,openingFactions,openingFactionsForCountry,getOpeningFaction,openingFactionUnits} from '../src/opening-control.js';
import {geographyUnits,getGeographyUnit} from '../src/geography.js';

const control=JSON.parse(fs.readFileSync(new URL('../src/data/opening-control.json',import.meta.url),'utf8'));
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/countries.json',import.meta.url),'utf8'));
const find=(country,name,role)=>geographyUnits.find(u=>u.country===country&&u.name===name&&(!role||u.role===role));

test('opening control keeps real administrative IDs and records ambiguity instead of inventing county borders',()=>{
  for(const [id,row] of Object.entries(control.unitControls)){
    assert.ok(getGeographyUnit(id),id);
    assert.ok(row.stateIds.length,id);
    assert.ok(row.controllers.length,id);
    for(const part of row.controllers)assert.ok(catalog.tags[part.tag],part.tag);
    if(row.tag)assert.equal(row.controllers[0].tag,row.tag,id);
    if(row.controllers.length>1)assert.ok(row.uncertain||row.controllers[0].share>=.88,id);
  }
  assert.ok(control.counts.mappedUnits>2000);
  assert.ok(control.counts.mixedOrUncertainUnits>0);
});

test('Crimea and Sevastopol use Russian opening control while preserving the atlas geographic identity',()=>{
  for(const name of ['Autonomous Republic of Crimea','Sevastopol']){
    const province=find('UKR',name,'province'),row=openingControlForUnit(province);
    assert.equal(row.tag,'SOV');assert.equal(row.country,'RUS');assert.equal(row.geographicCountry,'UKR');
    assert.equal(row.uncertain,false);assert.equal(row.frontline,false);
    const children=geographyUnits.filter(u=>u.parentId===province.id);
    assert.ok(children.length>0);
    for(const unit of children)assert.equal(openingControlForUnit(unit).tag,'SOV',unit.name);
    assert.ok(getOpeningFaction('SOV').controlledUnitIds.includes(province.id));
  }
  assert.ok(openingFactionsForCountry('UKR').some(f=>f.tag==='SOV'));
  assert.ok(openingFactionUnits('faction:SOV').some(u=>u.name==='Simferopol'));
});

test('Syria has separate government, HTS, Rojava and Turkish-controlled areas, not an active FSA placeholder',()=>{
  const tags=openingFactionsForCountry('SYR').map(f=>f.tag);
  for(const tag of ['SYR','HTS','ROJ','TUR'])assert.ok(tags.includes(tag),tag);
  assert.ok(!tags.includes('FSA'));
  const hasakah=openingControlForUnit(find('SYR','Al-Hasakeh','county'));
  assert.equal(hasakah.tag,'ROJ');assert.equal(hasakah.seatTag,'ROJ');
  assert.equal(hasakah.government,catalog.tags.ROJ.government);
  const idlib=openingControlForUnit(find('SYR','Idleb','county'));
  assert.equal(idlib.seatTag,'HTS');assert.ok(idlib.mixedControllers.some(x=>x.tag==='HTS'));
  assert.equal(openingControlForUnit('country:SYR').tag,null);
});

test('Afghanistan preserves province controller overrides and government/Taliban coexistence',()=>{
  assert.equal(catalog.openingStates.find(s=>s.id===1055).provinceControllers['13743'],'AFG');
  const kandahar=openingControlForUnit(find('AFG','Kandahar','county'));
  assert.equal(kandahar.seatTag,'TAL');assert.equal(kandahar.uncertain,true);
  assert.ok(kandahar.mixedControllers.some(x=>x.tag==='AFG'));
  const kabul=openingControlForUnit(find('AFG','Kabul','county'));
  assert.equal(kabul.seatTag,'AFG');assert.equal(kabul.conflict,'阿富汗战争');
  assert.equal(getOpeningFaction('TAL').country,'AFG');
  assert.ok(getOpeningFaction('TAL').possibleUnitIds.includes(kandahar.unitId));
  assert.equal(kabul.frontline,false,'being at war does not prove a battle in this county');
});

test('Yemen has three distinct named factions, wars and shared administrative areas',()=>{
  const factions=openingFactionsForCountry('YEM').filter(f=>['YEM','HOU','AAS'].includes(f.tag));
  assert.equal(factions.length,3);assert.equal(new Set(factions.map(f=>f.name)).size,3);
  for(const f of factions)assert.equal(f.conflict,'也门内战');
  const sanaa=openingControlForUnit(find('YEM','Old City','county'));
  assert.equal(sanaa.tag,null);assert.ok(sanaa.mixedControllers.some(x=>x.tag==='HOU'));
  assert.equal(sanaa.frontline,false);
  assert.ok(control.unitControls[find('YEM','‘Adan Governorate','province').id].controllers.some(x=>x.tag==='AAS'));
});

test('ZZZ transfer to BYA survives control projection and does not become a Russian birthplace',()=>{
  assert.equal(catalog.openingStates.find(s=>s.id===1374).controllerTag,'BYA');
  const faction=getOpeningFaction('BYA');assert.ok(faction);assert.equal(faction.country,'UKR');
  assert.ok(faction.controlledUnitIds.length+faction.possibleUnitIds.length>0);
  assert.ok(faction.opponents.includes('DPR'));assert.equal(faction.conflict,'顿巴斯战事');
});

test('Cyprus and Brussels preserve sub-county political divisions instead of filling their whole city',()=>{
  const nicosia=openingControlForUnit(find('CYP','Nicosia','province'));
  assert.equal(nicosia.tag,null);assert.deepEqual(nicosia.mixedControllers.map(x=>x.tag).sort(),['CYP','TUR']);
  const kyrenia=openingControlForUnit(find('CYP','Kyrenia','province'));assert.equal(kyrenia.tag,'TUR');
  const brussels=openingControlForUnit(find('BEL','Brussels','county'));
  assert.equal(brussels.tag,null);assert.ok(brussels.mixedControllers.some(x=>x.tag==='BRS'));
});

test('baseline lookups are pure and unavailable before the 2020 timeline',()=>{
  const unit=find('AFG','Kabul','county'),snapshot=JSON.stringify(unit);
  assert.equal(openingControlForUnit(unit,{month:-1}),null);
  assert.equal(openingControlForUnit('missing-unit'),null);
  openingControlForUnit(unit,{month:50});assert.equal(JSON.stringify(unit),snapshot);
  const france=openingControlForUnit('country:FRA');assert.equal(france.tag,'FRA');
  assert.ok(openingFactions.length>=187);
});
