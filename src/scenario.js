import {REGIMES} from './regime-rules.js';

const APRIL_ID='mao-april';
const refs=[{file:'common/on_actions/_Zmaos_ap.txt',key:'yurenjie_start'},{file:'events/TFR_MAO7_EVENT.txt',key:'PRC_MAO7.11'},{file:'localisation/simp_chinese/replace/_maoap_l_simp_chinese copy.yml',key:'PRC_MAO7.12.d'}];
export const isAprilScenario=state=>state?.profile?.scenario?.id===APRIL_ID&&state.profile.scenario.version===1;
// Call only while creating a new life. Later language changes cannot rewrite the world.
export const createOpeningScenario=profile=>({id:profile.language==='shuihu'?APRIL_ID:'standard',version:1});
const known=state=>new Set([...(state.seenEvents||[]),...(state.newsHistory||[]).filter(e=>e.month<=state.month).map(e=>e.id)]);
export function scenarioRegionPatch(state,region){
  if(!isAprilScenario(state)||state.month<0)return {};
  if(region==='china')return {...REGIMES.china_april_bo,leader:'薄熙来',government:'薄熙来任主席的太子党独裁体制',stage:'april_bo',institutions:['主席办公机构','国务院','地方政府','公共安全机关']};
  if(region==='taiwan')return known(state).has('april_direct_democracy')?
    {...REGIMES.taiwan_april_commune,leader:'赖清德（毛泽东借魂）',government:'群众议事组织与计划经济委员会共同处理台湾政务',stage:'april_commune',institutions:['群众议事组织','工人委员会','计划经济委员会','地方行政机关']}:
    {...REGIMES.taiwan_april_lai,leader:'赖清德（毛泽东借魂）',government:'赖清德执政，府院与议会仍在运作，群众政治正在形成',stage:'april_lai',institutions:['总统府','行政院','立法院','县市政府']};
  return {};
}
/** Establish the explicitly requested alternate opening, once and only at creation. */
export function applyOpeningScenario(state){
  if(!isAprilScenario(state)||state.scenarioState?.initialized)return [];
  state.scenarioState={id:APRIL_ID,version:1,initialized:true,startedMonth:state.month};
  state.person??={};
  if(state.profile.lockedPersonaId==='mao_zedong'||state.profile.name==='毛泽东'){
    state.specialLife={version:1,kind:'mao_resurrection',stage:4,body:'human',experience:30,growth:0,resurrected:true,bodyAge:60,lastAction:'借赖清德之身醒来',monthsInBody:0};
    state.profile.specialScenario='mao_resurrection';
    state.person.bodyPersonaId='lai_chingte';state.person.bodyIdentity='赖清德';
    state.person.ageOverride={months:60*12+2,turn:state.turn||0};
    state.person.occupation='借赖清德之身处理台湾总统政务的毛泽东';
    state.person.status='意识与记忆属于毛泽东，实际活动的身体是赖清德；原来的水晶棺内没有第二个可独立行动的毛泽东';
    state.person.ideology='毛主义与群众政治';state.person.custody=false;
    state.profile.backgroundText='你保有毛泽东的记忆，已经借赖清德之身醒来，能够在台湾自由行动。眼前的身体与社会身份属于赖清德，府院、议会与各地居民正等着你说明施政打算。北京原来的水晶棺没有另一个能够独立行动的你。';
    state.profile.startLocation='中国台湾';state.location='中国台湾';state.stats.influence=Math.max(state.stats.influence||0,85);
    state.person.facts=[...(state.person.facts||[]),'毛泽东借赖清德之身醒来，保有毛泽东的记忆与赖清德当前的身体和执政处境。'];
  }else if(state.profile.name==='赖清德'){
    state.person.status='身体仍为赖清德，意识中能够感知毛泽东的借魂与记忆，正在处理府院与群众组织的关系';
    state.person.occupation='台湾总统';state.person.ideology='受到毛泽东借魂影响的群众政治';
    state.profile.backgroundText='你仍是赖清德，已经身居台湾执政之位。毛泽东的意识与记忆借住在你的身体中，影响着你对群众、议会和两岸的判断；府院、工会与地方代表等待你处理眼前事务。';
  }else if(state.profile.name==='薄熙来'){
    state.person.occupation='中国国家主席';state.person.status='以主席身份主持太子党主导的政府';state.person.custody=false;state.person.ideology=REGIMES.china_april_bo.ideology;
    state.profile.backgroundText='你是薄熙来，现已担任中国国家主席，主持太子党主导的政府。军政部门与地方官员向你呈报事务，你需要面对经济、公共服务与权力分配中的具体问题。';
    state.profile.startLocation='北京';state.location='北京';
    state.stats.influence=Math.max(state.stats.influence||0,90);
  }
  return [];
}
export function scenarioMonthlyEvents(state){
  if(!isAprilScenario(state)||state.month<0)return [];
  const seen=known(state),start=state.scenarioState?.startedMonth??0;
  const events=[
    {id:'april_opening',earliestMonth:start,region:'global',title:'薄熙来当朝，赖清德借魂',description:'话说薄熙来已坐镇北京，执掌主席之职。海峡另一边，赖清德身中借住着毛泽东的意识，府院人事仍待料理，旧日议会也照常开门。此事传开，有人盼得改革，有人担忧眼前生计，各方正察看两岸动静。',sourceRefs:refs},
    {id:'april_public_assemblies',earliestMonth:start+3,requires:['april_opening'],region:'taiwan',title:'街坊工厂商议公事',description:'且说台湾各地有工人、学生与街坊约定会面，把工钱、房租及地方用度逐项写下。赖清德应允接见代表，议员与行政人员也来听取意见。各处议事如何与原有公职衔接，众人尚须商定。',sourceRefs:[refs[1],{file:'localisation/simp_chinese/replace/_maoap_l_simp_chinese copy.yml',key:'PRC_MAO7.17.d'}]},
    {id:'april_direct_democracy',earliestMonth:start+7,requires:['april_public_assemblies'],region:'taiwan',title:'群众议事与计划委员会成立',description:'当下代表们议定章程，工厂、学校与街坊分别推举议事人员，公开登记公共开支。计划经济委员会着手核对物资与生产，原有行政人员留任交接。有人赞成自行作主，也有人要求保留申诉与监督的门路，这番争论还在各处继续。',sourceRefs:[{file:'events/TFR_MAO7_EVENT.txt',key:'PRC_MAO7.17'},{file:'localisation/simp_chinese/replace/_maoap_l_simp_chinese copy.yml',key:'PRC_MAO7.19.d'}]}
  ];
  return events.filter(e=>!seen.has(e.id)&&state.month>=e.earliestMonth&&(e.requires||[]).every(id=>seen.has(id)&&state.month-((state.newsHistory||[]).find(item=>item.id===id)?.month??state.eventMonths?.[id]??state.month)>=3)&&!(e.region==='taiwan'&&state.worldOverrides?.taiwan?.source==='player')).slice(0,1).map(e=>({...e,month:state.month,kind:'world',source:'april_scenario',art:'politics',category:'politics',impact:{}}));
}
export function scenarioAllowsEvent(state,event){
  if(!isAprilScenario(state)||event.source==='player'||event.source==='april_scenario')return true;
  // The ordinary succession and Taiwanese four-way civil-war chains describe another timeline.
  return !/^(?:cn_|tw_|dpp_|rs_tw_(?:tsai_resignation|full_mobilization|green|blue|kmt|dpp|left|revanchist)|april_)/.test(event.id||'');
}
export function scenarioAdaptEvent(state,event){
  if(!isAprilScenario(state)||event.id!=='world_opening')return event;
  return {...event,title:'新年疫情消息',description:'武汉出现新型肺炎病例，卫生部门正在核查接触与传播情况。各地居民开始留意健康通报、交通与物资安排。',sourceRefs:(event.sourceRefs||[]).filter(r=>!r.key?.startsWith('CHI_'))};
}
export function scenarioContext(state){
  if(!isAprilScenario(state))return null;
  return {id:APRIL_ID,bodyIdentity:state.person?.bodyIdentity||null,sourceRefs:refs,
    facts:['薄熙来已于2020年开局担任中国主席，不能再称其正在服刑。','毛泽东借魂赖清德，这是当前真实发生的意识与身体状态，不能写成普通噩梦。','台湾制度以已公布的群众议事进展为准，尚未发生的公社化不得提前完成。'],
    personalRule:state.person?.bodyIdentity==='赖清德'?'本人保留毛泽东记忆，身体、年龄与日常处境属于赖清德；能够自由行动，所在台湾，不能同时退回北京水晶棺或制造第二个独立毛泽东。':'毛泽东与赖清德共处一个实际行动身体，不能按两个互不关联的人物处理。'};
}
