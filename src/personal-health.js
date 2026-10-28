// Persistent personal consequences, separate from fictional zombie infection.
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const escape=value=>String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const diseases=[['hiv','HIV感染',/HIV|AIDS|艾滋(?:病|病毒)?/i],['cancer','癌症',/癌症|恶性肿瘤|(?:肺|肝|胃|乳腺|结肠|直肠|宫颈)癌/],['diabetes','糖尿病',/糖尿病/],['depression','抑郁症',/抑郁症/],['tuberculosis','结核病',/肺结核|结核病/],['injury','骨折或严重伤势',/骨折|重伤|截肢|瘫痪/],['heart','心脏疾病',/心肌梗死|心梗|冠心病|心衰/]];
const otherPeople='父亲|母亲|爸爸|妈妈|父母|家人|亲人|朋友|同事|同学|邻居|老板|患者|医生|护士|某人|丈夫|妻子|伴侣|哥哥|姐姐|弟弟|妹妹|儿子|女儿|爷爷|奶奶|祖父|祖母|他们|她们|他|她';
const medical=/确诊|诊断|查出|患上|患有|患了|得了|染上|感染|阳性|骨折|截肢|瘫痪|重伤|治疗|服药|用药|吃药|复查|就诊|检测|检查|筛查|化验|治愈|痊愈|康复/;
const uncertain=/(?:假如|如果|假设|要是|倘若|梦见|设想|听说|据说|传闻)|(?:可能|也许|怀疑|疑似|担心|害怕|希望|是否|会不会|想知道).{0,18}(?:确诊|患|感染|阳性|得了|治愈|痊愈|康复)|[?？]/;
const future=/(?:准备|计划|打算|建议|等待|下个月|下月|将要|想要|尝试|争取).{0,20}(?:确诊|患|感染|阳性|治疗|服药|吃药|用药|复查|就诊|治愈|痊愈|康复)/;
const negative=/(?:没有|并未|尚未|还没|未曾|未被|没|未|不是|并非|否认).{0,7}(?:患|感染|得病|得了|确诊|诊断|阳性)|(?:阴性|排除.{0,10}(?:感染|诊断)|未检出)|确诊.{0,6}(?:之前|以前|前)/;
const recovery=/治愈|治好了|痊愈|恢复健康|不再患有|(?:已经|已|完全|彻底|成功)康复/;
const recoveryBlocked=/(?:未|没|没有|尚未|还未|无法|不能|难以|很难|没有办法|不可能).{0,6}(?:治愈|治好|痊愈|康复|恢复健康)|康复(?:治疗|训练|计划|过程|期间|中心|科)|治愈率/;
const careLabels={none:'未记下后续就诊安排',scheduled:'已预约就诊或复查，尚未记下开始治疗',visited:'已就诊或复查，后续治疗安排仍需确认',active:'已开始治疗，后续服药与复查按已有安排继续',interrupted:'治疗或用药中断，尚待处理'};

