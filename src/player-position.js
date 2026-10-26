import {geographyAncestors,getGeographyUnit,resolveTerritoryTargets} from './geography.js';
import {affirmedClauses} from './agency.js';

// Common spoken city names map to an existing boundary, never an invented point.
const CITY_NAMES={巴黎:['Paris','FRA'],伦敦:['Greater London','GBR'],纽约:['New York','USA'],洛杉矶:['Los Angeles','USA'],柏林:['Berlin','DEU'],罗马:['Roma','ITA'],莫斯科:['Moskva','RUS'],悉尼:['Sydney','AUS'],墨尔本:['Melbourne','AUS'],多伦多:['Toronto','CAN'],孟买:['Mumbai','IND'],新德里:['New Delhi','IND'],曼谷:['Bangkok','THA'],雅加达:['Jakarta','IDN'],东京:['Tokyo','JPN'],大阪:['Osaka','JPN'],京都:['Kyoto','JPN'],横滨:['Yokohama','JPN'],首尔:['Seoul','KOR'],釜山:['Busan','KOR']};
Object.assign(CITY_NAMES,{台北:['Taipei','TWN'],臺北:['Taipei','TWN'],新北:['New Taipei','TWN'],台中:['Taichung','TWN'],臺中:['Taichung','TWN'],台南:['Tainan','TWN'],臺南:['Tainan','TWN'],高雄:['Kaohsiung','TWN']});
const MACRO={CHN:'中国大陆',TWN:'中国台湾',JPN:'日本',KOR:'韩国',HKG:'香港',MAC:'澳门'};
const movement=/(?:搬家到|搬到|搬去|搬往|迁居(?:到)?|移居(?:到)?|定居(?:在|到)?|前往|返回|回到|抵达|来到|到达|到了|游到|游向|飞往|乘车到|坐车到|传送到|瞬移到|穿越到|赴|去)(?:了|往)?\s*|\b(?:moved?\s+to|relocated?\s+to|travel(?:led|ed)?\s+to|arrived?\s+(?:in|at)|went\s+to|returned?\s+to)\s+/gi;
const invalidMovement=/(?:不|没|未)(?:再|曾|想|会|能)?$|(?:计划|打算|准备|考虑|想要|希望|想|将要|以后|将来|明天|下个月|下周|下次).{0,16}$|\b(?:not|never|plan(?:ning)?|hope|wish|if|would|will|tomorrow|going\s+to|don't|doesn't|didn't|haven't|hasn't|hadn't|won't|wouldn't|can't|couldn't)\b/i;
const otherTravel=/(?:派遣|派出|命令|要求|邀请|建议|提醒|告诉|通知|安排|请求|劝说|看见|看到|听到|听说|得知|据报道|新闻|转述|梦见|想象|让|叫)|\b(?:saw|watched|heard|told|asked|ordered|invited|sent|reported|read|dreamed|imagined|helped)\b/i;
const facilities=/^(?:菜市场|菜场|超市|商场|便利店|菜店|小卖部|餐厅|餐馆|饭店|食堂|学校|医院|公司|办公室|银行|邮局|公园|车站|机场|码头|朋友家|家里|单位|工厂|图书馆|电影院|健身房|游泳池)(?:里|内|门口)?$/;
const foreignVenue=/^(?:日本|法国|美国|台湾|韩国|中国|俄罗斯)(?:料理|风味|餐厅|餐馆|饭店|菜馆|超市|商店|面包店|小吃|拉面|烤肉)/;
const offworldOrOcean=/太平洋|大西洋|印度洋|北冰洋|南冰洋|海底|海沟|火星|月球|纳美克星|外太空/;

function playerIsMoving(prefix,state){
  const before=prefix.trim();if(!before)return true;
  if(invalidMovement.test(before)||otherTravel.test(before))return false;
  if(/\b(?:i|we)\b/i.test(before))return /^(?:today\s+|this month\s+|finally\s+)?(?:i|we)\b/i.test(before)&&!/^my\b/i.test(before);
  if(/(?:我|我们|本人|自己)/.test(before)){
    if(/(?:我|我们)(?:的)?(?:朋友|同事|父亲|母亲|爸爸|妈妈|哥哥|姐姐|弟弟|妹妹|儿子|女儿|队友|下属|部队|军队)|(?:而|但|不过|至于)(?!我|本人|自己)/.test(before))return false;
    return true;
  }
  const name=state.profile?.name;
  if(name&&before.startsWith(name)&&!before.slice(name.length).startsWith('的'))return true;
  if(/^(?:变成人|化形|复活|恢复人形)(?:后|之后)$/.test(before))return true;
  return /^(?:(?:今天|本月|这月|现在|目前|随后|终于|直接|已经|已|独自|亲自|又|再|先|从[^，。]{1,30})\s*)+$/.test(before);
}

