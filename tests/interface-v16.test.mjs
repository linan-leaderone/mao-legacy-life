import {getPlayerPosition} from '../src/player-position.js';
import {countryRegionNames} from '../src/countries.js';
import {storyParagraphs} from '../src/story-flow.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import lore from '../src/data/lore.json' with {type:'json'};
import {createGame,STAT_NAMES,currentAge,ageLabel,dateLabel,worldHistory} from '../src/engine.js';
import {backgroundsFor,regionContext} from '../src/regions.js';
import {getPoliticalActors} from '../src/personas.js';
import {getPortrait} from '../src/portraits.js';
import {isOceanFish} from '../src/fish-game.js';
import {normalizeLanguage,translateUI,convertChinese,protectedIdentityValues} from '../src/language.js';

const source=readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import .+;\r?\n/gm,'').replace(/initializeIOSInstall\(\);\s*render\(\);\s*$/,'');
const fresh=()=>createGame({name:'林远',age:22,place:'上海',background:'ordinary',seed:'ui-v16',points:{intelligence:5,family:5,fitness:5,appearance:5}},lore);
function ui(game){
  const scope={countryRegionNames,getPlayerPosition,storyParagraphs,convertChinese,protectedIdentityValues,localStorage:{getItem:()=>null,setItem(){}},normalizeSettings:value=>value,normalizeLanguage,translateUI,lore,STAT_NAMES,currentAge,ageLabel,dateLabel,worldHistory,backgroundsFor,regionContext,getPoliticalActors,isOceanFish,getPortrait,fixture:game};
  vm.createContext(scope);vm.runInContext(source,scope);vm.runInContext('game=fixture;modal=(title,body)=>{globalThis.lastModal=body;return {querySelectorAll:()=>[]};};',scope);
  return expression=>vm.runInContext(expression,scope)??scope.lastModal;
}
test('travelled dates use positive calendar months and independent record numbers',()=>{
  const s=fresh();s.month=-528;s.turn=1;s.history=[{}];s.person.ageOverride={months:264,turn:1};
  const run=ui(s),html=run('playScreen()');
  assert.match(html,/PERSONAL FILE \/ 0002/);assert.match(html,/<span>1976<\/span><strong>01<small>月/);assert.match(html,/22 岁 0 个月/);
  s.month=-1;assert.match(run('playScreen()'),/<span>2019<\/span><strong>12<small>月/);
});
test('age overrides hide adult-only statistics now and in records of becoming a child',()=>{
  const s=fresh();s.person.ageOverride={months:168,turn:0};s.stats.promiscuity=25;s.person.ideology='社会民主主义';
  const run=ui(s);assert.doesNotMatch(run('statBlock()'),/淫乱值/);assert.match(run('statBlock()'),/社会民主主义/);
  s.person.ageOverride.months=264;assert.match(run('statBlock()'),/淫乱值/);
  assert.equal(run("visibleStat('promiscuity',{actionResult:{actionAge:{years:22},declarations:{ageMonths:168}}})"),false);
  assert.equal(run("visibleStat('promiscuity',{actionResult:{actionAge:{years:25}}})"),true);
});
test('income and expenditure remain visible when they cancel to a zero balance',()=>{
  const s=fresh();s.monthlyLedger=[{label:'兼职工资',amount:3000},{label:'房租及日常支出',amount:-3000}];s.statChanges=[];
  const html=ui(s)('playScreen()');assert.match(html,/本月收支/);assert.match(html,/兼职工资/);assert.match(html,/房租及日常支出/);assert.match(html,/结余 <strong>0<\/strong>/);
});
test('regional panels prioritize established leadership over an old headline',()=>{
  const s=fresh();s.worldState.china={title:'旧的领导会议',description:'旧的领导安排',month:0};s.worldOverrides.china={leader:'林远',government:'已经设立的居民议事会',ideology:'公共自治',month:0,conflict:null};
  const html=ui(s)('openWorld()');assert.match(html,/当前领导<\/dt><dd>林远/);assert.match(html,/你参与建立的安排/);assert.match(html,/已经设立的居民议事会/);assert.doesNotMatch(html,/旧的领导会议|旧的领导安排/);
});
test('other figures have a distinct public-activity section without being attributed to the player',()=>{
  const s=fresh();s.npcPressure={left:9};s.npcActivity=[{actor:'韩东方',month:0,ideology:'劳工民主社会主义',pressure:'left',delta:2}];
  const html=ui(s)('openWorld()'),section=html.split('<section class="public-activity">')[1].split('</section>')[0];
  assert.match(section,/各方正在推动的变化/);assert.match(section,/韩东方/);assert.match(section,/劳工民主社会主义/);assert.doesNotMatch(section,/你的主张|你推动/);
  s.month=-528;assert.doesNotMatch(ui(s)('openWorld()'),/各方正在推动的变化|公开活动的人物/);
});
test('fish entry disappears once the body becomes human or the life ends',()=>{
  const s=fresh();s.specialLife={kind:'deng_ocean',body:'small_fish'};const run=ui(s);assert.match(run('playScreen()'),/id="fish-feed"/);
  s.specialLife.body='human';assert.doesNotMatch(run('playScreen()'),/id="fish-feed"/);
  s.specialLife.body='small_fish';s.ended=true;assert.doesNotMatch(run('playScreen()'),/id="fish-feed"/);
});
test('the month uses a continuous story and does not duplicate an included action outcome',()=>{
  const s=fresh();s.history=[{}];s.current.consequence='你完成了三处派送。';s.current.narrative='你完成了三处派送。之后核对明天的收件地址。';
  const html=ui(s)('playScreen()');assert.doesNotMatch(html,/上月回响|此前的经历/);assert.equal(html.split('你完成了三处派送。').length-1,1);assert.match(html,/story-continuous/);
});
test('hidden people without a reference retain a blank portrait; fish bodies use the supplied likeness',()=>{
  const s=fresh();s.profile.lockedPersonaId='unphotographed-person';
  assert.match(ui(s)('portraitCard()'),/暂无肖像/);assert.doesNotMatch(ui(s)('portraitCard()'),/<img/);
  s.specialLife={kind:'deng_ocean',body:'small_fish'};assert.match(ui(s)('portraitCard()'),/characters\/deng-blobfish-pixel\.webp/);
});