// Commas separate subjects and certainty. A conditional still governs its whole
// sentence, while a later worry cannot erase a diagnosis already stated.
function clauses(value){
  const rows=[];
  for(const sentence of String(value||'').split(/[。！!；;\n]/)){
    let conditional=false,first=true;
    for(const piece of sentence.split(/[，,]|(?:并且|然后|随后|同时|但是|但|并(?=我|你|本人|父|母|他|她))/)){
      const text=clean(piece);if(!text)continue;
      if(/^(?:(?:我|你|本人|自己)(?:想|曾)?(?:问|知道)?\s*)?(?:假如|如果|假设|要是|倘若)|梦见|设想|[?？]/.test(text))conditional=true;
      rows.push({text,conditional,newSentence:first});first=false;
    }
  }
  return rows;
}
function ensure(state){
  state.personalHealth??={version:1,conditions:[],recentChanges:[],pendingTests:[]};
  state.personalHealth.pendingTests??=[];
  return state.personalHealth;
}
function ownClause(state,text,source,inherited=null){
  if(/新闻|报道|研究表明|科普|小说|电影|扮演|角色/.test(text))return false;
  // “我陪母亲检查HIV” and “母亲陪我检查HIV” have different patients.
  const event=text.search(medical),before=event<0?text:text.slice(0,event);
  const actors=[...before.matchAll(new RegExp(`本人|自己|我(?!们)|你(?!们)|${otherPeople}`,'g'))].map(m=>({index:m.index,own:/^(?:我|你|本人|自己)$/.test(m[0])}));
  for(const node of state.relationshipGraph?.nodes||[]){
    if(!node.name)continue;
    for(const match of before.matchAll(new RegExp(escape(node.name),'g')))actors.push({index:match.index,own:node.id==='player'});
  }
  const name=state.profile?.name;if(name)for(const match of before.matchAll(new RegExp(escape(name),'g')))actors.push({index:match.index,own:true});
  actors.sort((a,b)=>a.index-b.index);
  if(new RegExp(`(?:HIV|AIDS|艾滋病|癌症|糖尿病|抑郁症|结核病|骨折|瘫痪).{0,8}的(?:${otherPeople})`,'i').test(text))return false;
  if(/(?:我|你|本人|自己)(?:陪同|陪|带|替|帮)(?!我|你|本人|自己).{1,16}(?:检查|检测|就诊|看病|治疗|确诊)/.test(text))return false;
  if(/(?:确诊|诊断|查出)(?:了|为)?(?:我|你|本人|自己)(?:患|感染|得了)/.test(text))return true;
  if(actors.length)return actors.at(-1).own;
  if(inherited!==null)return inherited;
  return source==='action'&&/^(?:已(?:经)?|刚(?:刚)?|曾(?:经)?|目前|仍然|最近|终于|在医院|经检查|被|去医院|去|做|进行|接受|开始|坚持|按时|持续|预约|安排|停止|中断|不再)?(?:确诊|诊断|查出|患上|患有|患了|得了|染上|感染|HIV|AIDS|艾滋|骨折|截肢|瘫痪|身受重伤|检查|检测|筛查|化验|治疗|服药|吃药|用药|复查|就诊|治愈|痊愈|康复)/i.test(text);
}
function familyContacts(state){
  const graph=state.relationshipGraph||{nodes:[],edges:[]};
  const family=new Set(graph.edges.filter(e=>(e.source==='player'||e.target==='player')&&(['family','partner'].includes(e.kind)||/父|母|家人|亲属|兄|弟|姐|妹|伴侣|配偶|丈夫|妻子/.test(`${e.status} ${e.detail}`))).flatMap(e=>[e.source,e.target]));
  return graph.nodes.filter(n=>n.id!=='player'&&family.has(n.id)&&!n.deceased&&!['deceased','missing'].includes(n.lifeStatus)&&!/已故|去世|身亡|失联|失踪/.test(n.detail||''));
}
function awareContacts(state,text){
  if(uncertain.test(text)||/(?:准备|计划|打算|建议|下个月|下月|将要|希望).{0,16}(?:告诉|告知|通知|坦白|说明|知道|得知)|隐瞒|保密|没告诉|没有告诉|不告诉|尚未告诉|还没告诉|瞒着|不让.{0,8}知道|(?:不|没|未|尚未).{0,3}(?:知道|得知)/.test(text))return [];
  const disclosure='告诉|告知|通知|坦白|说明',knowledge='得知|知道|获知';
  if(!new RegExp(`${disclosure}|${knowledge}`).test(text))return [];
  const graph=state.relationshipGraph||{nodes:[],edges:[]};
  const received=label=>new RegExp(`(?:${disclosure}|向|对|给).{0,10}(?:${label})|(?:${label}).{0,12}(?:${knowledge})`).test(text);
  const ids=graph.nodes.filter(n=>n.id!=='player'&&!n.deceased&&n.lifeStatus!=='deceased'&&n.name&&received(escape(n.name))).map(n=>n.id);
  for(const node of familyContacts(state)){
    const role=node.familyRole||(graph.edges||[]).filter(e=>(e.source==='player'&&e.target===node.id)||(e.target==='player'&&e.source===node.id)).map(e=>e.status+' '+e.detail).join(' ');
    if(received('家人|家里人|全家|亲人')||received('父母|双亲')&&/(?:^|你的|本人的)(?:父亲|母亲|爸爸|妈妈)(?:\s|·|，|。|$)/.test(role)||received('父亲|爸爸')&&/父亲|爸爸/.test(role)||received('母亲|妈妈')&&/母亲|妈妈/.test(role)||received('伴侣|配偶|丈夫|妻子')&&/伴侣|配偶|丈夫|妻子/.test(role))ids.push(node.id);
  }
  return [...new Set(ids)];
}
function diagnosisIn(text,id){
  if(uncertain.test(text)||future.test(text)||negative.test(text)||recovery.test(text))return false;
  if(/(?:了解|询问|咨询|阅读|学习|讨论|研究|查阅).{0,24}(?:HIV|艾滋|癌症|确诊|诊断)|(?:确诊|诊断)(?:检查|检测|流程|标准|方法)|去(?:医院)?确诊/.test(text))return false;
  if(/初筛|初步|待确认|待复查|尚待/.test(text)&&!/复检.{0,10}确诊|最终确诊|已经确诊/.test(text))return false;
  const confirmed=/确诊|诊断为|诊断是|查出|(?:结果|报告|检测|复检).{0,12}(?:为|呈|是)?阳性|(?:HIV|AIDS).{0,8}阳性/i.test(text);
  if(/检查|检测|筛查|化验/.test(text)&&!confirmed)return false;
  if(/预防|避免|防止|担心|传播途径|感染风险/.test(text)&&!confirmed)return false;
  return confirmed||/患上|患有|患了|得了|染上|感染了|感染HIV|感染艾滋|身受重伤/i.test(text)||/^(?:(?:我|你|本人|自己)(?:目前|现在)?(?:是|已经是|已是|已经|已|仍然是)?)?HIV感染(?:者)?(?:了|$)/i.test(text)||id==='injury'&&/骨折|截肢|瘫痪/.test(text);
}
function careIn(text,source){
  if(uncertain.test(text))return null;
  if(/(?:停止|中断|不再|断了).{0,8}(?:治疗|服药|用药|吃药)/.test(text)&&!future.test(text)&&!/(?:没有|没|未|不打算).{0,6}(?:停止|中断|不再|断了)/.test(text))return careLabels.interrupted;
  const blocked=future.test(text)||/(?:尚未|没有|没|未|拒绝|不愿).{0,10}(?:治疗|用药|服药|吃药|就诊|复查)/.test(text);
  if(!blocked&&(/(?:开始|正在|坚持|按时|接受|持续|已经|完成).{0,12}(?:治疗|服药|吃药|用药|手术)|按医嘱服药/.test(text)||source==='action'&&/^(?:我|本人|自己)?(?:去医院)?(?:接受)?(?:治疗|服药|吃药|用药|手术)/.test(text)))return careLabels.active;
  if(/(?:已经|已|成功|完成)?(?:预约|约好|安排好|预约了).{0,12}(?:就诊|治疗|医院|复查)/.test(text)&&!/准备|计划|建议|尚未|没有|取消/.test(text))return careLabels.scheduled;
  if(blocked)return null;
  if(/(?:已经|已|完成|去医院|去|接受).{0,10}(?:复查|就诊)|(?:复查|就诊)(?:了|完成)/.test(text))return careLabels.visited;
  return null;
}

