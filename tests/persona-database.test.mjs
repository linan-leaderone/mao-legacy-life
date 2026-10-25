import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import base from '../src/data/personas.json' with {type:'json'};
import curated from '../src/data/personas-curated-v15.json' with {type:'json'};
import special from '../src/data/personas-special.json' with {type:'json'};
import lore from '../src/data/lore.json' with {type:'json'};
import news from '../src/data/news.json' with {type:'json'};
import {findPersona,personaAge,isPersonaLocked} from '../src/personas.js';
import {createGame,currentAge,ageLabel,nextContext,localEvent,advance,exportSave,importSave} from '../src/engine.js';
import {regionContext,newsExposure} from '../src/regions.js';
import {buildPrompt} from '../src/deepseek.js';

const requested=['毛远新','王沪宁','张又侠','李作成','李占良','龚源浩','陈吉宁','江泽民','胡锦涛','胡春华','陆昊','德仁','韩东方','韩德强','孔庆东'];
const records=[...base.personas,...curated.personas,...special.personas];
const passive={label:'照常生活',passive:true};
const game=name=>createGame({name,age:9,place:'福建',background:'ordinary',backgroundText:'我在福建上小学。',points:{intelligence:5,family:5,fitness:5,appearance:5},seed:'persona-database:'+name},lore);
const tick=s=>{const next=nextContext(s,lore,passive);return advance(s,passive,localEvent(next.state,lore,passive),null,lore);};

test('reading a known childhood save restores its opening age and date precision',()=>{
  const s=game('幺幺'),modified=JSON.parse(exportSave(s));
  Object.assign(modified.game.profile,{age:9,startAgeMonths:108,birthDatePrecision:'day'});
  const loaded=importSave(JSON.stringify(modified),lore);
  assert.equal(ageLabel(loaded),'约 3 岁');
  assert.equal(loaded.profile.birthDate,'');
  assert.equal(loaded.profile.birthDatePrecision,'estimated');
  assert.deepEqual(currentAge(loaded),currentAge(s));
});

test('all requested and existing curated names resolve locally with traceable opening facts',()=>{
  for(const name of requested){
    const p=findPersona(name);
    assert.ok(p,name);
    assert.equal(p.name,name);
    assert.equal(p.asOf,'2020-01-01');
    assert.ok(p.sourceUrls.length,name);
    assert.ok(p.notes.length,name);
    assert.match(p.statsBasis,/估值|虚构/,name);
  }
  for(const source of [base,curated,special]){
    assert.equal(new Set(source.personas.map(p=>p.name)).size,source.personas.length);
    assert.equal(new Set(source.personas.map(p=>p.id)).size,source.personas.length);
  }
});

test('every base, curated and special identity overrides ordinary inputs and round-trips a save',()=>{
  for(const raw of records){
    const p=findPersona(raw.name),s=game(raw.name);
    assert.equal(s.profile.lockedPersonaId,p.id,raw.name);
    assert.equal(s.profile.name,p.name,raw.name);
    assert.equal(s.profile.place,p.place,raw.name);
    assert.equal(s.profile.birthPlace,p.birthPlace,raw.name);
    assert.equal(s.profile.birthDate,p.birthDate,raw.name);
    assert.equal(s.profile.birthDatePrecision,p.birthDatePrecision,raw.name);
    assert.equal(s.profile.backgroundText,p.backgroundText,raw.name);
    assert.deepEqual(s.profile.points,p.points,raw.name);
    assert.equal(s.location,p.startLocation,raw.name);
    if(p.specialScenario==='mao_resurrection')assert.match(s.person.occupation,/水晶棺.*苏醒/,raw.name);
    else if(p.specialScenario==='deng_ocean')assert.match(s.person.occupation,/小鱼/,raw.name);
    else assert.equal(s.person.occupation,p.occupation,raw.name);
    assert.deepEqual(currentAge(s),personaAge(p),raw.name);
    assert.equal(isPersonaLocked(s.profile),true,raw.name);
    assert.deepEqual(importSave(exportSave(s),lore),s,raw.name);
  }
});

