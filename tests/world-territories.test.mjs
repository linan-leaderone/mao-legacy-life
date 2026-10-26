import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import lore from '../src/data/lore.json' with {type:'json'};
import {geographyUnits,geographySources,getGeographyUnit,resolveTerritoryTargets,deriveTerritorySituation,territoryExposure,createTerritoryContext,controllerColor} from '../src/world-territories.js';

const state=(patch={})=>({month:48,location:'河南',profile:{name:'林青'},seenEvents:[],seenNews:[],newsHistory:[],eventMonths:{},worldOverrides:{},worldDynamics:{},...patch});
const district=getGeographyUnit('TWN-52511910B6389603869041');

test('atlas contains offline geographic counties and municipalities, not fabricated grids',()=>{
  const expected={'CHN-ADM3':2864,'JPN-ADM2':1742,'TWN-ADM2':368,'KOR-ADM2':228};
  for(const [level,count] of Object.entries(expected))assert.equal(geographyUnits.filter(u=>u.level===level).length,count);
  assert.equal(geographyUnits.filter(u=>u.level==='world').length,177);
  const ids=new Set();for(const u of geographyUnits){assert.ok(!ids.has(u.id));ids.add(u.id);assert.ok(u.bounds[0]<=u.center[0]&&u.center[0]<=u.bounds[2]);assert.ok(u.bounds[1]<=u.center[1]&&u.center[1]<=u.bounds[3]);assert.ok(u.source);}
});

test('all bundled polygons resolve to a geographic record and retain valid closed rings',()=>{
  for(const filename of ['world-boundaries.json','asia-boundaries.json']){
    const data=JSON.parse(fs.readFileSync(new URL('../public/maps/'+filename,import.meta.url),'utf8'));
    for(const [id,polygons] of Object.entries(data.features)){
      assert.ok(getGeographyUnit(id));assert.ok(polygons.length);
      for(const poly of polygons)for(const ring of poly){assert.ok(ring.length>=8&&ring.length%2===0);let x=0,y=0;for(let i=0;i<ring.length;i+=2){x+=ring[i];y+=ring[i+1];assert.ok(Math.abs(x)<=180*data.scale+2);assert.ok(Math.abs(y)<=90*data.scale+2);}assert.equal(x,ring[0]);assert.equal(y,ring[1]);}
    }
  }
});

test('source metadata states differing reference years, actual counts and licences',()=>{
  assert.equal(geographySources.find(s=>s.id==='CHN-ADM3').year,'2017');
  assert.equal(geographySources.find(s=>s.id==='KOR-ADM2').year,'2020');
  assert.match(geographySources.find(s=>s.id==='CHN-ADM3').license,/Database/);
  assert.ok(geographySources.find(s=>s.id==='CHN-ADM3').reportedCount!==2864);
});

test('county names resolve in simplified or traditional Chinese without crossing regions',()=>{
  assert.equal(resolveTerritoryTargets('我占领了台湾板桥区',{region:'taiwan'})[0].id,district.id);
  assert.deepEqual(resolveTerritoryTargets('台湾板桥区').map(u=>u.id),[district.id]);
  assert.deepEqual(resolveTerritoryTargets('中国台湾板橋區').map(u=>u.id),[district.id]);
  assert.deepEqual(resolveTerritoryTargets('新北市板橋區').map(u=>u.id),[district.id]);
  assert.deepEqual(resolveTerritoryTargets('我占领河南').map(u=>u.id),['province:河南']);
  assert.equal(resolveTerritoryTargets('鹿寨县')[0].parent,'广西');
  assert.deepEqual(resolveTerritoryTargets('中正区',{region:'taiwan'}),[]);
  assert.deepEqual(resolveTerritoryTargets('台湾鬼谷县'),[]);
  assert.deepEqual(resolveTerritoryTargets('河南幸福县'),[]);
  assert.deepEqual(resolveTerritoryTargets('台湾全境').map(u=>u.id),['country:TWN']);
});

test('opening Taiwan and Japan remain civilian and preserve their own governments',()=>{
  for(const id of ['country:TWN','country:JPN']){const s=deriveTerritorySituation(state({month:0}),id,lore);assert.equal(s.war,false);assert.ok(s.government);}
});

test('a Taiwan left victory changes current controller and ideology, with no old DPP government',()=>{
  const s=state({seenEvents:['tw_civil_war','tw_left_end'],eventMonths:{tw_civil_war:30,tw_left_end:40}});
  const value=deriveTerritorySituation(s,district,lore);
  assert.match(value.controller,/左翼/);assert.doesNotMatch(value.ideology,/社会自由|民进党/);assert.equal(value.war,false);
  const old=deriveTerritorySituation(state({month:0}),district,lore);assert.notEqual(old.controllerId,value.controllerId);assert.notEqual(controllerColor(old.controllerId),controllerColor(value.controllerId));
});