export function recordPersonalHealth(state,{action,response=null,success=true,source='action',month=state.month,turn=state.turn,migrate=false}={}){
  const record=ensure(state),changes=[],previousDiagnoses=record.conditions.filter(c=>c.diagnosedTurn===turn).length;
  if(!migrate)record.recentChanges=source==='response'?[...(record.recentChanges||[])]:[];
  const texts=source==='response'?[{text:response?.consequence,month},{text:response?.narrative,month:state.month}]:success?[{text:action?.label,month}]:[];
  // Graph updates happen after the action preview. Revisit only disclosures to
  // include newly introduced, explicitly told contacts without replaying care.
  if(source==='response'&&success&&state.actionResult?.success!==false)texts.push({text:action?.label,month,disclosureOnly:true});
  for(const entry of texts){
    let inherited=null,contextIds=[];
    for(const row of clauses(entry.text)){
      const text=row.text;if(row.newSentence){inherited=null;contextIds=[];}
      if(row.conditional)continue;
      const resolvedTest=record.pendingTests.length===1&&/(?:报告|结果|检测|复检).{0,15}(?:阴性|阳性|未检出)/.test(text)?record.pendingTests[0]:null;
      const owned=ownClause(state,text,entry.disclosureOnly?'action':source,inherited)||(inherited!==false&&!!resolvedTest&&/^(?:(?:我的|你的)?(?:检查|检测|复检)?(?:报告|结果))/.test(text));
      const named=diseases.filter(([, ,pattern])=>pattern.test(text));
      if(medical.test(text)||new RegExp(`我|你|本人|自己|${otherPeople}`).test(text)||(state.relationshipGraph?.nodes||[]).some(n=>n.name&&text.includes(n.name)))inherited=owned;
      if(named.length)contextIds=owned?named.map(d=>d[0]):['other'];
      if(!entry.disclosureOnly&&owned){
        for(const [id,canonical,pattern] of diseases){
          const explicit=pattern.test(text),relevant=explicit||resolvedTest===id||contextIds.includes(id);
          if(!relevant)continue;
          const isRecovery=source==='action'&&recovery.test(text)&&!recoveryBlocked.test(text)&&!uncertain.test(text)&&!future.test(text);
          if((negative.test(text)&&!isRecovery)||/阴性|未检出/.test(text)){
            if(/阴性|未检出|排除.{0,10}(?:感染|诊断)/.test(text))record.pendingTests=record.pendingTests.filter(test=>test!==id);
            continue;
          }
          if(source==='action'&&explicit&&/检查|检测|筛查|化验/.test(text)&&!uncertain.test(text)&&!/(?:不去|没去|没有|拒绝|取消).{0,8}(?:检查|检测|筛查|化验)/.test(text))record.pendingTests=[...new Set([...record.pendingTests,id])];
          let condition=record.conditions.find(c=>c.id===id);
          if(isRecovery&&(condition||explicit)){
            if(!condition){condition={id,label:canonical,status:'recovered',evidence:text.slice(0,320),care:careLabels.none,knownTo:[]};record.conditions.push(condition);}
            if(condition.recoveredTurn!==turn||condition.status!=='recovered')changes.push({kind:'recovery',id,label:condition.label});
            condition.status='recovered';condition.recoveredMonth=entry.month;condition.recoveredTurn=turn;
            record.pendingTests=record.pendingTests.filter(test=>test!==id);
            continue;
          }
          if(diagnosisIn(text,id)&&(explicit||resolvedTest===id||contextIds.includes(id))){
            const label=id==='hiv'&&/确诊.{0,8}艾滋病|艾滋病期|AIDS/i.test(text)?'艾滋病':canonical;
            if(!condition){
              condition={id,label,status:'active',diagnosedMonth:entry.month,diagnosedTurn:turn,evidence:text.slice(0,320),care:careLabels.none,knownTo:[]};
              record.conditions.push(condition);changes.push({kind:'diagnosis',id,label});
            }else if(condition.status==='recovered'&&(source==='action'||/再次确诊|重新感染|复发|又患上|又得了/.test(text))){
              condition.status='active';condition.diagnosedMonth=entry.month;condition.diagnosedTurn=turn;condition.evidence=text.slice(0,320);condition.care=careLabels.none;
              changes.push({kind:'diagnosis',id,label});
            }
            if(label==='艾滋病')condition.label=label;
            record.pendingTests=record.pendingTests.filter(test=>test!==id);
          }
        }
        const active=record.conditions.filter(c=>c.status==='active'),nextCare=careIn(text,source);
        if(nextCare)for(const condition of active){
          if(!(named.some(d=>d[0]===condition.id)||contextIds.includes(condition.id)||!named.length&&!contextIds.length&&active.length===1))continue;
          // A routine visit or appointment does not undo treatment already begun.
          if(condition.care===careLabels.active&&[careLabels.scheduled,careLabels.visited].includes(nextCare))continue;
          if(condition.care!==nextCare){condition.care=nextCare;condition.careTurn=turn;changes.push({kind:'care',id:condition.id,label:condition.label});}
        }
      }
      const ids=awareContacts(state,text);
      if(ids.length){
        const active=record.conditions.filter(c=>c.status==='active');
        const otherIllness=new RegExp(`(?:${otherPeople})(?:的(?:病情|检查结果)|感染|确诊)`).test(text)||(state.relationshipGraph?.nodes||[]).some(n=>n.id!=='player'&&n.name&&new RegExp(`${escape(n.name)}(?:的(?:病情|检查结果)|感染|确诊)`).test(text));
        const ownIllness=/(?:我|你|本人|自己)(?:的)?(?:病情|确诊|检查结果|感染)/.test(text)||owned&&named.length>0||!named.length&&contextIds.some(id=>id!=='other')||!otherIllness&&!contextIds.includes('other')&&!named.length&&active.length===1&&/病情|检查结果|确诊消息|感染的事/.test(text)&&/(?:我|你|本人|自己).{0,8}(?:告诉|告知|通知|坦白|说明)|^(?:告诉|告知|通知|向|对|给)/.test(text);
        if(ownIllness)for(const condition of active){
          if(named.length&&!named.some(d=>d[0]===condition.id)||!named.length&&contextIds.length&&!contextIds.includes(condition.id)||!named.length&&!contextIds.length&&active.length!==1)continue;
          for(const id of ids)if(!condition.knownTo.includes(id)){condition.knownTo.push(id);changes.push({kind:'disclosure',id:condition.id,label:condition.label,contactId:id});}
        }
      }
    }
  }
  const unique=changes.filter((c,i)=>changes.findIndex(x=>x.kind===c.kind&&x.id===c.id&&x.contactId===c.contactId)===i);
  record.recentChanges=[...(record.recentChanges||[]),...unique].filter((c,i,all)=>all.findIndex(x=>x.kind===c.kind&&x.id===c.id&&x.contactId===c.contactId)===i).slice(-12);
  const diagnoses=unique.filter(c=>c.kind==='diagnosis'),currentDiagnoses=record.conditions.filter(c=>c.diagnosedTurn===turn).length;
  const stress=migrate?0:Math.max(0,Math.min(12,currentDiagnoses*6)-Math.min(12,previousDiagnoses*6));
  if(!migrate&&unique.length&&state.person){
    state.person.facts=[...new Set([...(state.person.facts||[]),...unique.map(c=>`${c.label}：${c.kind==='diagnosis'?'已确诊，后续生活需要考虑就诊与照护':c.kind==='care'?'就诊或治疗安排已有更新':c.kind==='recovery'?'本人已明确恢复':'已向身边的人说明病情'}`)])].slice(-60);
  }
  return {delta:stress?{stress}:{},changes:unique,summary:diagnoses.length?`你收到${diagnoses.map(c=>c.label).join('、')}的确诊消息，需要重新考虑身体、就诊与日常安排，也要决定怎样与身边的人谈起这件事。`:''};
}

