import {affirmedClauses} from './agency.js';
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number(v)||0));
const gearNames=['步枪','冲锋枪','霰弹枪','机枪','手枪','消防斧','斧头','撬棍','长矛','砍刀','菜刀','匕首','铁棍','棒球棍','木棍','盾牌','防咬服','防护服','防弹衣','装甲','外骨骼','重甲','头盔','护具','皮夹克'];
const gearIn=text=>gearNames.filter(name=>text.includes(name));
const immuneIn=text=>!/(?:不|并非|尚未|未能|失去).{0,5}免疫|不能免疫|可能免疫|希望免疫|研究免疫/.test(text)&&/(?:完全免疫|免疫体质|(?:对|抵抗|拥有|获得|具备|已经).{0,14}(?:丧尸|病毒|感染).{0,8}免疫|免疫.{0,8}(?:丧尸|病毒|感染)|不会感染丧尸病毒)/.test(text);
function personalClauses(text){
  return String(text||'').split(/[。！？；;\n]/).flatMap(sentence=>{
    let otherPerson=/(?:父亲|母亲|家人|朋友|邻居|同事)/.test(sentence)&&!/(?:我|本人|自己)/.test(sentence);
    return affirmedClauses(sentence).filter(clause=>{
      if(/^(?:我(?!的|父亲|母亲|家人|朋友|邻居|同事)|本人(?!的)|自己(?!的))/.test(clause))otherPerson=false;
      else if(/(?:父亲|母亲|家人|朋友|邻居|同事)/.test(clause))otherPerson=true;
      return !otherPerson;
    });
  });
}
function ammunitionIn(text){
  // A firearm may appear between the ownership verb and its explicit ammunition.
  const match=text.match(/(?:补充|装填|买到|携带|获得|还有|配备|持有|拥有|备有|带着|有)(?:了)?[^，,。！？；;\n]{0,32}?(\d{1,6})\s*发(?:子弹|弹药)|(?:补充|装填|买到|携带|获得|还有|配备|有)(?:了)?\s*(\d{1,6})\s*发|(?:子弹|弹药)(?:为|有|共|剩余)?\s*(\d{1,6})\s*发?/);
  return match?clamp(match[1]??match[2]??match[3],0,120):null;
}

export function initializeEncounterState(state){
  if(state.encounterState)return;
  const own=personalClauses(state.profile?.backgroundText||'').join('，');
  const equipment=gearIn(own),ammo=ammunitionIn(own);
  state.encounterState={infected:false,immune:immuneIn(own),equipment,ammo:ammo??(/枪/.test(equipment.join(''))?24:0)};
}

/** Preview declarations before an encounter, without committing money, time, or history. */
export function prepareEncounterState(state,action,success=true){
  const next=structuredClone(state);initializeEncounterState(next);
  if(!success||action?.passive||!action?.custom)return next;
  const clauses=personalClauses(action.label),body=next.encounterState;
  for(const clause of clauses){
    if(/(?:希望|研究|寻找|尝试|计划|准备|想要).{0,10}(?:免疫|治愈)/.test(clause))continue;
    if(/(?:我|身体|本人).{0,12}(?:失去|不再具有|不再拥有).{0,8}免疫/.test(clause))body.immune=false;
    else if(immuneIn(clause)){body.immune=true;body.infected=false;delete body.infectionTurn;}
    if(/(?:已经|成功|彻底|完全)?(?:治愈|清除|消除|解除).{0,12}(?:感染|丧尸病毒)|感染已经痊愈/.test(clause)){body.infected=false;delete body.infectionTurn;}
    if(/(?:获得|买到|购买|拿起|拿到|捡到|带上|携带|装备|穿上|穿着|持有|手持|配备|拥有|背着)/.test(clause)){
      const additions=gearIn(clause),hadGun=/枪/.test(body.equipment?.join('')||'');
      body.equipment=[...new Set([...(Array.isArray(body.equipment)?body.equipment:[]),...additions])].slice(-24);
      if(!hadGun&&/枪/.test(additions.join(''))&&!/空枪|没有子弹|无弹药/.test(clause))body.ammo=Math.max(body.ammo||0,24);
    }
    const ammunition=ammunitionIn(clause);
    if(ammunition!==null)body.ammo=ammunition;
    if(/(?:丢弃|放下|遗失|交出|脱下)/.test(clause)){body.equipment=(body.equipment||[]).filter(name=>!clause.includes(name));if(!/枪/.test(body.equipment.join('')))body.ammo=0;}
  }
  return next;
}

export function infectionEffect(previous,next){
  const body=next.encounterState||{};
  if(!body.infected||body.immune||!previous.encounterState?.infected)return {delta:{},summary:''};
  return {delta:{health:-3,stress:2},summary:'伤口的感染还没有消退，发热和乏力影响了日常活动，你需要继续处理伤势。'};
}

export function validateEncounterState(state){
  const body=state.encounterState;if(!body)return;
  if(typeof body!=='object'||typeof body.infected!=='boolean'||typeof body.immune!=='boolean'||!Number.isInteger(body.ammo)||body.ammo<0||body.ammo>120||!Array.isArray(body.equipment)||body.equipment.length>24||body.equipment.some(x=>typeof x!=='string'||x.length>60)||body.infectionTurn!==undefined&&(!Number.isInteger(body.infectionTurn)||body.infectionTurn<0||body.infectionTurn>state.turn))throw new Error('这份档案的伤势与装备记录不完整。');
  if(body.lastEncounterId!==undefined&&(typeof body.lastEncounterId!=='string'||body.lastEncounterId.length>100))throw new Error('这份档案的遭遇记录不完整。');
}
