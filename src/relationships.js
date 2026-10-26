import {findPersona} from './personas.js';
import {affirmedClauses} from './agency.js';

const MAX_NODES=512,MAX_EDGES=4096,MAX_UPDATES=64;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const text=(v,max=240)=>typeof v==='string'?v.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
const normalized=v=>text(v,100).toLowerCase().replace(/[\s·・._—-]+/g,'');
const hash=v=>{let h=2166136261;for(const c of v)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(36);};
const monthOf=s=>Number.isFinite(s.month)?Math.trunc(s.month):0;
const moment=(v,fallback)=>Number.isFinite(v)?clamp(Math.trunc(v),-120000,120000):fallback;
const relationTypes={bandmate:['乐队伙伴','colleague',85],family:['亲人','family',95],mentor:['相互信任的师友','mentor',80],'political-opponent':['政治对手','rival',80],'party-colleague':['党内同事','colleague',65],'coalition-partner':['联盟伙伴','ally',80],'conditional-alliance':['有分歧的盟友','ally',75],'political-contact':['保持政治联系','acquaintance',50]};
const invalidName=/^(?:我|你|您|本人|自己|玩家|他|她|它|他们|她们|我们|你们|大家|朋友|熟人|同事|领导|上司|下属|家人|亲人|陌生人|邻居|路人|一位.*|一个.*|几位.*|几名.*|某人|某个.*|有关.*|当地.*|全体.*|群众|市民|警察|军人|士兵|员工|老师|工人|医生|记者|工作|事情|事务|排练|演出|问题|情况|办法|安排|中国|中国大陆|大陆|中国台湾|台湾|日本|韩国|美国|香港|澳门|民进党|国民党|共产党|自民党|afterglow|政府|国家|公司|学校|军队)$/i;
// A relationship target may be an unusual chosen name. Only explicit naming
// evidence bypasses prose/object rejection; loose prose extraction never does.
const objectName=/^(?:方式|方法|办法|地名|地点|照片|图片|相片|资料|材料|文件|单据|表格|工作表|工资|报酬|事情|任务|计划|问题|情况|结果|消息|信息|新闻|安排|记忆|回忆|生活|历史|社会|经济|政治|国家|世界|物品|东西|食物|水源|电话|手机|电脑|设备|机器|车辆|工具|门口|路口|学校|单位|办公室|店铺|商店|商场|超市|菜市场|文具店|咖啡馆|医院|工厂|部门|市场|书架|书籍|书本|一本书|一张纸|一张照片|一次机会|困难|危险|麻烦|风险|故障|野兽|小鱼|鱼群|丧尸群|工作安排|家庭情况|当地政府|这个人|那个人|这种方式|同一种方式)$/;
const proseName=/(?:之前|之后|此前|以后|已经|正在|仍然|逐渐|通过|按照|根据|为了|把.+|被.+|抄下|写下|放到|放在|拿到|拿出|交给|完成|发生|变成|进行|接下来|所说的|说过的|眼前的|身边的|自己的|对方的|他们的|她们的|你们的|我们的)/;
const explicitNaming=(name,detail='')=>{const escaped=String(name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp(`(?:名叫|名为|叫做|叫作|姓名(?:是|为|叫)?|名字(?:是|为|叫)?|称作|自称|昵称(?:是|为|叫)?|called|named)\\s*[“「『"']?${escaped}(?:[”」』"'，。！？；;\\s]|的(?:朋友|同事|同学|工程师|老师|医生|队友|人物|人)|$)`,'iu').test(detail);};
function cleanName(value,{explicit=false,automatic=false}={}){
  let name=text(value,80).replace(/^[“「『"']|[”」』"']$/g,'').trim();
  const exact=findPersona(name);if(exact)return {name:exact.name,personaId:exact.id,key:`persona:${exact.id}`,persona:exact};
  name=name.replace(/^(?:一位|一名|一个)?(?:新(?:来的)?|老)?(?:邻居|同事|同学|医生|护士|老师|记者|朋友|队友|战友|工程师|老板|师傅|店长|客户|学生|歌手|市长|总统|首相|主席|先生|女士|名叫|叫做|叫|名为)(?:叫|名叫|叫做|名为)?/,'').trim();
  if(name.length<2||name.length>48||invalidName.test(name)||/[，。！？:：;；\n<>={}\/\\]/.test(name)||/(?:新闻|报道|消息|名单|视频|照片|演讲|成员们|同事们|朋友们|身边的人|陌生人|某位|某名|一群|那位|这位)/.test(name))return null;
  if(!explicit&&(objectName.test(name)||proseName.test(name)||automatic&&/[的把被了着过]/.test(name)&&/[\p{Script=Han}]/u.test(name)))return null;
  if(automatic&&!explicit&&/^[\p{Script=Han}]+$/u.test(name)&&Array.from(name).length>5)return null;
  if(!/^[\p{L}\p{M}\p{N}·・.'’\-\s]+$/u.test(name))return null;
  const persona=findPersona(name);
  return {name:persona?.name||name,personaId:persona?.id||null,key:persona?`persona:${persona.id}`:`contact:${hash(normalized(name))}`,persona};
}
function identity(value,state,options){
  const name=text(value,80);
  if(name==='player'||/^(?:我|你|本人|自己|玩家)$/.test(name)||normalized(name)===normalized(state.profile?.name))return {key:'player',name:state.profile?.name||'我'};
  const known=state.relationshipGraph?.nodes?.find(node=>node.name===name&&explicitNaming(name,node.nameEvidence));
  return cleanName(name,{...options,explicit:options?.explicit||!!known});
}
function relationshipMeaning(value,type=''){
  const detail=text(value,320),mapped=relationTypes[type];
  if(mapped)return {status:mapped[0],kind:mapped[1],strength:mapped[2]};
  const meanings=[[/断绝|绝交|断交|决裂|不再来往|停止来往|断了联系|疏远|分手|分居|离婚|失联/, '疏远','estranged',65],[/仇人|仇敌|仇恨|敌人|敌对|反目|袭击|追杀|伤害|杀害/, '敌对','hostile',90],[/竞争|对手|政敌|敌手/, '对手','rival',75],[/父亲|母亲|父子|母子|父女|母女|兄弟|姐妹|兄妹|姐弟|亲人|亲属|家人|侄|舅|叔|堂兄|表兄|祖父|祖母|爷爷|奶奶/, '亲人','family',90],[/配偶|夫妻|丈夫|妻子|爱人|恋人|情侣|伴侣|结婚|恋爱/, '伴侣','partner',90],[/师生|老师|学生|导师|师傅|徒弟|师友|指导/, '师友','mentor',75],[/结盟|盟友|同盟|联盟伙伴|并肩作战|战友/, '盟友','ally',80],[/挚友|好友|朋友|友谊|信任|救下|救了|搭救/, '朋友','friend',70],[/伙伴|同事|合作|共事|同学|同伴|队友/, '伙伴','colleague',60],[/吵架|争吵|争执|矛盾|不信任/, '关系紧张','rival',65]];
  const international=[[/estranged|broke up|divorced|severed|離婚|絶交|疎遠|이혼|절교|소원/i,'疏远','estranged',65],[/enemy|enemies|hostile|敵対|적대|원수/i,'敌对','hostile',90],[/rival|opponent|競争相手|ライバル|경쟁자|정적/i,'对手','rival',75],[/brothers|sisters|siblings|father|mother|family|relatives|親子|姉妹|家族|형제|자매|남매|가족|부모/i,'亲人','family',90],[/spouse|married|lover|romantic partner|恋人|配偶者|배우자|연인|결혼/i,'伴侣','partner',90],[/mentor|teacher|student|先生|師弟|教師|教師|스승|제자|선생/i,'师友','mentor',75],[/allies|ally|alliance|同盟|戦友|동맹|전우/i,'盟友','ally',80],[/friend|友人|親友|친구/i,'朋友','friend',70],[/colleague|bandmate|teammate|partner|仲間|同僚|동료/i,'伙伴','colleague',60]];
  const found=[...meanings,...international].find(([pattern])=>pattern.test(detail));
  return found?{status:found[1],kind:found[2],strength:found[3]}:{status:'相识',kind:'acquaintance',strength:30};
}
function edgeId(a,b){const pair=a==='player'?[a,b]:b==='player'?[b,a]:[a,b].sort();return {id:`relationship:${pair[0]}:${pair[1]}`,source:pair[0],target:pair[1]};}
function makeBuilder(state,graph){
  const month=monthOf(state),nodes=new Map((graph?.nodes||[]).map(n=>[n.id,{...n}])),edges=new Map((graph?.edges||[]).map(e=>[e.id,{...e}]));
  const playerPersona=state.profile?.lockedPersonaId||state.profile?.persona?.id;
  nodes.set('player',{id:'player',name:text(state.profile?.name,48)||'我',...(playerPersona?{personaId:text(playerPersona,100)}:{}),detail:text(state.person?.occupation||state.profile?.backgroundText,240),firstMetMonth:0,lastContactMonth:month});
  const ensure=(value,detail='',touch=false,nameEvidence='')=>{
    const explicit=explicitNaming(value,detail)||explicitNaming(value,nameEvidence);
    const person=identity(value,state,{explicit});if(!person)return null;
    if(person.key==='player')return nodes.get('player');
    const existing=nodes.get(person.key);
    if(!existing&&nodes.size>=MAX_NODES)return null;
    const node=existing||{id:person.key,name:person.name,...(person.personaId?{personaId:person.personaId}:{}),detail:'',firstMetMonth:month,lastContactMonth:month};
    if(explicit)node.nameEvidence=text(explicitNaming(value,detail)?detail:nameEvidence,240);
    if(detail)node.detail=text(detail,240);if(touch)node.lastContactMonth=month;
    nodes.set(node.id,node);return node;
  };
  const connect=(a,b,values={},override=true)=>{
    if(!a||!b||a.id===b.id)return;
    const pair=edgeId(a.id,b.id),old=edges.get(pair.id);if(!old&&edges.size>=MAX_EDGES||old&&!override)return;
    const detail=text(values.detail||values.status,320),meaning=relationshipMeaning(detail,values.type);
    const status=text(values.status,48)||meaning.status;
    edges.set(pair.id,{...pair,status,detail,strength:Number.isFinite(values.strength)?clamp(Math.round(values.strength),0,100):meaning.strength,kind:text(values.kind,40)||meaning.kind,updatedMonth:month,...(values.origin?{origin:text(values.origin,30)}:{})});
  };
  return {nodes,edges,ensure,connect,finish:()=>({version:1,nodes:[...nodes.values()],edges:[...edges.values()]})};
}
function knownEvents(state){return new Set([...(state.seenEvents||[]),...(state.seenNews||[]),...(state.newsHistory||[]).filter(n=>Number(n.month)<=monthOf(state)).map(n=>n.id)]);}
function allowedRelation(relation,state){const known=knownEvents(state);return !(relation?.requires?.length&&monthOf(state)<0)&&(relation.requires||[]).every(id=>known.has(id))&&!(relation.blockAfter||[]).some(id=>known.has(id));}
function parseLegacy(value){
  if(typeof value==='string'){
    const split=value.indexOf('：')>=0?value.indexOf('：'):value.indexOf(':');if(split>0)return {name:value.slice(0,split),detail:value.slice(split+1)};
    const simple=value.match(/^([\p{L}\p{M}·・.'’\-\s]{2,30}?)(?:提供|帮助|协助|负责|指导|是我|是你|曾与我|经常与我|已经与我)/u);
    if(simple)return {name:simple[1],detail:value};
    const name=namesInContact(value)[0];return name?{name,detail:value}:null;
  }
  return value&&typeof value==='object'&&typeof value.name==='string'?value:null;
}
function addLegacy(builder,state,values){
  for(const raw of (Array.isArray(values)?values:[]).slice(0,MAX_NODES)){
    const entry=parseLegacy(raw);if(!entry||!allowedRelation(entry,state))continue;
    if(/(?:尚未|没有|未曾|从未|并未|不曾).{0,12}(?:见面|认识|接触|联系)|(?:新闻|报道|听说|据说).{0,40}(?:提到|认识|联系|关系)|(?:未来|可能|假如|如果).{0,40}(?:结盟|朋友|接触|联系)/.test(entry.detail||''))continue;
    const person=builder.ensure(entry.name,entry.detail);builder.connect(builder.nodes.get('player'),person,{...entry,origin:'background'},false);
  }
}
function addKnownLinks(builder,state){
  const playerPersona=state.profile?.lockedPersonaId&&findPersona(state.profile.lockedPersonaId);
  if(playerPersona)addLegacy(builder,state,playerPersona.relationships||playerPersona.modPolitics?.relationships);
  // Only inspect already encountered identities; the 9,000-person catalog is never expanded into a graph.
  for(const node of [...builder.nodes.values()]){
    if(node.id==='player')continue;
    const persona=findPersona(node.personaId||node.name);if(!persona)continue;
    for(const relation of (persona.relationships||[]).slice(0,100)){
      if(!allowedRelation(relation,state))continue;
      const other=identity(relation.name,state),target=other&&builder.nodes.get(other.key);if(!target)continue;
      const meaning=relationshipMeaning(relation.detail,relation.type);if(meaning.strength<60)continue;
      builder.connect(node,target,{...relation,...meaning,origin:'known'},false);
    }
  }
}
function addBackgroundContacts(builder,state){
  for(const clause of clauses(state.profile?.backgroundText||'')){
    if(!/我|你|本人|自己/.test(clause)&&!/^(?:与|和|跟|同)/.test(clause))continue;
    const candidates=namesInContact(clause),named=clause.match(/(?:我|你)(?:的)?(?:朋友|好友|父亲|母亲|兄弟|姐妹|丈夫|妻子|伴侣|导师|老师|同事|同学|队友)(?:是|叫|名叫|叫做)([\p{L}\p{M}·・.'’\-\s]{2,40})/u);
    if(named)candidates.push(named[1]);
    for(const name of candidates){
      const person=builder.ensure(name,clause);if(!person)continue;
      const meaning=relationshipMeaning(clause),old=builder.edges.get(edgeId('player',person.id).id);
      builder.connect(builder.nodes.get('player'),person,{...meaning,detail:clause,origin:'background'},!old||meaning.strength>old.strength);
    }
  }
}

/** Validated, bounded, serializable copy. Legacy relationship prose is migrated once. */
export function normalizeRelationshipGraph(state={}){
  const saved=state.relationshipGraph,builder=makeBuilder(state),mapping=new Map([['player','player']]);
  if(saved&&Array.isArray(saved.nodes)&&Array.isArray(saved.edges)){
    for(const raw of saved.nodes.slice(0,MAX_NODES)){
      if(!raw||typeof raw!=='object'||raw.id==='player')continue;
      const person=builder.ensure(raw.personaId||raw.name,raw.detail,false,raw.nameEvidence);if(!person)continue;
      person.firstMetMonth=moment(raw.firstMetMonth,monthOf(state));person.lastContactMonth=moment(raw.lastContactMonth,person.firstMetMonth);
      if(raw.referenceRequired===true)person.referenceRequired=true;
      if(['living','deceased','missing','unknown'].includes(raw.lifeStatus))person.lifeStatus=raw.lifeStatus;
      if(typeof raw.familyRole==='string')person.familyRole=text(raw.familyRole,24);
      mapping.set(text(raw.id,200),person.id);
    }
    for(const raw of saved.edges.slice(0,MAX_EDGES)){
      if(!raw||typeof raw!=='object')continue;
      const a=builder.nodes.get(mapping.get(text(raw.source,200))),b=builder.nodes.get(mapping.get(text(raw.target,200)));if(!a||!b||a===b)continue;
      builder.connect(a,b,raw);const edge=builder.edges.get(edgeId(a.id,b.id).id);edge.updatedMonth=moment(raw.updatedMonth,monthOf(state));
    }
    // A saved contact must retain an actual direct acquaintance link; orphan imports cannot introduce strangers.
    const met=new Set(['player']);for(const e of builder.edges.values())if(e.source==='player')met.add(e.target);
    for(const id of builder.nodes.keys())if(!met.has(id))builder.nodes.delete(id);
    for(const [id,e]of builder.edges)if(!builder.nodes.has(e.source)||!builder.nodes.has(e.target))builder.edges.delete(id);
  }else{
    addLegacy(builder,state,state.person?.relationships);
    const persona=state.profile?.persona||findPersona(state.profile?.lockedPersonaId);
    if(persona)addLegacy(builder,state,persona.relationships||persona.modPolitics?.relationships);
    addBackgroundContacts(builder,state);
  }
  addKnownLinks(builder,state);return builder.finish();
}
export const getRelationshipGraph=normalizeRelationshipGraph;

/** The opening initializer supplies sourced relatives or seeded fictional ones.
 * Existing contact facts and ties win; this is never a per-turn people generator. */
export function mergeOpeningRelationshipGraph(state,contacts=[],links=[]){
  const builder=makeBuilder(state,normalizeRelationshipGraph(state)),player=builder.nodes.get('player');
  for(const row of contacts.slice(0,64)){
    const person=builder.ensure(row.name,row.detail);if(!person||person.id==='player')continue;
    if(row.referenceRequired===true)person.referenceRequired=true;
    if(['living','deceased','missing','unknown'].includes(row.lifeStatus))person.lifeStatus=row.lifeStatus;
    person.familyRole=text(row.role,24);
    const old=builder.edges.get(edgeId('player',person.id).id),kind=['丈夫','妻子','伴侣'].includes(row.role)?'partner':row.role==='熟人'?'friend':'family';
    // Legacy graphs may already record estrangement or death after the opening.
    const preserve=old&&!['background','opening-family'].includes(old.origin);
    if(!preserve)builder.connect(player,person,{status:row.role+(row.lifeStatus==='deceased'?'·已故':row.lifeStatus==='missing'?'·失联':''),kind,detail:row.detail,strength:kind==='friend'?65:90,origin:'opening-family'});
  }
  for(const row of links.slice(0,64)){
    const a=existingNode(builder,row.source,state),b=existingNode(builder,row.target,state);
    if(a&&b)builder.connect(a,b,row,false);
  }
  return builder.finish();
}

const objectVerb='(?:见到|遇见|遇到|认识|结识|拜访|约见|会见|接待|接触|联系上|联系|采访|帮助|救下|救了|搭救|击败|袭击|拥抱|亲吻|打电话给|发消息给)';
const contactVerb='(?:见到|见面|遇见|遇到|认识|结识|拜访|约见|会见|接待|接触|联系上|联系|采访|帮助|救下|救了|搭救|击败|袭击|拥抱|亲吻|打电话给|打电话|通话|发消息给|交谈|谈话|商量|讨论|争吵|争执|吵架|合作|共事|结盟|成为朋友|结为朋友|成为好友|成为恋人|结婚|离婚|分手|绝交|决裂|断绝关系|恢复联系|并肩作战|一起[^，。]{0,12})';
const relationVerb='(?:成为朋友|结为朋友|结为好友|成为好友|成为恋人|结为盟友|成为盟友|成为同事|是(?:多年的?|一直以来的?|相识多年的?|亲密的?|亲近的?|多年相识的?)?(?:朋友|好友|同事|同学|队友|邻居|伙伴|兄弟|姐妹|亲人|师生|盟友|恋人|夫妻|对手|仇敌)|建立联系|建立合作|建立关系|结婚|离婚|分手|绝交|决裂|结盟|合作|会面|见面|交谈|谈话|通话|聊天|讨论|商量|争吵|争执|吵架|共事|共同[^，。]{0,12}|一起[^，。]{0,12}|并肩作战|断绝关系|恢复联系)';
const noContact=/(?:尚未|还未|未曾|从未|并未|没有|没能|未能|不曾|不会|不想|不愿|不打算|不准备|无法|不能|拒绝|避免|取消|未见|没见|未认识|不认识|不联系|没联系|未接触|不接触)/;
const remote=/(?:新闻|报道|报纸|电视|视频|直播|网络|网上|推文|传闻|听说|据说|传说|名单|看见.*照片|看到.*照片|读到|读了.*文章|梦到|梦见|幻想|想象|新聞|報道|報紙|電視|視頻|網絡|網上|傳聞|聽說|據說|夢見|ニュース|報道|방송|뉴스|\bnews\b|\breported\b|\bheard about\b|\bwatched\b|\bdreamed\b)/i;
function clauses(value){return affirmedClauses(text(value,16000)).filter(c=>!noContact.test(c)&&!remote.test(c)&&!/(?:计划|准备|希望|试图|尝试|打算|想要|将要|即将).{0,16}(?:见面|认识|接触|联系|结盟|合作)|(?:接触|联系|见面|会面|结盟|合作).{0,15}(?:失败|未果|被拒|遭到拒绝)|尚未|還未|未曾|從未|並未|沒有|沒能|無法|不認識|不聯繫|假如|如果|拒絕|\b(?:if|never|not|didn't|did not|couldn't|would|might|wish|hope to|plan to|tried to)\b|会っていない|会わな|会えな|知らない|連絡していない|만나지|만난 적 없|연락하지|못 만났|만날 계획/i.test(c));}
function namesInContact(clause){
  const found=[];let match;
  const addNames=(value,explicit=false)=>{const whole=cleanName(value,{automatic:true,explicit:explicit||explicitNaming(value,clause)});if(whole?.persona||explicit){if(whole)found.push(whole.name);return;}for(const item of value.split(/(?:和|与|跟|以及|还有|、| and )/)){const parsed=cleanName(item,{automatic:true,explicit:explicitNaming(item,clause)});if(parsed)found.push(parsed.name);}};
  const named=/(?:名叫|名为|叫做|叫作|自称|昵称(?:是|为|叫)?)[“「『"']?([\p{L}\p{M}\p{N}·・.'’\-\s]{2,48}?)(?:[”」』"']|的(?:朋友|同事|同学|工程师|老师|医生|队友|人物|人)|$)/gu;
  if(new RegExp(contactVerb).test(clause))while((match=named.exec(clause)))addNames(match[1],true);
  const direct=new RegExp(`${objectVerb}(?:了|过|到|上)?\\s*([\\p{L}\\p{M}·・.'’\\-\\s]{2,48})`,'gu');
  while((match=direct.exec(clause))){let name=match[1].split(/(?:并|和我|跟我|与我|向我|同我|为我|给我|正在|一起|成为|进行了|进行|介绍|商量|讨论|开始|建立|告别|握手|搬家|修理|修好|做饭|逃离|脱险|解决|处理|之后|以后)|[，。]/)[0];if(!name.includes('的'))addNames(name);}
  const mutual=new RegExp(`(?:与|和|跟|同)\\s*([\\p{L}\\p{M}·・.'’\\-\\s]{2,48}?)(?:已经|正式|成功|再次|经常|时常|常常|曾经|一直|早已|一起|共同|已|也)?${relationVerb}`,'gu');
  while((match=mutual.exec(clause))){
    const before=clause.slice(0,match.index);
    // "把照片和地名放到一起" describes objects, not a social encounter.
    if(/(?:把|将|照片|图片|资料|材料|文件|单据|表格|方式|方法|整理|放到|放在)/.test(before))continue;
    addNames(match[1]);
  }
  const telephone=/(?:给|向)([\p{L}\p{M}·・.'’\-\s]{2,48}?)(?:打电话|发消息|发信息|通电话)/gu;
  while((match=telephone.exec(clause)))addNames(match[1]);
  const english=/\b(?:I|You)\s+(?:(?:have|had|already|just|personally|successfully)\s+)*(?:met|meet|befriended|contacted|visited|interviewed|rescued|called|spoke (?:with|to)|talked (?:with|to)|worked with)\s+([A-Z][\p{L}.'’\-]*(?:\s+[A-Z][\p{L}.'’\-]*){0,3})/gu;
  while((match=english.exec(clause)))addNames(match[1]);
  return [...new Set(found)];
}
function personalContactClause(clause,fromAction=false){
  if(/(?:我|你|本人|自己|\bI\b|\bYou\b|\byou\b|あなた|自分|私|당신|나는|제가)/.test(clause))return true;
  return fromAction&&(new RegExp(`^(?:(?:已经|亲自|成功|正式|再次|曾经)\\s*)?${objectVerb}`).test(clause)||/^(?:与|和|跟|同)/.test(clause));
}
function connectedRelationshipClauses(value,fromAction=false){
  const result=[];
  // A subjectless relationship outcome inherits only the immediately preceding
  // personal contact in this sentence. A new named subject or sentence resets it.
  for(const sentence of text(value,16000).split(/[。！？；;\n]/)){
    let previous=[];
    const accepted=new Set(clauses(sentence));
    for(const raw of sentence.split(/[，,]|(?:并且|然后|同时)/)){
      const clause=raw.trim();if(!clause||!accepted.has(clause)){previous=[];continue;}
      result.push(clause);
      const continuation=clause.replace(/^(?:(?:我|你|我们|你们|双方|彼此|两人|本人)(?:都|也|就|便)?|随后|于是|当场|正式|已经|从此|后来|再次|互相|相互|随即|终于|就|便|也|又|并)+/,'');
      if(previous.length&&/^(?:结为朋友|结为好友|成为朋友|成为好友|成为恋人|结为盟友|成为盟友|成为同事|结婚|离婚|分手|绝交|决裂|结盟|断绝关系|恢复联系)/.test(continuation)){
        for(const name of previous)result.push(`我与${name}${continuation}`);
        continue;
      }
      previous=personalContactClause(clause,fromAction)?namesInContact(clause):[];
    }
  }
  return result;
}
function explicitContact(clause,name,state){
  const p=identity(name,state,{explicit:explicitNaming(name,clause)});if(!p)return false;
  const aliases=[p.name,...(p.persona?.aliases||[])].filter(v=>v.length>1),included=aliases.some(n=>clause.includes(n));if(!included)return false;
  if(namesInContact(clause).some(n=>identity(n,state)?.key===p.key))return true;
  const marker=aliases.find(n=>clause.includes(n)),at=clause.indexOf(marker),before=clause.slice(Math.max(0,at-35),at),after=clause.slice(at+marker.length,at+marker.length+40);
  if(/我|你|本人|自己/.test(clause)&&/認識|結識|見到|見面|遇見|約見|會見|聯繫|聯絡|接觸|交談|合作|結盟|結婚|離婚|絕交/.test(clause))return true;
  if(/\b(?:I|You|you)\b/.test(clause)&&/\b(?:met|meet|befriended|contacted|visited|called|spoke|talked|married|divorced|cooperat|allied|fought|argued|rescued|friend|enemy|partner)/i.test(clause))return true;
  if(/あなた|自分|私|당신|나는|제가/.test(clause)&&/会った|会いました|話した|話しました|知り合|出会|友人|仲間|協力|結婚|離婚|만났|만나|대화|연락|친구|동료|결혼|이혼/.test(clause))return true;
  return (/(?:我|你|本人|自己)/.test(clause)||/(?:见面|接待|拜访|交谈|通话)/.test(clause))&&(new RegExp(`${contactVerb}(?:了|过|到|上)?[^，。]{0,10}$`).test(before)||new RegExp(`^[^，。]{0,12}${contactVerb}`).test(after));
}
function candidatesFromUpdates(response){
  const out=[];
  for(const value of (Array.isArray(response?.personUpdate?.relationships)?response.personUpdate.relationships:[]).slice(0,MAX_UPDATES)){const row=parseLegacy(value);if(row)out.push({source:'player',target:row.name,status:relationshipMeaning(row.detail,row.type).status,detail:row.detail});}
  out.push(...normalizeRelationshipUpdates(response?.relationshipUpdates));
  return out;
}

/** Keep only relationship fields; model-supplied IDs, images, HTML and arbitrary save fields are ignored. */
export function normalizeRelationshipUpdates(raw){
  if(!Array.isArray(raw))return [];
  return raw.slice(0,MAX_UPDATES).filter(v=>v&&typeof v==='object'&&typeof(v.target||v.name)==='string').map(v=>({source:text(v.source,100)||'player',target:text(v.target||v.name,80),status:text(v.status,48),detail:text(v.detail,320),...(Number.isFinite(v.strength)?{strength:clamp(Math.round(v.strength),0,100)}:{})})).filter(v=>v.target);
}

/** Omitted graphs are valid legacy saves; a present graph must satisfy the bounded save contract. */
export function isValidRelationshipGraph(raw){
  if(raw===undefined)return true;
  if(!raw||raw.version!==1||!Array.isArray(raw.nodes)||!Array.isArray(raw.edges)||raw.nodes.length<1||raw.nodes.length>MAX_NODES||raw.edges.length>MAX_EDGES)return false;
  const ids=new Set();
  for(const node of raw.nodes){
    if(!node||typeof node.id!=='string'||!node.id||node.id.length>200||ids.has(node.id)||typeof node.name!=='string'||!node.name.trim()||node.name.length>80||typeof node.detail!=='string'||node.detail.length>320||!Number.isFinite(node.firstMetMonth)||!Number.isFinite(node.lastContactMonth)||node.personaId!==undefined&&(typeof node.personaId!=='string'||node.personaId.length>100)||node.nameEvidence!==undefined&&(typeof node.nameEvidence!=='string'||node.nameEvidence.length>240))return false;
    if(node.referenceRequired!==undefined&&typeof node.referenceRequired!=='boolean'||node.lifeStatus!==undefined&&!['living','deceased','missing','unknown'].includes(node.lifeStatus)||node.familyRole!==undefined&&(typeof node.familyRole!=='string'||node.familyRole.length>24))return false;
    ids.add(node.id);
  }
  if(!ids.has('player'))return false;
  const edgeIds=new Set();
  for(const edge of raw.edges){
    if(!edge||typeof edge.id!=='string'||edge.id.length>450||edgeIds.has(edge.id)||!ids.has(edge.source)||!ids.has(edge.target)||edge.source===edge.target||typeof edge.status!=='string'||edge.status.length>48||typeof edge.detail!=='string'||edge.detail.length>320||typeof edge.kind!=='string'||edge.kind.length>40||!Number.isFinite(edge.strength)||edge.strength<0||edge.strength>100||!Number.isFinite(edge.updatedMonth))return false;
    edgeIds.add(edge.id);
  }
  return true;
}
function existingNode(builder,value,state){if(builder.nodes.has(value))return builder.nodes.get(value);const person=identity(value,state);return person&&builder.nodes.get(person.key);}

/** Apply one completed personal turn. Neither failed actions nor news establish acquaintance. */
export function updateRelationshipGraph(state={}, {action={},response={},success=state.actionResult?.success??true}={}){
  const builder=makeBuilder(state,normalizeRelationshipGraph(state));
  if(success===false)return builder.finish();
  const actionClauses=action.passive?[]:connectedRelationshipClauses(action.label,true),resultClauses=connectedRelationshipClauses(`${response?.consequence||''}。${response?.narrative||''}`),all=[...actionClauses,...resultClauses];
  const personalClauses=[...actionClauses.filter(c=>personalContactClause(c,true)),...resultClauses.filter(c=>personalContactClause(c))];
  const player=builder.nodes.get('player');
  for(const clause of all){
    // Third-person conversations in personal prose do not mean the player met their subjects.
    if(!personalClauses.includes(clause))continue;
    for(const name of namesInContact(clause)){
      const person=builder.ensure(name,clause,true);if(!person||person.id==='player')continue;
      const meaning=relationshipMeaning(clause),old=builder.edges.get(edgeId(player.id,person.id).id);
      builder.connect(player,person,{...(meaning.kind==='acquaintance'&&old?old:meaning),detail:clause,origin:'contact'});
    }
  }
  if(actionClauses.some(c=>/(?:加入|成为)\s*afterglow(?:的)?(?:成员)?/i.test(c))){
    for(const name of ['美竹兰','羽泽鸫','青叶摩卡','上原绯玛丽','宇田川巴']){const person=builder.ensure(name,'Afterglow的同伴，已经一起安排排练和日常事务。',true);builder.connect(player,person,{status:'乐队伙伴',detail:'Afterglow的同伴，已经一起安排排练和日常事务。',strength:80,kind:'colleague',origin:'contact'});}
  }
  for(const update of candidatesFromUpdates(response)){
    const targetIdentity=identity(update.target,state);if(!targetIdentity)continue;
    const source=existingNode(builder,update.source,state);if(!source)continue;
    let target=existingNode(builder,update.target,state);
    const evidence=personalClauses.find(c=>explicitContact(c,update.target,state));
    if(source.id==='player'){
      // Structured model updates alone cannot manufacture a person in the player's life.
      if(!evidence)continue;
      target=target||builder.ensure(update.target,update.detail||evidence,true);if(!target)continue;
      target.lastContactMonth=monthOf(state);
      builder.connect(source,target,{...update,detail:update.detail||evidence,origin:'contact'});
    }else{
      if(!target||target.id==='player')continue;
      const supports=all.find(c=>c.includes(source.name)&&c.includes(target.name)&&relationshipMeaning(c).strength>=60);
      if(!supports)continue;
      const meaning=relationshipMeaning(update.detail||supports);if(meaning.strength<60)continue;
      builder.connect(source,target,{...update,strength:Math.max(60,Number.isFinite(update.strength)?update.strength:meaning.strength),detail:update.detail||supports,origin:'observed'});
    }
  }
  // Explicit changes to an existing tie take priority over stale narrative relationship summaries.
  for(const clause of actionClauses){for(const node of builder.nodes.values()){
    if(!personalContactClause(clause,true)||node.id==='player'||!explicitContact(clause,node.name,state))continue;
    const meaning=relationshipMeaning(clause);if(meaning.kind==='acquaintance')continue;
    builder.connect(player,node,{...meaning,detail:clause,origin:'contact'});
  }}
  for(const clause of all){
    const meaning=relationshipMeaning(clause);if(meaning.strength<65)continue;
    const pair=[...builder.nodes.values()].filter(n=>n.id!=='player'&&clause.includes(n.name));
    if(pair.length!==2||!/(?:和|与|跟|同|、)/.test(clause)||!/(?:是|彼此|互为|相互|之间|结为|结成)/.test(clause))continue;
    builder.connect(pair[0],pair[1],{...meaning,detail:clause,origin:'observed'});
  }
  addKnownLinks(builder,state);return builder.finish();
}

export const RELATIONSHIP_LIMITS=Object.freeze({nodes:MAX_NODES,edges:MAX_EDGES,updates:MAX_UPDATES});
