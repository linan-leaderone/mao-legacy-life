// Cash facts are separate from prose and stat suggestions. Amounts use the
// game's existing integer money unit; no implicit exchange-rate conversion.
export const ECONOMY_VERSION=1;
export const MONEY_CATEGORIES=Object.freeze(['income','income-total','wages','bonus','gift','refund','loan','expense','expense-total','purchase','living','repayment','donation','transfer','balance']);
const LIMIT=1e12;
const clip=value=>Math.max(-LIMIT,Math.min(LIMIT,Math.round(value)));
const NUMBER='[0-9零〇一二两兩三四五六七八九十百千万萬亿億壹贰貳叁參肆伍陆陸柒捌玖拾佰仟点點.]+(?:[,，][0-9]{3})*';
const CURRENCY='(?:人民币|新台币|新臺幣|台币|臺幣|港币|港幣|日元|美元|美金|欧元|元|块钱|块|塊)';
const tokenPattern=()=>new RegExp(`(?:[￥¥$]\\s*)?(${NUMBER})\\s*(${CURRENCY})?`,'g');
const simplified={'兩':'两','萬':'万','億':'亿','壹':'一','贰':'二','貳':'二','叁':'三','參':'三','肆':'四','伍':'五','陆':'六','陸':'六','柒':'七','捌':'八','玖':'九','拾':'十','佰':'百','仟':'千','點':'点','〇':'零'};
const digits={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
const units={十:10,百:100,千:1000,万:10000,亿:100000000};
export function parseMoneyAmount(value){
  if(typeof value==='number')return Number.isFinite(value)&&value>=0&&value<=LIMIT?Math.round(value):null;
  let text=String(value??'').normalize('NFKC').replace(/[,，\s]/g,'').replace(/[兩萬億壹贰貳叁參肆伍陆陸柒捌玖拾佰仟點〇]/g,c=>simplified[c]);
  if(!text||!/^[0-9.零一二两三四五六七八九十百千万亿点]+$/.test(text))return null;
  const decimal=text.match(/^([零一二两三四五六七八九十百千万亿]+)点([零一二两三四五六七八九]+)([万亿]?)$/);
  if(decimal){const whole=parseMoneyAmount(decimal[1]);if(whole===null)return null;const fraction=Number('0.'+[...decimal[2]].map(c=>digits[c]).join(''));const amount=(whole+fraction)*(units[decimal[3]]||1);return amount<=LIMIT?Math.round(amount):null;}
  if(/^\d+(?:\.\d+)?$/.test(text)){const amount=Number(text);return amount<=LIMIT?Math.round(amount):null;}
  if(!/^(?:\d+(?:\.\d+)?|[零一二两三四五六七八九十百千万亿])+$/.test(text))return null;
  let total=0,section=0,number=null,sawUnit=false;
  for(const part of text.match(/\d+(?:\.\d+)?|[零一二两三四五六七八九]+|[十百千万亿]/g)||[]){
    if(Object.hasOwn(units,part)){
      const unit=units[part];sawUnit=true;
      if(unit<10000){section+=(number??1)*unit;number=null;}
      else if(unit===10000){section=(section+(number??0)||1)*unit;total+=section;section=0;number=null;}
      else {total=(total+section+(number??0)||1)*unit;section=0;number=null;}
    }else {number=/^\d/.test(part)?Number(part):Number([...part].map(c=>digits[c]).join(''));}
  }
  const amount=total+section+(number??0);
  return Number.isFinite(amount)&&amount<=LIMIT&&(sawUnit||number!==null)?Math.round(amount):null;
}
const hash=text=>{let n=2166136261;for(const c of text){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(36);};
const clean=text=>String(text||'').normalize('NFKC').replace(/\d{1,3}(?:[,，]\d{3})+/g,s=>s.replace(/[,，]/g,''));
const speculative=/(?:如果|假如|假设|倘若|要是|听说|据说|传闻|做梦|梦见|想象|希望|打算|计划|准备|预计|预期|有望|将会|将要|可能|应当|应该|应付|待付|应收|待收|能否|是否|报价|标价|售价|价值|市值|目标(?:是|为)?|明年|明天|下个月|下月|以后|未来|承诺|答应|声称|说会|谎称)|(?:想|要)(?:赚|挣|收|获|得|付|花|借|捐|领)/;
const negative=/(?:没有|没能|未能|尚未|并未|还没|还未|从未|未曾|拒绝|不愿|不想|不会|不再|不能|无法|不可能|不曾|不打算|不准备)(?:[^。；]{0,12})(?:收|得|赚|挣|付|花|支出|入账|到账|拿|给|借|捐|还|工资|奖金)|(?:不|没|未)(?:收|赚|挣|付|花|领|借|捐|还|支出)/;
const SELF='(?:我|本人|自己|你|您)';
const selfStart=new RegExp(`^(?:(?:今天|本月|这个月|这次|本次|当月|随后|之后|刚才|现在|月底|最终|结果|已经|另外|此外|又|再|还|共|总共|其中|工资|奖金|收入|报酬)\\s*)*(?:${SELF})`);
const thirdSubject=/^(?:(?:今天|本月|这次|随后|之后|现在|另外|此外)\s*)*(?:(?:我|你)(?:的)?(?:公司|企业|店铺|部门|单位|家人|朋友|同事|父亲|母亲|儿子|女儿)|他|她|他们|她们|别人|老板|朋友|同事|父亲|母亲|爸爸|妈妈)/;
const activityPrefix=/^(?:送(?:了)?外卖|送快递|配送|送餐|打工|兼职|上班|务工|工作|做工|务农|接单|领取|收到|收下|收取|拿到|得到|获得|赚|挣|领|付|支付|花|捐|借|偿还|归还|还款|买|购买|购入|交|转|汇|工资|奖金|报酬|收入|资金|账户|余额|存款)/;
function personal(prefix,{direction='income',verbIndex=0,inherited='self'}={}){
  if(/(?:替|帮|代替|帮助|代)(?:他人|别人|朋友|同事|家人|[\u4e00-\u9fff]{2,8})(?:收|领|存|拿|赚)|(?:我|你)(?:让|要求|安排|叫|使)[^，。]{0,20}(?:收|付|赚|挣|领|花)|(?:说|表示|声称|宣称)[：:]?[“"']?(?:我|你)/.test(prefix))return false;
  if(thirdSubject.test(prefix)&&!new RegExp(`(?:给|向|转给|付给|发给|送给)(?:了)?${SELF}`).test(prefix))return false;
  if(direction==='income'&&new RegExp(`(?:给|向|转给|付给|发给|送给)(?:了)?${SELF}|${SELF}(?:收到|收下|拿到|得到|获赠|领到)`).test(prefix))return true;
  if(selfStart.test(prefix))return true;
  const before=prefix.slice(0,verbIndex).replace(/^(?:今天|本月|这个月|这次|本次|当月|随后|之后|后来|刚才|现在|月底|最终|结果|已经|另外|此外|又|再|还|一共|共|总共|其中|也|成功|刚刚|实际|实际已经|本人的|我的|你的|我已|你已|已|从而|因此|就|临时|暂时|长期|正式|只|仅|连续|去)+/,'').trim();
  return inherited!=='third'&&(!before||activityPrefix.test(before));
}
function categoryFor(prefix,kind){
  if(kind==='balance')return 'balance';
  if(kind==='expense')return /(?:日常|生活|房租|伙食|饭钱|餐费|通勤|水电)/.test(prefix)?'living':/捐|赈灾/.test(prefix)?'donation':/还款|偿还|归还|还债/.test(prefix)?'repayment':/购买|买了|买下|购入|采购/.test(prefix)?'purchase':/转给|汇给|赠给|送给|给/.test(prefix)?'transfer':'expense';
  return /奖金|奖励|奖赏|奖学金|获奖/.test(prefix)?'bonus':/退款|退回|退还/.test(prefix)?'refund':/借到|借款|贷款/.test(prefix)?'loan':/工资|薪水|薪资|报酬|打工|外卖|兼职|工作|劳动|务工/.test(prefix)?'wages':/赠|礼金|红包|资助|(?:给|向|转给)(?:了)?(?:我|你)/.test(prefix)?'gift':'income';
}
const labels={income:'收到款项','income-total':'本月收入合计',wages:'本月劳动报酬',bonus:'收到奖金',gift:'收到赠款',refund:'收到退款',loan:'借款到账',expense:'实际支出','expense-total':'本月支出合计',purchase:'购买物品',living:'本月生活开支',repayment:'偿还款项',donation:'捐赠款项',transfer:'转出款项',balance:'确认现有余额'};
const incomeVerb=/收到|收下|收取|收了|已收|拿到|拿到了|领到|领取|领了|获赠|获得|得到|得了|赚到|赚得|赚了|赚取|赚|挣到|挣得|挣了|挣|入账|到账|收入(?:为|是|了)?|借到|退回|退还|给(?:了)?(?:我|你|本人|自己)|向(?:我|你).{0,4}(?:转|付|汇)|发给(?:了)?(?:我|你)/g;
const expenseVerb=/支付|付了|付出|付款|付给|付|花了|花费|花掉|花去|花|支出|消费|捐了|捐赠|捐出|偿还|归还|还款|买了|买下|购入|转给|汇给|送给|赠给|给了|交了|缴纳|扣了|扣除|扣款|损失/g;
const balanceVerb=/(?:余额|现有资金|资金总额|存款|账户(?:里|中)?(?:现有|共有|还有|剩下)?|手头(?:现有|共有|还有|剩下)?|身上(?:共有|还有|剩下)?)(?:已经|现在|已|变成|变为|成为|调整为|是|为|有|剩下|剩余|达到|共有|合计|共)?/g;
const lastMatch=(regex,text)=>[...text.matchAll(regex)].at(-1)||null;
function counterparty(prefix){return prefix.match(/([^，。]{1,20}?)(?:给|向|转给)(?:了)?(?:我|你)/)?.[1]?.replace(/^(?:本月|今天|这次|已经|随后)/,'')||null;}
function cashClauses(text){
  const result=[];let workContext=false;
  for(const sentence of clean(text).split(/[。！？!?；;\n]/)){
    let conditional=false,inherited='self';
    for(const part of sentence.split(/[，,]|(?:并且|然后|同时|但是|不过|而是|但|却)/)){
      const evidence=part.trim();if(!evidence)continue;
      if(/如果|假如|假设|倘若|要是/.test(evidence))conditional=true;
      if(conditional)continue;
      const verb=evidence.search(/收到|收下|赚|挣|支付|付了|付给|花|收入|工资|余额|打工|工作|送外卖/);
      if(thirdSubject.test(evidence)||verb>0&&!selfStart.test(evidence)&&!personal(evidence.slice(0,verb),{verbIndex:verb}))inherited='third';
      else if(selfStart.test(evidence))inherited='self';
      if(inherited==='self'&&/打工|上班|务工|送(?:了)?(?:[^，。]{0,8})?外卖|送快递|配送|送餐|兼职|工作|做工|入职|任职|月薪|月工资|月收入/.test(evidence)&&!speculative.test(evidence)&&!negative.test(evidence))workContext=true;
      result.push({evidence,inherited,workContext});
    }
  }
  return result;
}
/** Parse completed personal cash facts, not prices, hopes, third-party accounts
 * or monthly rates. Keep the evidence and stable identity for audit/deduping. */
export function parseEconomicText(text,{source='action'}={}){
  const transactions=[];
  for(const {evidence,inherited,workContext} of cashClauses(text)){
    if(speculative.test(evidence)||negative.test(evidence)||/欠(?:我|你)|(?:我|你)应收|营业额|营收|估值|项目预算|公司预算|设备价值/.test(evidence))continue;
    let previousEnd=0;
    for(const match of evidence.matchAll(tokenPattern())){
      const amount=parseMoneyAmount(match[1]);if(amount===null)continue;
      const index=match.index,prefix=evidence.slice(0,index),tail=evidence.slice(index+match[0].length,index+match[0].length+16);
      if(!match[2]&&/^(?:个|月|年|天|小时|分钟|次|单|人|份|件|枚|张|辆|台|套|只|头|股|斤|公斤|公里|米|岁|%|％)/.test(tail))continue;
      if(/(?:月薪|每月|每个月|月工资|月收入|日薪|时薪|年薪|每天|每小时)[^，。]{0,20}$/.test(prefix)&&!/已(?:经)?到账|实际收到/.test(evidence))continue;
      const balance=lastMatch(balanceVerb,prefix),incoming=lastMatch(incomeVerb,prefix),outgoing=lastMatch(expenseVerb,prefix);
      let event=[balance&&{kind:'balance',match:balance},incoming&&{kind:'income',match:incoming},outgoing&&{kind:'expense',match:outgoing}].filter(Boolean).sort((a,b)=>b.match.index-a.match.index)[0];
      if(!event){
        const after=tail.match(/^(?:已经|已|全部|都)?(到账|入账|支付|付给|支出|转给|捐出)/);
        if(after&&(!prefix||selfStart.test(prefix))){event={kind:/到账|入账/.test(after[1])?'income':'expense',match:{index:Math.max(0,index-1)}};}
      }
      if(!event)continue;
      const verbPrefix=prefix.slice(event.match.index);
      if(/(?:给|向|转给|发给|退还给)(?:了)?(?:我|你|本人|自己)/.test(verbPrefix)||/^(?:给|转给|交给)(?:我|你|本人|自己)/.test(tail))event={...event,kind:'income'};
      if(!personal(prefix+(/^(?:给|转给|交给)(?:我|你|本人|自己)/.test(tail)?tail:''),{direction:event.kind,verbIndex:event.match.index,inherited}))continue;
      if(event.kind==='balance'&&!/(?:余额|存款|资金|账户|手头|身上)/.test(verbPrefix))continue;
      if(index-event.match.index>70)continue;
      // Totals at the end of a receipt merely restate its component amounts.
      if(previousEnd&&/合计|共计|总共|一共|总计|共(?:收|得|赚|挣|支出)?/.test(evidence.slice(previousEnd,index)))continue;
      let category=categoryFor(prefix.slice(Math.max(previousEnd,event.match.index-14)),event.kind);
      if(category==='income'&&workContext)category='wages';
      if(event.kind==='income'&&/总收入|收入合计|一共赚|总共赚|合计收入/.test(prefix))category='income-total';
      if(event.kind==='expense'&&/总支出|支出合计|一共花|总共花/.test(prefix))category='expense-total';
      const party=counterparty(prefix),signed=event.kind==='expense'?-amount:amount;
      const duplicate=transactions.some(row=>row.kind===event.kind&&row.category===category&&row.amount===signed&&(!party||!row.counterparty||party===row.counterparty));
      if(duplicate&&!/另外|此外|又|再|另一笔|分别|各自|第二笔/.test(evidence))continue;
      transactions.push({id:`cash-${source}-${hash(evidence+'|'+index+'|'+category)}`,kind:event.kind,category,amount:signed,label:labels[category],evidence:evidence.slice(0,600),source,counterparty:party});
      previousEnd=index+match[0].length;
    }
  }
  return transactions.slice(0,24).filter((row,index,all)=>!['income-total','expense-total'].includes(row.category)||Math.abs(row.amount)!==all.filter((other,j)=>j!==index&&other.kind===row.kind&&!other.category.endsWith('-total')).reduce((sum,other)=>sum+Math.abs(other.amount),0));
}
export function economicActionPlan(action){return {version:ECONOMY_VERSION,transactions:action?.custom&&!action.passive?parseEconomicText(action.label):[]};}

const workWords=/打工|兼职|上班|务工|务农|送(?:了)?(?:[^，。]{0,8})?外卖|(?:干|做)[^，。]{0,10}(?:外卖|配送|工作)|送快递|接单|工作|做工|挣工资|赚工资|领工资|入职|任职|配送|送餐|全职|签(?:订|了)劳动合同/;
const professionPattern=/(?:成为|担任|入职|应聘成功|应聘上|找到.{0,6})(?:了|一名|一位)?(工程师|教师|医生|护士|记者|工人|程序员|歌手|演员|公务员|研究员|配送员|快递员)/;
const stopWords=/辞职|离职|停止工作|不再(?:打工|工作|上班|兼职)/;
function ownWork(clause,inherited='self'){
  if(thirdSubject.test(clause))return false;
  if(/(?:没有|没能|并未|尚未|不会|不能|无法|不想|不愿|未曾|不)(?:[^，。]{0,5})(?:辞职|离职|工作|打工|上班|入职|成为|兼职)/.test(clause)&&!/(?:我|你|本人|自己)(?:已经|决定|正式)?不再(?:打工|工作|上班|兼职)/.test(clause))return false;
  if(/如果|假如|假设|听说|据说|希望|打算|计划|准备|想去|想要|要去|明天|下月|下个月|以后会|未来会|可能|想(?:工作|打工|上班|兼职|入职|成为)/.test(clause))return false;
  const verb=clause.search(/打工|兼职|上班|务工|务农|送(?:了)?(?:[^，。]{0,8})?外卖|(?:干|做)[^，。]{0,10}(?:外卖|配送|工作)|送快递|接单|工作|做工|入职|任职|配送|送餐|全职|成为|担任|辞职|离职|不再|停止|月薪|月工资|月收入|每月|签(?:订|了)劳动合同/);
  return verb>=0&&personal(clause,{direction:'work',verbIndex:verb,inherited});
}
function salaryOf(text){
  const match=text.match(new RegExp(`(?:月薪|月工资|月收入|每月(?:的)?(?:工资|收入|挣|赚))[：:\\s为是到涨至提升增加了]*(${NUMBER})\\s*(?:${CURRENCY})?`));
  return match?parseMoneyAmount(match[1]):null;
}
function endedJob(job,turn,reason='期限已结束'){
  return {...job,economyVersion:ECONOMY_VERSION,active:false,monthlyIncome:0,monthlyExpenses:0,lastMonthlyIncome:job.monthlyIncome||job.lastMonthlyIncome||0,endedTurn:turn,endReason:reason};
}
function currentTurn(state){return Number.isInteger(state.turn)?state.turn:state.history?.length||0;}
function durationOf(clause){
  const value=clause.match(new RegExp(`(?:工作|打工|外卖|送餐|兼职|上班|做工|合同期?|聘期|工期|任职|只干|只做|干|做|持续|为期|期限|送)(?:了|为期|期限|共|仅|只|是|为|\\s)*(${NUMBER}|一个半|半)(?:个)?月`))?.[1];
  return value===undefined?null:value==='半'?1:value==='一个半'?2:parseMoneyAmount(value);
}
export function parseEmploymentAction(state,action,{occupation=null}={}){
  if(!action?.custom||action.passive)return null;
  const turn=currentTurn(state)+1,previous=employmentForState(state);let job=null,associated=false;
  for(const {evidence:clause,inherited} of cashClauses(action.label)){
    const salary=salaryOf(clause),profession=clause.match(professionPattern)?.[1],durationNumber=durationOf(clause);
    const supplemental=associated&&(salary!==null||durationNumber!==null||/^(?:合同)?(?:期限|长期|短期|临时|全职)/.test(clause))&&inherited!=='third'&&!speculative.test(clause)&&!/他|她|老板|朋友|没有|尚未|不再/.test(clause);
    if(!ownWork(clause,inherited)&&!supplemental)continue;
    if(stopWords.test(clause)){
      const base=job||previous||{kind:'暂未就业',monthlyIncome:0,monthlyExpenses:0,previousOccupation:state.person?.occupation||'在当地生活',previousStatus:state.person?.status||''};
      job=/月底|做完|干完|工作后|下班后|结清工资后/.test(clause)?{...base,economyVersion:ECONOMY_VERSION,active:true,term:'temporary',throughTurn:turn,sourceAction:action.label.slice(0,1000)}:endedJob({...base,term:'stopped'},turn,'已离职');associated=true;continue;
    }
    if(!workWords.test(clause)&&salary===null&&!profession&&!supplemental)continue;
    const prior=job||previous,knownRole=occupation&&occupation!=='暂未就业'?occupation:/(?:工程师|教师|医生|护士|记者|工人|程序员|歌手|演员|公务员|研究员|配送员|快递员|Afterglow成员)/.test(state.person?.occupation||'')?state.person.occupation:null;
    const specified=/外卖|送餐/.test(clause)?'外卖配送员':/快递|送货|派送/.test(clause)?'快递员':/餐饮|餐厅|饭店|服务员|咖啡|奶茶|厨师/.test(clause)?'餐饮服务员':/工厂|流水线|质检|零件|分拣/.test(clause)?'工厂工作人员':/会计|文员|办公|校对|录入/.test(clause)?'办公室职员':/务农|农场|采摘/.test(clause)?'务农':null;
    const kind=profession||specified||(/兼职/.test(clause)?'兼职工作者':prior?.kind&&prior.kind!=='暂未就业'?prior.kind:knownRole||'受雇工作者');
    const same=kind===prior?.kind,priorRate=same?(prior.monthlyIncome||prior.lastMonthlyIncome||0):0;
    const amount=salary??(priorRate||1800+Math.round(((state.stats?.intelligence||0)+(state.stats?.fitness||0))*13));
    const limited=/只(?:做|干|工作|打工|上班|送|接)|仅(?:做|干|工作|打工|上班)|临时|短期|日结|本月(?:做|干|工作|打工|上班|送)|这个月(?:做|干|工作|打工|上班|送)|做了一个月|干了一个月/.test(clause)||durationNumber!==null;
    const ongoing=!limited&&(!!profession||/正式入职|入职|找到工作|找到一份.{0,10}工作|开始任职|长期|全职|固定工作|签(?:订|了)劳动合同|以后每月|今后每月|每个月都|从此.{0,10}(?:工作|上班|任职)/.test(clause)||same&&prior?.active!==false&&prior?.term==='ongoing');
    // A separate salary clause changes the rate, not the duration already chosen.
    const onlyRate=associated&&salary!==null&&durationNumber===null&&!profession&&!workWords.test(clause)&&!/长期|全职|临时|短期/.test(clause);
    const throughTurn=onlyRate?prior.throughTurn:ongoing?null:same&&prior?.active!==false&&!limited&&Number.isInteger(prior?.throughTurn)?Math.max(turn,prior.throughTurn):turn+Math.max(1,Math.min(1200,durationNumber||1))-1;
    job={kind,monthlyIncome:clip(amount),monthlyExpenses:same&&salary===null&&prior.monthlyExpenses>0?prior.monthlyExpenses:Math.min(1800,Math.round(amount*.3)),economyVersion:ECONOMY_VERSION,active:true,term:onlyRate?prior.term:ongoing?'ongoing':'temporary',startedTurn:onlyRate||same&&prior?.active!==false?prior.startedTurn??turn:turn,throughTurn,estimatedIncome:salary===null?(same?prior.estimatedIncome!==false:true):false,previousOccupation:same&&prior?.previousOccupation?prior.previousOccupation:state.person?.occupation||'在当地生活',previousStatus:same&&prior?.previousStatus?prior.previousStatus:state.person?.status||'',sourceAction:action.label.slice(0,1000)};
    associated=true;
  }
  return job;
}
/** One-time, evidence-based legacy migration. Historical balances and receipt
 * text are not rewritten. Old one-off jobs only stop future phantom payroll. */
export function migrateEmployment(state){
  if(state.economyVersion===ECONOMY_VERSION)return state.employment||null;
  if(state.employment?.economyVersion===ECONOMY_VERSION){state.economyVersion=ECONOMY_VERSION;return state.employment;}
  const original=state.employment;if(!original){state.economyVersion=ECONOMY_VERSION;return null;}
  const backgroundClauses=String(state.profile?.backgroundText||'').split(/[，。；,;\n]/).filter(text=>!/(?:父母|父亲|母亲|爸爸|妈妈|家人|朋友)/.test(text)||/(?:我|本人|自己).{0,12}(?:是|就读|在读)/.test(text));
  const baseOccupation=original.previousOccupation||(state.person?.occupation!==original.kind?state.person?.occupation:null)||state.profile?.persona?.occupation||(/学生|研究生|在读|就读|读大学|上大学/.test(backgroundClauses.join('，'))||state.profile?.age>=6&&state.profile?.age<18?'学生':'在当地生活');
  const basePerson={...state.person,occupation:baseOccupation,status:original.previousStatus||state.profile?.persona?.status||'处理日常学习、工作与家庭事务'};
  let replay=null,found=false;
  for(const [index,row] of (state.history||[]).entries()){
    const turn=Number.isInteger(row.turn)?row.turn:index+1;
    if(row.actionResult?.success!==false){
      const parsed=parseEmploymentAction({...state,economyVersion:ECONOMY_VERSION,person:basePerson,turn:turn-1,employment:replay,stats:row.stats||state.stats},row.action||{});
      if(parsed){
        const recorded=row.actionResult?.declarations?.employment;
        replay=recorded&&Number.isFinite(recorded.monthlyIncome)&&parsed.active?{...parsed,monthlyIncome:recorded.monthlyIncome,monthlyExpenses:Number.isFinite(recorded.monthlyExpenses)?recorded.monthlyExpenses:parsed.monthlyExpenses}:parsed;found=true;
      }
    }
    if(replay?.active&&Number.isInteger(replay.throughTurn)&&turn>=replay.throughTurn)replay=endedJob(replay,turn);
  }
  if(found)state.employment={...replay,migratedFromActions:true};
  else state.employment={...original,economyVersion:ECONOMY_VERSION,term:'legacy',active:original.monthlyIncome>0,migrationUnconfirmed:true};
  if(found&&state.employment.active===false&&state.person?.occupation===original.kind){state.person.occupation=state.employment.previousOccupation||baseOccupation;state.person.status=state.employment.previousStatus||basePerson.status;}
  state.economyVersion=ECONOMY_VERSION;return state.employment;
}
export function employmentForState(state){
  if(state.employment?.economyVersion===ECONOMY_VERSION||state.economyVersion===ECONOMY_VERSION)return state.employment||null;
  const copy={...state,person:state.person?{...state.person}:undefined};return migrateEmployment(copy);
}
export function settleEconomicAction(state,action,plan,success){
  const turn=currentTurn(state)+1,job=success&&plan.employment?plan.employment:employmentForState(state);
  const entries=[],transactions=success?(plan.economy?.transactions||[]):[];
  const active=job&&job.active!==false&&job.monthlyIncome>0&&(!Number.isInteger(job.throughTurn)||turn<=job.throughTurn)&&!(state.specialLife&&state.specialLife.body!=='human');
  const coverWages=transactions.some(row=>['wages','income-total'].includes(row.category));
  const coverLiving=transactions.some(row=>['living','expense-total'].includes(row.category));
  if(!(state.specialLife&&state.specialLife.body!=='human')){
    if(active&&!coverWages)entries.push({id:`employment-${turn}`,kind:'income',category:'wages',label:`${job.kind}收入`,amount:job.monthlyIncome,source:'employment',estimated:job.estimatedIncome!==false});
    if(active&&job.monthlyExpenses>0&&!coverLiving)entries.push({id:`living-${turn}`,kind:'expense',category:'living',label:'本月日常开支',amount:-job.monthlyExpenses,source:'employment'});
  }
  let running=Number(state.stats?.funds)||0;for(const row of entries)running+=row.amount;
  for(const row of transactions){
    const amount=row.kind==='balance'?clip(row.amount-running):row.amount;
    entries.push({...row,amount,...(row.kind==='balance'?{balanceTarget:row.amount}:{}),id:`${row.id}-${turn}`});running+=amount;
  }
  const expired=!!job&&job.active!==false&&Number.isInteger(job.throughTurn)&&turn>=job.throughTurn;
  return {job:expired?endedJob(job,turn):job,entries,settledEmployment:active?{...job}:null,employmentExpired:expired,moneyDeclared:transactions.length>0,economyVersion:ECONOMY_VERSION};
}

function entryCategory(row){return row.category||(/奖金|奖励/.test(row.label||'')?'bonus':/工资|薪水|劳动|工作.*收入|配送.*收入/.test(row.label||'')?'wages':/日常|生活开支/.test(row.label||'')?'living':row.amount<0?'expense':'income');}
const compact=text=>String(text||'').normalize('NFKC').replace(/[\s，。；、,:;.!！?？]/g,'');
/** The model may report an actual one-off receipt in consequence. It cannot
 * create recurring employment, replace an agreed wage, or reset a balance.
 * Missing economicUpdates falls back to the same conservative prose parser. */
export function normalizeEconomicUpdates(raw,{action,response,existingEntries=[]}={}){
  const text=typeof response==='string'?response:String(response?.consequence||'');
  if(!text||text.length>12000)return [];
  const observed=parseEconomicText(text,{source:'model'}),candidates=[];
  for(const row of Array.isArray(raw)?raw.slice(0,24):[]){
    if(!row||!['income','expense','balance'].includes(row.kind)||!MONEY_CATEGORIES.includes(row.category)||typeof row.evidence!=='string'||!row.evidence.trim()||!compact(text).includes(compact(row.evidence)))continue;
    const amount=typeof row.amount==='number'?Math.abs(row.amount):parseMoneyAmount(row.amount);if(!Number.isFinite(amount)||amount>LIMIT)continue;
    // Validate in the full sentence's scope. A model cannot strip "if" or a
    // third-party subject from its evidence to turn a claim into personal cash.
    const parsed=observed.find(value=>value.kind===row.kind&&Math.abs(value.amount)===Math.round(amount)&&(compact(row.evidence).includes(compact(value.evidence))||compact(value.evidence).includes(compact(row.evidence))));
    if(parsed)candidates.push(parsed);
  }
  candidates.push(...observed);
  const result=[],existing=[...existingEntries];
  const declared=action?.custom&&!action.passive?parseEconomicText(action.label):[];
  for(const row of candidates){
    if(row.kind==='balance'||row.category.endsWith('-total')||row.category==='wages')continue;
    // Wages and minigame bonuses are paid by the local ledger. Prose can repeat
    // those facts; it cannot turn them into an additional transfer.
    if(row.category==='living'&&existing.some(entry=>entryCategory(entry)==='living'))continue;
    if(row.category==='bonus'&&existing.some(entry=>entryCategory(entry)==='bonus'))continue;
    if(['income','expense'].includes(row.category)&&row.amount===existing.filter(entry=>Math.sign(entry.amount)===Math.sign(row.amount)).reduce((sum,entry)=>sum+entry.amount,0))continue;
    if([...existing,...declared,...result].some(entry=>entry.id===row.id||Math.round(entry.amount)===row.amount&&(entry.evidence&&compact(entry.evidence)===compact(row.evidence)||(entryCategory(entry)===row.category||['income','expense'].includes(row.category))&&(!entry.counterparty||!row.counterparty||entry.counterparty===row.counterparty))))continue;
    result.push({...row,id:`model-${hash(row.evidence+'|'+row.category+'|'+row.amount)}`});
  }
  return result.slice(0,12);
}