export function personalHealthContext(state){
  const record=state.personalHealth;if(!record?.conditions?.length&&!record?.pendingTests?.length)return null;
  const nodes=state.relationshipGraph?.nodes||[],family=familyContacts(state);
  return {conditions:record.conditions.map(c=>({...c,knownTo:c.knownTo.map(id=>nodes.find(n=>n.id===id)).filter(n=>n&&!n.deceased&&!['deceased','missing'].includes(n.lifeStatus)).map(n=>n.name)})),recentChanges:record.recentChanges||[],pendingTests:record.pendingTests||[],family:family.map(n=>({id:n.id,name:n.name,detail:n.detail})),
    instruction:'conditions为有本人诊断依据的持久记录；pendingTests只是安排或等待检测，绝不代表患病。确诊是本人的重大经历：写实际情绪、对生活和未来的考虑、已发生的照护与就诊安排。已知情亲友根据已有关系回应；未告知的人不能凭空得知，陪诊本身也不代表知道结果。不能无视病情继续泛写工资，不自动让所有人歧视，也不让疾病在下月消失。治疗、预约、就诊和康复是不同状态。HIV感染与艾滋病期不同，普通相处不会传播HIV；不要把确诊写成立即失能或必然死亡，不虚构现实治疗方法。'};
}

