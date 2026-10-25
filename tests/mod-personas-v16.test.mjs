import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import lore from '../src/data/lore.json' with {type:'json'};
import mod from '../src/data/personas-mod.json' with {type:'json'};
import {findPersona,getPoliticalActors,lockPersonaProfile,personaAge} from '../src/personas.js';
import {regionContext,newsExposure} from '../src/regions.js';
const state=(location='日本',month=0,ids=[])=>({month,location,profile:{name:'林安'},seenEvents:ids,seenNews:[],newsHistory:[],eventMonths:Object.fromEntries(ids.map(id=>[id,month])),worldOverrides:{}});

test('fictional names are hidden exact matches with estimated ages and no invented birthdays',()=>{
  for(const name of ['美竹兰','丰川祥子','羽泽鸫','青叶摩卡','上原绯玛丽','宇田川巴']){
    const p=findPersona(name),locked=lockPersonaProfile({name,age:42,place:'北京'});
    assert.equal(p.fictional,true);assert.equal(p.birthDate,'');assert.equal(p.birthDatePrecision,'estimated');
    assert.equal(locked.place,'日本');assert.equal(locked.age,p.openingAgeEstimate);
    assert.ok(p.sourceRefs.length>=3);assert.ok(p.familyBackground.includes('未详明'));
  }
  assert.equal(findPersona('羽泽'),null);assert.equal(findPersona('美竹蘭').name,'美竹兰');
  assert.equal(personaAge(findPersona('羽泽鸫'),24).years,22);
});
test('political actors change with published stages without revealing future relationships',()=>{
  const opening=getPoliticalActors(state());const tsugumi=opening.find(p=>p.name==='羽泽鸫');
  assert.equal(tsugumi.relationships.some(r=>r.name==='陈信行'),false);
  assert.doesNotMatch(tsugumi.role,/联合军/);assert.doesNotMatch(tsugumi.ideology,/羽泽鸫主义/);
  const wartime=getPoliticalActors(state('中国台湾',28,['rs_tw_afterglow_records']));
  assert.equal(wartime.find(a=>a.name==='羽泽鸫').region,'taiwan');
  assert.ok(wartime.find(a=>a.name==='羽泽鸫').relationships.some(r=>r.name==='陈信行'));
  const civil=getPoliticalActors(state('日本',55,['jp_hazawa_toyokawa_war','jp_emergency_committee']));
  assert.match(civil.find(a=>a.name==='羽泽鸫').role,/联合军/);
  assert.match(civil.find(a=>a.name==='丰川祥子').role,/委员会/);
  assert.equal(getPoliticalActors(state('北京',-528)).length,0);
});
test('player leadership and personal identity exclude stale incumbents from active NPCs',()=>{
  const s=state('中国台湾',55);s.worldOverrides.taiwan={leader:'林安'};
  assert.equal(getPoliticalActors(s).some(a=>a.name==='蔡英文'),false);
  s.profile.name='羽泽鸫';assert.equal(getPoliticalActors(s).some(a=>a.name==='羽泽鸫'),false);
  const p=findPersona('习近平');assert.ok(p.modPolitics.ideology.includes('市场毛主义'));
  p.modPolitics.ideology='changed';assert.notEqual(findPersona('习近平').modPolitics.ideology,'changed');
});
test('all actor phases and new Taiwan reports point to actual event IDs and traceable keys',()=>{
  const events=[...lore.worldEvents,...lore.regionalStories,...lore.routes.flatMap(r=>r.milestones)],ids=new Set(events.map(e=>e.id));
  for(const a of mod.actors)for(const s of a.stages)for(const id of s.requires||[])assert.ok(ids.has(id),`${a.name}: ${id}`);
  const stories=lore.regionalStories.filter(e=>e.id.startsWith('rs_tw_'));
  for(const e of stories){for(const id of e.requires||[])assert.ok(ids.has(id),`${e.id}: ${id}`);assert.equal(e.illustrated,true);}
  const modRoot=new URL('../../TFR-xinzuo-rebuild/',import.meta.url);
  if(existsSync(modRoot))for(const record of [...mod.personas,...mod.actors,...stories])for(const source of record.sourceRefs||[]){
    if(source.file==='user-setting')continue;
    const path=new URL(source.file,modRoot);assert.ok(existsSync(path),source.file);
    assert.ok(readFileSync(path,'utf8').includes(source.key),`${record.name||record.id}: ${source.key}`);
  }
});
test('historical environments and explicit public changes replace present-day assumptions',()=>{
  for(const [place,expected]of [['北京','文化大革命'],['中国台湾','戒严'],['日本','议会民主'],['香港','英国'],['澳门','葡萄牙']]){
    const s=state(place,-528),c=regionContext(s,lore);
    assert.match(c.government,new RegExp(expected));assert.equal(c.industry,null);
    assert.doesNotMatch(c.leader||'',/习近平|蔡英文|安倍晋三/);assert.match(c.pandemic,/没有本地重大传染病疫情/);assert.doesNotMatch(c.pandemic,/新冠|封控/);
    s.worldOverrides[c.region]={leader:'林安',government:'新政府',conflict:null,ideology:'自定主张',stage:'peace'};
    const changed=regionContext(s,lore);assert.equal(changed.leader,'林安');assert.equal(changed.conflict,null);assert.equal(changed.ideology,'自定主张');
  }
  assert.equal(regionContext(state('北京',-600),lore).leader,null);
});
test('Taiwan reports affect the local region more than a remote province',()=>{
  const report=lore.regionalStories.find(e=>e.id==='rs_tw_full_mobilization');
  assert.ok(newsExposure(state('中国台湾',29),report).factor>newsExposure(state('甘肃',29),report).factor);
  const s=state('中国台湾',29,['rs_tw_tsai_resignation','rs_tw_full_mobilization']);
  assert.equal(regionContext(s,lore).leader,'赖清德');assert.match(regionContext(s,lore).government,/全面动员/);
});
