import {affirmedClauses} from './agency.js';

const MAX_SIDE = 10000;
const NUMBER = '(?:(?:上|数|几)(?:十|百|千|万)|[0-9]{1,8}|[零〇一二两三四五六七八九十百千万]+)';
const QUANTITY = `(${NUMBER})(?:\\s*(余|多))?\\s*(?:个|名|位|只|头)?`;
const FRIEND = '(?:队友|同伴|伙伴|朋友|战友|友军|部下|随从|护卫|保镖)';
const ENEMY = '(?:丧尸|感染者|敌人|敌军|敌兵|敌方士兵|敌方人员|敌方武装|对手|歹徒|匪徒|劫匪|强盗|打手|暴徒|袭击者|杀手|武装分子|武装人员|攻击者)';
const FIGHT = /交战|迎战|接战|激战|战斗|作战|搏斗|肉搏|打架|打斗|枪战|互射|对射|开火|开枪|射击|挥刀|挥拳|围攻|围殴|攻击|袭击|冲锋|突围|遭到袭击|被打|打起来|打成一团|打一架/;
const OBSERVED = /新闻|报道|电视|广播|听说|据说|传闻|消息称|电影|电视剧|纪录片|游戏(?:里|中|内)|玩游戏|电子游戏|小说|故事里|梦见|做梦|想象|假想|假设|假如|如果|要是|倘若|假装|模拟|演习|训练|靶场|射击场|打靶|热身|切磋|练习|观看|观战|目睹|旁观|围观|(?:阅读|学习|研究|讨论|谈论|分析|了解).{0,16}(?:战斗|战争|打架|攻击|射击)|(?:如何|怎么|是否|能否).{0,16}(?:交战|战斗|打架|攻击)|(?:攻击|抨击).{0,10}(?:论点|理论|观点|政策|制度|文章|服务器)|挥刀切菜|挥刀劈柴|开枪打气球/;
const PAST = /上月|上个月|去年|昨天|昨日|此前|先前|之前|曾经|曾遇到|回忆|回想|那次遭遇|战斗结束后|交战结束后/;
const RESOLVED = /(?:已经|早已|已然|全都|全部|全数|彻底)(?:被)?(?:消灭|击退|制服|清除|歼灭|击败|打败)|(?:战斗|交战|枪战|打斗|战事)(?:已经|早已|已)?结束|(?:已经|早已|已)(?:脱离战斗|脱离交战|安全撤离)|(?:结束|停止|终止|避免|回避|拒绝)(?:了)?(?:这场|任何|所有|此次)?(?:战斗|交战|冲突)|(?:不|未|没)(?:曾|再|会|愿|肯|想)?(?:与.{0,12})?(?:交战|迎战|战斗|打架|开火|攻击)|(?:没有|并未|未曾)(?:遇到|遭遇|碰到).{0,12}(?:敌人|敌军|丧尸|感染者)|绕开.{0,12}(?:敌人|敌军|丧尸|感染者)|躲开.{0,12}(?:敌人|敌军|丧尸|感染者)/;
const LARGE = /大规模|大批|上百|数百|成百|上千|数千|千军|军团|整个营|整个团|整支部队|整支军队|尸潮|尸群|成群|蜂拥/;
const hash = value => { let h = 2166136261; for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const bounded = (value, min = 0) => Math.min(MAX_SIDE, Math.max(min, Math.round(Number(value) || 0)));

function numberValue(raw, excess) {
  if (!raw) return null;
  let value;
  if (/^\d+$/.test(raw)) value = Number(raw);
  else {
    const approximate = raw.match(/^(上|数|几)(十|百|千|万)$/);
    if (approximate) value = ({十:10,百:100,千:1000,万:10000}[approximate[2]]) * (approximate[1] === '上' ? 1 : 3);
    else {
      const digits = {零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
      let total = 0, section = 0, digit = 0;
      for (const c of raw) {
        if (Object.hasOwn(digits, c)) digit = digits[c];
        else if (c === '万') { total += (section + digit || 1) * 10000; section = 0; digit = 0; }
        else { section += (digit || 1) * ({十:10,百:100,千:1000}[c] || 0); digit = 0; }
      }
      value = total + section + digit;
    }
  }
  return bounded(value + (excess ? 1 : 0));
}

function readNumber(match) { return match ? numberValue(match[1], match[2]) : null; }

function countParticipants(text, seed, enemyKind) {
  // Counts with 我方/我们 include the protagonist. 带 N 名队友 does not.
  const ownTotal = readNumber(text.match(new RegExp(`(?:我们|我方|己方|我和(?:队友|同伴|伙伴|朋友|战友))(?:一方|这边|这队|这组|一行)?(?:一共|总共|共有|共|有|只有)?\\s*${QUANTITY}\\s*(?:人|队友|同伴|士兵|战士)`)));
  let allyCount = ownTotal === null ? 0 : bounded(ownTotal - 1);
  if (ownTotal === null) {
    const friendMatches = [...text.matchAll(new RegExp(`${QUANTITY}\\s*${FRIEND}`, 'g'))];
    allyCount = bounded(friendMatches.reduce((sum, match) => sum + readNumber(match), 0));
    const troops = readNumber(text.match(new RegExp(`我(?:带领|带着|率领|率|带)\\s*${QUANTITY}\\s*(?:士兵|军人|战士)`)));
    if (troops !== null) allyCount = bounded(allyCount + troops);
    const fullTeam = readNumber(text.match(new RegExp(`我(?:带领|带着|率领|率|带)(?:一支|一队)?\\s*${QUANTITY}\\s*人(?:队伍|小队|部队|队)`)));
    if (fullTeam !== null) allyCount = bounded(allyCount + fullTeam - 1);
  }
  const overall = readNumber(text.match(new RegExp(`(?:双方|敌我双方|参战双方|现场|在场|参战人员|参与战斗的人|总人数|总计|总共)(?:一共|总共|合计|共有|总计|有|共|为|是)?\\s*${QUANTITY}\\s*(?:人|参战者|战斗人员)`)));
  const enemyMatches = [...text.matchAll(new RegExp(`${QUANTITY}\\s*${ENEMY}`, 'g'))];
  let enemyCount = enemyMatches.length ? bounded(enemyMatches.reduce((sum, match) => sum + readNumber(match), 0)) : null;
  if (enemyCount === null) enemyCount = readNumber(text.match(new RegExp(`(?:对面|对方|敌方|敌军|敌兵|敌人|丧尸|感染者)(?:一方|那边)?(?:一共|总共|共有|共|有|只有|来了|来了约|约有)?\\s*${QUANTITY}\\s*(?:人|丧尸|感染者|士兵|战士|敌人)?`)));
  if (overall !== null && overall >= 2) {
    // An explicit overall head count is authoritative, while keeping named allies.
    allyCount = Math.min(allyCount, overall - 2);
    enemyCount = overall - allyCount - 1;
  }
  if (enemyCount === null) {
    const unnamed = text.match(new RegExp(`(?:与|和|迎战|攻击|围攻|面对|遭遇|被|对付)\\s*${QUANTITY}\\s*(?:人|士兵|军人|警察|青年|陌生人|男子|女人|男人)(?!质|群)`));
    enemyCount = readNumber(unnamed);
  }
  if (enemyCount === null) enemyCount = LARGE.test(text) ? 20 + seed % 12 : (enemyKind === 'zombie' ? 3 : 2) + seed % 3;
  if (enemyCount === 0) return null;
  enemyCount = bounded(enemyCount, 1);
  const participantCount = 1 + allyCount + enemyCount;
  return {enemyCount, allyCount, participantCount, combatMode:participantCount <= 10 ? 'turn-based' : 'realtime'};
}

function candidateSentences(text) {
  return String(text || '').split(/[。！？；;\n]/).map(sentence => sentence.trim()).filter(Boolean).flatMap(sentence => {
    if (OBSERVED.test(sentence) || PAST.test(sentence) || RESOLVED.test(sentence)) return [];
    const affirmative = affirmedClauses(sentence).join('，');
    return affirmative ? [affirmative] : [];
  });
}

function localFight(text, fromAction) {
  const zombie = /丧尸|感染者|尸群|尸潮/.test(text);
  const self = /我|你|本人|自己/.test(text);
  const nearby = /身边|身旁|附近|周围|眼前|街口|门外|路上|迎面|面前|屋内|房间里/.test(text);
  if (zombie) {
    const encounter = /遭遇|遇到|遇见|发现|出现|围住|扑来|扑向|靠近|追赶|正在追|拦住|堵住|冲过来/.test(text);
    return ((self || nearby) && encounter) || (self && FIGHT.test(text));
  }
  if (!FIGHT.test(text)) return false;
  // National declarations and remote command are distinct from fighting nearby.
  if (/发动.{0,16}(?:战争|内战)|(?:宣布|宣告).{0,12}(?:战争|开战)|命令.{0,20}(?:进攻|开火|攻击)|派遣.{0,20}(?:部队|军队)/.test(text) && !/亲自|亲身|冲上|我在前线|我在战场|你在前线|你在战场/.test(text)) return false;
  if (!self) return fromAction && /^(?:与|和|跟|被|迎战|反击|攻击|对付|突围|冲锋)|^(?:双方|参战双方).{0,20}(?:交战|战斗|打斗|开火)/.test(text);
  if (!fromAction && !/正在|现在|此刻|眼前|扑向|冲向|朝你|向你|围住你|包围你|袭击你|攻击你|你遭到|你被.{0,12}(?:围攻|袭击)/.test(text)) return false;
  return true;
}

/** Detect only an immediate personal encounter; global news never enters this parser. */
export function detectLocalBattle(state, action = {}) {
  if (!state || state.ended || state.person?.deceased || action.meta?.encounterGame) return null;
  const label = String(action.label || '');
  const seed = hash(`${state.seed}:${state.turn ?? state.history?.length ?? 0}:${label}:battle`);
  const actionSentences = candidateSentences(label);
  const currentSentences = candidateSentences(state.current?.narrative);
  let description = actionSentences.find(sentence => localFight(sentence, true));
  // A completed retreat/resolution takes precedence over the page's earlier danger.
  if (!description && RESOLVED.test(label)) return null;
  if (!description) description = currentSentences.find(sentence => localFight(sentence, false));
  if (!description) return null;
  const enemyKind = /丧尸|感染者|尸群|尸潮/.test(description) ? 'zombie' : 'human';
  const counts = countParticipants(description, seed, enemyKind);
  if (!counts) return null;
  return {enemyKind, ...counts, description:description.slice(0,600), enemyType:enemyKind === 'human' ? 'human' : /奔跑|敏捷|快速/.test(description) ? 'runner' : /重型|巨大|强壮/.test(description) ? 'brute' : 'mixed', terrain:/公园|山林|树林|草地/.test(description) ? 'park' : /工厂|仓库|车间/.test(description) ? 'industrial' : 'street'};
}
