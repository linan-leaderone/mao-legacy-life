import {affirmedClauses} from './agency.js';
import {resolveTerritoryTargets,getGeographyUnit} from './world-territories.js';
const namedFactions=[['台湾左翼联盟','taiwan_left'],['左翼联盟','taiwan_left'],['民进党','taiwan_dpp'],['国民党','taiwan_kmt'],['基进党','taiwan_revanchist'],['羽泽鸫','japan_left'],['丰川祥子','japan_toyokawa']];
export function territoryActionChanges(state,action){
  if(!action?.custom||action.passive)return [];
  const changes=[];
  for(const clause of affirmedClauses(action.label)){
    if(/(?:不|未|没|不会|并未|没有|无法|还没)(?:会|能|要|再)?(?:占领|夺取|收复|攻占|接管|实际控制|交战|开战|开火|停火)/.test(clause)||/(?:计划|打算|准备|试图|尝试|想要|希望|争取|可能|假如|如果).{0,35}(?:占领|夺取|收复|攻占|接管|实际控制|交战|开战|开火|停火)/.test(clause))continue;
    const takeover=/(?:占领|夺取|收复|攻占|接管|实际控制)/.test(clause),battle=/交战|激战|战斗正在|开战|开火/.test(clause),peace=/停火|停止交火|结束.{0,12}战斗/.test(clause);
    if(!takeover&&!battle&&!peace)continue;
    const verb=clause.search(/占领|夺取|收复|攻占|接管|实际控制/),subject=verb>=0?clause.slice(0,verb):clause;
    const faction=namedFactions.find(([name])=>subject.includes(name));
    const custom=subject.match(/(?:我率领|我带领|我帮助|协助|帮助)([^，。]{2,24}?)(?:部队|军队|势力)?$/)?.[1];
    const controller=faction?.[0]||custom||state.person?.faction||state.profile.identity?.nationality||state.profile.name;
    const controllerId=faction?.[1]||(controller===state.profile.name?'player:'+state.id:controller);
    const targetText=takeover?clause.slice(verb):clause;
    for(const unit of resolveTerritoryTargets(targetText))changes.push({unitId:unit.id,name:unit.name,region:unit.region,patch:{...(takeover?{controller,controllerId}:{}),...(peace?{conflict:null,frontline:false}:battle?{conflict:`${unit.name}交战`,frontline:true}:{}),month:state.month,source:'personal_action'}});
  }
  return changes.slice(0,32);
}
export function validateTerritorialState(state){
  const overrides=state.territoryOverrides??{},conflicts=state.factionConflicts??{};
  if(!overrides||typeof overrides!=='object'||Array.isArray(overrides)||Object.keys(overrides).length>12000||!conflicts||typeof conflicts!=='object'||Array.isArray(conflicts)||Object.keys(conflicts).length>1000)throw new Error('这份档案的地区控制记录不完整。');
  for(const [id,row]of Object.entries(overrides)){
    if(!getGeographyUnit(id)&&!/^region:(china|taiwan|japan|hongkong|macau|korea|global)$/.test(id))throw new Error('这份档案包含无法辨认的地区。');
    if(!row||typeof row!=='object'||!Number.isInteger(row.month)||row.month>state.month||['controller','controllerId','source'].some(k=>row[k]!==undefined&&(typeof row[k]!=='string'||row[k].length>200))||row.conflict!==undefined&&row.conflict!==null&&(typeof row.conflict!=='string'||row.conflict.length>200)||row.frontline!==undefined&&typeof row.frontline!=='boolean')throw new Error('这份档案的领土变更记录不完整。');
  }
  if(Object.entries(conflicts).some(([id,value])=>id.length>200||value!==null&&(typeof value!=='string'||value.length>200)))throw new Error('这份档案的参战记录不完整。');
  state.territoryOverrides=overrides;state.factionConflicts=conflicts;
}
