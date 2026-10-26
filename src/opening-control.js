import opening from './data/opening-control.json' with {type:'json'};
import catalog from './data/countries.json' with {type:'json'};
import {geographyUnits,getGeographyUnit,geographyAncestors} from './geography.js';

const LOCAL_NAMES={HOU:'也门胡塞运动',YEM:'也门共和国政府',SYR:'叙利亚政府',AFG:'阿富汗共和国政府',TAL:'塔利班',LBA:'利比亚民族团结政府',HRL:'利比亚国民军'};
const WAR_NAMES={AFG:'阿富汗战争',YEM:'也门内战',LBY:'利比亚内战',SOM:'索马里内战',CAF:'中非内战',UKR:'顿巴斯战事'};
const UNITS=new Map(geographyUnits.map(unit=>[unit.id,unit]));
const COUNTRY_UNITS=new Map();
for(const unit of geographyUnits){const rows=COUNTRY_UNITS.get(unit.country)||[];rows.push(unit);COUNTRY_UNITS.set(unit.country,rows);}

function rawName(tag){return LOCAL_NAMES[tag]||catalog.tags[tag]?.name||tag;}
function countryForFaction(row){
  if(row.primary)return row.country;
  const countries=new Set([...row.controlledUnitIds,...row.possibleUnitIds].map(id=>UNITS.get(id)?.country).filter(Boolean));
  return countries.size===1?[...countries][0]:row.country;
}
function conflictFor(row){
  if(!row.opponents.length)return null;
  const country=countryForFaction(row),label=WAR_NAMES[country];
  return label||`${rawName(row.tag)}与${row.opponents.map(rawName).join('、')}交战`;
}

/** Immutable 2020 opening facts. Runtime territory/world overrides must be
 * applied by the caller; this module does not mutate history or save state. */
export const openingFactions=opening.factions.map(row=>{
  const dossier=catalog.tags[row.tag]||{},country=countryForFaction(row);
  const ordinary=(COUNTRY_UNITS.get(country)||[]).filter(unit=>!opening.unitControls[unit.id]&&opening.defaultControllers[country]===row.tag).map(unit=>unit.id);
  return Object.freeze({...row,controlledUnitIds:Object.freeze([...row.controlledUnitIds,...ordinary]),possibleUnitIds:Object.freeze([...row.possibleUnitIds]),
    name:rawName(row.tag),catalogName:dossier.name||row.name,country,originCountry:row.country,
    leader:dossier.leader||null,government:dossier.government||null,ideology:dossier.ideology||null,
    ideologyId:dossier.ideologyId||null,ideologyGroup:dossier.ideologyGroup||null,cosmeticTag:dossier.cosmeticTag||null,
    conflict:conflictFor(row),sourceRefs:dossier.sourceRefs||[]});
});
const FACTIONS=new Map(openingFactions.flatMap(row=>[[row.tag,row],[row.id,row]]));
export const openingControlMetadata=Object.freeze({openingDate:opening.openingDate,counts:opening.counts,limitations:opening.limitations});
export function getOpeningFaction(tagOrId){return FACTIONS.get(tagOrId)||null;}

/** Includes externally controlled territory (e.g. Crimea under SOV) without
 * changing the atlas's geographical identity or asserting a sovereignty claim. */
export function openingFactionsForCountry(iso){
  const tags=new Set([opening.defaultControllers[iso]]);
  for(const faction of openingFactions)if(faction.country===iso)tags.add(faction.tag);
  for(const unit of COUNTRY_UNITS.get(iso)||[]){
    const row=opening.unitControls[unit.id];
    for(const part of row?.controllers||[])tags.add(part.tag);
  }
  return [...tags].filter(Boolean).map(tag=>FACTIONS.get(tag)).filter(Boolean);
}

function sourceRefs(row){
  return (row?.stateIds||[]).flatMap(id=>opening.stateEvidence[id]?.sourceRefs||[]);
}
function mixedRowForCountry(unit){
  const factions=openingFactionsForCountry(unit.country);
  if(factions.length<=1)return null;
  return {tag:null,dominantTag:opening.defaultControllers[unit.country],uncertain:true,
    controllers:factions.map(f=>({tag:f.tag,share:null})),mapping:'country-control-summary',stateIds:[]};
}

/**
 * Returns a control baseline, not current politics. A mixed county has no
 * exclusive tag; seatTag identifies only its named administrative seat.
 * Negative calendar months must not inherit a future 2020 control map.
 */
export function openingControlForUnit(value,{month=0,scenario='standard'}={}){
  if(Number(month)<0)return null;
  const unit=typeof value==='string'?getGeographyUnit(value):value;
  if(!unit?.id)return null;
  const row=opening.unitControls[unit.id]||(unit.role==='country'?mixedRowForCountry(unit):null);
  const tag=row?row.tag:opening.defaultControllers[unit.country];
  const faction=FACTIONS.get(tag);
  if(!faction&&!row)return null;
  const mixed=(row?.controllers||[]).map(part=>{
    const f=FACTIONS.get(part.tag);
    return {tag:part.tag,id:'faction:'+part.tag,name:f?.name||rawName(part.tag),share:part.share,conflict:f?.conflict||null};
  });
  const conflicts=[...new Set((faction?[faction.conflict]:mixed.map(p=>p.conflict)).filter(Boolean))];
  const uncertain=Boolean(row?.uncertain||!tag);
  return {unitId:unit.id,tag:tag||null,controllerTag:tag||null,factionId:tag?'faction:'+tag:'contested:'+unit.id,
    name:faction?.name||(mixed.length>1?`多方控制：${mixed.map(p=>p.name).join('、')}`:`管治范围待确认：${mixed[0]?.name||unit.name}`),
    country:faction?.country||unit.country,geographicCountry:unit.country,
    government:faction?.government||null,ideology:faction?.ideology||null,
    ideologyId:faction?.ideologyId||null,ideologyGroup:faction?.ideologyGroup||null,
    leader:faction?.leader||null,cosmeticTag:faction?.cosmeticTag||null,
    conflict:conflicts.join('；')||null,frontline:false,uncertain,
    mixedControllers:mixed,dominantTag:row?.dominantTag||tag||null,
    seatTag:row?.seatTag||null,seatName:row?.seatName||null,
    mapping:row?.mapping||'country-opening-control',sourceRefs:row?sourceRefs(row):faction?.sourceRefs||[],
    scenario,openingDate:opening.openingDate};
}

/** All administrative ancestors needed to display a faction's actual footprint
 * in a cascading selector. Uncertain counties are explicitly labeled possible. */
export function openingFactionUnits(tagOrId,{includePossible=true}={}){
  const faction=getOpeningFaction(tagOrId);if(!faction)return [];
  const ids=new Set([...faction.controlledUnitIds,...(includePossible?faction.possibleUnitIds:[])]);
  const result=new Map();
  for(const id of ids){const unit=UNITS.get(id);if(!unit)continue;result.set(id,unit);for(const ancestor of geographyAncestors(unit))result.set(ancestor.id,ancestor);}
  return [...result.values()];
}
