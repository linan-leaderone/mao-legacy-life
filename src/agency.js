import {relationshipBehaviorDelta} from './adult-relationships.js';
import {countryRegionNames} from './countries.js';
// Personal declarations are stored as world facts; narration cannot undo them.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const monthOf=(year,month=1)=>(year-2020)*12+month-1;
export const monthNumber=month=>((month%12)+12)%12+1;
export function freedomMode(s){return s.profile.narrative==='balanced'?'grounded':['unlimited','influential','grounded'].includes(s.profile.freedom)?s.profile.freedom:'influential';}
export function affirmedClauses(text){
  const clauses=[];
  for(const sentence of String(text||'').split(/[。！？；;\n]/)){
    let hypothetical=false;
    for(const piece of sentence.split(/[，,]|(?:并且|然后|同时)/)){
      const clause=piece.trim();if(!clause)continue;
      // A conditional opening governs the following comma clauses until the sentence ends.
      if(/^(?:(?:我|本人|自己)(?:想|曾)?(?:问|知道)?\s*)?(?:假如|如果|假设|要是|倘若)|^(?:听说|据说|传闻|也许|可能)|(?:我想了解|我考虑是否|我希望有一天|我想象|我做梦|我梦见)/.test(clause))hypothetical=true;
      if(hypothetical||/(?:不想|不打算|没打算|不准备|不会|不能|无法|不要|不同意|不愿意|不允许|不接受|不支持|不赞成|尚未|还未|并未|从未|未曾|未能|没能|没有|反对|否认|拒绝|放弃|取消|暂缓|暂不|能否|是否|怎么办|如何才能)/.test(clause))continue;
      const stoppedWork=/(?:^|我|本人|自己)(?:已经|决定|正式|选择)?不再(?:打工|工作|上班|兼职)/.test(clause);
      if(!stoppedWork&&/(?:不|未|没)(?:曾|再|会|愿|肯)?(?:去)?(?:发动|引发|掀起|爆发|开始|挑起|结束|终结|平息|停止|签署|宣布|帮助|支持|击败|打败|获胜|取胜|加入|成为|当上|担任|就任|出任|接任|辞职|离职|工作|打工|上班|赚|挣|得到|收入|穿越|回到|返回|抵达|来到|返老还童|变回|变成|越狱|出狱|获释|离开监狱|摆脱监禁|参军|入伍|是)/.test(clause))continue;
      clauses.push(clause);
    }
  }
  return clauses;
}
const regionalName={...countryRegionNames,china:'中国',taiwan:'台湾',japan:'日本',hongkong:'香港',macau:'澳门',korea:'韩国',europe:'欧洲',global:'各地'};
const namedCountries=Object.entries(countryRegionNames).sort((a,b)=>b[1].length-a[1].length);
function mentionedRegion(text,fallback){
  if(/世界.*和平|永久和平|所有战争|大亚洲战争|欧陆战争/.test(text))return 'global';
  if(/台湾|台海|民进党|国民党|基进党|郑村棋|赖清德|韩国瑜/.test(text))return 'taiwan';
  if(/日本|afterglow|丰川祥子|羽泽鸫|美竹兰/i.test(text))return 'japan';
  if(/中国|大陆|中华|中共|革命阵线|毛远新|韩东方|李作成/.test(text))return 'china';
  if(/香港/.test(text))return 'hongkong';if(/澳门/.test(text))return 'macau';if(/韩国/.test(text))return 'korea';
  for(const [region,name] of namedCountries)if(name.length>1&&text.includes(name))return region;
  return fallback==='ocean'?'china':fallback;
}
const winners=[
  {names:/羽泽鸫|羽沢つぐみ|日本左翼|日本民主联合军/,region:'japan',leader:'羽泽鸫',government:'羽泽鸫与左翼联合阵线主持的过渡政府',anchor:'jp_hazawa_end',route:'jp_hazawa'},
  {names:/丰川祥子|豊川祥子/,region:'japan',leader:'丰川祥子',government:'丰川祥子主持的紧急委员会',anchor:'jp_toyokawa_end',route:'jp_toyokawa'},
  {names:/台湾左翼|左翼联盟|郑村棋/,region:'taiwan',leader:'左翼联盟',government:'台湾社会主义共和国临时政府',anchor:'tw_left_end'},
  {names:/民进党|赖清德/,region:'taiwan',leader:'赖清德',government:'民进党主持的战后政府',anchor:'tw_dpp_end'},
  {names:/国民党|韩国瑜/,region:'taiwan',leader:'韩国瑜',government:'国民党主持的战后政府',anchor:'tw_kmt_end'},
  {names:/基进党|陈奕齐/,region:'taiwan',leader:'陈奕齐',government:'基进党主持的战后政府',anchor:'tw_revanchist_end'},
  {names:/革命阵线/,region:'china',leader:'革命阵线临时领导机构',government:'革命阵线主持的战后临时政府',anchor:'cn_front_victory'},
  {names:/韩东方|长征(?:机)?/,region:'china',leader:'韩东方',government:'中华共和国过渡政府',anchor:'cn_republic_foundation'},
  {names:/令计划/,region:'china',leader:'令计划',government:'令计划领导的战后政府',anchor:'cn_ling_victory'},
  {names:/李作成/,region:'china',leader:'李作成',government:'红色军政府',anchor:'cn_red_junta'}
];
function winnerIn(text){
  return winners.map(w=>({winner:w,match:text.match(w.names)})).filter(x=>x.match).sort((a,b)=>a.match.index-b.match.index)[0]?.winner||null;
}
function victoryWinner(clause){
  if(/下棋|棋赛|比赛|球赛|辩论赛|游戏/.test(clause))return null;
  const passive=clause.match(/被(.+?)(?:击败|打败|战胜)/);
  if(passive)return winnerIn(passive[1]);
  const lost=clause.match(/(?:败给|输给)(.+)/);if(lost)return winnerIn(lost[1]);
  const defeat=clause.match(/(?:击败|打败|战胜)/);
  if(defeat){const subject=clause.slice(0,defeat.index),help=subject.match(/(?:帮助|协助|支持|带领|率领|让|使)(.+)/);return winnerIn(help?.[1]||subject);}
  const success=clause.match(/(?:获胜|胜利|取胜|赢得|赢下|夺取政权)/);
  if(success)return winnerIn(clause.slice(0,success.index));
  return null;
}
function conflictName(clause,region,s,{victory=false}={}){
  if(/世界.*和平|永久和平|所有战争|全部战争/.test(clause))return 'all';
  const named=clause.match(/大亚洲战争|台海战争|美国内战|欧陆战争|(?:第二次|全面)?中国内战|台湾内战|日本内战/);
  if(named)return named[0];
  return s.worldOverrides?.[region]?.conflict||`${regionalName[region]||s.location}${victory||/内战/.test(clause)?'内战':'战争'}`;
}
function isFactionRole(title){
  if(/国家主席|国家领导人|最高领导人|总统|首相|总理|天皇|中共中央总书记/.test(title))return false;
  return /afterglow|乐队|公司|组织|势力|社团|政党|党(?:的)?(?:主席|领袖|领导人|负责人|总书记)|民进党|国民党|基进党|自民党|工会|联盟|联合军|军队|阵线|委员会|协会/i.test(title);
}
export function declarationPlan(s,action,{region='china',ageMonths=216}={}){
  const plan={facts:[],worldChanges:[],relationships:[],delta:{},ageMonths:null,dateMonth:null,occupation:null,ideology:null,employment:null,explicitFunds:null};
  if(!action?.custom||action.passive)return plan;
  const clauses=affirmedClauses(action.label),text=clauses.join('，');
  if(!text)return plan;
  plan.facts=clauses.map(t=>t.slice(0,360)).slice(0,12);
  const travel=text.match(/(?:穿越(?:时空|时间)?|回到|抵达|来到|时间(?:变为|变成|来到|倒流到|跳到)|返回|快进到)(?:了|至|到|过去的|未来的|公元|\s)*(\d{3,4})(?:\s*年)?(?:\s*(\d{1,2})月)?/);
  if(travel){const y=Number(travel[1]),m=Number(travel[2]||1);if(y>=100&&y<=9999&&m>=1&&m<=12)plan.dateMonth=monthOf(y,m);}
  const rejuvenation=text.match(/(?:返老还童|恢复年轻|恢复青春|变年轻|变老|年龄(?:变为|变成|改成|调整为)|身体(?:恢复|变成)|变回)(?:了|到|为|成|至|\s)*(\d{1,4})\s*岁/);
  if(rejuvenation)plan.ageMonths=clamp(Number(rejuvenation[1]),0,999)*12;
  const ideology=text.match(/(?:我的意识形态(?:是|变为)|我(?:选择|信奉|信仰|转向|改信))(?:了)?([^，。]{2,30}(?:主义|派|民主|自由|保守))/);
  if(ideology)plan.ideology=ideology[1].slice(0,80);
  if(/加入\s*afterglow|成为\s*afterglow.{0,8}成员/i.test(text)){
    plan.occupation='Afterglow成员';plan.relationships.push(...['美竹兰','羽泽鸫','青叶摩卡','上原绯玛丽','宇田川巴'].filter(name=>name!==s.profile.name).map(name=>`${name}：Afterglow的同伴，已建立合作与日常联系`));
  }
  for(const clause of clauses){
    const r=mentionedRegion(clause,region),area=regionalName[r]||s.location;
    const ending=/(?:结束|终结|平息|叫停|停止|阻止|防止|避免).{0,24}(?:内战|战争|战斗)|(?:实现|达成|促成|签署|宣布).{0,15}(?:停战|和平|停火)/.test(clause);
    if(!ending&&/(?:发动|引发|掀起|爆发|打响|宣布开始|挑起).{0,35}(?:内战|战争)|(?:内战|战争).{0,8}(?:开始|爆发)/.test(clause)){
      const civil=/内战/.test(clause),conflict=conflictName(clause,r,s);
      plan.worldChanges.push({region:r,conflict,stage:civil?'civil_war':'wartime',title:`${conflict}爆发`,description:`${s.profile.name}的行动使${conflict}实际爆发。各方调整部署，居民开始确认道路、物资与亲友的情况。`,kind:'war'});
    }
    if(ending){
      plan.worldChanges.push({region:r,conflict:null,terminatedConflict:conflictName(clause,r,s),stage:'reconstruction',title:`${area}停火与重建`,description:`${s.profile.name}促成了停火，交战各方停止主要战斗。地方人员着手恢复交通、核对失踪名单和安排复员。`,kind:'peace'});
    }
    if(/(?:获胜|胜利|取胜|赢得|赢下|击败|打败|战胜|败给|输给|夺取政权)/.test(clause)){
      const winner=victoryWinner(clause);
      if(winner)plan.worldChanges.push({...winner,names:undefined,conflict:null,terminatedConflict:conflictName(clause,winner.region,s,{victory:true}),stage:'reconstruction',title:`${winner.leader}取得胜利`,description:`${s.profile.name}的介入改变了力量对比，${winner.leader}取得胜利，主要战线停止交火。战后安排由新的权力中心接手，地方恢复工作随即展开。`,kind:'victory'});
    }
    const role=clause.match(/(?:我|本人|自己)(?:已经|成功|正式|也|亲自)?(?:成为|当上|出任|担任|接任|就任)(?:了|新的|新任|了新的|一名|一位)?([^，。]{0,35}(?:国家主席|最高领导人|总书记|总统|首相|主席|领导人|领袖|负责人))/);
    if(role){
      const title=role[1],faction=isFactionRole(title);
      plan.occupation=title;
      if(!faction)plan.worldChanges.push({region:r,leader:s.profile.name,government:`${s.profile.name}主持的${area}政府`,title:`${s.profile.name}接掌${area}领导职务`,description:`${s.profile.name}已就任${title}，现有机关开始按新的领导安排处理事务。支持者要求落实承诺，反对者则关注权力、分配与自身处境。`,stage:'player_government',kind:'leadership'});
    }
    const relations=clause.match(/(?:与|和)([\u4e00-\u9fa5A-Za-z·]{2,12})(?:成为朋友|结为盟友|合作|结盟)/);
    if(relations)plan.relationships.push(`${relations[1]}：已与本人建立合作关系`);
  }
  for(const clause of clauses){
    const stop=/(?:辞职|离职|停止工作|不再(?:打工|工作|上班|兼职))/.test(clause);
    if(stop){plan.employment={kind:'暂未就业',monthlyIncome:0,monthlyExpenses:0};plan.occupation='暂未就业';continue;}
    const previous=plan.employment||s.employment;
    const profession=clause.match(/(?:成为|担任|入职|应聘|找到.{0,6})(?:了|一名|一位)?(工程师|教师|医生|护士|记者|工人|程序员|歌手|演员|公务员|研究员|配送员|快递员)/)?.[1];
    const salary=clause.match(/(?:月薪|月工资|月收入|每月(?:工资|收入|挣|赚))[^\d]{0,3}(\d+(?:\.\d+)?)\s*(万|千|亿)?/);
    const work=/打工|兼职|上班|务工|务农|送外卖|送快递|接单|工作赚钱|继续工作|正常工作|参加工作|开始工作|找到工作|做工|挣工资|赚工资|领工资/.test(clause);
    if(!work&&!salary&&!profession)continue;
    const knownRole=plan.occupation&&plan.occupation!=='暂未就业'?plan.occupation:/(?:工程师|教师|医生|护士|记者|工人|程序员|歌手|演员|公务员|研究员|配送员|快递员|Afterglow成员)/.test(s.person?.occupation||'')?s.person.occupation:null;
    const specifiedJob=/外卖|送餐/.test(clause)?'外卖配送员':/快递|送货|派送/.test(clause)?'快递员':/餐饮|餐厅|饭店|服务员|咖啡|奶茶|厨师/.test(clause)?'餐饮服务员':/工厂|流水线|质检|零件|分拣/.test(clause)?'工厂工作人员':/会计|文员|办公|校对|录入/.test(clause)?'办公室职员':/务农|农场|采摘/.test(clause)?'务农':null;
    const kind=profession||specifiedJob||(/兼职/.test(clause)?'兼职工作者':previous?.monthlyIncome>0?previous.kind:knownRole||'受雇工作者');
    const income=salary?Number(salary[1])*({万:10000,千:1000,亿:1e8}[salary[2]]||1):previous?.monthlyIncome>0&&!profession&&(!specifiedJob||specifiedJob===previous.kind)?previous.monthlyIncome:1800+Math.round((s.stats.intelligence+s.stats.fitness)*13);
    const preserved=!salary&&previous?.monthlyIncome>0&&kind===previous.kind;
    plan.employment={kind,monthlyIncome:clamp(Math.round(income),0,1e12),monthlyExpenses:preserved?previous.monthlyExpenses:Math.min(1800,Math.round(income*0.3))};
    if(!/主席|总统|首相/.test(plan.occupation||s.person?.occupation||''))plan.occupation=kind;
  }
  const money=text.match(/(?:赚(?:到|得)?了?|挣(?:到|得)?了?|获得收入|收入|领取工资|得到报酬|赚取)\s*(\d+(?:\.\d+)?)\s*(万|千|亿)?(?:元|块|日元|新台币|港币)?/);
  if(money)plan.explicitFunds=clamp(Math.round(Number(money[1])*(money[2]==='亿'?1e8:money[2]==='万'?1e4:money[2]==='千'?1e3:1)),0,1e12);
  if(/帮助|救助|捐赠|救援|赈灾|守约|偿还|道歉/.test(text))plan.delta.morality=2;
  if(/贪污|侵吞|诈骗|背叛|欺骗|抢劫/.test(text))plan.delta.morality=-3;
  if(/演出|演讲|表演|唱歌|化妆|交际|沟通|安慰/.test(text))plan.delta.charisma=2;
  const preferenceDelta=relationshipBehaviorDelta(s,text,{ageMonths,nextAgeMonths:plan.ageMonths??ageMonths});
  if(preferenceDelta)plan.delta.promiscuity=preferenceDelta;
  return plan;
}
export function settlementPlan(s,action,plan,success){
  const entries=[],job=success&&plan.employment?plan.employment:s.employment;
  if(s.specialLife&&s.specialLife.body!=='human')return {job,entries};
  if(success&&plan.explicitFunds!==null){entries.push({label:'本月劳动与收入',amount:plan.explicitFunds});}
  else if(job?.monthlyIncome>0){entries.push({label:`${job.kind}收入`,amount:job.monthlyIncome});}
  if(job?.monthlyExpenses>0)entries.push({label:'本月日常开支',amount:-job.monthlyExpenses});
  return {job,entries};
}
export function validateAgencyRecord(s){
  const boundedMonth=m=>Number.isInteger(m)&&m>=monthOf(100)&&m<=monthOf(9999,12);
  if(!Number.isInteger(s.turn)||s.turn<0||s.turn>20000||s.history.length!==s.turn||!boundedMonth(s.month))throw new Error('这份档案的年月与经历记录不完整。');
  if(s.person?.ageOverride){const a=s.person.ageOverride;if(!Number.isInteger(a.months)||a.months<0||a.months>120000||!Number.isInteger(a.turn)||a.turn<0||a.turn>s.turn)throw new Error('这份档案的年龄变化记录不完整。');}
  if(s.worldOverrides&&Object.entries(s.worldOverrides).some(([region,v])=>!Object.hasOwn(regionalName,region)||!v||typeof v!=='object'||!boundedMonth(v.month)))throw new Error('这份档案的地区变更记录不完整。');
  if(s.history.some(h=>!boundedMonth(h.month)))throw new Error('这份档案的历史日期不完整。');
  if(s.employment&&(!Number.isFinite(s.employment.monthlyIncome)||s.employment.monthlyIncome<0||s.employment.monthlyIncome>1e12||!Number.isFinite(s.employment.monthlyExpenses)||s.employment.monthlyExpenses<0||s.employment.monthlyExpenses>1e12))throw new Error('这份档案的收支记录不完整。');
}