test('uncertain civil-war local control is visibly uncertain, not randomly assigned',()=>{
  const s=state({seenEvents:['tw_civil_war'],eventMonths:{tw_civil_war:30}}),before=JSON.stringify(s);
  const first=deriveTerritorySituation(s,district,lore),second=deriveTerritorySituation(s,district,lore);
  assert.equal(first.uncertain,true);assert.match(first.controller,/争夺/);assert.equal(first.frontline,false);assert.deepEqual(first,second);assert.equal(JSON.stringify(s),before);
});

test('precise ownership takes priority over region and province overlays',()=>{
  const s=state({territoryOverrides:{'country:TWN':{controller:'甲'},'region:taiwan':{controller:'乙'},[district.id]:{controller:'丙',controllerId:'third',month:45}}});
  const value=deriveTerritorySituation(s,district,lore);assert.equal(value.controller,'丙');assert.equal(value.controllerId,'third');assert.equal(value.month,45);
});

test('occupation displays the controller ideology instead of the previous local regime',()=>{
  const left=deriveTerritorySituation(state({month:0,territoryOverrides:{[district.id]:{controller:'左翼联盟',controllerId:'taiwan_left',month:0}}}),district,lore);
  assert.match(left.ideology,/社会主义/);assert.doesNotMatch(left.ideology,/社会自由/);assert.doesNotMatch(left.government,/总统制/);
  const china=deriveTerritorySituation(state({territoryOverrides:{[district.id]:{controller:'大陆接管当局',controllerId:'china',month:48}}}),district,lore);
  assert.match(china.ideology,/市场毛主义/);assert.match(china.government,/中国共产党/);
  const unknown=deriveTerritorySituation(state({territoryOverrides:{[district.id]:{controller:'星海联邦',controllerId:'star-sea',month:48}}}),district,lore);
  assert.equal(unknown.ideology,null);assert.match(unknown.government,/尚待确认/);assert.doesNotMatch(unknown.government,/民进党/);
});

test('an entire belligerent controls affected territory, not only declared frontlines',()=>{
  const s=state({territoryOverrides:{[district.id]:{controller:'山海联邦',controllerId:'shanhai',frontline:false}},factionConflicts:{shanhai:'联邦边境战争'}});
  const rear=deriveTerritorySituation(s,district,lore);assert.equal(rear.war,true);assert.equal(rear.frontline,false);assert.equal(rear.severity,.45);
  const front=deriveTerritorySituation({...s,territoryOverrides:{[district.id]:{...s.territoryOverrides[district.id],frontline:true}}},district,lore);assert.equal(front.severity,1);assert.equal(front.frontline,true);
});

test('mainland during strait war has war exposure, remote Japan is not automatically a frontline',()=>{
  const s=state({seenEvents:['world_strait_war'],eventMonths:{world_strait_war:21}});
  assert.equal(territoryExposure(s,'河南',lore).severity,.45);assert.equal(territoryExposure(s,'日本',lore).severity,0);assert.equal(territoryExposure(s,'中国台湾',lore).frontline,false);
});

test('known peace removes stale frontline overlays and war exposure',()=>{
  const s=state({seenEvents:['world_strait_war','world_strait_end'],territoryOverrides:{[district.id]:{controller:'某地政府',conflict:'旧战争',frontline:true}},worldDynamics:{lastingPeace:true}});
  const value=deriveTerritorySituation(s,district,lore);assert.equal(value.war,false);assert.equal(value.frontline,false);assert.equal(value.severity,0);
});

test('explicit faction ceasefire suppresses obsolete territory conflict',()=>{
  const s=state({territoryOverrides:{[district.id]:{controller:'新政府',controllerId:'new',conflict:'旧战争',frontline:true}},factionConflicts:{new:null}});
  assert.equal(deriveTerritorySituation(s,district,lore).conflict,null);
});

test('prepared atlas projection and individual lookup agree without state mutation',()=>{
  const s=state({worldOverrides:{taiwan:{leader:'新的临时政府',government:'新政府',ideology:'社会民主主义',conflict:'台湾内战'}},territoryOverrides:{[district.id]:{frontline:true}}}),before=JSON.stringify(s),prepared=createTerritoryContext(s,lore);
  assert.deepEqual(deriveTerritorySituation(s,district,lore,prepared),deriveTerritorySituation(s,district,lore));assert.equal(JSON.stringify(s),before);
});
