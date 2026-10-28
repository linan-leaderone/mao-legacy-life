import {regionContext,regionForPlace} from './regions.js';
import {getCountryContext,resolveCountry} from './countries.js';

const PLACES={china:'中国大陆',taiwan:'中国台湾',japan:'日本',hongkong:'香港',macau:'澳门',korea:'韩国'};
const PARTY_PATTERNS=[[/民进党|民進黨|民主进步党|民主進步黨/,'民进党'],[/国民党|國民黨/,'国民党'],[/基进党|基進黨/,'基进党'],[/劳动党|勞動黨/,'劳动党'],[/自民党|自民黨|自由民主党/,'自民党'],[/中国共产党|中國共產黨|中共中央/,'中国共产党'],[/左翼联盟|左翼聯盟/,'左翼联盟']];
const REGIME_PARTIES={china_initial:'中国共产党',taiwan_dpp:'民进党',taiwan_kmt:'国民党',taiwan_revanchist:'基进党',taiwan_left:'左翼联盟',japan_ldp:'自民党'};
const isNamed=(text,name)=>!!name&&typeof text==='string'&&text.includes(name);
const partyOf=text=>PARTY_PATTERNS.find(([pattern])=>pattern.test(String(text||'')))?.[1]||null;
const publicPatch=(value,month)=>value&&typeof value==='object'&&!Array.isArray(value)&&(!Number.isFinite(value.month)||value.month<=month)?value:null;
const EXECUTIVE_ROLE=/总统|總統|总理|總理|首相|主席|掌权|执政|当局.*(?:领导|主持)|体制领导|政府.*领导|主持.*政府|中共中央领导|领导班子|国家首脑|领导人|制宪会议主持/;
const LOCAL_EXECUTIVE_ROLE=/省长|省長|市长|市長|县长|縣長|区长|區長|知事/;
const FORMER_ROLE=/前任|卸任|离任|罢免|被免职|不再担任|原(?:省长|市长|县长|区长|知事|总统|首相)|前(?:省长|市长|县长|区长|知事|总统|首相)/;
const inactiveRole=party=>party?`${party}政治人物`:'参与公共事务的政治人物';

/** A political actor's jurisdiction is independent of the player's current location. */
export function declaredActorRegion(state,actor){
  for(const [key,value]of Object.entries(state.worldOverrides||{})){
    const patch=publicPatch(value,Number(state.month)||0);
    if(!patch||![patch.leader,patch.headOfGovernment].some(value=>isNamed(value,actor.name)))continue;
    const region=resolveCountry(key)?.region||(PLACES[key]?key:null);
    if(region)return region;
  }
  return actor.region||null;
}

export function politicalActorContext(state,region,lore){
  const identity=resolveCountry(region),location=PLACES[region]||identity?.name;
  if(!location)return null;
  const month=Number(state.month)||0;
  const bounded={...state,worldOverrides:Object.fromEntries(Object.entries(state.worldOverrides||{}).filter(([,value])=>publicPatch(value,month)))};
  const baseline=getCountryContext(bounded,identity?.iso||region);
  const context=regionContext({...bounded,location,position:undefined},lore);
  const unchanged=baseline&&context.leader===baseline.leader&&context.government===baseline.government&&context.factionId===baseline.factionId;
  const patch=publicPatch(bounded.worldOverrides?.[region]||bounded.worldOverrides?.[identity?.iso],month);
  return {...context,
    headOfGovernment:Object.hasOwn(patch||{},'headOfGovernment')?patch.headOfGovernment:(unchanged?baseline?.headOfGovernment:null),
    rulingParty:Object.hasOwn(patch||{},'rulingParty')?patch.rulingParty:REGIME_PARTIES[context.factionId]||(unchanged?baseline?.rulingParty:null)
  };
}

