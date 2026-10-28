import data from './data/personas.json' with {type:'json'};
import specialData from './data/personas-special.json' with {type:'json'};
import curatedData from './data/personas-curated-v15.json' with {type:'json'};
import catalogData from './data/personas-catalog.json' with {type:'json'};
import modData from './data/personas-mod.json' with {type:'json'};
import {declaredActorRegion,politicalActorContext,describePoliticalAuthority,politicalPlayerRegion} from './political-actors.js';

const normalized=value=>String(value??'').normalize('NFKC').toLocaleLowerCase().replace(/[\s·・._—-]+/g,'');
const DEFAULT_POINTS={intelligence:5,family:5,fitness:5,appearance:5};
const DEFAULT_STATS={intelligence:50,family:50,fitness:50,appearance:50,influence:35,connections:35,funds:8000,health:75,stress:20};
const ESTIMATE_NOTE='初始数值为叙事估值，不代表实际智力、健康、外貌测评或本人及家庭财产。';
const sameIdentity=(a,b)=>a.qid&&b.qid?a.qid===b.qid:!!a.birthDate&&!!b.birthDate&&a.birthDate.slice(0,4)===b.birthDate.slice(0,4);
function prepareRecord(raw){
  const date=String(raw.birthDate||''),precision=raw.birthDatePrecision||(date.length===10?'day':date.length===7?'month':'year');
  const points={...DEFAULT_POINTS,...(!raw.points&&raw.category==='科研教育与技术'?{intelligence:7}:{}),...(!raw.points&&raw.category==='体育与竞技'?{fitness:7}:{}),...raw.points};
  const estimates={...DEFAULT_STATS,...Object.fromEntries(Object.entries(points).map(([key,value])=>[key,value*10])),...(!raw.stats&&raw.sitelinks?{influence:Math.min(80,Math.round(20+Math.log2(raw.sitelinks+1)*7))}:{}),...raw.stats};
  return {...raw,aliases:[...new Set(raw.aliases||[])].filter(name=>normalized(name).length>1),birthDate:date,birthDatePrecision:precision,
    asOf:'2020-01-01',background:raw.background||'custom',backgroundLabel:raw.backgroundLabel||'公开经历',
    familyBackground:raw.familyBackground||'家庭情况未有足够的公开资料。',
    status:raw.status||'在当地生活，与身边的人保持联系',
    backgroundText:raw.backgroundText||raw.biography||'既有经历保存在档案中。',
    points,stats:estimates,statsBasis:raw.statsBasis||ESTIMATE_NOTE,
    notes:[...(raw.notes||[]),...(precision!=='day'?['公开生日未精确到日，年龄使用固定日期估算并以“约”标注；没有把估算日写成真实生日。']:[])],sourceUrls:raw.sourceUrls||[]};
}
/** Groups are ordered from hand-verified priority to broad catalog. */
export function buildPersonaIndex(groups){
  const records=[],claims=new Map(),identities=new Map(),extraIds=new Map();let merged=0;
  for(let i=0;i<groups.length;i++)for(const raw of groups[i]){
    const priority=groups.length-i,record=prepareRecord(raw),key=normalized(record.name),known=identities.get(key);
    if(known&&known.priority>priority&&sameIdentity(known.record,record)){
      known.record.aliases=[...new Set([...known.record.aliases,...record.aliases])];extraIds.set(normalized(record.id),known.record);merged++;continue;
    }
    const entry={record,priority};records.push(entry);
    for(const name of [record.name,...record.aliases])if(!identities.has(normalized(name)))identities.set(normalized(name),entry);
  }
  const claim=(name,record,weight)=>{
    const key=normalized(name);if(!key)return;const old=claims.get(key);
    if(!old||weight>old.weight)claims.set(key,{record,weight});
    else if(weight===old.weight&&old.record?.id!==record.id)claims.set(key,{record:null,weight});
  };
  for(const {record,priority}of records){
    claim(record.name,record,priority*2+1);
    for(const alias of record.aliases)claim(alias,record,priority*2);
  }
  const byName=new Map([...claims].filter(([,entry])=>entry.record).map(([key,entry])=>[key,entry.record]));
  // Stable internal IDs remain valid even when the visible name is shared by two people.
  for(const {record}of records)byName.set(normalized(record.id),record);
  for(const [id,record]of extraIds)byName.set(id,record);
  return {records:records.map(entry=>entry.record),byName,merged,ambiguousNames:[...claims].filter(([,entry])=>!entry.record).map(([key])=>key)};
}
const database=buildPersonaIndex([specialData.personas,modData.personas,data.personas,curatedData.personas,catalogData.personas]);
const {records,byName}=database;
export const PERSONA_DATABASE_INFO=Object.freeze({count:records.length,merged:database.merged,ambiguousAliases:database.ambiguousNames.length,asOf:'2020-01-01'});
const BAND_MEMBERS=new Set(['hazawa_tsugumi','mitake_ran','aoba_moca','uehara_himari','udagawa_tomoe']);

