import {findPersona} from './personas.js';
import {regionForPlace} from './regions.js';

// This adapter only authorizes model-supplied public facts. It does not translate
// an action or replace the existing Chinese agency, economy, age or travel rules.
const clean=(v,n=4000)=>typeof v==='string'?v.normalize('NFKC').trim().slice(0,n):'';
const pairs=[['戰','战'],['爭','争'],['內','内'],['發','发'],['動','动'],['結','结'],['束','束'],['國','国'],['臺','台'],['灣','湾'],['韓','韩'],['門','门'],['總','总'],['統','统'],['領','领'],['導','导'],['當','当'],['選','选'],['舉','举'],['獲','获'],['勝','胜'],['幫','帮'],['擊','击'],['敗','败'],['開','开'],['實','实'],['現','现'],['簽','签'],['訂','订'],['協','协'],['議','议'],['達','达'],['經','经'],['擔','担'],['為','为'],['長','长'],['權','权'],['過','过'],['應','应'],['該','该'],['來','来'],['讓','让'],['佈','布'],['復','复'],['興','兴'],['設','设'],['點','点'],['還','还'],['沒','没'],['無','无'],['聽','听'],['說','说'],['據','据'],['報','报'],['聞','闻'],['備','备'],['劃','划'],['試','试'],['圖','图'],['從','从'],['將','将'],['斷','断']];
const traditionalMap=new Map([...pairs,['準','准'],['願','愿']]),simplify=value=>value.replace(/[\u3400-\u9fff]/g,c=>traditionalMap.get(c)||c);
export function isForeignAction(action={}){
  const value=clean(typeof action==='string'?action:action.label);
  return /[\u3040-\u30ff\uac00-\ud7af]|\b(?:I|we)\b|[戰臺灣韓門總統領導當選舉獲勝幫擊敗開實簽訂協議經擔為長權過應該來讓佈復興設點還沒無聽說據報聞備劃試圖從將斷]/i.test(value);
}

