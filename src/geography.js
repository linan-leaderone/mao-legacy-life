import atlas from './data/world-geography-index.json' with {type:'json'};
import * as OpenCC from 'opencc-js';

const simplify=OpenCC.Converter({from:'tw',to:'cn'});
const clean=value=>simplify(String(value||'')).toLowerCase().replace(/[\s·・,，。]/g,'');
const COUNTRY_REGIONS={CHN:'china',TWN:'taiwan',JPN:'japan',KOR:'korea',HKG:'hongkong',MAC:'macau'};
const COUNTRY_ALIASES={CHN:['中国大陆','大陆','中国','China'],TWN:['中国台湾','台湾','台灣'],JPN:['日本'],KOR:['韩国','韓國'],HKG:['香港'],MAC:['澳门','澳門'],USA:['美国','USA','United States'],PRK:['朝鲜'],RUS:['俄罗斯'],IND:['印度']};
const SOURCES=new Map(atlas.sources.map(row=>[row.id,row]));
export const geographyUnits=atlas.units.map(row=>({id:row.id,name:row.n,aliases:row.a||[],country:row.c,region:row.r,level:row.l,parent:row.p||'',parentId:row.pi||null,role:row.h||(row.id.startsWith('country:')?'country':row.id.startsWith('province:')?'province':'county'),continent:row.ct||null,subregion:row.sr||null,layer:row.f||(row.l==='world'?'world':'asia'),center:row.z,bounds:row.b,source:SOURCES.get(row.l)}));
const UNIT_INDEX=new Map(geographyUnits.map(row=>[row.id,row]));
const NAME_INDEX=new Map();
for(const unit of geographyUnits){
  const names=[unit.name,...unit.aliases,...(unit.id.startsWith('country:')?COUNTRY_ALIASES[unit.country]||[]:[])];
  for(const name of names){const key=clean(name);if(key.length<2)continue;const rows=NAME_INDEX.get(key)||[];if(!rows.includes(unit))rows.push(unit);NAME_INDEX.set(key,rows);}
}
export const geographySources=atlas.sources;
export const getGeographyUnit=id=>UNIT_INDEX.get(id)||null;

/** Most specific unit first; old saves still recognize their original IDs. */
export function geographyAncestors(value){
  let unit=typeof value==='string'?UNIT_INDEX.get(value):value;const result=[],seen=new Set();
  while(unit&&!seen.has(unit.id)){
    result.push(unit);seen.add(unit.id);
    unit=UNIT_INDEX.get(unit.parentId)||(!unit.id.startsWith('province:')&&UNIT_INDEX.get('province:'+unit.parent))||(unit.role!=='country'?UNIT_INDEX.get('country:'+unit.country):null);
  }
  return result;
}

// Index names by prefix: an action scans its own text, not every county on Earth.
const PREFIX_INDEX=new Map();
for(const name of NAME_INDEX.keys()){const prefix=name.slice(0,2),items=PREFIX_INDEX.get(prefix)||[];items.push(name);PREFIX_INDEX.set(prefix,items);}
const COMMON_WORDS=new Set('of in at to an on as by or and the is it be do no can will you we me he she they go so may not for from with have has had are was were this that'.split(' '));
function matchingNames(value,raw,{allowCommon=false}={}){
  const matches=new Set();for(let i=0;i<value.length-1;i++)for(const name of PREFIX_INDEX.get(value.slice(i,i+2))||[]){
    if(!value.startsWith(name,i))continue;
    if(COMMON_WORDS.has(name)&&!(allowCommon&&value===name))continue;
    // Avoid treating Peru inside Perugia, Oman inside Romania, etc. as visits.
    if(/^[a-z]+$/.test(name)&&!new RegExp('(?:^|[^a-z])'+name.split('').join('\\s*')+'(?![a-z])','i').test(raw))continue;
    matches.add(name);
  }return matches;
}

/** Returns unambiguous geographic targets. A bare duplicate district name is
 * deliberately not guessed; a parent name or explicit region can disambiguate. */
export function resolveTerritoryTargets(text,{region,country}={}){
  const value=clean(text);if(!value)return [];
  const clauseValue=simplify(String(text||'')).toLowerCase().replace(/\s/g,'');
  if(UNIT_INDEX.has(text))return [UNIT_INDEX.get(text)];
  const matches=matchingNames(value,simplify(String(text||'')).toLowerCase(),{allowCommon:!!country});
  const namedCountries=[];
  for(const name of matches){
    const rows=NAME_INDEX.get(name),countries=rows.filter(row=>row.role==='country');
    if(countries.length!==1)continue;
    const unshadowed=[...matches].filter(longer=>longer.length>name.length&&longer.includes(name)&&NAME_INDEX.get(longer).some(row=>row.role==='country')).reduce((remaining,longer)=>remaining.replaceAll(longer,''),value);
    if(!unshadowed.includes(name))continue;
    const candidate=countries[0],strong=(COUNTRY_ALIASES[candidate.country]||[]).some(alias=>clean(alias)===name);
    // Georgia is also a US state; a bare homonym cannot silently become either.
    if(strong||rows.every(row=>row.country===candidate.country))namedCountries.push(candidate.country);
  }
  const uniqueCountries=[...new Set(namedCountries)];
  // "中国台湾" contains the mainland alias "中国"; the longer region wins.
  const found=[];
  for(const name of matches){
    const units=NAME_INDEX.get(name);
    let candidates=region?units.filter(row=>row.region===region):units;
    if(country)candidates=candidates.filter(row=>row.country===country);
    // An explicitly identified country constrains even a unique locality name.
    // "France ... of ..." must never acquire Turkey's Of district as a target.
    if(uniqueCountries.length===1)candidates=candidates.filter(row=>row.country===uniqueCountries[0]);
    if(candidates.length>1&&new Set(candidates.map(row=>row.country)).size===1){const canonical=candidates.filter(row=>clean(row.name)===name);if(canonical.length===1)candidates=canonical;}
    if(candidates.length>1){const parents=candidates.filter(row=>row.parent&&value.includes(clean(row.parent))||geographyAncestors(row).slice(1).some(parent=>[parent.name,...parent.aliases].some(n=>value.includes(clean(n)))));if(parents.length)candidates=parents;}
    if(candidates.length>1){const upper=candidates.filter(row=>candidates.every(other=>geographyAncestors(other).some(u=>u.id===row.id)));if(upper.length===1)candidates=upper;}
    if(candidates.length!==1)continue;
    found.push({unit:candidates[0],length:name.length,match:name});
  }
  const namedProvinces=found.filter(row=>row.unit.role==='province').map(row=>row.unit);
  // Concatenated 河南郑州 contains the syllables 南郑; an explicit province
  // disambiguates local names instead of creating a second unrelated destination.
  for(let i=found.length-1;i>=0;i--){const row=found[i];if(['country','province'].includes(row.unit.role))continue;const relevant=namedProvinces.filter(p=>p.country===row.unit.country);if(relevant.length&&!geographyAncestors(row.unit).some(parent=>relevant.some(p=>p.id===parent.id)))found.splice(i,1);}
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
  return result.filter(unit=>!result.some(other=>other.id!==unit.id&&geographyAncestors(other).slice(1).some(parent=>parent.id===unit.id))).slice(0,32);
}

/** Broader, read-only search may list ambiguous matches; ownership resolution
 * above always remains strict. */
export function searchGeographyUnits(text,limit=16){
  const query=clean(text);if(!query)return [];
  return geographyUnits.filter(unit=>[unit.name,...unit.aliases,unit.parent?unit.parent+unit.name:''].some(value=>clean(value).includes(query))).slice(0,limit);
}

