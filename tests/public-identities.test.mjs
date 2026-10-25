import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,nextContext,localEvent,advance,exportSave,importSave,isDecisionMonth} from '../src/engine.js';
import {findPersona} from '../src/personas.js';
import {buildPrompt} from '../src/deepseek.js';

const source=new Map([...lore.worldEvents,...lore.regionalStories,...lore.routes.flatMap(r=>r.milestones)].map(e=>[e.id,e]));
const fixture=ids=>({routes:[{id:'identity_fixture',region:'china',milestones:[]}],worldEvents:ids.map((id,index)=>{assert.ok(source.has(id),id);const e=source.get(id);return {id,title:e.title,description:e.description,region:id.startsWith('tw_')?'taiwan':'china',earliestMonth:index*2+1,fixedMonth:true};})});
const profile={place:'福建',age:20,background:'ordinary',points:{intelligence:5,family:5,fitness:5,appearance:5},seed:'public-identities-test'};
const passive={label:'照常生活',passive:true};
const game=(name,data=lore)=>createGame({...profile,name},data);
function tick(s,data=lore,action=passive){const c=nextContext(s,data,action);return advance(s,action,localEvent(c.state,data,action),null,data);}

test('the newly catalogued political figures retain opening offices until an actual relevant event occurs',()=>{
  const names=['张又侠','陈文清','胡春华','王沪宁','毛远新','李作成','韩东方','韩德强','秦晖','张宏良','令计划','汪洋','韩国瑜'];
  const data=fixture([]);
  for(const name of names){const record=findPersona(name);assert.ok(record,name);const s=tick(game(name,data),data);assert.equal(s.person.occupation,record.occupation,name);assert.equal(s.person.publicChanges?.length||0,0);assert.equal(s.ended,false);}
});

test('published accessions update current offices for every new Chinese public figure with a named world event',()=>{
  const cases=[
    ['张又侠','cn_zhang_coup','主持中央权力过渡的军方领导人'],
    ['陈文清','cn_chen_emergency','中国最高领导人'],
    ['胡春华','cn_hu_inauguration','中国最高领导人'],
    ['王沪宁','cn_whn_coup','中国最高领导人'],
    ['毛远新','cn_mao_succession','中国最高领导人'],
    ['李作成','cn_li_stopwar','主持停战的军方领导人'],
    ['韩东方','cn_republic_foundation','中华共和国临时政府领导人'],
    ['韩德强','cn_han_rise','正道派政权领导人'],
    ['秦晖','cn_qin_elected','中华共和国主席'],
    ['张宏良','cn_zhang_hongliang','中国最高领导人'],
    ['令计划','cn_ling_victory','战后中国最高领导人'],
    ['汪洋','cn_wang_elected','中国国家主席']
  ];
  for(const [name,id,occupation]of cases){const data=fixture([id]),s=tick(game(name,data),data);assert.equal(s.person.occupation,occupation,name);assert.deepEqual(s.person.publicChanges,[id]);assert.equal(s.ended,false);assert.ok(s.stats.health>0);assert.deepEqual(importSave(exportSave(s),data).person,s.person);if(name==='令计划')assert.equal(s.person.custody,false);}
});

test('leadership handovers keep former officeholders from continuing the old office without killing them',()=>{
  const cases=[['胡春华',['cn_hu_inauguration','cn_mao_succession'],'原中国最高领导人'],['胡春华',['cn_hu_inauguration','cn_whn_coup'],'失去执政权力的团派政治人物'],['韩东方',['cn_republic_foundation','cn_qin_elected'],'中华共和国政治人物、前政府领导人'],['毛远新',['cn_mao_succession','cn_front_han_chair'],'革命阵线政治人物']];
  for(const [name,ids,expected]of cases){const data=fixture(ids);let s=game(name,data);for(let i=0;i<3;i++)s=tick(s,data);assert.equal(s.person.occupation,expected,name);assert.ok(s.stats.health>0);assert.equal(s.ended,false);assert.equal(s.person.deceased,undefined);}
});

test('identity sync requires the canonical matching locked record and does not apply to an ordinary same-name character',()=>{
  const data=fixture(['cn_hu_inauguration']);
  for(const forgedId of [undefined,'zhang_youxia']){const s=game('普通居民',data);s.profile.name='胡春华';s.profile.lockedPersonaId=forgedId;const before=s.person.occupation;const next=tick(s,data);assert.equal(next.person.occupation,before);assert.equal(next.person.publicChanges?.length||0,0);}
});

