import openingData from './data/opening-control.json' with {type:'json'};
import {getGeographyUnit,geographyAncestors,geographyUnits} from './geography.js';
import {getOpeningFaction} from './opening-control.js';
import {countryByTag} from './countries.js';
import {REGIMES} from './regime-rules.js';

// This version is part of save compatibility: changing a renderer, loading a
// different map layer or advancing a passive month must not redraw ownership.
const VERSION=1;
const hash=value=>{let h=2166136261;for(const c of String(value)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}h^=h>>>16;return h>>>0;};
const random=value=>(hash(value)+1)/4294967297;
const lifeSeed=state=>String(state.seed??state.id??'legacy-territory-control-v1');
const administrativeParents=new Set(geographyUnits.map(unit=>unit.parentId).filter(Boolean));
const isLocal=unit=>unit&&unit.role!=='country'&&(unit.role!=='province'||!administrativeParents.has(unit.id));
const cell=(unit,size=1)=>`${unit.country}:${Math.floor((unit.center?.[0]||0)/size)}:${Math.floor((unit.center?.[1]||0)/size)}`;
const anchors=new Map();
const dividedCountries=new Set();
for(const [id,control] of Object.entries(openingData.unitControls)){
  const unit=getGeographyUnit(id);if(!unit)continue;
  if((control.controllers||[]).some(row=>row.tag!==openingData.defaultControllers[unit.country]))dividedCountries.add(unit.country);
  if(!control.tag||control.uncertain||!isLocal(unit))continue;
  const key=cell(unit),rows=anchors.get(key)||[];rows.push({unit,tag:control.tag});anchors.set(key,rows);
}
export const openingFragmentedCountryIds=Object.freeze([...dividedCountries]);
function nearbySupport(unit,tag){
  const [x,y]=unit.center||[0,0],scores=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const row of anchors.get(`${unit.country}:${Math.floor(x)+dx}:${Math.floor(y)+dy}`)||[]){
    if(row.tag!==tag||row.unit.id===unit.id)continue;
    const distance=Math.hypot((row.unit.center[0]-x)*Math.cos(y*Math.PI/180),row.unit.center[1]-y);
    scores.push(1/(1+distance*8));
  }
  return scores.sort((a,b)=>b-a).slice(0,4).reduce((a,b)=>a+b,0);
}
function pick(state,unit,candidates,purpose){
  const seed=lifeSeed(state),cluster=`${unit.parentId||unit.country}:${cell(unit,.65)}`;
  return candidates.map(candidate=>{
    const weight=Math.max(.03,Number(candidate.weight)||.03);
    const shared=-Math.log(-Math.log(random(`${VERSION}|${seed}|${purpose}|${cluster}|${candidate.id}`)));
    const local=-Math.log(-Math.log(random(`${VERSION}|${seed}|${purpose}|${unit.id}|${candidate.id}`)));
    return {candidate,score:Math.log(weight)+.78*shared+.22*local};
  }).sort((a,b)=>b.score-a.score||a.candidate.id.localeCompare(b.candidate.id))[0]?.candidate||null;
}
function preferredOpening(state,unit,candidates){
  if(state.profile?.birthplace?.unitId!==unit.id)return null;
  const authority=state.profile.birthplace.authorityId;
  if(!authority)return null;
  return candidates.find(candidate=>candidate.id===authority||authority.startsWith('country:')&&getOpeningFaction(candidate.tag)?.primary&&getOpeningFaction(candidate.tag)?.country===authority.slice(8))||null;
}

/** Establish a concrete fictional county administration from the MOD's existing
 * candidates. The underlying evidence stays unchanged in opening-control. */
