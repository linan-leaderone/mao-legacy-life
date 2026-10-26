import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,nextContext,localEvent,advance,exportSave,importSave} from '../src/engine.js';
import {getPlayerPosition,movementFromAction} from '../src/player-position.js';
import {getGeographyUnit,geographyAncestors,resolveTerritoryTargets} from '../src/geography.js';
import {regionContext} from '../src/regions.js';
import {territoryExposure} from '../src/world-territories.js';

const start=()=>createGame({name:'林远',age:25,place:'河南',background:'ordinary',freedom:'unlimited',seed:'global-location-112',points:{intelligence:5,family:5,fitness:5,appearance:5}},lore);
const action=label=>({label,custom:true});
function step(s,label){const a=action(label),c=nextContext(s,lore,a);return advance(s,a,localEvent(c.state,lore,a),null,lore);}

test('opening province is an honest area marker, never a fabricated exact county',()=>{
 const s=start(),p=getPlayerPosition(s);assert.equal(p.unitId,'province:河南');assert.equal(p.precision,'province');assert.ok(p.coordinates.every(Number.isFinite));
 const before=JSON.stringify(s);getPlayerPosition(s);assert.equal(JSON.stringify(s),before);
});
test('completed local travel preserves county precision and follows real hierarchy',()=>{
 const s=start(),next=step(s,'我搬到河南郑州市金水区生活');
 assert.equal(next.location,'河南');assert.equal(getGeographyUnit(next.position.unitId).name,'金水区');assert.equal(next.position.precision,'county');
 const chain=geographyAncestors(next.position.unitId);assert.ok(chain.some(u=>u.role==='city'));assert.ok(chain.some(u=>u.id==='province:河南'));
 assert.equal(s.position.precision,'province');assert.equal(importSave(exportSave(next),lore).position.unitId,next.position.unitId);
});
test('Taiwan and France destinations change map identity, not only the narrative',()=>{
 let s=step(start(),'我搬到了台湾新北市板桥区生活');assert.equal(s.location,'中国台湾');assert.equal(getGeographyUnit(s.position.unitId).country,'TWN');assert.match(s.position.label,/板橋|板桥/);
 s=step(s,'我前往法国巴黎工作');assert.equal(getGeographyUnit(s.position.unitId).country,'FRA');assert.equal(getGeographyUnit(s.position.unitId).name,'Paris');assert.equal(s.position.precision,'county');assert.equal(regionContext(s,lore).region,'fra');
});
test('plans, negations, other people and remote orders never relocate the person',()=>{
 const s=start();for(const label of ['我不去法国','我计划搬到日本','如果我前往台湾，我会在那里工作','朋友搬到法国巴黎生活','我命令部队前往台湾','我去帮助法国结束内战'])assert.equal(movementFromAction(s,action(label)),null,label);
});

test('ordinary activities after go do not become invented geographic destinations',()=>{
 const s=start();for(const label of ['我去跑步','我去散步','我去上课','我去吃饭','I went to sleep'])assert.equal(movementFromAction(s,action(label)),null,label);
 assert.equal(movementFromAction(s,action('我前往卡美洛王国')).location,'卡美洛王国');
});
test('English movement is resolved without matching a country inside another word',()=>{
 const s=start(),p=movementFromAction(s,action('I moved to France'));assert.equal(getGeographyUnit(p.position.unitId).country,'FRA');
 assert.equal(resolveTerritoryTargets('Romania').some(u=>u.country==='OMN'),false);
});
test('an unknown place and an ocean do not acquire a random Earth point',()=>{
 const s=step(start(),'我瞬移到纳美克星');assert.equal(s.location,'纳美克星');assert.equal(s.position.precision,'unknown');assert.equal(s.position.coordinates,null);
 const sea=step(start(),'我前往太平洋生活');assert.equal(sea.position.precision,'ocean');assert.equal(sea.position.coordinates,null);
});
test('passive months retain precision, time travel uses the new date, old saves migrate',()=>{
 let s=step(start(),'我搬到台湾板桥区生活');const id=s.position.unitId;
 const a={label:'照常生活',passive:true},c=nextContext(s,lore,a);s=advance(s,a,localEvent(c.state,lore,a),null,lore);assert.equal(s.position.unitId,id);
 s=step(s,'我穿越到1976年');assert.equal(s.position.unitId,id);assert.equal(s.position.month,s.month);assert.equal(importSave(exportSave(s),lore).position.unitId,id);
 delete s.position;assert.ok(importSave(exportSave(s),lore).position);s.position={unitId:id,label:'地点',coordinates:[999,50],month:s.month};assert.throws(()=>importSave(exportSave(s),lore),/所在地/);
});
test('precise whereabouts control local exposure; previews and failed actions do not commit',()=>{
 const s=step(start(),'我搬到台湾板桥区生活');s.territoryOverrides[s.position.unitId]={controller:'地方守军',controllerId:'local',conflict:'地方交战',frontline:true,month:s.month};
 assert.equal(territoryExposure(s,s.location,lore).frontline,true);
 const before=JSON.stringify(s);const c=nextContext(s,lore,action('我前往法国巴黎工作'));assert.equal(getGeographyUnit(c.state.position.unitId).country,'FRA');assert.equal(JSON.stringify(s),before);
});

test('third-party trips, invitations, future travel and local errands never move the player',()=>{
 const s=start();
 for(const label of ['张三搬到日本','我邀请张三去日本','我看见朋友搬到法国','我的朋友已经抵达法国','He moved to France','My friend moved to Paris','I watched Alice move to France','I will move to France','I did not move to France',"I didn't move to France",'我准备回到日本','我想飞往日本','我以后去日本','我今天去菜市场买菜','我去日本料理店吃饭'])assert.equal(movementFromAction(s,action(label)),null,label);
 assert.equal(getGeographyUnit(movementFromAction(s,action('我到了日本')).position.unitId).country,'JPN');
 const mixed=movementFromAction(s,action('我搬到日本，然后张三搬到法国'));
 assert.equal(getGeographyUnit(mixed.position.unitId).country,'JPN');
});

test('explicit country context wins over city aliases and cross-country homonyms',()=>{
 const s=start(),p=movementFromAction(s,action('我搬到美国巴黎'));
 assert.equal(getGeographyUnit(p.position.unitId).country,'USA');
 assert.deepEqual(resolveTerritoryTargets('Georgia'),[]);
 assert.equal(resolveTerritoryTargets('USA Georgia')[0].country,'USA');
 assert.equal(resolveTerritoryTargets('Georgia Tbilisi')[0].country,'GEO');
 assert.equal(resolveTerritoryTargets('China')[0].country,'CHN');
 assert.deepEqual(resolveTerritoryTargets('I became the president of France.').map(row=>row.country),['FRA']);
 assert.deepEqual(resolveTerritoryTargets('印度尼西亚').map(row=>row.country),['IDN']);
 assert.deepEqual(new Set(resolveTerritoryTargets('印度和印度尼西亚').map(row=>row.country)),new Set(['IND','IDN']));
});

test('a stale saved point cannot contradict its recorded regional location',()=>{
 const s=start();s.position={unitId:'country:TWN',label:'台湾',coordinates:[121,24],precision:'country',month:0,source:'save',locationSnapshot:'河南'};
 assert.equal(getPlayerPosition(s).unitId,'province:河南');
 assert.equal(importSave(exportSave(s),lore).position.unitId,'province:河南');
});
