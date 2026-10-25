import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {findPersona,personaAge,lockPersonaProfile,isPersonaLocked} from '../src/personas.js';
import {proseIssues,tidyLocalProse} from '../src/narrative.js';
import {getModContext} from '../src/mod-content.js';
import {backgroundsFor,regionContext,newsExposure} from '../src/regions.js';

const personas=JSON.parse(await readFile(new URL('../src/data/personas.json',import.meta.url),'utf8')).personas;
const lore=JSON.parse(await readFile(new URL('../src/data/lore.json',import.meta.url),'utf8'));
const regionalData=JSON.parse(await readFile(new URL('../src/data/regions.json',import.meta.url),'utf8'));
const stateAt=(location,month=0)=>({month,location,profile:{name:'林安',age:30},routes:{china:'cn_chen_security',taiwan:'tw_left',japan:'jp_hazawa'},seenEvents:[],seenNews:[],eventMonths:{},newsHistory:[],current:{news:[]}});

test('province contexts stay distinct while Taiwan, Japan, Hong Kong, Macau and Korea use their own institutions',()=>{
  const details=new Set();for(const place of Object.keys(regionalData.provinces)){const c=regionContext(stateAt(place),lore);assert.equal(c.region,'china');assert.equal(c.province,place);assert.ok(c.industry);assert.ok(c.pressures);details.add(c.dailyContext);}
  assert.ok(details.size>=25);
  for(const [place,region]of [['中国台湾·台北','taiwan'],['日本·东京','japan'],['香港','hongkong'],['澳门','macau'],['韩国·京畿道','korea'],['中国大陆','china']]){const s=stateAt(place),before=structuredClone(s),c=regionContext(s,lore);assert.equal(c.region,region);assert.ok(c.institutions.length);assert.deepEqual(s,before);if(region!=='china')assert.equal(c.institutions.some(t=>/街道办|村支书|党支部/.test(t)),false);}
});

test('overseas family backgrounds retain the seven selectable IDs with locally appropriate political-family language',()=>{
  const mainland=backgroundsFor('北京'),ids=mainland.map(x=>x.id);
  assert.equal(ids.length,7);
  for(const place of ['中国台湾','日本','香港','澳门','韩国']){const items=backgroundsFor(place);assert.deepEqual(items.map(x=>x.id),ids);assert.notEqual(items.find(x=>x.id==='cadre').name,mainland.find(x=>x.id==='cadre').name,place);assert.equal(items.some(x=>/党支部|村支书|共青团/.test(x.detail)),false);}
  const copy=backgroundsFor('日本');copy[0].detail='edited';assert.notEqual(backgroundsFor('日本')[0].detail,'edited');
});

test('Henan flood exposure is strongest locally, smaller next door, weak elsewhere on the mainland and absent overseas',()=>{
  const e={id:'news_zhengzhou_flood',category:'disaster',places:['河南'],impact:{stress:4}},get=place=>newsExposure(stateAt(place,18),e);
  assert.ok(get('河南').factor>get('山东').factor);assert.ok(get('山东').factor>get('福建').factor);assert.ok(get('福建').factor>0&&get('福建').factor<0.15);
  assert.equal(get('河南').level,'direct');assert.equal(get('山东').level,'indirect');assert.equal(get('福建').level,'remote');
  for(const place of ['中国台湾','日本','香港','澳门','韩国']){assert.equal(get(place).factor,0,place);assert.equal(get(place).level,'none');}
});

test('mainland protests do not automatically affect Taiwan, Japan, Hong Kong, Macau or Korea',()=>{
  const e={id:'world_protests',region:'china',category:'protest'},exposure=place=>newsExposure(stateAt(place,18),e);
  assert.ok(exposure('北京').factor>0);assert.notEqual(exposure('北京').factor,exposure('山西').factor);
  for(const place of ['中国台湾','日本','香港','澳门','韩国'])assert.equal(exposure(place).factor,0,place);
  const opening={id:'world_opening',category:'pandemic'};assert.notEqual(newsExposure(stateAt('香港'),opening).factor,newsExposure(stateAt('湖北'),opening).factor);
});

