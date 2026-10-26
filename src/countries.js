import data from './data/countries.json' with {type:'json'};
import {normalizedGovernmentOverride} from './regime-rules.js';

const clone=value=>structuredClone(value);
const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[\s.,'’()（）·\-]/g,'');
const isoAliases={KOS:'XKX',SDS:'SSD',CHINA:'CHN',TAIWAN:'TWN',JAPAN:'JPN',KOREA:'KOR',HONGKONG:'HKG',MACAU:'MAC',中国:'CHN',中国大陆:'CHN',中國大陸:'CHN',台湾:'TWN',台灣:'TWN',中国台湾:'TWN',中國臺灣:'TWN',韩国:'KOR',朝鲜:'PRK',香港:'HKG',澳门:'MAC',澳門:'MAC',美国:'USA',英國:'GBR',英国:'GBR',俄国:'RUS',俄羅斯:'RUS'};
const aliases=new Map();
for(const row of Object.values(data.countries))for(const alias of [...row.aliases,row.region]){
 const key=normalize(alias),old=aliases.get(key);aliases.set(key,old&&old!==row.iso?null:row.iso);
}
for(const [alias,iso]of Object.entries(isoAliases))aliases.set(normalize(alias),iso);
export const countryCatalogCounts=Object.freeze({...data.counts});
export const countryRegionNames=Object.freeze(Object.fromEntries(Object.values(data.countries).map(row=>[row.region,row.name])));
export function resolveCountry(query){
 const direct=String(query||'').trim().toUpperCase(),iso=data.countries[direct]?direct:isoAliases[direct]||aliases.get(normalize(query));
 return iso&&data.countries[iso]?clone(data.countries[iso]):null;
}
export function countryByTag(tag){const row=data.tags[String(tag||'').toUpperCase()];return row?clone(row):null;}
export function countryByIso(iso,state){return getCountryContext(state||{},iso);}

const CURRENT_FIELDS=['leader','headOfState','headOfGovernment','government','governmentTypeId','ideology','ideologyId','ideologyGroup','rulingParty','parties','capital','stage','factionId','cosmeticTag','conflict','regionalConflict','institutions','terms','economy','economyId','alliance','subjectOf','nationalSpirits','focusTreeIds','laws','ministers'];
function datedPatch(value,month){return value&&typeof value==='object'&&!Array.isArray(value)&&(!Number.isFinite(value.month)||value.month<=month)?value:null;}
function copyCurrent(target,patch){if(!patch)return;for(const key of CURRENT_FIELDS)if(Object.hasOwn(patch,key))target[key]=clone(patch[key]);}
/** Static MOD evidence remains in baseline. Only public state and explicit changes
 * become current facts; future/releasable TAGs never replace the opening country. */
export function getCountryContext(state={},query){
 const identity=resolveCountry(query);if(!identity)return null;
 const source=identity.localBaseline||data.tags[identity.tag];
 const baseline={iso:identity.iso,region:identity.region,name:identity.name,tag:identity.tag,englishName:identity.englishName,aliases:clone(identity.aliases),leader:null,headOfState:null,headOfGovernment:null,government:null,ideology:null,rulingParty:null,capital:null,nationalSpirits:[],focusTreeIds:[],parties:[],sourceRefs:[],summary:'暂无可核实的当地开局政务资料。',startingStatus:'unknown',factionId:identity.region,conflict:null,...(source?clone(source):{})};
 baseline.iso=identity.iso;baseline.region=identity.region;
 const result={...clone(baseline),baseline:clone(baseline),openingTags:clone(identity.openingTags||[]),currentSource:source?'mod-opening':'unknown'};
 const month=Number(state.month)||0;
 if(month<0){for(const key of CURRENT_FIELDS)result[key]=['nationalSpirits','focusTreeIds','parties','institutions','terms'].includes(key)?[]:null;result.stage='historical';result.factionId=identity.region;result.government=`${2020+Math.floor(month/12)}年的当地管治体系`;result.summary='当地制度与生活条件以抵达年代已经确认的情况为准。';result.currentSource='historical-unknown';}
 const candidate=datedPatch(state.worldState?.[identity.region]||state.worldState?.[identity.iso],month);
 const current=candidate&&CURRENT_FIELDS.some(key=>Object.hasOwn(candidate,key))?candidate:null;
 const declared=datedPatch(state.worldOverrides?.[identity.region]||state.worldOverrides?.[identity.iso],month);
 const patch=normalizedGovernmentOverride(identity.region,declared);
 if(current||patch){copyCurrent(result,current);copyCurrent(result,patch);result.currentSource='dynamic';
   const politicalChange=['leader','government','ideology','factionId'].some(key=>(patch&&Object.hasOwn(patch,key)&&patch[key]!==baseline[key])||(current&&Object.hasOwn(current,key)&&current[key]!==baseline[key]));
   if(politicalChange)for(const office of ['leader','rulingParty','headOfState','headOfGovernment'])if(!Object.hasOwn(patch||{},office)&&!Object.hasOwn(current||{},office))result[office]=null;
   result.summary=[result.government,result.leader&&`当前领导：${result.leader}`,result.ideology&&`政治取向：${result.ideology}`].filter(Boolean).join('。')+'。';
 }
 if(state.worldDynamics?.lastingPeace)result.conflict=null;
 if(Object.hasOwn(state.factionConflicts||{},result.factionId))result.conflict=state.factionConflicts[result.factionId];
 if(Object.hasOwn(state.factionConflicts||{},identity.region))result.conflict=state.factionConflicts[identity.region];
 if(state.worldDynamics?.lastingPeace)result.conflict=null;
 result.institutions??=['当地行政机关','地方议事与公共服务机构'];result.terms??=[];
 result.dailyLife=`${identity.name}的居民在家庭、工作场所和公共服务机构之间安排日常事务。`;
 return result;
}

/** A controlling authority can differ from the geographical country's main
 * government. Resolve its own TAG first; never borrow that country's president. */
export function getFactionContext(state={},tag){
 const row=data.tags[String(tag||'').toUpperCase()];if(!row)return null;
 const identity=data.countries[row.iso];
 if(identity?.tag===row.tag)return getCountryContext(state,row.iso);
 const month=Number(state.month)||0,result={...clone(row),baseline:clone(row),currentSource:'mod-opening'};
 if(month<0){for(const key of CURRENT_FIELDS)result[key]=['nationalSpirits','focusTreeIds','parties','laws','ministers','institutions','terms'].includes(key)?[]:null;result.currentSource='historical-unknown';result.startingStatus='unknown';}
 const current=datedPatch(state.worldState?.[row.tag]||state.worldState?.[row.factionId],month);
 const declared=datedPatch(state.worldOverrides?.[row.tag]||state.worldOverrides?.[row.factionId],month);
 if(current||declared){copyCurrent(result,current);copyCurrent(result,declared);result.currentSource='dynamic';
  if(['leader','government','ideology','factionId'].some(key=>Object.hasOwn(declared||{},key)||Object.hasOwn(current||{},key)))for(const field of ['leader','headOfState','headOfGovernment','rulingParty'])if(!Object.hasOwn(current||{},field)&&!Object.hasOwn(declared||{},field))result[field]=null;
 }
 for(const key of [row.tag,result.factionId])if(Object.hasOwn(state.factionConflicts||{},key))result.conflict=state.factionConflicts[key];
 if(state.worldDynamics?.lastingPeace)result.conflict=null;
 return result;
}
