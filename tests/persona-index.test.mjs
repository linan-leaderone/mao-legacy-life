import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPersonaIndex,personaAge} from '../src/personas.js';
const record=(id,name,aliases=[])=>({id,name,aliases,birthDate:'1970-04-12',birthPlace:'上海',place:'上海',startLocation:'上海',occupation:'作家',sourceUrls:['https://www.wikidata.org/wiki/'+id]});

test('curated canonical records absorb catalog aliases without losing verified opening facts',()=>{
  const curated={...record('verified','王某',['王某某']),occupation:'2020年已核实的职务',stats:{influence:82}};
  const catalog={...record('Q100','王某某',['Wang Mou']),occupation:'一般生涯领域'};
  const index=buildPersonaIndex([[curated],[catalog]]);
  assert.equal(index.records.length,1);assert.equal(index.merged,1);
  for(const key of ['王某','王某某','wangmou','q100'])assert.equal(index.byName.get(key).id,'verified');
  assert.equal(index.byName.get('王某').occupation,curated.occupation);
  assert.equal(index.byName.get('王某').stats.influence,82);
});

test('equal-priority homonyms remain ambiguous instead of selecting the first public person',()=>{
  const index=buildPersonaIndex([[record('Q101','李某',['李某甲']),record('Q102','李某',['李某乙'])]]);
  assert.equal(index.byName.has('李某'),false);assert.ok(index.ambiguousNames.includes('李某'));
  assert.equal(index.byName.get('李某甲').id,'Q101');assert.equal(index.byName.get('李某乙').id,'Q102');
  assert.equal(index.byName.get('q101').id,'Q101');assert.equal(index.byName.get('q102').id,'Q102');
});

test('an alias shared with a different birth generation cannot merge two identities',()=>{
  const index=buildPersonaIndex([[{...record('older','甲人物',['乙人物']),birthDate:'1950'}],[{...record('younger','乙人物'),birthDate:'1980-01-12'}]]);
  assert.equal(index.records.length,2);assert.equal(index.merged,0);
  assert.equal(index.byName.get('younger').id,'younger');
});

test('shared aliases do not override full canonical names and one-character names are not aliases',()=>{
  const index=buildPersonaIndex([[record('Q103','陈甲',['陈乙','陈','阿甲']),record('Q104','陈乙',['阿甲'])]]);
  assert.equal(index.byName.get('陈乙').id,'Q104');assert.equal(index.byName.has('陈'),false);assert.equal(index.byName.has('阿甲'),false);
});

test('missing dates are estimated without inventing a real date; invalid dates are rejected',()=>{
  assert.deepEqual(personaAge({birthDate:'',openingAgeEstimate:3},14),{years:4,months:2});
  for(const birthDate of ['1970-13','1970-02-31','1970-00-01','bad',''])assert.equal(personaAge({birthDate}),null);
  assert.deepEqual(personaAge({birthDate:'1970-04'},0),{years:49,months:8});
});

test('catalog estimates vary with field while missing family facts do not become invented biography',()=>{
  const index=buildPersonaIndex([[{...record('Q105','甲教授'),category:'科研教育与技术',sitelinks:100,biography:'1970年出生于上海。',familyBackground:'未收录家庭资料。'},{...record('Q106','乙选手'),category:'体育与竞技',sitelinks:2}]]);
  const a=index.byName.get('甲教授'),b=index.byName.get('乙选手');
  assert.ok(a.stats.intelligence>b.stats.intelligence);assert.ok(b.stats.fitness>a.stats.fitness);
  assert.ok(a.stats.influence>b.stats.influence);assert.equal(a.points.family,b.points.family);
  assert.equal(a.backgroundText,'1970年出生于上海。');assert.match(a.statsBasis,/估值/);
});
