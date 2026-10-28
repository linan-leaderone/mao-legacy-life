import {storyOverlap} from './story-flow.js';
import {continuityIssues} from './continuity.js';
import * as OpenCC from 'opencc-js/t2cn';
import {normalizeLanguage} from './language.js';

const simplify=OpenCC.Converter({from:'tw',to:'cn'});
const plainMartian={'伱':'你','莪':'我','啲':'的','ㄋ':'了','噯':'爱','昰':'是','亽':'人','卟':'不','吢':'心','仴':'月'};
const validationText=(text,language)=>language==='zh-TW'||language==='martian'?simplify(String(text||'')).replace(/[伱莪啲ㄋ噯昰亽卟吢仴]/g,c=>plainMartian[c]):String(text||'');
const mapText=(value,transform)=>Array.isArray(value)?value.map(item=>mapText(item,transform)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,mapText(item,transform)])):typeof value==='string'?transform(value):value;

function foreignProseIssues(response,context){
  const language=normalizeLanguage(context.language),issues=[],narrative=String(response.narrative||''),all=[narrative,response.consequence||''].join(' ');
  if(!['en','ja','ko'].includes(language))return issues;
  // Names and quoted user actions may remain in their original scripts.
  const prose=narrative.replace(/[“「『][^”」』]*[”」』]/g,'');
  if(language==='en'&&(prose.match(/[A-Za-z]/g)||[]).length<20)issues.push('正文须使用自然英语，保留姓名与用户原话，不能用中文正文代替。');
  if(language==='ja'&&(prose.match(/[ぁ-ゖァ-ヺ]/g)||[]).length<4)issues.push('正文须使用自然日语，保留姓名与用户原话，不能用中文正文代替。');
  if(language==='ko'&&(prose.match(/[가-힣]/g)||[]).length<8)issues.push('正文须使用自然韩语，保留姓名与用户原话，不能用中文正文代替。');
  for(const news of Array.isArray(response.newsTranslations)?response.newsTranslations:[]){
    if(!news||typeof news.description!=='string')continue;
    const description=news.description.replace(/[“「『][^”」』]*[”」』]/g,''),title=String(news.title||'');
    const wrongDescription=language==='en'?(description.match(/[A-Za-z]/g)||[]).length<12:language==='ja'?(description.match(/[ぁ-ゖァ-ヺ]/g)||[]).length<3:(description.match(/[가-힣]/g)||[]).length<6;
    // Japanese headings can legitimately consist entirely of kanji. The body
    // supplies the language evidence in that case; names retain their spelling.
    const wrongTitle=language==='en'&&/[\u3400-\u9fff]/.test(title)&&(title.match(/[A-Za-z]/g)||[]).length<3||language==='ko'&&/[\u3400-\u9fff]/.test(title)&&(title.match(/[가-힣]/g)||[]).length<2;
    if(wrongDescription||wrongTitle)issues.push(`newsTranslations中${String(news.id||'该报道').slice(0,70)}的标题和正文必须译成${language==='en'?'英语':language==='ja'?'日语':'韩语'}。保留人物原名、时间、地区与原事件事实，不能直接复制中文；无法翻译则不要提供该条翻译。`);
  }
  if(/as (?:the |a )?player|in this game|game mechanics?|attribute bonus|turn counter|ゲームの(?:ルール|システム)|プレイヤーとして|ゲーム内の|게임 (?:시스템|규칙)|플레이어로서|능력치 보너스/i.test(all))issues.push('用所选语言记述实际经历，删除玩家、机制和属性加成等局外说明。');
  if(Number.isInteger(context.ageYears))for(const [field,text]of [['narrative',response.narrative],['consequence',response.consequence],['memory',response.memory],...Object.values(response.personUpdate||{}).flat().map(value=>['personUpdate',value])]){
    const safeName=String(context.name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const subject=safeName?`(?:you|${safeName})`:'you';
    const patterns=[new RegExp(`\\b${subject}\\s+(?:are|is|have turned|has turned|just turned|turned)(?:\\s+(?:now|still|already|only|just))?\\s+(\\d{1,3})(?:\\s*(?:years? old|years? of age|[,.!;]))`,'ig'),/(?:あなた|君|あなた自身)(?:は|が)(?:現在|今|今年|まだ)?\s*(\d{1,3})\s*歳/g,/(\d{1,3})\s*歳のあなた/g,/(?:당신|여러분)(?:은|는|이|의 나이는)\s*(?:현재|지금|올해|아직)?\s*(\d{1,3})\s*(?:세|살)/g];
    for(const sentence of String(text||'').split(/[.!?。！？\n]/)){
      if(/years? ago|back then|at that time|remember when|when you were|以前|当時|幼い頃|몇 년 전|그 당시|어릴 때/i.test(sentence))continue;
      const allowed=[context.ageYears];if(field==='consequence'&&Number.isInteger(context.priorAgeYears))allowed.push(context.priorAgeYears);
      if(!context.ageOverride&&Number.isInteger(context.specialLife?.bodyAge)&&/body|physical|身体|外見|몸|신체/i.test(sentence))allowed.push(context.specialLife.bodyAge);
      if(patterns.some(pattern=>[...sentence.matchAll(pattern)].some(match=>!allowed.includes(Number(match[1])))))issues.push(`当前年龄为${context.ageYears}岁，行动时为${context.priorAgeYears??context.ageYears}岁。用所选语言保留正确年龄，不沿用旧年龄。`);
    }
  }
  const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
  for(const [field,expected]of [['narrative',context.month],['consequence',context.priorMonth]]){
    if(!Number.isInteger(expected))continue;
    const text=String(response[field]||'').trim();let statedYear,statedMonth;
    if(language==='en'){
      const match=text.match(new RegExp(`^(?:In |By |During |It is |Now it is )?(${months.join('|')})\\s+(\\d{3,4})\\b`,'i'));
      if(match){statedYear=Number(match[2]);statedMonth=months.indexOf(match[1].toLowerCase())+1;}
    }else if(language==='ko'){
      const match=text.match(/^(?:지금은\s*)?(\d{3,4})년\s*(\d{1,2})월/);if(match){statedYear=Number(match[1]);statedMonth=Number(match[2]);}
    }
    const allowed=field==='consequence'&&context.timeTravel?[expected,context.month]:[expected];
    if(statedMonth&&!allowed.some(value=>statedYear===2020+Math.floor(value/12)&&statedMonth===((value%12)+12)%12+1))issues.push(`${field}必须使用已经落实的当前年月：${2020+Math.floor(expected/12)}年${((expected%12)+12)%12+1}月。`);
  }
  const continuation=context.continuation;
  if(continuation?.income>0&&continuation.employment?.monthlyIncome>0&&/you (?:are still |remain |are )?unemployed|you (?:did not|didn't|have not|haven't) (?:receive|earn|get) (?:any )?(?:wages|pay|income)|あなたは(?:まだ)?失業中|給料を(?:全く)?受け取っていません|당신은 여전히 실업|급여를 받지 못했습니다/i.test(narrative))issues.push('本月工资已到账且工作继续，用所选语言承接这份实际工作与收入。');
  if(continuation?.encounterState?.infected&&/your infection (?:has )?(?:disappeared|cleared|healed)|you (?:are|remain) (?:completely )?infection[ -]free|感染は(?:完全に)?(?:治った|消えた|消失した)|감염이 (?:완전히 )?(?:사라졌|치유되었)/i.test(all))issues.push('感染仍在，不能用另一种语言撤销已有感染。');
  if(continuation?.encounter?.damageTaken>0&&/you (?:were |are |remain |escaped )?(?:unharmed|uninjured|unscathed)|あなたは(?:まったく|全く)?無傷|당신은 (?:완전히 )?무사히|상처 하나 없/i.test(all))issues.push('交锋已经造成伤势，保留实际受伤情况。');
  if(continuation?.fishHarvest?.eaten===0&&/you (?:caught|ate|devoured) (?:many|several|dozens|[1-9]\d*)|your body (?:has )?(?:grew|grown|became larger)|(?:沢山|たくさん|大量)の(?:小魚|魚)を(?:捕らえ|捕まえ|食べ)|身体が大きくなった|많은 물고기를 (?:잡았|먹었)|몸이 (?:크게 )?자랐/i.test(all))issues.push('本次捕食没有收获与成长，不能用所选语言虚构捕获或身体长大。');
  if((context.timeTravel||Number.isInteger(context.declarations?.ageMonths)||context.declarations?.worldChanges?.length)&&/it was (?:only|just) (?:a )?(?:dream|fantasy)|you (?:were|had been) (?:only|just) dreaming|(?:すべて|全て)は(?:ただの)?夢だった|그저 꿈(?:이었|에 불과)/i.test(all))issues.push('已完成的时间、身体或政治变化必须成立，不能改成梦境。');
  return issues;
}

export const WRITING_RULES=`使用现代汉语日常书面语，像人在交代实际经历，句子完整连贯。不要古文、网文腔、故作深奥、华丽辞藻、密集比喻和类比，不用单词或两三个字反复断成短句。
禁用“很沉”“很轻”“变轻”“脸上写着”；不用“而且、并且、不仅、不但、甚至、况且、何况、更何况、再者、此外、进而、进一步、更重要的是”等递进表达。禁用“不是…而是”“不是…是”“不是…不是…而是”“不是…也不是…”及“，却…”的转折句式。直写做了什么、遇到谁、得到什么结果，不在结尾升华人生。
每月最多写两段连贯正文。本人指定行动时，consequence用100–180字重点写行动过程、结果和实际影响，narrative用40–80字写一项新后续。只按下个月时，两段合计100–180字，以本月选出的新事件为中心；已有工作、项目、关系和身体状况作为背景，不每月反复办理同一件琐事。第二段不能再做一遍第一段的工作、再领一遍工资或再说一次约定，已办结事项保持办结。可以少于上限，不凑字数，不罗列新闻。`;

const forbidden=[
  /很沉|很轻|变轻|脸上写着/,
  /而且|并且|不仅|不但|甚至|况且|何况|再者|此外|进而|进一步|更重要的是/,
  /不是[^。！？\n]{0,100}(?:而是|也不是|不是|[,，]\s*是)/,
  /不是[^。！？\n]{0,50}是/,
  /[，,；;]\s*却/
];
const cnNumber=text=>{
  if(/^\d+$/.test(text))return Number(text);
  const digits={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
  let result=0,part=0;
  for(const c of text){if(c==='百'){result+=(part||1)*100;part=0;}else if(c==='十'){result+=(part||1)*10;part=0;}else if(Object.hasOwn(digits,c))part=digits[c];else return NaN;}
  return result+part;
};
export function proseIssues(originalResponse,{language='zh-CN',ageYears,priorAgeYears,name,region,occupation,month,priorMonth,specialLife,timeTravel,declarations,ageOverride,intimacyAllowed,canSuggestWorldUpdates,location,actionPassive,continuation}={}){
  language=normalizeLanguage(language);
  const response=mapText(originalResponse,text=>validationText(text,language));
  const fields=[response.title,response.narrative,response.consequence,response.memory,...(response.options||[]).flatMap(o=>[o.label,o.description]),...Object.values(response.personUpdate||{}).flat(),...(Array.isArray(response.worldUpdates)?response.worldUpdates:[]).flatMap(e=>[e?.title,e?.description])].filter(v=>typeof v==='string');
  const issues=foreignProseIssues(originalResponse,{language,ageYears,priorAgeYears,name,specialLife,ageOverride,timeTravel,declarations,continuation,month,priorMonth});
  if(['zh-CN','zh-TW','martian'].includes(language))for(const text of fields)for(const rule of forbidden){const match=text.match(rule);if(match)issues.push(`重写包含“${match[0].slice(0,35)}”的句子，直接叙述具体事情。`);}
  if(Number.isInteger(ageYears)){
    const safeName=String(name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const pattern=new RegExp(`(?:你(?:今年|现在|如今|已经|现年|年满|仍然|才|是|刚满|已满|已|满)?|${safeName||'这个人'}(?:今年|已经|现年|现在|才|是|年满)?)\\s*([零一二两三四五六七八九十百\\d]{1,4})\\s*岁`,'g');
    for(const [field,text] of [['narrative',response.narrative],['consequence',response.consequence],['memory',response.memory],...Object.values(response.personUpdate||{}).flat().map(t=>['personUpdate',t])])for(const sentence of String(text||'').split(/[。！？\n]/)){
      if(/那年|当年|当时|曾经|年前|小时候|回想|回忆|开局|2020年/.test(sentence))continue;
      const values=[...sentence.matchAll(pattern)].map(m=>cnNumber(m[1]));
      for(const m of sentence.matchAll(/([零一二两三四五六七八九十百\d]{1,4})岁的你/g))values.push(cnNumber(m[1]));
      const bodyAge=specialLife?.bodyAge;
      const priorAllowed=field==='consequence'||/岁时|岁那|生日之前|改变身体前|出发前/.test(sentence);
      if(values.some(n=>n!==ageYears&&!(priorAllowed&&n===priorAgeYears)&&!(!ageOverride&&Number.isInteger(bodyAge)&&n===bodyAge&&/身体|体貌|化形|外表/.test(sentence))))issues.push(`当前年龄为${ageYears}岁，行动发生时为${priorAgeYears??ageYears}岁。不得沿用初始年龄。`);
    }
  }
  for(const text of [response.narrative,response.consequence]){
    const sentences=String(text||'').split(/[。！？]/).map(s=>s.trim()).filter(Boolean);
    if(sentences.length>=5&&sentences.filter(s=>s.length<8).length>sentences.length/2)issues.push('合并碎句，使用完整连贯的日常书面语。');
  }
  for(const [field,expected]of [['title',month],['narrative',month],['consequence',priorMonth]]){
    if(!Number.isInteger(expected))continue;
    const first=String(response[field]||'').split(/[。！？]/)[0];
    const match=first.match(/^(?:(?:进入|到了|你在|你到|你于|在)\s*)?(?:(\d{3,4})\s*年\s*)?(十一|十二|[一二三四五六七八九十]|0?[1-9]|1[0-2])\s*月/);
    const candidates=field==='consequence'&&timeTravel?[expected,month]:[expected],calendarMonth=m=>((m%12)+12)%12+1;
    if(match&&!candidates.some(m=>cnNumber(match[2])===calendarMonth(m)&&(!match[1]||Number(match[1])===2020+Math.floor(m/12))))issues.push(`${field}的当前月份应为${2020+Math.floor(expected/12)}年${calendarMonth(expected)}月${field==='consequence'&&timeTravel?'，或明确写已经抵达的目标年月':''}，不能混入另一段的月份。`);
  }
  const grams=text=>{const s=String(text||'').replace(/[\s，。！？、：；,.!?]/g,'');return new Set(Array.from({length:Math.max(0,s.length-4)},(_,i)=>s.slice(i,i+5)));};
  const a=grams(response.narrative),b=grams(response.consequence);
  if((a.size>=30&&b.size>=30&&[...a].filter(g=>b.has(g)).length/Math.min(a.size,b.size)>0.62)||storyOverlap(response.consequence,response.narrative).length>=2)issues.push('两段大面积复述了相同经过。consequence保留上月行动，narrative写新月已变化的生活和后续事项。');
  if(region&&region!=='china'){
    for(const text of [response.narrative,response.consequence])if(/你[^。！？]{0,24}(?:向街道办|到街道办|找村支书|参加党支部|办理入党积极分子)/.test(text||''))issues.push('所在地不使用中国大陆基层党政办事流程，请按当前制度改写。');
  }
  if(/入伍受训|军人|士兵|自卫队受训/.test(occupation||'')&&/入伍前|尚未入伍|等待入伍|等待.{0,8}(?:体检|录用)|还未开始训练/.test([response.title,response.narrative].join(' ')))issues.push('本人已经入伍受训，请写当前训练和值勤，不能退回入伍前或等待录用。');
  if(specialLife?.kind==='deng_ocean'&&specialLife.stage<4&&/你[^。！？]{0,16}(?:去上班|交房租|缴房租|回家做饭|退休散步|到银行取钱|穿上外套|在办公室)/.test(response.narrative||''))issues.push('本人仍是海中的生物，请写游动、感知、进食和身体变化，不恢复普通人类日常。');
  if(specialLife?.kind==='deng_ocean'&&specialLife.stage<2&&!/长出.*鳞片|进化.*鳞片/.test(continuation?.action||'')&&/(?:你的?|身体的?)鳞片|鳞片(?:和|与|逐渐|发生|变得)/.test([response.narrative,response.consequence].join(' ')))issues.push('当前身体为水滴鱼，没有鳞片；请按已经确认的身体形态写游动和后续活动。');
  if(specialLife?.kind==='mao_resurrection'&&specialLife.stage<2&&/你[^。！？]{0,16}(?:走出家门|回家做饭|到公园散步|独自逛街|走进办公室)/.test(response.narrative||''))issues.push('本人仍在水晶棺内，请保留当前身体条件和与值守人员的沟通方式。');
  if((timeTravel||Number.isInteger(declarations?.ageMonths)||declarations?.worldChanges?.length)&&/(?:穿越|返老还童|年龄变化|内战|战争|停火|当选|就任)[^。！？\n]{0,24}(?:并未发生|没有发生|尚未实现|只是(?:一场)?(?:梦|幻想|设想|计划))|你(?:只是|只是在|仅仅)[^。！？\n]{0,14}(?:幻想|做梦|想象)/.test([response.title,response.narrative,response.consequence].join(' ')))issues.push('时间、身体或政治变化已明确发生，请承接当前状态，不能改成幻想、梦或未完成计划。');
  if(location&&originalResponse.location&&originalResponse.location!==location)issues.push('保持已落实的当前所在地，不能另行迁居。');
  if((actionPassive||canSuggestWorldUpdates===false)&&Array.isArray(response.worldUpdates)&&response.worldUpdates.length)issues.push('本次行动没有允许补充的公共事实，worldUpdates必须为空数组；保留已有新闻即可。');
  if(Array.isArray(response.worldUpdates)&&response.worldUpdates.some(e=>/玩家|游戏|本局|系统判定|路线分支|剧情节点|开发者|属性加成/.test(`${e?.title||''} ${e?.description||''}`)))issues.push('公共报道只写已发生的事实与社会影响，删除局外规则说明。');
  if(intimacyAllowed===false&&(fields.some(t=>/性行为|发生(?:了)?(?:性)?关系|性爱|性交|性欲|淫乱|色情|床笫|性爱玩具|用信息素|催眠.{0,12}(?:亲密|伴侣|服从)/.test(t))||(response.options||[]).some(o=>Number(o.delta?.promiscuity)>0)))issues.push('当前身体条件不允许成人亲密内容，请改为非性化的人际关系、照护和日常生活。');
  return [...new Set([...issues,...continuityIssues(response,continuation)])].slice(0,8);
}

export function tidyLocalProse(text){
  return String(text||'').replace(/而且|并且|不仅|不但|甚至|况且|更何况|何况|再者|此外|进而|进一步|更重要的是/g,'').replace(/很沉(?:重)?/g,'让人担忧').replace(/很轻(?:松)?|变轻/g,'有所缓解').replace(/脸上写着/g,'看起来').replace(/([，,；;])\s*却/g,'$1').replace(/不是([^。！？\n]{0,80}?)(?:，|,)?而是/g,'与$1相比，').replace(/，\s*，/g,'，');
}
