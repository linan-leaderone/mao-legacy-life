import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const root=new URL('../',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,root),'utf8'));
const index=read('src/data/world-geography-index.json');
const manifest=read('public/maps/manifest.json');
const byId=new Map(index.units.map(unit=>[unit.id,unit]));
const layers=new Map(manifest.layers.map(layer=>[layer.id,layer]));

test('global atlas has real country, first-level and local layers across every continent',()=>{
  assert.equal(index.version,2);
  assert.ok(index.units.length>55000);
  assert.equal(byId.size,index.units.length);
  assert.ok(manifest.coverage.length>=250);
  assert.ok(manifest.coverage.filter(row=>row.availableLevels.some(level=>level!=='ADM0')).length>=200);
  for(const country of ['USA','BRA','FRA','DEU','AUS','ZAF','RUS','IND','CHN','JPN','TWN']){
    const rows=index.units.filter(row=>row.c===country);
    assert.ok(rows.length>20,country+' has actual local units');
    assert.ok(rows.every(row=>row.c===country));
  }
  for(const id of ['country:VAT','country:MCO','country:NRU','country:TUV','country:KIR','country:TON'])assert.ok(byId.has(id),id);
  assert.equal(manifest.downloadFailures.length,0);
});

test('country and administrative parent chains cannot be redirected to dependencies',()=>{
  for(const unit of index.units){
    assert.ok(layers.has(unit.f),unit.id+' geometry layer');
    assert.ok(unit.ct&&unit.sr&&['country','province','city','county'].includes(unit.h));
    assert.ok(index.sources.some(source=>source.id===unit.l),unit.id+' attribution');
    assert.ok(unit.z[0]>=unit.b[0]-.0001&&unit.z[0]<=unit.b[2]+.0001);
    assert.ok(unit.z[1]>=unit.b[1]-.0001&&unit.z[1]<=unit.b[3]+.0001);
    let current=unit;const seen=new Set();
    while(current.pi){
      assert.ok(!seen.has(current.id),unit.id+' parent cycle');seen.add(current.id);
      const parent=byId.get(current.pi);assert.ok(parent,unit.id+' known parent');
      assert.equal(parent.c,unit.c,unit.id+' parent country');current=parent;
    }
    assert.equal(current.h,'country');
  }
  assert.equal(index.units.find(row=>row.n==='Paris'&&row.l==='FRA-ADM2').c,'FRA');
  for(const [country,layer] of [['FRA','FRA-ADM1'],['BRA','BRA-ADM1'],['AUS','AUS-ADM1'],['KAZ','KAZ-ADM1']])assert.ok(index.units.filter(row=>row.l===layer).every(row=>row.c===country));
});

test('county and equivalent units preserve meaningful local hierarchy and names',()=>{
  const district=byId.get('TWN-52511910B6389603869041');
  assert.equal(byId.get(district.pi).n,'新北市');
  const jinshui=byId.get('CHN-62558664B49429767537098');
  assert.equal(byId.get(jinshui.pi).n,'郑州市');
  assert.equal(byId.get(byId.get(jinshui.pi).pi).id,'province:河南');
  assert.equal(index.units.filter(row=>row.l==='JPN-ADM1').length,47);
  assert.equal(index.units.filter(row=>row.l==='TWN-ADM1').length,22);
  assert.equal(index.units.filter(row=>row.c==='HKG'&&row.h==='county').length,18);
  assert.ok(index.units.some(row=>row.c==='HKG'&&row.n==='沙田區'));
  assert.ok(!layers.has('CHN-ADM2'),'provider county layer must not pretend to be prefectures');
  assert.ok(layers.get('CHN-PREFECTURE').derived&&layers.get('CHN-PREFECTURE').partial);
  assert.ok(index.units.some(row=>row.c==='RUS'&&row.ct==='Asia'&&row.sr==='Northern Asia'));
});

test('every map shard is hashed, indexed and contains valid geographic rings',()=>{
  const seen=new Set();
  for(const layer of manifest.layers){
    const path=new URL('public/maps/'+layer.file,root),bytes=fs.readFileSync(path),data=JSON.parse(bytes);
    assert.equal(bytes.length,layer.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),layer.sha256);
    assert.equal(Object.keys(data.features).length,layer.count);
    for(const [id,polygons] of Object.entries(data.features)){
      assert.ok(!seen.has(id),id+' duplicate shard');seen.add(id);
      assert.equal(byId.get(id)?.f,layer.id,id+' layer mismatch');
      assert.ok(polygons.length,id+' empty geometry');
      for(const poly of polygons)for(const ring of poly){
        assert.ok(ring.length>=8&&ring.length%2===0);
        let x=0,y=0;
        for(let p=0;p<ring.length;p+=2){x+=ring[p];y+=ring[p+1];assert.ok(Number.isInteger(ring[p])&&Number.isInteger(ring[p+1]));assert.ok(Math.abs(x)<=180*data.scale+2&&Math.abs(y)<=90*data.scale+2);}
        assert.equal(x,ring[0]);assert.equal(y,ring[1]);
      }
    }
  }
  assert.equal(seen.size,index.units.length);
});

test('coverage records explicitly retain missing levels instead of claiming universal county detail',()=>{
  assert.ok(manifest.coverage.some(row=>row.finestLevel==='ADM0'));
  for(const row of manifest.coverage){
    assert.ok(row.note&&row.finestCount>0&&Array.isArray(row.missingLevels));
    assert.ok(row.availableLevels.includes(row.finestLevel));
  }
  for(const source of index.sources){assert.ok(source.license&&source.url&&source.year);}
});