function locate(text){
  if(offworldOrOcean.test(String(text)))return null;
  const direct=resolveTerritoryTargets(text);
  // A recognized local unit is more specific than the convenience city aliases.
  if(direct.length===1&&direct[0].role!=='country')return direct[0];
  const countries=[...new Set(direct.map(unit=>unit.country))];
  let matches;
  for(const [name,[query,country]] of Object.entries(CITY_NAMES))if(String(text).includes(name)){
    const explicit=countries.length===1?countries[0]:country;
    matches=resolveTerritoryTargets(query,{country:explicit});if(matches.length===1)return matches[0];
  }
  if(direct.length===1)return direct[0];
  return null;
}
function positionFor(unit,label,location,month,source){
  return {unitId:unit?.id||null,label:String(label||location||'所在地待确认').slice(0,160),coordinates:unit?[...unit.center]:null,precision:unit?.role||(/海洋|太平洋|大西洋|印度洋|海底|海沟/.test(location)?'ocean':'unknown'),month:Number.isInteger(month)?month:0,source,locationSnapshot:location};
}
function readableUnit(unit){return geographyAncestors(unit).slice().reverse().map(row=>row.name).filter((n,i,list)=>list.indexOf(n)===i).join(' · ');}
function macroLocation(unit,raw){
  if(unit.country==='CHN')return geographyAncestors(unit).find(u=>u.role==='province')?.name||'中国大陆';
  return MACRO[unit.country]||getGeographyUnit('country:'+unit.country)?.name||raw;
}

/** Return a location proposal only; no model, map click or preview moves a person. */
export function movementFromAction(state,action){
  if(action?.passive||!action?.label)return null;
  let proposal=null;
  for(const clause of affirmedClauses(action.label)){
    for(const match of clause.matchAll(movement)){
      if(!playerIsMoving(clause.slice(0,match.index),state))continue;
      const tail=clause.slice(match.index+match[0].length).split(/(?:然后|随后|之后|接着|并且|并|工作|打工|上班|参军|生活|居住|定居|旅游|旅行|见到|会见|参加|买|购买|学习|求职|工作了|\b(?:to work|for work|and then|then|with|where|after|before)\b|[。；;!！])/)[0].trim().replace(/^\d{3,4}年(?:\d{1,2}月)?的?/,'').replace(/(?:了|去|那里|这座城市|这个地方)$/,'').trim();
      if(!tail||tail.length>100||/^(?:年|月|\d{3,4}年|过去|未来|时空|上班|学校|医院|食堂|公司|办公室|家里|朋友家|见|吃|喝|睡|读|做|找|看)/.test(tail))continue;
      if(/^(?:不了|不成|不动)/.test(tail)||facilities.test(tail)||foreignVenue.test(tail))continue;
      // A destination names a place, not a subordinate action such as 去帮助….
      if(/^(?:帮助|协助|支持|占领|发动|结束|调查|联系|完成|进行)/.test(tail))continue;
      let unit=locate(tail);
      if(!unit&&!offworldOrOcean.test(tail)){const current=getPlayerPosition(state);const home=getGeographyUnit(current.unitId);if(home){const candidates=resolveTerritoryTargets(tail,{country:home.country});if(candidates.length===1)unit=candidates[0];}}
      // A bare “去” also introduces ordinary activities. Only a known place,
      // explicit geographic name or stronger relocation verb can change location.
      if(!unit&&!offworldOrOcean.test(tail)&&/^(?:去(?:了|往)?|赴|went\s+to)\s*$/i.test(match[0])&&!/(?:国|省|市|县|区|州|镇|乡|村|岛|星|大陆|星系|海域)$/.test(tail))continue;
      const location=unit?macroLocation(unit,tail):tail;
      proposal={location,position:positionFor(unit,unit?readableUnit(unit):tail,location,state.month,'action')};
    }
  }
  return proposal;
}

export function getPlayerPosition(state){
  const saved=state?.position;
  if(saved&&saved.locationSnapshot===state.location){
    const unit=getGeographyUnit(saved.unitId);
    if(unit){
      const scope=locate(state.location);
      if(scope&&geographyAncestors(unit).some(parent=>parent.id===scope.id))return positionFor(unit,saved.label||readableUnit(unit),state.location,saved.month,saved.source||'save');
    }
    if(saved.unitId===null&&['unknown','ocean'].includes(saved.precision))return positionFor(null,saved.label,state.location,saved.month,saved.source||'save');
  }
  const unit=locate(state?.location||'');
  return positionFor(unit,unit?readableUnit(unit):state?.location,state?.location||'',state?.month,'location');
}

export function updatePlayerPosition(state,proposal){
  if(proposal&&proposal.location===state.location)state.position={...proposal.position,month:state.month,locationSnapshot:state.location};
  else state.position={...getPlayerPosition(state),month:state.month};
  return state.position;
}
export function validatePlayerPosition(state){
  const p=state.position;
  if(p!==undefined&&(!p||typeof p!=='object'||Array.isArray(p)||typeof p.label!=='string'||p.label.length>160||p.unitId!==null&&typeof p.unitId!=='string'||!Number.isInteger(p.month)||p.month>state.month||p.coordinates!==null&&(!Array.isArray(p.coordinates)||p.coordinates.length!==2||!p.coordinates.every(Number.isFinite)||Math.abs(p.coordinates[0])>180||Math.abs(p.coordinates[1])>90)))throw new Error('这份档案的所在地记录不完整。');
  // Old saves and renamed atlas entries fall back to their recorded location.
  state.position=getPlayerPosition(state);
}
