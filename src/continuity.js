import {personalHealthContext,healthFollowup} from './personal-health.js';
const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
const short=(value,max=180)=>clean(value).slice(0,max);
const last=value=>Array.isArray(value)?value.at(-1):undefined;
const date=month=>`${2020+Math.floor(month/12)}年${((month%12)+12)%12+1}月`;
const choice=(state,items)=>items[((state.turn??state.month??0)%items.length+items.length)%items.length];

function activeThread(state,action){
  if(action&&!action.passive)return short(action.label,400);
  // A quiet month follows the most recent unfinished work instead of choosing a new biography.
  const history=state.history||[];
  for(let i=history.length-1;i>=Math.max(0,history.length-3);i--){
    if(!history[i].action?.passive)return short(history[i].action?.label,400);
  }
  return short(last(state.person?.projects)||state.employment?.kind||state.person?.occupation,400);
}

export function buildContinuityContext(source,target,action,resolution=target.actionResult){
  const previous=last(source.history),income=(target.monthlyLedger||[]).filter(e=>e.amount>0&&['wages','wage','salary','bonus','work'].includes(e.category||e.kind)).reduce((n,e)=>n+e.amount,0);
  return {
    thread:activeThread(source,action),action:short(action?.label,800),passive:!!action?.passive,language:target.profile?.language||'zh-CN',
    outcome:short(resolution?.summary,1200),success:resolution?.success!==false,
    previousNarrative:short(source.current?.narrative,1200),previousConsequence:short(source.current?.consequence,800),
    previousAction:short(previous?.action?.label,500),previousResult:short(previous?.consequence||previous?.actionResult?.summary,800),
    establishedProjects:(target.person?.projects||[]).slice(-4),establishedRelationships:(target.person?.relationships||[]).slice(-5),
    recentFacts:(target.person?.facts||[]).slice(-4),employment:target.employment||null,settledEmployment:resolution?.settledEmployment||null,personalHealth:personalHealthContext(target),income,
    encounter:resolution?.encounterGame||null,encounterSummary:short(resolution?.encounterSummary,800),
    encounterState:target.encounterState||null,fishHarvest:action?.meta?.fishGame?target.specialLife?.lastFishGame||null:null,
    nextStep:'承接刚完成的行动，写一件由其结果带来的具体后续事务，再写已有资源、关系、身体状况或所在地怎样影响处理。不得重复上一段过程，不另起无关生活。'
  };
}

function oceanFollowup(state,action,resolution){
  const harvest=action?.meta?.fishGame?state.specialLife.lastFishGame:null;
  const lead='你继续在太平洋这片水域活动，';
  if(harvest?.eaten===0)return {title:'重新寻找食物',narrative:lead+choice(state,['上次追逐的鱼群已经游远，你转向水流较慢、便于停留的地方，观察小鱼经过的位置。附近有大鱼活动时，你先留在遮蔽物旁，减少长距离移动造成的消耗，等能够靠近的食物出现。','原先的追逐路线已经难以找到食物，你改沿岩石边缘移动，观察小鱼是否会进入缓流。能够停留的狭缝成为新的落脚点，你先在那里保存体力，等下一次可以靠近的机会。','你在原先停留的地方观察水流，先确认哪条路径不用长距离追逐。小型生物从附近经过时，你试着缩短靠近的距离，记下它们离开的方向，为下一次寻找食物保留体力。'])};
  if(harvest)return {title:harvest.growth?'沿着鱼群留下的方向':'寻找下一处停留地',narrative:lead+(harvest.growth?'按进食后已有的体型调整游动距离，原先狭窄的躲藏处需要重新试探。':'把上次补充的体力留给必要的移动，体型仍保持原状。')+choice(state,['你沿鱼群离开的方向观察，记住能挡住急流的岩石，给下一次接近猎物留下退路。较大的鱼从远处经过，你暂时停在障碍物后，等它离开。','你回到上次小鱼聚集的水层，发现食物已经分散。你沿遮蔽物边缘寻找新的停留点，留意水流和猎物的位置，决定下一次从哪里接近。','你先在缓流处休息，再沿熟悉的边缘游动。鱼群换了方向，你尝试新的接近距离，保留足够体力返回能够藏身的地方。'])};
  const text=activeThread(state,action);
  if(/休息|躲|避开|停留/.test(text))return {title:'停留水域的变化',narrative:lead+'沿用此前找到的遮蔽物休息，留意入口附近的动静。你没有再次长距离追逐鱼群，把体力留给必要的移动。水流改变后，小型生物经过的位置发生变化，你记住这条经过藏身处的路径，之后可以从这里寻找食物。'};
  if(/探索|游|海流|洋流|水域/.test(text))return {title:'沿途的水流',narrative:lead+'顺着先前探索过的方向辨认水流，能停留的地方和无法通过的狭缝逐渐清楚。你在离开熟悉水域前先观察大型鱼类的位置，记住返回的方向。接下来是继续向外移动，还是在附近寻找食物，都取决于眼前的水流和身体状况。'};
  return {title:'熟悉水域里的变化',narrative:lead+'沿着此前找到的食物与遮蔽物安排移动。已经经历过的变化保留在身体里，你不再重新摸索怎样游动。鱼群的位置随水流改变，你观察能够接近的方向，留出避开大型捕食者的距离，下一次进食要从这里继续。'};
}