export function simulateOpeningControl(state,unit,control){
  if(!isLocal(unit)||!control?.uncertain||Number(state.month)<0)return control;
  const candidates=(control.mixedControllers||[]).filter(row=>getOpeningFaction(row.tag)).map(row=>{
    const faction=getOpeningFaction(row.tag),share=Number.isFinite(row.share)?row.share:1/Math.max(1,control.mixedControllers.length);
    return {id:faction.id,tag:faction.tag,name:faction.name,weight:Math.max(.04,share)+(control.seatTag===row.tag?0.28:0)+nearbySupport(unit,row.tag)*.12};
  });
  const chosen=preferredOpening(state,unit,candidates)||pick(state,unit,candidates,'opening');
  if(!chosen)return control;
  const faction=getOpeningFaction(chosen.tag);
  return {...control,tag:chosen.tag,controllerTag:chosen.tag,factionId:chosen.id,name:chosen.name,country:faction.country,
    leader:faction.leader,government:faction.government,ideology:faction.ideology,ideologyId:faction.ideologyId,
    ideologyGroup:faction.ideologyGroup,cosmeticTag:faction.cosmeticTag,conflict:faction.conflict,
    uncertain:false,mixedControllers:[],simulation:{version:VERSION,origin:'opening',chosenId:chosen.id,
      candidateIds:candidates.map(row=>row.id),candidateTags:candidates.map(row=>row.tag),
      weightedCandidates:candidates.map(({id,weight})=>({id,weight})),preferred:!!preferredOpening(state,unit,candidates)}};
}

