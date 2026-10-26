import test from 'node:test';
import assert from 'node:assert/strict';
import {isForeignAction,worldActionClaims,filterWorldUpdatesForAction} from '../src/action-language.js';

const state={profile:{name:'小林',place:'日本'},location:'日本'};
const action=label=>({label,custom:true});
const update=(kind,region='japan',extra={})=>({kind,region,title:'发生的变化',description:'这次行动已经完成，各方开始处理后续安排。',...extra});

test('global country declarations bind to their named country and preserve the local fallback',()=>{
  const claims=worldActionClaims(action('I became the president of France.'),state);
  assert.equal(claims[0]?.region,'fra');assert.equal(claims[0]?.leader,'小林');
  assert.equal(worldActionClaims(action('I ended the civil war.'),{...state,location:'法国'})[0]?.region,'fra');
  const rows=filterWorldUpdatesForAction(action('I ended the civil war in France.'),state,[update('peace','japan'),update('peace','fra')]);
  assert.equal(rows.length,1);assert.equal(rows[0].terminatedConflict,'法国内战');
});

test('adapter identifies foreign action text and leaves simplified Chinese to the existing agency',()=>{
  assert(!isForeignAction(action('我发动日本内战')));assert(!isForeignAction(action('我加入Afterglow')));
  for(const label of ['I started a civil war in Japan.','私は日本で内戦を開始した。','나는 일본 내전을 일으켰다.','我已經發動日本內戰'])assert(isForeignAction(action(label)),label);
  assert.deepEqual(worldActionClaims(action('我发动日本内战'),state),[]);
});

test('English, Japanese, Korean and traditional declarations bind war, peace and office to the stated country',()=>{
  const cases=[['I started a civil war in Japan.','war'],['I ended the Japanese civil war.','peace'],['I became the prime minister of Japan.','leadership'],['私は日本で内戦を開始した。','war'],['私は日本の内戦を終わらせた。','peace'],['私は日本の首相になった。','leadership'],['나는 일본 내전을 일으켰다.','war'],['나는 일본 내전을 끝냈다.','peace'],['나는 일본의 총리가 되었다.','leadership'],['我已經發動日本內戰。','war'],['我已經結束日本內戰。','peace'],['我已經成為日本首相。','leadership']];
  for(const [label,kind]of cases){const claims=worldActionClaims(action(label),state);assert.equal(claims.length,1,label);assert.equal(claims[0].kind,kind,label);assert.equal(claims[0].region,'japan',label);}
});

test('hypotheses, negations, hearsay, plans, simulations and unrelated employment never authorize a world update',()=>{
  const labels=['If I started a civil war in Japan, I would win.','I did not start a civil war in Japan.','I never ended the Japanese war.','I will declare war in Japan.','I hope I became the prime minister of Japan.','I read that somebody declared war in Japan.','I met a politician who started a civil war in Japan.','I won a video game civil war in Japan.','I ended a discussion about the Japanese civil war.','I worked at a factory in Japan.','私は日本で内戦を開始したという噂を聞いた。','私は日本の内戦を終わらせたい。','私は日本の首相にならなかった。','나는 일본 내전을 시작하지 않았다.','나는 일본 내전을 시작할 계획이다.','나는 일본 공장에서 일했다.','如果我發動日本內戰，我就成為首相。','我沒有發動日本內戰。','我聽說日本內戰開始了。','我準備成為日本首相。'];
  for(const label of labels)assert.deepEqual(filterWorldUpdatesForAction(action(label),state,[update('war'),update('peace'),update('leadership'),update('public')]),[],label);
});

test('a claim cannot authorize a different country or a different type of world change',()=>{
  const rows=filterWorldUpdatesForAction(action('I ended the civil war in Japan.'),state,[update('war'),update('peace','china'),update('leadership'),update('peace')]);
  assert.equal(rows.length,1);assert.equal(rows[0].kind,'peace');assert.equal(rows[0].region,'japan');assert.equal(rows[0].conflict,null);assert.equal(rows[0].terminatedConflict,'日本内战');
});

test('explicit leadership grants only the player named by the action, never an unrelated model candidate',()=>{
  const label=action('I became the prime minister of Japan.');
  assert.deepEqual(filterWorldUpdatesForAction(label,state,[update('leadership','japan',{leader:'习近平'})]),[]);
  const [row]=filterWorldUpdatesForAction(label,state,[update('leadership','japan',{leader:'小林',government:'模型新增的绝对王权',ideology:'模型新增的意识形态',conflict:'模型新增的战争'})]);
  assert.equal(row.leader,'小林');assert.equal(row.government,'小林主持的政府');assert.equal(row.ideology,undefined);assert.equal(row.conflict,undefined);
});

test('victory assistance binds its named winner and does not grant the player a leadership post',()=>{
  const label=action('I helped Hazawa Tsugumi win the civil war in Japan.');
  const [row]=filterWorldUpdatesForAction(label,state,[update('victory','japan',{leader:'羽泽鸫'})]);
  assert.equal(row.leader,'羽泽鸫');assert.notEqual(row.leader,state.profile.name);
  assert.deepEqual(filterWorldUpdatesForAction(label,state,[update('victory','japan',{leader:'丰川祥子'})]),[]);
  assert.deepEqual(filterWorldUpdatesForAction(action('I helped someone become the prime minister of Japan.'),state,[update('leadership')]),[]);
});

test('a public invention report cannot alter the government, ideology, leader or conflict',()=>{
  const [row]=filterWorldUpdatesForAction(action('I published new research nationwide in Japan.'),state,[update('public','japan',{leader:'小林',government:'新政府',ideology:'新意识形态',conflict:null})]);
  assert(row);assert.deepEqual(Object.keys(row).sort(),['description','kind','region','title']);
  assert.deepEqual(filterWorldUpdatesForAction(action('I worked overtime in Japan.'),state,[update('public')]),[]);
});

test('global peace and Taiwan Strait peace retain the specific completed conflict, with no cross-country escalation',()=>{
  const [all]=filterWorldUpdatesForAction(action('I ended all wars worldwide.'),state,[update('peace','global')]);assert.equal(all.terminatedConflict,'all');
  const [strait]=filterWorldUpdatesForAction(action('I ended the Taiwan Strait war.'),state,[update('peace','taiwan')]);assert.equal(strait.terminatedConflict,'台海战争');
  const [taiwan]=filterWorldUpdatesForAction(action('我已經結束臺灣內戰。'),state,[update('peace','taiwan')]);assert.equal(taiwan.terminatedConflict,'台湾内战');
});

test('an unknown or ambiguous region, passive input and model-only facts do not get automatic permission',()=>{
  assert.deepEqual(worldActionClaims(action('I started a civil war.'),{profile:{name:'小林'},location:'外太空'}),[]);
  assert.deepEqual(worldActionClaims(action('I ended the Japan war and started the China war.'),state),[]);
  assert.deepEqual(worldActionClaims({...action('I started a civil war in Japan.'),passive:true},state),[]);
  assert.deepEqual(worldActionClaims({label:'I started a civil war in Japan.',custom:false},state),[]);
});

test('returned updates are bounded independent copies and do not inherit unsupported fields',()=>{
  const raw=update('war','japan',{leader:'自己',conflict:'模型编造的世界大战',arbitrary:'ignored'}),snapshot=structuredClone(raw);
  const rows=filterWorldUpdatesForAction(action('I started a civil war in Japan.'),state,Array(40).fill(raw));
  assert.equal(rows.length,4);assert(rows.every(r=>r.conflict==='日本内战'&&!r.leader&&!r.arbitrary));assert.deepEqual(raw,snapshot);
});
