import test from 'node:test';
import assert from 'node:assert/strict';
import {findPersona} from '../src/personas.js';
import {normalizeRelationshipGraph,getRelationshipGraph,updateRelationshipGraph,normalizeRelationshipUpdates,isValidRelationshipGraph,RELATIONSHIP_LIMITS} from '../src/relationships.js';

const state=()=>({profile:{name:'小林',place:'日本'},person:{occupation:'学生',relationships:[]},month:0,seenEvents:[],seenNews:[],newsHistory:[]});
const names=g=>g.nodes.map(n=>n.name);
const tie=(g,a,b)=>{const aid=g.nodes.find(n=>n.name===a)?.id,bid=g.nodes.find(n=>n.name===b)?.id;return g.edges.find(e=>e.source===aid&&e.target===bid||e.source===bid&&e.target===aid);};
const act=(s,label,response={})=>updateRelationshipGraph(s,{action:{custom:true,label},response,success:true});

test('a new life has only the player; headlines and the catalog are not acquaintances',()=>{
  const s=state();s.pendingNews=[{description:'习近平与蔡英文会面，羽泽鸫结识陈信行。'}];s.current={news:s.pendingNews,narrative:'本月，你阅读报纸。'};
  const snapshot=structuredClone(s),g=getRelationshipGraph(s);
  assert.deepEqual(names(g),['小林']);assert.deepEqual(g.edges,[]);assert.deepEqual(s,snapshot);
});

test('legacy relationship strings migrate once and canonical aliases deduplicate',()=>{
  const s=state();s.person.relationships=['羽澤鶇：乐队伙伴','羽泽鸫：长久合作的伙伴','张三：朋友','习近平：尚未与本人见面'];
  const g=normalizeRelationshipGraph(s);assert.deepEqual(names(g),['小林','羽泽鸫','张三']);assert.equal(g.edges.length,2);
  s.relationshipGraph=g;s.person.relationships.push('陌生候选人：与本人相识');assert.deepEqual(names(getRelationshipGraph(s)),names(g));
  assert.equal(isValidRelationshipGraph(JSON.parse(JSON.stringify(g))),true);
});

test('named background contacts and older prose relations migrate without wishes becoming acquaintances',()=>{
  const s=state();s.profile.backgroundText='我的朋友是张三。我认识李四。我希望有一天认识习近平。如果我见到蔡英文，我就与她合作。';s.person.relationships=['陈老师提供工程指导'];
  const g=normalizeRelationshipGraph(s);assert.deepEqual(names(g),['小林','陈老师','张三','李四']);assert.equal(tie(g,'小林','陈老师').kind,'mentor');
});

test('background relation predicates and frequency adverbs preserve real names and their strongest established tie',()=>{
  const s=state();s.profile.backgroundText='我与张三是多年好友。我认识李四，和李四是同事。我与王五经常见面。';
  const g=normalizeRelationshipGraph(s);assert.deepEqual(names(g),['小林','张三','李四','王五']);
  assert.equal(tie(g,'小林','张三').kind,'friend');assert.equal(tie(g,'小林','李四').kind,'colleague');assert.equal(tie(g,'小林','王五').kind,'acquaintance');
  assert(!names(g).includes('王五经常'));
});

test('hidden Afterglow opening preserves established contacts but not future meetings',()=>{
  const s=state();s.profile={...s.profile,name:'羽泽鸫',lockedPersonaId:'hazawa_tsugumi',persona:findPersona('羽泽鸫')};
  const g=getRelationshipGraph(s);assert.equal(g.nodes.length,5);assert.equal(g.edges.length,10);assert(!names(g).includes('陈信行'));assert(!names(g).includes('丰川祥子'));
  assert(g.edges.every(e=>e.status==='乐队伙伴'));
});

test('actual encounters and calls recognize named people, not activities',()=>{
  const g=act(state(),'我见到了李克强，和他讨论工作。我遇到了新同事陈明。我给张三打电话。我与羽泽鸫和美竹兰一起排练。');
  assert.deepEqual(names(g),['小林','李克强','陈明','张三','羽泽鸫','美竹兰']);
  assert.equal(tie(g,'羽泽鸫','美竹兰').status,'乐队伙伴');
});

