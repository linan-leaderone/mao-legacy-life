import test from 'node:test';
import assert from 'node:assert/strict';
import catalog from '../src/data/personas-catalog.json' with {type:'json'};
import lore from '../src/data/lore.json' with {type:'json'};
import {findPersona,personaAge,isPersonaLocked,PERSONA_DATABASE_INFO} from '../src/personas.js';
import {createGame,currentAge,exportSave,importSave} from '../src/engine.js';

test('the local catalog has traceable records across all five requested areas',()=>{
  assert.ok(catalog.personas.length>9000);
  assert.equal(catalog.selection.complete,false);
  assert.equal(catalog.license,'CC0');
  assert.equal(new Set(catalog.personas.map(p=>p.id)).size,catalog.personas.length);
  for(const region of ['china','hongkong','macau','taiwan','japan'])assert.ok(catalog.counts.regions[region]>50,region);
  for(const p of catalog.personas){
    assert.ok(personaAge(p),p.name);assert.ok(personaAge(p).years<120,p.name);
    assert.ok(p.birthPlace&&p.startLocation&&p.occupation,p.name);
    assert.ok(p.sourceUrls.includes(`https://www.wikidata.org/wiki/${p.qid}`),p.name);
    assert.ok(p.notes.some(s=>s.includes('2020')),p.name);
    assert.match(p.familyBackground,/未收录|不作推定/,p.name);
  }
  assert.ok(PERSONA_DATABASE_INFO.count>=catalog.personas.length);
});

test('each catalog identity can create and reload an independent January 2020 save',()=>{
  for(const raw of catalog.personas){
    const persona=findPersona(raw.id);
    assert.ok(persona,raw.name);
    const s=createGame({name:raw.id,age:18,place:'上海',background:'ordinary',seed:raw.id},lore);
    assert.equal(s.profile.lockedPersonaId,persona.id,raw.name);
    assert.equal(s.profile.name,persona.name,raw.name);
    assert.equal(isPersonaLocked(s.profile),true,raw.name);
    assert.deepEqual(currentAge(s),personaAge(persona),raw.name);
    const loaded=importSave(exportSave(s),lore);
    assert.equal(loaded.person.occupation,s.person.occupation,raw.name);
    assert.equal(loaded.location,s.location,raw.name);
    assert.deepEqual(loaded.profile,s.profile,raw.name);
  }
});

test('common mainland, Hong Kong, Taiwan and Japanese names resolve through Chinese aliases',()=>{
  for(const name of ['周杰伦','周杰倫','成龙','成龍','宫崎骏','宮崎駿','大谷翔平','马云'])assert.ok(findPersona(name),name);
  assert.equal(findPersona('周杰伦').id,findPersona('周杰倫').id);
  assert.equal(findPersona('宫崎骏').id,findPersona('宮崎駿').id);
  assert.equal(findPersona('毛泽东').specialScenario,'mao_resurrection');
  assert.equal(findPersona('邓小平').specialScenario,'deng_ocean');
  assert.equal(findPersona('李占良').name,'李占良');
  assert.equal(findPersona('幺幺').name,'龚源浩');
});