/** Exact known names and aliases only; a famous surname alone never locks a profile. */
export function findPersona(name){
  const value=byName.get(normalized(name));if(!value)return null;
  const result=structuredClone(value),politics=modData.actors.find(a=>a.name===result.name);
  if(politics){result.modPolitics=structuredClone(politics);result.relationships=structuredClone(politics.relationships||[]);}
  return result;
}

/** Only publicly reached stages belong in narration; route selection never reveals a future leader. */
export function getPoliticalActors(state={}){
  const month=Number(state.month)||0;if(month<0)return [];
  const known=new Set([...(state.seenEvents||[]),...(state.seenNews||[]),...(state.current?.majorId?[state.current.majorId]:[])].filter(id=>!Number.isFinite(state.eventMonths?.[id])||state.eventMonths[id]<=month));
  for(const event of state.newsHistory||[])if(event.month<=month)known.add(event.id);
  const april=state.profile?.scenario?.id==='mao-april',activeLeader=[...Object.values(state.worldOverrides||{}).filter(x=>x&&(!Number.isFinite(x.month)||x.month<=month)).flatMap(x=>[x.leader,x.headOfGovernment]).filter(Boolean),...(april?['薄熙来','赖清德']:[])].join(' ');
  const region=politicalPlayerRegion(state),all=[],contexts=new Map();
  for(const actor of modData.actors){
    // Hidden identities never become randomly published autonomous politicians.
    if(actor.hiddenOnly)continue;
    if(actor.name===state.profile?.name)continue;
    if(april&&(['习近平','蔡英文'].includes(actor.name)||(state.person?.bodyIdentity==='赖清德'&&actor.name==='赖清德')))continue;
    if((actor.inactiveAfter||[]).some(id=>known.has(id))&&!activeLeader.includes(actor.name))continue;
    const stages=(actor.stages||[]).filter(s=>(s.requires||[]).every(id=>known.has(id))&&!(s.blockAfter||[]).some(id=>known.has(id)));
    const stage=stages.at(-1);if(!stage&&!activeLeader.includes(actor.name))continue;
    const merged={...actor,...stage};
    merged.region=declaredActorRegion(state,merged);
    if((merged.blockAfter||[]).some(id=>known.has(id))&&!activeLeader.includes(actor.name))continue;
    // A completed player transfer overrides the incumbent without overwriting their personality.
    const override=state.worldOverrides?.[merged.region];
    if(merged.incumbent&&override?.leader&&(!Number.isFinite(override.month)||override.month<=month)&&![override.leader,override.headOfGovernment].some(value=>value?.includes(actor.name)))continue;
    const relationships=(actor.relationships||[]).filter(r=>(r.requires||[]).every(id=>known.has(id)));
    const explicitPoliticalRole=activeLeader.includes(actor.name)||(state.newsHistory||[]).some(e=>['player','personal_action'].includes(e.source)&&e.month<=month&&`${e.actor||''} ${e.description||''}`.includes(actor.name)&&/任命|担任|领导|率领|组建.*(?:政府|军|政党)/.test(e.description||''));
    const civilWar=known.has('jp_hazawa_toyokawa_war')||known.has('world_japan_civil')||known.has('jp_hazawa_end')||/内战/.test(state.worldOverrides?.japan?.conflict||'');
    const isBand=BAND_MEMBERS.has(actor.id),toyokawa=actor.id==='toyokawa_sakiko';
    const autonomyEligible=isBand?(civilWar||explicitPoliticalRole):toyokawa?(known.has('jp_toyokawa_rise')||known.has('jp_emergency_committee')||explicitPoliticalRole):true;
    // Music, relief and public expression do not confer command of a state or armed faction.
    const scope=isBand&&!autonomyEligible?'music-and-personal-life':autonomyEligible?'public-affairs':'personal-life';
    let role=merged.role,ideology=merged.ideology,influence=merged.influence||35;
    if(isBand&&civilWar&&!/联合军|联合阵线/.test(role)){role=actor.id==='hazawa_tsugumi'?'参与日本左翼联合组织的音乐人':'参与战时救助与左翼公共活动的音乐人';ideology='战时形成中的左翼政治立场';}
    if(state.profile?.scenario?.id==='mao-april'){
      if(actor.name==='习近平')continue;
      if(actor.name==='薄熙来'){role='中国国家主席';ideology='市场毛主义与太子党主席独裁';influence=95;}
      if(actor.name==='赖清德'){role='毛泽东借魂的台湾执政者';ideology='群众政治与毛主义';influence=90;}
    }
    if(!contexts.has(merged.region))contexts.set(merged.region,politicalActorContext(state,merged.region));
    const current={id:actor.id,name:actor.name,region:merged.region,ideology,role,party:merged.party,jurisdiction:merged.jurisdiction,formerOffice:merged.formerOffice,officeStartMonth:merged.officeStartMonth,officeEndMonth:merged.officeEndMonth,priorities:merged.priorities||actor.priorities,relationships,influence,sourceRefs:merged.sourceRefs||actor.sourceRefs,local:merged.region===region,autonomyEligible,activityScope:scope};
    all.push({...current,...describePoliticalAuthority(state,{...current,openingIdeology:actor.ideology},contexts.get(merged.region))});
  }
  return all.sort((a,b)=>Number(b.local)-Number(a.local)||b.influence-a.influence).slice(0,12).map(x=>structuredClone(x));
}