test('full, monthly, yearly and unverified birthdays keep their own display precision',()=>{
  const exact=game('德仁'),monthly=game('王沪宁'),yearly=game('韩东方'),estimated=game('龚源浩');
  assert.equal(exact.profile.birthDate,'1960-02-23');
  assert.equal(exact.profile.birthDatePrecision,'day');
  assert.equal(ageLabel(exact),'59 岁 10 个月');
  assert.equal(monthly.profile.birthDate,'1955-10');
  assert.equal(monthly.profile.birthDatePrecision,'month');
  assert.equal(ageLabel(monthly),'约 64 岁');
  assert.equal(yearly.profile.birthDate,'1963');
  assert.equal(yearly.profile.birthDatePrecision,'year');
  assert.equal(ageLabel(yearly),'约 56 岁');
  assert.equal(estimated.profile.birthDate,'');
  assert.equal(estimated.profile.birthDatePrecision,'estimated');
  assert.equal(ageLabel(estimated),'约 3 岁');
  for(const s of [exact,monthly,yearly,estimated]){
    const initial=currentAge(s).years,copy=structuredClone(s);copy.month=24;
    assert.equal(currentAge(copy).years,initial+2,s.profile.name);
    assert.equal(copy.profile.birthDate,s.profile.birthDate);
    assert.equal(importSave(exportSave(s),lore).profile.birthDatePrecision,s.profile.birthDatePrecision);
  }
});

test('known living elders are not blocked by the ordinary age ninety entry limit',()=>{
  for(const [name,years] of [['江泽民',93],['李登辉',96]]){
    const s=game(name);
    assert.equal(currentAge(s).years,years,name);
    assert.equal(s.ended,false,name);
    const after=tick(s);
    assert.equal(after.ended,false,name);
    assert.equal(importSave(exportSave(after),lore).profile.age,years,name);
  }
});

test('Gong Yuanhao has an unknown birthday and user-supplied childhood without unsupported accusations',()=>{
  const p=findPersona('幺幺'),s=game('幺幺');
  assert.equal(p.name,'龚源浩');
  assert.equal(p.birthDate,'');
  assert.equal(p.sourceConfidence,'user_supplied');
  assert.equal(p.openingAgeEstimate,3);
  assert.deepEqual(p.openingAgeEstimateRange,[2,3]);
  assert.match(p.birthPlace,/未核实/);
  assert.match(p.startLocation,/四川.*自贡/);
  assert.match(p.familyBackground,/龚俊清/);
  const opening=[p.backgroundText,p.biography,p.familyBackground,p.occupation,p.status,s.current.narrative,s.current.consequence].join(' ');
  assert.doesNotMatch(opening,/谋杀|謀殺|骗保|騙保|精神病|精神分裂|溺亡|溺死|2023|二〇二三/);
  assert.equal(currentAge(s).years,3);
  assert.equal(s.person.occupation,'幼儿');
  assert.equal(s.specialLife,undefined);
});

test('Gong Yuanhao can pass the summer of 2023 without a scripted drowning or death',()=>{
  let s=game('龚源浩');
  while(s.month<45)s=tick(s);
  assert.equal(s.ended,false);
  assert.equal(s.person.deceased,undefined);
  assert.equal(s.profile.birthDate,'');
  assert.ok(s.history.every(h=>!(/龚源浩|幺幺/.test(h.event.narrative)&&/溺亡|溺死|被父亲杀害/.test(h.event.narrative))));
  assert.deepEqual(importSave(exportSave(s),lore),s);
});

test('known traditional aliases lock the same person while approximate names remain ordinary',()=>{
  for(const [alias,name] of [['毛遠新','毛远新'],['王滬寧','王沪宁'],['張又俠','张又侠'],['陳吉寧','陈吉宁'],['江澤民','江泽民'],['胡錦濤','胡锦涛'],['胡春華','胡春华'],['陸昊','陆昊'],['韓東方','韩东方'],['韓德強','韩德强'],['孔慶東','孔庆东'],['徳仁','德仁'],['良子','李占良'],['龔源浩','龚源浩'],['毛澤東','毛泽东'],['鄧小平','邓小平']]){
    assert.equal(findPersona(alias).id,findPersona(name).id,alias);
    assert.equal(game(alias).profile.name,name,alias);
  }
  for(const name of ['王','胡','胡春花','王沪宁的同学','蔡徐坤的朋友','毛泽东的邻居','邓小平二号','李占良的朋友','龚源浩的邻居']){
    assert.equal(findPersona(name),null,name);
    const s=game(name);
    assert.equal(s.profile.lockedPersonaId,undefined,name);
    assert.equal(s.profile.age,9,name);
    assert.equal(s.location,'福建',name);
  }
});