const NEGATIVE=/\b(?:if|unless|would|could|might|maybe|perhaps|suppose|imagine|wish|hope|plan|planning|intend|intending|try|tried|trying|will|shall|not|never|didn't|haven't|hadn't|can't|cannot|couldn't|won't|isn't|wasn't|without|failed|failure|pretend|pretended|heard|rumou?r|reported|news|video|movie|dream|read|reading|learned|watch|watched|quoted|considered)\b|假如|如果|假设|要是|倘若|可能|也许|听说|据说|传闻|新闻|报道|设想|想象|梦见|梦想|希望|计划|准备|打算|试图|尝试|将要|即将|没有|并未|尚未|还未|从未|未曾|未能|没能|无法|不能|不会|不想|不愿|拒绝|放弃|取消|失败|未果|是否|能否|不(?:再)?(?:发动|结束|开战|停战|结盟|成为|担任)|もし|ならば|仮に|仮定|つもり|予定|計画|したい|願う|希望|だろう|かもしれ|ニュース|報道|噂|聞いた|夢|想像|していない|しなかった|しない|しません|できない|できなかった|してない|ではない|じゃない|なれなかった|ならなかった|なっていない|失敗|할 수 없|하지 않|하지 못|하지 않았|하지 못했|되지 않|되지 못|되지 않았|못했|만약|라면|다면|계획|예정|하려고|하고 싶|꿈|상상|소문|뉴스|보도|들었다|실패/i;
const DISTRACTION=/\b(?:chess|football|soccer|sports?|video game|computer game|board game|simulation|novel|film|movie|rehearsal|training exercise|discussion|debate|argument|lecture)\b|下棋|棋赛|球赛|比赛|游戏|小说|电影|演习|训练|チェス|ゲーム|映画|小説|訓練|演習|체스|게임|영화|소설|훈련|연습/i;
const COUNTRY_PATTERNS=[['taiwan',/台(?:湾|海)|\bTaiwan(?:ese)?\b|台湾|타이완|대만/i],['japan',/日本|\bJapan(?:ese)?\b|일본/i],['china',/中国|大陆|\bChina\b|\bChinese\b|중국/i],['hongkong',/香港|\bHong\s*Kong\b|홍콩/i],['macau',/澳门|\bMaca[ou]\b|마카오/i],['korea',/韩国|朝鲜半岛|\b(?:South )?Korea(?:n)?\b|韓国|한국|대한민국/i]];
function actionRegion(clause,state){
  if(/世界|全球|所有国家|所有战争|全部战争|大亚洲战争|\b(?:world|global|worldwide|all wars|all countries|Great Asian War)\b|全世界|すべての戦争|세계|모든 전쟁/i.test(clause))return 'global';
  const matches=COUNTRY_PATTERNS.filter(([,re])=>re.test(clause)).map(([key])=>key);
  if(matches.length===1)return matches[0];
  if(matches.length>1)return null;
  const region=regionForPlace(state.location||state.profile?.place||'');return ['china','taiwan','japan','hongkong','macau','korea'].includes(region)?region:null;
}
function actorIdentity(value){
  const name=clean(value,80).replace(/^(?:the\s+|a\s+)/i,'').trim(),persona=findPersona(name);
  if(!name||name.length>60||/[。！？；<>\n]/.test(name))return null;
  return {name:persona?.name||name,aliases:[name,persona?.name,...(persona?.aliases||[])].filter(Boolean)};
}
function clauses(action){
  if(!action?.custom||action.passive)return [];
  const raw=clean(action.label),value=/[\u3040-\u30ff\uac00-\ud7af]/.test(raw)?raw:simplify(raw);
  return value.split(/[。！？!?；;\n]|\.(?:\s|$)/).map(s=>s.trim()).filter(s=>s&&!NEGATIVE.test(s)&&!DISTRACTION.test(s)&&!/たい(?:です)?(?:$|[、，,])/.test(s)).slice(0,20);
}
const enSelf=/\b(?:I|we)\s+(?:(?:have|had|already|personally|successfully|just|now)\s+)*/i;
const jaSelf=/(?:私|わたし|僕|ぼく|俺|自分|我々)(?:は|が|たちは|たちが)?/;
const koSelf=/(?:나는|내가|저는|제가|우리는|우리가)/;
function hasSelf(clause){return /(?:我|本人|自己)/.test(clause)||enSelf.test(clause)||jaSelf.test(clause)||koSelf.test(clause);}
function conflictName(clause,region){
  if(/台海|Taiwan Strait|台湾海峡|대만해협/i.test(clause))return '台海战争';
  if(/大亚洲|Great Asian|大アジア|대아시아/i.test(clause))return '大亚洲战争';
  if(region==='global')return /all wars|所有战争|全部战争|すべての戦争|모든 전쟁/i.test(clause)?'all':'世界战争';
  const labels={china:'中国',taiwan:'台湾',japan:'日本',hongkong:'香港',macau:'澳门',korea:'韩国'},civil=/内战|内戦|civil war|내전/i.test(clause);
  return `${labels[region]}${civil?'内战':'战争'}`;
}
function kindsFor(clause){
  // The English action verb must belong directly to I/we. A clause such as
  // "I met a leader who declared war" does not authorize a war by the player.
  const english=enSelf.exec(clause);
  if(english){
    const predicate=clause.slice(english.index+english[0].length);
    if(!/^(?:start(?:ed)?|launch(?:ed)?|declar(?:e|ed)|initiat(?:e|ed)|trigger(?:ed)?|caus(?:e|ed)|end(?:ed)?|stop(?:ped)?|halt(?:ed)?|prevent(?:ed)?|terminat(?:e|ed)|achiev(?:e|ed)|negotiat(?:e|ed)|sign(?:ed)?|secur(?:e|ed)|broker(?:ed)?|won|win|help(?:ed)?|defeat(?:ed)?|became|become|took office as|assumed (?:office|the role) as|was elected|invent(?:ed)?|discover(?:ed)?|publish(?:ed)?|announc(?:e|ed)|unveil(?:ed)?|built)\b/i.test(predicate))return [];
  }
  const war=/\b(?:start(?:ed)?|launch(?:ed)?|declar(?:e|ed)|initiat(?:e|ed)|trigger(?:ed)?|caus(?:e|ed))\b.{0,90}\b(?:civil )?war\b|(?:发动|引发|挑起|打响|开始).{0,28}(?:战争|内战)|(?:戦争|内戦).{0,24}(?:始めた|開始した|起こした|宣言した|勃発させた)|(?:전쟁|내전).{0,24}(?:시작했다|시작했|선포했다|선포했|일으켰다|일으켰)/i.test(clause);
  const peace=/\b(?:end(?:ed)?|stop(?:ped)?|halt(?:ed)?|prevent(?:ed)?|terminat(?:e|ed))\b.{0,90}\b(?:civil )?wars?\b|\b(?:achiev(?:e|ed)|negotiat(?:e|ed)|sign(?:ed)?|secur(?:e|ed)|broker(?:ed)?)\b.{0,90}\b(?:peace|ceasefire|armistice)\b|(?:结束|终结|平息|叫停|阻止).{0,28}(?:战争|内战)|(?:实现|达成|签署|促成).{0,20}(?:停火|停战|和平)|(?:戦争|内戦).{0,24}(?:終わらせた|終結させた|終結した|止めた)|(?:停戦|和平).{0,24}(?:実現した|成立させた|署名した)|(?:전쟁|내전).{0,24}(?:끝냈다|끝냈|종식시켰|종식했다|중단시켰)|(?:평화|휴전).{0,24}(?:달성했다|달성했|성사시켰|체결했다|체결했)/i.test(clause);
  const victory=/\b(?:won|win|help(?:ed)?|defeat(?:ed)?)\b.{0,90}\b(?:war|civil war|military victory|government|regime)\b|(?:战争|内战).{0,20}(?:获胜|胜利|取胜)|(?:帮助|带领|率领).{0,35}(?:击败|获胜|取胜|胜利)|(?:戦争|内戦).{0,30}(?:勝利した|勝たせた)|(?:전쟁|내전).{0,30}(?:승리했다|승리했|승리하게 했다)/i.test(clause);
  const leadership=/\b(?:became|become|took office as|assumed (?:office|the role) as|was elected)\b.{0,70}\b(?:president|prime minister|head of state|national leader|chairman)\b|(?:成为|当上|担任|就任|接任).{0,25}(?:总统|国家主席|首相|总理|最高领导人)|(?:大統領|首相|総理|国家主席).{0,20}(?:になった|に就任した|に選ばれた)|(?:대통령|총리|국가주석).{0,20}(?:되었다|됐다|되었|취임했다|취임했|선출되었다)/i.test(clause);
  const pub=/\b(?:invent(?:ed)?|discover(?:ed)?|publish(?:ed)?|announc(?:e|ed)|unveil(?:ed)?|built)\b.{0,100}\b(?:publicly|nationwide|worldwide|new technology|new invention|new discovery|reactor|spacecraft|vaccine|research)\b|(?:公开|全国|世界).{0,20}(?:宣布|发表|发布|发明|发现|建成)|(?:発明|発見|研究成果).{0,20}(?:公開した|発表した)|(?:발명|발견|연구 결과).{0,20}(?:공개했다|공개했|발표했다|발표했)/i.test(clause);
  return [...(peace?['peace']:[]),...(war&&!peace?['war']:[]),...(victory&&!peace?['victory']:[]),...(leadership?['leadership']:[]),...(pub?['public']:[])];
}