/** Current office and jurisdiction confer authority; an ideology or old title does not. */
export function describePoliticalAuthority(state,actor,context=politicalActorContext(state,actor.region)){
  const party=actor.party||partyOf(`${actor.role||''} ${actor.ideology||''} ${actor.openingIdeology||''}`),role=String(actor.role||'');
  const base={party,jurisdiction:actor.jurisdiction||null,authority:'civil-society',activityScope:'public-advocacy',canEnactGovernmentPolicy:false,role};
  if(actor.hiddenOnly||actor.autonomyEligible===false||!context)return {...base,authority:'private',activityScope:actor.activityScope||'personal-life',autonomyEligible:false};
  const namedLeader=isNamed(context.leader,actor.name),namedPremier=isNamed(context.headOfGovernment,actor.name);
  const fragmented=/fragment|civil_war/.test(context.stage||'')||/_fragmented$/.test(context.factionId||'')||/分区|分立|四个指挥中心/.test(context.government||'');
  if((namedLeader||namedPremier)&&fragmented)return {...base,authority:'faction',activityScope:'faction-controlled-area',jurisdiction:actor.jurisdiction||`${actor.name}所属当局控制的地区`,role:'所属当局负责人'};
  if(namedLeader||namedPremier){
    if(/天皇|立宪君主|礼仪性元首/.test(role)&&!namedPremier)return {...base,authority:'ceremonial',activityScope:'public-ceremonies'};
    if(/制宪会议|代表大会/.test(context.leader||'')&&!/总统|首相|国家主席/.test(role))return {...base,authority:'assembly',activityScope:'representative-deliberation'};
    return {...base,authority:'government',activityScope:'government-affairs',canEnactGovernmentPolicy:true,jurisdiction:context.label||context.location,role:EXECUTIVE_ROLE.test(role)&&!FORMER_ROLE.test(role)&&!actor.formerOffice?role:namedPremier?'现任政府首脑':'当前执政当局负责人'};
  }
  const month=Number(state.month)||0;
  const currentOffice=!actor.formerOffice&&!FORMER_ROLE.test(role)&&(!Number.isFinite(actor.officeStartMonth)||month>=actor.officeStartMonth)&&(!Number.isFinite(actor.officeEndMonth)||month<actor.officeEndMonth);
  if(LOCAL_EXECUTIVE_ROLE.test(role)&&currentOffice)return {...base,authority:'local-government',activityScope:'local-government-affairs',jurisdiction:actor.jurisdiction||role.replace(/(?:省长|省長|市长|市長|县长|縣長|区长|區長|知事).*$/,'')||'所辖地方'};
  if(/议员|議員|民意代表/.test(role)&&currentOffice)return {...base,authority:'assembly',activityScope:'representative-deliberation'};
  const currentParty=partyOf(context.rulingParty)||context.rulingParty;
  if(party){
    const governing=party===currentParty||(currentParty==='左翼联盟'&&/左翼联盟成员/.test(role));
    return {...base,authority:governing?'governing-party':'opposition',activityScope:'party-affairs',jurisdiction:null,role:EXECUTIVE_ROLE.test(role)||LOCAL_EXECUTIVE_ROLE.test(role)||actor.formerOffice?inactiveRole(party):role};
  }
  if(EXECUTIVE_ROLE.test(role)||LOCAL_EXECUTIVE_ROLE.test(role)||actor.formerOffice)return {...base,jurisdiction:null,role:inactiveRole(party)};
  return base;
}

/** The existing politics artwork depicts the PRC legislature; it is not a generic parliament. */
export function politicalNewsArt({region,authority,category,title}={}){
  if(region!=='china')return 'newsroom';
  if(category==='policy'&&/数字|工业|电子|能源|供应链/.test(title||''))return 'science';
  return authority==='government'||category==='policy'?'politics':'newsroom';
}

/** A bounded public report, never an implicit change of government or enactment of policy. */
export function buildPoliticalActivityNews(state,actor,concern){
  if(!actor||actor.hiddenOnly||actor.autonomyEligible===false||actor.authority==='private')return null;
  const resolved=actor.authority?actor:{...actor,...describePoliticalAuthority(state,actor)};
  if(resolved.authority==='private'||!resolved.region)return null;
  const topic=String(concern||'公共生活').trim(),name=resolved.name,party=resolved.party||'所属组织';
  let title,description,scope=resolved.activityScope;
  if(resolved.authority==='government'){
    title=`${name}主持政务磋商`;
    description=`${name}围绕${topic}召集有关部门讨论，要求经办人员说明现有条件与办理进度。会议收集了需要协调的问题，有关部门继续核对方案和资源安排。`;
  }else if(resolved.authority==='faction'){
    title=`${name}与所属当局商议地方事务`;
    description=`${name}围绕${topic}听取所属组织的意见，讨论范围限于${resolved.jurisdiction}。地方联络人员整理了居民的具体需要和现有物资，未解决的问题留待继续协商。`;
  }else if(resolved.authority==='assembly'){
    title=`${name}参与代表协商`;
    description=`${name}围绕${topic}收集代表意见，将分歧和待议事项列入会议记录。有关建议仍需依照议事程序讨论，参与者各自说明主张与依据。`;
  }else if(resolved.authority==='local-government'&&/民生|交通|道路|供水|教育|公共服务|地方事务|卫生|救助|住房|市政/.test(topic)){
    title=`${name}商议地方公共事务`;
    description=`${name}就${resolved.jurisdiction}的${topic}与地方工作人员交换意见，核对居民反映的问题。经办部门整理了权限内能够处理的事项，并向当地居民说明联络方式。`;
  }else if(['governing-party','opposition'].includes(resolved.authority)||resolved.authority==='local-government'&&resolved.party){
    scope='party-affairs';
    title=`${name}在${party}活动中提出主张`;
    description=`${name}围绕${topic}与党内同事和支持者交换意见，整理下一阶段的公开主张与党务联系。参与者提出了具体建议，相关意见继续在党内和公开讨论中流传。`;
  }else if(resolved.authority==='ceremonial'){
    title=`${name}出席公开活动`;
    description=`${name}出席公开活动，与到场人员交流${topic}相关的见闻。现场谈话和礼仪活动由媒体记录，行政事务仍由负责的政府机构处理。`;
  }else{
    scope='public-advocacy';title=`${name}就公共议题发表意见`;
    description=`${name}围绕${topic}参加公开讨论，向与会者说明自己的主张。听众提出疑问和不同意见，组织者将有关建议留作后续交流。`;
  }
  return {title,description,art:politicalNewsArt(resolved),region:resolved.region,source:'political_actor',actor:name,ideology:resolved.ideology,activityScope:scope,authority:resolved.authority,jurisdiction:scope==='party-affairs'?null:resolved.jurisdiction||null,pressureRegion:resolved.region,pressureScale:resolved.authority==='government'?1:resolved.authority==='faction'?0.65:0.25};
}

export const politicalPlayerRegion=state=>state.position?.region||regionForPlace(state.location||state.profile?.place||'');
