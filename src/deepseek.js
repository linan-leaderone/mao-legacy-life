import {enactedPolicyContext} from './policies.js';
import {adultRelationshipsAllowed,unsafeIntimacyContext} from './adult-relationships.js';
import {scenarioContext} from './scenario.js';
import {dateLabel,currentAge,validateResponse,worldHistory,nextContext} from './engine.js';
import {regionContext,culturalContext} from './regions.js';
import {getModContext} from './mod-content.js';
import {WRITING_RULES} from './narrative.js';
import {normalizeLanguage,languageInstruction,writingRulesForLanguage} from './language.js';
import {requestJSON} from './api-transport.js';
import {specialPromptContext} from './special-lives.js';
import {getPoliticalActors} from './personas.js';
import {buildContinuityContext} from './continuity.js';
import {countryRegionNames} from './countries.js';

const ENDPOINT='https://api.deepseek.com';
export const DEFAULT_MODEL='deepseek-flash';
const STATS=['intelligence','family','fitness','appearance','influence','health','funds','connections','stress','morality','promiscuity','charisma'];
function relationshipPromptContext(state,action){
  const graph=state.relationshipGraph||{version:1,nodes:[],edges:[]},query=String(action?.label||'').toLowerCase();
  const nodes=[...graph.nodes].sort((a,b)=>Number(b.id==='player')-Number(a.id==='player')||Number(query.includes(String(b.name).toLowerCase()))-Number(query.includes(String(a.name).toLowerCase()))||Number(b.lastContactMonth||0)-Number(a.lastContactMonth||0)).slice(0,96),ids=new Set(nodes.map(node=>node.id));
  const edges=graph.edges.filter(edge=>ids.has(edge.source)&&ids.has(edge.target)).sort((a,b)=>Number(b.source==='player'||b.target==='player')-Number(a.source==='player'||a.target==='player')||Number(b.updatedMonth||0)-Number(a.updatedMonth||0)).slice(0,256);
  return {version:1,nodes,edges,omittedPeople:Math.max(0,graph.nodes.length-nodes.length)};
}
// Documentation for callers and tests; DeepSeek JSON mode uses json_object, not this schema.
export const responseSchema={
  type:'object',required:['title','narrative','consequence','location','memory','actionDelta','options'],
  properties:{
    title:{type:'string'},narrative:{type:'string'},consequence:{type:'string'},location:{type:'string'},memory:{type:'string'},
    actionDelta:{type:'object',properties:Object.fromEntries(STATS.map(k=>[k,{type:'integer'}]))},
    personUpdate:{type:'object',properties:{occupation:{type:'string'},status:{type:'string'},ideology:{type:'string'},...Object.fromEntries(['skills','projects','relationships','facts'].map(k=>[k,{type:'array',items:{type:'string'}}]))}},
    worldUpdates:{type:'array',maxItems:4,items:{type:'object',required:['region','kind','title','description'],properties:{region:{enum:[...new Set([...Object.keys(countryRegionNames),'global'])]},kind:{enum:['war','peace','victory','leadership','public']},title:{type:'string'},description:{type:'string'},leader:{type:'string'},government:{type:'string'},ideology:{type:'string'},conflict:{type:['string','null']}}}},
    relationshipUpdates:{type:'array',maxItems:12,items:{type:'object',required:['target','status','detail'],properties:{source:{type:'string'},target:{type:'string'},status:{type:'string'},detail:{type:'string'},strength:{type:'number',minimum:0,maximum:100}}}},
    newsTranslations:{type:'array',maxItems:24,items:{type:'object',required:['id','title','description'],properties:{id:{type:'string'},title:{type:'string'},description:{type:'string'}}}},
    options:{type:'array',maxItems:5,items:{type:'object',required:['label','description','delta'],properties:{
      label:{type:'string'},originalLabel:{type:'string'},description:{type:'string'},delta:{type:'object'},
      check:{type:'object',properties:{stat:{enum:STATS},difficulty:{type:'number'},stakes:{type:'number'}}}
    }}}
  }
};

