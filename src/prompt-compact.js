// A request-only projection. Never remove facts from a save or mutate the common
// prompt/validation context: narration retries must describe the same month.
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const nonempty=value=>Array.isArray(value)&&value.length>0;

function compactRelationships(graph,query){
  if(!graph?.nodes?.length)return graph;
  const mentioned=new Set(graph.nodes.filter(n=>n.id==='player'||n.name&&query.includes(n.name)).map(n=>n.id));
  const closeTies=new Set(graph.edges.filter(e=>e.source==='player'||e.target==='player').sort((a,b)=>Number(b.strength||0)-Number(a.strength||0)).slice(0,8).flatMap(e=>[e.source,e.target]));
  // Keep everyone named by the action/current thread, recent contacts, and their
  // direct ties. Omitted contacts stay in the save and return when mentioned.
  const nodes=graph.nodes.filter((n,i)=>i<24||mentioned.has(n.id)||closeTies.has(n.id));
  const ids=new Set(nodes.map(n=>n.id));
  const edges=graph.edges.filter(e=>ids.has(e.source)&&ids.has(e.target))
    .sort((a,b)=>Number(mentioned.has(b.source)||mentioned.has(b.target))-Number(mentioned.has(a.source)||mentioned.has(a.target))||Number(b.strength||0)-Number(a.strength||0))
    .slice(0,96);
  return {version:graph.version,nodes:nodes.map(({id,name,personaId,detail})=>({id,name,...(personaId?{personaId}:{}),...(detail?{detail}:{})})),edges:edges.map(({source,target,status,detail,strength,kind})=>({source,target,status,detail,strength,kind})),omittedPeople:(graph.omittedPeople||0)+graph.nodes.length-nodes.length};
}

/** Omit inactive rule branches and exact duplicates, keeping all current facts. */
export function compactNarrativePrompt(prompt){
  const data=JSON.parse(prompt.user),continuation=data.continuation||{};
  const query=[data.action?.label,continuation.thread,continuation.previousAction,...(data.currentIdentity?.projects||[])].join(' ');
  data.relationshipGraph=compactRelationships(data.relationshipGraph,query);
  if(data.currentPersonalEvent?.narrative===continuation.previousNarrative)delete data.currentPersonalEvent.narrative;
  if(continuation.action===data.action?.label)delete continuation.action;
  if(equal(continuation.encounterState,data.encounterState))delete continuation.encounterState;
  if(equal(continuation.encounter,data.actionOutcome?.encounterGame))delete continuation.encounter;
  if(continuation.encounterSummary===data.actionOutcome?.encounterSummary)delete continuation.encounterSummary;
  const hasEncounter=!!(data.specialLife||data.actionOutcome?.encounterGame||data.encounterState?.infected||continuation.fishHarvest);
  const system=prompt.system.split('\n').flatMap(line=>{
    if(line.startsWith('currentIdentity.deceased存在时')&&!data.currentIdentity?.deceased)return [];
    if(line.startsWith('continuation.fishHarvest若存在')&&!hasEncounter)return ['encounterState中的现有装备、伤势、消耗品和免疫状态继续有效；不能自行治愈、补回消耗品或重复结算工资。'];
    if(line.startsWith('newsTranslations只翻译')&&(data.language==='zh-CN'||!data.news?.length))return ['newsTranslations固定为[]，本次无需另写新闻译文。'];
    if(line.startsWith('worldUpdates可选')&&!data.canSuggestWorldUpdates)return ['worldUpdates固定为[]。本人的生活不能擅自改变世界事实或让战争重新开始。'];
    if(line.startsWith('culture.matches用于')&&!nonempty(data.culture?.matches)&&!nonempty(data.culture?.anachronisms))return ['不强塞网络梗，也不把尚未流行的说法写成当时已有的热梗。'];
    if(line.startsWith('decision=false时')&&!data.decision)return ['decision=false，options必须是空数组[]，无需制造待决定的悬念。'];
    return [line];
  }).join('\n');
  const concise='先按actionDate和action.label写consequence：必须包括本人这次实际做的事，不能把约定在下个月做的事情提前当成本次行动结果。narrative才写targetDate的后续。只返回所需的最小完整JSON：personUpdate只写确实改变的字段，未变时{}；memory只写新增长期事实，无则空字符串；没有新关系时relationshipUpdates为[]。不要复述输入资料，不另写分析或解释。';
  return {...prompt,system:system+'\n'+concise,user:JSON.stringify(data)};
}
