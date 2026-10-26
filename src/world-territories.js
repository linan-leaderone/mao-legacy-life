import atlas from './data/world-geography-index.json' with {type:'json'};
import {regionContext,regionForPlace} from './regions.js';
import {REGIMES} from './regime-rules.js';
import * as OpenCC from 'opencc-js';

const simplify=OpenCC.Converter({from:'tw',to:'cn'});
const clean=value=>simplify(String(value||'')).toLowerCase().replace(/[\s·・,，。]/g,'');
const PLACES={china:'中国大陆',taiwan:'中国台湾',japan:'日本',korea:'韩国',hongkong:'香港',macau:'澳门'};
const COUNTRY_REGIONS={CHN:'china',TWN:'taiwan',JPN:'japan',KOR:'korea',HKG:'hongkong',MAC:'macau'};
const COUNTRY_ALIASES={CHN:['中国大陆','大陆','中国'],TWN:['中国台湾','台湾','台灣'],JPN:['日本'],KOR:['韩国','韓國'],HKG:['香港'],MAC:['澳门','澳門'],USA:['美国'],PRK:['朝鲜'],RUS:['俄罗斯'],IND:['印度']};
const SOURCES=new Map(atlas.sources.map(row=>[row.id,row]));
export const geographyUnits=atlas.units.map(row=>({id:row.id,name:row.n,aliases:row.a||[],country:row.c,region:row.r,level:row.l,parent:row.p||'',center:row.z,bounds:row.b,source:SOURCES.get(row.l)}));
const UNIT_INDEX=new Map(geographyUnits.map(row=>[row.id,row]));
const NAME_INDEX=new Map();
for(const unit of geographyUnits){
  const names=[unit.name,...unit.aliases,...(unit.id.startsWith('country:')?COUNTRY_ALIASES[unit.country]||[]:[])];
  for(const name of names){const key=clean(name);if(key.length<2)continue;const rows=NAME_INDEX.get(key)||[];if(!rows.includes(unit))rows.push(unit);NAME_INDEX.set(key,rows);}
}
export const geographySources=atlas.sources;
export const getGeographyUnit=id=>UNIT_INDEX.get(id)||null;

/** Returns unambiguous geographic targets. A bare duplicate district name is
 * deliberately not guessed; a parent name or explicit region can disambiguate. */
export function resolveTerritoryTargets(text,{region}={}){
  const value=clean(text);if(!value)return [];
  const clauseValue=simplify(String(text||'')).toLowerCase().replace(/\s/g,'');
  if(UNIT_INDEX.has(text))return [UNIT_INDEX.get(text)];
  const namedCountries=Object.entries(COUNTRY_ALIASES).filter(([,names])=>names.some(name=>value.includes(clean(name)))).map(([id])=>id);
  // "中国台湾" contains the mainland alias "中国"; the longer region wins.
  if(value.includes('中国台湾')&&namedCountries.includes('CHN'))namedCountries.splice(namedCountries.indexOf('CHN'),1);
  const found=[];
  for(const [name,units] of NAME_INDEX){
    if(!value.includes(name))continue;
    let candidates=region?units.filter(row=>row.region===region):units;
    if(candidates.length>1&&namedCountries.length===1){const local=candidates.filter(row=>row.country===namedCountries[0]);if(local.length)candidates=local;}
    if(candidates.length>1){const canonical=candidates.filter(row=>clean(row.name)===name);if(canonical.length===1)candidates=canonical;}
    if(candidates.length>1){const parents=candidates.filter(row=>row.parent&&value.includes(clean(row.parent)));if(parents.length)candidates=parents;}
    if(candidates.length!==1)continue;
    found.push({unit:candidates[0],length:name.length,match:name});
  }
  found.sort((a,b)=>b.length-a.length);
  const result=[];
  for(const {unit,match} of found){
    if(result.some(row=>row.id===unit.id))continue;
    if(found.some(other=>other.unit.id!==unit.id&&other.unit.parent&&value.includes(clean(other.unit.parent))&&clean(other.unit.parent).includes(match)&&other.unit.region!==unit.region))continue;
    // "台湾板桥区" identifies the district, not a second transfer of all Taiwan.
    if((unit.id.startsWith('country:')||unit.id.startsWith('province:'))&&result.some(row=>row.country===unit.country&&(!unit.id.startsWith('province:')||row.parent===unit.name)))continue;
    if(unit.id.startsWith('country:')||unit.id.startsWith('province:')){
      const aliases=[unit.name,...unit.aliases,...(COUNTRY_ALIASES[unit.country]||[])].map(clean).filter(Boolean);
      const specificButUnresolved=aliases.some(name=>{const at=clauseValue.indexOf(name);if(at<0)return false;const tail=clauseValue.slice(at+name.length).split(/[，。；;、,]/)[0];return !/^(?:全境|全岛|全国|全部|所有|整个|各地|各县|并|然后|之后|后|和|与|及)/.test(tail)&&/^[\u3400-\u9fff]{1,16}(?:县|市|区|乡|镇|村|旗|省)/.test(tail);});
      if(specificButUnresolved)continue;
    }
    result.push(unit);
  }
  return result.slice(0,32);
}

