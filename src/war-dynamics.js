import {geographyUnits,getGeographyUnit,geographyAncestors} from './geography.js';
import {openingFactions,openingFactionsForCountry,getOpeningFaction} from './opening-control.js';
import {controllerContext,territorialPatchFor} from './local-control.js';
import {createTerritoryContext,deriveTerritorySituation} from './world-territories.js';

export const WAR_DYNAMICS_VERSION=1;
const SOURCE='war_dynamics';
const hash=value=>{let h=2166136261;for(const c of String(value)){h^=c.codePointAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const roll=(state,key)=>hash(`${state.seed??state.id??'legacy'}|war-v1|${key}`)/4294967296;
const own=(row,key)=>Object.prototype.hasOwnProperty.call(row||{},key);
const civil=conflict=>/内战|争夺|civil\s*war|叛乱|革命/.test(conflict||'');
const activeValue=value=>typeof value==='string'?value:value?.conflict;
const countryUnits=new Map(),parentIds=new Set(geographyUnits.map(u=>u.parentId).filter(Boolean));
for(const unit of geographyUnits){const rows=countryUnits.get(unit.country)||[];rows.push(unit);countryUnits.set(unit.country,rows);}
// Use the finest available real units. In Japan these are municipalities; in
// countries with no county layer the available provincial units remain intact.
const leaves=new Map([...countryUnits].map(([iso,rows])=>[iso,rows.filter(u=>u.role!=='country'&&!parentIds.has(u.id)&&u.center?.length===2)]));
const openingCountries=new Set(openingFactions.filter(f=>f.opponents?.length&&f.country).map(f=>f.country));
const graphs=new Map();
const countryRegion=iso=>(countryUnits.get(iso)||[]).find(u=>u.role==='country')?.region;
const countryName=iso=>(countryUnits.get(iso)||[]).find(u=>u.role==='country')?.name||iso;
const LABELS={AFG:'阿富汗战争',YEM:'也门内战',LBY:'利比亚内战',SOM:'索马里内战',CAF:'中非内战',UKR:'顿巴斯战事'};
// Only for countries whose county bindings are absent: approximate continuous
// control around MOD-owned named areas. These are game adaptations, not claims
// about exact real 2020 fronts. An existing mapped/explicit owner always wins.
const FALLBACK_CENTRES={
  LBY:{centres:[['LBA',13.2,32.8],['HRL',20.18,31.78],['HRL',17.6,31.2],['HRL',15.33,24.49],['HRL',12.81,26.39]],sourceRefs:['history/states/448-Tripoli.txt','history/states/661-Tripolitania.txt','history/states/450-Benghasi.txt','history/states/662-Sirte.txt','history/states/907-Fezzan.txt','history/states/1325-Murzuq.txt']},
  CAF:{centres:[['CAR',18.5534,4.3792],['CPC',19.2193,7.5115]],sourceRefs:['history/states/778-Bangui.txt','history/states/779-Kaga Bandoro.txt']},
};
const distance=(a,b)=>Math.hypot((a.center[0]-b.center[0])*Math.cos((a.center[1]+b.center[1])*Math.PI/360),a.center[1]-b.center[1]);
const boundsNear=(a,b)=>a.bounds&&b.bounds&&a.bounds[0]<=b.bounds[2]+.018&&b.bounds[0]<=a.bounds[2]+.018&&a.bounds[1]<=b.bounds[3]+.018&&b.bounds[1]<=a.bounds[3]+.018;

/** Geometric neighbourhoods are an abstract movement graph, not a claim that
 * bounding rectangles are surveyed shared borders. Cache only immutable data. */
function graphFor(iso){
  if(graphs.has(iso))return graphs.get(iso);
  const units=leaves.get(iso)||[],map=new Map(units.map(u=>[u.id,u])),edges=new Map(units.map(u=>[u.id,[]]));
  const country=(countryUnits.get(iso)||[]).find(u=>u.role==='country'),b=country?.bounds||[-180,-90,180,90];
  const size=Math.max(.12,Math.min(1.8,Math.sqrt(Math.max(.01,(b[2]-b[0])*(b[3]-b[1]))/Math.max(1,units.length))*2));
  const grid=new Map();
  for(const u of units){const key=`${Math.floor(u.center[0]/size)}:${Math.floor(u.center[1]/size)}`,rows=grid.get(key)||[];rows.push(u);grid.set(key,rows);}
  for(const u of units){
    const [x,y]=u.center.map(n=>Math.floor(n/size)),near=[];
    for(let dx=-2;dx<=2;dx++)for(let dy=-2;dy<=2;dy++)for(const other of grid.get(`${x+dx}:${y+dy}`)||[])if(other.id!==u.id){
      const d=distance(u,other);if(d<=size*2.5&&boundsNear(u,other))near.push({id:other.id,d});
    }
    near.sort((a,b)=>a.d-b.d||a.id.localeCompare(b.id));
    for(const candidate of near.slice(0,9)){if(!edges.get(u.id).includes(candidate.id))edges.get(u.id).push(candidate.id);if(!edges.get(candidate.id).includes(u.id))edges.get(candidate.id).push(u.id);}
  }
  const graph={units,map,edges};graphs.set(iso,graph);return graph;
}
function normalizeState(state){
  if(!state.warDynamics||typeof state.warDynamics!=='object'||Array.isArray(state.warDynamics)||state.warDynamics.version!==WAR_DYNAMICS_VERSION)state.warDynamics={version:WAR_DYNAMICS_VERSION,campaigns:{}};
  const data=state.warDynamics;if(!data.campaigns||typeof data.campaigns!=='object'||Array.isArray(data.campaigns))data.campaigns={};
  state.territoryOverrides??={};return data;
}
/** Save validation only. This never creates a campaign, advances a month, or
 * changes a historical balance. Old saves without this field remain valid. */
export function validateWarDynamics(state){
  const data=state.warDynamics;if(data===undefined)return;
  const fail=()=>{throw new Error('这份档案的战线记录不完整。');};
  if(!data||typeof data!=='object'||Array.isArray(data)||data.version!==WAR_DYNAMICS_VERSION||!data.campaigns||typeof data.campaigns!=='object'||Array.isArray(data.campaigns)||Object.keys(data.campaigns).length>300)fail();
  let total=0;
  for(const [id,c]of Object.entries(data.campaigns)){
    if(!c||c.id!==id||!countryUnits.has(c.country)||countryRegion(c.country)!==c.region||!['active','ended'].includes(c.status)||!['opening','civil','landing'].includes(c.kind)||typeof c.name!=='string'||c.name.length>200||!Array.isArray(c.unitIds)||!Array.isArray(c.actors)||c.actors.length>256||!Array.isArray(c.pairs)||c.pairs.length>20000)fail();
    total+=c.unitIds.length;if(total>12000||c.unitIds.some(unitId=>getGeographyUnit(unitId)?.country!==c.country))fail();
    if(!Number.isInteger(c.startedMonth)||c.startedMonth>state.month||!Number.isInteger(c.step)||c.step<0||!Number.isInteger(c.quietMonths)||c.quietMonths<0)fail();
    if(c.lastStepMonth!==null&&(!Number.isInteger(c.lastStepMonth)||c.lastStepMonth>state.month)||c.endedMonth!==undefined&&(!Number.isInteger(c.endedMonth)||c.endedMonth>state.month))fail();
    if(c.actors.some(a=>!a||typeof a.id!=='string'||a.id.length>200||typeof a.name!=='string'||a.name.length>200||a.tag!==undefined&&typeof a.tag!=='string')||c.pairs.some(p=>typeof p!=='string'||p.length>401))fail();
  }
}
function explicitPatch(state,unit){
  const keys=[`country:${unit.country}`,`region:${unit.region}`,unit.parent?`province:${unit.parent}`:'',...geographyAncestors(unit).map(u=>u.id)];
  return keys.map(id=>state.territoryOverrides?.[id]).find(p=>p&&p.source!==SOURCE&&(!Number.isFinite(p.month)||p.month<=state.month));
}
function participant(id,name,tag,state){
  const context=controllerContext(state,id)||getOpeningFaction(tag||id)||{};
  return {id,name:name||context.name||context.leader||id,...(tag||context.tag?{tag:tag||context.tag}:{}),region:context.region||countryRegion(context.country),leader:context.leader||null,government:context.government||null,ideology:context.ideology||null};
}
function stopped(state,region,context){
  return state.month<0||state.worldDynamics?.lastingPeace||(state.worldDynamics?.terminatedConflicts||[]).includes(region)||own(state.worldOverrides?.[region],'conflict')&&state.worldOverrides[region].conflict===null||own(state.factionConflicts,region)&&state.factionConflicts[region]===null||['postwar','reconstruction','left_reconstruction','republic_transition'].includes(context?.stage)&&!context?.conflict;
}
function factionStopped(state,id){return own(state.factionConflicts,id)&&state.factionConflicts[id]===null||own(state.worldOverrides?.[id],'conflict')&&state.worldOverrides[id].conflict===null;}
function pairKey(a,b){return [a,b].sort().join('|');}
function definitions(state,prepared){
  const defs=[],seen=prepared.seen;
  for(const iso of openingCountries){
    const region=countryRegion(iso),context=prepared.contexts[region];if(stopped(state,region,context))continue;
    if(context?.currentSource==='dynamic'&&context.factionId&&!civil(context.conflict)&&context.stage!=='civil_war')continue;
    const factions=openingFactionsForCountry(iso),ids=new Set(factions.map(f=>f.id)),pairs=new Set();
    for(const f of factions)for(const tag of f.opponents||[]){const id='faction:'+tag;if(ids.has(id)&&!factionStopped(state,f.id)&&!factionStopped(state,id))pairs.add(pairKey(f.id,id));}
    if(pairs.size)defs.push({id:`opening:${iso}`,country:iso,region,name:LABELS[iso]||`${countryName(iso)}战事`,kind:'opening',pairs:[...pairs],actors:factions.map(f=>participant(f.id,f.name,f.tag,state)),token:'2020-opening'});
  }
  const straitEnded=seen.has('world_strait_end')||(state.worldDynamics?.terminatedConflicts||[]).some(id=>['strait','taiwan'].includes(id));
  const tw=prepared.contexts.taiwan;
  const declared=state.worldOverrides?.taiwan;
  const activeStrait=(seen.has('world_strait_war')||/台海/.test(declared?.conflict||''))&&!straitEnded&&!stopped(state,'taiwan',tw)&&!civil(tw?.conflict);
  if(activeStrait){
    const cn=prepared.contexts.china||{},defender=tw?.factionId||'taiwan_dpp',invader=cn.factionId||'china_initial';
    defs.push({id:'strait:TWN',country:'TWN',region:'taiwan',name:'台海战争',kind:'landing',token:String(state.eventMonths?.world_strait_war??declared?.month??21),pairs:[pairKey(invader,defender)],actors:[{...participant(invader,'大陆部队',cn.tag||'PRC',state),region:'china',leader:cn.leader,government:cn.government,ideology:cn.ideology},{...participant(defender,'台湾守军',tw?.tag||'CHI',state),region:'taiwan',leader:tw?.leader,government:tw?.government,ideology:tw?.ideology}],invader,defender});
  }
  for(const [region,context]of Object.entries(prepared.contexts)){
    if(stopped(state,region,context)||activeStrait&&region==='taiwan')continue;
    const conflict=activeValue(state.worldOverrides?.[region]?.conflict)||context.conflict;
    const american=region==='usa'&&seen.has('world_usa_civil_war');
    if(!american&&!civil(conflict)&&!['civil_war','fragmentation'].includes(context.stage))continue;
    const country=[...countryUnits].find(([,rows])=>rows.some(u=>u.role==='country'&&u.region===region))?.[0];
    if(!country||defs.some(d=>d.country===country))continue;
    defs.push({id:`civil:${country}`,country,region,name:conflict||'美国内战',kind:'civil',pairs:[],actors:[],token:String(state.worldOverrides?.[region]?.month??'public-civil')});
  }
  return defs;
}
function warPatch(state,campaign,actor,extra={}){
  return {controllerId:actor.id,controller:actor.name,...(actor.tag?{ownerTag:actor.tag}:{}),conflict:campaign.name,frontline:false,month:state.month,source:SOURCE,warCampaign:campaign.id,...extra};
}
function writeOwner(state,campaign,id,actor,extra={}){
  const unit=getGeographyUnit(id);if(!unit||explicitPatch(state,unit))return false;
  state.territoryOverrides[id]=warPatch(state,campaign,actor,extra);return true;
}
function clearAttack(row){delete row.attackerId;delete row.attackerName;delete row.attackerTag;row.frontline=false;}
function currentOwners(state,campaign){
  const owners=new Map();
  for(const id of campaign.unitIds){const unit=getGeographyUnit(id);if(!unit)continue;const row=territorialPatchFor(state,unit);if(row.controllerId)owners.set(id,row.controllerId);}
  return owners;
}
function initializeCampaign(state,definition,prepared){
  const graph=graphFor(definition.country),actors=new Map(definition.actors.map(a=>[a.id,a])),snapshots=[];
  // Read the complete pre-change baseline before writing any county patch.
  // This avoids order-dependent civil-war seeds and preserves old-save control.
  for(const unit of graph.units){
    const situation=deriveTerritorySituation(state,unit,undefined,prepared);if(!situation?.ownerId||situation.uncertain)continue;
    let id=situation.ownerId;
    if(definition.kind==='landing')id=definition.defender;
    if(definition.kind==='opening'&&!actors.has(id)){
      const matching=definition.actors.find(a=>a.tag===situation.ownerTag);if(matching)id=matching.id;
    }
    if(definition.kind==='opening'&&!actors.has(id))continue;
    if(!actors.has(id))actors.set(id,participant(id,situation.ownerName,situation.ownerTag,state));
    snapshots.push({unit,id,mapping:situation.source});
  }
  const fallback=definition.kind==='opening'?FALLBACK_CENTRES[definition.country]:null;
  if(fallback)for(const row of snapshots){
    if(row.mapping!=='country-opening-control'||explicitPatch(state,row.unit))continue;
    const closest=fallback.centres.map(([tag,x,y])=>({id:'faction:'+tag,d:distance(row.unit,{center:[x,y]})})).filter(c=>actors.has(c.id)).sort((a,b)=>a.d-b.d)[0];
    if(closest)row.id=closest.id;
  }
  if(actors.size<2||definition.kind!=='landing'&&new Set(snapshots.map(row=>row.id)).size<2)return null;
  const campaign={...definition,status:'active',startedMonth:state.month,startedTurn:state.turn,actors:[...actors.values()],unitIds:snapshots.map(s=>s.unit.id),lastStepMonth:null,lastStepTurn:null,step:0,quietMonths:0,recentChanges:[]};
  if(fallback)campaign.initialAdaptation={method:'nearest-mod-owned-centre',sourceRefs:fallback.sourceRefs};
  if(campaign.kind==='civil')campaign.pairs=campaign.actors.flatMap((a,i)=>campaign.actors.slice(i+1).map(b=>pairKey(a.id,b.id)));
  for(const {unit,id}of snapshots)if(!explicitPatch(state,unit))state.territoryOverrides[unit.id]=warPatch(state,campaign,actors.get(id));
  return campaign;
}
function finishCampaign(state,campaign,prepared){
  if(campaign.status!=='active')return;
  const context=prepared.contexts[campaign.region]||{},override=state.worldOverrides?.[campaign.region];
  const naturalWinner=campaign.kind==='landing'&&prepared.seen.has('world_strait_end')||context.knownChanges?.length&&!civil(context.conflict)&&!context.conflict;
  const playerGovernment=override&&['leader','government','factionId'].some(k=>own(override,k))&&!civil(override.conflict)&&override.conflict===null;
  for(const [id,patch]of Object.entries(state.territoryOverrides)){
    if(patch.source!==SOURCE||patch.warCampaign!==campaign.id)continue;
    if(naturalWinner||playerGovernment)delete state.territoryOverrides[id];
    else {patch.conflict=null;clearAttack(patch);patch.month=state.month;}
  }
  campaign.status='ended';campaign.endedMonth=state.month;campaign.endedTurn=state.turn;campaign.endReason=naturalWinner?'public-outcome':playerGovernment?'government-change':'ceasefire';
}

/** Reconcile after explicit player/world changes as well as before every step.
 * No dice rolls or territorial advances occur here. Ended campaigns stay ended. */
export function reconcileWarDynamics(state,lore){
  if(!state.warDynamics)return;
  const data=normalizeState(state),prepared=createTerritoryContext(state,lore),active=new Map(definitions(state,prepared).map(d=>[d.id,d]));
  for(const [id,campaign]of Object.entries(data.campaigns)){
    if(!campaign||!Array.isArray(campaign.unitIds)||!Array.isArray(campaign.actors)){delete data.campaigns[id];continue;}
    if(campaign.status==='active'&&!active.has(id))finishCampaign(state,campaign,prepared);
    // A large explicit transfer must clear old simulated counties immediately,
    // including when the narrative API returned the intervention after stepping.
    for(const unitId of campaign.unitIds){const unit=getGeographyUnit(unitId),patch=state.territoryOverrides[unitId];if(unit&&patch?.source===SOURCE&&explicitPatch(state,unit))delete state.territoryOverrides[unitId];}
  }
}
function startLanding(state,campaign){
  const candidates=['TWN-52511910B49492134849249','TWN-52511910B94458762678017','TWN-52511910B51634678228857'].filter(id=>campaign.unitIds.includes(id)&&state.territoryOverrides[id]?.controllerId!==campaign.invader&&!explicitPatch(state,getGeographyUnit(id)));
  if(!candidates.length)return [];
  const id=candidates[hash(`${state.seed}|${campaign.id}|beach|${campaign.step}`)%candidates.length],actor=campaign.actors.find(a=>a.id===campaign.invader),defender=campaign.actors.find(a=>a.id===campaign.defender);
  if(!actor||!writeOwner(state,campaign,id,actor,{frontline:true,attackerId:defender.id,attackerName:defender.name,...(defender.tag?{attackerTag:defender.tag}:{})}))return [];
  campaign.beachheads=[...new Set([...(campaign.beachheads||[]),id])];campaign.lastLandingStep=campaign.step;
  return [{unitId:id,name:getGeographyUnit(id).name,from:defender.id,to:actor.id,kind:'landing'}];
}
function neighboursOwned(graph,owners,id,owner){return (graph.edges.get(id)||[]).filter(n=>owners.get(n)===owner).length;}
function hostile(campaign,state,a,b){return a!==b&&!factionStopped(state,a)&&!factionStopped(state,b)&&campaign.pairs.includes(pairKey(a,b));}
function frontCandidates(state,campaign,owners){
  const graph=graphFor(campaign.country),candidates=[];
  for(const [id,owner]of owners){
    const unit=graph.map.get(id);if(!unit||explicitPatch(state,unit))continue;
    const rivals=new Set((graph.edges.get(id)||[]).map(n=>owners.get(n)).filter(other=>other&&hostile(campaign,state,owner,other)));
    for(const attacker of rivals)candidates.push({id,owner,attacker,support:neighboursOwned(graph,owners,id,attacker),defence:neighboursOwned(graph,owners,id,owner)});
  }
  return candidates;
}
function actorFor(campaign,id){return campaign.actors.find(a=>a.id===id);}
function settleCompleteCampaign(state,campaign,owners){
  if(campaign.kind==='landing'||!owners.size)return null;
  const present=new Set(owners.values());
  if(campaign.pairs.some(pair=>{const [a,b]=pair.split('|');return present.has(a)&&present.has(b)&&hostile(campaign,state,a,b);}))return null;
  const combatants=new Set(campaign.pairs.flatMap(pair=>pair.split('|'))),winners=[...present].filter(id=>combatants.has(id));
  const winnerId=present.size===1?[...present][0]:winners.length===1?winners[0]:null;if(!winnerId)return null;
  let winner=actorFor(campaign,winnerId);
  if(!winner){const owned=[...owners].find(([,owner])=>owner===winnerId),patch=territorialPatchFor(state,getGeographyUnit(owned[0]));winner=participant(winnerId,patch.controller||patch.ownerName,patch.ownerTag,state);campaign.actors.push(winner);}
  for(const id of campaign.unitIds){const patch=state.territoryOverrides[id];if(patch?.source!==SOURCE||patch.warCampaign!==campaign.id)continue;patch.conflict=null;clearAttack(patch);patch.month=state.month;}
  state.factionConflicts??={};for(const id of combatants)state.factionConflicts[id]=null;
  if(present.size===1){
    const old=state.worldOverrides?.[campaign.region];
    // Existing explicit leadership remains authoritative, even if a force
    // fighting on its behalf has won the last local battle.
    if(!old||old.source===SOURCE){
      state.worldOverrides??={};state.worldOverrides[campaign.region]={leader:winner.leader||winner.name,government:winner.government||`${winner.name}主持的战后政府`,ideology:winner.ideology||null,factionId:winner.id,stage:'reconstruction',conflict:null,month:state.month,source:SOURCE,routeDetached:true};
    }else state.worldOverrides[campaign.region]={...old,conflict:null,stage:'reconstruction',month:state.month};
    state.factionConflicts[campaign.region]=null;
  }
  campaign.status='ended';campaign.endedMonth=state.month;campaign.endedTurn=state.turn;campaign.endReason='territorial-victory';campaign.winnerId=winner.id;campaign.frontlineIds=[];
  return winner;
}
function monthNews(state,campaign,changes,fronts){
  const names=changes.slice(0,4).map(c=>`${c.name}由${actorFor(campaign,c.to)?.name||c.to}控制`);
  const landing=changes.find(c=>c.kind==='landing'),frontNames=[...new Set(fronts.map(f=>getGeographyUnit(f.id)?.name).filter(Boolean))].slice(0,3);
  const title=landing?`${landing.name}海岸发生登陆作战`:changes.length?`${campaign.name}：${getGeographyUnit(changes[0].unitId)?.name||countryName(campaign.country)}一带控制线移动`:`${campaign.name}：${frontNames[0]||countryName(campaign.country)}一带交战持续`;
  const description=landing?`大陆部队在${landing.name}海岸登陆，建立了滩头阵地。台湾守军在附近道路组织反击，周边居民开始撤离交火地带。${frontNames.length?`${frontNames.join('、')}附近的通行受到战斗影响。`:''}`:changes.length?`${names.join('；')}。${changes.length>4?`其他${changes.length-4}处地方的控制也发生了变化。`:''}${frontNames.length?`${frontNames.join('、')}一带仍在交火，运输线路和人员出行随控制线调整。`:'战斗暂时减弱，当地人员开始检查道路和供给。'}`:`${frontNames.join('、')||countryName(campaign.country)}一带出现交火，攻防双方仍守住主要阵地，补给和疏散工作继续进行。`;
  return {id:`war_${campaign.id.replace(/:/g,'_')}_${state.month}_${state.turn}`,title,description,region:campaign.region,category:'war',art:campaign.kind==='landing'?'strait':campaign.region==='japan'?'japan-civil':campaign.region==='taiwan'?'taiwan-civil':'newsroom',source:SOURCE,territoryChanges:changes,frontlineUnitIds:fronts.map(f=>f.id),illustrated:true};
}
function stepCampaign(state,campaign){
  if(campaign.lastStepMonth===state.month&&campaign.lastStepTurn===state.turn)return null;
  campaign.lastStepMonth=state.month;campaign.lastStepTurn=state.turn;
  const heldBeach=campaign.kind==='landing'&&campaign.unitIds.some(id=>territorialPatchFor(state,getGeographyUnit(id)).controllerId===campaign.invader);
  const anotherLanding=campaign.kind==='landing'&&(campaign.step===0||[3,6].includes(campaign.step)||!heldBeach&&campaign.step-(campaign.lastLandingStep??-2)>=2);
  let changes=anotherLanding?startLanding(state,campaign):[];
  const owners=currentOwners(state,campaign),candidates=frontCandidates(state,campaign,owners),graph=graphFor(campaign.country),actors=new Map(campaign.actors.map(a=>[a.id,a]));
  const key=`${campaign.id}|${state.month}|${state.turn}|${campaign.step}`;
  // Each month advances only a bounded subset of existing neighbouring fronts.
  // A captured county cannot become a launch pad until the following month.
  const ranked=candidates.map(c=>({...c,priority:roll(state,`${key}|priority|${c.id}|${c.attacker}`)+c.support*.11-c.defence*.025})).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  const limit=Math.min(campaign.kind==='landing'?9:12,Math.max(1,Math.ceil(campaign.unitIds.length*.012)));
  const changed=new Set(changes.map(c=>c.unitId)),launches=new Set();
  if(!(campaign.kind==='landing'&&campaign.step===0))for(const c of ranked){
    if(changed.size>=limit)break;if(changed.has(c.id)||launches.has(c.id)||!actors.has(c.attacker))continue;
    const origin=(graph.edges.get(c.id)||[]).find(id=>owners.get(id)===c.attacker&&!changed.has(id));
    if(!origin)continue;
    const chance=Math.max(.2,Math.min(.76,.42+(c.support-c.defence)*.055));
    // Two successive quiet months increase pressure on one available front;
    // temporary stalemates remain possible, permanent frozen lines do not.
    if(roll(state,`${key}|result|${c.id}|${c.attacker}`)>chance&&!(campaign.quietMonths>=2&&!changed.size))continue;
    if(!writeOwner(state,campaign,c.id,actors.get(c.attacker)))continue;
    changed.add(c.id);launches.add(origin);changes.push({unitId:c.id,name:graph.map.get(c.id).name,from:c.owner,to:c.attacker,kind:'advance'});
  }
  for(const id of campaign.unitIds){const patch=state.territoryOverrides[id];if(patch?.source===SOURCE&&patch.warCampaign===campaign.id)clearAttack(patch);}
  const after=currentOwners(state,campaign),fronts=frontCandidates(state,campaign,after).map(c=>({...c,priority:roll(state,`${key}|front|${c.id}|${c.attacker}`)+c.support*.08})).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id));
  const selected=[],marked=new Set();
  for(const front of fronts){
    if(selected.length>=Math.max(3,Math.min(24,limit*3)))break;if(marked.has(front.id))continue;
    const patch=state.territoryOverrides[front.id],attacker=actors.get(front.attacker);if(patch?.source!==SOURCE||patch.warCampaign!==campaign.id||!attacker)continue;
    Object.assign(patch,{frontline:true,attackerId:attacker.id,attackerName:attacker.name,month:state.month,...(attacker.tag?{attackerTag:attacker.tag}:{})});marked.add(front.id);selected.push(front);
  }
  campaign.step++;campaign.quietMonths=changes.length?0:campaign.quietMonths+1;campaign.recentChanges=changes;campaign.frontlineIds=selected.map(f=>f.id);
  campaign.controlCounts=Object.fromEntries(campaign.actors.map(a=>[a.id,[...after.values()].filter(id=>id===a.id).length]));
  const winner=settleCompleteCampaign(state,campaign,after);
  if(winner){const report=monthNews(state,campaign,changes,[]);return {...report,title:`${campaign.name}：主要战线停止交火`,description:`${winner.name}控制了交战双方最后争夺的地区，对手失去了当地的连续控制区。主要战线停止交火，居民开始恢复道路通行并核对亲友去向。`,frontlineUnitIds:[]};}
  // No fabricated opposition appears after a side loses every mapped unit.
  // Broader scripted political settlements retain priority over local fighting.
  if(!changes.length&&!selected.length)return null;
  return monthNews(state,campaign,changes,selected);
}

/** Called once on the nextContext clone after public events and before local
 * war exposure. Returns news only; no personal actions or money are consumed.
 * Repeated calls for the same month/turn reconcile peace but never reroll. */
export function advanceWarDynamics(state,lore){
  const data=normalizeState(state);reconcileWarDynamics(state,lore);
  if(state.month<0||state.worldDynamics?.lastingPeace)return [];
  const prepared=createTerritoryContext(state,lore),news=[];
  for(const definition of definitions(state,prepared)){
    let campaign=data.campaigns[definition.id];
    if(campaign?.status==='ended'){
      // Only a new explicit declaration starts another war in the same place.
      const declaration=state.worldOverrides?.[definition.region];
      if(!declaration?.conflict||declaration.month<=campaign.endedMonth)continue;
      campaign=null;
    }
    if(!campaign){campaign=initializeCampaign(state,definition,prepared);if(!campaign)continue;data.campaigns[definition.id]=campaign;}
    const report=stepCampaign(state,campaign);if(report)news.push(report);
  }
  data.lastMonth=state.month;data.lastTurn=state.turn;return news;
}
