import {openingControlForUnit,openingFactions} from './opening-control.js';
import {countryByTag,getCountryContext,getFactionContext,resolveCountry} from './countries.js';
import {geographyAncestors} from './geography.js';
import {simulateOpeningControl,simulateCivilWarControl,simulatedCivilActor} from './territory-simulation.js';

const factions=new Map(openingFactions.map(row=>[row.tag,row]));
const factionAliases=new Map();
const aliasKey=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s·・（）()]/g,'');
for(const row of openingFactions)for(const name of [row.name,row.catalogName]){
  if(!name)continue;const key=aliasKey(name),old=factionAliases.get(key);
  factionAliases.set(key,factionAliases.has(key)&&old!==row.tag?null:row.tag);
}
const baselineCountries=new Map(),tagRecords=new Map();
function baseCountry(iso){if(!baselineCountries.has(iso))baselineCountries.set(iso,getCountryContext({},iso));return baselineCountries.get(iso);}
function tagRecord(tag){if(!tagRecords.has(tag))tagRecords.set(tag,countryByTag(tag));return tagRecords.get(tag);}
export function territorialPatchFor(state,unit){
  const store=state.territoryOverrides||{};
  const current=row=>row&&(!Number.isFinite(row.month)||row.month<=(Number(state.month)||0))?row:null;
  const rows=[store[`country:${unit.country}`],store[`region:${unit.region}`],unit.parent?store[`province:${unit.parent}`]:null,...geographyAncestors(unit).slice(1).reverse().filter(row=>row.role!=='country').map(row=>store[row.id]),store[unit.id]].map(current).filter(Boolean);
  // A whole-province/country intervention also governs its counties. Monthly
  // war progress cannot silently override it just by using a more specific ID.
  return Object.assign({},...rows.filter(row=>row.source==='war_dynamics'),...rows.filter(row=>row.source!=='war_dynamics'));
}
/** A known later national transition replaces its opening baseline. A local
 * takeover is applied separately and always wins over these opening facts. */
