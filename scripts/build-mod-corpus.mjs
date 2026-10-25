import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Read-only toward the MOD. All generated output is confined to this project.
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const root=path.resolve(process.argv.find(a=>a.startsWith('--mod='))?.slice(6)||path.join(project,'../TFR-xinzuo-rebuild'));
const scriptDirs={events:'event', 'common/national_focus':'focus', 'common/decisions':'decision', 'common/scripted_effects':'effect', 'common/scripted_triggers':'trigger', 'common/on_actions':'on_action'};
const eastTags=new Set(['PRC','JAP','TSU','CHI','TZL','TCH','TAI','TWN','ROC','NCR','SHC','PRA','PRM','RPC','KOR','KPA','TAK','TCR']);
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(x=>x.isDirectory()?walk(path.join(dir,x.name)):[path.join(dir,x.name)]):[];
const relative=p=>path.relative(root,p).split(path.sep).join('/');
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const files=[],entities=[],localisations=[],warnings=[],duplicates=[];
const locText=new Map(),locByKey=new Map(),entityKeys=new Map();
function recordFile(p,kind){const buffer=fs.readFileSync(p),text=buffer.toString('utf8').replace(/^\uFEFF/,'');const id=files.length;files.push({path:relative(p),kind,bytes:buffer.length,lines:text.split('\n').length,sha256:hash(buffer)});return {id,text};}
function tokenize(text,file){
  const tokens=[];let pos=0,line=1;
  while(pos<text.length){const c=text[pos];if(/\s/.test(c)){if(c==='\n')line++;pos++;continue;}if(c==='#'){while(pos<text.length&&text[pos]!=='\n')pos++;continue;}
    const start=line;if('{}='.includes(c)){tokens.push({text:c,line:start});pos++;continue;}
    if(/[<>!?]/.test(c)&&text[pos+1]==='='){tokens.push({text:c+'=',line:start});pos+=2;continue;}
    if(/[<>]/.test(c)){tokens.push({text:c,line:start});pos++;continue;}
    if(c==='"'){pos++;let value='',closed=false;while(pos<text.length){const ch=text[pos++];if(ch==='\n')line++;if(ch==='"'){closed=true;break;}if(ch==='\\'&&pos<text.length){value+=ch+text[pos++];}else value+=ch;}if(!closed)warnings.push({file,line:start,kind:'unterminated-string'});tokens.push({text:value,line:start,quoted:true});continue;}
    let value='';while(pos<text.length&&!/[\s{}=<>!?"#]/.test(text[pos]))value+=text[pos++];if(!value)value=text[pos++];tokens.push({text:value,line:start});
  }return tokens;
}
function parse(tokens,file){let i=0;function body(nested=false){const nodes=[];while(i<tokens.length){const key=tokens[i++];if(key.text==='}'){if(!nested)warnings.push({file,line:key.line,kind:'unmatched-closing-brace'});return nodes;}if(key.text==='{'){nodes.push({key:null,value:body(true),line:key.line});continue;}
      const op=tokens[i]?.text;if(['=','?=','==','!=','>','<','>=','<='].includes(op)){i++;const next=tokens[i++];if(!next){warnings.push({file,line:key.line,kind:'missing-value'});break;}nodes.push({key:key.text,op,value:next.text==='{'?body(true):next.text,line:key.line});}else nodes.push({key:null,value:key.text,line:key.line});}
    if(nested)warnings.push({file,line:tokens.at(-1)?.line||1,kind:'unclosed-block'});return nodes;}return body();}
const scalar=(nodes,key)=>nodes.find(n=>n.key===key&&typeof n.value==='string')?.value;
const blocks=(nodes,key)=>nodes.filter(n=>n.key===key&&Array.isArray(n.value));
function flatten(nodes,ancestors=[]){return nodes.flatMap(n=>[{...n,ancestors},...(Array.isArray(n.value)?flatten(n.value,[...ancestors,n.key].filter(Boolean)):[])]);}
function brief(nodes){return nodes.map(n=>Array.isArray(n.value)?`${n.key??''} { ${brief(n.value)} }`:n.key?`${n.key} ${n.op} ${n.value}`:n.value).join(' ');}
function add(kind,id,node,file,parent=null){if(!id)return;const flat=flatten(node.value),all=flat.map(n=>n.key+' '+(typeof n.value==='string'?n.value:'')).join(' ');const tags=[...new Set([...((all+' '+id).matchAll(/(?:^|[^A-Z])([A-Z]{3})(?=$|[^A-Z])/g))].map(m=>m[1]))].filter(t=>eastTags.has(t)||['USA','SOV','GER','FRA','ENG'].includes(t));
  const e={kind,id,file,line:node.line,parent,tags,loc:[],links:[],conditions:[],flags:[],dynamic:[]};
  for(const n of flat){
    if(['title','desc','name'].includes(n.key)&&typeof n.value==='string'&&!/[\s\[\]]/.test(n.value))e.loc.push(n.value);
    if(['trigger','potential','allowed','available','visible','bypass','prerequisite','mutually_exclusive','cancel_trigger','remove_trigger'].includes(n.key)&&Array.isArray(n.value)&&n.ancestors.length<=2)e.conditions.push({kind:n.key,line:n.line,text:brief(n.value)});
    if(['country_event','news_event','state_event','unit_leader_event'].includes(n.key)&&Array.isArray(n.value)){const target=scalar(n.value,'id');if(target)e.links.push({type:'event_call',targetKind:'event',target,line:n.line,scope:n.ancestors.join('/'),delay:scalar(n.value,'days')||scalar(n.value,'hours')||null});}
    if(typeof n.value==='string'){
      if(n.key==='focus'&&(n.ancestors.includes('prerequisite')||n.ancestors.includes('mutually_exclusive')))e.links.push({type:n.ancestors.includes('mutually_exclusive')?'exclusive':'prerequisite',targetKind:'focus',target:n.value,line:n.line});
      if(['has_completed_focus','complete_national_focus'].includes(n.key))e.links.push({type:n.key==='has_completed_focus'?'focus_condition':'focus_complete',targetKind:'focus',target:n.value,line:n.line});
      if(['activate_mission','remove_decision','unlock_decision'].includes(n.key))e.links.push({type:n.key,targetKind:'decision',target:n.value,line:n.line});
      if(/^(set|has|clr)_(country|global|state)_flag$/.test(n.key))e.flags.push({operation:n.key,value:n.value,line:n.line});
      if(n.key?.startsWith('has_')||n.key?.startsWith('add_')||n.key?.startsWith('set_')){if(/[\[\]@$]/.test(n.value))e.dynamic.push({key:n.key,value:n.value,line:n.line});}
    }
  }
  if(['focus','decision','effect','trigger'].includes(kind))e.loc.push(id,id+'_desc');
  e.loc=[...new Set(e.loc)];e.eastAsia=tags.some(t=>eastTags.has(t));e._flat=flat;entities.push(e);const identity=kind+':'+id;if(entityKeys.has(identity))duplicates.push({kind,id,files:[entityKeys.get(identity).file,file]});else entityKeys.set(identity,e);
}
const categoryMetadata=new Set(['icon','allowed','visible','available','potential','priority','picture','custom_icon','on_map_area','on_map_mode','map_area','highlight_states','visible_when_empty','sound','scripted_gui','default','cancel_trigger','remove_trigger']);
for(const [dir,kind] of Object.entries(scriptDirs))for(const p of walk(path.join(root,dir)).filter(p=>p.endsWith('.txt'))){const {id:file,text}=recordFile(p,kind),ast=parse(tokenize(text,file),file);
  if(kind==='event')for(const n of ast)if(['country_event','news_event','state_event','unit_leader_event'].includes(n.key)&&Array.isArray(n.value))add('event',scalar(n.value,'id'),n,file);
  if(kind==='focus')for(const n of ast){if(n.key==='focus_tree'&&Array.isArray(n.value)){const tree=scalar(n.value,'id');add('focus_tree',tree,n,file);for(const f of n.value)if(['focus','continuous_focus'].includes(f.key)&&Array.isArray(f.value))add('focus',scalar(f.value,'id'),f,file,tree);}else if(n.key==='shared_focus'&&Array.isArray(n.value))add('focus',scalar(n.value,'id'),n,file,'shared');}
  if(kind==='decision')for(const n of ast)if(n.key&&Array.isArray(n.value)){add('decision_category',n.key,n,file);for(const d of n.value)if(d.key&&Array.isArray(d.value)&&!categoryMetadata.has(d.key))add('decision',d.key,d,file,n.key);}
  if(['effect','trigger'].includes(kind))for(const n of ast)if(n.key&&Array.isArray(n.value))add(kind,n.key,n,file);
  if(kind==='on_action')for(const n of ast){
    if(n.key==='on_actions'&&Array.isArray(n.value)){for(const a of n.value)if(a.key&&Array.isArray(a.value))add('on_action',a.key,a,file);}
    else if(n.key&&Array.isArray(n.value))add('on_action',n.key,n,file);
  }
}
// Resolve named scripted helpers and literal event lists only after all definitions exist.
for(const e of entities)for(const n of e._flat){for(const kind of ['effect','trigger'])if(entityKeys.has(kind+':'+n.key))e.links.push({type:'scripted_'+kind,targetKind:kind,target:n.key,line:n.line,scope:n.ancestors.join('/')});if(n.ancestors.some(a=>['events','random_events'].includes(a))&&typeof n.value==='string'&&entityKeys.has('event:'+n.value))e.links.push({type:'event_list',targetKind:'event',target:n.value,line:n.line});}
for(const p of walk(path.join(root,'localisation')).filter(p=>p.endsWith('.yml'))){const {id:file,text}=recordFile(p,'localisation');let language='unknown';for(const [index,line] of text.split('\n').entries()){const lang=line.match(/^\s*l_([\w]+)\s*:/);if(lang){language=lang[1];continue;}const m=line.match(/^\s*([^#\s:]+):\s*(?:\d+\s*)?"(.*)"\s*(?:#.*)?$/);if(!m)continue;const key=m[1],entry=[key,file,index+1,language];localisations.push(entry);if(!locByKey.has(key))locByKey.set(key,[]);locByKey.get(key).push(entry);if(language==='simp_chinese'){const prior=locText.get(key);if(!prior||files[file].path.includes('/replace/'))locText.set(key,{file,line:index+1,text:m[2]});}}}
// East Asian relevance uses body tags plus graph connectivity, never filename alone.
let changed=true;while(changed){changed=false;for(const e of entities)for(const link of e.links){const t=entityKeys.get(link.targetKind+':'+link.target);if(t&&(e.eastAsia||t.eastAsia)&&!(e.eastAsia&&t.eastAsia)){if(['scripted_effect','scripted_trigger','prerequisite','exclusive'].includes(link.type)){e.eastAsia=true;t.eastAsia=true;changed=true;}}}}
const lore=JSON.parse(fs.readFileSync(path.join(project,'src/data/lore.json'),'utf8').replace(/^\uFEFF/,''));const news=JSON.parse(fs.readFileSync(path.join(project,'src/data/news.json'),'utf8').replace(/^\uFEFF/,'')).events;
const stages=[...new Map([...lore.worldEvents,...lore.routes.flatMap(r=>r.milestones),...(lore.regionalStories||[]),...news].map(e=>[e.id,e])).values()];
const boundKeys=new Set(stages.flatMap(e=>(e.sourceRefs||[]).map(r=>r.key)));
const relevantKeys=new Set([...boundKeys,...entities.filter(e=>e.eastAsia).flatMap(e=>e.loc)]);
const texts={};for(const key of relevantKeys){const value=locText.get(key);if(value)texts[key]=value;}
for(const e of entities){delete e._flat;e.links=e.links.map(x=>({...x,resolved:entityKeys.has(x.targetKind+':'+x.target)}));e.loc=e.loc.filter(k=>locByKey.has(k));if(!e.conditions.length)delete e.conditions;if(!e.flags.length)delete e.flags;if(!e.dynamic.length)delete e.dynamic;}
const mappedEntities=entities.filter(e=>boundKeys.has(e.id)||e.loc.some(key=>boundKeys.has(key)));
const tagCoverage=Object.fromEntries(['PRC','JAP','TSU','CHI','TZL'].map(tag=>{const relevant=entities.filter(e=>e.tags.includes(tag));return [tag,{definitions:relevant.length,events:relevant.filter(e=>e.kind==='event').length,focuses:relevant.filter(e=>e.kind==='focus').length,decisions:relevant.filter(e=>e.kind==='decision').length,mappedDefinitions:mappedEntities.filter(e=>e.tags.includes(tag)).length,mappedEvents:mappedEntities.filter(e=>e.tags.includes(tag)&&e.kind==='event').length,mappedFocuses:mappedEntities.filter(e=>e.tags.includes(tag)&&e.kind==='focus').length}];}));
const counts={files:files.length,scriptFiles:files.filter(f=>f.kind!=='localisation').length,localisationFiles:files.filter(f=>f.kind==='localisation').length,entities:entities.length,byKind:Object.fromEntries([...new Set(entities.map(e=>e.kind))].map(k=>[k,entities.filter(e=>e.kind===k).length])),eastAsiaEntities:entities.filter(e=>e.eastAsia).length,localisationDefinitions:localisations.length,localisationKeys:locByKey.size,chineseTextsRetained:Object.keys(texts).length,links:entities.reduce((s,e)=>s+e.links.length,0),unresolvedLinks:entities.reduce((s,e)=>s+e.links.filter(x=>!x.resolved).length,0),parserWarnings:warnings.length,duplicateEntityIds:duplicates.length,scheduledStages:stages.length,scheduledMacroStages:new Set([...lore.worldEvents,...lore.routes.flatMap(r=>r.milestones),...(lore.regionalStories||[])].map(e=>e.id)).size,scheduledSocialNews:news.length,mappedEntities:mappedEntities.length,tagCoverage};
const corpus={version:1,sourceName:path.basename(root),builtAt:new Date().toISOString(),format:{localisations:'[key,fileIndex,line,language]','fileReference':'files[index].path',scope:'Literal index, not a full HOI4 runtime or condition evaluator.'},counts,files,entities,localisations,texts,bindings:stages.map(e=>({stageId:e.id,keys:(e.sourceRefs||[]).map(r=>r.key)})),warnings,duplicates};
const out=path.join(project,'src/data/mod-corpus.json');fs.writeFileSync(out,JSON.stringify(corpus));
const categories=Object.entries(scriptDirs).map(([dir,kind])=>`| ${dir} | ${files.filter(f=>f.kind===kind).length} |`);
const report=`# MOD 内容索引与实际排程覆盖\n\n生成命令：\`node scripts/build-mod-corpus.mjs\`。可用 \`--mod=绝对路径\` 指定只读来源。脚本只写本项目的 \`src/data/mod-corpus.json\` 与本报告，不修改 MOD。\n\n来源：\`${path.basename(root)}\`。所有文件内容均完整读取；每个文件记录 SHA-256、行数与字节数。索引构建时间：${corpus.builtAt}。\n\n## 已扫描\n\n| 目录 | 脚本文件数 |\n| --- | ---: |\n${categories.join('\n')}\n| localisation（所有语言） | ${counts.localisationFiles} |\n\n索引共 ${counts.entities} 个定义：${Object.entries(counts.byKind).map(([k,v])=>`${k} ${v}`).join('，')}。本地化含 ${counts.localisationDefinitions} 个定义、${counts.localisationKeys} 个不同键；按脚本内容 TAG 与关系图识别 ${counts.eastAsiaEntities} 个东亚相关定义，保留 ${counts.chineseTextsRetained} 条相关简体中文原文。运行端不会一次发送这些原文。\n\n## 关系与限制\n\n解析引用共 ${counts.links} 条，${counts.unresolvedLinks} 条找不到同类静态定义。提取事件调用和延迟、国策前置／互斥／完成条件、决议启用／移除、scripted effect/trigger调用、on_action事件列表，以及旗标操作与静态条件片段。所有调用保留来源文件和行号，选项与条件的上下文路径保留在scope。匹配从整个脚本实体内容出发，不以文件名是否包含 PRC/JAP/TSU/CHI/TZL 决定是否读取。\n\n这不是HOI4解释器：嵌套作用域、ROOT/PREV/FROM、变量比较、脚本参数、动态本地化、随机权重、隐藏效果与动态TAG不会被当作已经满足。花括号或字符串语法警告 ${warnings.length} 条；重复定义标识 ${duplicates.length} 处，均保留而非静默假定唯一。本地化同键的replace文本优先作为中文检索内容，完整定义位置仍在索引中；不宣称精确复现引擎加载优先级。\n\n## 实际可游玩内容\n\n当前仍是 ${lore.routes.length} 条互斥宏观发展，实际排程 ${counts.scheduledMacroStages} 个不同宏观事件与 ${counts.scheduledSocialNews} 条社会新闻；不是把 ${counts.entities} 个索引定义全部排成可游玩事件。节点sourceRefs将排程与原文绑定；派系互斥、已发生前置、台海结束与中国指定时序继续由lore/engine约束。个人事件数量另见EVENT-DESIGN.md。\n\n## 叙事检索边界\n\n\`src/mod-content.js\` 的 \`getModContext(state,lore,{region,tags,query,limit=6})\` 只允许已发生新闻／宏观节点对应的来源。返回已公开阶段的本地化改写片段与来源，不把关系图邻居视为已触发国策，不返回隐藏路线名称、将来终局或未公开的原始脚本条件。完整索引用于核对覆盖与继续扩写；AI每次只获得有上限的小段内容。\n\n中文文本保留原文用于离线查证，但不得无条件把texts或完整实体送入AI；事件调用和前置关系仅表示可能发生，并不代表已经发生。没有映射到已发生节点的内容仍是未排程资料，不能凭关键词召回为世界事实。\n`;
const coverageRows=Object.entries(tagCoverage).map(([tag,v])=>`| ${tag} | ${v.definitions} | ${v.events} | ${v.focuses} | ${v.decisions} | ${v.mappedDefinitions} | ${v.mappedEvents} | ${v.mappedFocuses} |`);
const unresolvedByType=Object.fromEntries([...new Set(entities.flatMap(e=>e.links.filter(x=>!x.resolved).map(x=>x.type)))].map(type=>[type,entities.reduce((n,e)=>n+e.links.filter(x=>!x.resolved&&x.type===type).length,0)]));
const extra=`
## 逐 TAG 的索引与来源映射

| TAG | 含该标识的定义 | 事件 | 国策 | 决议 | 已被排程来源引用的定义 | 其中事件 | 其中国策 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${coverageRows.join('\n')}

TAG 是定义标识、正文中的国家标识和键前缀匹配；一个定义可以包含多个 TAG，因此各行不能相加。许多台湾、日本剧情以 PRC_MAO 开头，不能把 PRC 一行理解成只发生在中国。映射列表示 sourceRefs 实际使用该定义或其本地化，并不代表已执行其全部效果；重复定义也保留单独记录。

区域生活层另有 ${(lore.regionalStories||[]).length} 个排程 ID，覆盖战前防疫与贸易、战时就业与配给、制度变化和结局后的生活。同一报道复用于相容分支；少数不同前置下的生活后果文字相同，因此 ID 数不是独立原作剧情篇数。每条包含证据级别和改编说明；完整国策条件保留在审计关系中，由人工确认宏观相容性。

## 未接入内容的具体原因

- 台湾议会共和／党国共和、继续革命／台式社会主义等国策互斥；当前左翼胜利只公开制宪争论，没有擅自宣布所有制度同时成立。
- TSU 后期羽泽鸫国策要求朝鲜政权消失及台湾完成制宪；当前时间线没有记录朝鲜征服，故未把这批后期国策当作必然既成事实。其他日本领导人的国策也未混入羽泽鸫政府。
- 台湾民进党、国民党、基进党与旧日本军政府／共和派缺少对等完整战后正文；仅将已知政治结果延伸为行政、复工和失散登记，不声称完成原作不存在的全文移植。
- 派系以外的战争、随机领导人、未排程国家与外交事件仍保留在索引；没有相容世界事实和前置时不转为新闻。以超自然复活、魔法或外星干预为核心的内容按用户基调省略或限定为技术、政治宣传的改编。
- 全量决议、scripted effects/triggers 与 on_actions 已解析定义及字面调用；变量、动态作用域、随机表、战争与国家存在状态尚未解释执行。未解析引用按类型统计：${JSON.stringify(unresolvedByType)}。这些属于待人工核对资料。
- 目录扫描递归覆盖指定目录的所有 .txt 和 localisation 的所有 .yml；未把其他扩展名当脚本。简体中文原文保留只限相关键，但所有语言定义位置均纳入索引。

`;
fs.writeFileSync(path.join(project,'docs/MOD-COVERAGE.md'),report+extra);
console.log(JSON.stringify({...counts,outputBytes:fs.statSync(out).size}));
