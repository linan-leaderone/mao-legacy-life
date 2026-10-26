import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {birthplaceAuthorities,birthplaceOptions,birthplaceSelectionForUnit,defaultNationality} from '../src/birthplace.js';
import {geographyUnits,getGeographyUnit,resolveTerritoryTargets} from '../src/geography.js';
import {createGame,exportSave,importSave,nextContext} from '../src/engine.js';
import {regionContext} from '../src/regions.js';
import {deriveTerritorySituation,createTerritoryContext,territoryExposure} from '../src/world-territories.js';
import {selectFactionFlag} from '../src/faction-flags.js';
import {getCountryContext} from '../src/countries.js';

const make=(extra={})=>createGame({name:'林远',age:22,place:'上海',background:'ordinary',seed:'opening-113',points:{intelligence:5,family:5,fitness:5,appearance:5},...extra},lore);
const jinshui=resolveTerritoryTargets('河南郑州金水区')[0];

test('four-level opening uses a real county and preserves it through save and month',()=>{
 const selected=birthplaceSelectionForUnit(jinshui),view=birthplaceOptions(selected);
 assert.equal(view.complete,true);assert.equal(view.unit.id,jinshui.id);
 assert.equal(getGeographyUnit(selected.provinceId).name,'河南');assert.equal(getGeographyUnit(selected.cityId).name,'郑州市');
 const game=make({birthplaceId:jinshui.id,openingAuthorityId:selected.authorityId});
 assert.equal(game.location,'河南');assert.equal(game.position.unitId,jinshui.id);assert.equal(game.profile.identity.nationality,'中国（中华人民共和国）');
 const saved=importSave(exportSave(game),lore);assert.deepEqual(saved.profile.birthplace,game.profile.birthplace);assert.equal(saved.position.unitId,jinshui.id);
 const next=nextContext(game,lore,{label:'照常生活',passive:true});assert.equal(next.state.position.unitId,jinshui.id);
});
test('Taiwan and Japan skip genuinely absent levels without inventing a city or county',()=>{
 const banqiao=resolveTerritoryTargets('台湾新北板桥区')[0],tw=birthplaceOptions(birthplaceSelectionForUnit(banqiao));
 assert.equal(tw.levels[0].disabled,true);assert.equal(tw.levels[1].disabled,false);assert.equal(tw.complete,true);
 const tokyo=geographyUnits.find(row=>row.country==='JPN'&&row.role==='city'&&row.parentId==='JPN-47310658B199342310790');
 const jp=birthplaceOptions(birthplaceSelectionForUnit(tokyo));assert.equal(jp.complete,true);assert.equal(jp.levels[2].disabled,true);
 assert.equal(make({birthplaceId:banqiao.id}).profile.identity.nationality,'中国台湾（中华民国籍）');
});
test('country and controlling faction choices include Crimea and fragmented states',()=>{
 const authorities=birthplaceAuthorities();for(const id of ['country:PRK','country:RUS','faction:TAL','faction:ROJ','faction:HOU'])assert.ok(authorities.some(row=>row.id===id),id);
 const crimea=geographyUnits.find(row=>row.country==='UKR'&&row.role==='county'&&deriveTerritorySituation({month:0},row,lore).controllerTag==='SOV');
 assert.ok(crimea);assert.equal(birthplaceSelectionForUnit(crimea).authorityId,'country:RUS');
 const game=make({birthplaceId:crimea.id,openingAuthorityId:'country:RUS'});
 assert.equal(game.profile.identity.nationality,'俄罗斯');assert.equal(game.position.unitId,crimea.id);assert.equal(territoryExposure(game,game.location,lore).controllerTag,'SOV');
 assert.throws(()=>make({birthplaceId:jinshui.id,openingAuthorityId:'country:RUS'}),/控制范围/);
});
test('mixed opening evidence resolves consistently to the chosen birthplace faction',()=>{
 const unit=getGeographyUnit('AFG-17698898B53195345217503');
 const selected=birthplaceSelectionForUnit(unit,'faction:TAL');assert.equal(selected.authorityId,'faction:TAL');assert.equal(birthplaceOptions(selected).complete,true);
 const game=make({birthplaceId:unit.id,openingAuthorityId:'faction:TAL'}),context=regionContext(game,lore);
 assert.equal(game.profile.identity.nationality,'阿富汗');assert.equal(context.controllerTag,'TAL');assert.equal(context.controlUncertain,false);
 const map=deriveTerritorySituation(game,unit,lore);assert.equal(map.uncertain,false);assert.equal(map.war,true);assert.equal(map.ownerTag,'TAL');assert.deepEqual(map.mixedControllers,[]);
});
test('explicit citizenship survives a new location; unknown birthplace IDs fail cleanly',()=>{
 const game=make({birthplaceId:jinshui.id,identity:{nationality:'火星联邦'}});
 assert.equal(game.profile.identity.nationality,'火星联邦');assert.equal(nextContext(game,lore,{label:'我已经搬到法国巴黎',custom:true}).state.profile.identity.nationality,'火星联邦');
 assert.throws(()=>make({birthplaceId:'county:invented'}),/无法识别/);
});
test('North Korea current map and local context use final history, and later changes win',()=>{
 const game=make({place:'朝鲜'}),context=regionContext(game,lore),map=deriveTerritorySituation(game,'country:PRK',lore);
 assert.match(context.government,/法西斯/);assert.match(map.government,/法西斯/);assert.equal(context.ideologyId,'jucheism');
 const changed={...game,worldOverrides:{[context.region]:{government:'新共和国议会制',ideology:'民主社会主义',leader:'代表会议',factionId:'new-republic',month:0}}};
 assert.match(deriveTerritorySituation(changed,'country:PRK',lore).government,/新共和国/);
 assert.doesNotMatch(regionContext(changed,lore).government,/法西斯/);
});
test('a local occupation cannot replace the entire country dossier',()=>{
 const unit=resolveTerritoryTargets('台湾新北板桥区')[0],game=make({birthplaceId:unit.id});
 game.territoryOverrides[unit.id]={controller:'星海联盟',controllerId:'star-sea',month:0,source:'personal_action'};
 assert.match(regionContext(game,lore).government,/星海/);
 const prepared=createTerritoryContext(game,lore),national=deriveTerritorySituation(game,'country:TWN',lore,prepared);
 assert.doesNotMatch(national.government,/星海/);assert.match(national.government,/总统/);
});
test('flags follow established successor factions and explicit new factions use an adapted mark',()=>{
 const game=make({place:'日本'});game.month=50;game.seenEvents=['jp_hazawa_end'];game.eventMonths={jp_hazawa_end:50};
 const left=deriveTerritorySituation(game,'country:JPN',lore),flag=selectFactionFlag(left.flagContext);
 assert.equal(left.controllerId,'japan_left');assert.equal(flag.sourceTag,'TSU');assert.equal(flag.adapted,false);
 const unit=jinshui;game.territoryOverrides[unit.id]={controller:'星海联盟',controllerId:'star-sea',month:50,source:'personal_action'};
 const novel=selectFactionFlag(deriveTerritorySituation(game,unit,lore).flagContext);assert.equal(novel.adapted,true);assert.ok(novel.src);
});