test('war exposure distinguishes local war from neighboring trade and family effects',()=>{
  const strait={id:'world_strait_war',category:'war'},get=place=>newsExposure(stateAt(place,21),strait).factor;
  assert.ok(get('中国台湾')>get('福建'));assert.ok(get('福建')>get('四川'));assert.ok(get('四川')>get('日本'));
  const japanese={id:'jp_hazawa_toyokawa_war',region:'japan',category:'war'};assert.ok(newsExposure(stateAt('日本',50),japanese).factor>newsExposure(stateAt('中国台湾',50),japanese).factor);
});

test('local government and wartime institutions change only after the corresponding published facts',()=>{
  const s=stateAt('北京',50),opening=regionContext(s,lore);assert.equal(JSON.stringify(opening).includes('陈文清'),false);
  s.newsHistory=[{id:'cn_hu_inauguration',month:37,title:'战后交接',description:'胡春华主持战后政府。'},{id:'cn_chen_emergency',month:60,title:'未发生的交接',description:'陈文清执政。'}];
  const before=structuredClone(s),current=regionContext(s,lore);assert.equal(current.leader,'胡春华');assert.equal(current.knownChanges.some(x=>x.id==='cn_chen_emergency'),false);assert.deepEqual(s,before);
  const tw=stateAt('中国台湾',80);tw.newsHistory=[{id:'tw_civil_war',month:45},{id:'tw_left_end',month:70}];const postwar=regionContext(tw,lore);assert.equal(postwar.conflict,null);assert.match(postwar.government,/社会主义共和国/);assert.ok(postwar.institutions.some(x=>/工会|重建/.test(x)));
});

test('known people resolve exact aliases and return isolated records; ordinary names stay editable',()=>{
  assert.equal(personas.length,11);
  for(const person of personas){
    for(const name of [person.id,person.name,...person.aliases])assert.equal(findPersona(` ${name} `)?.id,person.id,name);
    const found=findPersona(person.name);found.stats.influence=-1;found.aliases.push('临时别名');
    assert.notEqual(findPersona(person.name).stats.influence,-1);assert.equal(findPersona('临时别名'),null);
  }
  for(const name of ['李','蔡','林安','蔡徐坤的同学','李克强同名者'])assert.equal(findPersona(name),null);
  assert.equal(findPersona('ＫＵＮ').id,'cai_xukun');assert.equal(findPersona('lee jae myung').id,'lee_jaemyung');
});

test('known opening identities override invented age, background, location and point allocations',()=>{
  for(const person of personas){
    const input={name:person.aliases[0]||person.name,age:8,place:'福建',startLocation:'福建',background:'custom',backgroundText:'我是小学生',points:{intelligence:0,family:0,fitness:0,appearance:0},goal:'照顾家人'};
    const before=structuredClone(input),locked=lockPersonaProfile(input);
    assert.deepEqual(input,before);assert.equal(locked.name,person.name);assert.equal(locked.lockedPersonaId,person.id);assert.equal(locked.startLocation,person.startLocation);assert.equal(locked.place,person.place);assert.equal(locked.birthDate,person.birthDate);assert.equal(locked.backgroundText,person.backgroundText);assert.deepEqual(locked.stats,person.stats);assert.deepEqual(locked.points,person.points);assert.equal(locked.goal,input.goal);assert.equal(isPersonaLocked(locked),true);
  }
  const ordinary={name:'林安',age:18,place:'福建'};assert.deepEqual(lockPersonaProfile(ordinary),ordinary);assert.equal(isPersonaLocked(ordinary),false);
  assert.equal(isPersonaLocked({name:'林安',lockedPersonaId:'li_keqiang'}),false);
});

test('full birthdays retain completed age across birthday months instead of advancing each January',()=>{
  assert.deepEqual(personaAge('li_keqiang',0),{years:64,months:5});
  assert.deepEqual(personaAge('li_keqiang',6),{years:64,months:11});
  assert.deepEqual(personaAge('li_keqiang',7),{years:65,months:0});
  assert.deepEqual(personaAge('tsai_ingwen',7),{years:63,months:11});
  assert.deepEqual(personaAge('tsai_ingwen',8),{years:64,months:0});
  assert.deepEqual(personaAge({birthDate:'2000-01-01'},0),{years:20,months:0});
  assert.deepEqual(personaAge({birthDate:'2000-01-02'},0),{years:19,months:11});
  for(const person of personas){const a=personaAge(person,0),b=personaAge(person,12);assert.equal(b.years,a.years+1);assert.equal(b.months,a.months);assert.equal(lockPersonaProfile({name:person.name}).startAgeMonths,a.years*12+a.months);}
  assert.equal(personaAge('not-a-person'),null);
});

