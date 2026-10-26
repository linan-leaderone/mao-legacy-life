import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTerritoryTargets,searchGeographyUnits} from '../src/geography.js';

const namedUnits={
  克里米亚:'UKR-14850775B24260608407062',
  塞瓦斯托波尔:'UKR-14850775B70667807354554',
  哈塞克:'SYR-27442178B13029247631939',
  伊德利卜:'SYR-27442178B9567094438554',
  阿夫林:'SYR-27442178B88911382861768',
  喀布尔:'AFG-17698898B53195345217503',
  坎大哈:'AFG-17698898B3536630965398',
  萨那:'YEM-18629408B48104637123824',
  亚丁:'YEM-18629408B11945654439238',
};

test('Chinese conflict-area place names resolve to the same real administrative IDs used by opening control',()=>{
  for(const [name,id] of Object.entries(namedUnits)){
    assert.deepEqual(resolveTerritoryTargets(name).map(u=>u.id),[id],name);
    assert.ok(searchGeographyUnits(name).some(u=>u.id===id),name);
  }
  assert.deepEqual(resolveTerritoryTargets('前往克里米亞').map(u=>u.id),[namedUnits.克里米亚]);
  assert.deepEqual(resolveTerritoryTargets('我搬到了喀布爾').map(u=>u.id),[namedUnits.喀布尔]);
});

test('explicit province suffixes distinguish capitals from their surrounding province',()=>{
  const provinces={喀布尔省:'AFG-12653393B60423242182357',坎大哈省:'AFG-12653393B40111500734429',
    哈塞克省:'SYR-8384693B3351094574159',伊德利卜省:'SYR-8384693B38455082445791',萨那省:'YEM-18629408B64822604790923'};
  for(const [name,id] of Object.entries(provinces))assert.deepEqual(resolveTerritoryTargets(name).map(u=>u.id),[id],name);
});

test('a control-related place alias does not rewrite atlas country identity or bypass explicit country filters',()=>{
  assert.equal(resolveTerritoryTargets('克里米亚')[0].country,'UKR');
  assert.equal(resolveTerritoryTargets('塞瓦斯托波尔')[0].country,'UKR');
  assert.deepEqual(resolveTerritoryTargets('克里米亚',{country:'RUS'}),[]);
  assert.ok(!resolveTerritoryTargets('俄罗斯克里米亚').some(u=>u.id===namedUnits.克里米亚));
});