test('retrieved persona objects cannot mutate the local canonical database',()=>{
  const p=findPersona('毛远新'),copy=findPersona('毛远新');
  p.stats.influence=0;p.aliases.push('伪造别名');p.backgroundText='已被外部覆盖';
  assert.deepEqual(findPersona('毛远新'),copy);
  assert.equal(findPersona('伪造别名'),null);
});

test('January 2020 public offices are not replaced with later appointments',()=>{
  for(const [name,expected,forbidden] of [
    ['德仁',/日本天皇/,/上皇|首相/],
    ['明仁',/日本上皇/,/现任天皇|首相/],
    ['菅义伟',/内阁官房长官/,/首相/],
    ['岸田文雄',/政务调查会长/,/首相/],
    ['石破茂',/众议员/,/首相/],
    ['陈吉宁',/北京市市长/,/上海市委书记/],
    ['胡春华',/国务院副总理/,/全国政协副主席/],
    ['贺一诚',/行政长官/,/前行政长官/],
    ['崔世安',/前行政长官/,/现任行政长官/]
  ]){
    const s=game(name);
    assert.match(s.person.occupation,expected,name);
    assert.doesNotMatch(s.person.occupation,forbidden,name);
  }
  for(const name of ['江泽民','胡锦涛']){
    const s=game(name);
    assert.match(s.person.occupation,/退休/,name);
    assert.doesNotMatch(s.person.status,/现任|正在主持中央|主持国务院/,name);
  }
});

test('public detention facts restrict Ling Jihua while Chen Shui-bian retains medical parole',()=>{
  const ling=game('令计划'),chen=game('陈水扁'),tsang=game('曾荫权');
  assert.equal(ling.person.custody,true);
  assert.match(ling.current.dailyId,/custody/);
  assert.match(chen.person.status,/保外就医/);
  assert.equal(chen.person.custody,false);
  assert.equal(tsang.person.custody,false);
  assert.match(tsang.person.status,/撤销/);
});

test('name input exposes no suggested identities and disables browser name completion',async()=>{
  const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
  const input=main.match(/<input\b[^>]*\bname="name"[^>]*>/)?.[0]||'';
  assert.ok(input&&/autocomplete="off"/.test(input)&&!/\blist\s*=/.test(input)&&!/datalist[^>]*id=["'](?:personas|characters|famous|life-names)["']/.test(main),'The hidden name entry must not offer a character list');
});

test('ocean opening ignores land news exposure and has no human administrative institutions',()=>{
  let s=game('邓小平');
  const candidates=[...news.events,...lore.worldEvents,...lore.routes.flatMap(r=>r.milestones||[])];
  const local=regionContext(s,lore);
  assert.equal(local.region,'ocean');
  assert.deepEqual(local.institutions,[]);
  for(const event of candidates){
    const impact=newsExposure(s,event);
    assert.equal(impact.level,'none',event.id);
    assert.equal(impact.factor,0,event.id);
  }
  for(let i=0;i<6;i++){
    s=tick(s);
    assert.equal(s.location,'太平洋');
    assert.ok(s.current.news.every(n=>n.exposure.level==='none'));
    assert.doesNotMatch(s.current.narrative,/社区登记|防疫手续|去办公室|上班签到|党支部会议|去学校上课/);
  }
  const payload=JSON.parse(buildPrompt(s,passive,lore).user);
  assert.equal(payload.localSituation.region,'ocean');
  assert.deepEqual(payload.localSituation.institutions,[]);
  assert.notEqual(payload.specialLife.body,'human');
});

