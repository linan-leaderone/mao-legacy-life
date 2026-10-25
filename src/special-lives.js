import {tidyLocalProse} from './narrative.js';
import {continuityNarrative} from './continuity.js';

// These two named openings are deliberate fiction. Ordinary lives never enter them.
export const SPECIAL_KINDS=['mao_resurrection','deng_ocean'];
const bodies={mao_resurrection:['preserved','recovering','human'],deng_ocean:['small_fish','predator','giant_fish','sea_creature','amphibious','human']};
const bound=(value,min,max)=>Math.max(min,Math.min(max,value));
const intent=text=>String(text||'').split(/[，。；,;\n]/).filter(t=>!/(?:不想|不打算|不准备|不会|不再|不要|不吃|不捕食|不吞噬|停止|不复活|不上岸|不化形|不变成人|拒绝|放弃|没有|只了解|仅了解|如果|考虑是否)/.test(t)).join('，');
const regularBody=s=>s.specialLife?.body==='human';
const modulo=(value,base)=>(value%base+base)%base;
const date=m=>`${2020+Math.floor(m/12)}年${modulo(m,12)+1}月`;
const completedTurns=s=>Number.isInteger(s.turn)?s.turn:Array.isArray(s.history)?s.history.length:Math.max(0,s.month||0);
const oceanBodies=['small_fish','predator','giant_fish','sea_creature'];
const validHarvest=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[['eaten',500],['growth',20],['elapsedMs',45000]].every(([key,max])=>Number.isInteger(value[key])&&value[key]>=0&&value[key]<=max);
function harvestFor(s,action,text){
  if(!action.meta||!Object.hasOwn(action.meta,'fishGame'))return null;
  if(s.specialLife?.kind!=='deng_ocean'||!oceanBodies.includes(s.specialLife.body)||action.passive||!/吞噬|捕食|吃(?:掉|些|点|小鱼|鱼|猎物)|觅食/.test(text)||!validHarvest(action.meta.fishGame))throw new Error('这次觅食的记录不完整，请重新安排。');
  const value=action.meta.fishGame;
  return {eaten:value.eaten,growth:value.eaten?value.growth:0,elapsedMs:value.elapsedMs};
}
const stages={
  mao_resurrection:['棺内苏醒','传出回应','身体恢复','重新生活','面对公众'],
  deng_ocean:['洋流中的小鱼','追逐鱼群','深水中的大鱼','远洋生物','海岸与陆地']
};

export function initializeSpecialLife(s,persona){
  const kind=persona?.specialScenario;if(!SPECIAL_KINDS.includes(kind))return;
  s.profile.specialScenario=kind;
  s.specialLife={version:1,kind,stage:0,body:kind==='mao_resurrection'?'preserved':'small_fish',experience:0,growth:0,resurrected:false,bodyAge:null,lastAction:'',monthsInBody:0};
  synchronizeSpecialIdentity(s);
}

export function isSpecialLife(s){return SPECIAL_KINDS.includes(s.specialLife?.kind)&&s.profile.specialScenario===s.specialLife.kind;}

export function validateSpecialLife(s,persona){
  const kind=persona?.specialScenario;
  if(!SPECIAL_KINDS.includes(kind)){
    if(s.specialLife||s.profile.specialScenario)throw new Error('这份档案的身体经历与人物不符。');
    return;
  }
  const x=s.specialLife;
  if(!x||s.profile.specialScenario!==kind||x.kind!==kind||x.version!==1||!Number.isInteger(x.stage)||x.stage<0||x.stage>4||!bodies[kind].includes(x.body)||!Number.isInteger(x.experience)||x.experience<0||x.experience>100000||typeof x.resurrected!=='boolean'||!(x.bodyAge===null||(Number.isInteger(x.bodyAge)&&x.bodyAge>=0&&x.bodyAge<=999))||typeof x.lastAction!=='string'||!Number.isInteger(x.monthsInBody)||x.monthsInBody<0||x.monthsInBody>completedTurns(s))throw new Error('这份档案的身体变化记录不完整。');
  if(x.growth!==undefined&&(!Number.isInteger(x.growth)||x.growth<0||x.growth>100000))throw new Error('这份档案的成长记录不完整。');
  if(x.lastFishGame!==undefined&&(kind!=='deng_ocean'||!validHarvest(x.lastFishGame)||(!x.lastFishGame.eaten&&x.lastFishGame.growth)))throw new Error('这份档案的觅食记录不完整。');
  if(kind==='mao_resurrection'&&((x.stage<2&&x.body!=='preserved')||(x.stage===2&&x.body!=='recovering')||(x.stage>=3&&x.body!=='human')||x.resurrected!==(x.stage>=3)))throw new Error('这份档案的苏醒经历互相矛盾。');
  if(kind==='deng_ocean'&&(x.body==='human'||x.body==='amphibious')&&x.stage!==4)throw new Error('这份档案的海岸经历互相矛盾。');
}

