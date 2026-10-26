import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeOpeningRelationships} from '../src/opening-relationships.js';
import {normalizeRelationshipGraph,updateRelationshipGraph,isValidRelationshipGraph} from '../src/relationships.js';
import {findPersona} from '../src/personas.js';
import {getContactPortrait} from '../src/portraits.js';
import {createGame,exportSave,importSave,nextContext,localEvent,advance} from '../src/engine.js';
import {buildPrompt} from '../src/deepseek.js';
import lore from '../src/data/lore.json' with {type:'json'};

const state=(backgroundText='你在当地生活，与家人和熟悉的人保持联系。',extras={})=>({seed:'opening-test-731',month:0,turn:0,history:[],profile:{name:'林晓川',age:20,place:'河南',background:'ordinary',backgroundText,...extras},person:{occupation:'学生',relationships:[],facts:[]}});
const initialize=(s,options)=>initializeOpeningRelationships(s,options);
const role=(s,name)=>s.person.openingRelationships.find(row=>row.role===name);
const graphNames=s=>s.relationshipGraph.nodes.map(n=>n.name);
const personaState=name=>{const p=findPersona(name);return state(p.backgroundText,{name:p.name,place:p.place,persona:p,lockedPersonaId:p.id});};

test('ordinary new life has stable seeded parents, saved descriptions, links and ordinary pixel portraits',()=>{
  const s=initialize(state());assert.equal(s.relationshipGraph.nodes.length,3);assert.equal(s.relationshipGraph.edges.length,3);
  for(const title of ['父亲','母亲']){const relative=role(s,title);assert(relative?.name);assert.equal(relative.lifeStatus,'living');assert(s.person.relationships.some(text=>text.startsWith(relative.name+'：')));}
  assert.equal(s.relationshipGraph.edges.find(e=>e.source!=='player').status,'共同家人');
  assert(s.relationshipGraph.edges.every(e=>!/夫妻|结婚|恩爱/.test(e.detail)));
  const contact=s.relationshipGraph.nodes.find(n=>n.id!=='player');assert.equal(getContactPortrait(s,contact).kind,'original');
  assert.deepEqual(s,initialize(state()));assert(isValidRelationshipGraph(s.relationshipGraph));
  const other=state();other.seed='different-seed';initialize(other);assert.notDeepEqual(graphNames(other),graphNames(s));
});

test('explicit orphan or absence of all relatives permits an empty opening, but not ordinary solitude',()=>{
  for(const description of ['我是孤儿。','我无亲无故。','我没有任何亲友，独自生活。'])assert.deepEqual(graphNames(initialize(state(description))),['林晓川']);
  assert(initialize(state('我独自在外地读书。')).relationshipGraph.nodes.length>1);
});

test('both parents deceased does not erase an explicit sibling or invent replacement parents',()=>{
  const s=initialize(state('父母双亡，我与妹妹相依为命。'));
  assert(role(s,'妹妹'));assert.equal(role(s,'父亲'),undefined);assert.equal(role(s,'母亲'),undefined);assert.equal(s.relationshipGraph.nodes.length,2);
  const s2=initialize(state('我是孤儿，哥哥叫林安宁，我们一起长大。'));
  assert.equal(role(s2,'哥哥').name,'林安宁');assert.equal(s2.relationshipGraph.nodes.length,2);
  const s3=initialize(state('父母双亡，我独自在当地工作。'));
  assert(role(s3,'熟人'));assert(!role(s3,'父亲'));assert(!role(s3,'母亲'));
  const s4=initialize(state('父母均已去世，我还有兄弟。'));
  assert(role(s4,'兄弟'));assert(!role(s4,'父亲'));assert(!role(s4,'母亲'));
});

test('explicit family names win over defaults and remain exact canonical contacts',()=>{
  const s=initialize(state('我的父亲叫林文安，母亲叫陈秀宁。我的哥哥叫林小安。'));
  assert.equal(role(s,'父亲').name,'林文安');assert.equal(role(s,'母亲').name,'陈秀宁');assert.equal(role(s,'哥哥').name,'林小安');
  assert.equal(s.relationshipGraph.nodes.length,4);assert.equal(new Set(graphNames(s)).size,4);
  const described=initialize(state('父亲张文安是一名工人，母亲陈秀宁在当地医院工作。'));
  assert.equal(role(described,'父亲').name,'张文安');assert.equal(role(described,'母亲').name,'陈秀宁');
});

test('single-parent and explicitly absent parent descriptions cannot create an extra active parent',()=>{
  const s=initialize(state('我在单亲家庭长大，由母亲独自抚养。'));
  assert(role(s,'母亲'));assert.equal(role(s,'父亲'),undefined);
  const dead=initialize(state('父亲林伟已经去世，母亲叫陈文宁。'));
  assert.equal(role(dead,'父亲').lifeStatus,'deceased');assert.match(role(dead,'父亲').detail,/去世/);
  assert.equal(dead.relationshipGraph.nodes.find(n=>n.name==='林伟').lifeStatus,'deceased');
  const unnamed=initialize(state('父亲因病去世，母亲很早就死了。'));
  assert(unnamed.person.openingRelationships.every(row=>row.lifeStatus==='deceased'));
  assert(!graphNames(unnamed).some(name=>/因病|很早/.test(name)));
  const single=initialize(state('我在单亲家庭长大。'));assert(role(single,'家长'));assert(!role(single,'父亲'));assert(!role(single,'母亲'));
});

