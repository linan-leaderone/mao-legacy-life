import test from 'node:test';
import assert from 'node:assert/strict';
import {ATLAS_SCOPES,atlasAncestors,createAtlasNavigation,selectAtlasLayers,unionAtlasBounds,atlasLongitudeNear} from '../src/atlas-navigation.js';

const unit=(id,role,parentId,bounds,extra={})=>({id,role,parentId,bounds,country:'CHN',name:id,continent:'Asia',subregion:'Eastern Asia',layer:`CHN-${role}`,...extra});
const units=[
  unit('country:CHN','country',null,[70,0,130,50]),
  unit('henan','province','country:CHN',[110,30,116,36]),
  unit('zhengzhou','city','henan',[112,32,115,35]),
  unit('jinshui','county','zhengzhou',[113,33,114,34]),
  unit('erqi','county','zhengzhou',[112,32,113,33]),
  unit('country:JPN','country',null,[135,30,145,45],{country:'JPN'}),
  unit('tokyo','province','country:JPN',[138,34,141,37],{country:'JPN'}),
  unit('shinjuku','city','tokyo',[139,35,140,36],{country:'JPN'}),
];
const manifest={continents:{Asia:{name:'亚洲',bounds:[20,-12,180,80]}},subregions:{'Eastern Asia':{name:'东亚',bounds:[70,0,150,60]}},layers:[{id:'world',role:'country'}]};
const position={unitId:'jinshui',precision:'county',label:'河南郑州金水区',coordinates:[113.5,33.5]};
const situation=u=>({controllerId:u.id==='jinshui'?'local':'national',controller:u.id==='jinshui'?'当地联盟':'中央政府',uncertain:false});
const nav=patch=>createAtlasNavigation({units,position,manifest,situation,...patch});

test('seven scopes use the player ancestor chain and never a search selection',()=>{
  assert.deepEqual(ATLAS_SCOPES.map(row=>row.id),['world','continent','subregion','faction','province','city','county']);
  const before=JSON.stringify({units,position,manifest});
  const result=nav({selection:'shinjuku'});
  assert.equal(result.find(row=>row.id==='province').unitId,'henan');
  assert.equal(result.find(row=>row.id==='city').unitId,'zhengzhou');
  assert.equal(result.find(row=>row.id==='county').unitId,'jinshui');
  assert.equal(result.find(row=>row.id==='subregion').title,'东亚');
  assert.equal(JSON.stringify({units,position,manifest}),before);
});

test('a province-only location does not invent its central city or county',()=>{
  const result=nav({position:{unitId:'henan',precision:'province',coordinates:[113,33]}});
  assert.equal(result.find(row=>row.id==='province').available,true);
  for(const scope of ['city','county']){const row=result.find(item=>item.id===scope);assert.equal(row.available,false);assert.match(row.reason,/尚不能确定/);}
});

test('moving countries changes ancestors and unavailable local administrative levels',()=>{
  const result=nav({position:{unitId:'shinjuku',precision:'city'}});
  assert.equal(result.find(row=>row.id==='province').unitId,'tokyo');
  assert.equal(result.find(row=>row.id==='city').unitId,'shinjuku');
  assert.equal(result.find(row=>row.id==='county').available,false);
  assert.match(result.find(row=>row.id==='county').reason,/没有对应层级/);
});

test('ocean and unknown positions do not generate a terrestrial destination',()=>{
  for(const precision of ['ocean','unknown']){
    const result=nav({position:{unitId:null,label:'太平洋',precision,coordinates:null}});
    assert.deepEqual(result.filter(row=>row.available).map(row=>row.id),['world']);
  }
});

test('a faction occupying one county gets that county bounds, not all China',()=>{
  const result=nav({includeFaction:true}).find(row=>row.id==='faction');
  assert.equal(result.controllerId,'local');assert.deepEqual(result.bounds,[113,33,114,34]);assert.equal(result.count,1);
  const changed=nav({includeFaction:true,situation:u=>({controllerId:['jinshui','shinjuku'].includes(u.id)?'alliance':'other',controller:'跨国联盟'})}).find(row=>row.id==='faction');
  assert.deepEqual(changed.bounds,[113,33,140,36]);assert.equal(changed.count,2);
});

test('contested control does not imply a single faction scope',()=>{
  assert.equal(nav({situation:()=>({controllerId:'contested',uncertain:true})}).find(row=>row.id==='faction').available,false);
});