export function buildPrompt(s,action,lore,_major=null){
  const context=nextContext(s,lore,action),target=context.state,language=normalizeLanguage(target.profile.language);
  const locality=regionContext(target,lore),presentAge=currentAge(target),actionAge=currentAge(s);
  const specialLife=specialPromptContext(target);
  const continuation=buildContinuityContext(s,target,action,target.actionResult);
  const declarations=target.actionResult?.declarations||null,timeTravel=Number.isInteger(declarations?.dateMonth);
  const intimacyAllowed=adultRelationshipsAllowed(target,presentAge.years*12+presentAge.months)&&adultRelationshipsAllowed(s,actionAge.years*12+actionAge.months)&&!unsafeIntimacyContext(action.label);
  const canSuggestWorldUpdates=!!action.custom&&!action.passive&&target.actionResult?.success===true&&!!declarations?.facts?.length;
  const example={title:'本月的安排',narrative:'交代行动之后的个人生活，句子完整连贯。',consequence:'具体写本人本月做了什么、怎样做到、结果和实际影响。',location:target.location,memory:'只记录本月新发生的长期事实，没有则留空。',personUpdate:{occupation:target.person.occupation,status:target.person.status,ideology:target.person.ideology||'',skills:[],projects:[],relationships:[],facts:[]},worldUpdates:[],relationshipUpdates:[],newsTranslations:[],actionDelta:{},options:context.decision?[{label:'继续完成手头的工作',description:'先处理已有安排中的具体事项。',delta:{intelligence:1}},{label:'联系熟悉的人商量',description:'了解能够获得的资源与帮助。',delta:{connections:1}},{label:'留出休息和整理的时间',description:'按目前身体与生活情况安排。',delta:{stress:-2}}]:[]};
  const system=`${languageInstruction(language)} 你记述此人的生活，当前时间、年龄、身份、所在地及已发生的政治社会事实由输入提供。直接写事情，不做主持人、规则解释者或道德评论者。${specialLife?'本人的特殊身体经历以specialLife为依据，其复活或吞噬进化均已真实发生，允许该经历明确包含的魔幻变化；其他社会人物与新闻仍按既定环境发展。':'背景以生活、政治与可解释的科技为主，不主动增加修仙和魔法。'}
+${writingRulesForLanguage(language,WRITING_RULES)}
+freedom为unlimited时，以本人肯定陈述的已完成行动为事实；influential时也让肯定行动成立，补足组织、资源和社会反应；grounded时按照actionOutcome.success与已给出的结果写。不要在正文解释这些名称。actionOutcome.declarations列出的时间旅行、年龄变化、职务、战争与停火已经在currentIdentity、targetDate和worldOverrides生效，必须承认，不能改写成愿望、预演、幻觉、梦境、骗局或将来的计划。未被改变的记忆、关系和已完成项目仍持续存在。turn只用于内部经历顺序，不在正文称作轮次。
+identity是本人的性别、生理身体描述、族裔/物种、国籍/势力及自定义补充。姓名、这些字段及用户给出的描述逐字保留；允许非人类族裔与非地球势力，按明确的身体与文化设定写生活，不能替换成普通人类背景。出生地、现居地和国籍是独立概念；所在地制度与本人所属势力分别处理。不能仅凭性别、族裔或国籍推断智力、能力、性格、职业、道德、性取向或亲密意愿。公开人物有明确身份覆盖时，以这一段人生中的自定义身份继续，不宣称这是现实传记。未说明的字段保持未知，不猜测。
+currentAgeYears/currentAgeMonths是targetDate的当前年龄；actionAgeYears是actionDate行动发生时的周岁。每一次都按这些字段写。initialBackground只描述2020年初，不得把初始年龄、最初职业或旧记忆里的年龄当作现在。currentIdentity和stats已经包含本次行动前后变化，新的职业、身体情况、拘押状态、项目与亲友关系应持续生效。不要在每个月重复报年龄；需要提年龄时只能用当前对应日期的值。不要让已经参军的人下一月仍作为尚未入伍的学生，也不要让普通生活自动恢复旧身份。
+currentIdentity.ageOverride存在时，currentAgeYears/currentAgeMonths就是改变后的当前年龄，绝不从旧生日、原身体年数或旧档案倒推恢复初始年龄。specialLife存在且没有ageOverride时，currentAge可表示原人物的历年年龄，不能据此判定当前身体已经衰老或死亡；bodyAge说明身体年龄。specialLife.stage、body、resurrected及actionOutcome.specialTransition是已经发生的身体事实，不能倒退，也不能擅自把鱼写成人、把棺内意识写成正在上班的老人。按instruction连续写下去，不把经历解释为梦境或比喻。birthdayPrecision为month/year/estimated且没有ageOverride时，只写约多少岁，不能声称确定生日。身体变化只写人物经历，不提供现实复活实验、伤害他人或操作危险装置的步骤。
+scenario若存在，其已发生事实优先于2020年现实档案。借魂状态以scenario.personalRule为准，不制造第二个独立身体。personalOpportunity若存在，只是当前收到的成年人交往邀请，不代表同意或已发生关系。主要正文仍围绕本人这次行动；不适用时可不写该邀请。
+openingRecord说明人物资料的边界，仅作为写作依据，不把说明本身写进正文。未核实的亲属、家庭财产、生日、疾病和犯罪指控不能自行补成现实事实；不可根据姓名把2020年以后的实际任职、事件、死亡或网络梗强行提前。生涯领域不代表2020年已经拥有某一具体官职或已成名。用户提供的约定背景从当时生活继续，未来按本人的行动与已发生局势发展，不强制重演现实悲剧。
+currentIdentity.deceased存在时，本人已经在targetDate身亡。narrative写最后发生的事、确认消息及留下的事务，不继续写本人办公、谋生或准备下个月；不能自行复活或改成他人冒名。consequence仍只写此前actionDate已经完成的行动。options固定为空数组，personUpdate保持既有身亡记录与身份，不补写新的职业。
+通常consequence写actionDate内的行动过程，narrative写进入targetDate后的生活。timeTravel=true时，consequence可以写从actionDate出发并已抵达arrivalDate，narrative完全采用targetDate对应年代；保留出发前身体年龄，除非同一行动明确改变年龄。1976年等历史年月不能套用2020年的疫情、智能手机、当时尚未担任的职位或尚未成立的政党。news是在targetDate收到的消息，不能倒写成出发前已发生的事；worldHistory只提供目标年代可用的已知历史。同一行动不要在两段重复。consequence承担主要篇幅，具体呈现本人行动与已落实的结果；narrative只写一项由此造成的新反馈或待办，不再重复领工资、核对同批单据、捕食长大或说明相同的约定。currentIdentity写明已经入伍受训、入职或任职时，应写实际训练、工作和履职，不退回仅有意愿、咨询报名或等待录用；只有输入中的明确失败或新变故才能改变已经完成的身份。
+continuation是这次续写的主线。narrative按照所选语言的篇幅要求，从刚完成的行动结果接着写，第一句就交代它带来的具体后续：接续哪项工作、谁来答复、哪些材料待处理、怎样使用所得或照看伤势。后面的句子写处理方式与当前条件。大部分篇幅必须与continuation.thread、outcome或已经建立的项目和关系有因果联系；不要把consequence换词复述，也不要接一段无关的散步、读书、吃饭或泛泛“又过了一个月”。已经在consequence交代的工资金额、捕获数量和已完成行动，不要在narrative再报一次；直接写这些成果怎样影响下一步。被动生活也要沿用最近的未完事项与已有职业。只有本人主动转向或直接影响本人的突发事件，才切换叙事主线，切换时写清它怎样打断原来的事。previousNarrative和previousConsequence用于避免重写上月整段，不能覆盖本次实际结果。
+continuation.fishHarvest若存在，是刚完成觅食的实际结果：eaten=0就没有捕获、growth=0就没有这次进食带来的长大，不能虚构大量进食或身体增强。海中身体初始为水滴鱼，没有鳞片；除非本人已明确改变身体，不增加鳞片、獠牙或无依据的新器官。narrative应写猎物移动、躲藏处变化、需要休息或下一处觅食条件，不再重复苏醒和进化过程。encounterState与actionOutcome.encounterGame/encounterSummary给出实际遭遇、装备、伤势和感染；不能取消已发生的受伤、补回消耗品、把感染写成免疫或额外结算工资。战斗结果中的outcome、healthAfter、damageTaken、healingReceived、ammoUsed、kills与allyLosses是实际发生的事实；只按这次交锋的范围写撤退、守住位置或结束交锋，不把一场街头冲突自动写成全国战争获胜。伤害与包扎分别成立，包扎不消除已发生的感染；human战斗不会凭空新增丧尸感染。交锋发生在行动所属月份，内部回合与一分钟计时不能推进额外的日历月。工作小游戏之后写这次工作的交接、困难和已经到账的收入，其奖金只认monthlyLedger。
+localSituation是本月所在地的制度与生活依据。中国大陆各省、香港、澳门、台湾、日本和韩国分别使用当地制度、职业、学校、办事机构与日常词汇，不能把大陆的党支部、干部晋升、居委会、封控、抗议等套到其他地区。普通台湾、日本、港澳人物不能默认属于大陆党政体系。移居后按新地区生活；公开人物以其当前职务、权限和已发生变动为准。currentIdentity.custody为true时，日常场景受拘押条件约束，不能自行走到街上、回家或办公。
+news的exposure说明对本人所在地的实际影响：none/remote是远方消息，不造成当地洪水、封城、停学、拘押、生活压力或收入损失。indirect只写对应的有限连带影响，direct才允许描述本地实际变化。河南洪灾不能淹到台湾、日本；大陆防疫抗议不能让台湾居民被大陆基层机关管制。报道中“全国”“政府”指报道所属地区，不自动指本人所在地。news独立展示，不占用个人行动，正文不复述整份新闻。worldHistory与modContext只包含已经发生的事实，不猜未来人物、政变或终局，不把已结束的战争写成仍在持续。
+action是本人本月的具体安排。手动行动优先写行动的实施、结果、代价、别人反应和后续影响；不要用几句空泛的学习、写信或散步替代。actionOutcome.playerLed=true时，接受本人写下的大胆甚至离奇行动，补足因果、帮助者、资源、已有准备或可解释的技术途径，让其在叙述中实际发生。不能把行动改成做梦、幻想、误会、没胆量或直接否定；不要机械用年龄、影响力低或概率否定。quality=costly表示办成的过程更费资源、需要协作或留下后续问题，仍要写出实际成果。对世界的影响按scope/worldDelta及已知局势写，不能同时宣布互相矛盾的胜者；已有事实不能被悄悄抹掉。
+actionOutcome.playerLed=false时按success与quality写结果。action.passive=true只延续当前生活、身份及已展开的工作，不替本人发起新政变、结婚或迁居。actionDelta固定为{}，属性与新闻影响已在输入stats中结算，不重复增加。资金、健康、体力的变化以actionOutcome.delta与stats为准；不能把小额支出写成耗尽积蓄，不能无健康损失就写重伤。大目标所需资金可由合作者、借用设备或外部资源补足，写清来源。personUpdate只记录这次已经发生、和本人行动直接相关的职业、身份、技能、项目、关系或事实变化；各数组是简短字符串，不重新填写开局资料。不凭空抬高职位、恢复失去的职务或解除拘押。
+statChanges逐项列明本次实际变化及原因，monthlyLedger给出真实收入与开支。人物正在打工且有工资入账时，要把工作、所得与支出接起来写，不声称资金未变，也不额外编出未结算的金额。morality体现行为的道德记录，charisma体现交际和表达，不能据单个数值替人物下终身评价；person.ideology是当前意识形态偏好，政治选择可改变它。promiscuity仅描述成年人的非专一亲密关系倾向，不是任何人的同意，也不代表实际发生性行为。intimacyAllowed=false时不写性化身体、性行为或成人亲密安排，不依据历史身份推定儿童身体成年；true时也仅写双方成年、自愿的非露骨关系与社会后果，不描述性器官和性行为过程。
+politicalActors是目前已公开人物的立场、组织目标和关系。依据他们现在的资源与动机写支持、犹疑、合作、反对和社会反应，不强迫所有人同一种情绪。毛泽东苏醒或公开活动后，可以出现左派的激动、一些人的高兴、当权者或利益相关者的担忧；是否已经公开以news/currentIdentity为准，棺内尚未被发现时不能全国得知。立场和关系允许在已发生的接触与选择后变化，不把未来阵营和终局提前写出。当地government、leader、conflict以localSituation和worldOverrides为准，conflict=null表示主要战争已结束。
+relationshipGraph只包含本人已经实际接触的人与有证据的关系。relationshipUpdates可选，默认[]，最多12条。每条使用{source:"player"或已认识人物的原名,target:"本月实际接触或已认识的人物原名",status:"所选语言的简短关系状态",detail:"具体接触或关系改变的证据",strength:0到100}。只有本月实际会面、通信、对话、合作或冲突才能新增联系，新闻报道、网上名单、远程评论、仅听说名字不算。名字保持原称，不翻译成另一姓名。新人物必须确实出现在本月个人行动或后果中，不能为填充图谱随机造人。熟人之间新增关系须双方都已与本人接触，且有强关系的具体证据；知道的关系才显示，未来关系不得提前。输入中已有的联系不因没有本月更新而消失。
+newsTranslations只翻译输入news中已有id的本月报道，使用{ id, title, description }，按所选语言或文风表达。保持人物原名、真实时间、地区、领导、胜负、影响和叙述确定性，不追加事件、不改变影响、不把远方新闻改成本地灾难。language=zh-CN时可为[]。本字段仅作显示翻译，不能修改世界记录。
+worldUpdates可选，默认[]。只有canSuggestWorldUpdates=true，肯定且成功的自定义行动确实造成新的公共事实，且actionOutcome.declarations.worldChanges或news未覆盖时，才补充最多4条。每项使用region、kind（war/peace/victory/leadership/public）、title、description，可选leader/government/ideology/conflict。写事件发生后的公开事实与社会影响，不写路线或机制。战争、停火、胜利和政权变更必须是本人行动明确造成的结果，不能因为月份、随机想法或某人的意识形态擅自发动；普通工作、谈话、照常生活不能被升级成国家战争。已由本地落实的事实不要重复生成，更不能用新的胜者或职务覆盖。没有明确公共后果或action.passive=true必须[]；尚在筹备的事不得写成已经开战或已经获胜。
+当actionOutcome.playerLed=true且本人明确写了已造出、完成、登上、开设或成为某种身份，这些明确写出的结果须在actionDate当月成立，不能降格为只有申请、构思、底盘测试或将来准备。补出此前未叙述的筹备、合作者与资源帮助，交代如何完成本人列出的各件事。只有本人写的是研究、筹备或尝试时，才把大目标保留为进行中的项目，保存已完成的步骤。
+culture.matches用于理解本人提到的当时网络用语，合适才自然使用。不要强塞梗，不辱骂现实中的群体。culture.anachronisms标出的说法在当时尚未流行；如果本人主动这样说，可以作为这个人的新说法理解，不宣称全网早已知道。不编造梗的流行年代。
+decision=false时options必须是空数组[]，无需制造待决定的悬念。decision=true给3–5项不同的具体安排，和人物当前身份、地点、能力及已做之事一致。language为en/ja/ko/zh-TW/martian时，每项另含originalLabel，以简体中文简明准确表达同一具体行动供身份、职业与地点解析，label与description仍使用所选语言；originalLabel不得额外添加展示选项没有说的行动。每项delta只描述选择后可能变化，通常非资金±1–5，资金与当前生活条件相称；可含check:{stat,difficulty}，stat只可为${STATS.join('/')}。不要在选项文字解释概率和数值。
+title、narrative、consequence、memory、worldUpdates和选项不得使用玩家、游戏、本局、触发节点、路线分支、系统判定、成功率、属性加成、回合结算、开发者等局外解释，不写免责声明。日期由targetDate决定，不另行改变已经落实的时间旅行或再跨月份。currentPosition是本人实际到达的地区，coordinates仅为该行政区示意中心，不可当作精确街道坐标；位置未知时不得编造县名。location必须保持输入所在地，已完成迁居由actionOutcome.destination给定。仅输出完整JSON，不写Markdown，不输出密钥，结构：${JSON.stringify(example)}`.replace(/^\+/gm,'');
  const payload={targetDate:dateLabel(target.month),actionDate:dateLabel(s.month),currentAgeYears:presentAge.years,currentAgeMonths:presentAge.months,ageMonths:presentAge.years*12+presentAge.months,actionAgeYears:actionAge.years,
    language,identity:target.profile.identity||{},relationshipGraph:relationshipPromptContext(target,action),
    profile:{language,name:s.profile.name,birthPlace:s.profile.birthPlace||s.profile.place,goal:s.profile.goal,narrative:s.profile.narrative},freedom:s.profile.freedom||'influential',turn:target.turn,timeTravel,arrivalDate:timeTravel?dateLabel(target.month):null,intimacyAllowed,canSuggestWorldUpdates,birthdayPrecision:s.profile.birthDatePrecision||'day',openingRecord:s.profile.persona?{asOf:'2020-01-01',sourceConfidence:s.profile.persona.sourceConfidence||s.profile.persona.birthDateConfidence,uncertainties:(s.profile.persona.notes||[]).slice(0,5)}:null,specialLife,scenario:scenarioContext(target),personalOpportunity:target.personalOpportunity||null,territoryStatus:target.territoryStatus||null,enactedPolicies:enactedPolicyContext(target),lifeEnded:target.ended,initialBackground:{asOf:'2020-01-01',description:s.profile.backgroundText},currentIdentity:target.person,location:target.location,currentPosition:target.position||null,stats:target.stats,statChanges:target.statChanges||[],monthlyLedger:target.monthlyLedger||[],worldOverrides:target.worldOverrides||{},politicalActors:getPoliticalActors(target).filter(actor=>actor.autonomyEligible!==false),localSituation:locality,decision:context.decision,
    worldHistory:worldHistory(timeTravel?target:s,lore).slice(-60).map(e=>({date:dateLabel(e.month),region:e.region,title:e.title,description:e.description})),news:context.news.map(e=>({id:e.id,title:e.title,description:e.description,region:e.region,exposure:e.exposure,impact:e.impact})),
    modContext:getModContext(target,lore,{region:locality.region,query:action.label,limit:6}),culture:culturalContext(target,action.label),continuation,encounterState:target.encounterState||null,
    currentPersonalEvent:{title:s.current.title,narrative:s.current.narrative},action:{label:action.label,custom:!!action.custom,passive:!!action.passive},actionOutcome:target.actionResult,pinnedFacts:s.pins,longTermMemory:s.memories.map(m=>({date:dateLabel(m.month),text:m.text})),recentHistory:s.history.slice(-8).map(h=>({date:dateLabel(h.month),title:h.event.title,action:h.action.label,consequence:h.consequence||h.actionResult?.summary||''}))};
  return {system,user:JSON.stringify(payload),decision:context.decision,validationContext:{language,ageYears:presentAge.years,priorAgeYears:actionAge.years,name:s.profile.name,region:locality.region,occupation:target.person.occupation,month:target.month,priorMonth:s.month,specialLife,timeTravel,declarations,ageOverride:target.person.ageOverride,intimacyAllowed,canSuggestWorldUpdates,location:target.location,actionPassive:!!action.passive,continuation}};
}

