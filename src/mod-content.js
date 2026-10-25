// The complete MOD index is an authoring/audit artifact, not a browser dependency.
// Runtime retrieval is intentionally confined to the published, source-bound stage.
import newsData from './data/news.json' with {type:'json'};
const REGIONS={PRC:'china',NCR:'china',SHC:'china',JAP:'japan',TSU:'japan',CHI:'taiwan',TZL:'taiwan',TCH:'taiwan',SOV:'europe',GER:'europe'};
function tidy(text){return String(text||'').replace(/§./g,'').replace(/\\n/g,'\n').replace(/\[\[[^\]]*\]\]/g,'').trim();}
function references(stage){return (stage.sourceRefs||[]).filter(r=>typeof r.file==='string'&&typeof r.key==='string').map(r=>({file:r.file,key:r.key}));}
function newsRegion(event){return event.region||(event.places?.includes('日本')?'japan':event.places?.some(p=>p.includes('台湾'))?'taiwan':event.places?.length?'china':'global');}

/**
 * Return small source-bound excerpts from facts already public in this life.
 * Raw source paragraphs and linked targets are NOT automatically safe: a MOD
 * event description may contain mutually exclusive choices or future outcomes.
 * Authors may supply modContext as a vetted excerpt; otherwise the published
 * localisation adaptation is used. No hidden branch synopsis is returned.
 */
export function getModContext(state,lore,{region,tags=[],query='',limit=6}={}){
  if(!state||!lore||!Number.isInteger(state.month))return [];
  const selected=new Set(Object.values(state.routes||{}));
  const stages=new Map();
  for(const e of lore.worldEvents||[])if(!e.routeIds?.length||e.routeIds.some(id=>selected.has(id)))stages.set(e.id,{...e,region:e.region||'global'});
  for(const e of lore.regionalStories||[])if(!e.routeIds?.length||e.routeIds.some(id=>selected.has(id)))stages.set(e.id,{...e,region:e.region||'global'});
  for(const r of lore.routes||[])if(selected.has(r.id))for(const e of r.milestones||[])stages.set(e.id,{...e,region:r.region});
  for(const e of newsData.events||[])if(!e.routeIds?.length||e.routeIds.some(id=>selected.has(id)))stages.set(e.id,{...e,region:newsRegion(e)});
  const history=new Map();
  for(const e of state.newsHistory||[])if(Number.isInteger(e.month)&&e.month<=state.month)history.set(e.id,e);
  for(const e of state.current?.news||[])if((e.month??state.month)<=state.month)history.set(e.id,e);
  // Only authored definitions authorize source excerpts. Imported save records
  // supply publication dates but cannot add new source bindings.
  const done=new Set([...(state.seenEvents||[]),...(state.seenNews||[]),...history.keys()]);
  const wanted=new Set([region,...tags.map(t=>REGIONS[t])].filter(Boolean));
  const terms=String(query).toLowerCase().split(/[\s，。；、,.!?！？]+/).filter(t=>t.length>1).slice(0,12);
  const candidates=[];
  for(const [id,stage]of stages){
    if(!done.has(id))continue;
    if((stage.requires||[]).some(id=>!done.has(id)))continue;
    const eventMonth=history.get(id)?.month??state.eventMonths?.[id];
    if(!Number.isInteger(eventMonth)||eventMonth>state.month)continue;
    const refs=references(stage);if(!refs.length)continue;
    const publicText=stage.description;
    const text=tidy(stage.modContext||publicText).slice(0,1200);if(!text)continue;
    const score=(wanted.has(stage.region)?40:stage.region==='global'?10:0)+Math.max(0,30-(state.month-eventMonth))+terms.reduce((n,t)=>n+(text.toLowerCase().includes(t)||stage.title.toLowerCase().includes(t)?8:0),0);
    candidates.push({score,value:{stageId:id,title:stage.title,month:eventMonth,text,textKind:stage.modContext?'vetted-localisation-excerpt':'published-localisation-adaptation',sourceRefs:refs,relatedIds:(stage.requires||[]).filter(x=>done.has(x))}});
  }
  return candidates.sort((a,b)=>b.score-a.score||b.value.month-a.value.month||a.value.stageId.localeCompare(b.value.stageId)).slice(0,Math.max(0,Math.min(12,Number.isFinite(limit)?Math.floor(limit):6))).map(x=>x.value);
}