test('an already applied event cannot undo a later personal occupation but a newly occurring political handover is applied once',()=>{
  const data=fixture(['cn_hu_inauguration','cn_whn_coup']);let s=game('胡春华',data);s=tick(s,data);assert.equal(s.person.occupation,'中国最高领导人');
  s=tick(s,data,{label:'成为教师',custom:true});assert.equal(s.person.occupation,'教师');
  s=tick(s,data);assert.equal(s.person.occupation,'失去执政权力的团派政治人物');
  const facts=s.person.facts.length;s=tick(s,data);assert.equal(s.person.facts.length,facts);assert.equal(s.person.publicChanges.length,2);
});

test('a stale model identity cannot overwrite the authoritative political change occurring in the new month',()=>{
  const data=fixture(['cn_hu_inauguration']),s=game('胡春华',data),action={label:'与同事讨论目前的工作',custom:true};
  const c=nextContext(s,data,action),response={...localEvent(c.state,data,action),personUpdate:{occupation:'国务院副总理',status:'继续处理副总理的日常工作',facts:[]}};
  const next=advance(s,action,response,null,data);assert.equal(next.person.occupation,'中国最高领导人');assert.match(next.person.status,/接掌权力/);
});

test('Taiwan leadership follows the actual faction winner instead of simultaneously assigning rival victories',()=>{
  for(const [id,job]of [['tw_kmt_end','台湾战后政府领导人'],['tw_left_end','国民党政治人物'],['tw_dpp_end','国民党政治人物'],['tw_revanchist_end','国民党政治人物']]){const data=fixture(['tw_four_factions',id]);let s=game('韩国瑜',data);for(let i=0;i<3;i++)s=tick(s,data);assert.equal(s.person.occupation,job,id);assert.equal(s.person.publicChanges.filter(x=>/_end$/.test(x)).length,1);}
  const data=fixture(['tw_four_factions','tw_kmt_end']);let lai=game('赖清德',data);for(let i=0;i<3;i++)lai=tick(lai,data);assert.equal(lai.person.occupation,'民进党政治人物');assert.match(lai.person.status,/失去中央管治/);
});

test('the explicit assassination ends only locked Mao Yuanxin, writes a final account, and retains a consistent save',()=>{
  const data=fixture(['cn_mao_assassinated']),s=game('毛远新',data),before=JSON.stringify(s),context=nextContext(s,data,passive);
  assert.equal(JSON.stringify(s),before);assert.equal(context.state.ended,true);assert.equal(context.state.stats.health,0);assert.equal(context.decision,false);
  const local=localEvent(context.state,data,passive);assert.equal(local.options.length,0);assert.match(local.narrative,/遇刺身亡/);assert.doesNotMatch(local.narrative,/继续处理.*工作/);
  const prompt=buildPrompt(s,passive,data),payload=JSON.parse(prompt.user);assert.equal(payload.lifeEnded,true);assert.equal(payload.currentIdentity.deceased.eventId,'cn_mao_assassinated');assert.equal(prompt.decision,false);assert.match(prompt.system,/不继续写本人办公/);
  const next=advance(s,passive,local,null,data);assert.equal(next.ended,true);assert.equal(isDecisionMonth(next),false);assert.deepEqual(importSave(exportSave(next),data),next);assert.throws(()=>advance(next,passive,local,null,data),/已经结束/);
  const actor=game('普通居民',data);actor.profile.name='毛远新';const other=tick(actor,data);assert.ok(other.stats.health>0);assert.equal(other.ended,false);assert.equal(other.person.deceased,undefined);
  const mao=tick(game('毛泽东',data),data);assert.equal(mao.ended,false);assert.ok(mao.specialLife);assert.ok(mao.stats.health>0);
});

test('Mao Yuanxin follows a complete existing assassination branch without encountering a premature terminal event',()=>{
  let s=createGame({...profile,name:'毛远新',routes:{china:'cn_mao_li_junta'}},lore);
  while(!s.ended&&s.month<145)s=tick(s);
  assert.equal(s.ended,true);assert.ok(s.month>=115);assert.ok(s.seenEvents.includes('cn_mao_assassinated'));assert.equal(s.stats.health,0);assert.equal(s.person.deceased.eventId,'cn_mao_assassinated');assert.equal(s.current.options.length,0);assert.deepEqual(importSave(exportSave(s),lore).person,s.person);
});