export function resolveSpecialAction(s,action,requestedDestination=null){
  if(!isSpecialLife(s))return null;
  const previous=s.specialLife,kind=previous.kind,text=intent(action.label),passive=!!action.passive;
  const harvest=harvestFor(s,action,text);
  const maoRevival=kind==='mao_resurrection'&&/复活|复苏|站起|恢复身体|走出.*(?:水晶棺|纪念堂)|睁开眼/.test(text);
  const maoPublic=kind==='mao_resurrection'&&/公开|见公众|发表讲话|接受采访|电视讲话/.test(text);
  const returnSea=kind==='deng_ocean'&&/回(?:到)?海|返回海|潜回|重返海/.test(text);
  const changeForm=kind==='deng_ocean'&&(/进化|吞噬|吃|捕食|游|潜|登岸|上岸|登陆|陆地|化形|变成人|恢复人形|长出/.test(text)||returnSea);
  if(regularBody(s)&&kind==='mao_resurrection'&&!/恢复身体后重新生活/.test(s.person.occupation))return null;
  if(regularBody(s)&&kind==='deng_ocean'&&!/进化|吞噬|化形|恢复人形|长出/.test(text)&&!returnSea)return null;
  if(regularBody(s)&&!maoRevival&&!maoPublic&&!changeForm)return null;
  const next={...previous,monthsInBody:previous.monthsInBody+1,lastAction:passive?'按现有身体条件生活':tidyLocalProse(action.label).slice(0,500)};
  const capacity=(s.stats.intelligence+s.stats.fitness+s.stats.health)/3;
  const quality=capacity>=45?'smooth':'costly';
  const feeding=kind==='deng_ocean'&&!passive&&/吞噬|捕食|吃|觅食|进化/.test(text);
  const gain=harvest?harvest.growth:kind==='deng_ocean'&&!feeding?0:passive?2:capacity>=45?6:4;
  next.experience=bound(next.experience+gain,0,100000);
  if(harvest){next.growth=bound((previous.growth||0)+harvest.growth,0,100000);next.lastFishGame={...harvest};}
  let summary,delta={stress:passive?-1:1},destination=null;
  if(kind==='mao_resurrection'){
    next.stage=Math.max(previous.stage,next.experience>=30?3:next.experience>=12?2:next.experience>=4?1:0);
    if(!passive&&maoRevival&&!/逐渐|尝试|研究|准备|慢慢/.test(text))next.stage=Math.max(next.stage,3);
    if(!passive&&maoPublic&&previous.stage>=3)next.stage=4;
    next.body=next.stage>=3?'human':next.stage===2?'recovering':'preserved';
    next.resurrected=next.stage>=3;next.bodyAge=next.resurrected?(previous.resurrected&&Number.isInteger(previous.bodyAge)?previous.bodyAge:45):null;
    if(next.stage>=3&&previous.stage<3){
      summary='你设法让值守人员确认了自己的回应。照护人员将你转入封闭的恢复室，反复检查逐渐恢复的呼吸、体温和肌肉活动。持续照护使身体恢复到能够独立行走的程度，你亲自说出姓名，要求了解现在的年月，完成了从棺内苏醒到重新生活的过程。';
      delta={health:10,fitness:8,connections:3,influence:2,stress:2};
      destination='北京';
    }else if(next.stage===4&&previous.stage<4){
      summary='你通过照护人员联系负责接待的人，安排了一次有记录的公开会面。你回答有关身份和近况的问题，提出接下来想做的事。消息开始传到外界，有人要求查证，也有人提出会面请求。现有政府的职务安排继续存在，你需要具体争取合作和支持。';
      delta={influence:8,connections:4,stress:3};
    }else if(passive){
      summary=next.stage<2?'你留意玻璃外的声音，反复尝试控制手指。值守人员记录了新出现的微小反应，重新安排了检查。':next.stage===2?'你按照照护人员的安排休息，尝试说话和活动手臂。呼吸与身体反应有了可确认的改善，身边开始有人定时记录你的要求。':'你在照护安排下练习行走和阅读，了解自己离世之后的生活变化，身体逐渐适应新的日常。';
      delta={health:2,fitness:1,stress:-1};
    }else{
      const bridge=next.stage<2?'你通过反复出现的指尖反应和视线变化向值守人员传达意图。工作人员记录了你的要求，能经手的事项已经开始办理。':next.stage===2?'你在照护人员帮助下说出要求，完成可以由身边人配合的事情。身体仍需要检查，已经做成的安排留下了记录。':'你利用恢复期间建立的联系处理自己的安排，相关人员逐项落实了能够协作的工作。身体变化和身份查证仍有人跟进。';
      summary=`你把“${tidyLocalProse(action.label).slice(0,160)}”作为这个月要办的事。${bridge}`;
      delta={health:2,connections:1,stress:quality==='costly'?3:1};
    }
  }else{
    if(!harvest&&!passive&&/吞噬|捕食|吃/.test(text))next.experience=bound(next.experience+(capacity>=45?8:5),0,100000);
    next.stage=Math.max(previous.stage,next.experience>=48?3:next.experience>=24?2:next.experience>=8?1:0);
    const shore=requestedDestination&&requestedDestination!=='太平洋'?requestedDestination:(previous.stage===4&&s.location!=='太平洋'?s.location:'日本');
    if(!passive&&returnSea){next.stage=3;next.body='sea_creature';next.bodyAge=null;destination='太平洋';}
    else if(!passive&&/化形|变成人|恢复人形/.test(text)){next.stage=4;next.body='human';next.bodyAge=40;destination=shore;}
    else if(!passive&&/登岸|上岸|登陆|陆地/.test(text)){next.stage=4;next.body='amphibious';next.bodyAge=null;destination=shore;}
    else if(!passive&&requestedDestination&&previous.stage===4)destination=requestedDestination;
    else if(!passive&&/巨鲸|巨兽|海龙|神龙|巨龙|吞下.*(?:鲸|巨兽)/.test(text)){next.stage=Math.max(next.stage,3);next.body='sea_creature';}
    else if(previous.stage<4)next.body=['small_fish','predator','giant_fish','sea_creature'][next.stage];
    if(next.stage===4&&previous.stage<4){
      summary=next.body==='human'?`你沿洋流来到${destination}附近的海岸，集中注意力改变身体。吞食所得的力量使鳍与鳃逐渐发生变化，你在浅水里完成了人形转变，能够用双脚行走和呼吸空气。上岸后，你找到临时遮蔽的地方，开始处理衣食、身份和与人交流的问题。`:`你顺着海底坡地靠近${destination}海岸，身体长出能够支撑爬行的附肢，呼吸也逐渐适应空气。你在潮间带反复试着离开水面，成功进入岸边。海中的食物仍能维持体力，陆上的灯光和人群让你有了新的去处。`;
      delta={fitness:6,health:4,intelligence:2,stress:2};
    }else if(returnSea&&!passive){
      summary='你回到海水中，重新让身体适应游动和深水呼吸。留在岸上的经历没有消失，原有记忆与已经积累的力量仍然保留。你沿洋流返回太平洋，找到了能够补充食物的水域，开始按海中生物的方式生活。';
      delta={fitness:2,health:2,stress:-1};
    }else if(harvest){
      const bodyChange=next.stage>previous.stage?(next.stage===1?'鱼鳍和肌肉逐渐适应了更快的游动，你开始追踪更远处的鱼群。':next.stage===2?'身体长成深水中的大鱼，颌部与感官开始适应更大的猎物。':'身体已经能够承受深海的压力，你能察觉远处鱼群的位置。'):'你把找到食物的水域记在心里，沿附近的洋流继续活动。';
      summary=harvest.eaten?`你沿着鱼群游动，吃下了${harvest.eaten}条小鱼。${harvest.growth?'食物补充了体力，身体比出发时更大了一些。':'进食所得用于维持这次游动，体型没有明显增加。'}${bodyChange}`:'你在这片水域游动了一阵，没有捕到小鱼。你避开追不上的鱼群，回到能够休息的地方，身体保持出发时的大小，记下了这次经过的水域。';
      delta=harvest.growth?{fitness:Math.min(6,Math.ceil(harvest.growth/4)),health:Math.min(3,Math.ceil(harvest.growth/7)),stress:-1}:{stress:0};
    }else if(!passive&&!feeding&&/休息|躲|避开|停留/.test(text)){
      summary='你留在已经找到的遮蔽物旁休息，减少追逐与远距离游动，把体力留给必要的移动。附近出现大型鱼类时，你等它离开再调整位置，这次停留没有带来进食后的体型增长。';
      delta={health:1,stress:-2};
    }else if(next.stage>previous.stage){
      summary=`你${passive?'沿洋流寻找食物':'按自己的安排追踪猎物、选择能够接近的食物'}，在几次进食后出现新的身体变化。${next.stage===1?'鱼鳍能够支持更快的转向，原来必须躲开的鱼群进入了你的捕食范围。':next.stage===2?'体形长到足以穿过深水鱼群，肌肉和感官逐渐适应更大的猎物。':'体内的力量改变了骨骼和感官，你能够感到远处鱼群与洋流的位置，在深海长时间活动。'}你保留着过去的记忆，也开始熟悉这种身体的需要。`;
      delta={fitness:6,health:3,intelligence:1,stress:quality==='costly'?2:0};
    }else if(passive){
      summary='你随洋流觅食，避开食物稀少的水域，把得到的能量留在身体里。几次远处的震动让你调整了游动方向，这个月的活动范围比之前更清楚。';
      delta={fitness:1,health:1,stress:-1};
    }else{
      summary=`你开始实施“${tidyLocalProse(action.label).slice(0,160)}”。${next.stage<4?'你依靠鱼群、洋流与已经发生变化的身体完成这次行动，吞食得到的能量支持了移动与恢复。过程中找到的水域和感知方式留在记忆里，之后还能继续使用。':'你利用海中积累的力量和岸边找到的资源完成自己的安排。当地人的生活仍按原有秩序继续，你需要处理身体形态带来的实际反应。'}`;
      delta={fitness:2,intelligence:1,health:1,stress:quality==='costly'?3:1};
    }
  }
  return {success:true,chance:1,quality,playerLed:!!action.custom,delta,summary:tidyLocalProse(summary),scope:'personal',worldDelta:{},destination,specialTransition:next,implementation:'special-body-continuity'};
}