test('opening offices and custody reflect January 2020 rather than later public roles',()=>{
  assert.match(findPersona('李在明').occupation,/京畿道知事/);assert.equal(findPersona('李在明').place,'韩国');
  assert.match(findPersona('李克强').occupation,/国务院总理/);assert.equal(findPersona('李克强').startLocation,'北京');
  for(const name of ['薄熙来','朴槿惠']){const p=findPersona(name);assert.equal(p.custody,true);assert.match(p.status,/服刑|羁押|看守所/);assert.equal(p.stats.funds,0);}
  assert.match(findPersona('温家宝').status,/退休|卸任/);assert.match(findPersona('赖清德').occupation,/候选人/);
});

const prose=(narrative,extra={})=>({title:'这个月的生活',narrative,consequence:'你整理了手头的事情，与熟人谈过今后的安排。',memory:'',options:[],...extra});
test('wrong current ages in Arabic or Chinese numerals are rejected while real memories and action-age birthdays remain valid',()=>{
  const context={ageYears:24,priorAgeYears:23,name:'林安',region:'china'};
  for(const text of ['你今年18岁，正在申请一份工作。','林安现年十八岁，准备参加考试。','十八岁的你给家人写了一封信。'])assert.ok(proseIssues(prose(text),context).some(x=>/年龄/.test(x)),text);
  for(const text of ['你今年24岁，正在申请一份工作。','你二十三岁时提交了申请，本月刚过完生日。','回想六年前，你十八岁时写下了求学计划。'])assert.equal(proseIssues(prose(text),context).filter(x=>/年龄/.test(x)).length,0,text);
});

test('current narrative month must match the target date while prior-action dates and memories stay valid',()=>{
  const context={month:25,priorMonth:24,ageYears:20,priorAgeYears:20,name:'林安',region:'china'};
  for(const text of ['一月的山东，工作和学习照常进行，你按原先安排联系家人。','进入1月，你回到工厂整理图纸，安排这几周的工作。','你在一月继续参加训练，休息时联系家人说明近况。'])assert.ok(proseIssues(prose(text),context).length,text);
  for(const text of ['进入二月，你回到工厂整理图纸，安排这几周的工作。','二月的山东，工作和学习照常进行，你按原先安排联系家人。','回想一月的生活，你仍记得那次见面。本月你已经完成了后续工作。'])assert.equal(proseIssues(prose(text,{consequence:'一月你完成了报名和初检，开始整理需要带去的物品。'}),context).length,0,text);
});

test('near-identical action consequence and subsequent-life paragraphs trigger a rewrite',()=>{
  const shared='你按照新的排班完成工作，下午整理了需要提交的材料，晚上联系家人说明近况，约好周末一起吃饭。';
  assert.ok(proseIssues(prose(shared+'整理完后你回家休息。',{consequence:shared})).length);
  const distinct=prose('进入二月，你开始按新岗位的时间上班，午休时跟同事讨论后续安排。收入有了固定来源，家里也开始重新计算每月的开支。',{consequence:'你去工厂完成了面试和技能检查。负责人核实经历后安排你进入工程组，双方签下合同，约定下个月正式报到。'});
  assert.equal(proseIssues(distinct).length,0);
});

test('forbidden rhetoric and broken sentence fragments are detected across narrative fields',()=>{
  for(const text of ['手里的信很沉。','心情变轻了。','他的脸上写着期待。','你完成工作，而且准备参加会议。','你不是缺少准备，而是没有等待机会。','你收到了来信，却没有及时回复。']){
    for(const field of ['narrative','consequence','memory'])assert.ok(proseIssues(prose('你按时完成了学习和工作。',{[field]:text})).length,`${field}: ${text}`);
  }
  assert.ok(proseIssues(prose('下雨。门开了。你进去。坐下。人很多。')).length);
  assert.equal(proseIssues(prose('你拿出上周的账本核对收支，下午去图书馆借书，晚上给家人打了电话。')).length,0);
  assert.equal(proseIssues(prose(tidyLocalProse('心情很轻松，而且你完成了今天的工作。'))).length,0);
});