/** Explicit completed claims, each tied to its stated region and kind. */
export function worldActionClaims(action={},state={}){
  if(!isForeignAction(action))return [];
  const result=[];
  for(const clause of clauses(action)){
    if(!hasSelf(clause))continue;
    const region=actionRegion(clause,state);if(!region)continue;
    for(const kind of kindsFor(clause)){
      const claim={region,kind,evidence:clause};
      if(['war','peace','victory'].includes(kind))claim.conflict=conflictName(clause,region);
      if(kind==='leadership'){
        // A foreign clause about helping another politician cannot give the player's name that office.
        if(/\b(?:help|helped|made|assisted|supported)\b|帮助|让|协助|助け|支援|도왔|도와|지원/.test(clause))continue;
        claim.leader=clean(state.profile?.name,80);
      }
      if(kind==='victory'){
        const match=clause.match(/\b(?:helped|help|assisted)\s+(.{2,60}?)\s+(?:to )?(?:win|defeat|achieve victory)/i)||clause.match(/(?:帮助|协助|带领)([^，。]{2,20}?)(?:在|击败|取得|获得|获胜|取胜)/);
        if(match){const actor=actorIdentity(match[1]);if(actor){claim.leader=actor.name;claim.leaderAliases=actor.aliases;}}
      }
      result.push(claim);
    }
  }
  return result.slice(0,12);
}

/** Filters kinds AND regions and removes unrelated mutable world-state fields. */
export function filterWorldUpdatesForAction(action={},state={},updates=[]){
  const claims=worldActionClaims(action,state),out=[];
  if(!Array.isArray(updates))return out;
  for(const raw of updates.slice(0,4)){
    if(!raw||typeof raw!=='object'||typeof raw.title!=='string'||typeof raw.description!=='string')continue;
    const candidates=claims.filter(c=>c.region===raw.region&&c.kind===raw.kind);if(!candidates.length)continue;
    const claim=candidates.find(c=>!['leadership','victory'].includes(c.kind)||!raw.leader||c.leader===raw.leader||c.leaderAliases?.some(n=>n.toLowerCase()===String(raw.leader).toLowerCase()));
    if(!claim)continue;
    const update={region:claim.region,kind:claim.kind,title:clean(raw.title,100),description:clean(raw.description,900)};
    if(claim.kind==='war')update.conflict=claim.conflict;
    if(claim.kind==='peace'||claim.kind==='victory'){update.conflict=null;update.terminatedConflict=claim.conflict;}
    if(claim.leader){update.leader=claim.leader;update.government=`${claim.leader}主持的政府`;}
    // public only publishes a report; it has no authority to change leadership,
    // government, ideology, conflict or unrelated sovereign institutions.
    out.push(update);
  }
  return out;
}