test('broken or cyclic parent references are bounded',()=>{
  const cyclic=[unit('a','city','b',[1,1,2,2]),unit('b','province','a',[0,0,3,3])];
  assert.equal(atlasAncestors('a',cyclic).length,2);
  assert.equal(atlasAncestors('missing',cyclic).length,0);
});

const layerManifest={layers:[{id:'world',role:'country'},...Array.from({length:12},(_,i)=>[
  {id:`X${i}-ADM1`,country:`X${i}`,role:'province',level:'ADM1',count:5,bounds:[i*2,0,i*2+2,2]},
  {id:`X${i}-ADM2`,country:`X${i}`,role:'county',level:'ADM2',count:50,bounds:[i*2,0,i*2+2,2]},
]).flat()]};

test('world overview never downloads every local polygon layer',()=>{
  assert.deepEqual(selectAtlasLayers({manifest:layerManifest,viewport:[-180,-60,180,80],scale:1}),['world']);
});

test('fragmented countries show county control at province zoom without loading the whole world',()=>{
  const fragmented=new Set(['X0','X1','X2','X3','X4','X5','X6','X7']);
  assert.deepEqual(selectAtlasLayers({manifest:layerManifest,viewport:[-180,-60,180,80],scale:1,controlCountries:fragmented}),['world']);
  const countryLayers={layers:[{id:'world',role:'country'},
    {id:'AFG-ADM1',country:'AFG',role:'province',count:34,bounds:[60,29,75,39]},
    {id:'AFG-ADM2',country:'AFG',role:'county',count:400,bounds:[60,29,75,39]}]};
  assert.deepEqual(selectAtlasLayers({manifest:countryLayers,viewport:[59,28,76,40],scale:10,controlCountries:new Set(['AFG'])}),['world','AFG-ADM2']);
  assert.deepEqual(selectAtlasLayers({manifest:countryLayers,viewport:[59,28,76,40],scale:10}),['world','AFG-ADM1']);
  assert.equal(selectAtlasLayers({manifest:layerManifest,viewport:[0,0,24,2],scale:40,controlCountries:fragmented}).length,7);
});

test('close views load only intersecting countries at a bounded count',()=>{
  const chosen=selectAtlasLayers({manifest:layerManifest,viewport:[0,0,24,2],scale:60});
  assert.equal(chosen.length,7);assert.equal(chosen.filter(id=>id.endsWith('ADM2')).length,6);
  const tight=selectAtlasLayers({manifest:layerManifest,viewport:[.1,.1,1.8,1.8],scale:60});
  assert.deepEqual(tight,['world','X0-ADM2']);
});

test('an explicit search destination can request its finest layer at any scale',()=>{
  const chosen=selectAtlasLayers({manifest:layerManifest,viewport:[0,0,24,2],scale:1,focusedUnit:{layer:'X9-ADM2'}});
  assert.deepEqual(chosen,['world','X9-ADM2']);
});

test('bounds union excludes missing and malformed geometry bounds',()=>{
  assert.deepEqual(unionAtlasBounds([{bounds:[1,2,3,4]},null||{},[0,0,2,5],['bad',0,1,2]]),[0,0,3,5]);
  assert.equal(unionAtlasBounds([]),null);
});

test('European navigation does not stretch to overseas France or eastern Russia',()=>{
  const european=units.map(row=>({...row,continent:'Europe',subregion:'Western Europe'}));
  const result=createAtlasNavigation({units:european,position,manifest:{continents:{Europe:{name:'欧洲',bounds:[-70,-20,180,80]}}},situation});
  assert.deepEqual(result.find(row=>row.id==='continent').bounds,[-26,33,65,74]);
  assert.deepEqual(result.find(row=>row.id==='subregion').bounds,[-10,41,17,57]);
});

test('Pacific views cross the date line without losing western-longitude islands',()=>{
  const pacific={layers:[{id:'world',role:'country'},{id:'WSM-ADM1',country:'WSM',role:'province',level:'ADM1',count:11,bounds:[-172,-14,-171,-13]}]};
  assert.deepEqual(selectAtlasLayers({manifest:pacific,viewport:[170,-20,200,-5],scale:30}),['world','WSM-ADM1']);
  assert.equal(atlasLongitudeNear(-171,190),189);assert.equal(atlasLongitudeNear(185,-175),-175);
});