function workFollowup(state,text,consequence=''){
  const kind=state.employment?.kind||state.person?.occupation||'手头的工作';
  const amount=(state.monthlyLedger||[]).filter(e=>e.amount>0&&['wages','wage','salary','bonus','work'].includes(e.category||e.kind)).reduce((n,e)=>n+e.amount,0);
  const spent=-(state.monthlyLedger||[]).filter(e=>e.amount<0).reduce((n,e)=>n+e.amount,0);
  const job=kind==='在当地生活'?'这份工作':kind;
  let tasks;
  if(/配送|快递|外卖|送货/.test(kind+' '+text))tasks=[
    '你把这次经过的配送路段记下来，先核对地址和取件顺序。新的配送安排到手后，你按照熟悉的街道调整路线，给装卸和休息留出时间。',
    '你按此前熟悉的配送路线接下新的任务，出发前先确认收件人能否到场。有一段路需要绕行，你把额外路程写进安排，避免再次临时改变顺序。',
    '你重新核对上次的送达记录，先处理还需确认的地址。下一批货物整理好后，你把同一方向的收件点放在一起，给返回和休息留出余地。'];
  else if(/便利店|收银|店员|零售/.test(kind+' '+text))tasks=[
    '你接着核对上一班留下的收银记录，先清点柜台附近的常用商品。补货时发现的差异留在交接本上，之后来上班的同事能够据此继续核查。',
    '你把上次盘点留下的问题带到新一班，逐项核对货架和账目。店内客人增多时，你先照看收银台，等忙完再处理尚未摆好的商品。',
    '你沿用之前熟悉的补货顺序整理货架，把临近用完的包装和常用物品记下来。交班前，你向同事说明哪些货已清点，哪些还需要再核对。'];
  else if(/餐厅|餐饮|厨|服务员|咖啡|奶茶/.test(kind+' '+text))tasks=[
    '你按照之前接单和备餐留下的记录整理工作台，先核对常用物料。新一轮订单到来时，你与同事确认各自负责的工序，避免把已经处理过的要求遗漏。',
    '你把上一班留下的订单记录交给同事核对，按确认的数量准备常用物料。客人提出新的要求时，你先记清内容，再与负责备餐的人确认交付顺序。',
    '你重新查看需要逐项确认的订单，把需要单独准备的部分标在工作台旁。新的一班从这些准备继续，忙完之后，你与同事一起补齐下一班要用的物料。'];
  else if(/程序|软件|工程|技术|研究/.test(kind+' '+text))tasks=[
    '你先查看上次留下的记录，核对已经完成的部分和仍需处理的问题。新的工作从这些问题继续，你把能重现的情况逐项记下，和协作者确认下一步交付范围。',
    '你把先前交出的结果拿来复查，优先处理协作者标出的疑问。能够确认的部分留下记录，尚缺资料的事项单独列出，下一次讨论从这些缺口开始。',
    '你按照上一轮讨论确定的范围继续核查，先复用已经通过检查的部分。新发现的问题记在原有记录旁，你把它们的影响说明清楚，再安排后面的工作。'];
  else if(/厂|工人|装配|仓库|分拣/.test(kind+' '+text))tasks=[
    '你回到原先负责的工位，先检查上一班留下的物料和记录。接下来的工作沿用已经熟悉的顺序，遇到不合格的部分就单独记录，交接时向同事说明。',
    '你把之前留下的物料记录放在一旁，先核对新送来的这一批物料。已经熟悉的检查顺序继续使用，数量和标记有疑问的部分暂时分开，等交班时共同确认。',
    '你按上次的交接记录准备工位，先清点还未处理完的零件。开始下一批任务后，你把容易混淆的物料分开放好，减少重复搬动和重新核对的时间。'];
  else if(/歌手|乐队|afterglow|Afterglow|排练|演出/.test(kind+' '+text))tasks=[
    '你把上次排练留下的问题带到下一次合练，和同伴确认需要重练的段落。已有的合作关系继续起作用，演出与休息时间需要共同安排，接下来的准备围绕这些约定展开。',
    '你先回听此前留下的练习记录，把需要重新配合的地方记下来。同伴提出了各自的时间安排，你们按已经熟悉的曲目继续磨合，为下一次合练留出准备时间。',
    '你按照上次说定的分工处理创作与练习，把修改过的部分带去与同伴核对。已经确认的安排不再重做，尚未一致的细节留给下一次共同讨论。'];
  else tasks=[
    '你先核对上次工作留下的记录，分清已经做完的事项和仍需交接的部分。新的安排沿着这份记录继续，你向负责交接的人说明进度，把容易遗漏的细节记下来。',
    '你接着处理上次尚未核实的材料，先询问负责交接的人，再把答复写在原有记录旁。新的任务送来后，你按照已有经验分清先后顺序，给月底核对留出时间。',
    '你把上一轮工作中反复出现的问题单独整理出来，和协作者确认处理方式。下一批事务从这份记录继续，已经完成的部分留下凭据，避免再次从头查起。'];
  const reported=amount>0&&String(consequence).includes(String(amount))&&/收入|工资|薪水|奖金/.test(consequence);
  const pay=reported?choice(state,['已经结清的账目让你能够安排下一阶段的必要花费，你先留出通勤与生活所需的部分。','你按现有余款安排接下来的通勤和生活，把可以缓办的花费留到之后。','接下来的花费按剩余资金安排，你给日常所需留出余地，再决定是否接更多工作。']):amount>0?`刚结清的劳动收入为${amount}，${spent>0?`其中${spent}用于已记下的日常开支，`:'这笔收入已进入现有积蓄，'}你按剩余资金安排下一阶段的必要花费。`:'你按现有资金安排交通、吃饭与休息，工资情况以已经结清的账目为准。';
  const review=state.actionResult?.encounterGame?.mistakes>0?'你先核查这次工作中出错的部分，把需要重查的内容记在下一次交接前。':'';
  return {title:`${short(job,16)}的后续安排`,narrative:review+choice(state,tasks)+pay};
}

