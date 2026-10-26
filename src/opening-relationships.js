import {findPersona} from './personas.js';
import {getGeographyUnit} from './geography.js';
import {resolveCountry} from './countries.js';
import {mergeOpeningRelationshipGraph} from './relationships.js';

const VERSION=1;
const tidy=value=>String(value||'').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,' ').trim();
const hash=value=>{let n=2166136261;for(const c of String(value))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const ROLE_ALIASES={爸爸:'父亲',爸:'父亲',妈妈:'母亲',妈:'母亲',爷爷:'祖父',奶奶:'祖母',外公:'外祖父',外婆:'外祖母',兄长:'哥哥',姐姐:'姐姐',阿姐:'姐姐',丈夫:'丈夫',老公:'丈夫',老婆:'妻子',媳妇:'妻子',嗣父:'嗣父'};
const roles=['外祖父','外祖母','继父','继母','养父','养母','嗣父','父亲','母亲','爸爸','妈妈','祖父','祖母','爷爷','奶奶','外公','外婆','哥哥','姐姐','弟弟','妹妹','兄长','兄弟姐妹','兄弟','姐妹','丈夫','妻子','老公','老婆','伴侣','儿子','女儿','舅舅','姨妈','叔叔','姑姑','表哥','表姐','表弟','表妹','堂哥','堂姐','堂弟','堂妹'];
const rolePattern=roles.join('|');
const bothParentsGone=/(?:父母|双亲)(?:均已|都已|均|都|已经|早已|早年|先后)?(?:双亡|早亡|已故|去世|过世|身亡|死亡|亡故|不在了)|自幼丧失双亲/;
const noParents=/孤儿|无父无母|没有父母|无亲无故|无亲无友|父母不详|不知道.{0,8}父母|独自被制造/;
const noPeople=/无亲无故|无亲无友|没有任何亲友|没有亲人(?:也没有|和|或)朋友|没有认识的人|孤身一人且没有亲友/;
const deceased=/(?:已|早|早年|已经|早已|先后|于\d{4}年)?(?:去世|过世|逝世|亡故|身亡|死亡|病故|病逝|已故|牺牲|不在人世|早逝|死了)|双亡/;
const living=/健在|仍在世|还在世|仍然在世|已经复活|已复活|救活|恢复生命/;
const unknownFamily=/不推定|不详|未详明|尚未详|未知|不清楚|缺少|不足以|没有足够|未收录|未确认/;
const blockedName=/^(?:为|是|在|来自|出身|出生|成长|经营|从事|担任|工作|生活|职业|家庭|一名|一位|一个|两名|两位|两人|均|都|也|已|早|曾|仍|还|并|因|很|总是|一直|长期|独自|共同|以及|和|与|同|没有|未|情况|收入|姓|叫|名|名叫|健在|相依|去世|身亡|早逝|失踪|失联|单亲|教师|老师|工人|农民|警员|军人|公务员|商人|医生|护士|职员|工程师|研究员|教授|干部|矿工|公司|当地|普通|乡村|农村|大学|小学|中学|中国|韩国|日本|台北|台湾|香港|澳门)/;
const splitClauses=value=>tidy(value).split(/[，,。；;！!？?\n]/).map(x=>x.trim()).filter(Boolean);
const canonicalRole=role=>ROLE_ALIASES[role]||role;
const isParent=role=>['父亲','母亲'].includes(role);

function openingCountry(state){
  const p=state.profile||{},unit=getGeographyUnit(p.birthplace?.unitId||state.position?.unitId);
  if(unit?.country)return unit.country;
  const place=tidy(p.startLocation||p.place||state.location);
  if(/日本|东京|東京|大阪|京都|横滨/.test(place))return 'JPN';
  if(/韩国|韓國|首尔|釜山/.test(place))return 'KOR';
  if(/台湾|台灣|臺灣|台北|高雄|新竹/.test(place))return 'TWN';
  if(/香港/.test(place))return 'HKG';if(/澳门|澳門/.test(place))return 'MAC';
  return resolveCountry(place)?.iso||(/^[\p{Script=Han}]+$/u.test(place)?'CHN':'');
}
const cultures={
  chinese:{surnames:['林','陈','刘','黄','张','许','吴','周'],male:['志安','明远','建平','文启','绍宁','家良','承瑞','俊衡'],female:['雅宁','秀文','静宜','慧玲','若兰','佳宁','淑敏','玉晴']},
  japanese:{surnames:['高桥','小林','佐藤','山本','中村','森川','田村','藤井'],male:['健太','直树','弘志','悠介','修平','和也','翔太','一树'],female:['美咲','由纪','千寻','真理','绘里','晴香','里奈','优子']},
  korean:{surnames:['김','이','박','최','정','한','윤','강'],male:['민수','준호','성민','현우','태진','지훈','동현','수빈'],female:['지은','수연','민지','서연','혜진','유진','하나','은정']},
  english:{surnames:['Morgan','Bennett','Turner','Ellis','Walker','Reed','Hayes','Clarke'],male:['Daniel','Samuel','Oliver','James','Arthur','Thomas'],female:['Emma','Alice','Sarah','Grace','Clara','Julia']},
  french:{surnames:['Moreau','Lambert','Laurent','Lefèvre','Roux','Garnier'],male:['Julien','Antoine','Luc','Thomas','Marc','Pierre'],female:['Camille','Claire','Élise','Marie','Sophie','Jeanne']},
  german:{surnames:['Weber','Fischer','Bauer','Keller','Hoffmann','Wagner'],male:['Lukas','Jonas','Paul','Felix','Martin','Stefan'],female:['Anna','Lena','Clara','Laura','Sophie','Emilia']},
  spanish:{surnames:['García','López','Martín','Torres','Romero','Vargas'],male:['Diego','Javier','Carlos','Miguel','Pablo','Daniel'],female:['Lucía','Elena','Carmen','Ana','Isabel','Sofía']},
  portuguese:{surnames:['Silva','Santos','Pereira','Costa','Almeida','Ferreira'],male:['João','Pedro','Lucas','Rafael','André','Tiago'],female:['Mariana','Beatriz','Ana','Clara','Helena','Inês']},
  slavic:{surnames:['Иванов','Петров','Соколов','Волков','Орлов','Белов'],male:['Алексей','Михаил','Павел','Иван','Андрей','Юрий'],female:['Анна','Елена','Мария','Ирина','Ольга','Наталья']},
  arabic:{surnames:['حسن','عمر','عباس','سالم','منصور','علي'],male:['أحمد','يوسف','خالد','محمود','إبراهيم','كريم'],female:['ليلى','مريم','فاطمة','نور','سلمى','أمل']},
  persian:{surnames:['احمدی','محمدی','رحیمی','حسینی','کریمی','رضایی'],male:['احمد','فرید','حمید','رحمت','یوسف','جاوید'],female:['مریم','لیلا','فاطمه','زهرا','نرگس','فرشته']},
  indian:{surnames:['Sharma','Patel','Rao','Mehta','Singh','Nair'],male:['Arjun','Ravi','Vikram','Amit','Dev','Kiran'],female:['Ananya','Priya','Meera','Asha','Kavya','Nisha']},
  turkish:{surnames:['Yılmaz','Demir','Kaya','Çelik','Arslan','Aydın'],male:['Emre','Deniz','Murat','Ali','Can','Kerem'],female:['Elif','Zeynep','Aylin','Selin','Derya','Ece']},
};
function cultureFor(country){
  if(['CHN','TWN','HKG','MAC'].includes(country))return 'chinese';if(country==='JPN')return 'japanese';if(['KOR','PRK'].includes(country))return 'korean';
  if(['FRA','BEL','LUX','MCO'].includes(country))return 'french';if(['DEU','AUT','CHE','LIE'].includes(country))return 'german';
  if(['ESP','MEX','ARG','CHL','COL','PER','VEN','ECU','BOL','URY','PRY','CUB','DOM','CRI','GTM','HND','NIC','PAN','SLV'].includes(country))return 'spanish';
  if(['PRT','BRA','AGO','MOZ','CPV'].includes(country))return 'portuguese';if(['RUS','BLR','UKR'].includes(country))return 'slavic';
  if(['AFG','IRN'].includes(country))return 'persian';
  if(['SYR','YEM','IRQ','SAU','JOR','LBN','EGY','DZA','MAR','TUN','LBY','SDN','OMN','ARE','QAT','KWT','BHR','PSE'].includes(country))return 'arabic';
  if(['IND','NPL','LKA'].includes(country))return 'indian';if(country==='TUR')return 'turkish';return 'english';
}
function generatedName(state,role,index,used){
  const country=openingCountry(state),culture=cultureFor(country),bank=cultures[culture],player=tidy(state.profile?.name),female=/母|奶|婆|姐|妹|妻|姨|姑|女/.test(role);
  const pick=(items,key)=>items[hash(`${state.seed}|opening-family|${role}|${index}|${key}`)%items.length];
  let surname=pick(bank.surnames,'surname');
  if(culture==='chinese'&&/^[\p{Script=Han}]{2,4}$/u.test(player)&&!/母|妻|姨|外/.test(role))surname=player[0];
  if(culture==='korean'&&/^[가-힣]{2,4}$/.test(player)&&!/母|妻|姨|外/.test(role))surname=player[0];
  if(culture==='japanese'&&/^[\p{Script=Han}]{4,6}$/u.test(player)&&!/母|妻|姨|外/.test(role))surname=player.slice(0,2);
  for(let offset=0;offset<64;offset++){
    const first=pick(female?bank.female:bank.male,`given:${offset}`),last=offset>15?pick(bank.surnames,`surname:${offset}`):surname;
    const name=['chinese','japanese','korean'].includes(culture)?last+first:`${first} ${culture==='slavic'&&female?last+'а':last}`;
    if(name!==player&&!used.has(name)&&!findPersona(name)){used.add(name);return name;}
  }
  return null;
}
function candidateName(raw){
  let value=tidy(raw).replace(/^(?:的姓名|的名字|姓名|名字)?\s*(?:名叫|名为|叫做|叫作|叫|为|是)?\s*[“「『"']?/,'');
  value=value.replace(/^(?:(?:中国|韩国|日本|台湾|香港|澳门|当地)(?:前|现任)?)?(?:前总统|总统|首相|前首相|将军|前将军)\s*/,'');
  value=value.split(/(?:的|为|是|在|曾|已|早逝|也|与|和|及|经营|从事|担任|工作|生活|来自|出身|出生|成长|抚养|照顾|一起|相依|健在|去世|过世|身亡|死亡|失联|离世|[、”」』"'])/)[0].trim();
  if(blockedName.test(value)||value.length<2||value.length>40||! /^[\p{L}\p{M}·・.'’\-\s]+$/u.test(value))return '';
  if(/^[\p{Script=Han}]+$/u.test(value)&&value.length>6)return '';
  return value;
}
function statusIn(text,role){
  if(living.test(text))return 'living';
  if(deceased.test(text)||isParent(role)&&bothParentsGone.test(text))return 'deceased';
  if(/失联|失散|失踪|下落不明/.test(text))return 'missing';return 'unknown';
}
function extractedFamily(value){
  const rows=[];
  for(const clause of splitClauses(value)){
    if(unknownFamily.test(clause)||/假如|如果|希望|想象|打算|传闻|据说/.test(clause))continue;
    const pattern=new RegExp(`(${rolePattern})([^，。；;]*?)(?=(?:${rolePattern})|$)`,'gu');let match;
    while((match=pattern.exec(clause))){
      const before=clause.slice(0,match.index),role=canonicalRole(match[1]);
      if(/(?:没有|没|无|不是|并非|不认识|不知道)(?:任何|亲生)?(?:一|两|三|四)?(?:个|位|名)?$/.test(before))continue;
      const tail=match[2],name=candidateName(tail);
      if(!name&&/^的(?:姓名|名字|职业|工作|情况)/.test(tail))continue;
      rows.push({name,role,evidence:clause,lifeStatus:statusIn(tail,role)});
    }
    const parents=clause.match(/^([\p{Script=Han}]{2,5})与([\p{Script=Han}]{2,5})之[子女]$/u);
    if(parents)rows.push({name:parents[1],role:'父亲',evidence:clause,lifeStatus:'unknown'},{name:parents[2],role:'母亲',evidence:clause,lifeStatus:'unknown'});
    const reverse=clause.match(/^([\p{Script=Han}]{2,5})是其(嗣父|养父|养母|父亲|母亲)$/u);
    if(reverse)rows.push({name:reverse[1],role:reverse[2],evidence:clause,lifeStatus:'unknown'});
    const marriage=clause.match(/与([\p{Script=Han}]{2,5})结婚/u);
    if(marriage)rows.push({name:marriage[1],role:'伴侣',evidence:clause,lifeStatus:'unknown'});
  }
  return rows;
}
function recentStatus(state,row){
  let status=row.lifeStatus;
  const texts=[...(state.person?.relationships||[]),...(state.person?.facts||[]),...(state.history||[]).flatMap(h=>[h.actionResult?.success===true?h.action?.label:'',h.consequence]),...(state.relationshipGraph?.nodes||[]).filter(n=>n.name===row.name).map(n=>n.detail)];
  for(const value of texts)for(const clause of splitClauses(value)){
    if(!clause.includes(row.name)&&!clause.includes(row.role)&&!(isParent(row.role)&&bothParentsGone.test(clause)))continue;
    if(/假如|如果|希望|计划|打算|并未|没有去世|没有死亡|尚未/.test(clause))continue;
    const next=statusIn(clause,row.role);if(next!=='unknown')status=next;
  }
  const saved=state.relationshipGraph?.nodes?.find(node=>node.name===row.name);
  return ['living','deceased','missing'].includes(saved?.lifeStatus)?saved.lifeStatus:status;
}
function contactDetail(row,{generated=false,legacy=false,background='ordinary'}={}){
  const relation=row.role==='熟人'?'与你相识已久':`你的${row.role}`;
  if(row.lifeStatus==='deceased')return `${relation}，已经去世。${row.evidence||''}`.slice(0,240);
  if(row.lifeStatus==='missing')return `${relation}，目前失联。${row.evidence||''}`.slice(0,240);
  if(!generated)return `${relation}。${row.evidence?row.evidence+'。':''}${row.lifeStatus==='unknown'?'近况未确认。':''}`.slice(0,240);
  const daily={worker:'依靠当地工作的工资安排生活',rural:'参与家里的农业劳作',research:'在教育或研究机构工作',cadre:'在当地公共服务机构工作',business:'参与家中的日常经营'}[background]||'在当地安排工作和家庭生活';
  if(row.role==='熟人')return '与你相识已久，平时会互相问候，交流生活中的近况。';
  return `${relation}，${isParent(row.role)?daily:'与你保持日常联系'}。`;
}

/** One-time, seeded fictional opening. Legacy imports restore evidence only;
 * they never create new living relatives for a life that has already unfolded. */
export function initializeOpeningRelationships(state,{legacy=false}={}){
  state.person??={relationships:[]};state.person.relationships??=[];
  if(state.person.openingRelationshipsVersion===VERSION)return state;
  const persona=state.profile?.persona||findPersona(state.profile?.lockedPersonaId),real=!!persona;
  const background=tidy(state.profile?.backgroundText),archive=real?tidy(persona.familyBackground):'';
  const explicit=extractedFamily(real?archive:background),used=new Set([state.profile?.name,...(state.relationshipGraph?.nodes||[]).map(n=>n.name)]),contacts=[];
  const add=(entry,source)=>{
    if(!entry.name&&!real&&legacy)return;
    const generated=!entry.name&&!real;
    const name=entry.name||(real?entry.role:generatedName(state,entry.role,contacts.length,used));if(!name||name===state.profile?.name)return;
    const duplicate=contacts.find(r=>r.name===name||r.role===entry.role&&(!entry.name||r.unnamed));if(duplicate){if(entry.name&&duplicate.unnamed)contacts.splice(contacts.indexOf(duplicate),1);else return;}
    const row={name,role:entry.role,lifeStatus:entry.lifeStatus||'unknown',source,evidence:entry.evidence||'',generated,unnamed:!entry.name,referenceRequired:real,sourceRefs:real?(persona.sourceUrls||[]).slice(0,8):[]};
    if(!real&&!legacy&&row.lifeStatus==='unknown')row.lifeStatus='living';
    if(isParent(row.role)&&bothParentsGone.test(background))row.lifeStatus='deceased';
    row.lifeStatus=recentStatus(state,row);row.detail=contactDetail(row,{generated,legacy,background:state.profile?.background});
    contacts.push(row);used.add(name);
  };
  for(const entry of explicit)add(entry,real?'persona-family':'explicit-background');
  const disconnected=noPeople.test(background)||/孤儿|无父无母/.test(background),parentsExcluded=noParents.test(background)||bothParentsGone.test(background);
  if(!legacy&&!real&&!disconnected){
    const age=Number(state.profile?.age)||0;
    if(!parentsExcluded&&age<60&&/单亲/.test(background)&&!contacts.some(row=>isParent(row.role)))add({role:'家长',lifeStatus:'living',evidence:'你由一位家长抚养长大。'},'generated-background');
    if(!parentsExcluded&&age<60&&!contacts.some(row=>row.role==='家长')){
      for(const role of ['父亲','母亲'])if(!contacts.some(row=>row.role===role)){
        const forbidden=role==='父亲'?/丧父|父亲早逝|父亲去世|父亲不详|不知道.{0,6}父亲|单亲.{0,12}母亲|由母亲独自|母亲独自抚养/:/丧母|母亲早逝|母亲去世|母亲不详|不知道.{0,6}母亲|单亲.{0,12}父亲|由父亲独自|父亲独自抚养/;
        if(!forbidden.test(background))add({role,lifeStatus:'living',evidence:'你自幼便认识的家人。'},'generated-background');
      }
    }
    if(!contacts.length||age>=60&&!contacts.some(row=>['哥哥','姐姐','弟弟','妹妹','儿子','女儿','伴侣','丈夫','妻子'].includes(row.role))){
      // Loss of one's parents says nothing about other existing acquaintances.
      add({role:'熟人',lifeStatus:'living',evidence:'你们在当地相识已久。'},'generated-background');
    }
  }
  const links=[],father=contacts.find(r=>r.role==='父亲'),mother=contacts.find(r=>r.role==='母亲');
  // Being the two parents supports a shared family tie, not marriage, cohabitation or affection.
  if(father&&mother)links.push({source:father.name,target:mother.name,status:'共同家人',kind:'family',strength:65,detail:`${father.name}与${mother.name}分别是${state.profile?.name||'你'}的父亲和母亲。`,origin:'opening-family'});
  state.person.openingRelationships=contacts;
  state.person.openingRelationshipsVersion=VERSION;
  state.person.openingRelationshipsMode=legacy?'evidence-migration':real?'archive':'seeded';
  state.person.relationships=[...new Set([...state.person.relationships,...contacts.map(row=>`${row.name}：${row.detail}`)])].slice(-80);
  state.relationshipGraph=mergeOpeningRelationshipGraph(state,contacts,links);
  return state;
}

export const OPENING_RELATIONSHIP_VERSION=VERSION;