test('ordinary elderly opening does not presume still-living elderly parents',()=>{
  const s=initialize(state('在当地退休生活。',{age:80}));
  assert(!role(s,'父亲'));assert(!role(s,'母亲'));assert(role(s,'熟人'));
});

test('named hidden relatives and known contacts reuse the local archive without assuming survival',()=>{
  const s=initialize(personaState('德仁'));
  for(const name of ['明仁','美智子','雅子','爱子'])assert(graphNames(s).includes(name),name);
  assert(s.person.openingRelationships.every(r=>!r.generated&&r.source==='persona-family'&&r.lifeStatus==='unknown'&&r.sourceRefs.length));
  const ling=initialize(personaState('令计划'));
  assert.equal(ling.person.openingRelationships.find(r=>r.name==='令谷').lifeStatus,'deceased');
  const mao=initialize(personaState('毛远新'));
  assert(graphNames(mao).includes('毛泽民'));assert(graphNames(mao).includes('朱旦华'));assert(graphNames(mao).includes('毛泽东'));assert(!graphNames(mao).includes('薄熙来'));
});

test('missing real family names remain unnamed, reference-required and unknown; unknown archives add no fictional relatives',()=>{
  const s=initialize(personaState('蔡徐坤')),mother=role(s,'母亲');
  assert.equal(mother.name,'母亲');assert.equal(mother.lifeStatus,'unknown');assert(mother.referenceRequired);
  const node=s.relationshipGraph.nodes.find(n=>n.name==='母亲');assert.equal(node.referenceRequired,true);assert.equal(node.lifeStatus,'unknown');
  const unknown=initialize(personaState('陆昊'));assert.equal(unknown.person.openingRelationships.length,0);assert(!unknown.relationshipGraph.nodes.some(n=>n.familyRole==='父亲'));
});

test('band personas reuse existing established band relationships and do not invent private family members',()=>{
  const s=initialize(personaState('羽泽鸫'));
  assert.equal(s.relationshipGraph.nodes.length,5);assert.equal(s.person.openingRelationships.length,0);
  assert(s.relationshipGraph.edges.every(e=>e.status==='乐队伙伴'));assert(!graphNames(s).includes('丰川祥子'));
});

test('generated local families adapt names and work vocabulary to Taiwan, Japan, Korea and Europe',()=>{
  const tw=initialize(state('家人在当地公共服务机构工作。',{place:'中国台湾',background:'cadre'}));
  assert(tw.person.openingRelationships.every(r=>/^[\p{Script=Han}]+$/u.test(r.name)));assert(tw.person.relationships.every(t=>!/(?:党员|干部|街道办)/.test(t)));
  const jp=initialize(state('家人在当地工作。',{place:'日本',name:'山田悠人'}));assert.match(role(jp,'父亲').name,/^山田/);
  const kr=initialize(state('家人在当地工作。',{place:'韩国',name:'김서준'}));assert.match(role(kr,'父亲').name,/^김[가-힣]+$/);
  const fr=initialize(state('家人在当地工作。',{place:'法国',name:'Camille Bernard'}));assert.match(role(fr,'父亲').name,/^[A-Za-zÀ-ÿ]+ [A-Za-zÀ-ÿ]+$/);
  for(const place of ['阿富汗','伊朗']){const s=initialize(state('家人在当地工作。',{place,name:'فرید'}));assert.match(role(s,'父亲').name,/^[\p{Script=Arabic}\s]+$/u);}
  const ua=initialize(state('家人在当地工作。',{place:'乌克兰',name:'Олексій'}));assert.match(role(ua,'父亲').name,/^[\p{Script=Cyrillic}\s]+$/u);
});

test('JSON reload and repeated initialization keep the same people, statuses and avatars',()=>{
  const original=initialize(state()),restored=JSON.parse(JSON.stringify(original));
  initialize(restored,{legacy:true});assert.deepEqual(restored,original);
  assert.deepEqual(normalizeRelationshipGraph(restored),restored.relationshipGraph);
  const node=restored.relationshipGraph.nodes[1];assert.equal(getContactPortrait(restored,node).src,getContactPortrait(original,node).src);
});

test('old played saves migrate evidence only and do not seed random living relatives',()=>{
  const s=state();s.month=50;s.turn=50;s.history=[{action:{label:'父亲已经去世'},consequence:'你处理了父亲的后事。'}];
  initialize(s,{legacy:true});assert.equal(s.person.openingRelationships.length,0);assert.deepEqual(graphNames(s),['林晓川']);
  const named=state('父亲叫林文安，母亲叫陈秀宁。');named.month=50;named.person.facts=['父亲已经去世。'];
  initialize(named,{legacy:true});assert.equal(role(named,'父亲').lifeStatus,'deceased');assert.equal(role(named,'母亲').lifeStatus,'unknown');
  const clone=JSON.parse(JSON.stringify(named));initialize(clone,{legacy:true});assert.deepEqual(clone,named);
});