function encounterFollowup(state,resolution){
  if(!['zombie','combat'].includes(resolution?.encounterGame?.kind))return null;
  const encounter=state.encounterState||{};
  if(resolution.encounterGame.kind==='combat'){
    const fight=resolution.encounterGame;
    const aftermath=fight.escaped?'你沿撤离时走过的道路寻找落脚处，确认追赶的动静已经远去。':fight.outcome==='cleared'?'交战地点暂时安静下来，你查看周围的通道，收拢仍能使用的物品。':'这一段交锋结束后，你先在遮蔽物旁停下，观察附近的动静，确认接下来能走的路。';
    return {title:'交锋之后的安排',narrative:aftermath+(fight.damageTaken>0?'你检查伤口和已经包扎的位置，把休息、清洁与寻找照护放进接下来的安排。':'你清点随身物品，记下还可以取得补给的地方。')+(fight.ammoUsed>0?`刚才消耗的${fight.ammoUsed}发弹药已经从存量中扣除，后续行动需要考虑剩余弹药。`:'你根据现有装备安排下一步行动。')+(encounter.infected?'此前的感染仍需处理，你继续留意身体变化。':'')};
  }
  if(encounter.infected===true)return {title:'遭遇之后的身体变化',narrative:'你离开刚才发生冲突的地方，先检查受伤的位置，把已经出现的感染迹象记下来。原有伤势没有随离开现场消失，接下来的行动要兼顾身体变化与能取得的照护。你整理仍能使用的装备，避开密集的人群，沿有遮蔽物的方向寻找能够停留的地方。'};
  return {title:'离开交战地点之后',narrative:'你沿刚才确认过的通道离开交战地点，先检查随身装备和身体情况。原先吸引丧尸的动静让这条路难以久留，你把附近可以遮蔽、撤离的地方记下来，沿仍然能够通行的方向移动。'+(encounter.immune?(resolution.encounterGame.damageTaken>0?'现有的免疫能力继续有效，遭到攻击留下的伤势仍需按身体情况照料。':'现有的免疫能力继续有效，你把安全通道记下来，给下次外出留下退路。'):'下次外出前，你需要确认这条路上的动静，尽量保留能够折返的余地。')};
}

