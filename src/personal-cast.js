import {findPersona} from './personas.js';
const kokoroName=/弦[卷巻]心|弦巻\s*こころ|(?:Tsurumaki\s+Kokoro|Kokoro\s+Tsurumaki)/i;
export function explicitCastContext(state,action){
  const persona=findPersona('tsurumaki_kokoro');
  if(!persona)return {characters:[],allowKokoro:false};
  const allowed=state.profile?.lockedPersonaId===persona.id||kokoroName.test(`${action?.label||''} ${state.profile?.backgroundText||''}`)||(state.relationshipGraph?.nodes||[]).some(n=>n.personaId===persona.id||kokoroName.test(n.name));
  if(!allowed)return {characters:[],allowKokoro:false};
  return {allowKokoro:true,characters:[{id:persona.id,name:persona.name,occupation:persona.occupation,status:persona.status,background:persona.backgroundText,family:persona.familyBackground,personality:persona.personality||persona.notes?.slice(0,3),relationships:persona.relationships,politicalPosition:persona.modPolitics?.ideology||'尚无明确政治纲领',instruction:'只采用她当前的校园、家庭与乐队身份。家族资源雄厚不等于本人已经统治日本；未发生的革命、胜选和科技政策不提前出现。'}]};
}
export function permittedCastExcerpts(excerpts,context){return context.allowKokoro?excerpts:excerpts.filter(item=>!kokoroName.test(`${item.title||''} ${item.text||''}`));}
export function uninvitedHiddenCharacter(response,context){return context?.allowKokoro===false&&kokoroName.test([response.title,response.narrative,response.consequence,response.memory,...(Array.isArray(response.relationshipUpdates)?response.relationshipUpdates:[]).map(r=>r?.target)].join(' '));}
