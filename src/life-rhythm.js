// Narrative attention is temporary. Employment, illness and relationships remain
// in their own records after an errand stops being the centre of each month.
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const hash=value=>{let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const turnOf=state=>Number.isInteger(state?.turn)?state.turn:state?.history?.length||0;
const topics=[
  ['contact_forms','联络表',/联[络絡]表|联系表|連絡表|contact forms?/i],
  ['paperwork','表格与手续',/表格|填表|交表|申请表|申請表|手续|手續|证件|證件/],
  ['band_rehearsal','排练与演出',/排练|排練|合练|合練|演出|乐队|樂隊|rehearsal/i],
  ['schoolwork','课程与考试',/考试|考試|课程|課程|作业|作業|上课|上課|笔记|筆記/],
  ['care','就诊与照护',/确诊|確診|诊断|診斷|HIV|艾滋|治疗|治療|服药|服藥|复查|複查|就诊|就診/i],
  ['work_shift','工作与交接',/排班|交班|交接|上班|打工|工位|配送|外卖|外賣|订单|訂單|工资|工資/],
  ['training','训练与值勤',/训练|訓練|值勤|服役|操练|操練/],
  ['correspondence','联系与探望',/写信|寫信|会面|會面|探望|探视|探視|信件|通话|通話/],
  ['housing','住处与生活设施',/住房|住处|住處|搬家|租房|房租|修理|维修|維修/],
  ['money','收支与储蓄',/收入|支出|借款|还款|還款|存钱|存錢|储蓄|儲蓄|积蓄|積蓄/],
  ['creative','创作与兴趣',/创作|創作|作品|摄影|攝影|画画|畫畫|唱歌|乐器|樂器/],
  ['outdoors','出行与休闲',/出游|出遊|散步|旅行|公园|公園|郊外|球赛|球賽/],
  ['public','公共事务',/政策|公共|主席|总统|總統|首相|议会|議會|政府|选举|選舉/],
];
const topicFor=text=>topics.find(([, ,pattern])=>pattern.test(clean(text)))?.[0]||'';
const labelFor=key=>topics.find(([id])=>id===key)?.[1]||key;
const taskTopics=new Set(['contact_forms','paperwork']);
const completed=/办妥|辦妥|办完|辦完|做完|结清|結清|收齐|收齊|交齐|交齊|填完|填好|交好|交完|全部交|已经交|已交|已经收|已收|送达|送達|交到|交给|交給|递交|遞交|信息齐全|資料齊全|没有缺项|沒有缺項|完成(?:了)?(?:申请|申請|填报|填報|手续|手續|核对|核對)|已获批准|已獲批准|(?:handed|turned) in|all (?:submitted|collected)|completed/i;
const unfinished=/还没|還沒|尚未|仍未|未交|没交|沒交|未收|没收|沒收|没有交|沒有交|需要补|需要補|还需|還需|待办|待辦|等待(?:答复|答覆|回复|回覆|审批|審批)|仍需(?:提交|递交|遞交)|not yet|still waiting/i;
const newBatch=/新一(?:批|份|轮|輪)|另一(?:批|份)|下(?:一)?(?:批|份)|重新申请|重新申請|新的(?:申请|申請|表格|联络表|聯絡表)|new (?:batch|form|application)/i;
const sentences=text=>clean(text).split(/[。！？!?；;]/).filter(Boolean);
const eventTopic=event=>topicFor(event?.title)||topicFor(sentences(event?.narrative||event?.diary)[0]);
const taskObject=(text,topic)=>topic==='contact_forms'?'联络表':clean(text).match(/报名表|報名表|申请表|申請表|登记表|登記表|签证|簽證|护照|護照|身份证|身份證|户籍|戶籍|学籍|學籍|报名|報名|入学|入學|贷款|貸款|租房|表格|手续|手續|证件|證件/)?.[0]||'';

export function completedLifeTasks(text){
  return sentences(text).flatMap(sentence=>{
    const topic=topicFor(sentence);
    // Close only a concrete, completed errand; not a career, illness or project.
    if(!taskTopics.has(topic)||!completed.test(sentence)||unfinished.test(sentence)||/准备|準備|打算|计划|計劃|将要|將要|如果|假如|希望|是否|能否|有没有|有沒有|问你|問你|询问|詢問/.test(sentence))return [];
    return [{topic,object:taskObject(sentence,topic),label:labelFor(topic),evidence:sentence.slice(0,220)}];
  });
}

function snapshot(event,action,resolution,turn){
  return {turn,eventId:clean(event?.dailyId).slice(0,100),category:clean(event?.dailyCategory||event?.category).slice(0,60),topic:eventTopic(event),title:clean(event?.title).slice(0,100),passive:!!action?.passive};
}

function fromHistory(state){
  const history=state.history||[],recent=[],closedThreads=[];
  for(let i=Math.max(0,history.length-12);i<history.length;i++){
    const h=history[i];recent.push(snapshot(h.event,h.action,h.actionResult,i));
    for(const task of completedLifeTasks([h.event?.narrative,h.consequence].filter(Boolean).join(' ')))closedThreads.push({...task,turn:i});
  }
  const now=turnOf(state);
  if(state.current)recent.push(snapshot(state.current,history.at(-1)?.action,state.actionResult,now));
  for(const task of completedLifeTasks([state.current?.narrative,state.current?.consequence].filter(Boolean).join(' ')))closedThreads.push({...task,turn:now});
  let passiveStreak=0;for(let i=history.length-1;i>=0&&history[i].action?.passive;i--)passiveStreak++;
  return {version:1,lastTurn:now,recent:recent.slice(-12),closedThreads:closedThreads.slice(-12),openThreads:[],passiveStreak};
}

function readRhythm(state){
  const value=state?.lifeRhythm;
  if(!value||value.version!==1||!Array.isArray(value.recent)||!Array.isArray(value.closedThreads)||!Array.isArray(value.openThreads))return fromHistory(state||{});
  return value;
}

export function initializeLifeRhythm(state){
  const value=readRhythm(state),now=turnOf(state);
  state.lifeRhythm={version:1,lastTurn:Number.isInteger(value.lastTurn)?value.lastTurn:now,
    recent:value.recent.filter(r=>r&&Number.isInteger(r.turn)&&r.turn<=now).slice(-12),
    closedThreads:value.closedThreads.filter(r=>r&&taskTopics.has(r.topic)&&typeof r.evidence==='string').slice(-12),
    openThreads:value.openThreads.filter(r=>r&&typeof r.text==='string'&&Number.isInteger(r.expiresTurn)&&r.expiresTurn>=now).slice(-3),
    passiveStreak:Math.max(0,Math.min(100,Number(value.passiveStreak)||0))};
  return state.lifeRhythm;
}

export function lifeEventWeight(state,event){
  const {recent,closedThreads}=readRhythm(state),now=turnOf(state),topic=eventTopic(event),category=event.dailyCategory||event.category;
  let weight=1;
  for(const old of recent){
    const gap=now-old.turn;if(gap<0||gap>7)continue;
    if(event.id&&old.eventId===event.id)weight*=gap<4 ? .04 : .3;
    if(topic&&topic===old.topic&&gap<3)weight*=gap<2 ? .16 : .5;
    if(category&&category===old.category&&gap<2)weight*=.45;
  }
  if(taskTopics.has(topic)&&closedThreads.some(t=>t.topic===topic&&now-t.turn<6))weight*=.06;
  // The seed affects variety while a failed network request keeps the same draw.
  return Math.max(.0001,weight*(.85+hash(`${state.seed}:life-variety:${now}:${event.id||event.title}`)%301/1000));
}

export function lifeRhythmContext(source,target,action,nextEvent){
  const rhythm=readRhythm(source),now=turnOf(target),passive=!!action?.passive;
  const threads=rhythm.openThreads.filter(t=>t.expiresTurn>=now&&now-t.turn<=2);
  const pausedThreads=rhythm.openThreads.filter(t=>t.expiresTurn<now&&now-t.expiresTurn<=1).map(t=>({text:t.text,topic:t.topic}));
  const actionTopic=topicFor(action?.label),reopened=action&&!passive?new Set([actionTopic]):new Set();
  const closed=rhythm.closedThreads.filter(t=>!reopened.has(t.topic)&&now-t.turn<=6).slice(-6);
  const recent=rhythm.recent.slice(-5).map(({title,topic,category,eventId})=>({title,topic,category,eventId}));
  return {mode:passive?'new_event':'action_then_development',passiveStreak:passive?(rhythm.passiveStreak||0)+1:0,
    nextEvent:nextEvent?{id:nextEvent.dailyId,category:nextEvent.dailyCategory||nextEvent.category,topic:eventTopic(nextEvent),title:nextEvent.title,description:clean(nextEvent.narrative).slice(0,1200)}:null,
    recent,closedThreads:closed,openThreads:threads,pausedThreads,
    instruction:passive?'本月主要写新发生的一件事，采用nextEvent中的新题材和具体变化；已有工作、疾病、关系和身份继续有效，但只在确实影响新事件时简短带入。上次交齐的表格、办完的手续保持办结，不能又催同一批材料。短期未完事项最多承接两个月，pausedThreads没有新答复时暂缓跟进，不能虚构已经完成，也不能无限占据正文。不得重复上月过程。':'重点交代本人刚做的行动、结果与影响，已完成的步骤到此办结。下一段只写新的结果或反应，不再复述行动过程，也不把已经交齐的东西说成尚未交齐。长期工作和项目继续存在不等于每月只能写同一件琐事。'};
}

export function recordLifeRhythm(state,event,action,resolution=state.actionResult){
  const rhythm=initializeLifeRhythm(state),now=turnOf(state);
  // Called only for a committed month. Replacing the same turn is idempotent.
  const isNew=rhythm.lastTurn!==now;
  rhythm.recent=[...rhythm.recent.filter(r=>r.turn!==now),snapshot(event,action,resolution,now)].slice(-12);
  const closure=completedLifeTasks([event?.consequence,event?.narrative,resolution?.summary].filter(Boolean).join(' '));
  for(const task of closure)rhythm.closedThreads=[...rhythm.closedThreads.filter(t=>t.topic!==task.topic),{...task,turn:now}].slice(-12);
  const ended=new Set(closure.map(t=>t.topic));
  rhythm.openThreads=rhythm.openThreads.filter(t=>t.expiresTurn>=now&&!ended.has(t.topic));
  if(action&&!action.passive){
    const text=clean(action.label),topic=topicFor(text);
    // A failed attempt or an explicitly pending request may get one brief follow-up.
    // An occupation or a generic "continue living" is never an unfinished task.
    if(text&&(resolution?.success===false||unfinished.test(event?.consequence||resolution?.summary||''))&&!ended.has(topic)){
      rhythm.openThreads=[...rhythm.openThreads.filter(t=>t.topic!==topic),{text:text.slice(0,200),topic,turn:now,expiresTurn:now+2}].slice(-3);
    }
  }
  if(isNew)rhythm.passiveStreak=action?.passive?(rhythm.passiveStreak||0)+1:0;
  rhythm.lastTurn=now;
  return rhythm;
}

export function lifeTaskIssues(response,context){
  const closed=[...(context?.rhythm?.closedThreads||[]),...completedLifeTasks(response?.consequence),...completedLifeTasks(response?.narrative)],issues=[];
  const rows=sentences(response?.narrative);
  for(const task of closed){
    const contradiction=rows.some(sentence=>{
      if(newBatch.test(sentence))return false;
      const topic=topicFor(sentence);
      const object=taskObject(sentence,topic),oldObject=task.object||taskObject(task.evidence,task.topic);
      const same=topic===task.topic&&(topic==='contact_forms'||object&&object===oldObject)||task.topic==='contact_forms'&&topic==='paperwork'&&/那份|这份|同一批|她们还没|她们没有|她們還沒|她們沒有/.test(sentence)&&/表/.test(sentence);
      return same&&unfinished.test(sentence)&&/(?:交|收|补|補|提交|填|催)/.test(sentence);
    });
    if(contradiction){issues.push(`“${task.label}”已有办结记录，不能把同一批东西重新写成没交、没收齐或等待补交；保留完成事实，改写新的后续或其他新事。`);break;}
  }
  const rhythm=context?.rhythm,focus=topicFor(response?.title)||topicFor(rows[0]),selected=rhythm?.nextEvent?.topic;
  const repeated=rhythm?.recent?.slice(-3).filter(r=>r.topic===focus).length||0;
  if(context?.passive&&focus&&selected&&focus!==selected&&repeated>=2&&!(context.personalHealth?.recentChanges||[]).some(c=>c.kind==='diagnosis')&&!context.encounter){
    issues.push('这件事已连续占据最近月份，当前只按了下个月。请采用本月已经选出的新事件，将稳定的职业、关系和病情保留为背景，写出新的经历与结果，不能再次把旧题材续写成整月主线。');
  }
  return issues;
}