export function continuityNarrative(state,action,resolution=state.actionResult,baseEvent={}){
  if(!action||state.person?.deceased)return baseEvent;
  const text=activeThread(state,action),person=state.person||{},plan=resolution?.declarations;
  let result=encounterFollowup(state,resolution)||healthFollowup(state,action);
  if(!result&&state.specialLife?.kind==='deng_ocean'&&state.specialLife.stage<4)result=oceanFollowup(state,action,resolution);
  if(!result&&plan?.dateMonth!==null&&Number.isInteger(plan?.dateMonth))result={title:'抵达之后的安排',narrative:`你在${date(state.month)}的${state.location}确认眼前的生活条件，按照已经抵达的年月辨认道路、住处和能够取得的消息。出发前的记忆与已经完成的身体变化保留下来，你先处理安顿和联系的问题，原有计划需要用这里能找到的物资继续落实。`};
  if(!result&&state.specialLife?.kind==='deng_ocean'&&state.specialLife.stage===4&&/上岸|登陆|海岸|人形|化形/.test(text))result={title:'岸边留下的安排',narrative:state.specialLife.body==='human'?`你在${state.location}沿着刚才找到的落脚处安排生活，先确认能取得衣物、食物和消息的地方。已经完成的人形变化保留下来，原有记忆帮助你与附近的人交流。海中的经历没有消失，你把眼前需要办理的身份与生活事项记下来，接下来从这里继续。`:`你停留在${state.location}的岸边，沿刚才确认过的潮间带寻找遮蔽物。身体已经能够离开水面，觅食和休息仍需顾及现有呼吸与移动能力。你留意附近道路和行人的动静，先记住回到海里的通道，再决定接下来向哪里移动。`};
  if(!result&&person.custody)result={title:'留待下一次联系的事',narrative:'你把刚才能够传达的要求和已经收到的答复记下来，按照现有看守安排等待下一次联系。已经送出的信件不需要重新起草，接下来要核实它是否送达，再补充对方需要的情况。能够会见的人与能取得的资料仍受当前条件约束，你把有限时间留给最急需处理的事项。'};
  if(!result&&state.specialLife?.kind==='mao_resurrection'&&!plan?.worldChanges?.length&&(state.specialLife.stage<3||(/恢复身体后重新生活/.test(person.occupation||'')&&(action.passive||/公开|采访|会面|见面|照护|恢复|复活|苏醒|社会|普通人|休息|阅读|记录/.test(text))))){
    const x=state.specialLife;
    result=x.stage<3?{title:'回应之后的安排',narrative:x.stage<2?'值守人员按照已有记录核对你的回应，把你刚才表达的要求留给下一班照看的人。你继续使用已经能控制的手指和视线，让对方确认哪些问题得到了答复。身边的人开始按这些要求安排下一次交流，检查与休息仍要围绕当前身体状况进行。':'你把刚才说出的要求交给照护人员记录，已经完成的检查成为下一次安排的依据。能够活动的时间先用来处理最关心的问题，其余事情由约好的人继续跟进。身体尚未恢复的部分仍需照看，你按照现有说话和活动能力与他们保持联系。'}:{title:'会面与答复',narrative:'你根据刚才表达的打算整理接下来的会面安排，已经联系上的人陆续给出答复。愿意支持的人询问具体可以做什么，有人希望先核实情况，也有人对这些安排表示担忧。你把需要本人回应的事项留下，先与能够继续合作的人确认时间和分工。'};
  }
  if(!result&&resolution?.settledEmployment&&!state.employment?.monthlyIncome)result={title:'这份工作结清以后',narrative:'这次约定的工作已经做完，你保留结算和交接记录，按照现有余款安排接下来的生活。原来的排班到这里结束，下次是否再接同类工作，需要另作安排。'};
  if(!result&&resolution?.encounterGame&&!['zombie','combat'].includes(resolution.encounterGame.kind))result=workFollowup(state,text,baseEvent.consequence);
  if(!result&&resolution?.success!==false&&!plan?.worldChanges?.length&&!/主席|总统|首相|领导人|指挥/.test(person.occupation||'')&&state.employment?.monthlyIncome>0&&(action.passive||/打工|工作|上班|工资|配送|快递|外卖|餐厅|咖啡|奶茶|编程|软件|工厂|工位|仓库|分拣|订单/.test(text)))result=workFollowup(state,text,baseEvent.consequence);
  if(!result&&resolution?.success===false)result={title:'尚待解决的部分',narrative:`你把“${short(text,55)}”中尚未办成的部分整理出来，保留已经找到的材料和联系。接下来的安排先处理最直接的缺口，能够继续请教的人、可支配的资金和身体状况都需要重新核对。之前完成的准备继续有效，你可以调整方法，也可以先停下来恢复。`};
  if(!result&&(plan?.worldChanges?.length||/主席|总统|首相|领导人|指挥/.test(person.occupation||'')))result={title:'安排如何落实',narrative:'你接着处理刚才的公共安排，核对各方已经答应的事项是否开始执行。愿意合作的人希望明确职责，受到影响的人也会带来不同意见。你把已经确认的变化传达给负责后续事务的人，接下来的工作围绕现有人员、物资和实际控制的范围展开。'};
  if(!result&&/军人|士兵|入伍|军校|自卫队/.test(person.occupation||''))result={title:'接续的训练任务',narrative:'你带着上次训练留下的问题回到队伍，先检查需要携带的装备，再按照当前身体情况完成安排。熟悉的同伴继续一起值勤，尚未掌握的部分留给下一次练习。已建立的服役关系继续有效，休息与家人联系要放在现有作息之内。'};
  if(!result&&/afterglow|Afterglow|排练|演出|创作|乐队/.test(text))result=workFollowup(state,text,baseEvent.consequence);
  if(!result&&/飞船|火星|月球|太空|宇宙/.test(text))result={title:'航行留下的工作',narrative:choice(state,['你把这次与航行有关的记录集中起来，先核对能继续使用的设备和补给。接下来的安排围绕现有落脚点展开，需要和能够联系的人确认消息传递方式，再决定怎样使用剩余物资。已经完成的部分留在记录里，后续工作从这里继续。','你沿着此前确定的安排检查补给与休息条件，把设备的现有状态逐项记下。能够维持联系的方式先保留下来，尚不熟悉的环境需要重新观察，下一步移动要给返回与修整留出余地。原先的经历成为这些安排的依据。','你先检查上一段经历中持续使用的设备，把需要维护的部分和仍能直接使用的部分分开记录。接下来的工作从现有条件继续，补给、休息和对外联系需要分别安排，你按眼前最急需处理的事项确定先后顺序。'])};
  if(!result&&/建造|建成|造出|制作|发明|开店|开办|开设|创业/.test(text))result={title:'完成之后的实际事务',narrative:choice(state,['你先检查已经完成的部分能否按原先设想继续使用，把需要照看的细节列在旁边。此前取得的材料与联系仍有用处，接下来的事务围绕维护、补充和日常使用展开，你按现有资金决定哪些事情先办。','你把已经做成的部分交给能够配合的人一起核对，逐项说明日常使用时需要注意的地方。新的安排从维护与补充物料开始，先前建立的联系帮助你找到答复，剩下的问题留在同一份记录里继续处理。','你沿用此前积累的经验整理使用记录，先确认现有材料够用到什么时候。需要补充的事项列出来后，你按轻重缓急安排时间，把已经稳定下来的部分留给日常维护，腾出精力处理新发现的问题。'])};
  if(!result&&/学习|考试|研究|阅读|课程|练习/.test(text))result={title:'从上次停下的地方继续',narrative:`你把“${short(text,55)}”留下的笔记重新摊开，先检查已经弄懂的部分，再把仍有疑问的地方单独列出来。接下来的时间用于查证这些问题，现有资料不足时再联系能够提供帮助的人。已经完成的学习不会重来，后面的安排从当前掌握的内容继续。`};
  if(!result&&/朋友|家人|亲人|会面|约会|联系|探望/.test(text))result={title:'上次联系之后',narrative:`你接着处理“${short(text,55)}”之后留下的约定，先向已经联系过的人确认近况。双方说定的事成为下一次安排的依据，需要补充的时间与材料逐项核对。对方没有答复的部分暂时保留，你把眼前能办的事项做完，等新的消息到了再作调整。`};
  if(!result&&text&&!/^(?:在当地生活|学生|照常生活|下个月)$/.test(text)){
    const anchor=String(baseEvent.consequence||'').includes(short(text,25))?'刚才的安排':`“${short(text,60)}”`;
    result={title:'接下来的具体安排',narrative:choice(state,[`你接着处理${anchor}留下的后续事项，先核对已经完成的部分和仍需照看的细节。能够继续使用的材料、联系和身体经验都保留下来，你按目前条件安排下一步，遇到新的情况再调整做法。`,`你把${anchor}中已经得到答复的事项记下来，接下来先处理还需要本人确认的细节。现有材料和建立起来的联系仍然有效，你检查是否需要补充说明，按眼前的条件安排下一次接触。`,`你接着核查${anchor}带来的具体变化，把需要持续照看的事项列在一起。先前能够借助的人与物仍在，你按现有时间和精力分清哪些可以立即处理，哪些需要等新的消息再决定。`])};
  }
  if(!result&&state.encounterState?.infected===true)result={title:baseEvent.title,narrative:baseEvent.narrative};
  if(!result)return baseEvent;
  if(state.encounterState?.infected===true&&!['zombie','combat'].includes(resolution?.encounterGame?.kind))result.narrative+='此前受到的感染仍未解除，你把查看身体变化和寻找照护也留在接下来的安排里。';
  // Existing choices remain available, but at least the first two follow the same personal thread.
  const options=!state.specialLife&&baseEvent.options?.length?baseEvent.options.map((option,index)=>index<2?(index===0?{label:'继续处理这件事的后续',description:'按照已经完成的部分，处理眼前仍需落实的安排。',delta:{},check:{stat:'intelligence',difficulty:35}}:{label:'检查现有资源和身体情况',description:'先检查这件事留下的开支、装备或身体负担，再安排下一步。',delta:{stress:-1},check:{stat:'intelligence',difficulty:25}}):option):baseEvent.options;
  return {...baseEvent,...result,options,continuity:true};
}

