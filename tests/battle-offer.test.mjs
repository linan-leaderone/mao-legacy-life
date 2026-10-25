import test from 'node:test';
import assert from 'node:assert/strict';
import {detectLocalBattle} from '../src/battle-offer.js';

const state = (overrides = {}) => ({seed:'battle-offer-tests',turn:7,location:'日本',person:{},current:{narrative:'你处理手头的工作，按时回家休息。'},...overrides});
const detect = (label, overrides = {}) => detectLocalBattle(state(overrides),{label});

test('ten total participants are turn based and eleven switch to realtime', () => {
  const ten = detect('我和九名敌人交战');
  assert.deepEqual([ten.enemyCount,ten.allyCount,ten.participantCount,ten.combatMode],[9,0,10,'turn-based']);
  const eleven = detect('我与十名敌人交战');
  assert.deepEqual([eleven.enemyCount,eleven.participantCount,eleven.combatMode],[10,11,'realtime']);
  assert.equal(detect('我在街口与敌人交战，双方共十一人').participantCount,11);
  assert.equal(detect('我在街口与敌人交战，双方共十人').combatMode,'turn-based');
  assert.equal(detect('双方共十一人交战').participantCount,11);
  assert.equal(detect('双方共十人交战').combatMode,'turn-based');
});

test('companions are counted without counting the protagonist twice', () => {
  for (const label of ['我带4名队友迎战5名敌军','我带四名队友迎战五名敌军']) {
    const offer = detect(label);
    assert.deepEqual([offer.enemyCount,offer.allyCount,offer.participantCount],[5,4,10]);
  }
  const inclusive = detect('我和队友共五人，对面六人，我们正在交战');
  assert.deepEqual([inclusive.enemyCount,inclusive.allyCount,inclusive.participantCount],[6,4,11]);
  const team = detect('我们一行五人与对方五人交战');
  assert.deepEqual([team.enemyCount,team.allyCount,team.participantCount],[5,4,10]);
  const allies = detect('我带两名队友和三名护卫迎战四名敌人');
  assert.deepEqual([allies.enemyCount,allies.allyCount,allies.participantCount],[4,5,10]);
  const troops = detect('我率领九名士兵与十名敌军交战');
  assert.deepEqual([troops.enemyCount,troops.allyCount,troops.participantCount],[10,9,20]);
  assert.equal(detect('我率领一支百人队伍与敌军交战').allyCount,99);
});

test('human and zombie enemy counts support Chinese and Arabic numbers and broad scale', () => {
  for (const [label,count] of [['我遇到二十五只丧尸',25],['我在街口遭遇99只丧尸',99],['我迎战一百二十三名敌军',123],['我遭遇上百只丧尸',100],['我与十多名敌人交战',11],['我迎战两千名敌军',2000]]) {
    const offer = detect(label);
    assert.equal(offer.enemyCount,count,label);
    assert.equal(offer.combatMode,'realtime');
  }
  assert.equal(detect('我在街口遭遇三只丧尸').enemyKind,'zombie');
  assert.equal(detect('我在街口被一名歹徒袭击').enemyKind,'human');
  assert.equal(detect('我迎战千军').combatMode,'realtime');
  assert.equal(detect('我亲自参加大规模战斗').combatMode,'realtime');
  assert.ok(detect('我与敌人交战').participantCount<=10);
  assert.ok(detect('我迎战99999999名敌军').enemyCount<=10000);
});

test('news, declaration, enlistment, training and friendly meetings do not start a personal fight', () => {
  for (const label of ['台湾爆发战争','我发动了日本内战','我命令军队开火','我派遣部队去攻击敌人','我参军','我参加军事训练和射击练习','我在电视上看敌军交战','我在游戏里与九名敌人战斗','我看电影，主角与十人交战','我和九名队友在街口汇合','我和队友进行格斗切磋','我在街口旁观两人打架','我在餐厅打工','我挥刀切菜','我阅读战斗策略','我该怎么与敌人交战','我攻击这个论点','继续上班','下个月']) assert.equal(detect(label),null,label);
  assert.equal(detect('继续上班',{pendingNews:[{description:'门外三名敌人向你开火。'}],history:[{event:{narrative:'敌军正在围攻你。'}}]}),null);
  assert.equal(detect('出门采购',{current:{narrative:'你在电视新闻里看到台湾双方交战的报道。'}}),null);
});

test('negations, hypotheticals and previous or resolved fights are excluded', () => {
  for (const label of ['假如我遇到三只丧尸','如果我遇到敌军，我会与他们交战','我没有遇到丧尸','我不与敌军交战','我未与三名敌军交战','我不想与敌人打架','我已经清除了门外的丧尸','我已经击退十名敌人','我回想上月与敌军交战的经历','昨天我与十名敌人交战']) assert.equal(detect(label),null,label);
  for (const narrative of ['上月你在街口遇到了三只丧尸。','此前你与敌军交战。','你已经消灭了门外的丧尸。','你回想曾经遭遇感染者的事情。','你与三名敌人交战。']) assert.equal(detect('在家读书',{current:{narrative}}),null,narrative);
});

test('present personal danger remains separate from older echoes and new actions take precedence', () => {
  const current = {narrative:'上月你在街口遇到十只丧尸。门外现在有两只丧尸正在向你靠近。'};
  assert.equal(detect('查看门外',{current}).enemyCount,2);
  assert.equal(detect('我与九名敌人交战',{current}).enemyKind,'human');
  assert.equal(detect('我与九名敌人交战',{current}).enemyCount,9);
  assert.equal(detect('我已经清除了门外的丧尸',{current}),null);
  assert.equal(detect('我绕开门外的丧尸安全返回家中',{current}),null);
  assert.equal(detect('我没有遇到丧尸',{current}),null);
  assert.equal(detect('查看门外',{current:{narrative:'门外出现了两只丧尸，正在向你靠近。'}}).enemyCount,2);
  assert.equal(detect('举起盾牌',{current:{narrative:'三名敌人正在朝你开火。'}}).enemyCount,3);
});

test('offers are deterministic and completed/dead lives do not open encounters', () => {
  assert.deepEqual(detect('我与敌人交战'),detect('我与敌人交战'));
  assert.deepEqual(JSON.parse(JSON.stringify(detect('我遇到丧尸'))),detect('我遇到丧尸'));
  assert.equal(detect('我与敌人交战',{ended:true}),null);
  assert.equal(detect('我与敌人交战',{person:{deceased:true}}),null);
  assert.equal(detectLocalBattle(state(),{label:'我与敌人交战',meta:{encounterGame:{}}}),null);
  assert.equal(detectLocalBattle(null,{label:'我与敌人交战'}),null);
});
