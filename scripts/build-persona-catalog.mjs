/** Public Wikidata facts only. Run with Node 22+; --offline rebuilds cached responses. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const CACHE=path.join(ROOT,'.cache/persona-catalog');
const ENDPOINT=process.env.PERSONA_SPARQL_ENDPOINT||'https://qlever.dev/api/wikidata';
const AS_OF='2020-01-01';
const OFFLINE=process.argv.includes('--offline');
const REFRESH=process.argv.includes('--refresh');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const PREFIX=`PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/> PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX p: <http://www.wikidata.org/prop/> PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX psv: <http://www.wikidata.org/prop/statement/value/> PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#> PREFIX schema: <http://schema.org/>\n`;
const REGIONS=[
 {key:'macau',label:'澳门',query:'?s wdt:P19/wdt:P131* wd:Q14773 .',limit:600},
 {key:'hongkong',label:'香港',query:'?s wdt:P19/wdt:P131* wd:Q8646 .',limit:1400},
 {key:'taiwan',label:'中国台湾',query:'?s wdt:P27 wd:Q865 .',limit:2000},
 {key:'japan',label:'日本',query:'?s wdt:P27 wd:Q17 .',limit:3000},
 {key:'china',label:'中国大陆',query:'?s wdt:P27 wd:Q148 .',limit:3000},
];
const LANGS=['zh-hans','zh-cn','zh','zh-hant','zh-tw','zh-hk','ja','en'];
const qid=value=>String(value||'').split('/').at(-1);
const val=(r,key)=>r[key]?.value;
const langFilter=`LANG(?value) IN (${LANGS.map(s=>JSON.stringify(s)).join(',')})`;
const unique=xs=>[...new Set(xs.filter(Boolean))];
const batches=(xs,n)=>Array.from({length:Math.ceil(xs.length/n)},(_,i)=>xs.slice(i*n,i*n+n));
await fs.mkdir(CACHE,{recursive:true});
let sourceIndexDescription=null;
try{
 const statsFile=path.join(CACHE,'source-index.json');
 let stats;
 if(!REFRESH){try{stats=JSON.parse(await fs.readFile(statsFile,'utf8'));}catch{}}
 if(!stats&&!OFFLINE){const response=await fetch(`${ENDPOINT}?cmd=stats`,{signal:AbortSignal.timeout(15000)});if(response.ok){stats=await response.json();await fs.writeFile(statsFile,JSON.stringify(stats));}}
 sourceIndexDescription=stats?.['name-index']||null;
}catch{/* Optional mirror metadata; the source QIDs and queries remain the authority. */}
async function query(name,body){
 const sparql=PREFIX+body,hash=createHash('sha256').update(sparql).digest('hex').slice(0,20);
 const file=path.join(CACHE,`${name}-${hash}.json`);
 await fs.writeFile(file.replace('.json','.sparql'),sparql);
 if(!REFRESH){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(OFFLINE)throw new Error(`Missing cached query: ${name}`);}}
 let error;
 for(let attempt=0;attempt<5;attempt++){
  try{
   if(attempt)await delay(Math.min(60000,10000*2**(attempt-1)));
   const res=await fetch(ENDPOINT,{method:'POST',body:new URLSearchParams({query:sparql}),headers:{Accept:'application/sparql-results+json','User-Agent':'MaoLegacyLife-PublicPersonas/1.0'},signal:AbortSignal.timeout(60000)});
   if(res.status===429){const retryAfter=res.headers.get('retry-after');const numeric=Number(retryAfter);if(retryAfter&&Number.isFinite(numeric)&&numeric>0)await delay(Math.min(60000,numeric*1000));}
   if(!res.ok)throw new Error(`HTTP ${res.status}`);
   const data=await res.json();if(!Array.isArray(data.results?.bindings))throw new Error('Invalid SPARQL result');
   await fs.writeFile(file,JSON.stringify(data));await fs.writeFile(file.replace('.json','.sparql'),sparql);return data;
  }catch(e){error=e;console.log(`${name}: retry ${attempt+1}/5 (${e.message.slice(0,100)})`);}
 }
 throw new Error(`${name}: ${error.message}`);
}
const selected=new Map();
for(const region of REGIONS){
 const result=await query(`select-${region.key}`,`SELECT DISTINCT ?s ?links WHERE {
 ${region.query} ?s wdt:P31 wd:Q5; wdt:P569 ?dob; wdt:P19 ?bp; wikibase:sitelinks ?links .
 FILTER(?dob < "2002-01-01T00:00:00Z"^^xsd:dateTime && ?dob > "1900-01-01T00:00:00Z"^^xsd:dateTime && ?links >= 2)
 FILTER NOT EXISTS {?s wdt:P570 ?death FILTER(?death < "2020-01-01T00:00:00Z"^^xsd:dateTime)}
 } ORDER BY DESC(?links) ?s LIMIT ${region.limit}`);
 for(const row of result.results.bindings){const id=qid(val(row,'s'));if(!selected.has(id))selected.set(id,{qid:id,region:region.key,regionalDefault:region.label,sitelinks:Number(val(row,'links'))});}
 console.log(`${region.label}: ${result.results.bindings.length} selected`);
}
const people=new Map([...selected].map(([id,meta])=>[id,{...meta,labels:[],aliases:[],births:[],birthPlaces:[],occupations:[],articles:[],careerStarts:[]}]));
const factBatches=batches([...people.keys()],1200);
// Keep the last uneven, sparsely described cohort small to reduce public endpoint load.
if(factBatches.at(-1)?.length>300)factBatches.splice(-1,1,...batches(factBatches.at(-1),300));
for(const [i,ids] of factBatches.entries()){
 let factsQuery=`SELECT ?s ?kind ?value ?precision ?start WHERE { VALUES ?s { ${ids.map(id=>`wd:${id}`).join(' ')} }
 { ?s rdfs:label ?value . FILTER(${langFilter}) BIND("label" AS ?kind) }
 UNION { ?s skos:altLabel ?value . FILTER(${langFilter}) BIND("alias" AS ?kind) }
 UNION { ?s p:P569 ?statement . ?statement psv:P569 ?node; wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank) ?node wikibase:timeValue ?value; wikibase:timePrecision ?precision . BIND("birth" AS ?kind) }
 UNION { ?s wdt:P19 ?value . BIND("birthPlace" AS ?kind) }
 UNION { ?s p:P106 ?statement . ?statement ps:P106 ?value; wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank) OPTIONAL {?statement pq:P580 ?start} FILTER(!BOUND(?start) || ?start <= "2020-01-01T00:00:00Z"^^xsd:dateTime) BIND("occupation" AS ?kind) }
 UNION { ?s wdt:P2031 ?value . BIND("careerStart" AS ?kind) }
 UNION { ?value schema:about ?s; schema:isPartOf ?wiki . FILTER(?wiki IN (<https://zh.wikipedia.org/>,<https://ja.wikipedia.org/>)) BIND("article" AS ?kind) }
 }`;
 if(i>=7){const scope=`VALUES ?s { ${ids.map(id=>`wd:${id}`).join(' ')} } `;factsQuery=factsQuery.replace(/WHERE \{ VALUES \?s \{[^}]+\}/,'WHERE {').replace(/\{ \?s /g,`{ ${scope}?s `).replace('UNION { ?value schema:',`UNION { ${scope}?value schema:`);}
 const data=await query(`facts-${i}`,factsQuery);
 for(const r of data.results.bindings){
  const rec=people.get(qid(val(r,'s')));if(!rec)continue;const kind=val(r,'kind'),value=val(r,'value');
  if(kind==='label'||kind==='alias')rec[kind==='label'?'labels':'aliases'].push({value,lang:r.value['xml:lang']||''});
  if(kind==='birth')rec.births.push({value,precision:Number(val(r,'precision'))});
  if(kind==='birthPlace')rec.birthPlaces.push(qid(value));
  if(kind==='occupation')rec.occupations.push({qid:qid(value),start:val(r,'start')||null});
  if(kind==='article')rec.articles.push(value);
  if(kind==='careerStart')rec.careerStarts.push(value.slice(0,10));
 }
 console.log(`Facts ${i+1}/${factBatches.length}`);
}
const entityIds=unique([...people.values()].flatMap(p=>[...p.birthPlaces,...p.occupations.map(o=>o.qid)]));
const labels=new Map();
for(const [i,ids] of batches(entityIds,1200).entries()){
 const result=await query(`labels-${i}`,`SELECT ?s ?value WHERE {VALUES ?s {${ids.map(id=>`wd:${id}`).join(' ')}} ?s rdfs:label ?value . FILTER(${langFilter})}`);
 for(const r of result.results.bindings){const id=qid(val(r,'s'));if(!labels.has(id))labels.set(id,[]);labels.get(id).push({value:val(r,'value'),lang:r.value['xml:lang']||''});}
}
const provinces={Q956:'北京',Q11736:'天津',Q8686:'上海',Q11725:'重庆',Q21208:'河北',Q46913:'山西',Q41079:'内蒙古',Q43934:'辽宁',Q45208:'吉林',Q19206:'黑龙江',Q16963:'江苏',Q16967:'浙江',Q40956:'安徽',Q41705:'福建',Q57052:'江西',Q43407:'山东',Q43684:'河南',Q46862:'湖北',Q45761:'湖南',Q15175:'广东',Q15176:'广西',Q42200:'海南',Q19770:'四川',Q47097:'贵州',Q43194:'云南',Q17269:'西藏',Q47974:'陕西',Q42392:'甘肃',Q45833:'青海',Q57448:'宁夏',Q34800:'新疆',Q8646:'香港',Q14773:'澳门',Q865:'中国台湾',Q17:'日本'};
const regionLabels=await query('region-identities',`SELECT ?s ?value WHERE {VALUES ?s {${Object.keys(provinces).map(id=>`wd:${id}`).join(' ')}} ?s rdfs:label ?value . FILTER(LANG(?value) IN ("zh","zh-hans"))}`);
const simplified=value=>value.replaceAll('東','东').replaceAll('門','门').replaceAll('灣','湾').replaceAll('臺','台').replaceAll('華','华').replaceAll('國','国');
for(const [id,expected] of Object.entries(provinces)){const names=regionLabels.results.bindings.filter(r=>qid(val(r,'s'))===id).map(r=>simplified(val(r,'value')));if(!names.some(n=>n.includes(expected)||(expected==='中国台湾'&&n==='中华民国')))throw new Error(`Region identity mismatch: ${id} ${expected}`);}
const ancestors=new Map();
const birthIds=unique([...people.values()].flatMap(p=>p.birthPlaces));
for(const [i,ids] of batches(birthIds,1000).entries()){
 const result=await query(`places-${i}`,`SELECT DISTINCT ?s ?region WHERE {VALUES ?s {${ids.map(id=>`wd:${id}`).join(' ')}} VALUES ?region {${Object.keys(provinces).map(id=>`wd:${id}`).join(' ')}} {?s wdt:P131* ?region} UNION {?s wdt:P17 ?region}}`);
 for(const r of result.results.bindings){const id=qid(val(r,'s'));if(!ancestors.has(id))ancestors.set(id,[]);ancestors.get(id).push(provinces[qid(val(r,'region'))]);}
}
function bestName(rows,region){const priority=region==='japan'?['zh-hans','zh-cn','zh','zh-hant','zh-tw','ja','en']:LANGS;return [...rows].sort((a,b)=>priority.indexOf(a.lang)-priority.indexOf(b.lang))[0]?.value||'';}
function cleanName(name){return typeof name==='string'&&name.trim().length>=2&&name.length<=60&&!/[\n\r<>]/.test(name)&&!/^Q\d+$/.test(name);}
const occupationGroups=[['政界与公共事务',/政治|政客|外交|军人|軍人|官僚|官员|官員|公务|公務|法官|律师|律師|社会活动|社會運動|工会|工會|politician|military|diplomat|jurist/],['文化演艺与媒体',/演员|演員|歌手|导演|導演|艺人|藝人|音乐|音樂|声优|聲優|作家|诗人|詩人|小说|小說|画家|畫家|艺术|藝術|漫畫|漫画|记者|記者|主持|编剧|編劇|制片|制作|出版|舞|模特|演奏|攝影|摄影|书法|書法|偶像|编辑|編輯|电视|電視|电影|電影|actor|writer|artist|singer|musician/],['科研教育与技术',/学家|學家|科学|科學|研究|教授|教师|教師|教育|工程|学者|學者|医生|醫生|数学|數學|astronaut|scientist|professor|engineer|academic/],['体育与竞技',/运动|運動|球|手|棋|柔道|相扑|相撲|摔跤|空手道|赛艇|賽艇|体操|體操|滑|游泳|田径|田徑|教练|教練|自行车|自行車|athlete|player|wrestler/],['商业与经济',/企业|企業|商人|实业|實業|创业|創業|银行|銀行|投资|投資|business|entrepreneur/]];
const records=[];const excluded={noChineseJapaneseName:0,noDate:0,noBirthPlace:0,futureCareerOnly:0};
for(const p of people.values()){
 const name=bestName(p.labels,p.region);
 if(!cleanName(name)||!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(name)){excluded.noChineseJapaneseName++;continue;}
 const birth=[...p.births].filter(b=>b.precision>=9&&b.value>='1900'&&b.value<'2002').sort((a,b)=>b.precision-a.precision||a.value.localeCompare(b.value))[0];
 if(!birth){excluded.noDate++;continue;}if(!p.birthPlaces.length){excluded.noBirthPlace++;continue;}
 if(p.careerStarts.length&&p.careerStarts.every(date=>date>AS_OF)){excluded.futureCareerOnly++;continue;}
 const precision=birth.precision>=11?'day':birth.precision===10?'month':'year';
 const birthDate=birth.value.replace(/^\+/,'').slice(0,precision==='day'?10:precision==='month'?7:4);
 if((precision!=='year'&&!(Number(birthDate.slice(5,7))>=1&&Number(birthDate.slice(5,7))<=12))||(precision==='day'&&(!Number.isFinite(Date.parse(`${birthDate}T00:00:00Z`))||new Date(`${birthDate}T00:00:00Z`).toISOString().slice(0,10)!==birthDate))){excluded.noDate++;continue;}
 // A source error can put an employer in P19 (e.g. an orchestra). Never turn it into a birthplace.
 const birthPlaceIds=p.birthPlaces.filter(id=>!/交响乐团|交響樂團|管弦乐团|管弦樂團/.test(bestName(labels.get(id)||[],p.region)));
 if(!birthPlaceIds.length){excluded.noBirthPlace++;continue;}
 const birthPlace=unique(birthPlaceIds.map(id=>bestName(labels.get(id)||[],p.region)).filter(Boolean)).join(' / ');
 const geo=unique(birthPlaceIds.flatMap(id=>ancestors.get(id)||[]));
 const special=geo.find(x=>['香港','澳门','中国台湾','日本'].includes(x));
 const province=geo.find(x=>!['香港','澳门','中国台湾','日本'].includes(x));
 const place=special||province||birthPlace||p.regionalDefault;
 const startLocation=p.region==='china'?(province||p.regionalDefault):p.regionalDefault;
 const occupations=unique(p.occupations.map(o=>bestName(labels.get(o.qid)||[],p.region)).filter(Boolean)).slice(0,6);
 const occupation=occupations.join('、')||'公开人物';
 const category=occupationGroups.find(([,re])=>re.test(occupation))?.[0]||'其他公开人物';
 const aliases=unique([...p.labels,...p.aliases].filter(r=>cleanName(r.value)).sort((a,b)=>LANGS.indexOf(a.lang)-LANGS.indexOf(b.lang)).map(r=>r.value)).filter(x=>x!==name&&!/^(?:主席|总统|總統|天皇|皇帝|总理|總理|首相|大哥|哥哥|弟弟|姐姐|妹妹|教授|老师|老師|先生|女士)$/.test(x)).slice(0,24);
 records.push({id:`wikidata-${p.qid}`,qid:p.qid,name,aliases,birthDate,birthDatePrecision:precision,birthPlace:birthPlace||'公开出生地未获得可用中文名称',place,startLocation,occupation,category,
 biography:`${birthDate.slice(0,4)}年出生于${birthPlace||'公开资料所载地区'}。`,
 familyBackground:'未收录可靠的公开家庭资料，家庭成员、家庭资产及私人经历不作推定。',
 sourceUrls:unique([`https://www.wikidata.org/wiki/${p.qid}`,...p.articles]),asOf:AS_OF,
 notes:['出生日期及出生地来自公开结构化资料；资料可能存在遗漏或争议。','职业字段仅表示公开资料中的生涯领域，未核实为2020年当月任职，不得推定具体头衔、已成名程度或后来的事迹。','2020年具体活动地未逐人核实；开局按主要公开关联地区近似，大陆人物在有出生省份时沿用该省份，不能解释为2020年的真实行踪或住址。'],
 coverageRegion:p.region,birthPlaceQids:unique(birthPlaceIds),occupationQids:unique(p.occupations.map(o=>o.qid)),sitelinks:p.sitelinks,
 });
}
records.sort((a,b)=>a.qid.localeCompare(b.qid,undefined,{numeric:true}));
const countBy=key=>records.reduce((out,p)=>(out[p[key]]=(out[p[key]]||0)+1,out),{});
const manifest={asOf:AS_OF,generatedAt:new Date().toISOString(),source:'Wikidata via QLever public query service',endpoint:ENDPOINT,sourceIndexDescription,license:'CC0',schemaVersion:1,selection:{minBirthYear:1900,maxBirthYear:2001,aliveOn:AS_OF,minSitelinks:2,limits:Object.fromEntries(REGIONS.map(r=>[r.key,r.limit])),ranking:'Wikidata cross-language sitelink count, then QID',complete:false},counts:{total:records.length,regions:countBy('coverageRegion'),places:countBy('place'),categories:countBy('category'),birthDatePrecision:countBy('birthDatePrecision'),excluded},personas:records};
await fs.writeFile(path.join(ROOT,'src/data/personas-catalog.json'),JSON.stringify(manifest));
await fs.writeFile(path.join(ROOT,'docs/PERSONA-CATALOG-STATS.json'),JSON.stringify({...manifest,personas:undefined},null,2)+'\n');
console.log(JSON.stringify({...manifest.counts,places:undefined},null,2));