export function healthFollowup(state,action){
  const ctx=personalHealthContext(state),active=ctx?.conditions.filter(c=>c.status==='active');
  if(!active?.length)return null;
  const recent=ctx.recentChanges.filter(c=>['diagnosis','disclosure','care'].includes(c.kind));
  if(!recent.length&&!action?.passive&&!/病|医院|治疗|服药|检查|复查|家人|父母|身体|感染|HIV/i.test(action?.label||''))return null;
  const c=[...active].reverse().find(item=>recent.some(change=>change.id===item.id))||active.at(-1),known=c.knownTo;
  const diagnosed=recent.some(change=>change.id===c.id&&change.kind==='diagnosis');
  const tense=(state.relationshipGraph?.edges||[]).some(e=>(e.source==='player'||e.target==='player')&&['hostile','estranged','rival'].includes(e.kind)&&known.some(name=>(state.relationshipGraph?.nodes||[]).some(n=>n.name===name&&(n.id===e.source||n.id===e.target))));
  const reaction=known.length?tense?`${known.slice(0,2).join('和')}已经知道这件事，原有的隔阂让谈论病情仍显得困难。你分清可以提出哪些请求，也为暂时得不到帮助的部分另作安排。`:`${known.slice(0,2).join('和')}已经知道你的情况，关心接下来的就诊和生活安排。你说清目前的顾虑，也考虑哪些帮助是自己愿意接受的。`:ctx.family.length?'你想着该怎样和家里谈这件事。尚未说出口的病情留在心里，是否请亲人陪同、怎样说明自己的顾虑，需要你自己决定。':'你开始考虑可以向谁求助，把就诊时间和眼前需要处理的事情逐项记下来。';
  const treatment=c.care===careLabels.active||c.care.startsWith('已开始')?'已经开始的治疗仍需继续，你核对已有的服药、复查与日常安排。':c.care===careLabels.scheduled?'预约已经留下，接下来要按约定就诊，再确认具体的治疗和照护安排。':c.care===careLabels.visited?'这次就诊或复查的记录仍在，你整理已有答复，把尚未确定的治疗与照护事项留下。':c.care===careLabels.interrupted?'此前的治疗或用药已经中断，你需要处理造成中断的困难，再确认后续照护。':'就诊与照护还没有安排妥当，这件事继续影响你对时间和花费的打算。';
  return {title:diagnosed?'确诊消息之后':'身体与生活的安排',narrative:`${diagnosed?`得知${c.label}的情况后，你担心接下来的生活会怎样变化，也反复想着需要先处理什么。`:`${c.label}的情况仍需要照看，你根据身体近况整理接下来的安排。`}${reaction}${treatment}`};
}

