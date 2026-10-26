import {regionContext,regionForPlace} from './regions.js';
import {REGIMES} from './regime-rules.js';
import {getCountryContext} from './countries.js';
import {geographyUnits,getGeographyUnit,resolveTerritoryTargets,geographyAncestors} from './geography.js';
import {openingAdministration,territorialPatchFor,controllerContext} from './local-control.js';
import {openingFactions} from './opening-control.js';
import {simulatedBattleOpponent,openingFragmentedCountryIds} from './territory-simulation.js';
export {geographyUnits,geographySources,getGeographyUnit,resolveTerritoryTargets,searchGeographyUnits,geographyAncestors} from './geography.js';

const PLACES={china:'中国大陆',taiwan:'中国台湾',japan:'日本',korea:'韩国',hongkong:'香港',macau:'澳门'};
const COUNTRY_REGIONS={CHN:'china',TWN:'taiwan',JPN:'japan',KOR:'korea',HKG:'hongkong',MAC:'macau'};
const UNIT_INDEX=new Map(geographyUnits.map(row=>[row.id,row]));
const REGION_COUNTRIES=new Map(geographyUnits.filter(unit=>unit.role==='country').map(unit=>[unit.region,unit.country]));

function eventSet(state){return new Set([...(state.seenEvents||[]),...(state.seenNews||[]),...(state.newsHistory||[]).filter(e=>e.month<=state.month).map(e=>e.id),...(state.current?.majorId?[state.current.majorId]:[])]);}
function knownContext(state,region,lore){
  if(PLACES[region])return regionContext({...state,location:PLACES[region],position:undefined},lore);
  return {...getCountryContext(state,REGION_COUNTRIES.get(region)),region};
}
function currentWar(state,region,context,seen){
  const terminated=state.worldDynamics?.terminatedConflicts||[];
  if(state.worldDynamics?.lastingPeace||terminated.includes(region))return null;
  if(Object.hasOwn(state.worldOverrides?.[region]||{},'conflict'))return state.worldOverrides[region].conflict;
  if(context.conflict||context.regionalConflict)return context.conflict||context.regionalConflict;
  if(['china','taiwan'].includes(region)&&seen.has('world_strait_war')&&!seen.has('world_strait_end')&&!terminated.includes('strait'))return '台海战争';
  if(region==='usa'&&seen.has('world_usa_civil_war')&&!terminated.includes('usa'))return '美国内战';
  return null;
}
function baselineController(unit,context){
  if(['country','province'].includes(unit.role)&&context.conflict&&/内战|争夺/.test(context.conflict)&&!/接管|重建|postwar|reconstruction/.test(context.stage||''))return {controller:'多方分别管治',controllerId:`contested:${unit.region}`,uncertain:true};
  return {controller:context.leader||context.government||UNIT_INDEX.get('country:'+unit.country)?.name||unit.name,controllerId:context.factionId||unit.region,uncertain:false};
}
function overrideFor(state,unit){
  return territorialPatchFor(state,unit);
}
function canonicalOwnerId(id,tag,context){
  const sameFaction=id===context?.region||id===tag||id===`faction:${tag}`;
  return tag&&!REGIMES[id]&&(sameFaction||!context?.playerChanged&&context?.currentSource==='mod-opening')?`faction:${tag}`:id;
}
export function createTerritoryContext(state,lore){
  const seen=eventSet(state),contexts={};
  for(const region of REGION_COUNTRIES.keys())contexts[region]=knownContext(state,region,lore);
  const factionWars={};
  for(const [region,context] of Object.entries(contexts)){const conflict=currentWar(state,region,context,seen);factionWars[region]=conflict;if(context.factionId)factionWars[context.factionId]=conflict;}
  if(state.month>=0)for(const faction of openingFactions){
    const current=faction.primary?Object.values(contexts).find(row=>row.tag===faction.tag):null;
    const actual=current||controllerContext(state,faction.id);
    factionWars[faction.id]=actual?currentWar(state,actual.region,actual,seen):null;
  }
  for(const [id,conflict] of Object.entries(state.factionConflicts||{}))factionWars[id]=typeof conflict==='string'?conflict:conflict?.conflict??null;
  return {seen,contexts,factionWars};
}
/** Cheap layer-loading hint; this does not project or load all county polygons. */
export function fragmentedCountryIds(state,prepared){
  const result=new Set(Number(state.month)<0?[]:openingFragmentedCountryIds);
  const contextFor=region=>prepared?.contexts?.[region]||knownContext(state,region);
  for(const iso of [...result]){
    const unit=UNIT_INDEX.get('country:'+iso),context=unit?contextFor(unit.region):null;
    const whole=unit?overrideFor(state,unit):null;
    if(whole?.controller||whole?.controllerId||context?.knownChanges?.length&&!['civil_war','fragmentation'].includes(context.stage)||context?.playerChanged&&!['civil_war','fragmentation'].includes(context.stage))result.delete(iso);
  }
  for(const [region,iso] of REGION_COUNTRIES){
    const explicit=state.worldOverrides?.[region],context=prepared?.contexts?.[region];
    if(['civil_war','fragmentation'].includes((context||explicit)?.stage)||/内战|civil\s*war/i.test((context||explicit)?.conflict||''))result.add(iso);
  }
  const seen=prepared?.seen||eventSet(state);
  for(const [region,iso,events] of [['taiwan','TWN',['tw_four_factions','tw_civil_war']],['japan','JPN',['world_japan_civil','jp_hazawa_toyokawa_war']],['china','CHN',['cn_collapse_civil','cn_longmarch_coup','cn_longmarch_civil','cn_total_civil_war']],['usa','USA',['world_usa_civil_war']]]){
    if(!events.some(id=>seen.has(id)))continue;
    const context=contextFor(region);if(['civil_war','fragmentation'].includes(context.stage))result.add(iso);
  }
  for(const [id,patch] of Object.entries(state.territoryOverrides||{})){
    const unit=UNIT_INDEX.get(id);
    if(unit&&unit.role!=='country'&&(patch.controller||patch.controllerId||patch.frontline)&&(!Number.isFinite(patch.month)||patch.month<=(Number(state.month)||0)))result.add(unit.country);
  }
  return result;
}
/** Read-only projection. Territory overrides never become history merely by
 * looking at the map, and ended conflicts cannot be revived by stale overlays. */