/** Broader, read-only search may list ambiguous matches; ownership resolution
 * above always remains strict. */
export function searchGeographyUnits(text,limit=16){
  const query=clean(text);if(!query)return [];
  return geographyUnits.filter(unit=>[unit.name,...unit.aliases,unit.parent?unit.parent+unit.name:''].some(value=>clean(value).includes(query))).slice(0,limit);
}

function eventSet(state){return new Set([...(state.seenEvents||[]),...(state.seenNews||[]),...(state.newsHistory||[]).filter(e=>e.month<=state.month).map(e=>e.id),...(state.current?.majorId?[state.current.majorId]:[])]);}
function knownContext(state,region,lore){
  if(PLACES[region])return regionContext({...state,location:PLACES[region]},lore);
  return {...state.worldState?.[region],...state.worldOverrides?.[region],region,government:state.worldOverrides?.[region]?.government||state.worldState?.[region]?.government};
}
function currentWar(state,region,context,seen){
  const terminated=state.worldDynamics?.terminatedConflicts||[];
  if(state.worldDynamics?.lastingPeace)return null;
  if(Object.hasOwn(state.worldOverrides?.[region]||{},'conflict'))return state.worldOverrides[region].conflict;
  if(context.conflict||context.regionalConflict)return context.conflict||context.regionalConflict;
  if(['china','taiwan'].includes(region)&&seen.has('world_strait_war')&&!seen.has('world_strait_end')&&!terminated.includes('strait'))return '台海战争';
  if(region==='usa'&&seen.has('world_usa_civil_war')&&!terminated.includes('usa'))return '美国内战';
  return null;
}
function baselineController(unit,context){
  if(context.conflict&&/内战|争夺/.test(context.conflict)&&!/接管|重建|postwar|reconstruction/.test(context.stage||''))return {controller:'各方争夺，地方管治待确认',controllerId:`contested:${unit.region}`,uncertain:true};
  return {controller:context.leader||context.government||UNIT_INDEX.get('country:'+unit.country)?.name||unit.name,controllerId:context.factionId||unit.region,uncertain:false};
}
function overrideFor(state,unit){
  const store=state.territoryOverrides||{};
  return {...store['country:'+unit.country],...store['region:'+unit.region],...(unit.parent?store['province:'+unit.parent]:{}),...store[unit.id]};
}
export function createTerritoryContext(state,lore){
  const seen=eventSet(state),contexts={};
  for(const region of new Set(geographyUnits.map(row=>row.region)))contexts[region]=knownContext(state,region,lore);
  const factionWars={};
  for(const [region,context] of Object.entries(contexts)){const conflict=currentWar(state,region,context,seen);factionWars[region]=conflict;if(context.factionId)factionWars[context.factionId]=conflict;}
  for(const [id,conflict] of Object.entries(state.factionConflicts||{}))factionWars[id]=typeof conflict==='string'?conflict:conflict?.conflict??null;
  return {seen,contexts,factionWars};
}
/** Read-only projection. Territory overrides never become history merely by
 * looking at the map, and ended conflicts cannot be revived by stale overlays. */