const CIVIL_ACTORS={
  taiwan:[
    {id:'taiwan_left',tag:'TZL',name:'台湾左翼联盟',leader:'左翼联盟联合委员会',government:'左翼联盟地方行政机构'},
    {id:'taiwan_dpp',tag:'CHI',name:'民进党',leader:'民进党指挥部',government:'民进党地方行政机构'},
    {id:'taiwan_kmt',tag:'KMT',name:'国民党',leader:'国民党指挥部',government:'国民党地方行政机构'},
    {id:'taiwan_revanchist',tag:'TJJ',name:'基进党',leader:'基进党指挥部',government:'基进党地方行政机构'}],
  japan:[
    {id:'japan_left',tag:'TSU',name:'日本民主联合军',leader:'羽泽鸫',government:'民主联合军地方行政机构'},
    {id:'japan_toyokawa',tag:'JAP',name:'丰川紧急委员会',leader:'丰川祥子',government:'紧急委员会地方行政机构'}],
  china:[
    {id:'china_leftfront',tag:'PRC',cosmeticTag:'PRC_LM',name:'北京临时政府',leader:'韩东方',government:'泛左翼联合临时政府'},
    {id:'china_old_cpc',tag:'HKN',cosmeticTag:'PRC_PLA_PANLUAN',name:'上海中共中央临时政府',leader:'胡春华',government:'旧中共临时政府',ideology:'军政管治'},
    {id:'china_mao',tag:'PRC',name:'毛远新中央政府',leader:'毛远新',government:'中央政府及其支持部队'},
    {id:'china_dissenting_military',tag:null,name:'解放军反对派',leader:null,government:'反对中央命令的军方管治机构'},
    {id:'china_front',tag:'PRC',name:'革命阵线',leader:'联合革命委员会',government:'革命阵线地方行政机构'},
    {id:'china_bo',tag:'PRC',name:'薄熙来领导的中央政府',leader:'薄熙来',government:'薄熙来领导下的战时政府'}],
  usa:['USA','USB'].map(tag=>{const row=countryByTag(tag);return {id:'faction:'+tag,tag,name:row.name,leader:row.leader,government:row.government,ideology:row.ideology};}),
};
export function simulatedCivilActor(id){
  for(const [region,actors] of Object.entries(CIVIL_ACTORS)){
    const actor=actors.find(row=>row.id===id);if(actor)return {...actor,region,ideology:actor.ideology||REGIMES[id]?.ideology||null,currentSource:'civil-war'};
  }
  if(String(id).startsWith('local-command:')){
    const province=getGeographyUnit(id.slice(14));if(province)return {id,region:province.region,tag:null,name:`${province.name}地方部队`,leader:null,government:'脱离统一指挥的地方部队管治',ideology:null,currentSource:'civil-war'};
  }
  return null;
}
function publicEvents(state){
  const ids=[...(state.seenEvents||[]),...(state.seenNews||[]),...(state.newsHistory||[]).filter(row=>row.month<=state.month).map(row=>row.id),...(state.current?.majorId?[state.current.majorId]:[])];
  return new Set(ids.filter(id=>!Number.isFinite(state.eventMonths?.[id])||state.eventMonths[id]<=state.month));
}
function extraCivilActors(state,unit){
  const actors=new Map(),add=(id,name,tag)=>{
    if(!id||/fragmented|^contested:/.test(id))return;
    const known=simulatedCivilActor(id)||getOpeningFaction(id)||countryByTag(String(id).replace(/^faction:/,''));
    actors.set(id,{id,tag:tag||known?.tag||null,name:name||known?.name||id,leader:known?.leader||null,government:known?.government||`${name||known?.name||id}地方管治`,ideology:known?.ideology||null,region:unit.region,currentSource:'civil-war',weight:1.35});
  };
  for(const [id,patch] of Object.entries(state.territoryOverrides||{})){
    if(patch.source==='war_dynamics')continue;
    const place=getGeographyUnit(id);if((place?.region!==unit.region&&id!==`region:${unit.region}`)||Number.isFinite(patch.month)&&patch.month>state.month)continue;
    add(patch.controllerId||patch.ownerId||patch.controller,patch.controller||patch.ownerName,patch.ownerTag);
    add(patch.attackerId,patch.attackerName,patch.attackerTag);
  }
  const regionalName={china:'中国',taiwan:'台湾',japan:'日本',usa:'美国'}[unit.region];
  for(const [id,conflict] of Object.entries(state.factionConflicts||{})){
    if(!conflict)continue;
    const known=getOpeningFaction(id)||countryByTag(String(id).replace(/^faction:/,''));
    if(known?.country===unit.country||known?.iso===unit.country||regionalName&&String(conflict).includes(regionalName))add(id);
  }
  return [...actors.values()];
}
function civilActors(state,unit,context,seen){
  let actors=[];
  if(['taiwan','japan'].includes(unit.region))actors=CIVIL_ACTORS[unit.region].map(row=>simulatedCivilActor(row.id));
  else if(unit.region==='usa'&&seen.has('world_usa_civil_war'))actors=CIVIL_ACTORS.usa.map(row=>simulatedCivilActor(row.id));
  else if(unit.region==='china'){
    if(seen.has('cn_longmarch_coup')||seen.has('cn_longmarch_civil'))actors=['china_leftfront','china_old_cpc'].map(simulatedCivilActor);
    else if(seen.has('cn_total_civil_war')){
      actors=[simulatedCivilActor(seen.has('cn_bo_war_leader')?'china_bo':'china_mao'),simulatedCivilActor('china_dissenting_military')];
      if(seen.has('cn_mao_assassinated')&&!seen.has('cn_bo_war_leader'))actors[0]={...actors[0],name:'中央联合机构',leader:null};
      if(seen.has('cn_front_stalemate'))actors.push(simulatedCivilActor('china_front'));
    }else if(seen.has('cn_collapse_civil')){
      const province=geographyAncestors(unit).find(row=>row.role==='province');
      actors=[{id:'china_initial',tag:'PRC',name:'中央政府留守机构',leader:null,government:'仍接受中央指挥的地方行政机构',ideology:REGIMES.china_initial.ideology,region:'china',currentSource:'civil-war'},...(province?[simulatedCivilActor('local-command:'+province.id)]:[])];
    }
  }
  const province=geographyAncestors(unit).find(row=>row.role==='province');
  const localWeight=id=>{
    if(!['china_leftfront','china_old_cpc'].includes(id))return 1;
    const beijing=['北京','河北','天津'].includes(province?.name),shanghai=['上海','江苏','安徽'].includes(province?.name);
    return beijing?(id==='china_leftfront'?2.5:.5):shanghai?(id==='china_old_cpc'?2.5:.5):1;
  };
  const extra=extraCivilActors(state,unit),all=new Map(actors.filter(Boolean).map(row=>[row.id,{...row,weight:localWeight(row.id)}]));
  for(const row of extra)all.set(row.id,row);
  // A player-created war has only the existing incumbent and explicitly
  // recorded opponents; an unannounced faction is never inferred from a route.
  if(!actors.length&&extra.length&&context.factionId&&!/fragmented|^contested:/.test(context.factionId))all.set(context.factionId,{id:context.factionId,tag:context.tag||null,name:context.name||context.leader||context.government,leader:context.leader||null,government:context.government||null,ideology:context.ideology||null,region:unit.region,currentSource:'civil-war',weight:1});
  return [...all.values()];
}
function civilEvidence(unit,seen){
  if(unit.region==='usa')return ['localisation/simp_chinese/TFR_country_localisation_PRC_l_simp_chinese.yml:china.201.d','common/scripted_effects/TFR_scripted_effects_USA.txt:USA_civil_war_outbreak_effect'];
  if(unit.region==='china'){
    if(seen.has('cn_longmarch_coup')||seen.has('cn_longmarch_civil'))return ['localisation/simp_chinese/replace/_gzl_l_simp_chinese.yml:PRC_MAO1.71.d','events/TFR_MAO1_EVENT.txt:PRC_MAO1.66'];
    if(seen.has('cn_total_civil_war'))return ['lore:cn_total_civil_war',...(seen.has('cn_front_stalemate')?['lore:cn_front_stalemate']:[])];
    if(seen.has('cn_collapse_civil'))return ['lore:cn_collapse_civil'];
  }
  return [];
}
/** Only already-public named civil-war sides are eligible. A new declared
 * unified government is handled by the ordinary world override mechanism. */
