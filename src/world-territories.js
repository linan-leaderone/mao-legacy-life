import {regionContext,regionForPlace} from './regions.js';
import {REGIMES} from './regime-rules.js';
import {getCountryContext} from './countries.js';
import {geographyUnits,getGeographyUnit,resolveTerritoryTargets,geographyAncestors} from './geography.js';
export {geographyUnits,geographySources,getGeographyUnit,resolveTerritoryTargets,searchGeographyUnits,geographyAncestors} from './geography.js';

const PLACES={china:'中国大陆',taiwan:'中国台湾',japan:'日本',korea:'韩国',hongkong:'香港',macau:'澳门'};
const COUNTRY_REGIONS={CHN:'china',TWN:'taiwan',JPN:'japan',KOR:'korea',HKG:'hongkong',MAC:'macau'};
const UNIT_INDEX=new Map(geographyUnits.map(row=>[row.id,row]));
const REGION_COUNTRIES=new Map(geographyUnits.filter(unit=>unit.role==='country').map(unit=>[unit.region,unit.country]));

function eventSet(state){return new Set([...(state.seenEvents||[]),...(state.seenNews||[]),...(state.newsHistory||[]).filter(e=>e.month<=state.month).map(e=>e.id),...(state.current?.majorId?[state.current.majorId]:[])]);}
function knownContext(state,region,lore){
  if(PLACES[region])return regionContext({...state,location:PLACES[region]},lore);
  return {...getCountryContext(state,REGION_COUNTRIES.get(region)),region};
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
  const parents=geographyAncestors(unit).slice(1).reverse().filter(parent=>parent.role!=='country').map(parent=>store[parent.id]);
  return Object.assign({},store['country:'+unit.country],store['region:'+unit.region],unit.parent?store['province:'+unit.parent]:null,...parents,store[unit.id]);
}
export function createTerritoryContext(state,lore){
  const seen=eventSet(state),contexts={};
  for(const region of REGION_COUNTRIES.keys())contexts[region]=knownContext(state,region,lore);
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
    const controllerRegion=REGION_COUNTRIES.has(controllerId)?controllerId:Object.keys(state.worldOverrides||{}).find(key=>state.worldOverrides[key]?.factionId===controllerId);
    const allContexts=prepared?.contexts;
    const controllerContext=allContexts?(allContexts[controllerId]||Object.values(allContexts).find(row=>row.factionId===controllerId)):(controllerRegion?knownContext(state,controllerRegion,lore):null);
    const regime=REGIMES[controllerId];
    if(controllerContext){government=controllerContext.government||null;ideology=controllerContext.ideology||regime?.ideology||null;}
    else if(regime){government=`${controller}实际管治，地方制度安排尚待确认`;ideology=regime.ideology;}
    else {government=`${controller}实际管治，地方制度安排尚待确认`;ideology=null;}
  }
  let conflict=currentWar(state,unit.region,context,seen);
  if(Object.hasOwn(patch,'conflict'))conflict=patch.conflict;
  // A monthly personal update needs only the controlling faction. Building all
  // country dossiers is reserved for the map's shared rendering context.
  let factionWars=prepared?.factionWars;
  if(!factionWars){
    const controllerRegion=REGION_COUNTRIES.has(controllerId)?controllerId:Object.keys(state.worldOverrides||{}).find(key=>state.worldOverrides[key]?.factionId===controllerId);
    const factionContext=controllerId===base.controllerId?context:controllerRegion?knownContext(state,controllerRegion,lore):null;
    factionWars={};
    if(factionContext)factionWars[controllerId]=currentWar(state,controllerRegion||unit.region,factionContext,seen);
    for(const [id,value] of Object.entries(state.factionConflicts||{}))factionWars[id]=typeof value==='string'?value:value?.conflict??null;
  }
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
  let unit=state.position?.locationSnapshot===location?getGeographyUnit(state.position.unitId):null;
  unit??=candidates.length===1?candidates[0]:null;
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