export function deriveTerritorySituation(state,feature,lore,prepared){
  const unit=typeof feature==='string'?UNIT_INDEX.get(feature):feature;
  if(!unit)return null;
  const context=prepared?.contexts?.[unit.region]||knownContext(state,unit.region,lore);
  const seen=prepared?.seen||eventSet(state),base=baselineController(unit,context),patch=overrideFor(state,unit);
  const controller=patch.controller||base.controller,controllerId=patch.controllerId||(patch.controller?patch.controller:base.controllerId);
  let government=context.government||null,ideology=context.ideology||null;
  if(patch.controller||patch.controllerId){
    const allContexts=prepared?.contexts||createTerritoryContext(state,lore).contexts;
    const controllerContext=allContexts[controllerId]||Object.values(allContexts).find(row=>row.factionId===controllerId);
    const regime=REGIMES[controllerId];
    if(controllerContext){government=controllerContext.government||null;ideology=controllerContext.ideology||regime?.ideology||null;}
    else if(regime){government=`${controller}实际管治，地方制度安排尚待确认`;ideology=regime.ideology;}
    else {government=`${controller}实际管治，地方制度安排尚待确认`;ideology=null;}
  }
  let conflict=currentWar(state,unit.region,context,seen);
  if(Object.hasOwn(patch,'conflict'))conflict=patch.conflict;
  const factionWars=prepared?.factionWars||createTerritoryContext(state,lore).factionWars;
  if(Object.hasOwn(factionWars,controllerId)&&factionWars[controllerId])conflict=factionWars[controllerId];
  if(Object.hasOwn(state.factionConflicts||{},controllerId)&&state.factionConflicts[controllerId]===null)conflict=null;
  if(state.worldDynamics?.lastingPeace)conflict=null;
  const war=Boolean(conflict),frontline=war&&patch.frontline===true;
  return {unitId:unit.id,name:unit.name,region:unit.region,country:unit.country,controller,controllerId,uncertain:!patch.controller&&base.uncertain,conflict:conflict||null,war,frontline,severity:war?(frontline?1:0.45):0,government,ideology,month:patch.month??state.month,source:patch.source||null,description:frontline?'当地正在交战，通行、供给与安全受到直接影响。':war?'所属势力正在参战，动员、运输与物价波动影响日常；未确认当地发生交战。':'目前没有当地正在交战的消息。'};
}
/** Life simulation uses the same facts as the map. This only describes the
 * exposure; the engine decides and records actual monthly effects once. */
export function territoryExposure(state,location=state.location,lore){
  const region=regionForPlace(location),candidates=resolveTerritoryTargets(location,{region:region==='global'?undefined:region});
  let unit=candidates.length===1?candidates[0]:null;
  if(!unit){const country=Object.keys(COUNTRY_REGIONS).find(id=>COUNTRY_REGIONS[id]===region);unit=UNIT_INDEX.get('country:'+country);}
  if(!unit)return {war:false,frontline:false,severity:0,controller:null,conflict:null,region,description:'当地没有已确认的战事消息。'};
  return deriveTerritorySituation(state,unit,lore);
}

export function controllerColor(id){
  const fixed={china:'#bc7261',taiwan:'#70a285',japan:'#7f95b9',korea:'#ad93b4',hongkong:'#b49d62',macau:'#92a47c'};
  if(fixed[id])return fixed[id];if(String(id).startsWith('contested:'))return '#a59f93';
  let hash=0;for(const c of String(id))hash=(Math.imul(hash,31)+c.charCodeAt(0))|0;
  return `hsl(${Math.abs(hash)%360} 30% 63%)`;
}