export function continuityIssues(response,context){
  if(!context)return [];
  const narrative=clean(response.narrative),issues=[];
  if(context.income>0&&context.employment?.monthlyIncome>0&&/你(?:这个月|本月)?(?:一直|仍然|依旧|还)?(?:没有工作|没找到工作|尚未就业)|你(?:这个月|本月)(?:没有|未能|没能)\s*(?:拿到|领到|获得|收到)(?:任何)?工资/.test(narrative))issues.push('工资已经入账且工作继续，请承接实际工作、收入与交接事项，不能退回未就业或宣称没有工资。');
  if(context.employment?.active===false&&/(?:下个?月|今后|以后|往后|每个?月)[^。！？]{0,16}(?:照常|继续|仍然|依旧|按月)[^。！？]{0,8}(?:送外卖|配送|上班|领(?:取)?工资|发(?:放)?工资)/.test(narrative))issues.push('这份工作的约定已经结束，下一阶段不能自行延续排班或工资；承接结算、休息或寻找新安排。');
  const physical=[narrative,clean(response.consequence)].join(' ');
  const activeConditions=context.personalHealth?.conditions?.filter(c=>c.status==='active')||[];
  if(activeConditions.length){
    const falseRecovery=physical.split(/[。！？；]/).some(sentence=>{
      if(/未|没有|无法|不能|尚未|还没|治愈率|康复(?:治疗|训练|计划|过程)/.test(sentence))return false;
      const namesActive=activeConditions.some(c=>sentence.includes(c.label)||c.id==='hiv'&&/HIV|AIDS|艾滋/i.test(sentence)||c.id==='injury'&&/骨折|重伤|瘫痪|截肢/.test(sentence));
      const hasRecovery=context.personalHealth.recentChanges?.some(c=>c.kind==='recovery');
      const ownDisease=namesActive&&/你|本人|自身/.test(sentence)||!hasRecovery&&/(?:你|本人|自身)(?:的)?(?:病情|疾病|身体)|你(?:已经|已|完全|彻底|自行|自动|终于)(?:痊愈|康复|恢复健康)/.test(sentence);
      return ownDisease&&/(?:已经|已|完全|彻底|自行|自动|终于)(?:被)?(?:治愈|痊愈|康复|恢复健康|消失|清除)|不再患有/.test(sentence);
    });
    if(falseRecovery)issues.push('当前身体记录仍有未解除的病情，不能在正文中自行治愈、撤销或恢复为健康；保持已有照护事实。');
    if(context.language==='zh-CN'&&context.personalHealth.recentChanges?.some(c=>c.kind==='diagnosis')&&!/担心|忧虑|顾虑|害怕|恐惧|难过|难受|心情|情绪|不安|震惊|平静|接受|消化|家人|父母|亲友|告诉|告知|保密|求助/.test(physical))issues.push('刚确诊是本人的重大经历，需要写本人对消息的具体反应和日常安排；已知情亲友可有回应，未告知的人不能自动知道。');
  }
  if(context.encounterState?.infected===true&&/(?:感染|伤口)[^。！？]{0,16}(?:已经|已|完全|自行|自动)(?:消退|清除|治愈|痊愈|恢复正常)|你(?:已经|已|完全|自行|自动)(?:痊愈|康复)|你(?:没有|未曾|并未)受到感染/.test(physical))issues.push('当前感染尚未解除，继续写照护、身体变化和后续安排，不能在叙述中自行治愈或撤销感染。');
  if(['zombie','combat'].includes(context.encounter?.kind)&&context.encounter.damageTaken>0&&/你(?:这次|刚才|仍然)?(?:毫发无伤|没有受伤|未受伤|没有受到任何伤害)/.test(physical))issues.push('这次遭遇已经造成身体损伤，必须保留伤势，不能写成毫发无伤。');
  if(context.fishHarvest?.eaten===0&&/(?:身体|体型|体形)[^。！？]{0,12}(?:长大|变大|更大|壮大)|(?:吃下|吞下|捕到|捕获|吞食)(?:了)?(?:大量|许多|很多|数十|\d+条)/.test([narrative,response.consequence].join(' '))){
    const positive=[narrative,response.consequence].join(' ').split(/[。！？]/).some(s=>!/(?:没有|未曾|未能|未|没|不再|不曾)[^，。！？]{0,20}(?:长大|变大|更大|壮大|吃下|吞下|捕到|捕获|吞食)/.test(s)&&/(?:身体|体型|体形)[^，。！？]{0,12}(?:长大|变大|更大|壮大)|(?:吃下|吞下|捕到|捕获|吞食)(?:了)?(?:大量|许多|很多|数十|\d+条)/.test(s));
    if(positive)issues.push('这次没有捕到小鱼，未获得成长；后续写寻找新水域、保存体力和避开捕食者，不能虚构大量进食或体型增加。');
  }
  const stripped=value=>clean(value).replace(/[\s，。！？、：；,.!?“”"']/g,'');
  const current=stripped(narrative),previous=stripped(context.previousNarrative);
  if(current.length>=60&&previous.length>=60){
    const grams=value=>new Set(Array.from({length:value.length-5},(_,i)=>value.slice(i,i+6)));
    const a=grams(current),b=grams(previous),common=[...a].filter(g=>b.has(g)).length;
    if(common/Math.min(a.size,b.size)>.82)issues.push('本月正文大面积重复上一月，请写刚完成行动带来的新任务、关系反应或资源变化，保留旧事实但不要重述整段。');
  }
  if(context.outcome&&/你(?:又|照常|仍旧|依旧|还是)?(?:过了|度过了|生活了)一个月[。！]?$/.test(narrative))issues.push('当前正文只有泛泛过月，需写刚完成行动之后具体要处理的一件事及其影响。');
  return issues;
}
