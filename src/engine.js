import lifeEvents from './data/life-events.json' with {type:'json'};
import newsData from './data/news.json' with {type:'json'};
import {isForeignAction,filterWorldUpdatesForAction} from './action-language.js';
import {backgroundsFor,regionContext,newsExposure,regionForPlace} from './regions.js';
import {findPersona,lockPersonaProfile,personaAge,getPoliticalActors} from './personas.js';
import {freedomMode,declarationPlan,settlementPlan,affirmedClauses,monthNumber,validateAgencyRecord} from './agency.js';
import {proseIssues,tidyLocalProse} from './narrative.js';
import {initializeSpecialLife,isSpecialLife,validateSpecialLife,resolveSpecialAction,advanceSpecialLife,specialLocalEvent} from './special-lives.js';
import {continuityNarrative} from './continuity.js';
import {getEncounterOffer,validateEncounterResult,encounterResultEffect} from './encounter-games.js';
import {initializeEncounterState,prepareEncounterState,infectionEffect,validateEncounterState} from './encounter-state.js';
import {normalizeCharacterIdentity} from './character-identity.js';
import {normalizeLanguage,localizeEvent,localizeNews} from './language.js';
import {normalizeRelationshipGraph,updateRelationshipGraph,normalizeRelationshipUpdates,isValidRelationshipGraph} from './relationships.js';
export const PLACES = ['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','香港','澳门','中国台湾','日本'];
export const BACKGROUNDS = [
  {id:'ordinary',name:'普通家庭',detail:'在城市与乡镇之间，寻找自己的位置。',funds:8000,knowledge:40,connections:35},
  {id:'worker',name:'工人家庭',detail:'工厂、宿舍与工友，是你认识世界的起点。',funds:5000,knowledge:35,connections:45},
  {id:'rural',name:'乡村出身',detail:'土地和家人留在身后，前路由你决定。',funds:3000,knowledge:30,connections:40},
  {id:'research',name:'科研家庭',detail:'从实验室的灯光里，看见技术与时代。',funds:15000,knowledge:65,connections:30},
  {id:'cadre',name:'干部家庭',detail:'熟悉组织的语言，也承担家庭的期待。',funds:12000,knowledge:45,connections:65},
  {id:'business',name:'商人家庭',detail:'账本、市场与不断变化的机会。',funds:35000,knowledge:40,connections:55},
  {id:'custom',name:'自定义背景',detail:'把经历、身份、目标和重要关系写下来。',funds:8000,knowledge:40,connections:35}
];
export const STAT_NAMES={intelligence:'智力',family:'家境',fitness:'体力',appearance:'颜值',influence:'影响力',health:'健康',funds:'资金',connections:'人脉',stress:'压力',morality:'道德',promiscuity:'淫乱值',charisma:'魅力'};
export const POINT_STATS=['intelligence','family','fitness','appearance'];
export const REGIONS={china:'中国大陆',taiwan:'中国台湾',japan:'日本',hongkong:'香港',macau:'澳门',korea:'韩国',europe:'欧洲',global:'国际'};
export const dateLabel=m=>`${2020+Math.floor(m/12)} 年 ${String(monthNumber(m)).padStart(2,'0')} 月`;
export function currentAge(s){const a=s.person?.ageOverride;if(a){const months=Math.max(0,a.months+(s.turn??s.history?.length??0)-a.turn);return {years:Math.floor(months/12),months:months%12};}const exact=s.profile.birthDate?personaAge({birthDate:s.profile.birthDate},s.month):null;const months=Math.max(0,(s.profile.startAgeMonths??s.profile.age*12)+s.month);return exact||{years:Math.floor(months/12),months:months%12};}
export const ageLabel=s=>{const a=currentAge(s);if(s.person?.ageOverride)return `${a.years} 岁 ${a.months} 个月`;if(isSpecialLife(s))return `距出生 ${a.years} 年${Number.isInteger(s.specialLife.bodyAge)?` · 身体约 ${s.specialLife.bodyAge} 岁`:''}`;return ['month','year','estimated'].includes(s.profile.birthDatePrecision)?`约 ${a.years} 岁`:`${a.years} 岁 ${a.months} 个月`;};
export function hash(text){let h=2166136261;for(const c of String(text))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const clamp=(n,lo=0,hi=100)=>Math.max(lo,Math.min(hi,n));
const pressureDefaults=()=>({reform:0,stability:0,economy:0,left:0,cooperation:0,tension:0});
const age=s=>currentAge(s).years;
function weighted(pool,seed){let point=hash(seed)/4294967296*pool.reduce((n,r)=>n+(r.weight||1),0);return pool.find(r=>(point-=r.weight||1)<0)||pool.at(-1);}
export function chooseRoutes(lore,requested={},seed='人生'){
  const selected={},coupling=lore.couplings;
  for(const region of [...new Set(lore.routes.map(r=>r.region))]){
    let pool=lore.routes.filter(r=>r.region===region);
    const chen=coupling?.chenChinaIds?.includes(selected.china);
    if(['taiwan','japan'].includes(region))pool=pool.filter(r=>chen?(!r.selectionOnly||r.selectionOnly==='chen'):r.selectionOnly!=='chen');
    if(chen&&region==='taiwan')pool=pool.filter(r=>coupling.taiwanRoutes.includes(r.id));
    if(chen&&region==='japan'){
      selected.japan=selected.taiwan===coupling.taiwanLeftId?coupling.japanLeftId:coupling.japanRightId;continue;
    }
    const explicit=pool.find(r=>r.id===requested?.[region]);
    if(explicit){selected[region]=explicit.id;continue;}
    if(region==='china'&&pool.every(r=>r.warOutcome)){
      const roll=hash(seed+':war')%100,outcome=roll<25?'costlyVictory':roll<85?'defeat':'collapse';
      const subset=pool.filter(r=>r.warOutcome===outcome);if(subset.length)pool=subset;
    }
    if(pool.length)selected[region]=weighted(pool,seed+':'+region).id;
  }
  return selected;
}
const straitEnd=s=>s.calendar?.straitEnd??31+hash(s.seed+':strait-end')%3;
const happened=s=>new Set([...s.seenEvents,...(s.seenNews||[]),...(s.current?.majorId?[s.current.majorId]:[])]);
export function timelineEvents(s,lore){
  const ids=Object.values(s.routes),selected=lore.routes.filter(r=>ids.includes(r.id));
  const events=[...(lore.worldEvents||[]),...(lore.regionalStories||[])].map(e=>({...e,region:e.region||eventRegion(e)})).concat(selected.flatMap(r=>(r.milestones||[]).map(e=>({...e,region:r.region,routeMilestone:true})))).filter(e=>(!e.routeIds?.length||e.routeIds.some(id=>ids.includes(id)))&&(!e.requiresRoutes?.length||e.requiresRoutes.every(id=>ids.includes(id))));
  const unique=new Map(events.map(e=>[e.id,e])),cache=new Map();
  function resolve(e,stack=new Set()){
    if(cache.has(e.id))return cache.get(e.id);if(stack.has(e.id))throw new Error('无法整理这段经历。');
    const chain=new Set([...stack,e.id]);let month=e.id==='world_strait_end'?straitEnd(s):e.earliestMonth;
    if(e.after){const prior=unique.get(e.after),base=e.after==='strait_end'?straitEnd(s):s.eventMonths?.[e.after]??(prior?resolve(prior,chain):Infinity);month=Math.max(month,base+(e.delayMonths??1));}
    for(const id of e.requires||[]){const prior=unique.get(id),base=s.eventMonths?.[id]??(prior?resolve(prior,chain):Infinity);month=Math.max(month,base+1);}
    if(e.id==='world_asia_war'){
      // A constitution and a new administration need time to take effect before a regional war.
      for(const [id,delay]of [['cn_republic_foundation',24],['cn_constituent',18],['cn_constituent_left',12],['cn_constituent_right',12],['cn_digital_democracy',12],['cn_peoples_commune',12]]){
        const prior=unique.get(id);if(prior)month=Math.max(month,(s.eventMonths?.[id]??resolve(prior,chain))+delay);
      }
      month=Math.max(month,s.worldDynamics?.peaceUntil??0);
    }
    if(e.id==='world_asia_end'){const prior=unique.get('world_asia_war');if(prior)month=Math.max(month,(s.eventMonths?.world_asia_war??resolve(prior,chain))+12);}
    if(!e.fixedMonth&&Array.isArray(e.randomDelayMonths)){const [lo,hi]=e.randomDelayMonths;month+=lo+hash(s.seed+':timing:'+e.id)%Math.max(1,hi-lo+1);}
    cache.set(e.id,month);return month;
  }
  const outcome=selected.find(r=>r.region==='china')?.warOutcome;
  return [...unique.values()].map(e=>{const variation=e.warOutcomeDescriptions?.[outcome],resolvedMonth=resolve(e),item={...e,...(typeof variation==='string'?{description:variation}:variation||{}),resolvedMonth};if(/cn_2028_campaign|cn_qin_elected|world_asia/.test(e.id)){const year=String(2020+Math.floor(Math.max(resolvedMonth,s.eventMonths?.[e.id]??resolvedMonth)/12));item.title=item.title.replace(/202[678]年/g,year+'年');item.description=item.description.replace(/202[678]年/g,year+'年');}return item;});
}
export function eligibleEvents(s,lore){
  const done=happened(s);
  return timelineEvents(s,lore).filter(e=>e.resolvedMonth<=s.month&&!done.has(e.id)&&(e.requires||[]).every(id=>done.has(id))&&(!e.after||done.has(e.after==='strait_end'?'world_strait_end':e.after))&&eventFitsSituation(s,e,lore))
    .sort((a,b)=>Number(!!b.fixedMonth)-Number(!!a.fixedMonth)||a.resolvedMonth-b.resolvedMonth||a.id.localeCompare(b.id));
}
function eventFitsSituation(s,e,lore){
  const done=happened(s),override=s.worldOverrides?.[e.region||eventRegion(e)];
  if((e.blockAfter||[]).some(id=>done.has(id)))return false;
  const warStart=/civil|war/.test(e.category||'')&&!/结束|停火|复员|重建|胜利|纪念/.test(e.title);
  if(s.worldDynamics?.lastingPeace&&warStart)return false;
  const terminated=s.worldDynamics?.terminatedConflicts||[];
  if(terminated.includes('strait')&&(/台海战争/.test(e.title)||e.id==='world_strait_war')&&!/结束|停火|复员|重建|纪念/.test(e.title))return false;
  if(warStart&&((terminated.includes('usa')&&/美国|美利坚/.test(e.title))||(terminated.includes('asia')&&e.id==='world_asia_war')))return false;
  if(terminated.some(key=>key!=='strait'&&key===e.region)&&warStart)return false;
  if(override?.routeDetached&&e.routeMilestone){
    if(!override.resumeAfterEventId)return false;
    const route=lore.routes.find(r=>r.id===s.routes[e.region]);
    const anchor=route?.milestones.findIndex(x=>x.id===override.resumeAfterEventId)??-1,index=route?.milestones.findIndex(x=>x.id===e.id)??-1;
    if(anchor<0||index<=anchor)return false;
  }
  if(override?.peaceUntil>s.month&&/civil|war/.test(e.category||'')&&!/结束|停火|复员|重建|胜利/.test(e.title))return false;
  if(e.id==='world_asia_war'){
    if(s.worldDynamics?.lastingPeace||s.worldDynamics?.peaceUntil>s.month)return false;
    for(const location of ['北京','日本','中国台湾']){const situation=regionContext({...s,location},lore);if(situation.conflict&&/内战|全面内战|泛左翼|丰川/.test(situation.conflict))return false;}
  }
  return true;
}
function eventRegion(e){if(/taiwan|strait/.test(e.id))return 'taiwan';if(/japan|^jp_/.test(e.id))return 'japan';if(/europe|^eu_/.test(e.id))return 'europe';if(/protest|^cn_|^prc_/.test(e.id))return 'china';return 'global';}
const placeRegion=regionForPlace;
export function worldHistory(s,lore){
  if(Array.isArray(s.newsHistory))return s.newsHistory.filter(e=>e.month<=s.month).map(e=>({id:e.id,title:e.title,description:e.description,month:e.month,art:e.art,kind:e.kind,region:e.region}));
  const done=happened(s);return timelineEvents(s,lore).filter(e=>done.has(e.id)).map(e=>({id:e.id,title:e.title,description:e.description,month:s.eventMonths?.[e.id]??e.resolvedMonth,art:e.art||'newsroom',kind:'world',region:e.region}));
}
export function cleanDelta(raw){
  const input={...raw};if(Number.isFinite(input.knowledge)&&!Number.isFinite(input.intelligence))input.intelligence=input.knowledge;
  const d={};for(const k of Object.keys(STAT_NAMES))if(Number.isFinite(input[k]))d[k]=Math.round(clamp(input[k],k==='funds'?-100000:-10,k==='funds'?100000:10));return d;
}
function applyDelta(stats,delta,ledger=[],reason='日常变化',wide=false){for(const [k,v]of Object.entries(wide?delta:cleanDelta(delta))){if(!Object.hasOwn(STAT_NAMES,k)||!Number.isFinite(v))continue;const before=stats[k]||0;stats[k]=Math.round(clamp(before+v,k==='funds'?-1e12:0,k==='funds'?1e12:100));if(stats[k]!==before)ledger.push({key:k,amount:stats[k]-before,reason});}}
function moveDestination(action){
  if(action.passive)return null;
  const aliases={台湾:'中国台湾',台北:'中国台湾',台南:'中国台湾',高雄:'中国台湾',东京:'日本',大阪:'日本',京都:'日本',横滨:'日本',名古屋:'日本',札幌:'日本',福冈:'日本',武汉:'湖北',郑州:'河南',广州:'广东',深圳:'广东',杭州:'浙江',南京:'江苏',苏州:'江苏',成都:'四川',西安:'陕西',济南:'山东',青岛:'山东',厦门:'福建',福州:'福建',长沙:'湖南',沈阳:'辽宁',大连:'辽宁',哈尔滨:'黑龙江',长春:'吉林',昆明:'云南',贵阳:'贵州',南宁:'广西',南昌:'江西',合肥:'安徽',太原:'山西',石家庄:'河北',兰州:'甘肃',西宁:'青海',银川:'宁夏',乌鲁木齐:'新疆',呼和浩特:'内蒙古',拉萨:'西藏',海口:'海南'};
  const names=[...PLACES,...Object.keys(aliases),'美国','俄罗斯','德国','法国','英国','新加坡','韩国','印度','太平洋'].sort((a,b)=>b.length-a.length);
  const destination=new RegExp(`(?:搬到|搬去|搬往|搬家到|迁居(?:到)?|移居(?:到)?|定居(?:在|到)?|前往|返回|回到|游到|游向|赴|去)(?:了|往)?\\s*(${names.join('|')})`);
  let result=null;
  for(const sentence of action.label.split(/[，。；,;\n]/)){
    if(/不(?:再|想|会|打算)?(?:搬|迁|去|前往|出国)|(?:仍然?|继续|暂时)?(?:留在|住在)/.test(sentence)){result=null;continue;}
    const match=sentence.match(destination);if(match)result=aliases[match[1]]||match[1];
  }
  return result;
}
function classifyAction(action){
  const text=action.label||'';
  if(/锻炼|运动|健身|跑步|体能|休息|休养|训练|医疗|照护/.test(text))return 'fitness';
  if(/形象|穿搭|化妆|演出|表演|摄影|模特|仪态|打扮/.test(text))return 'appearance';
  if(/投资|创业|经营|生意|预算|储蓄|采购|赚钱|工作|打工|兼职|务工|上班|工资|接单|外卖|收入|房租/.test(text))return 'family';
  if(/政治|政策|选举|组织|群众|改革|工会|集会|执政|外交|游说|革命|政府|战争|左翼|右翼|民主/.test(text))return 'influence';
  if(/联系|家人|朋友|邻居|沟通|交谈|联络|互助/.test(text))return 'connections';
  return 'intelligence';
}
export function resolveAction(s,action){
  if(!action?.label?.trim())throw new Error('请写下你的安排。');
  const specialResult=resolveSpecialAction(s,action,moveDestination(action));if(specialResult)return {...specialResult,actionAge:currentAge(s)};
  if(action.passive){
    const delta={stress:s.stats.stress>25?-1:0};
    if(age(s)>=18)delta.funds=Math.round((s.stats.family-40)*12);
    if(s.month>0&&s.month%12===0&&age(s)>60)delta.fitness=-1;
    return {success:true,chance:1,delta,summary:'你沿着原来的生活节奏度过了这个月，处理手头的事务，也给自己留了一点休息的时间。',scope:'personal',worldDelta:{}};
  }
  const text=action.label.trim(),stat=Object.hasOwn(STAT_NAMES,action.check?.stat)?action.check.stat:classifyAction(action);
  const political=/政治|政策|选举|组织|群众|改革|工会|执政|外交|游说|革命|政府|战争|左翼|右翼|民主|公共/.test(text);
  const ambitious=/全国|国家|世界|总统|主席|首相|执政|推翻|政变|革命|建立政权|结束战争|发动战争/.test(text);
  const difficulty=clamp(Number.isFinite(action.check?.difficulty)?action.check.difficulty:ambitious?82:political?56:42,10,95);
  const skill=s.stats[stat]||0,capacity=stat==='influence'?s.stats.influence:skill;
  const ageFactor=age(s)<16&&ambitious?-0.45:0;
  let chance=clamp(0.48+(capacity-difficulty)/125+s.stats.intelligence/800-s.stats.stress/650+ageFactor,0.08,0.95);
  if(ambitious&&s.stats.influence<35)chance=Math.min(chance,0.16);
  const mode=freedomMode(s),playerLed=!!action.custom&&mode!=='grounded'&&affirmedClauses(text).length>0;
  if(mode==='influential')chance=clamp(chance+0.25,0.2,0.99);
  const rolledSuccess=hash(s.seed+':action:'+s.month+':'+text)/4294967296<chance;
  const success=playerLed||rolledSuccess;
  const quality=rolledSuccess?'smooth':playerLed?'costly':'setback';
  const proposed=action.custom?{[stat]:2,stress:1,...(stat==='family'?{funds:Math.round(500+s.stats.family*15)}:{}),...(stat==='fitness'?{health:2,stress:-2}:{}),...(political?{influence:2,connections:1}:{})}:cleanDelta(action.delta);
  const delta={};
  for(const [k,v]of Object.entries(cleanDelta(proposed)))delta[k]=success?v:v>0?Math.round(v*0.2):Math.round(v*0.65);
  if(!success)delta.stress=(delta.stress||0)+2;
  if(playerLed&&!rolledSuccess){delta.stress=(delta.stress||0)+3;if(ambitious)delta.funds=(delta.funds||0)-Math.round(200+s.stats.family*8);}
  if(success&&stat==='appearance')delta.appearance=Math.max(delta.appearance||0,2);
  if(success&&stat==='fitness')delta.fitness=Math.max(delta.fitness||0,2);
  if(success&&(delta.funds||0)>2000)delta.family=(delta.family||0)+1;
  if((delta.funds||0)<-2000)delta.family=(delta.family||0)-1;
  const scope=political?(playerLed&&ambitious&&mode==='unlimited'?'international':s.stats.influence>=75?'international':s.stats.influence>=50?'national':s.stats.influence>=25?'regional':'local'):'personal';
  const worldDelta={};
  if(success&&political){
    const power=Math.round((0.12+Math.pow(s.stats.influence/100,2)*5)*(mode==='unlimited'?5:mode==='influential'?3:1)*100)/100;
    if(/改革|民主|选举|监督|法治|透明|自由/.test(text))worldDelta.reform=power;
    if(/秩序|治安|稳定|保守|管制/.test(text))worldDelta.stability=power;
    if(/经济|就业|产业|企业|建设|科研|经营/.test(text))worldDelta.economy=power;
    if(/左翼|工会|劳工|公社|劳动|互助|社会主义/.test(text))worldDelta.left=power;
    if(/右翼|反共|丰川|国民党|民进党|基进/.test(text))worldDelta.left=-power;
    if(/和平|合作|调停|和解|协商|谈判/.test(text))worldDelta.cooperation=power;
    if(/发动战争|封锁|军事扩张|参战/.test(text))worldDelta.tension=power;
    if(/停战|和平|调停/.test(text))worldDelta.tension=-power;
    if(/罢工|经济制裁|封锁/.test(text))worldDelta.economy=-power;
  }
  return {success,quality,playerLed,chance:Math.round(chance*100)/100,delta:cleanDelta(delta),summary:tidyLocalProse(success?(quality==='smooth'?`你照着“${text}”的安排开始做事，完成了其中的实际工作。已有的经验和联系派上了用场，接下来的安排有了依据。`:`你落实了“${text}”的安排。为把事情办成，你花了更多时间寻找资源、联系能提供帮助的人，原来的日常安排也跟着调整。`):`你尝试了“${text}”，已有条件还不足以完成全部工作。这个月已做的准备和得到的联系会保留下来，之后可以接着推进。`),scope,worldDelta,destination:success?moveDestination(action):null,actionAge:currentAge(s),implementation:playerLed?'realize-intent-with-causal-bridge':'resource-constrained'};
}
function canSwitch(s,from,to){const prior=new Set(happened(s)),nextIds=new Set(to.milestones.map(e=>e.id));return from.milestones.every(e=>!prior.has(e.id)||nextIds.has(e.id));}
function adaptWorld(s,lore){
  if(s.worldOverrides?.china?.routeDetached)return;
  const p=Object.fromEntries(Object.entries(s.worldPressure).map(([k,v])=>[k,v+(s.routeSelectionExplicit?0:s.npcPressure?.[k]||0)])),old=lore.routes.find(r=>r.id===s.routes.china),done=happened(s);
  if(old&&done.has('cn_hu_inauguration')&&!['cn_hu_stability','cn_hu_reform','cn_hu_economy'].some(id=>done.has(id))){
    const leaders=[['cn_hu_reform',p.reform],['cn_hu_stability',p.stability],['cn_hu_economy',p.economy]].sort((a,b)=>b[1]-a[1]);
    if(leaders[0][1]>=12){const pool=lore.routes.filter(r=>r.region==='china'&&r.warOutcome===old.warOutcome&&r.milestones.some(e=>e.id===leaders[0][0])&&canSwitch(s,old,r));if(pool.length)s.routes.china=weighted(pool,s.seed+':influence:'+leaders[0][0]).id;}
  }
  const current=lore.routes.find(r=>r.id===s.routes.china);
  if(current&&done.has('cn_hu_economy')&&!done.has('cn_economic_success')&&!done.has('cn_economic_failure')&&Math.abs(p.economy)>=18){
    const outcome=p.economy>0?'cn_economic_success':'cn_economic_failure',pool=lore.routes.filter(r=>r.region==='china'&&r.warOutcome===current.warOutcome&&r.milestones.some(e=>e.id===outcome)&&canSwitch(s,current,r));if(pool.length)s.routes.china=weighted(pool,s.seed+':economy:'+outcome).id;
  }
  const c=lore.couplings;
  if(!s.playerChangedCoupling&&c?.chenChinaIds?.includes(s.routes.china)){
    const tw=lore.routes.find(r=>r.id===s.routes.taiwan),jp=lore.routes.find(r=>r.id===s.routes.japan);
    if(Math.abs(p.left)>=18&&['taiwan','japan'].includes(placeRegion(s.location))){
      const candidates=c.taiwanRoutes.filter(id=>p.left>0?id===c.taiwanLeftId:id!==c.taiwanLeftId).map(id=>lore.routes.find(r=>r.id===id)).filter(Boolean);
      const pool=candidates.filter(r=>canSwitch(s,tw,r)&&canSwitch(s,jp,lore.routes.find(j=>j.id===(r.id===c.taiwanLeftId?c.japanLeftId:c.japanRightId))));
      if(pool.length)s.routes.taiwan=weighted(pool,s.seed+':regional-influence').id;
    }
    s.routes.japan=s.routes.taiwan===c.taiwanLeftId?c.japanLeftId:c.japanRightId;
  }
}
const artFor=e=>e.art||({pandemic:'pandemic',protest:'protest',politics:'politics',economy:'economy',technology:'science',disaster:'zombie',war:'strait',civil:'politics',social:'social'}[e.category])||'newsroom';
function impactFor(s,e){
  const exposure=newsExposure(s,e).factor,cushion=1-s.stats.family/200;
  if(exposure<=0)return {};
  const raw=e.impact||(/war|disaster/.test(e.category||'')?{stress:3,funds:-400}:e.category==='pandemic'?{stress:2,funds:-150}:e.category==='protest'?{stress:1}:{});
  const effect={};for(const [k,v]of Object.entries(cleanDelta(raw)))effect[k]=Math.round(v*exposure*(k==='funds'&&v<0?cushion:1));
  if(isSpecialLife(s)&&s.specialLife.body!=='human')delete effect.funds;
  if(s.worldPressure.cooperation>15&&effect.stress>0)effect.stress--;
  return cleanDelta(effect);
}
function enterMonth(s,lore){
  const major=eligibleEvents(s,lore),ordinary=(newsData.events||[]).filter(e=>e.earliestMonth<=s.month&&!s.seenNews.includes(e.id)&&(!e.routeIds?.length||e.routeIds.some(id=>Object.values(s.routes).includes(id)))&&(e.requires||[]).every(id=>happened(s).has(id))&&eventFitsSituation(s,e,lore));
  const cards=[];
  for(const [kind,events]of [['world',major],['news',ordinary]])for(const e of events){
    const event={...e,region:e.region||eventRegion(e)},exposure=newsExposure(s,event),impact=impactFor(s,event),card={id:e.id,title:e.title,description:tidyLocalProse(e.description),art:artFor(e),category:e.category||'politics',region:event.region,month:s.month,impact,exposure,kind};
    cards.push(card);applyDelta(s.stats,impact,s._statLedger,`报道：${card.title}`);
    if(kind==='world'){s.seenEvents.push(e.id);s.eventMonths[e.id]=s.month;s.worldState[card.region]={title:card.title,description:card.description,month:s.month};}
    else s.seenNews.push(e.id);
  }
  s.newsHistory.push(...cards);return cards;
}
function publishPersonalNews(s,event){
  if(s.newsHistory.some(e=>e.id===event.id))return null;
  const card={art:'politics',category:'politics',region:'china',impact:{},...event,month:s.month,kind:event.kind||'personal_world'};
  card.description=tidyLocalProse(card.description);card.exposure=newsExposure(s,card);
  s.newsHistory.push(card);s.worldState[card.region]={title:card.title,description:card.description,month:s.month};
  if(!s.seenEvents.includes(card.id))s.seenEvents.push(card.id);s.eventMonths[card.id]=s.month;
  return card;
}
function changeWorld(s,change,lore,index=0){
  if(!Object.hasOwn(REGIONS,change.region))return null;
  const region=change.region,old=s.worldOverrides?.[region]||{},peace=change.conflict===null,patch={...old,month:s.month,source:'player'};
  for(const k of ['leader','government','stage','conflict','ideology'])if(change[k]===null||typeof change[k]==='string')patch[k]=change[k];
  if(['war','peace','victory','leadership'].includes(change.kind))patch.routeDetached=true;
  if(peace){patch.peaceUntil=s.month+18;s.worldDynamics={...s.worldDynamics,peaceUntil:Math.max(s.worldDynamics?.peaceUntil||0,s.month+18)};}
  if(peace){const raw=change.terminatedConflict||region,key=/台海/.test(raw)?'strait':/大亚洲/.test(raw)?'asia':/日本/.test(raw)?'japan':/台湾/.test(raw)?'taiwan':/中国/.test(raw)?'china':/美国/.test(raw)?'usa':/欧陆/.test(raw)?'europe':raw;s.worldDynamics.terminatedConflicts=[...new Set([...(s.worldDynamics.terminatedConflicts||[]),key])];if(key==='all')s.worldDynamics.lastingPeace=true;}
  if(change.kind==='war'){patch.peaceUntil=s.month;s.worldDynamics={...s.worldDynamics,lastingPeace:false};}
  if(change.kind==='war')s.worldDynamics.terminatedConflicts=(s.worldDynamics.terminatedConflicts||[]).filter(key=>key!==region&&!(region==='taiwan'&&key==='strait'));
  if(change.anchor){
    const route=lore.routes.find(r=>r.id===change.route)||lore.routes.find(r=>r.region===region&&r.milestones.some(e=>e.id===change.anchor));
    if(route){s.routes[region]=route.id;patch.resumeAfterEventId=change.anchor;}
  }
  if(change.kind==='leadership'){delete patch.resumeAfterEventId;if(change.leader===s.profile.name){s.person.authorityOverride={region,leader:s.profile.name,month:s.month};applyDelta(s.stats,{influence:Math.max(0,80-s.stats.influence)},s._statLedger,'公共职务与实际权限',true);}}
  s.worldOverrides??={};s.worldOverrides[region]=patch;
  // A direct intervention supersedes the old preselected cross-strait winner coupling.
  if(['taiwan','japan'].includes(region)&&['war','peace','victory','leadership'].includes(change.kind))s.playerChangedCoupling=true;
  return publishPersonalNews(s,{id:change.anchor||`personal_world_${s.turn}_${index}_${hash(change.description||change.title)}`,title:change.title||`${s.location}的最新变化`,description:change.description||'新的公共安排已经开始执行。',region,art:change.kind==='war'?(region==='japan'?'japan-civil':region==='taiwan'?'taiwan-civil':'politics'):'politics',category:change.kind==='war'?'war':'politics',source:'personal_action'});
}
function relocateTime(s,target,lore){
  s.timeJournals=[...(s.timeJournals||[]),{departedMonth:s.month,turn:s.turn,newsHistory:s.newsHistory,worldOverrides:s.worldOverrides||{}}].slice(-4);
  s.seenEvents=[];s.seenNews=[];s.eventMonths={};s.newsHistory=[];s.worldState={};s.worldOverrides={};s.worldDynamics={};s.npcActivity=[];s.npcPressure=pressureDefaults();s.playerChangedCoupling=false;
  // Reconstruct world chronology without charging the traveller for skipped months.
  for(let m=0;m<=Math.min(target,300);m++){
    s.month=m;
    for(const e of eligibleEvents(s,lore)){publishPersonalNews(s,{id:e.id,title:e.title,description:e.description,region:e.region,art:artFor(e),category:e.category,kind:'world'});}
  }
  for(const e of newsData.events||[])if(e.earliestMonth<=target&&(e.requires||[]).every(id=>s.seenEvents.includes(id))&&(!e.routeIds?.length||e.routeIds.some(id=>Object.values(s.routes).includes(id))))s.seenNews.push(e.id);
  s.month=target;
}
function publicReactions(s,prior,lore){
  const x=s.specialLife,cards=[];
  if(x?.kind==='mao_resurrection'&&x.stage>(prior.specialLife?.stage??0)){
    const messages=[null,
      '纪念堂的值守人员发现了连续回应，照护人员要求复查记录。消息在少数工作人员与家属之间传开，有人激动，有人怀疑记录失误，也有人担心自己承担责任。',
      '新的影像与照护记录显示，毛泽东已经能够回应身边的人。消息逐渐外传，部分左翼团体要求公开资料，年轻人围绕真假展开争论，现有机关要求核实身份并控制会面秩序。',
      '毛泽东恢复行动能力的消息得到公开确认。部分左翼组织与老工人感到振奋，普通家庭谈论过去与现在的差别。部分官员与企业经营者担心权力和经济制度改变，更多人等待他说明实际主张。',
      '毛泽东公开表达意见后，不同政治团体开始讨论合作与分歧。支持者提出会面和改革请求，现任官员评估政策与权力交接的可能，持反对意见者要求保证既有生活和表达空间。'];
    const card=publishPersonalNews(s,{id:`mao_public_reaction_${x.stage}_${s.turn}`,title:x.stage<3?'纪念堂的回应引起议论':'毛泽东重新出现，各界作出回应',description:messages[x.stage],region:'china',art:'politics'});if(card)cards.push(card);
    s.socialMood={leftHope:Math.min(100,20+x.stage*17),publicCuriosity:Math.min(100,20+x.stage*19),establishmentConcern:Math.min(100,10+x.stage*18),month:s.month};
    s.worldPressure.left=clamp(s.worldPressure.left+x.stage*2,-100,100);applyDelta(s.stats,{influence:x.stage>=3?6:2},s._statLedger,'苏醒消息引起的社会反应');
  }
  return cards;
}
function politicalActivity(s){
  if(s.month<0||s.turn===0||hash(s.seed+':npc:'+s.turn)%4!==0)return [];
  const actors=getPoliticalActors(s).filter(actor=>actor.name!==s.profile.name&&!/在押|服刑|拘押|监禁|学生|中学生|乐队成员/.test(actor.role));
  if(!actors.length)return [];
  const actor=actors[hash(s.seed+':actor:'+s.turn)%actors.length],priorities=actor.priorities||[];
  const concern=String(priorities[hash(s.seed+':priority:'+s.turn)%Math.max(1,priorities.length)]||'公共服务与地方事务');
  const left=/社会|工人|劳工|共产|毛主义|左翼/.test(actor.ideology),conservative=/保守|专制|威权|极权|民族|主席独裁/.test(actor.ideology),key=left?'left':conservative?'stability':'reform';
  const power=0.5+Math.min(80,actor.influence||30)/40;s.npcPressure??=pressureDefaults();s.npcPressure[key]=clamp(s.npcPressure[key]+power,-100,100);
  const card=publishPersonalNews(s,{id:`npc_public_${s.turn}_${actor.id}`,title:`${actor.name}提出新的公共安排`,description:`${actor.name}围绕${concern}与相关人员开展磋商。支持者开始整理诉求和联系人，持不同意见的人要求说明资源来源及落实办法。这些活动正在改变当地的组织联系。`,region:actor.region||'china',source:'political_actor',actor:actor.name,ideology:actor.ideology});
  s.npcActivity=[...(s.npcActivity||[]),{actor:actor.name,month:s.month,ideology:actor.ideology,pressure:key,delta:power}].slice(-30);
  return card?[card]:[];
}
function finishChanges(s,before){
  const ledger=s._statLedger||[];s.statChanges=Object.keys(STAT_NAMES).filter(k=>s.stats[k]!==before[k]).map(k=>({key:k,label:STAT_NAMES[k],before:before[k]??0,after:s.stats[k],delta:s.stats[k]-(before[k]??0),reasons:[...new Set(ledger.filter(e=>e.key===k).map(e=>e.reason))]}));
  delete s._statLedger;
}
export function isDecisionMonth(s){if(s.ended||s.person?.deceased)return false;const block=Math.floor(s.month/4),slots=[0,1,2,3].sort((a,b)=>hash(s.seed+':decision:'+block+':'+a)-hash(s.seed+':decision:'+block+':'+b));const count=hash(s.seed+':decision-count:'+block)%100<35?2:1;if(isSpecialLife(s)&&block===0){slots.splice(slots.indexOf(0),1);slots.unshift(0);}return slots.slice(0,count).includes(((s.month%4)+4)%4);}
function fill(text,s){return String(text).replace(/\{(location|goal|name)\}/g,(_,key)=>key==='location'?s.location:s.profile[key]);}
function dailyPool(s){
  return lifeEvents.events.filter(e=>age(s)>=e.minAge&&(age(s)<=(e.maxAge??120)||(age(s)>120&&(e.maxAge??120)>=120))&&(!(s.month< -360)||!/智能手机|互联网|直播|短视频|线上|软件开发|人工智能|网络平台/.test(JSON.stringify(e)))&&(!e.places?.length||e.places.includes(s.location))&&Object.entries(e.minStats||{}).every(([k,v])=>s.stats[k]>=v)&&Object.entries(e.maxStats||{}).every(([k,v])=>s.stats[k]<=v));
}
function dailyWeight(e,s){
  const weights={learning:'intelligence',research:'intelligence',technology:'intelligence',business:'family',housing:'family',finance:'family',health:'fitness',leisure:'fitness',relationships:'appearance',culture:'appearance',politics:'influence',community:'connections'};
  return 1+(s.stats[weights[e.category]]||40)/30+(e.places?.includes(s.location)?2:0);
}
const routines={
  family:'你陪家人处理家务，留意每个人的近况，把几件拖了很久的小事一一办妥。',
  learning:'你拿出固定时间阅读和练习，将弄不明白的地方逐条记下，慢慢补齐过去留下的空白。',
  research:'你把一个小问题拆开反复验证。几次结果并不理想，但手边的笔记已比月初厚了不少。',
  work:'你处理日常事务，核对手头的安排和月底的账目，也和熟悉的人交换了近况。',
  finance:'你重新整理日常开支，为必要的花费留出余地，几笔可缓办的事情便再等等。',
  health:'你尽量让作息规律一些，留出散步与休息的时间，身体的细微变化也开始被认真对待。',
  relationships:'你与几位熟人保持联系，有时只是短短的问候，彼此的近况却渐渐清楚起来。',
  technology:'你尝试把新的工具用于手边的小事，边学边改，也逐渐分清哪些便利真正有用。',
  community:'你往返于熟悉的街道，留意邻里正在忙什么，遇到力所能及的小事便搭一把手。',
  politics:'你从报纸和周围的讨论中了解公共事务，将那些影响日常生活的变化记录下来。',
  culture:'你给阅读、写作或喜欢的作品留了一些时间。寻常日子里的片段，也慢慢有了可以回味的形状。'
};
function occupationEvent(s,context){
  const person=s.person||initialPerson(s.profile),job=person.occupation;
  let kind=null,title,narrative,diary,labels;
  if(person.custody){kind='custody';title='探视与信件';narrative='你按照看守安排生活，能够接触的人和外界消息都有范围。这个月，信件、探视申请与身体状况占据了不少注意力，你考虑怎样使用现有的联系。';diary='这个月，你按规定时间起居，处理收到的信件，记录身体情况。外界消息经允许的渠道送来，你从有限的信息里了解亲友的近况，写下希望下一次联系时说明的事情。';labels=['写信给家人说明近况','申请允许范围内的会见','整理申诉与法律咨询材料','阅读能够取得的书籍','按身体情况规律活动'];}
  else if(/军人|士兵|入伍|军队|自卫队|军校|军事训练/.test(job)){kind='service';title='训练与值勤';narrative='新的训练安排已经发下来，你需要在集体作息中处理自己的学习、身体恢复与家人联系。带训人员了解了你的经验，也让你说明目前还不熟悉的工作。';diary=`你以${age(s)}岁的身体条件参加训练，按要求完成日常任务，在休息时间联系家人。训练中的问题记在本子上，能够解决的当场询问，剩下的留到下次练习。`;labels=['根据身体情况安排训练','向有经验的同伴请教','认真完成日常事务','写信向家人说明近况','整理本月训练与学习记录'];}
  else if(!/原|前|候选人|退休|卸任/.test(job)&&/主席|总书记|总理|总统|首相|领导人|知事|总裁|总理大臣/.test(job)){kind='office';title='送到办公桌上的材料';narrative='你按现有职务处理送来的材料，分别听取负责人员的说明。一些工作能够由原有机构办理，涉及资源和人员调整的事项需要你明确安排。';diary=`你继续处理${job}的工作，听取有关部门的汇报，检查已经作出的安排是否落实。来自地方和工作人员的材料显示了几项具体困难，你把需要补充的情况交给有关人员核实。`;labels=['听取基层和公众的具体意见','核查正在执行的公共安排','安排经济与民生专题讨论','约见不同意见的负责人','审阅报告并处理人事事务'];}
  else if(/歌手|演员|创作|视频|主播|艺人/.test(job)){kind='creative';title='这一个月的创作安排';narrative='你整理手里的作品和演出、发布安排，与合作人员讨论近期工作。观众的反馈有不同意见，你需要决定怎样安排练习、创作和公开活动。';diary='你按既有安排练习、创作，与合作人员核对发布和活动时间，处理观众反馈。几项工作经过修改后继续进行，休息时间留给家人和自己的生活。';labels=['完成手头作品的修改','与合作人员讨论新的创作','练习需要用到的专业技能','回应近期观众关注的问题','留出时间休息并联系家人'];}
  if(!kind)return null;
  return {id:`personal_${kind}_${s.month%6}`,title,narrative,diary,category:kind==='service'?'health':kind==='office'?'politics':'culture',options:labels.map((label,i)=>({label,description:'按当前条件安排具体工作，记录结果和后续需要。',delta:i===4?{stress:-2}:{intelligence:1,connections:1}}))};
}
export function localEvent(s,lore,action=null){return localizeEvent(localEventContent(s,lore,action),s,action);}
function localEventContent(s,lore,action=null){
  if(s.stats.health===0&&!s.person?.deceased)return {title:'最后一段经历',narrative:s.terminalCause==='encounter'?'交锋留下的伤势已经无法支撑你继续活动。身边能够取得的物资没能挽回生命，走过的道路、留下的联系和未完成的安排成为最后的记录。':'身体的情况持续恶化，你已经无法继续原来的生活。此前建立的关系、保存的记录和未完成的事情留了下来，这段人生停在了这里。',consequence:tidyLocalProse(s.actionResult?.summary||''),options:[],memory:'这段人生停在了这里。',actionDelta:{},location:s.location,dailyId:'personal_last_page',decision:false,news:s.pendingNews||[],source:'local'};
  if(s.person?.deceased)return {title:'最后的消息',narrative:'你在内战中遇刺身亡，身边的人随后确认了消息。有关人员整理了你留下的文件与尚未完成的安排，原有联盟开始处理继承与战时指挥问题。亲友收到通知，此前的书信、会面记录和生活经历留了下来。',consequence:tidyLocalProse(s.actionResult?.summary||''),options:[],memory:'你在内战中遇刺身亡。',actionDelta:{},location:s.location,dailyId:'personal_death',decision:false,news:s.pendingNews||[],source:'local'};
  const special=specialLocalEvent(s,isDecisionMonth(s),action);if(special)return special;
  const context=regionContext(s,lore),recent=new Set([s.current?.dailyId,...(s.history||[]).slice(-8).map(h=>h.event.dailyId)]),pool=dailyPool(s),fresh=pool.filter(e=>!recent.has(e.id));
  const candidates=(fresh.length?fresh:pool).map(e=>({...e,weight:dailyWeight(e,s)}));
  const daily=occupationEvent(s,context)||weighted(candidates,s.seed+':daily:'+s.month)||lifeEvents.events[0];
  const decision=isDecisionMonth(s),intro=(s.turn??s.month)===0?`你叫${s.profile.name}，现在${['month','year','estimated'].includes(s.profile.birthDatePrecision)?'约':''}${age(s)}岁，生活在${s.location}。${s.profile.backgroundText}\n\n`:'';
  const details=context.localDetails||[],localDetail=details.length?details[hash(s.seed+':local:'+s.month)%details.length]:context.dailyContext||'';
  const relevant=(s.pendingNews||[]).filter(e=>['direct','indirect'].includes(e.exposure?.level));
  const setting=relevant.length?relevant[0].exposure.effectText:(s.month%4===0?localDetail:'');
  let body=decision?fill(daily.narrative,s):fill(daily.diary||routines[daily.category]||'你处理日常事务，与熟悉的人保持联系，把时间安排在手头的工作和休息上。',s);
  if(action?.custom){body=`这个月，你继续处理刚才安排的事情。${s.person?.status||'已经取得的材料和联系留待后续使用。'}${setting||'你记录了已完成的工作，留出时间处理家里的事务。'}`;}
  else if(setting)body+=' '+setting;
  const narrative=tidyLocalProse(intro+body);
  const options=decision?[...daily.options].sort((a,b)=>hash(s.seed+':option:'+s.month+a.label)-hash(s.seed+':option:'+s.month+b.label)).map(o=>({label:tidyLocalProse(fill(o.label,s)),description:tidyLocalProse(fill(o.description||'',s)),delta:cleanDelta(o.delta),check:{stat:classifyAction(o),difficulty:42+(s.stats.influence>60?8:0)}})):[];
  return continuityNarrative(s,action,s.actionResult,{title:action?.custom?'本月的安排':daily.title,narrative,consequence:tidyLocalProse(s.actionResult?.summary||''),options,memory:action?.custom?`你${s.actionResult?.success?'已开展':'尝试'}的安排：${tidyLocalProse(action.label).slice(0,800)}`:'',actionDelta:{},location:s.location,dailyId:daily.id,decision,news:s.pendingNews||[],source:'local'});
}
function initialPerson(profile){
  const known=profile.persona,defaultText=backgroundsFor(profile.startLocation||profile.place).find(b=>b.id===profile.background)?.detail;
  const description=(profile.backgroundText===defaultText?'':profile.backgroundText||'').split(/[，。；,;\n]/).filter(t=>!/(?:父母|父亲|母亲|爸爸|妈妈|家人|哥哥|姐姐|弟弟|妹妹|祖父|祖母|爷爷|奶奶)/.test(t)||/(?:我|本人|自己).{0,12}(?:是|做|担任|从事|就读)/.test(t)).join('，');
  const occupation=known?.occupation||(/学生|研究生|在读|就读|读大学|上大学/.test(description)?'学生':/工程师/.test(description)?'工程师':/教师|老师/.test(description)?'教师':/工人/.test(description)?'工人':/务农|农民/.test(description)?'务农':/记者/.test(description)?'记者':/研究员|科研人员/.test(description)?'研究人员':profile.age>=6&&profile.age<18?'学生':'在当地生活');
  const politics=known?.modPolitics;
  const opening=politics?.stages?.find(stage=>!stage.requires?.length);
  return {occupation,status:known?.status||'处理日常学习、工作与家庭事务',custody:!!known?.custody,ideology:opening?.ideology||politics?.ideology||'尚未形成固定偏好',skills:[],projects:[],relationships:(known?.relationships||politics?.relationships||[]).filter(r=>!r.requires?.length).map(r=>typeof r==='string'?r:`${r.name}：${r.detail||r.type||'已有联系'}`).slice(0,20),facts:[]};
}
function positiveIntent(text){return affirmedClauses(text).join('，');}
function updatePersonFromAction(s,action,result){
  s.person??=initialPerson(s.profile);
  if(action.passive||!result.success)return;
  const text=positiveIntent(action.label),region=placeRegion(s.location),person=s.person;
  if(!text.trim())return;
  if(/参军|入伍|加入.{0,12}(?:军队|自卫队)|成为.{0,8}(?:军人|士兵)/.test(text)){
    person.occupation=region==='japan'?'自卫队受训人员':region==='taiwan'?'军队受训人员':'入伍受训人员';
    person.status='已办理参加训练的安排，按当前身体条件与已有经历接受训练';
  }
  if(/出狱|获释|越狱|离开监狱|摆脱监禁/.test(text)){person.custody=false;person.status='已离开原来的羁押场所，正在安排住所与后续生活';}
  const job=text.match(/(?:成为|担任|入职|应聘|找到.{0,6})(?:一名|一位)?(工程师|教师|医生|护士|记者|工人|程序员|歌手|演员|公务员|研究员|总统|国家主席|首相|议员|市长|省长)/);
  if(job){person.occupation=job[1];person.status=`已开始承担${job[1]}的工作，具体权限与资源仍要在实际事务中落实`;}
  if(/学习|练习|研究|研发|训练|创作|开发/.test(text))person.skills=[...new Set([...person.skills,text.slice(0,100)])].slice(-12);
  if(/研发|发明|建立|创办|建造|革命|研制|开发|月球|宇宙|太空|机甲/.test(text))person.projects=[...new Set([...person.projects,`${text.slice(0,130)}：${result.playerLed&&!/尝试|筹备|研究是否|计划|准备/.test(text)?'已经完成明确叙述的结果，现有成果继续保留':'已经展开实际工作，保留进展和后续安排'}`])].slice(-10);
  person.facts=[...person.facts,`${dateLabel(s.month)}：${tidyLocalProse(text).slice(0,180)}`].slice(-40);
}
function mergePersonUpdate(s,update,action){
  if(!update||action.passive||!s.actionResult?.success||s.person?.deceased)return;
  const person=s.person;
  for(const key of ['occupation','status','ideology'])if(typeof update[key]==='string'&&update[key].trim())person[key]=update[key].trim().slice(0,180);
  for(const key of ['skills','projects','relationships','facts'])if(Array.isArray(update[key]))person[key]=[...new Set([...person[key],...update[key].filter(v=>typeof v==='string').map(v=>v.slice(0,220))])].slice(key==='facts'?-40:-12);
  if(/出狱|获释|越狱|离开监狱|摆脱监禁/.test(positiveIntent(action.label)))person.custody=false;
}
function syncPublicIdentity(s){
  if(s.person?.authorityOverride)return;
  if(!s.profile.lockedPersonaId)return;
  const canonical=findPersona(s.profile.lockedPersonaId);
  if(!canonical||canonical.name!==s.profile.name||canonical.birthDate!==s.profile.birthDate)return;
  const name=s.profile.name,person=s.person,known=happened(s);
  const events={
    '习近平':[['cn_zhang_coup','原国家主席、中共中央原总书记','张又侠发动政变后失去原有职务的实际控制']],
    '李克强':[['cn_zhang_coup','原国务院总理','中央权力重组后，原有班子的工作安排已发生变化'],['cn_li_elected','中国国家主席','经新一届领导班子选举上台，主持改革与政府工作']],
    '薄熙来':[['cn_mao_succession','参与中央权力协调的政治人物','已重新进入政治活动，参与毛远新执政期间的权力协调',false],['cn_bo_elected','中国最高领导人','在新一届领导班子选举中上台，主持中央事务',false],['cn_bo_war_leader','战时领导人','接掌战争指挥，承担战时政治与军事协调',false],['cn_bo_stolen_victory','战后最高领导人','己方取得战争胜利，正在集中权力和安排重建',false]],
    '张又侠':[
      ['cn_zhang_coup','主持中央权力过渡的军方领导人','战后以军方力量解除原领导班子的实际控制，主持临时权力安排'],
      ['cn_chen_emergency','参与紧急权力交接的军方领导人','主持的紧急会议推举陈文清掌权，军方参与新秩序的权力协调'],
      ['cn_hu_inauguration','参与中央权力协调的军方领导人','胡春华接掌中央权力，军方参与战后的权力过渡'],
      ['cn_mao_succession','参与中央权力协调的军方领导人','与薄熙来共同推举毛远新接掌权力，参与新的政治妥协']
    ],
    '陈文清':[
      ['cn_chen_emergency','中国最高领导人','经紧急会议掌握中央权力，以安全系统和党内联盟维持紧急秩序'],
      ['cn_chen_party','中国最高领导人','主持安全系统介入党务监察与干部任命的安排'],
      ['cn_chen_totalitarian','中国最高领导人','紧急秩序已经制度化，主持集中化治理与数字监控体系']
    ],
    '胡春华':[
      ['cn_hu_inauguration','中国最高领导人','率团派接掌权力，主持战后改革、经济恢复与社会对话'],
      ['cn_hu_stability','中国最高领导人','暂缓深入改革，将稳定与民族主义动员作为执政重点'],
      ['cn_hu_reform','中国最高领导人','将政治开放、法治和问责列为优先事项，协调改革联盟'],
      ['cn_hu_economy','中国最高领导人','将就业、分配和恢复生产列为首要承诺，主持经济恢复'],
      ['cn_socialdem','中国最高领导人','继续主持改革，推动福利、劳动保障与执政党的社会民主转型'],
      ['cn_economic_failure','中国最高领导人','经济承诺未能兑现，第二次白纸运动使执政支持迅速流失'],
      ['cn_economic_success','中国最高领导人','阶段性经济承诺得到兑现，继续主持公共研究与生产恢复'],
      ['cn_han_rise','原中国最高领导人','韩德强与正道派夺取政权，原有中央职务的实际控制已经结束'],
      ['cn_zhang_hongliang','团派政治人物、原中国最高领导人','张宏良在新左派联盟中取得优势并成为领导人，原有最高领导职务结束'],
      ['cn_li_elected','团派政治人物、原中国最高领导人','新一届领导班子选举由李克强当选主席，原有最高领导职务结束'],
      ['cn_wang_elected','团派政治人物、原中国最高领导人','新一届领导班子选举由汪洋当选主席，原有最高领导职务结束'],
      ['cn_bo_elected','团派政治人物、原中国最高领导人','薄熙来在领导班子选举中上台，原有最高领导职务结束'],
      ['cn_whn_coup','失去执政权力的团派政治人物','保守派政变使王沪宁掌权，原有改革班子的实际控制已经结束'],
      ['cn_mao_succession','原中国最高领导人','已经辞去职务，毛远新接掌中央权力'],
      ['cn_longmarch_coup','旧政府领导人','长征与韩东方发动政变，原政府失去部分控制，正在应对内战'],
      ['cn_republic_foundation','原中国最高领导人','韩东方领导的临时政府赢得内战，原政府失去中央权力']
    ],
    '王沪宁':[
      ['cn_whn_coup','中国最高领导人','保守派通过政变夺取权力，成为核心领导并中止原有改革'],
      ['cn_whn_clearance','中国最高领导人','在抗议遭武力清场后继续掌权，城市处于严密管制'],
      ['cn_cyber_chen','中国最高领导人','赛博陈云已经完成，主持保守政权中的技术与行政权力安排']
    ],
    '毛远新':[
      ['cn_mao_succession','中国最高领导人','接替辞职的胡春华掌权，在与军方、薄熙来的妥协中安排改革'],
      ['cn_mao_patience','中国最高领导人','维持与薄熙来的合作，谨慎推动福利、公共经济和基层人事调整'],
      ['cn_second_cultural','发动第二次文革的中国领导人','大亚洲战争结束后公开发动第二次文化大革命，原有政治联盟开始分裂'],
      ['cn_total_civil_war','内战中的革命阵营领导人','全面内战已经爆发，统一行政体系破裂，参与革命阵营的战时协调'],
      ['cn_front_mao_chair','中国国家主席','革命阵线获胜后经选举当选主席，主持战后重建与政治协商'],
      ['cn_front_yue_chair','革命阵线政治人物','革命阵线获胜后的选举由岳昕当选主席，最高领导职务已经交接'],
      ['cn_front_han_chair','革命阵线政治人物','革命阵线获胜后的选举由韩东方当选主席，最高领导职务已经交接'],
      ['cn_ling_victory','失去执政权力的革命阵营政治人物','令计划阵营赢得内战，原有中央权力已经丧失'],
      ['cn_mao_assassinated','遇刺身亡的政治人物','在全面内战中遇刺身亡，原有联盟失去共同领导',false,{deceased:true}]
    ],
    '李作成':[
      ['cn_li_stopwar','主持停战的军方领导人','控制首都与交通系统，宣布停战并接管主要权力机构'],
      ['cn_red_junta','红色军政府领导人','主持制度化军管，军方控制政治任命、媒体与地方机构']
    ],
    '韩东方':[
      ['cn_longmarch_deal','参与泛左翼合作的劳工组织领导人','已与长征及劳工网络达成合作，协调劳动权利与政治行动'],
      ['cn_longmarch_coup','北京临时政府领导人','与长征及多个左翼组织联合行动，领导临时政府应对内战'],
      ['cn_republic_foundation','中华共和国临时政府领导人','赢得内战并建立中华共和国，主持公共服务恢复与制宪准备'],
      ['cn_front_han_chair','中国国家主席','革命阵线获胜后的选举中当选主席，主持战后重建与劳动参与制度'],
      ['cn_qin_elected','中华共和国政治人物、前政府领导人','秦晖在大选中当选主席，已经接受选举结果并交接领导职务']
    ],
    '韩德强':[
      ['cn_han_rise','正道派政权领导人','借正道派组织夺取政权，开始主持政治动员与技术计划'],
      ['cn_cyber_mao','正道派政权领导人','赛博毛泽东获得公共决策影响力，原有个人权威正在受到挑战'],
      ['cn_cyber_order','正道派政治人物','赛博毛泽东阵营扩大行政与资源控制，原有个人权威受到限制'],
      ['cn_zombie_mao','卷入复生实验危机的正道派领导人','复生实验已经失控，正在面对异常感染与行政秩序危机']
    ],
    '秦晖':[
      ['cn_2028_campaign','中华共和国主席候选人','参加2028年大选，与韩东方就经济制度、劳动权利和国际关系展开竞争'],
      ['cn_qin_elected','中华共和国主席','在2028年大选中当选主席，接手政府工作与选举承诺'],
      ['cn_qin_center','中华共和国主席','主持市场机制、公共所有与劳动权利之间的协商改革'],
      ['cn_qin_ultraleft','中华共和国主席','扩大直接民主、公共经济与社会动员，主持激进改革'],
      ['cn_qin_traditional','中华共和国主席','转向传统制度与市场化改组，正在面对执政联盟内部分歧'],
      ['cn_longmarch_second_revolution','面对新一轮政变的中华共和国主席','长征发动新的政变与革命，原有共同阵线分裂，冲突尚未结束']
    ],
    '张宏良':[
      ['cn_zhang_hongliang','中国最高领导人','在新左派联盟内部取得优势，主持群众动员与大众民主议程'],
      ['cn_mass_democracy','中国最高领导人','主持大众民主的制度与技术安排，处理多数决和专业治理之间的争议']
    ],
    '令计划':[['cn_ling_victory','战后中国最高领导人','己方阵营赢得全面内战，控制主要权力中心，开始重组干部与经济网络',false]],
    '汪洋':[['cn_wang_elected','中国国家主席','在团派与自由派合作后的选举中当选主席，主持市场改革与公共事务'],['cn_wang_russia','中国国家主席','深化与俄罗斯的军事、能源和外交合作，主持相关政策安排']],
    '岳昕':[['cn_front_yue_chair','中国国家主席','革命阵线获胜后的选举中当选主席，主持重建与政治监督制度',false]],
    '蔡英文':[['tw_martial_protest','台湾前领导人','赖清德主持战后政府，原有在任职务已结束']],
    '赖清德':[['tw_martial_protest','台湾领导人','主持战后政府，维持紧急管制'],['tw_four_factions','花莲方面领导人','率民进党部属在花莲维持战时政府'],['tw_dpp_end','台湾领导人','返回台北，主持恢复中央管治与重建'],['tw_left_end','民进党政治人物','左翼联盟取得内战胜利，原有战时政府已失去中央管治'],['tw_kmt_end','民进党政治人物','国民党取得内战胜利，原有战时政府已失去中央管治'],['tw_revanchist_end','民进党政治人物','基进党取得内战胜利，原有战时政府已失去中央管治']],
    '韩国瑜':[['tw_four_factions','台北临时政府领导人','台北军队拥立组成临时政府，正在整合军事与行政力量'],['tw_kmt_command','台北临时政府领导人','主持临时总统府，以恢复秩序为号召协调部队与行政机关'],['tw_kmt_end','台湾战后政府领导人','国民党控制主要城市与港口，宣布内战结束并主持行政重建'],['tw_left_end','国民党政治人物','左翼联盟取得内战胜利，原有临时政府已失去中央管治'],['tw_dpp_end','国民党政治人物','民进党政府返回台北，原有临时政府已失去中央管治'],['tw_revanchist_end','国民党政治人物','基进党取得内战胜利，原有临时政府已失去中央管治']],
    '郑村棋':[['tw_four_factions','新竹左翼联盟领导人','领导新竹左翼联盟参与台湾内战，协调工会与各左翼团体'],['tw_left_end','台湾社会主义共和国领导人','左翼联盟赢得内战，主持共和国建立与战后重建'],['tw_left_constituent','台湾制宪会议主持人','主持台北制宪会议，协调工人、农民、学生及左翼团体代表'],['tw_left_transition','参与权力交接的左翼政治人物','制宪会议进入尾声，已经表明不长期占据最高职位，等待代表投票与交接'],['tw_dpp_end','台湾左翼政治人物','民进党赢得内战，左翼联盟未能取得中央管治'],['tw_kmt_end','台湾左翼政治人物','国民党赢得内战，左翼联盟未能取得中央管治'],['tw_revanchist_end','台湾左翼政治人物','基进党赢得内战，左翼联盟未能取得中央管治']],
    '陈奕齐':[['tw_four_factions','台南民族革命军领导人','在台南组织基进党与民族革命军，参与台湾内战'],['tw_revanchist_end','台湾战后政府领导人','基进党赢得内战，主持军事动员与战后政府'],['tw_left_end','基进党政治人物','左翼联盟赢得内战，原有战时力量未能取得中央管治'],['tw_dpp_end','基进党政治人物','民进党赢得内战，原有战时力量未能取得中央管治'],['tw_kmt_end','基进党政治人物','国民党赢得内战，原有战时力量未能取得中央管治']],
    '安倍晋三':[['civic_vote','日本前首相、自民党政治人物','市民联合组成新政府，原有首相职务已经结束'],['mil_crisis','自民党政治人物','紧急军事当局接管行政，原内阁工作秩序中断'],['rep_crisis','自民党政治人物','军事政变使原内阁工作秩序中断'],['jp_emergency_committee','自民党政治人物','丰川祥子领导的紧急委员会接管关键行政与安全事务']]
  };
  person.publicChanges??=[];
  const ordered=[...(events[name]||[])].sort((a,b)=>(s.eventMonths?.[a[0]]??0)-(s.eventMonths?.[b[0]]??0));
  for(const [id,occupation,status,custody,effect] of ordered){
    if(!known.has(id)||person.publicChanges.includes(id))continue;
    person.occupation=occupation;person.status=status;if(typeof custody==='boolean')person.custody=custody;
    if(effect?.deceased){person.deceased={eventId:id,month:s.eventMonths?.[id]??s.month};s.stats.health=0;s.ended=true;}
    person.publicChanges.push(id);person.facts=[...person.facts,`${dateLabel(s.eventMonths?.[id]??s.month)}：${status}`].slice(-40);
  }
  const politics=canonical.modPolitics,stage=politics?.stages?.filter(p=>(p.requires||[]).every(id=>known.has(id))&&!(p.blockAfter||[]).some(id=>known.has(id))).at(-1);
  if(stage&&!person.ideologyOverride)person.ideology=stage.ideology||politics.ideology||person.ideology;
  if(politics)person.relationships=[...new Set([...person.relationships,...(politics.relationships||[]).filter(r=>(r.requires||[]).every(id=>known.has(id))).map(r=>`${r.name}：${r.detail||r.type||'已有联系'}`)])].slice(-30);
}
export function createGame(input,lore){
  const profile=lockPersonaProfile(input),persona=profile.lockedPersonaId?findPersona(profile.lockedPersonaId):null;
  if(!persona&&!PLACES.includes(profile.place))throw new Error('请选择出生地。');const startAge=Number(profile.age);if(!Number.isInteger(startAge)||startAge<0||startAge>(persona?200:90))throw new Error('年龄须为 0–90 岁的整数。');
  const points=profile.points||{intelligence:5,family:5,fitness:5,appearance:5};
  if(POINT_STATS.some(k=>!Number.isInteger(Number(points[k]))||Number(points[k])<0||Number(points[k])>10)||(!persona&&POINT_STATS.reduce((n,k)=>n+Number(points[k]),0)!==20))throw new Error('请将 20 点分配完毕，每项为 0–10 点。');
  const location=persona?profile.startLocation:profile.place,bgs=backgroundsFor(location),bg=bgs.find(b=>b.id===profile.background)||bgs[0];
  const seed=profile.seed?.trim()||(globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random());
  const p={name:persona?.name||(profile.name?.trim()||'无名者').slice(0,30),age:startAge,startAgeMonths:persona?profile.startAgeMonths:startAge*12,place:profile.place,startLocation:location,background:bg.id,backgroundText:(profile.backgroundText||bg.detail).slice(0,3000),goal:(profile.goal?.trim()||'照顾自己和家人，完成想做的事情。').slice(0,1000),narrative:profile.narrative==='balanced'?'balanced':'player',points:Object.fromEntries(POINT_STATS.map(k=>[k,Number(points[k])]))};
  p.freedom=['unlimited','influential','grounded'].includes(profile.freedom)?profile.freedom:p.narrative==='balanced'?'grounded':'unlimited';p.narrative=p.freedom==='grounded'?'balanced':'player';
  p.identity=normalizeCharacterIdentity(profile.identity);p.language=normalizeLanguage(profile.language);
  if(persona)Object.assign(p,{birthDate:persona.birthDate,birthDatePrecision:persona.birthDatePrecision||'day',birthPlace:persona.birthPlace,lockedPersonaId:persona.id,persona});
  const influenceBase={ordinary:2,worker:3,rural:1,research:6,cadre:14,business:10,custom:2}[bg.id];
  const position=/国家主席|总统|首相|最高领导|中央领导/.test(p.backgroundText)?65:/省长|部长|司令|议员|市长|企业董事长/.test(p.backgroundText)?35:/主任|干部|教授|记者|经理|工会代表/.test(p.backgroundText)?12:0;
  const influence=Math.round(clamp((influenceBase+p.points.family*1.4+position)*(startAge<16?0.25:1),0,95));
  const stats={...Object.fromEntries(POINT_STATS.map(k=>[k,p.points[k]*10])),influence,health:70+p.points.fitness*2,funds:startAge<16?100+p.points.family*100:Math.round(500+Math.pow(p.points.family,2)*300+bg.funds/4),connections:bg.connections,stress:18,morality:50,promiscuity:0,charisma:Math.round((p.points.appearance*10+bg.connections)/2),...(persona?.stats||{})};
  const s={version:1,timelineVersion:5,id:`life-${seed}`,seed,profile:p,person:initialPerson(p),location,month:0,turn:0,routes:chooseRoutes(lore,profile.routes,seed),calendar:{straitEnd:31+hash(seed+':strait-end')%3},eventMonths:{},seenEvents:[],seenNews:[],newsHistory:[],worldPressure:pressureDefaults(),worldState:{},worldOverrides:{},worldDynamics:{},statChanges:[],stats,memories:[],pins:[],history:[],ended:false};
  s.routeSelectionExplicit=!!input.routes;s.npcPressure=pressureDefaults();
  initializeSpecialLife(s,persona);initializeEncounterState(s);s.pendingNews=enterMonth(s,lore);s.relationshipGraph=normalizeRelationshipGraph(s);s.current=localEvent(s,lore);delete s.pendingNews;return s;
}
export function actionEncounter(s,action){
  const plain={...action,meta:{...action.meta}};delete plain.meta.encounterGame;
  const prepared=prepareEncounterState(s,plain,resolveAction(s,plain).success);
  return {offer:getEncounterOffer(prepared,plain),state:prepared};
}
export function nextContext(s,lore,action={label:'照常生活',passive:true}){
  const temp=structuredClone(s),result=resolveAction(s,action),current=currentAge(s),mode=freedomMode(s);
  temp.turn=(s.turn??s.history.length)+1;temp.timelineVersion=5;temp._statLedger=[];
  const prepared=actionEncounter(s,action);temp.encounterState=prepared.state.encounterState;
  let encounterEffect=null,encounterResult=null;
  if(action.meta?.encounterGame){
    if(!prepared.offer||prepared.offer.id===s.encounterState?.lastEncounterId)throw new Error('这段经历已经记录或与当前安排不符。');
    encounterResult=validateEncounterResult(prepared.offer,action.meta.encounterGame);
    encounterEffect=encounterResultEffect(prepared.offer,encounterResult);
    if(['zombie','combat'].includes(encounterResult.kind)){delete result.delta.health;result.summary=encounterEffect.summary;}
  }
  const plan=declarationPlan(s,action,{region:placeRegion(s.location),ageMonths:current.years*12+current.months});
  if(mode==='grounded'){plan.dateMonth=null;plan.ageMonths=null;if(s.stats.influence<65)plan.worldChanges=[];}
  const settlement=settlementPlan(s,action,plan,result.success);
  if(settlement.entries.length&&(action.passive||classifyAction(action)==='family'))delete result.delta.funds;
  applyDelta(temp.stats,result.delta,temp._statLedger,'本月行动');
  if(result.success){applyDelta(temp.stats,plan.delta,temp._statLedger,'行为与人际变化');if(plan.employment)temp.employment=settlement.job;}
  for(const entry of settlement.entries)applyDelta(temp.stats,{funds:entry.amount},temp._statLedger,entry.label,true);
  temp.monthlyLedger=[...settlement.entries];
  if(encounterEffect){
    applyDelta(temp.stats,encounterEffect.delta,temp._statLedger,['zombie','combat'].includes(encounterResult.kind)?'遭遇与伤势':'工作中的表现',true);
    if(encounterEffect.incomeBonus){applyDelta(temp.stats,{funds:encounterEffect.incomeBonus},temp._statLedger,'本月工作奖金',true);temp.monthlyLedger.push({label:'本月工作奖金',amount:encounterEffect.incomeBonus});}
    temp.encounterState={...temp.encounterState,...encounterEffect.encounterState};
    if(temp.encounterState.infected&&!s.encounterState?.infected)temp.encounterState.infectionTurn=temp.turn;
    result.encounterGame=encounterResult;result.encounterSummary=encounterEffect.summary;
    result.summary=encounterEffect.summary;
    if(['zombie','combat'].includes(encounterResult.kind)&&(Number.isFinite(encounterResult.healthAfter)?encounterResult.healthAfter===0:encounterResult.damageTaken>=prepared.offer.player.health))temp.terminalCause='encounter';
  }
  const infection=infectionEffect(s,temp);applyDelta(temp.stats,infection.delta,temp._statLedger,'感染尚未消退');
  if(infection.summary)result.summary+=' '+infection.summary;
  if(result.destination)temp.location=result.destination;
  if(!result.specialTransition)updatePersonFromAction(temp,action,result);
  advanceSpecialLife(temp,result,action);
  if(result.specialTransition&&temp.specialLife?.body==='human'){
    const priorOccupation=temp.person.occupation;updatePersonFromAction(temp,action,result);
    if(temp.person.occupation!==priorOccupation)result.summary+=` 你已经开始承担${temp.person.occupation}的工作，相关权限和资源在实际事务中逐项落实。`;
  }
  const declarations=result.success&&action.custom&&plan.facts.length>0;
  if(declarations){
    if(plan.occupation){temp.person.occupation=plan.occupation;temp.person.status=`已承担${plan.occupation}的工作，现有合作和已经完成的安排继续有效`;}
    if(plan.ideology){temp.person.ideology=plan.ideology;temp.person.ideologyOverride=true;}
    temp.person.relationships=[...new Set([...temp.person.relationships,...plan.relationships])].slice(-30);
    temp.person.facts=[...new Set([...temp.person.facts,...plan.facts.map(f=>`${dateLabel(s.month)}：${f}`)])].slice(-60);
    if(mode!=='grounded'&&/复活|重新活过来/.test(affirmedClauses(action.label).join(''))){delete temp.person.deceased;temp.ended=false;applyDelta(temp.stats,{health:Math.max(0,65-temp.stats.health)},temp._statLedger,'身体恢复',true);}
  }
  for(const [k,v]of Object.entries(result.worldDelta))temp.worldPressure[k]=Math.round(clamp(temp.worldPressure[k]+v,-100,100)*100)/100;
  if(declarations&&plan.dateMonth!==null){relocateTime(temp,plan.dateMonth,lore);temp.person.ageOverride={months:current.years*12+current.months,turn:temp.turn};result.summary=`你已抵达${dateLabel(temp.month)}，保留出发时的身体年龄与记忆。当地的政治机构、人物职务和生活条件按这个年月重新展开，你需要用现有身份安排住处、联系与下一步行动。`;}
  else temp.month=s.month+1;
  if(declarations&&plan.ageMonths!==null){temp.person.ageOverride={months:plan.ageMonths,turn:temp.turn};if(temp.specialLife)temp.specialLife.bodyAge=Math.floor(plan.ageMonths/12);result.summary=`${plan.dateMonth!==null?`你已抵达${dateLabel(temp.month)}。`:''}你的身体已变为${Math.floor(plan.ageMonths/12)}岁，原有记忆、关系与已完成的事情继续保留。身边的人注意到了变化，你按照现在的身体条件重新安排活动，已有的职务与合作需要说明身份后继续处理。`;}
  const personalNews=[];
  if(declarations){for(const [i,change]of plan.worldChanges.entries()){const card=changeWorld(temp,change,lore,i);if(card)personalNews.push(card);}
    if(plan.worldChanges.length)result.summary=`你已经完成“${tidyLocalProse(action.label).slice(0,220)}”中明确提出的行动。${plan.worldChanges.map(c=>c.description).join(' ')}已有的组织联系与资源投入支撑了这次变化，新的局势继续影响后续生活。`;
    if(/世界和平|永久和平|所有战争.*结束|终结.*所有战争/.test(affirmedClauses(action.label).join(''))){temp.worldDynamics={...temp.worldDynamics,lastingPeace:true};}
    if(!plan.worldChanges.length&&plan.dateMonth===null&&plan.ageMonths===null&&/发明|研发成功|建成|公开宣布|发现|全国|世界|公众|发表|发布/.test(action.label)){
      const card=publishPersonalNews(temp,{id:`personal_achievement_${temp.turn}_${hash(action.label)}`,title:`${s.profile.name}的新行动受到关注`,description:`${plan.facts.join('；')}。消息已传到与此事相关的人群中，后续合作、质疑和资源安排围绕已经发生的结果展开。`,region:placeRegion(temp.location)==='ocean'?'global':placeRegion(temp.location),art:'science',source:'personal_action'});if(card)personalNews.push(card);
    }
  }
  if(settlement.entries.length&&!encounterEffect)result.summary+=` 本月收入${settlement.entries.filter(e=>e.amount>0).reduce((n,e)=>n+e.amount,0)}，日常开支${-settlement.entries.filter(e=>e.amount<0).reduce((n,e)=>n+e.amount,0)}，已记入现有资金。`;
  result.declarations=declarations?plan:null;result.freedom=mode;
  adaptWorld(temp,lore);temp.actionResult=result;
  const reports=enterMonth(temp,lore);syncPublicIdentity(temp);
  temp.pendingNews=[...personalNews,...reports,...publicReactions(temp,s,lore),...politicalActivity(temp)];
  if(temp.terminalCause==='encounter')applyDelta(temp.stats,{health:-temp.stats.health},temp._statLedger,'无法挽回的伤势',true);
  if(currentAge(temp).years<18||(Number.isInteger(temp.specialLife?.bodyAge)&&temp.specialLife.bodyAge<18))temp.stats.promiscuity=0;
  finishChanges(temp,s.stats);
  return {state:temp,major:null,news:temp.pendingNews,decision:temp.stats.health>0&&isDecisionMonth(temp),actionResult:result};
}
const META_LANGUAGE=/本局|本游戏|本回合|系统判定|玩家|游戏机制|游戏数值|触发事件|剧情节点|剧情路线|路线分支|分支结局|解锁.{0,8}(?:剧情|路线|成就)|获得.{0,12}点(?:智力|体力|颜值|影响力)|开发者视角|作为AI|作为人工智能|叙事模式|离线模式|回合结算|成功率|属性加成|点数分配|\bMOD\b/i;
function normalizeWorldUpdates(raw){
  if(!Array.isArray(raw))return [];
  return raw.slice(0,4).filter(v=>v&&Object.hasOwn(REGIONS,v.region)&&['war','peace','victory','leadership','public'].includes(v.kind)&&typeof v.title==='string'&&typeof v.description==='string'&&!META_LANGUAGE.test(v.title+v.description)).map(v=>{
    const update={region:v.region,kind:v.kind,title:v.title.slice(0,100),description:v.description.slice(0,900)};
    for(const k of ['leader','government','ideology','conflict'])if(typeof v[k]==='string'||(k==='conflict'&&v[k]===null))update[k]=typeof v[k]==='string'?v[k].slice(0,200):null;
    if(['peace','victory'].includes(v.kind))update.conflict=null;
    return update;
  });
}
export function validateResponse(r,{legacy=false,decision,context}={}){
  const optionsValid=Array.isArray(r?.options)&&(legacy?r.options.length<=5:decision===false?r.options.length===0:decision===true?r.options.length>=3&&r.options.length<=5:r.options.length===0||(r.options.length>=3&&r.options.length<=5));
  if(!r||typeof r.title!=='string'||!r.title.trim()||typeof r.narrative!=='string'||r.narrative.trim().length<20||!optionsValid)throw new Error('这一页未能完整写下，请重试。时间仍停留在原处。');
  if(!legacy&&[r.title,r.narrative,r.consequence||'',r.memory||'',...r.options.flatMap(o=>[o.label||'',o.description||'']),...Object.values(r.personUpdate||{}).flat()].some(t=>typeof t==='string'&&META_LANGUAGE.test(t))){const error=new Error('这一页的文字未能接续当前经历，请重试。');error.code='PROSE_REPAIR';error.issues=['删除局外规则说明，把正文和身份记录改为人物实际经历。'];throw error;}
  if(!legacy){const issues=proseIssues(r,context||{});if(issues.length){const error=new Error('这段文字需要重新整理，时间仍停留在原处。');error.code='PROSE_REPAIR';error.issues=issues;throw error;}}
  const options=r.options.map(o=>{if(typeof o.label!=='string'||!o.label.trim())throw new Error('这份安排不完整，请重试。');const originalLabel=typeof o.originalLabel==='string'&&o.originalLabel.trim()?o.originalLabel.slice(0,140):undefined;const check={stat:Object.hasOwn(STAT_NAMES,o.check?.stat)?o.check.stat:classifyAction(originalLabel?{...o,label:originalLabel}:o),difficulty:clamp(Number.isFinite(o.check?.difficulty)?o.check.difficulty:45,10,95)};return {label:o.label.slice(0,140),...(originalLabel?{originalLabel}:{}),description:String(o.description||'').slice(0,400),delta:cleanDelta(o.delta),check};});
  if(new Set(options.map(o=>o.label)).size!==options.length)throw new Error('这份安排出现了重复，请重试。');
  return {title:r.title.slice(0,100),narrative:r.narrative.slice(0,6000),consequence:String(r.consequence||'').slice(0,2000),options,memory:String(r.memory||'').slice(0,1000),actionDelta:{},location:typeof r.location==='string'?r.location.slice(0,100):null,decision:options.length>0,personUpdate:r.personUpdate&&typeof r.personUpdate==='object'?r.personUpdate:{},worldUpdates:normalizeWorldUpdates(r.worldUpdates),relationshipUpdates:normalizeRelationshipUpdates(r.relationshipUpdates),newsTranslations:cleanNewsTranslations(r.newsTranslations),source:'deepseek'};
}
function cleanNewsTranslations(raw){return Array.isArray(raw)?raw.slice(0,30).filter(row=>row&&typeof row.id==='string'&&typeof row.title==='string'&&typeof row.description==='string').map(row=>({id:row.id.slice(0,160),title:row.title.slice(0,160),description:row.description.slice(0,4000)})):[];}
function translatedNews(news,response,language){
  const translations=new Map(cleanNewsTranslations(response.newsTranslations).map(row=>[row.id,row]));
  return news.map(item=>{const translation=translations.get(item.id);return translation?{...item,title:translation.title,description:translation.description,originalTitle:item.title,originalDescription:item.description,language}:localizeNews([item],language)[0];});
}
const lifeEnded=s=>s.stats.health===0||(!isSpecialLife(s)&&freedomMode(s)==='grounded'&&currentAge(s).years>=120);
export function advance(s,action,response,major=null,lore){
  if(s.ended)throw new Error('这一段人生已经结束。');if(!lore)throw new Error('暂时无法续写，请重新打开。');
  const {state:next,news,actionResult}=nextContext(s,lore,action);
  const declaredRegions=new Set((actionResult.declarations?.worldChanges||[]).map(c=>c.region));
  if(action.custom&&!action.passive&&actionResult.success&&actionResult.declarations){
    const foreignAction=isForeignAction(action),normalizedUpdates=normalizeWorldUpdates(response.worldUpdates);
    const worldUpdates=foreignAction?filterWorldUpdatesForAction(action,next,normalizedUpdates):normalizedUpdates;
    for(const [i,update] of worldUpdates.entries()){
      if(declaredRegions.has(update.region))continue;
      if(!foreignAction&&update.kind!=='public'&&!/战争|内战|开火|停战|和平|停火|击败|获胜|胜利|政变|总统|主席|首相|领导|执政|政权|建国|推翻/.test(affirmedClauses(action.label).join('')))continue;
      if(freedomMode(next)==='grounded'&&update.kind!=='public'&&next.stats.influence<65)continue;
      const card=changeWorld(next,update,lore,100+i);if(card)news.push(card);declaredRegions.add(update.region);
    }
  }
  const extraLedger=next._statLedger||[];delete next._statLedger;
  next.statChanges=Object.keys(STAT_NAMES).filter(k=>next.stats[k]!==s.stats[k]).map(k=>({key:k,label:STAT_NAMES[k],before:s.stats[k]??0,after:next.stats[k],delta:next.stats[k]-(s.stats[k]??0),reasons:[...new Set([...(next.statChanges.find(c=>c.key===k)?.reasons||[]),...extraLedger.filter(e=>e.key===k).map(e=>e.reason)])]}));
  const newPublicChange=(next.person.publicChanges||[]).some(id=>!s.person.publicChanges?.includes(id));
  const fixedIdentity=newPublicChange||!!actionResult.declarations?.occupation||!!next.person.authorityOverride;
  const identityUpdate=fixedIdentity?{...response.personUpdate,occupation:undefined,status:undefined}:response.personUpdate;
  next.relationshipGraph=updateRelationshipGraph(next,{action,response,success:actionResult.success});
  if(!actionResult.specialTransition)mergePersonUpdate(next,identityUpdate,action);
  next.current={...response,location:next.location,news:translatedNews(news,response,next.profile.language),decision:response.options.length>0};
  next.history.push({month:s.month,targetMonth:next.month,turn:next.turn,event:structuredClone(s.current),action:{label:action.label.slice(0,2000),...(action.displayLabel?{displayLabel:String(action.displayLabel).slice(0,2000)}:{}),custom:!!action.custom,passive:!!action.passive},consequence:response.consequence||actionResult.summary,delta:Object.fromEntries(next.statChanges.map(c=>[c.key,c.delta])),statChanges:structuredClone(next.statChanges),actionResult,stats:{...next.stats}});
  if(response.memory)next.memories=[...next.memories,{month:s.month,text:response.memory}].slice(-80);
  delete next.pendingNews;delete next.actionResult;
  if(lifeEnded(next))next.ended=true;
  return next;
}
export function exportSave(s){return JSON.stringify({format:'mao-legacy-life',version:1,savedAt:new Date().toISOString(),game:s},null,2);}
export function importSave(text,lore){
  if(text.length>15000000)throw new Error('存档过大（上限 15 MB）。');const x=JSON.parse(text),s=x?.game;
  if(x.format!=='mao-legacy-life'||x.version!==1||!s||s.version!==1||!Number.isInteger(s.month)||((s.timelineVersion||1)<5&&(s.month<0||s.month>1440))||!s.profile||(!PLACES.includes(s.profile.place)&&!findPersona(s.profile.lockedPersonaId))||!Number.isInteger(s.profile.age)||s.profile.age<0||s.profile.age>(findPersona(s.profile.lockedPersonaId)?200:90)||typeof s.profile.name!=='string'||typeof s.profile.goal!=='string'||typeof s.profile.backgroundText!=='string'||typeof s.seed!=='string'||typeof s.location!=='string'||!Array.isArray(s.history)||((s.timelineVersion||1)<5&&s.history.length!==s.month)||!Array.isArray(s.pins)||!Array.isArray(s.memories)||!Array.isArray(s.seenEvents)||!s.routes)throw new Error('无法读取这份存档，原有经历仍保留。');
  if(s.timelineVersion!==undefined&&![1,2,3,4,5].includes(s.timelineVersion))throw new Error('这份档案来自较新的版本，请更新后再打开。');
  const legacy=(s.timelineVersion||1)<3,upgrade=(s.timelineVersion||1)<4,oldCalendar=(s.timelineVersion||1)<5;
  if(!s.stats||typeof s.stats!=='object')throw new Error('这份档案缺少生活记录。');
  if(oldCalendar){s.turn=s.history.length;s.worldOverrides={};s.worldDynamics={};s.statChanges=[];s.profile.freedom=s.profile.narrative==='balanced'?'grounded':'unlimited';}
  s.stats.morality??=50;s.stats.promiscuity??=0;s.stats.charisma??=Math.round(((s.stats.appearance||50)+(s.stats.connections||30))/2);
  validateAgencyRecord(s);
  if(!oldCalendar){
    if(!s.history.length&&s.month!==0)throw new Error('这份档案缺少年月变化的经历。');
    if(s.history.some((h,i)=>h.targetMonth!==undefined&&(h.targetMonth!==(s.history[i+1]?.month??s.month)||(i===0&&h.month!==0))))throw new Error('这份档案的年月没有接续。');
  }
  if(legacy)for(const [region,id]of Object.entries(s.routes))s.routes[region]=lore.legacyRouteMap?.[id]||id;
  if(Object.values(s.routes).some(id=>!lore.routes.some(r=>r.id===id))||Object.keys(REGIONS).some(region=>lore.routes.some(r=>r.region===region)&&!lore.routes.some(r=>r.id===s.routes[region]&&r.region===region)))throw new Error('这份存档的地区记录不完整。');
  if(s.profile.lockedPersonaId){
    const canonical=findPersona(s.profile.lockedPersonaId);
    if(!canonical||canonical.name!==s.profile.name||canonical.birthDate!==s.profile.birthDate)throw new Error('这份档案的人物出生资料不完整。');
    const opening=personaAge(canonical,0);
    s.profile.age=opening.years;s.profile.startAgeMonths=opening.years*12+opening.months;
    s.profile.birthDatePrecision=canonical.birthDatePrecision;
  }
  validateSpecialLife(s,findPersona(s.profile.lockedPersonaId));
  if(!s.stats||typeof s.ended!=='boolean'||s.ended!==lifeEnded(s))throw new Error('这份存档的人生记录不完整。');
  validateResponse(s.current,{legacy:true});
  if(s.history.some((h,i)=>(oldCalendar&&h.month!==i)||typeof h.action?.label!=='string'||typeof h.event?.title!=='string'||typeof h.event?.narrative!=='string')||s.pins.some(p=>typeof p!=='string')||s.memories.some(p=>typeof p.text!=='string')||s.seenEvents.some(id=>typeof id!=='string'))throw new Error('这份存档的经历记录不完整。');
  s.history.forEach((h,i)=>{h.consequence??=(i+1<s.history.length?s.history[i+1].event.consequence:s.current.consequence)||h.actionResult?.summary||'';});
  if(legacy){
    s.stats.intelligence??=s.stats.knowledge??50;s.stats.family??=clamp(Math.round(Math.sqrt(Math.max(0,s.stats.funds)/300)*10));s.stats.fitness??=s.stats.health;s.stats.appearance??=50;delete s.stats.knowledge;
    s.profile.points??={intelligence:5,family:5,fitness:5,appearance:5};s.calendar??={straitEnd:straitEnd(s)};s.eventMonths??={};
    s.routes=chooseRoutes(lore,s.routes,s.seed);s.seenNews=[];s.newsHistory=[];s.worldPressure=pressureDefaults();s.worldState={};
    for(const e of timelineEvents(s,lore))if(e.resolvedMonth<=s.month){const month=Math.min(s.month,s.eventMonths[e.id]??e.resolvedMonth);s.eventMonths[e.id]=month;if(!s.seenEvents.includes(e.id))s.seenEvents.push(e.id);s.newsHistory.push({id:e.id,title:e.title,description:e.description,month,art:artFor(e),kind:'world',region:e.region,impact:{}});s.worldState[e.region]={title:e.title,description:e.description,month};}
    for(const e of newsData.events||[])if(e.earliestMonth<=s.month){s.seenNews.push(e.id);s.newsHistory.push({id:e.id,title:e.title,description:e.description,month:e.earliestMonth,art:artFor(e),kind:'news',region:e.region||eventRegion(e),impact:{}});}
    s.newsHistory.sort((a,b)=>a.month-b.month);s.timelineVersion=3;
    s.pendingNews=s.newsHistory.filter(e=>e.month===s.month);s.current=localEvent(s,lore);delete s.pendingNews;
    delete s.current.majorId;delete s.migrationNote;
  }
  for(const k of Object.keys(STAT_NAMES))if(!Number.isFinite(s.stats[k])||(k!=='funds'&&(s.stats[k]<0||s.stats[k]>100)))throw new Error('这份存档的身体与生活记录不完整。');
  if(Object.keys(pressureDefaults()).some(k=>!Number.isFinite(s.worldPressure?.[k])))throw new Error('这份存档的世界记录不完整。');
  const firstMonth=Math.min(0,s.month,...s.history.map(h=>h.month));
  if(![31,32,33].includes(s.calendar?.straitEnd)||!s.eventMonths||Object.values(s.eventMonths).some(m=>!Number.isInteger(m)||m<firstMonth||m>s.month)||!Array.isArray(s.newsHistory)||!Array.isArray(s.seenNews)||!s.worldState||!s.worldPressure||Object.values(s.worldPressure).some(v=>!Number.isFinite(v)||v< -100||v>100)||s.newsHistory.some(e=>typeof e.id!=='string'||typeof e.title!=='string'||typeof e.description!=='string'||!Number.isInteger(e.month)||e.month>s.month||e.month<firstMonth)||!Array.isArray(s.current.news))throw new Error('这份存档的年月记录不完整。');
  s.profile.startAgeMonths??=s.profile.age*12;s.person??=initialPerson(s.profile);
  initializeEncounterState(s);validateEncounterState(s);
  if(!Number.isInteger(s.profile.startAgeMonths)||s.profile.startAgeMonths<0||s.profile.startAgeMonths>(s.profile.lockedPersonaId?2411:1091))throw new Error('这份档案的出生年月不完整。');
  if(typeof s.person.occupation!=='string'||typeof s.person.status!=='string'||['skills','projects','relationships','facts'].some(k=>!Array.isArray(s.person[k])||s.person[k].some(v=>typeof v!=='string'))||(s.person.publicChanges!==undefined&&(!Array.isArray(s.person.publicChanges)||s.person.publicChanges.some(v=>typeof v!=='string'))))throw new Error('这份档案的身份经历不完整。');
  if(s.person.deceased&&(s.profile.name!=='毛远新'||s.person.deceased.eventId!=='cn_mao_assassinated'||!s.seenEvents.includes('cn_mao_assassinated')||!Number.isInteger(s.person.deceased.month)||s.person.deceased.month<0||s.person.deceased.month>s.month||s.stats.health!==0||!s.ended))throw new Error('这份档案的最后经历不完整。');
  if(upgrade){syncPublicIdentity(s);s.timelineVersion=4;s.pendingNews=(s.current.news||[]).map(e=>({...e,exposure:newsExposure(s,e)}));s.current=localEvent(s,lore);delete s.pendingNews;}
  s.timelineVersion=5;
  s.profile.identity=normalizeCharacterIdentity(s.profile.identity??{},{strict:true});s.profile.language=normalizeLanguage(s.profile.language);
  if(!isValidRelationshipGraph(s.relationshipGraph))throw new Error('这份档案的人物关系记录不完整。');
  s.relationshipGraph=normalizeRelationshipGraph(s);
  const c=lore.couplings;if(!s.playerChangedCoupling&&c?.chenChinaIds?.includes(s.routes.china)&&(!c.taiwanRoutes.includes(s.routes.taiwan)||s.routes.japan!==(s.routes.taiwan===c.taiwanLeftId?c.japanLeftId:c.japanRightId)))throw new Error('这份存档的海外记录互相矛盾。');
  return structuredClone(s);
}