export function deriveTerritorySituation(state,feature,lore,prepared){
  const unit=typeof feature==='string'?UNIT_INDEX.get(feature):feature;
  if(!unit)return null;
  const context=prepared?.contexts?.[unit.region]||knownContext(state,unit.region,lore);
  const seen=prepared?.seen||eventSet(state),opening=openingAdministration(state,unit,context),base=opening||baselineController(unit,context),patch=overrideFor(state,unit);
  const explicitControl=Boolean(patch.controller||patch.controllerId||patch.ownerId||patch.ownerName);
  let controller=patch.controller||patch.ownerName||base.controller;
  let controllerId=patch.controllerId||patch.ownerId||(patch.controller?patch.controller:base.controllerId),resolvedController=null;
  let flagContext={...context,...opening?.info,controllerTag:opening?.controllerTag||null},government=opening?opening.government:context.government||null,ideology=opening?opening.ideology:context.ideology||null;
  if(explicitControl){
    const controllerRegion=REGION_COUNTRIES.has(controllerId)?controllerId:Object.keys(state.worldOverrides||{}).find(key=>state.worldOverrides[key]?.factionId===controllerId);
    const allContexts=prepared?.contexts;
    const controlling=allContexts?(allContexts[controllerId]||Object.values(allContexts).find(row=>row.factionId===controllerId)):(controllerRegion?knownContext(state,controllerRegion,lore):null);
    const currentController=controlling||controllerContext(state,controllerId);
    resolvedController=currentController;
    if(!patch.controller&&!patch.ownerName&&currentController)controller=currentController.name||currentController.leader||controllerId;
    if(currentController?.controllerId)controllerId=currentController.controllerId;
    const regime=REGIMES[controllerId];
    if(currentController){government=currentController.government||null;ideology=currentController.ideology||regime?.ideology||null;flagContext={...currentController,controllerTag:currentController.tag||null};}
    else if(regime){government=`${controller}实际管治，地方制度安排尚待确认`;ideology=regime.ideology;}
    else {government=`${controller}实际管治，地方制度安排尚待确认`;ideology=null;}
    if(!currentController)flagContext={iso:unit.country,region:unit.region,factionId:controllerId,name:controller,createdByPlayer:patch.source==='personal_action'};
  }
  let conflict=opening?opening.conflict:currentWar(state,unit.region,context,seen);
  if(Object.hasOwn(patch,'conflict'))conflict=patch.conflict;
  // A monthly personal update needs only the controlling faction. Building all
  // country dossiers is reserved for the map's shared rendering context.
  let factionWars=prepared?.factionWars;
  if(!factionWars){
    const controllerRegion=REGION_COUNTRIES.has(controllerId)?controllerId:Object.keys(state.worldOverrides||{}).find(key=>state.worldOverrides[key]?.factionId===controllerId);
    const factionContext=resolvedController||(controllerRegion?knownContext(state,controllerRegion,lore):controllerContext(state,controllerId))||(controllerId===base.controllerId?context:null);
    factionWars={};
    if(factionContext)factionWars[controllerId]=currentWar(state,factionContext.region||controllerRegion||unit.region,factionContext,seen);
    for(const [id,value] of Object.entries(state.factionConflicts||{}))factionWars[id]=typeof value==='string'?value:value?.conflict??null;
  }
  if(Object.hasOwn(factionWars,controllerId)&&factionWars[controllerId]&&(!conflict||!/开局武装冲突/.test(factionWars[controllerId])))conflict=factionWars[controllerId];
  if(Object.hasOwn(state.factionConflicts||{},controllerId)&&state.factionConflicts[controllerId]===null)conflict=null;
  const controlTag=flagContext.controllerTag||flagContext.tag;
  if(controlTag&&(state.factionConflicts?.[`faction:${controlTag}`]===null||state.worldOverrides?.[`faction:${controlTag}`]?.conflict===null))conflict=null;
  if(Object.hasOwn(state.worldOverrides?.[unit.region]||{},'conflict')&&state.worldOverrides[unit.region].conflict===null)conflict=null;
  if(Object.hasOwn(patch,'conflict')&&patch.conflict===null)conflict=null;
  if(state.worldDynamics?.terminatedConflicts?.includes(unit.region))conflict=null;
  if(state.worldDynamics?.lastingPeace)conflict=null;
  if(typeof conflict==='string')conflict=conflict.replace(/开局武装冲突/g,'武装冲突');
  const war=Boolean(conflict),controllerTag=flagContext.controllerTag||flagContext.tag||patch.ownerTag||null;
  const ownerId=canonicalOwnerId(controllerId,controllerTag,flagContext),ownerTag=controllerTag,ownerName=patch.ownerName||patch.controller||(explicitControl?resolvedController?.name:opening?.name)||controller;
  let opponent=null;
  const declaredAttacker=patch.attackerId||patch.attackerTag||patch.attackerName;
  if(war&&patch.frontline!==false&&declaredAttacker){
    const actual=controllerContext(state,declaredAttacker);
    const tag=patch.attackerTag||actual?.tag||actual?.controllerTag||null;
    opponent={id:canonicalOwnerId(actual?.factionId||actual?.controllerId||declaredAttacker,tag,actual),name:patch.attackerName||actual?.name||declaredAttacker,tag};
  }else if(war&&patch.frontline!==false&&(!explicitControl||patch.frontline===true)){
    opponent=simulatedBattleOpponent(state,unit,opening,{ownerId,ownerTag,war,explicitFrontline:patch.frontline===true});
  }
  if(opponent&&(opponent.id===ownerId||opponent.tag&&opponent.tag===ownerTag&&String(opponent.id).startsWith('faction:')&&String(ownerId).startsWith('faction:')))opponent=null;
  const frontline=war&&(patch.frontline===true||!!opponent),uncertain=!explicitControl&&!!base.uncertain;
  const simulation=!explicitControl&&opening?.simulation?{...opening.simulation}:null;
  return {unitId:unit.id,name:unit.name,region:unit.region,country:unit.country,controller,controllerId,controllerTag,ownerId,ownerName,ownerTag,attackerId:frontline?opponent?.id||null:null,attackerName:frontline?opponent?.name||null:null,attackerTag:frontline?opponent?.tag||null:null,flagContext:{...flagContext,government,ideology,factionId:controllerId,name:controller,createdByPlayer:Boolean(flagContext.createdByPlayer||!resolvedController&&context.playerChanged&&!REGIMES[controllerId]&&controllerId!==unit.region)},uncertain,mixedControllers:uncertain?opening?.mixedControllers||[]:[],simulation,conflict:conflict||null,war,frontline,severity:war?(frontline?1:0.45):0,government,ideology,month:patch.month??state.month,source:patch.source||opening?.mapping||null,description:frontline?'当地正在交战，通行、供给与安全受到直接影响。':war?'所属势力正在参战，动员、运输与物价波动影响日常；当地没有正在交战的报告。':'目前没有当地正在交战的消息。'};
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
  const fixed={china:'#bc7261',taiwan:'#70a285',japan:'#7f95b9',korea:'#ad93b4',hongkong:'#b49d62',macau:'#92a47c',AFG:'#598bb6',TAL:'#b6864b',SYR:'#b56a64',ROJ:'#d1b14b',HTS:'#5e9b78',FSA:'#9373b4',YEM:'#5793b5',HOU:'#b56a74',AAS:'#b89545',USA:'#b66b65',USB:'#5d8db7',taiwan_left:'#bc665f',taiwan_dpp:'#66a385',taiwan_kmt:'#5b8bbd',taiwan_revanchist:'#bc9650',japan_left:'#bd675e',japan_toyokawa:'#6586b2'};
  const raw=String(id||''),key=raw.replace(/^faction:/,'');
  const aliases={afg:'AFG',syr:'SYR',yem:'YEM',SDF:'ROJ'};
  if(fixed[aliases[key]||key])return fixed[aliases[key]||key];if(raw.startsWith('contested:'))return '#a59f93';
  let hash=0;for(const c of String(id))hash=(Math.imul(hash,31)+c.charCodeAt(0))|0;
  return `hsl(${Math.abs(hash)%360} 30% 63%)`;
}
