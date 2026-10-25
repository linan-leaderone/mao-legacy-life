import test from 'node:test';
import assert from 'node:assert/strict';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,nextContext,localEvent,advance,exportSave,importSave,validateResponse} from '../src/engine.js';
import {buildPrompt} from '../src/deepseek.js';
const profile={name:'林夕',age:22,place:'日本',background:'ordinary',freedom:'unlimited',seed:'v19-identity'};
const identity={sex:'custom',sexLabel:'双相型',sexDescription:'可自行调节生理特征',ethnicity:'硅基旅人',ethnicityDescription:'来自火星的海底城市',nationality:'火星联合体',nationalityDescription:'由城市议会组成，地球居留与公民身份分开'};
const passive={label:'照常生活',passive:true};
test('custom identity survives a month and save reload, without changing location or statistics',()=>{
  const source=createGame({...profile,identity},lore),plain=createGame(profile,lore),before=structuredClone(source);
  assert.deepEqual(source.stats,plain.stats);assert.equal(source.location,'日本');assert.deepEqual(source.profile.identity,identity);
  const preview=nextContext(source,lore,passive),next=advance(source,passive,localEvent(preview.state,lore,passive),null,lore);
  assert.deepEqual(source,before);assert.deepEqual(next.profile.identity,identity);assert.deepEqual(importSave(exportSave(next),lore).profile.identity,identity);
});
test('old saves migrate identity and relation records without resetting the life',()=>{
  const source=createGame(profile,lore);delete source.profile.identity;delete source.profile.language;delete source.relationshipGraph;
  const loaded=importSave(exportSave(source),lore);assert.equal(loaded.profile.identity.sex,'unspecified');assert.equal(loaded.profile.identity.nationality,'');assert.equal(loaded.profile.language,'zh-CN');assert.equal(loaded.month,source.month);assert.deepEqual(loaded.history,source.history);assert.equal(loaded.relationshipGraph.nodes[0].id,'player');
});
test('all narrative choices retain raw identity, local structured state and their language across saves',()=>{
  for(const language of ['zh-CN','zh-TW','en','ja','ko','martian','shuihu']){
    const source=createGame({...profile,identity,language},lore),preview=nextContext(source,lore,passive),response=localEvent(preview.state,lore,passive),next=advance(source,passive,response,null,lore),loaded=importSave(exportSave(next),lore);
    assert.equal(loaded.profile.language,language);assert.deepEqual(loaded.profile.identity,identity);assert.equal(loaded.turn,1);assert.ok(response.narrative.length>=20);assert.equal(source.turn,0);
    const payload=JSON.parse(buildPrompt(source,passive,lore).user);assert.deepEqual(payload.identity||payload.profile?.identity,identity);
  }
});
test('news translations only display known current news and cannot invent an additional event or impact',()=>{
  const source=createGame({...profile,language:'en'},lore),context=nextContext(source,lore,passive),base=localEvent(context.state,lore,passive);
  const known=context.news[0];assert.ok(known);
  const response={...base,newsTranslations:[{id:known.id,title:'A local report',description:'The same published event, shown in another language.'},{id:'invented',title:'Invented news',description:'This must not enter history.'}]};
  const after=advance(source,passive,response,null,lore),display=after.current.news.find(n=>n.id===known.id);
  assert.equal(display.title,'A local report');assert.equal(display.originalTitle,known.title);assert.equal(after.newsHistory.some(n=>n.id==='invented'),false);assert.deepEqual(display.impact,known.impact);
  assert.equal(after.newsHistory.find(n=>n.id===known.id).title,known.title);
});
test('invalid relationship saves fail atomically and response relationship fields stay bounded',()=>{
  const source=createGame(profile,lore),before=structuredClone(source),raw=JSON.parse(exportSave(source));raw.game.relationshipGraph.edges.push({id:'bad',source:'player',target:'absent'});
  assert.throws(()=>importSave(JSON.stringify(raw),lore),/人物关系/);assert.deepEqual(source,before);
  const r=validateResponse({title:'一次交谈',narrative:'你与张三约好下个月继续见面，把尚未谈完的工作和生活安排记了下来。',options:[],relationshipUpdates:[{source:'player',target:'张三',status:'朋友',detail:'已见面交流',strength:70}]},{decision:false});
  assert.equal(r.relationshipUpdates[0].target,'张三');
});
test('foreign public actions change their named region while hypothetical and unrelated updates do not',()=>{
  for(const [label,kind,accepted]of [['I started a civil war in Japan.','war',true],['私は日本の内戦を終わらせた。','peace',true],['나는 일본의 대통령이 되었다.','leadership',true],['If I started a civil war in Japan, I would be afraid.','war',false],['I worked at a cafe in Japan.','war',false]]){
    const source=createGame({...profile,language:'en'},lore),action={label,custom:true},preview=nextContext(source,lore,action);
    const response={...localEvent(preview.state,lore,action),worldUpdates:[{region:'japan',kind,title:'A public change',description:'The direct consequences of the completed action.',...(kind==='leadership'?{leader:source.profile.name}:{} )},{region:'taiwan',kind,title:'An unrelated change',description:'This must not be applied.'}]};
    const next=advance(source,action,response,null,lore);
    assert.equal(!!next.worldOverrides.japan,accepted,label);assert.equal(!!next.worldOverrides.taiwan,false,label);
    if(kind==='peace'&&accepted)assert.ok(next.worldDynamics.terminatedConflicts.includes('japan'));
  }
});