export function initializePersonalHealth(state,{legacy=false}={}){
  if(state.personalHealth){
    const h=state.personalHealth;
    if(h.version!==1||!Array.isArray(h.conditions)||h.conditions.length>12||new Set(h.conditions.map(c=>c?.id)).size!==h.conditions.length||h.conditions.some(c=>!c||!diseases.some(d=>d[0]===c.id)||typeof c.label!=='string'||!['active','recovered'].includes(c.status)||!Array.isArray(c.knownTo)||c.knownTo.some(id=>typeof id!=='string')||typeof c.care!=='string')||h.pendingTests!==undefined&&(!Array.isArray(h.pendingTests)||h.pendingTests.some(id=>!diseases.some(d=>d[0]===id))))throw new Error('这份档案的身体经历记录不完整。');
    h.pendingTests=[...new Set(h.pendingTests||[])];
    h.recentChanges=Array.isArray(h.recentChanges)?h.recentChanges.filter(c=>c&&['diagnosis','care','recovery','disclosure'].includes(c.kind)&&diseases.some(d=>d[0]===c.id)).slice(-12):[];return;
  }
  ensure(state);
  if(state.profile?.backgroundText&&!state.profile.lockedPersonaId)recordPersonalHealth(state,{action:{label:state.profile.backgroundText},month:0,turn:0,migrate:true});
  if(legacy){
    for(const [i,h] of (state.history||[]).entries()){
      // Event prose precedes this action; consequence belongs to the action.
      // Migration never replays stats or rewrites the historical narrative.
      recordPersonalHealth(state,{response:{consequence:h.event?.narrative},source:'response',month:h.month,turn:i,migrate:true});
      recordPersonalHealth(state,{action:h.action,success:h.actionResult?.success!==false,month:h.month,turn:i+1,migrate:true});
      recordPersonalHealth(state,{action:h.action,response:{consequence:h.consequence},success:h.actionResult?.success!==false,source:'response',month:h.month,turn:i+1,migrate:true});
    }
    recordPersonalHealth(state,{response:{consequence:state.current?.narrative},source:'response',month:state.month,turn:state.turn,migrate:true});
  }
  state.personalHealth.recentChanges=[];
}
