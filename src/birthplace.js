import {geographyUnits,geographyAncestors,getGeographyUnit,resolveTerritoryTargets} from './geography.js';
import {resolveCountry,getCountryContext} from './countries.js';
import {openingControlForUnit,openingFactions} from './opening-control.js';

export const LOCATION_LEVELS=Object.freeze([{key:'provinceId',role:'province',label:'省份 / 一级行政区'},{key:'cityId',role:'city',label:'城市 / 当地对应单位'},{key:'countyId',role:'county',label:'区划 / 县'}]);
export const DIRECT_LEVEL='__direct__';
const MACRO={CHN:'中国大陆',TWN:'中国台湾',JPN:'日本',KOR:'韩国',HKG:'香港',MAC:'澳门'};
const compare=(a,b)=>a.name.localeCompare(b.name,'zh-Hans-CN');
const countryUnits=geographyUnits.filter(unit=>unit.role==='country');
let catalog;

/** The selector follows real parent chains. Missing levels are navigation
 * gaps, not invented provinces/cities. The catalog is built once per opening. */
function buildCatalog(){
  if(catalog)return catalog;
  const countries=new Map(countryUnits.map(unit=>[unit.country,{id:unit.id,name:unit.name,country:unit.country,unitId:unit.id,tag:getCountryContext({},unit.country)?.tag||null}]));
  const byTag=new Map([...countries.values()].filter(row=>row.tag).map(row=>[row.tag,row]));
  const factions=new Map(openingFactions.map(row=>[row.tag,row]));
  const authorities=new Map(),paths=new Map();
  const parents=new Set(geographyUnits.map(unit=>unit.parentId).filter(Boolean));
  function authorityForTag(tag,unit){const primary=byTag.get(tag),faction=factions.get(tag);return primary||faction&&{id:faction.id||`faction:${tag}`,name:faction.name,country:faction.country||unit.country,tag,unitId:null,conflict:faction.conflict};}
  for(const unit of geographyUnits){
    if(parents.has(unit.id))continue;
    const control=openingControlForUnit(unit);
    const tag=control&&!control.uncertain?(control.controllerTag||control.tag):null;
    let choices=tag?[authorityForTag(tag,unit)]:(control?.mixedControllers||[]).map(row=>authorityForTag(row.tag,unit));choices=choices.filter(Boolean);
    if(!choices.length)choices=[countries.get(unit.country)].filter(Boolean);
    const ancestors=geographyAncestors(unit);
    for(const authority of new Map(choices.map(row=>[row.id,row])).values()){
      authorities.set(authority.id,authority);
      const path={unitId:unit.id,authorityId:authority.id,country:unit.country,partial:!!control?.uncertain};
      for(const level of LOCATION_LEVELS)path[level.key]=ancestors.find(row=>row.role===level.role)?.id||DIRECT_LEVEL;
      const rows=paths.get(authority.id)||[];rows.push(path);paths.set(authority.id,rows);
    }
  }
  catalog={authorities:[...authorities.values()].sort(compare),paths};return catalog;
}
export function birthplaceAuthorities(){return buildCatalog().authorities;}
export function birthplaceOptions(selection={}){
  const db=buildCatalog(),authority=db.authorities.find(row=>row.id===selection.authorityId);
  let rows=db.paths.get(authority?.id)||[];const levels=[];
  for(const level of LOCATION_LEVELS){
    const ids=[...new Set(rows.map(row=>row[level.key]))];
    const hasUnits=ids.some(id=>id!==DIRECT_LEVEL);
    const options=hasUnits?ids.map(id=>id===DIRECT_LEVEL?{id,name:'无对应上级记录，直接选择下一级'}:{id,name:getGeographyUnit(id)?.name||id}).sort(compare):[];
    const selected=hasUnits?selection[level.key]||'':DIRECT_LEVEL;
    const valid=!hasUnits||options.some(row=>row.id===selected);
    levels.push({...level,options,selected,disabled:!hasUnits,reason:hasUnits?'':'当地无此层级或没有相应区划资料。'});
    rows=valid?rows.filter(row=>row[level.key]===selected):[];
  }
  return {authority,levels,complete:!!authority&&rows.length===1,unit:rows.length===1?getGeographyUnit(rows[0].unitId):null,partial:rows.length===1&&rows[0].partial};
}
export function birthplaceSelectionForUnit(value,authorityId){
  const unit=typeof value==='string'?getGeographyUnit(value):value;
  if(!unit)return {authorityId:'country:CHN',provinceId:'province:上海'};
  const db=buildCatalog();
  for(const [candidateId,rows]of db.paths){
    if(authorityId&&candidateId!==authorityId)continue;
    const path=rows.find(row=>row.unitId===unit.id);
    if(path)return {...path,authorityId:candidateId};
  }
  const chain=geographyAncestors(unit),country=chain.find(row=>row.role==='country');
  return {authorityId:country?.id||`country:${unit.country}`,...Object.fromEntries(LOCATION_LEVELS.map(level=>[level.key,chain.find(row=>row.role===level.role)?.id||'']))};
}
export function birthplaceUnitForPlace(place){
  const direct=getGeographyUnit(place);if(direct)return direct;
  const legacyProvince=getGeographyUnit(`province:${place}`);if(legacyProvince)return legacyProvince;
  const units=resolveTerritoryTargets(place);return units.length===1?units[0]:null;
}
export function macroPlaceForUnit(unit){
  if(unit.country==='CHN')return geographyAncestors(unit).find(row=>row.role==='province')?.name||'中国大陆';
  return MACRO[unit.country]||getGeographyUnit(`country:${unit.country}`)?.name||unit.name;
}
export function birthplaceLabel(unit){return geographyAncestors(unit).slice().reverse().map(row=>row.name).filter((name,index,list)=>list.indexOf(name)===index).join(' · ');}
export function defaultNationality(unit,place,authorityId){
  const control=unit?openingControlForUnit(unit):null;
  const selected=authorityId?birthplaceAuthorities().find(row=>row.id===authorityId):null;
  const iso=selected?.country||(control&&!control.uncertain&&control.country?control.country:unit?.country||resolveCountry(place)?.iso);
  if(['CHN','HKG','MAC'].includes(iso))return '中国（中华人民共和国）';
  if(iso==='TWN')return '中国台湾（中华民国籍）';
  return getGeographyUnit(`country:${iso}`)?.name||resolveCountry(place)?.name||'';
}
export function normalizeBirthplace(input,{allowLegacy=true}={}){
  if(input.birthplaceId){const unit=getGeographyUnit(input.birthplaceId);if(!unit)throw new Error('所选地区已无法识别，请重新选择。');if(input.openingAuthorityId&&!(buildCatalog().paths.get(input.openingAuthorityId)||[]).some(path=>path.unitId===unit.id))throw new Error('所选地区不属于这一开局控制范围。');return {unit,place:macroPlaceForUnit(unit),label:birthplaceLabel(unit)};}
  const unit=allowLegacy?birthplaceUnitForPlace(input.place):null;
  if(!unit)throw new Error('请选择开局所在地区。');
  return {unit,place:macroPlaceForUnit(unit),label:birthplaceLabel(unit)};
}
