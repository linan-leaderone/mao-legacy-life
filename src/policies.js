import data from './data/policies.json' with {type:'json'};
import {politicalActorContext,politicalNewsArt} from './political-actors.js';
const PLACES={china:'中国大陆',taiwan:'中国台湾',japan:'日本'};
const hash=text=>{let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
export const POLICY_CATALOG=data.policies;
const records=state=>[...(state.newsHistory||[]),...(state.policyHistory||[])].filter(e=>Number.isInteger(e.month)&&e.month<=state.month);
/** Pure, stable and limited: a region needs 4 months between policies; world needs 2. */
export function eligibleMonthlyPolicies(state,lore){
  if(!Number.isInteger(state.month)||state.month<2)return [];
  const history=records(state),past=history.filter(e=>e.source==='focus_policy'||e.id?.startsWith('policy_')),done=new Set(history.map(e=>e.id));
  if(past.some(e=>state.month-e.month<2))return [];
  const contexts=Object.fromEntries(Object.keys(PLACES).map(region=>[region,politicalActorContext(state,region,lore)]));
  return data.policies.filter(policy=>{
    const context=contexts[policy.region];
    if(!context?.government||context.region!==policy.region||done.has(policy.id)||!policy.factions.includes(context.factionId)||state.month<policy.minMonth)return false;
    if(/_fragmented$/.test(context.factionId||''))return false;
    if(past.some(e=>e.region===policy.region&&state.month-e.month<4))return false;
    if((policy.requiresPolicies||[]).some(id=>!done.has(`policy_${id}`)))return false;
    if(policy.exclusiveGroup&&past.some(e=>data.policies.find(p=>p.id===e.id)?.exclusiveGroup===policy.exclusiveGroup))return false;
    if((policy.sourceExclusions||[]).some(id=>done.has(`policy_${id}`)))return false;
    if(policy.war&&!context.conflict&&!context.regionalConflict)return false;
    if(!policy.war&&context.stage==='civil_war')return false;
    const lastChange=Math.max(0,...(context.knownChanges||[]).map(e=>e.month),state.worldOverrides?.[policy.region]?.month||0);
    return state.month-lastChange>=policy.settleMonths;
  }).map(e=>({...structuredClone(e),issuingAuthority:{region:e.region,factionId:contexts[e.region].factionId,government:contexts[e.region].government}}));
}
export function selectMonthlyPolicies(state,lore){
  const pool=eligibleMonthlyPolicies(state,lore);
  // Most months carry no policy announcement. Reading the world view never rolls again.
  if(!pool.length||hash(`${state.seed}:policy-month:${state.month}`)%100>=46)return [];
  const selected=pool[hash(`${state.seed}:policy-choice:${state.month}`)%pool.length];
  return [{...selected,month:state.month,kind:'world',source:'focus_policy',art:politicalNewsArt({...selected,authority:'government'})}];
}
export function enactedPolicyContext(state){
  const history=records(state),done=new Map(history.map(e=>[e.id,e]));
  return data.policies.filter(e=>done.has(e.id)).map(e=>({id:e.id,region:e.region,title:e.title,description:e.description,month:done.get(e.id).month,sourceRefs:e.sourceRefs})).sort((a,b)=>b.month-a.month).slice(0,8);
}