export function advanceSpecialLife(s,result,action){
  if(!isSpecialLife(s))return;
  const previousBody=s.specialLife.body;
  if(result.specialTransition)s.specialLife=structuredClone(result.specialTransition);
  else{s.specialLife.monthsInBody++;s.specialLife.lastAction=action.passive?'按现有身体条件生活':tidyLocalProse(action.label).slice(0,500);}
  if(result.specialTransition&&(previousBody!=='human'||s.specialLife.body!=='human'||/恢复身体后重新生活|从海中化形后上岸/.test(s.person.occupation)))synchronizeSpecialIdentity(s);
  if(!action.passive&&result.success)s.person.facts=[...s.person.facts,`${date(s.month)}：${result.summary}`].slice(-40);
}

function synchronizeSpecialIdentity(s){
  const x=s.specialLife,mao=x.kind==='mao_resurrection';
  s.person.custody=false;
  s.person.occupation=mao?(x.stage>=3?'恢复身体后重新生活的毛泽东':x.stage===2?'接受照护的苏醒者':'水晶棺内意识苏醒的毛泽东'):(x.body==='human'?'从海中化形后上岸的邓小平':x.body==='amphibious'?'能够在岸上活动的海中生物':x.stage===0?'保有邓小平记忆的小鱼':x.stage===1?'保有邓小平记忆的捕食鱼':x.stage===2?'保有邓小平记忆的深海大鱼':'保有邓小平记忆的远洋生物');
  s.person.status=mao?(x.stage>=3?`身体已经恢复，保留过去记忆，正在了解${date(s.month)}的社会生活；没有自动获得现行国家职务`:x.stage===2?'身体正在恢复，可通过身边的照护人员沟通和办理事情':'仍在纪念堂水晶棺内，可以感知外部声音，通过细微反应寻求联系'):(x.stage>=4?`已经抵达${s.location}，保留海中的变化，按当前身体形态继续生活`:'生活在太平洋，靠游动、觅食与吞噬积累能量；没有人类工作、存款与日常住房');
}