export function simulateCivilWarControl(state,unit,context){
  if(!isLocal(unit)||Number(state.month)<0)return null;
  const seen=publicEvents(state),american=unit.region==='usa'&&seen.has('world_usa_civil_war')&&!['postwar','reconstruction'].includes(context.stage);
  if(!['civil_war','fragmentation'].includes(context.stage)&&!american&&!/内战|civil\s*war/i.test(context.conflict||''))return null;
  const explicit=state.worldOverrides?.[unit.region]?.factionId;
  if(explicit&&!/fragmented/.test(explicit)&&!['civil_war','fragmentation'].includes(state.worldOverrides?.[unit.region]?.stage))return null;
  const candidates=civilActors(state,unit,context,seen);if(!candidates.length)return null;
  const chosen=pick(state,unit,candidates,'civil-war:'+unit.region);if(!chosen)return null;
  const actor=chosen;
  return {controllerId:chosen.id,controller:chosen.name,controllerTag:chosen.tag,tag:chosen.tag,
    country:unit.country,geographicCountry:unit.country,name:chosen.name,factionId:chosen.id,
    leader:actor.leader,government:actor.government,ideology:actor.ideology,conflict:context.conflict||(american?'美国内战':null),
    uncertain:false,mixedControllers:[],mapping:'civil-war-control',info:{...actor,factionId:chosen.id,tag:chosen.tag},
    simulation:{version:VERSION,origin:'civil-war',chosenId:chosen.id,candidateIds:candidates.map(row=>row.id),candidateTags:candidates.map(row=>row.tag),candidateActors:candidates.map(({id,name,tag})=>({id,name,tag:tag||null})),weightedCandidates:candidates.map(({id,weight})=>({id,weight})),sourceRefs:civilEvidence(unit,seen)}};
}

/** Rival inference is limited to an actual MOD war or the public civil-war
 * candidate set. Different flags in a peaceful divided county are not a battle. */
export function simulatedBattleOpponent(state,unit,control,{ownerId,ownerTag,war,explicitFrontline=false}={}){
  if(!war||!isLocal(unit))return null;
  const metadata=control?.simulation,candidateIds=metadata?.candidateIds||[];
  let rivals=[];
  if(metadata?.origin==='civil-war')rivals=(metadata.candidateActors||candidateIds.map(id=>simulatedCivilActor(id))).filter(row=>row&&row.id!==ownerId);
  else if(ownerTag){
    const faction=getOpeningFaction(ownerTag),opponents=new Set(faction?.opponents||[]);
    rivals=candidateIds.map(id=>getOpeningFaction(id)).filter(row=>row&&row.tag!==ownerTag&&opponents.has(row.tag));
    if(explicitFrontline&&!rivals.length)rivals=[...opponents].map(getOpeningFaction).filter(Boolean);
  }
  rivals=rivals.filter(row=>![row.id,`faction:${row.tag}`].some(id=>state.factionConflicts?.[id]===null||state.worldOverrides?.[id]?.conflict===null));
  if(!rivals.length)return null;
  if(!explicitFrontline&&random(`${VERSION}|${lifeSeed(state)}|frontline|${unit.id}`)>=.28)return null;
  const chosen=pick(state,unit,rivals.map(row=>({...row,weight:1})),'attacker');
  return chosen?{id:chosen.id,name:chosen.name,tag:chosen.tag||null}:null;
}