export function openingAdministration(state,unit,context={}){
  if(!unit||Number(state.month)<0||state.profile?.scenario?.id==='mao-april'&&['china','taiwan'].includes(unit.region))return null;
  const recorded=territorialPatchFor(state,unit);
  if(recorded.source==='war_dynamics'&&recorded.controllerId){
    const info=controllerContext(state,recorded.controllerId)||{};
    return {controller:recorded.controller||info.name,controllerId:recorded.controllerId,controllerTag:recorded.ownerTag||info.tag,tag:recorded.ownerTag||info.tag,factionId:recorded.controllerId,name:recorded.controller||info.name,country:unit.country,geographicCountry:unit.country,leader:info.leader||null,government:info.government||null,ideology:info.ideology||null,conflict:recorded.conflict,frontline:recorded.frontline,uncertain:false,mixedControllers:[],mapping:'monthly-war-control',info};
  }
  const civil=simulateCivilWarControl(state,unit,context);
  if(civil){
    if(Object.hasOwn(state.factionConflicts||{},civil.controllerId))civil.conflict=state.factionConflicts[civil.controllerId];
    if(state.worldOverrides?.[unit.region]?.conflict===null||state.worldDynamics?.lastingPeace||state.worldDynamics?.terminatedConflicts?.includes(unit.region))civil.conflict=null;
    return civil;
  }
  if(context.knownChanges?.length)return null;
  const declared=state.worldOverrides?.[unit.region];
  if(declared?.factionId&&declared.factionId!==context.baseline?.factionId&&declared.factionId!==baseCountry(unit.country)?.factionId)return null;
  const control=simulateOpeningControl(state,unit,openingControlForUnit(unit,{month:state.month||0}));if(!control)return null;
  // The opening map is still useful for an existing fragmented country, but a
  // newly declared civil war cannot certify the old government's full control.
  if(context.conflict&&/内战|争夺|civil\s*war/i.test(context.conflict)&&(['civil_war','fragmentation'].includes(context.stage)||!control.conflict&&!baseCountry(unit.country)?.conflict))return null;
  const tag=control.controllerTag||control.tag;
  const baseline=tag?tagRecord(tag):null;
  const country=control.country===unit.country&&context.tag?context:control.country?getCountryContext(state,control.country):null;
  const info=tag&&country?.tag===tag?country:{...baseline,...factions.get(tag),...control};
  const countryTag=baseCountry(unit.country)?.tag;
  const ownGovernment=tag&&tag===countryTag;
  const controllerId=control.uncertain?control.factionId:ownGovernment?context.factionId||country?.factionId||control.factionId:country?.tag===tag?country.factionId:control.factionId;
  const patch=state.worldOverrides?.[control.factionId];
  const current={...info,...patch};
  let conflict=control.conflict||current.conflict||null;
  if(Object.hasOwn(declared||{},'conflict'))conflict=declared.conflict;
  const controllingDeclaration=state.worldOverrides?.[country?.region];
  if(Object.hasOwn(controllingDeclaration||{},'conflict'))conflict=controllingDeclaration.conflict;
  if(Object.hasOwn(patch||{},'conflict'))conflict=patch.conflict;
  if(Object.hasOwn(state.factionConflicts||{},controllerId))conflict=state.factionConflicts[controllerId];
  if(Object.hasOwn(state.factionConflicts||{},control.factionId))conflict=state.factionConflicts[control.factionId];
  if(state.worldDynamics?.lastingPeace||state.worldDynamics?.terminatedConflicts?.includes(unit.region))conflict=null;
  return {...control,controllerId,controller:control.uncertain?control.name:ownGovernment?context.leader||context.government||control.name:current.name||control.name,
    leader:ownGovernment?context.leader||current.leader:current.leader||null,
    government:control.uncertain?'当地由多个势力分别管治':ownGovernment?context.government||current.government:current.government,
    ideology:control.uncertain?null:ownGovernment?context.ideology||current.ideology:current.ideology,
    conflict,info:current};
}
export function controllerContext(state,id){
  const value=String(id||''),explicit=value.match(/^faction:([A-Z0-9]{3})$/)?.[1];
  const civil=simulatedCivilActor(value);
  if(civil){
    const region=civil.region,declared=state.worldOverrides?.[value];
    const patch=declared&&(!Number.isFinite(declared.month)||declared.month<=(Number(state.month)||0))?declared:null;
    const result={...civil,...patch,controllerId:value,controllerTag:civil.tag,factionId:value,region};
    if(Object.hasOwn(state.factionConflicts||{},value))result.conflict=state.factionConflicts[value];
    if(state.worldOverrides?.[region]?.conflict===null||state.worldDynamics?.lastingPeace||state.worldDynamics?.terminatedConflicts?.includes(region))result.conflict=null;
    return result;
  }
  // Some current regional administrations have no standalone country TAG.
  // Their campaign dossier supplies the same local authority to prose and map.
  for(const campaign of Object.values(state.warDynamics?.campaigns||{})){
    const actor=campaign?.actors?.find?.(row=>row.id===value);if(!actor||explicit)continue;
    const declared=state.worldOverrides?.[value];
    return {...actor,...declared,region:actor.region||campaign.region,controllerId:value,factionId:value,controllerTag:actor.tag,conflict:campaign.status==='active'?campaign.name:null,currentSource:'monthly-war-control'};
  }
  if(!explicit){const country=resolveCountry(value);if(country)return getCountryContext(state,country.iso);}
  const tag=explicit||factionAliases.get(aliasKey(value))||(/^[A-Z0-9]{3}$/.test(value)&&tagRecord(value)?value:null);
  if(!tag)return null;
  const current=getFactionContext(state,tag);if(!current)return null;
  const faction=factions.get(tag),controllerId=`faction:${tag}`;
  const declared=state.worldOverrides?.[controllerId],patch=declared&&(!Number.isFinite(declared.month)||declared.month<=(Number(state.month)||0))?declared:null;
  const result={...faction,...current,...patch,controllerId,controllerTag:tag};
  if(faction&&current.currentSource==='mod-opening')result.conflict=faction.conflict||null;
  if(Object.hasOwn(patch||{},'conflict'))result.conflict=patch.conflict;
  const national=state.worldOverrides?.[current.region];
  if(Object.hasOwn(national||{},'conflict')&&national.conflict===null)result.conflict=null;
  if(Object.hasOwn(state.factionConflicts||{},controllerId))result.conflict=state.factionConflicts[controllerId];
  if(state.worldDynamics?.lastingPeace||state.worldDynamics?.terminatedConflicts?.includes(current.region))result.conflict=null;
  return result;
}