test('news, photos, negations, conditionals, failed plans and third-person scenes add nobody',()=>{
  const examples=['我看新闻认识了习近平','我看到李克强的照片','我并未见到蔡英文','我不认识赖清德','如果我结识张三，我就和李四合作','我计划见面张三','我与张三合作失败','我见到了李克强的秘书','I never met Alice','I watched news about Alice','私は羽泽鸫に会っていない','당신은 김민수를 만나지 않았다'];
  for(const label of examples)assert.deepEqual(names(act(state(),label)),['小林'],label);
  const response={narrative:'张三和李四见面后一起回家。',personUpdate:{relationships:['张三：朋友','李四：朋友']},relationshipUpdates:[{target:'张三',status:'朋友'}]};
  assert.deepEqual(names(act(state(),'我在家休息',response)),['小林']);
});

test('failed actions cannot establish or update ties even if a response claims success',()=>{
  const s=state();s.relationshipGraph=act(s,'我与张三成为朋友');
  const before=structuredClone(s.relationshipGraph),g=updateRelationshipGraph(s,{action:{label:'我与张三绝交，我见到了李四'},response:{narrative:'你认识了李四。'},success:false});
  assert.deepEqual(g,before);assert.deepEqual(s.relationshipGraph,before);
});

test('an existing friend remains a friend after a routine visit; a deliberate break wins over stale response',()=>{
  const s=state();s.relationshipGraph=act(s,'我和张三成为朋友');s.month=3;
  let g=act(s,'我见到了张三');assert.equal(tie(g,'小林','张三').kind,'friend');assert.equal(g.nodes.find(n=>n.name==='张三').lastContactMonth,3);
  s.relationshipGraph=g;g=act(s,'我已经与张三绝交',{consequence:'你与张三说清楚了各自的打算。',personUpdate:{relationships:['张三：你的好友']}});
  assert.equal(tie(g,'小林','张三').kind,'estranged');
});

test('subjectless outcomes after a comma inherit only the immediately preceding personal contact',()=>{
  const g=act(state(),'我与美竹兰见面交谈，结为朋友。我与羽泽鸫见面交谈，结为朋友。');
  assert.equal(tie(g,'小林','美竹兰').kind,'friend');assert.equal(tie(g,'小林','羽泽鸫').kind,'friend');
  const broken=act(state(),'我与李四见面，当场决裂。');assert.equal(tie(broken,'小林','李四').kind,'estranged');
  const ordered=act(state(),'我与李四见面，结为朋友。我与李四决裂。');assert.equal(tie(ordered,'小林','李四').kind,'estranged');
});

test('a different named subject or a new sentence cannot donate its relationship result to the player',()=>{
  const s=state();s.relationshipGraph=act(s,'我认识张三。我认识王五。');
  const g=act(s,'我与李四见面，张三与王五结为朋友。');
  assert.equal(tie(g,'小林','李四').kind,'acquaintance');assert.equal(tie(g,'小林','王五').kind,'acquaintance');assert.equal(tie(g,'张三','王五').kind,'friend');
  const strangers=act(state(),'我与李四见面，张三与王五结为朋友。');assert.deepEqual(names(strangers),['小林','李四']);
  const noCarry=act(state(),'我与李四见面。结为朋友。');assert.equal(tie(noCarry,'小林','李四').kind,'acquaintance');
  const negated=act(state(),'我与李四见面，并未结为朋友。');assert.equal(tie(negated,'小林','李四').kind,'acquaintance');
});

test('a natural named contact in a passive month can be remembered when genuinely narrated',()=>{
  const s=state(),g=updateRelationshipGraph(s,{action:{passive:true,label:'下个月'},response:{narrative:'你在车间认识了新同事陈明，午休时和他交谈。',relationshipUpdates:[{target:'陈明',status:'同事',detail:'在车间认识，午休时交谈。',strength:45}]},success:true});
  assert.deepEqual(names(g),['小林','陈明']);assert.equal(tie(g,'小林','陈明').status,'同事');
});

test('model-only relationship additions require personal contact evidence',()=>{
  const response={narrative:'你在家继续整理书架。',personUpdate:{relationships:['习近平：盟友']},relationshipUpdates:[{target:'蔡英文',source:'player',status:'朋友',detail:'关系很好',strength:99}]};
  assert.deepEqual(names(act(state(),'我整理书架',response)),['小林']);
  const withEvidence={...response,narrative:'你会见了蔡英文，双方讨论了这次访问的安排。'};
  const g=act(state(),'我前往台北',withEvidence);assert(names(g).includes('蔡英文'));assert(!names(g).includes('习近平'));
});