/** Completed age at the first day of a calendar month, beginning 2020-01-01. */
export function personaAge(persona,month=0){
  const record=typeof persona==='string'?findPersona(persona):persona;
  if(!record?.birthDate&&Number.isFinite(record?.openingAgeEstimate)){
    const total=Math.max(0,Math.round(record.openingAgeEstimate*12)+Math.floor(Number(month)||0));
    return {years:Math.floor(total/12),months:total%12};
  }
  if(!record?.birthDate||!/^\d{4}(?:-\d{2}){0,2}$/.test(record.birthDate))return null;
  const [year,birthMonth=7,day=15]=record.birthDate.split('-').map(Number);
  if(year<1800||birthMonth<1||birthMonth>12||day<1||day>new Date(Date.UTC(year,birthMonth,0)).getUTCDate())return null;
  const elapsed=Math.floor(Number(month)||0);
  const currentYear=2020+Math.floor(elapsed/12),currentMonth=((elapsed%12)+12)%12+1;
  const total=Math.max(0,(currentYear-year)*12+currentMonth-birthMonth-(day>1?1:0));
  return {years:Math.floor(total/12),months:total%12};
}

/** Lock public opening facts. Later life state belongs to game.person and game.stats. */
export function lockPersonaProfile(profile={}){
  const persona=findPersona(profile.name);
  if(!persona)return {...profile};
  const age=personaAge(persona,0);
  return {...profile,name:persona.name,age:age.years,startAgeMonths:age.years*12+age.months,
    birthDate:persona.birthDate,birthDatePrecision:persona.birthDatePrecision,birthPlace:persona.birthPlace,place:persona.place,startLocation:persona.startLocation,
    background:persona.background,backgroundText:persona.backgroundText,points:{...persona.points},
    lockedPersonaId:persona.id,persona,stats:{...persona.stats}};
}

export function isPersonaLocked(profile){const record=findPersona(profile?.lockedPersonaId);return !!record&&record.name===profile?.name&&record.birthDate===profile?.birthDate;}