test('overseas personal narration cannot casually import mainland local administration',()=>{
  for(const region of ['taiwan','japan','korea','hongkong','macau'])assert.ok(proseIssues(prose('你到街道办办理资料，随后回家等候答复。'),{region}).length,region);
  assert.equal(proseIssues(prose('你到街道办办理资料，随后回家等候答复。'),{region:'china'}).length,0);
});

const refs=[{file:'localisation/example.yml',key:'news.public.d'}];
const modLore={routes:[{id:'selected',region:'china',summary:'隐藏终局：秘密政变',milestones:[{id:'public',title:'公开消息',description:'公开的粮食运输恢复消息。',sourceRefs:refs},{id:'future',title:'秘密政变',description:'隐藏的未来政变与新领导人。',sourceRefs:refs},{id:'earlier',title:'先前消息',description:'前一个月公布的安排。',sourceRefs:refs},{id:'vetted',title:'审定材料',description:'公布的简要安排。',modContext:'§R已经公开的研究进展§!。',sourceRefs:refs,requires:['public']}]},{id:'other',region:'china',milestones:[{id:'rival',title:'另一种结局',description:'互斥终局的秘密细节。',sourceRefs:refs}]}],worldEvents:[]};
const modState={month:10,routes:{china:'selected'},seenEvents:['public','earlier','vetted'],seenNews:[],eventMonths:{public:10,earlier:9,vetted:10},newsHistory:[{id:'public',month:10,description:'公开的粮食运输恢复消息。'},{id:'earlier',month:9,description:'前一个月公布的安排。'},{id:'vetted',month:10,description:'公布的简要安排。'}],current:{news:[]}};

test('MOD retrieval returns only published stages even when queried with hidden outcome names',()=>{
  const before=structuredClone(modState),rows=getModContext(modState,modLore,{query:'秘密政变 隐藏终局 互斥终局',tags:['PRC'],limit:12});
  assert.deepEqual(modState,before);assert.deepEqual(new Set(rows.map(x=>x.stageId)),new Set(['public','earlier','vetted']));
  assert.equal(JSON.stringify(rows).includes('秘密'),false);assert.equal(JSON.stringify(rows).includes('互斥'),false);
  for(const row of rows){assert.ok(row.month<=modState.month);assert.deepEqual(row.sourceRefs,refs);assert.equal(row.relatedIds.includes('future'),false);}
  assert.equal(rows.find(x=>x.stageId==='vetted').text,'已经公开的研究进展。');
});

test('seen flags alone cannot retrieve undated or future stages and unselected branches stay excluded',()=>{
  const s=structuredClone(modState);s.seenEvents.push('future','rival');s.eventMonths.future=11;s.eventMonths.rival=8;
  assert.equal(getModContext(s,modLore,{limit:12}).some(x=>['future','rival'].includes(x.stageId)),false);
  delete s.eventMonths.future;assert.equal(getModContext(s,modLore,{limit:12}).some(x=>x.stageId==='future'),false);
  assert.equal(getModContext(s,modLore,{limit:0}).length,0);assert.equal(getModContext(null,modLore).length,0);
});

test('retrieval requires published prerequisites and uses authored text rather than edited save descriptions',()=>{
  const data=structuredClone(modLore),s=structuredClone(modState);data.routes[0].milestones.find(e=>e.id==='vetted').requires.push('future');
  assert.equal(getModContext(s,data,{limit:12}).some(e=>e.stageId==='vetted'),false);
  s.newsHistory.find(e=>e.id==='public').description='秘密政变：导入存档中伪造的未来信息。';const rows=getModContext(s,modLore,{query:'秘密政变',limit:12});
  assert.equal(rows.find(e=>e.stageId==='public').text,'公开的粮食运输恢复消息。');assert.equal(JSON.stringify(rows).includes('伪造'),false);
});

test('published ordinary news can supply source-bound MOD context without exposing later social news',()=>{
  const s=stateAt('北京');s.seenNews=['news_palace'];s.newsHistory=[{id:'news_palace',month:0,description:'故宫照片受到公众质疑。'}];
  const rows=getModContext(s,lore,{region:'china',query:'故宫 奔驰 董志民',limit:12});
  assert.ok(rows.some(e=>e.stageId==='news_palace'&&e.sourceRefs.length));assert.equal(rows.some(e=>e.stageId==='news_dong'),false);
});