test('known third-party relationships only appear after both people are met and prerequisites occurred',()=>{
  const s=state();s.relationshipGraph=act(s,'我会见了羽泽鸫');s.seenEvents=['rs_tw_afterglow_records'];
  assert(!names(getRelationshipGraph(s)).includes('陈信行'));
  s.seenEvents=[];s.relationshipGraph=act(s,'我见到了陈信行');assert.equal(tie(s.relationshipGraph,'羽泽鸫','陈信行'),undefined);
  s.month=30;s.seenEvents=['rs_tw_afterglow_records'];const reached=getRelationshipGraph(s);assert.equal(tie(reached,'羽泽鸫','陈信行').kind,'mentor');
});

test('observed strong ties connect two existing acquaintances without introducing others',()=>{
  const s=state();s.relationshipGraph=act(s,'我认识了张三。我认识了李四');
  const response={narrative:'你和张三吃饭时得知，张三和李四是兄弟。',relationshipUpdates:[{source:'张三',target:'李四',status:'兄弟',detail:'张三和李四是兄弟。',strength:90},{source:'张三',target:'王五',status:'兄弟',detail:'张三和王五是兄弟。',strength:90}]};
  const g=act(s,'我和张三吃饭',response);assert.equal(tie(g,'张三','李四').kind,'family');assert(!names(g).includes('王五'));
});

test('joining Afterglow creates the five direct contacts and their established mutual ties',()=>{
  const g=act(state(),'我已经加入Afterglow');assert.equal(g.nodes.length,6);assert.equal(g.edges.length,15);
  assert.equal(new Set(g.nodes.map(n=>n.id)).size,6);assert(isValidRelationshipGraph(g));
});

test('translated narration accepts evidenced structured relationships and filters untranslated rumors',()=>{
  for(const [narrative,name] of [['You met Alice Smith and discussed the workshop.','Alice Smith'],['あなたは羽泽鸫に会いました。','羽泽鸫'],['당신은 김민수를 만났습니다.','김민수'],['你認識了羽澤鶇。','羽澤鶇']]){
    const g=act(state(),'我处理日常事务',{narrative,relationshipUpdates:[{source:'player',target:name,status:'相识',detail:narrative,strength:30}]});
    assert.equal(g.nodes.length,2,narrative);
  }
});

test('round-trip graphs preserve identity, stale prose cannot overwrite changed ties, and normalization is immutable',()=>{
  const s=state();s.relationshipGraph=act(s,'我与张三结盟');s.relationshipGraph=act(s,'我与张三决裂');s.person.relationships=['张三：盟友'];
  const imported=JSON.parse(JSON.stringify(s)),before=structuredClone(imported),g=normalizeRelationshipGraph(imported);
  assert.equal(tie(g,'小林','张三').kind,'estranged');
  assert.deepEqual(imported,before);assert.equal(g.nodes.length,2);assert.deepEqual(g,normalizeRelationshipGraph({...s,relationshipGraph:g}));
});

test('malformed imports reject dangling endpoints, duplicate identities and nonfinite metrics',()=>{
  const good=act(state(),'我认识了张三');assert(isValidRelationshipGraph(good));assert(isValidRelationshipGraph(undefined));
  for(const mutate of [g=>g.edges[0].target='missing',g=>g.nodes.push(g.nodes[1]),g=>g.edges[0].strength=NaN,g=>g.nodes[1].name=undefined,g=>g.nodes[1].firstMetMonth=Infinity,g=>g.version=99]){const broken=structuredClone(good);mutate(broken);assert.equal(isValidRelationshipGraph(broken),false);}
  const orphan=structuredClone(good);orphan.edges=[];assert.deepEqual(names(normalizeRelationshipGraph({...state(),relationshipGraph:orphan})),['小林']);
});

test('untrusted structured updates are bounded and cannot inject arbitrary save fields',()=>{
  const raw=Array.from({length:200},()=>({source:'player',target:'张三',status:'朋'.repeat(100),detail:'友'.repeat(1000),strength:999,apiKey:'do-not-persist',portrait:'https://example.invalid/tracking'}));
  const rows=normalizeRelationshipUpdates(raw);assert.equal(rows.length,RELATIONSHIP_LIMITS.updates);assert.equal(rows[0].status.length,48);assert.equal(rows[0].detail.length,320);assert.equal(rows[0].strength,100);assert.equal(rows[0].apiKey,undefined);assert.equal(rows[0].portrait,undefined);
  assert.deepEqual(normalizeRelationshipUpdates({target:'张三'}),[]);
});