export function specialLocalEvent(s,decision,action){
  if(!isSpecialLife(s))return null;
  const x=s.specialLife,mao=x.kind==='mao_resurrection';
  const opening=completedTurns(s)===0&&x.monthsInBody===0&&x.stage===0;
  // A restored human can acquire an ordinary new occupation through later actions.
  if(regularBody(s)&&!/恢复身体后重新生活|从海中化形后上岸/.test(s.person.occupation))return null;
  const descriptions=mao?[
    `隔着玻璃，你听见脚步和交谈声，意识到自己仍躺在纪念堂的水晶棺内。身体暂时不能自由活动，你记得自己的姓名，也听见值守人员谈到${date(s.month)}的新闻。你试着分辨周围的人，寻找能让他们确认你还有意识的办法。`,
    '工作人员发现了你反复出现的回应，开始轮流守在近处。他们给你读短句，让你用手指或视线作答。检查所得的记录已经送走，你可以向留在身边的人表达简单的要求，了解外面发生的事情。',
    '照护人员把检查与休息时间写在床边，你能够说出短句，也能在帮助下活动手臂。送来的报刊介绍了这些年的变化，你从熟悉的名字和陌生的制度安排中整理现在的处境。',
    '你已经能够独立行走，按自己的需要阅读、会面和休息。身边的人等待你说明接下来的打算，过去留下的名望使会面请求增加。现有机构有自己的负责人，你需要逐件安排此后的生活。',
    '公开会面之后，来信和采访请求陆续送来。有人希望核实你的身份，有人带着对现实生活的意见。你挑出愿意见的人，把会谈时间与身体恢复的安排放在一起考虑。'
  ]:[
    '你在太平洋的海水里醒来，身体是一条粉灰色的水滴鱼，皮肤没有鳞片，宽大的头部和柔软身体随海流移动，记忆里仍有邓小平的一生。附近的小型生物可以作为食物，大鱼经过时需要及时藏进暗处。你试着控制鱼鳍，寻找能靠近食物的位置。',
    '你能在鱼群中连续转向，捕食后积累的能量逐渐改变肌肉与感官。海流把食物带到新的水层，你记住几处可以停留的地方，按照自己的需要安排觅食、游动和休息。',
    '你的身体已经长成深水中的大鱼，小型鱼群会在接近时分散。更深处的食物能够带来新的变化，远处船只的声音也传入水中。你能够选择继续捕食、探索洋流，或向有陆地的方向移动。',
    '你在远洋活动，能够承受深水压力，也能感知较远处的鱼群。吞食留下的力量仍在改变身体，你记得海岸的方位，可以继续在海里生活，也可以尝试让自己的身体适应陆地。',
    x.body==='human'?`你住在${s.location}，已经能够以人形行走、交谈和进食。海里的经历仍留在记忆与身体中，住所、日用品和人际往来需要重新安排。当地的消息通过路边商店与人们的交谈进入你的生活。`:`你能在${s.location}的岸边爬行和呼吸，仍需要海中的食物补充体力。岸边的灯光、道路与住户都已看得清楚，路人会对你的形态作出反应。你可以留在潮间带，也可以继续改变身体。`
  ];
  if(!opening){
    descriptions[0]=mao?'你仍在纪念堂的水晶棺内，继续辨认值守人员的声音，按照已经试过的方法活动手指和眼睛。身体暂时不能自由活动，外界的交谈让你知道日期与身边的安排。你记住能够传达回应的时机，继续寻找与照护人员沟通的办法。':'你继续在太平洋这片熟悉的水域活动，仍是一条靠鳍游动的小鱼，保留着邓小平的记忆。你沿之前经过的洋流寻找食物，大鱼靠近时就向遮蔽物游去。已有的体力和身体变化保留下来，你按鱼群的位置安排觅食与休息。';
    if(mao)descriptions[1]='值守人员按照已有记录轮流照看你，用短句询问近况，让你通过手指和视线作答。你沿用已经能够表达的回应方式，说明自己的要求，听取送来的消息。检查与交流继续进行，先前确认的身体反应和约定都留在记录里。';
  }
  const variations=mao?['你留意每次接触中能确认的细节，记下已经答复的请求。','身边的人按约定时间送来资料，你从现有信息里安排后续事情。','新的检查记录已经放好，你根据身体情况调整活动时间。']:['你记住本月发现的食物与停留地点，为下一次移动保留体力。','水温和食物分布有所变化，你调整了活动范围。','你逐渐掌握身体的新反应，减少了几次没有必要的消耗。'];
  const title=stages[x.kind][x.stage];
  const labels=mao?(x.stage<3?['尝试让值守人员确认自己的意识','配合照护，逐渐恢复身体','请身边的人介绍现在的情况','集中精神复活，站起来说话']:['了解如今的社会与普通人的生活','与愿意见面的人讨论自己的打算','公开接受采访，说明自己的近况','休息并记录已经发生的事情']):(x.stage<4?['寻找合适的猎物，吞噬后继续进化','沿洋流探索新的水域','躲进安全的水域休息','向日本海岸游去，尝试上岸']:['回海里觅食，保留目前的身体','让身体化形，成为能够在人群中生活的人','观察附近居民的生活','沿海岸寻找能够停留的地方']);
  const body=opening?descriptions[0]:`${descriptions[x.stage]} ${variations[modulo(s.month,variations.length)]}`;
  const event={title,narrative:tidyLocalProse(body),consequence:tidyLocalProse(s.actionResult?.summary||''),options:decision?labels.map(label=>({label,description:'按照自己的身体情况和意愿安排这个月。',delta:{},check:{stat:'intelligence',difficulty:35}})):[],memory:action?.custom?`${title}：${x.lastAction}`:'',actionDelta:{},location:s.location,dailyId:`special_${x.kind}_${x.stage}_${modulo(s.month,3)}`,decision,news:s.pendingNews||[],source:'local'};
  return opening?event:continuityNarrative(s,action,s.actionResult,event);
}

export function specialPromptContext(s){
  if(!isSpecialLife(s))return null;
  const x=s.specialLife;
  return {...x,stageName:stages[x.kind][x.stage],chronologicalAgeIsNotBodyAge:true,
    instruction:x.kind==='mao_resurrection'?'这是明确指定的复活经历。stage小于3时身体仍处于棺内或照护恢复中；不能写成普通退休老人已在家中散步。stage达到3后复活已实际完成，后续不得退回仅有意识或无法活动。原有名望不自动授予现行国家职务。':'这是明确指定的魔幻海洋经历，允许吞噬进化、感官变化、化形与登陆。初始身体是粉灰色、皮肤无鳞片的水滴鱼，宽头、小眼、嘴向下，按已发生的形态变化继续描写。lastFishGame是最近一次实际捕获记录，不可当作每月重复捕获；本次没有吃到鱼或仅休息就不能宣称大量成长。按body描写真实发生的活动，不能改成梦、比喻、精神疾病或普通退休生活。仍在海里时没有人类工作、房租、购物与陆上住处；登陆之后按当前所在地与身体状态写。'};
}