async function request(path,key,body,signal){
  if(!key?.trim())throw new Error('请先在设置中填写 DeepSeek API Key。');
  return requestJSON(`${ENDPOINT}/${path}`,{headers:{Authorization:`Bearer ${key.trim()}`},body,signal,label:'DeepSeek',modelQuery:path==='models'});
}
export async function listModels(settings,signal){
  const response=await request('models',settings.apiKey,undefined,signal);
  return (response.data||[]).map(m=>m.id).filter(id=>typeof id==='string'&&/^deepseek-[a-zA-Z0-9._-]+$/.test(id));
}
export async function generateMonth(s,action,lore,major,settings,signal){
  const model=settings.model||DEFAULT_MODEL;
  if(!/^deepseek-[a-zA-Z0-9._-]+$/.test(model))throw new Error('请使用有效的 DeepSeek 模型名称。');
  const prompt=buildPrompt(s,action,lore,major);
  const messages=[{role:'system',content:prompt.system},{role:'user',content:prompt.user}];
  for(let attempt=0;attempt<2;attempt++){
    const response=await request('chat/completions',settings.apiKey,{model,messages,response_format:{type:'json_object'},thinking:{type:'disabled'},temperature:0.95,max_tokens:6000,stream:false},signal);
    const choice=response.choices?.[0];
    if(choice?.finish_reason==='length')throw new Error('这段文字未能写完，时间仍停留在原处，请重试。');
    if(!choice?.message?.content||typeof choice.message.content!=='string')throw new Error('暂时没有收到完整文字，请重试。');
    let parsed;
    try{parsed=JSON.parse(choice.message.content.trim().replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{throw new Error('收到的文字格式不完整，时间仍停留在原处。');}
    try{
      const valid=validateResponse(parsed,{decision:prompt.decision,context:prompt.validationContext});
      return {...valid,actionDelta:{},source:'deepseek'};
    }catch(error){
      if(error.code!=='PROSE_REPAIR'||attempt===1)throw error;
      messages.push({role:'assistant',content:JSON.stringify(parsed)},{role:'user',content:'请只修正下面的问题并重新输出完整JSON。不要推进时间、重算行动或改变已给出的结果：'+error.issues.join(' ')+' 保持原来的选项数量，遵守全部行文要求。'});
    }
  }
}
