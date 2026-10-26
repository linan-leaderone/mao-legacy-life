// Relationship preferences describe the protagonist, never another person's consent.
const minor = /未成年|儿童|幼儿|小学生|中学生|初中生|高中生|萝莉|正太|underage|minor\b|child(?:ren)?\b|(?:^|[^\d])(?:[0-9]|1[0-7])\s*(?:岁|years? old)/i;
const coercion = /强迫|强奸|迷奸|下药|催眠|信息素|控制.{0,8}(?:意志|意识|身体)|违背.{0,6}意愿|不情愿|拒绝|昏迷|趁.{0,8}(?:喝醉|睡着)|rape|coerc|drugged|unconscious/i;
export function adultRelationshipsAllowed(state,ageMonths){
  const body=state.specialLife;
  return Number.isFinite(ageMonths)&&ageMonths>=216&&(!body||(body.body==='human'&&Number.isFinite(body.bodyAge)&&body.bodyAge>=18));
}
export function relationshipBehaviorDelta(state,text,{ageMonths,nextAgeMonths=ageMonths}={}){
  if(!adultRelationshipsAllowed(state,ageMonths)||!adultRelationshipsAllowed(state,nextAgeMonths)||minor.test(text)||coercion.test(text))return 0;
  if(/(?:决定|选择|保持|回归|开始|坚持|承诺).{0,10}(?:专一|忠于伴侣|禁欲|停止约会|结束开放关系)/.test(text))return -2;
  if(/(?:开放式|非专一|多伴侣).{0,8}(?:关系|恋爱)|(?:双方|彼此|所有人).{0,8}(?:自愿|同意).{0,20}(?:交往|亲密|约会|伴侣)/.test(text))return 3;
  if(/(?:开始|建立|发展|保持|确认|结成).{0,10}(?:恋爱|伴侣|亲密)关系|(?:双方|彼此).{0,8}(?:自愿|同意).{0,12}(?:相恋|交往)|(?:我与|我和|与|和).{1,16}(?:相恋|成为恋人|成为伴侣)/.test(text))return 2;
  if(/(?:我|双方|我们).{0,18}(?:约会|相亲)|(?:接受|赴|参加).{0,8}(?:约会|相亲)|(?:与|和).{1,16}约会/.test(text))return 1;
  return 0;
}
const hash=value=>{let n=2166136261;for(const c of value)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
export const relationshipEncounterChance=value=>Math.min(.55,.015+Math.max(0,Math.min(100,Number(value)||0))*.005);
export function personalRelationshipOpportunity(state,ageMonths){
  if(!adultRelationshipsAllowed(state,ageMonths)||state.person?.custody||state.person?.deceased)return null;
  if((state.history||[]).slice(-2).some(h=>h.event?.personalOpportunity))return null;
  if(hash(`${state.seed}:adult-opportunity:${state.turn}`)/4294967296>=relationshipEncounterChance(state.stats?.promiscuity))return null;
  const items=[
    {id:'adult_date',title:'一次约见',description:'一位明确成年的熟人向你提出约会邀请，询问你是否有空。见面与后续交往都等你们各自确认。',options:['接受成年熟人的约会邀请，先互相了解','说明自己希望保持普通朋友关系']},
    {id:'adult_boundaries',title:'谈清彼此的期待',description:'一位成年朋友想与你谈谈交往的期待，也愿意听你的想法。你可以提出自己的边界，或者暂时不谈这件事。',options:['与成年朋友讨论双方自愿的交往方式','暂时保持现有关系，专心处理自己的事情']},
    {id:'adult_social',title:'朋友安排的见面',description:'朋友邀请几位成年人聚餐，问你愿不愿意参加。有人希望认识新的恋爱对象，所有人都可以只作普通交流。',options:['参加聚餐，认识新的成年朋友','婉拒邀请，保留自己的安排']}
  ];
  return {...items[hash(`${state.seed}:adult-kind:${state.turn}`)%items.length],month:state.month};
}
export const unsafeIntimacyContext=text=>minor.test(String(text||''))||coercion.test(String(text||''));