test('existing estrangement remains stronger than old opening family descriptions',()=>{
  const s=state('父亲叫林文安。');s.relationshipGraph=updateRelationshipGraph(s,{action:{custom:true,label:'我与林文安断绝关系'},success:true});
  initialize(s,{legacy:true});const father=s.relationshipGraph.nodes.find(n=>n.name==='林文安');
  assert.equal(s.relationshipGraph.edges.find(e=>e.target===father.id).kind,'estranged');
});

test('opening metadata stays bounded and rejects invalid persisted status fields',()=>{
  const s=initialize(state()),bad=structuredClone(s.relationshipGraph);bad.nodes[1].lifeStatus='resurrected-by-import';
  assert.equal(isValidRelationshipGraph(bad),false);
  assert(isValidRelationshipGraph(normalizeRelationshipGraph(s)));
});

test('real create-save-load-advance flow retains initial relatives, pixel identities and API context',()=>{
  const initial=createGame({...state().profile,seed:'opening-integration-roundtrip'},lore);
  assert.equal(initial.relationshipGraph.nodes.length,3);
  const contacts=initial.relationshipGraph.nodes.filter(node=>node.id!=='player'),edges=structuredClone(initial.relationshipGraph.edges),records=structuredClone(initial.person.openingRelationships);
  let current=importSave(exportSave(initial),lore);
  assert.deepEqual(current,initial);
  const action={label:'照常生活',passive:true};
  for(let i=0;i<3;i++){
    const context=nextContext(current,lore,action),prompt=JSON.parse(buildPrompt(current,action,lore).user);
    for(const contact of contacts)assert(prompt.currentIdentity.relationships.some(row=>row.startsWith(contact.name+'：')));
    const next=advance(current,action,localEvent(context.state,lore,action),null,lore);
    assert.equal(next.month,current.month+1);assert.equal(next.turn,current.turn+1);
    assert.deepEqual(next.person.openingRelationships,records);
    assert.deepEqual(next.relationshipGraph.nodes.filter(node=>node.id!=='player'),contacts);
    assert.deepEqual(next.relationshipGraph.edges,edges);
    current=importSave(exportSave(next),lore);
    assert.deepEqual(current,next);
  }
  for(const contact of contacts)assert.equal(getContactPortrait(current,contact).src,getContactPortrait(initial,contact).src);
});

test('real hidden-person creation and reload leave unreferenced family portraits empty',()=>{
  const created=createGame({...state().profile,name:'蔡徐坤',seed:'opening-real-family'},lore);
  for(const current of [created,importSave(exportSave(created),lore)]){
    const mother=current.relationshipGraph.nodes.find(node=>node.familyRole==='母亲');
    assert(mother);assert.equal(mother.referenceRequired,true);assert.equal(mother.lifeStatus,'unknown');
    const portrait=getContactPortrait(current,mother);assert.equal(portrait.kind,'missing');assert.equal(portrait.src,null);
  }
});

test('deceased relatives remain deceased through engine normalization, monthly advance and legacy import',()=>{
  const initial=createGame({...state().profile,name:'令计划',seed:'opening-deceased-family'},lore),child=initial.relationshipGraph.nodes.find(node=>node.name==='令谷');
  assert(child);assert.equal(child.lifeStatus,'deceased');
  const assertDeceased=current=>{
    const graph=normalizeRelationshipGraph(current),node=graph.nodes.find(row=>row.id===child.id),edge=graph.edges.find(row=>row.source==='player'&&row.target===node.id);
    assert.equal(node.lifeStatus,'deceased');assert.match(node.detail,/去世/);assert.match(edge.status,/已故/);assert.match(edge.detail,/去世/);
    assert.equal(getContactPortrait(current,node).kind,'missing');
  };
  assertDeceased(initial);
  const restored=importSave(exportSave(initial),lore);assertDeceased(restored);
  const action={label:'照常生活',passive:true},context=nextContext(restored,lore,action),next=advance(restored,action,localEvent(context.state,lore,action),null,lore);
  assertDeceased(next);assertDeceased(importSave(exportSave(next),lore));
  const legacy=JSON.parse(exportSave(next));
  delete legacy.game.person.openingRelationshipsVersion;delete legacy.game.person.openingRelationships;delete legacy.game.person.openingRelationshipsMode;
  for(const node of legacy.game.relationshipGraph.nodes){delete node.lifeStatus;delete node.familyRole;delete node.referenceRequired;}
  const migrated=importSave(JSON.stringify(legacy),lore);
  assert.equal(migrated.person.openingRelationshipsMode,'evidence-migration');assertDeceased(migrated);
});
