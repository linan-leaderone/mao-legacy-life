import data from './data/regions.json' with {type:'json'};
import memeData from './data/memes.json' with {type:'json'};

const ALIASES={台灣:'中国台湾',台湾:'中国台湾',台北:'中国台湾',臺北:'中国台湾',台中:'中国台湾',高雄:'中国台湾',新竹:'中国台湾',台南:'中国台湾',花莲:'中国台湾',东京:'日本',東京:'日本',大阪:'日本',京都:'日本',横滨:'日本',北海道:'日本',冲绳:'日本',首尔:'韩国',首爾:'韩国',釜山:'韩国',香港特别行政区:'香港',香港特別行政區:'香港',澳门特别行政区:'澳门',澳門:'澳门',大陆:'中国大陆',中國大陸:'中国大陆',中国:'中国大陆',中國:'中国大陆',石家庄:'河北',太原:'山西',呼和浩特:'内蒙古',沈阳:'辽宁',大连:'辽宁',长春:'吉林',哈尔滨:'黑龙江',南京:'江苏',苏州:'江苏',杭州:'浙江',宁波:'浙江',合肥:'安徽',福州:'福建',厦门:'福建',南昌:'江西',济南:'山东',青岛:'山东',郑州:'河南',武汉:'湖北',长沙:'湖南',广州:'广东',深圳:'广东',南宁:'广西',海口:'海南',三亚:'海南',成都:'四川',贵阳:'贵州',昆明:'云南',拉萨:'西藏',西安:'陕西',兰州:'甘肃',西宁:'青海',银川:'宁夏',乌鲁木齐:'新疆'};
const SPECIAL={'中国台湾':'taiwan','日本':'japan','香港':'hongkong','澳门':'macau','韩国':'korea','中国大陆':'china'};
const IDS=['ordinary','worker','rural','research','cadre','business','custom'];
const VALUES=[[8000,40,35],[5000,35,45],[3000,30,40],[15000,65,30],[12000,45,65],[35000,40,55],[8000,40,35]];
function locality(place){
  const raw=String(place||'').trim(),exact=ALIASES[raw]||raw;
  if(/太平洋|海底|海沟/.test(raw))return {region:'ocean',province:null,place:raw};
  if(data.provinces[exact])return {region:'china',province:exact,place:exact};
  if(SPECIAL[exact])return {region:SPECIAL[exact],province:null,place:exact};
  // Prefer explicit special-region words over a city or a province substring.
  for(const name of ['香港','澳门','澳門','中国台湾','台湾','台灣','日本','韩国'])if(raw.includes(name))return {region:SPECIAL[ALIASES[name]||name],province:null,place:ALIASES[name]||name};
  for(const name of Object.keys(data.provinces))if(raw.startsWith(name))return {region:'china',province:name,place:name};
  return {region:'global',province:null,place:raw};
}
export function backgroundsFor(place){
  const local=locality(place),rows=data.backgrounds[local.region]||data.backgrounds.korea;
  return rows.map(([name,detail],i)=>({id:IDS[i],name,detail:i===6?'你在当地生活，与家人和熟悉的人保持联系。':detail.replace(/，(?:不预设[^。]*|不等于属于[^。]*|不套用[^。]*|职业不等于[^。]*|职责、级别与影响由具体经历决定)/g,''),funds:VALUES[i][0],knowledge:VALUES[i][1],connections:VALUES[i][2]}));
}
export const regionForPlace=place=>locality(place).region;

// Only applied when the corresponding report is already in the person's known history.
const CHANGES={
 rs_tw_tsai_resignation:{region:'taiwan',leader:'赖清德',stage:'wartime',government:'蔡英文辞职后由赖清德接任的战时政府'},
 rs_tw_full_mobilization:{region:'taiwan',leader:'赖清德',stage:'emergency',government:'全面动员紧急状态下的总统与行政体系'},
 cn_zhang_coup:{region:'china',leader:'张又侠主持的战后过渡当局',stage:'transition',government:'战后军事问责与过渡安排'},
 cn_chen_emergency:{region:'china',leader:'陈文清',stage:'security_state',government:'紧急会议建立的新领导体制'},
 cn_chen_party:{region:'china',institutions:['中央安全机关','地方政府','安全审查机构','社区管理机构']},
 cn_chen_totalitarian:{region:'china',government:'国安系统主导的极权统治与数字监控'},
 cn_hu_inauguration:{region:'china',leader:'胡春华',stage:'transition',government:'胡春华领导的战后政府'},
 cn_hu_reform:{region:'china',stage:'reform',government:'推进政治改革的胡春华政府'},
 cn_socialdem:{region:'china',government:'社会民主方向的改革政府',institutions:['改革政府','地方议事机构','工会','公共服务部门']},
 cn_zhang_hongliang:{region:'china',leader:'张宏良',stage:'mass_democracy',government:'民粹派主导的政治改革'},
 cn_mass_democracy:{region:'china',institutions:['大众议事组织','地方政府','工会','公共讨论平台']},
 cn_han_rise:{region:'china',leader:'韩德强',stage:'revolutionary',government:'正道派主导的政治秩序'},
 cn_cyber_order:{region:'china',government:'赛博毛泽东参与的政治与生产组织'},
 cn_li_elected:{region:'china',leader:'李克强',stage:'reform',government:'李克强当选后领导的政府'},
 cn_wang_elected:{region:'china',leader:'汪洋',stage:'reform',government:'汪洋当选后领导的政府'},
 cn_bo_elected:{region:'china',leader:'薄熙来',stage:'personal_rule',government:'薄熙来主导的新领导班子'},
 cn_bo_deity:{region:'china',government:'围绕薄熙来的个人崇拜与技术政治体制'},
 cn_whn_coup:{region:'china',leader:'王沪宁',stage:'security_state',government:'保守派政变后建立的高压政府'},
 cn_mao_succession:{region:'china',leader:'毛远新',stage:'resocialization',government:'毛远新领导的再社会主义化政府'},
 cn_collapse_civil:{region:'china',leader:null,stage:'civil_war',government:'中央秩序崩解，各地管治分裂',conflict:'第二次中国内战'},
 cn_longmarch_coup:{region:'china',stage:'civil_war',government:'泛左翼与原政府争夺政治权力',conflict:'泛左翼联合与原政府交战'},
 cn_longmarch_civil:{region:'china',stage:'civil_war',conflict:'泛左翼联合与原政府交战'},
 cn_republic_foundation:{region:'china',leader:'中华共和国过渡政府',stage:'republic_transition',government:'中华共和国成立后的过渡与制宪',conflict:null,institutions:['共和国过渡政府','制宪代表机构','地方委员会','工会']},
 cn_digital_democracy:{region:'china',stage:'digital_democracy',government:'中华共和国的实验性数字民主',institutions:['共和国政府','民选代表机构','地方公共议事平台','工会']},
 cn_peoples_commune:{region:'china',stage:'commune',government:'中华人民公社',leader:'公社代表机构',institutions:['公社代表机构','工人委员会','地方公社','公共服务委员会']},
 cn_qin_elected:{region:'china',leader:'秦晖',stage:'republic',government:'秦晖领导的中华共和国政府'},
 cn_longmarch_second_revolution:{region:'china',stage:'revolutionary_conflict',conflict:'长征发起新的革命'},
 cn_total_civil_war:{region:'china',stage:'civil_war',conflict:'第二次文革引发的全面内战'},
 cn_front_victory:{region:'china',leader:'革命阵线临时领导机构',stage:'reconstruction',conflict:null},
 cn_front_mao_chair:{region:'china',leader:'毛远新',government:'革命阵线胜利后选出的新政府'},
 cn_front_yue_chair:{region:'china',leader:'岳昕',government:'革命阵线胜利后选出的新政府'},
 cn_front_han_chair:{region:'china',leader:'韩东方',government:'革命阵线胜利后选出的新政府'},
 cn_ling_victory:{region:'china',leader:'令计划',stage:'postwar',government:'令计划领导的战后政府',conflict:null},
 cn_mao_assassinated:{region:'china',leader:null,government:'毛远新遇刺后的战时权力交接'},
 cn_bo_war_leader:{region:'china',leader:'薄熙来',government:'薄熙来领导的战时政府'},
 cn_bo_stolen_victory:{region:'china',leader:'薄熙来',stage:'personal_rule',conflict:null},
 cn_li_stopwar:{region:'china',leader:'李作成',stage:'military_rule',government:'叫停内战后的军事管治',conflict:null},
 cn_red_junta:{region:'china',leader:'李作成',stage:'military_rule',government:'红色军政府',institutions:['军政府','军事管制机关','地方行政机关','物资分配机构']},
 tw_martial_protest:{region:'taiwan',leader:'赖清德',stage:'emergency',government:'赖清德政府维持战时管制'},
 tw_four_factions:{region:'taiwan',leader:'台北韩国瑜、花莲赖清德、新竹郑村棋、台南陈奕齐',stage:'fragmentation',government:'四个指挥中心分区发布命令',institutions:['地方行政机关','各地临时指挥机构','医院','收容处']},
 tw_civil_war:{region:'taiwan',stage:'civil_war',conflict:'左翼联盟、民进党、国民党与基进党四方内战'},
 tw_left_end:{region:'taiwan',leader:'左翼联盟',stage:'left_reconstruction',government:'台湾社会主义共和国',conflict:null,institutions:['左翼联盟临时政府','工会','地方重建委员会','互助物资站'],terms:['新台币','公车','捷运','工会','互助厨房','重建登记']},
 tw_left_constituent:{region:'taiwan',leader:'郑村棋主持制宪会议',institutions:['制宪会议','临时政府','工会','地方委员会']},
 tw_left_transition:{region:'taiwan',leader:'制宪会议正在选举新领导人',government:'台湾社会主义共和国的制宪与领导交接'},
 tw_dpp_end:{region:'taiwan',leader:'赖清德',stage:'postwar_dpp',government:'民进党恢复中央管治，临时管制仍在',conflict:null,institutions:['总统府','中央行政机关','县市政府','重建办事机构']},
 tw_kmt_end:{region:'taiwan',leader:'韩国瑜',stage:'postwar_kmt',government:'国民党临时政府，军方继续参与公共事务',conflict:null,institutions:['临时总统府','地方行政机关','军事管制机关','重建办事机构']},
 tw_kmt_security:{region:'taiwan',institutions:['临时政府','秩序恢复委员会','地方行政机关','商会']},
 tw_revanchist_end:{region:'taiwan',leader:'陈奕齐',stage:'revanchist',government:'基进党主导的民族革命政府',conflict:null,institutions:['民族革命政府','征召机关','地方行政机关','重建委员会']},
 civic_vote:{region:'japan',leader:'联合政府首相',stage:'coalition',government:'新联合政府与国会协商'},
 ldp_vote:{region:'japan',leader:'自民党政府首相',government:'自民党继续主导内阁'},
 mil_crisis:{region:'japan',leader:'紧急军事当局',stage:'emergency',government:'首相遇刺后的紧急管治'},
 rep_crisis:{region:'japan',leader:'政变当局与反对力量',stage:'emergency',government:'政变后的政治对峙'},
 mil_end:{region:'japan',leader:'军政府',stage:'military_rule',government:'日本军政府',conflict:null,institutions:['军政府','地方行政机关','军事检查站']},
 rep_end:{region:'japan',leader:'统一民主战线',stage:'republic_transition',government:'统一民主战线胜利后的共和国重建',conflict:null,institutions:['过渡政府','地方代表机构','重建部门']},
 jp_public_morals:{region:'japan',stage:'restricted',government:'实施公序良俗法的政府，文化活动与发言受限制'},
 jp_emergency_committee:{region:'japan',leader:'丰川祥子',stage:'emergency',government:'日本安全紧急最高委员会接管行政与安全',institutions:['日本安全紧急最高委员会','地方行政机关','警视厅','紧急物资部门']},
 jp_hazawa_toyokawa_war:{region:'japan',leader:'羽泽鸫领导的左翼联军与丰川祥子紧急委员会',stage:'civil_war',government:'两方分区控制，跨地区通行受阻',conflict:'日本民主联合军与丰川紧急委员会内战'},
 jp_hazawa_end:{region:'japan',leader:'羽泽鸫与左翼联合阵线',stage:'left_reconstruction',government:'左翼联合阵线控制东京，制度重建尚在进行',conflict:null,institutions:['左翼联合阵线','工人委员会','地方重建机构','特别法庭']},
 jp_hazawa_congress:{region:'japan',government:'全日本革命联合代表大会讨论国家重建',institutions:['全日本革命联合代表大会','工人委员会','地方代表机构','重建部门']},
 jp_hazawa_constitution:{region:'japan',government:'共和国与地方自治的制度方案仍在讨论，不预设最终形式'},
 jp_toyokawa_end:{region:'japan',leader:'丰川祥子',stage:'security_state',government:'丰川紧急委员会继续军事检查与政治审查',conflict:null,institutions:['紧急委员会','警视厅','地方行政机关','产业重建部门']},
 jp_toyokawa_parties:{region:'japan',government:'丰川政府整合旧政党，统一政治组织服从国家优先纲领'}
};
function knownEvents(state,lore){
  const index=new Map([...(lore?.worldEvents||[]),...(lore?.routes||[]).flatMap(r=>r.milestones||[]),...(lore?.regionalStories||[])].map(e=>[e.id,e]));
  const month=state.month||0,known=new Map();
  for(const e of state.newsHistory||[])if(Number.isFinite(e.month)&&e.month<=month)known.set(e.id,{...index.get(e.id),...e});
  for(const id of [...(state.seenEvents||[]),...(state.seenNews||[]),...(state.current?.majorId?[state.current.majorId]:[])]){
    const e=index.get(id),date=state.eventMonths?.[id]??e?.earliestMonth??month;
    if(date<=month&&!known.has(id))known.set(id,{...e,id,month:date});
  }
  return [...known.values()].sort((a,b)=>a.month-b.month);
}
/** Historical baseline only; a later player declaration always takes precedence. */
function historicalEnvironment(where,month){
  if(month>=0)return null;
  const year=2020+Math.floor(month/12),calendarMonth=((month%12)+12)%12+1;
  const common={stage:'historical',leader:null,ideology:null,institutions:[],terms:[],conflict:null,setting:'historical',government:`${year}年的当地政治与生活环境`,dailyLife:'家庭按照当时的交通、通信、工作和物资条件安排生活。',forbiddenAssumptions:['不把2020年的现任领导人、疫情措施、手机支付、网络平台与身份关系搬到过去。','未有可靠资料的年代不虚构具体执政者或已发生的战争。']};
  if(year!==1976)return common;
  if(where.region==='china')return {...common,leader:calendarMonth<=9?'毛泽东': '华国锋',government:calendarMonth<=9?'文化大革命后期的中国共产党领导体制':'1976年秋政治变动后的中国共产党领导体制',ideology:'毛泽东思想与当时的社会主义政治制度',institutions:['革命委员会','生产大队','生产队','国营单位','供销社'],terms:['人民币','粮票','布票','单位','生产队','广播','书信'],dailyLife:'城乡的单位、生产队与家庭安排着劳动和物资领取，书信、广播和报纸传递消息。',sourceUrls:['https://cpc.people.com.cn/GB/64162/64164/4416105.html']};
  if(where.region==='taiwan')return {...common,leader:'严家淦任总统、蒋经国任行政院院长',government:'国民党执政的戒严体制，总统府、行政院与警备系统并存',ideology:'国民党党国体制与反共立场',institutions:['总统府','行政院','台湾省政府','县市政府','警备总司令部'],terms:['新台币','公车','里长','书信','广播'],dailyLife:'工厂、学校与家庭安排日常，政治活动受到戒严体制限制。',sourceUrls:['https://www.president.gov.tw/Page/84']};
  if(where.region==='japan')return {...common,leader:'三木武夫内阁',government:'自民党执政的议会民主制度，内阁与地方自治体承担行政事务',ideology:'自民党保守主义',institutions:['国会','内阁','都道府县厅','市役所'],terms:['日元','电车','报纸','电话','商店街'],dailyLife:'家庭依靠电车、公交、报纸与电话安排工作和往来。',sourceUrls:['https://www.kantei.go.jp/jp/rekidainaikaku/066.html']};
  if(where.region==='hongkong')return {...common,government:'英国管治时期的港督与政府部门体系',institutions:['港督','政府部门','立法局','市政局'],terms:['港元','巴士','渡轮','街市'],dailyLife:'工厂、码头与商铺提供生计，巴士和渡轮连接住处与工作地点。'};
  if(where.region==='macau')return {...common,government:'葡萄牙管治时期的总督与行政部门体系',institutions:['总督','行政部门','市政机关'],terms:['澳门元','巴士','街坊会','葡文文件'],dailyLife:'居民在街坊、工厂与商铺间往来，出入境和办事依当时的制度安排。'};
  return common;
}
function applyWorldOverride(result,state){
  const patch=state.worldOverrides?.[result.region];if(!patch||typeof patch!=='object')return;
  for(const key of ['leader','government','stage','conflict','ideology','institutions','terms'])if(Object.hasOwn(patch,key))result[key]=structuredClone(patch[key]);
  result.playerChanged=true;
}
export function regionContext(state,lore){
  const where=locality(state.location),base=data.regions[where.region],province=data.provinces[where.province];
  if(where.region==='ocean')return {...where,location:state.location,stage:'ocean',conflict:null,government:'所处海域没有陆地居民的行政生活',leader:null,institutions:[],terms:['洋流','海温','鱼群','礁石','水深'],forbiddenAssumptions:['海中身体与陆地居民生活分开，不安排上班、学校、社区登记、家庭账单或防疫手续。'],dailyContext:'洋流带来食物与陌生鱼群，水深、体形和捕食者决定活动范围。',plainLocalDescription:'你生活在太平洋，周围是海水、鱼群和不同深度的海底环境。',localDetails:['洋流和海温影响食物分布。','更大的生物会改变附近鱼群的游动方向。'],pandemic:'陆地公共卫生措施不直接成为海洋生物的生活安排。',knownChanges:[],knownRegionalReports:[],institutionState:{stage:'ocean',government:null,leader:null,conflict:null}};
  const historical=historicalEnvironment(where,Number(state.month)||0);
  const result={...structuredClone(base),...where,location:state.location,stage:'civilian',conflict:null,...historical};
  const known=knownEvents(state,lore),seen=new Set(known.map(e=>e.id)),changes=[];
  for(const event of known){
    const patch=CHANGES[event.id];
    if(patch?.region===where.region){Object.assign(result,structuredClone(patch));changes.push({id:event.id,month:event.month,title:event.title||event.id});}
    if(event.id==='world_strait_war'&&where.region==='taiwan'){result.conflict='台海战争';result.stage='wartime';}
    if(event.id==='world_strait_end'&&where.region==='taiwan'){
      result.conflict=null;result.stage='postwar';
      if(/大陆部队.*控制|中华人民共和国.*统一|北京.*接管|大陆付出巨大代价的胜利/.test(event.description||'')){result.government='台海停火后处于接管与重建阶段，具体地方安排尚待公布';result.leader='战后接管当局';result.institutions=['接管当局','地方行政机关','重建机构'];}
    }
    if(event.id==='world_japan_civil'&&where.region==='japan'){result.conflict='日本内战';result.stage='civil_war';}
    if(event.id==='world_asia_war'&&['china','japan','taiwan'].includes(where.region)){result.regionalConflict='大亚洲战争';}
    if(event.id==='world_asia_end'){result.regionalConflict=null;}
  }
  applyWorldOverride(result,state);
  const globalChange=state.worldOverrides?.global,terminated=state.worldDynamics?.terminatedConflicts||[];
  if(state.worldDynamics?.lastingPeace){result.conflict=null;result.regionalConflict=null;}
  else if(terminated.includes('asia'))result.regionalConflict=null;
  else if(globalChange?.conflict&&/大亚洲/.test(globalChange.conflict)&&['china','taiwan','japan'].includes(where.region))result.regionalConflict=globalChange.conflict;
  result.knownChanges=changes.slice(-8);
  result.knownRegionalReports=known.filter(e=>e.region===where.region||e.id?.startsWith(`rs_${({china:'cn',taiwan:'tw',japan:'jp'})[where.region]}_`)).slice(-8).map(e=>({id:e.id,month:e.month,title:e.title,description:e.description}));
  result.institutionState={stage:result.stage,government:result.government,leader:result.leader,conflict:result.conflict};
  result.industry=historical?null:province?.industry||null;result.pressures=historical?null:province?.pressures||null;
  result.dailyContext=historical?historical.dailyLife:province?`${province.dailyLife}。${province.pressures}，常常进入家庭的讨论。`:base.dailyLife;
  result.plainLocalDescription=result.dailyContext;
  result.localDetails=historical?[historical.dailyLife]:province?[`${province.dailyLife}。`,`${province.industry}带来不同的工作与生计。`,`${province.pressures}，需要一家人商量安排。`,`${province.ruralLife}，与城市之间仍有亲友和生活上的往来。`]:[base.dailyLife,`人们在${result.institutions.slice(-2).join('和')||'当地办事机构'}处理日常事务。`];
  result.pandemic=historical?'目前没有本地重大传染病疫情的消息。':seen.has('world_opening')?pandemicContext(where,state.month,seen):'当地尚未发布新的疫情通报。';
  const localHealth=known.filter(e=>e.region===where.region&&(/^rs_tw_(command|masks|vaccine|distribution)$|^rs_jp_(response|packages)$/.test(e.id)||e.category==='pandemic')).slice(-2);
  if(localHealth.length)result.pandemic+=' '+localHealth.map(e=>e.description).filter(Boolean).join(' ');
  if(result.stage!=='civilian')result.forbiddenAssumptions.push('政治称谓与机构使用当前已经公布的安排，不把2020年初制度或未发生的现实后续当作现状。');
  if(where.region!=='china')result.forbiddenAssumptions.push('中国大陆新闻可以被阅读，但不能因此认定本人经历同一政策、集会、灾害或物资损失。');
  return result;
}
function pandemicContext(where,month,seen){
  if(where.region==='china'){
    if(seen.has('world_protests'))return '防控失序与大游行已发生；各地措施并不一致，按照已知地方公告写生活影响，不默认每户被封控。';
    if(where.province==='湖北'&&month<=3)return '2020年初湖北疫情处于生活中心，交通、就医和家庭联络受到显著影响；不可凭空认定本人感染。';
    return '大陆疫情防控影响交通、学校和社区安排；具体措施取决于所在省市与已经公开的本地消息。';
  }
  return ({taiwan:'台湾由本地防疫机关发布措施，口罩、入境管理与卫生服务可能影响生活；不可套用大陆封城命令。',japan:'日本由政府、地方自治体和保健所应对疫情；2020年初不能预写后期紧急状态，不套用大陆健康码封控。',hongkong:'香港由特区卫生部门安排防疫，口岸、学校和医疗服务有本地程序；与内地措施不等同。',macau:'澳门由特区卫生部门安排防疫，旅游客流和口岸往来影响生计；不直接套用内地社区管控。',korea:'韩国由本地公共卫生机关安排防疫，不能直接套用大陆或日本措施。'})[where.region]||'当地防疫措施尚无明确资料。';
}
const DOMESTIC_NEWS=new Set(['news_palace','news_wuhan','news_mourning','news_school_pressure','news_zhengzhou_flood','news_panda','news_fuel','news_rationing','news_blackout','news_dong','news_supply_scandal','news_banks','news_export_factory','news_bank_petition']);
const COAST=new Set(['福建','浙江','广东','江苏','上海','海南']);
function eventRegion(event){
  if(DOMESTIC_NEWS.has(event.id)||/^cn_/.test(event.id))return 'china';
  if(/^tw_|^dpp_|news_taiwan|news_green/.test(event.id))return 'taiwan';
  if(/^jp_|^ldp_|^civic_|^mil_|^rep_/.test(event.id))return 'japan';
  if(event.places?.length)return locality(event.places[0]).region;
  return event.region||'global';
}
function exposure(factor,text){
  factor=Math.max(0,Math.min(1.5,Number(factor)||0));
  return {level:factor===0?'none':factor<0.15?'remote':factor<0.8?'indirect':'direct',factor,effectText:factor===0?'这则报道尚未带来可察觉的日常变化。':text};
}
export function newsExposure(state,event){
  const loc=locality(state.location),p=data.provinces[loc.province],id=event.id||'',r=eventRegion(event),month=state.month||0;
  if(loc.region==='ocean')return exposure(0,'');
  const listed=(event.places||[]).map(locality),direct=listed.some(x=>x.province?x.province===loc.province:x.region===loc.region),neighbor=p&&listed.some(x=>x.province&&p.neighbors.includes(x.province));
  if(id==='world_opening')return exposure(loc.region==='china'?(loc.province==='湖北'?1.4:0.65):({taiwan:0.16,japan:0.12,hongkong:0.35,macau:0.3,korea:0.12}[loc.region]||0.03),loc.region==='taiwan'?'选举消息和本地防疫安排进入日常，跨海往来需要重新留意。':'疫情消息让人重新留意出行、医疗与家人的近况。');
  if(id==='news_zhengzhou_flood')return exposure(loc.province==='河南'?1.5:loc.region==='china'?(neighbor?0.3:0.04):0,loc.province==='河南'?'暴雨与交通中断打乱了出行，家人开始互相确认平安。':neighbor?'部分跨省车次、货运和探亲安排受到影响。':'你读到了灾情，日常安排暂未出现明显变化。');
  if(id==='world_protests'||id==='cn_economic_failure')return exposure(loc.region==='china'?(p?.protestFactor||0.85):0,`街头消息和各地防控安排让一些出行、工作与家庭计划需要重新确认。`);
  if(id==='news_wuhan')return exposure(loc.province==='湖北'?(month<=3?1.5:0.8):loc.region==='china'?(neighbor?0.25:0.08):0,'湖北的交通和公共卫生消息影响了家人联络、探亲及货物往来。');
  if(id==='world_strait_war'||id==='world_strait_end')return exposure(loc.region==='taiwan'?1.5:loc.region==='china'?(COAST.has(loc.province)?1.2:0.65):({japan:0.6,hongkong:0.35,macau:0.25,korea:0.2}[loc.region]||0.08),'海峡局势改变了航运、物价、工作安排和跨海亲友联络。');
  if(id==='world_asia_war'||id==='world_asia_end')return exposure(['china','taiwan','japan'].includes(loc.region)?1.25:['hongkong','macau','korea'].includes(loc.region)?0.65:0.25,'地区战争牵动交通、供给和工作，家庭开始重新安排开支与联络。');
  if(id==='world_japan_civil'||id==='jp_hazawa_toyokawa_war'||id==='tw_civil_war'){
    const home=id==='tw_civil_war'?'taiwan':'japan';return exposure(loc.region===home?1.5:loc.region==='japan'||loc.region==='taiwan'?0.3:loc.region==='china'?0.18:0.06,loc.region===home?'战事切断部分交通，家人需要确认道路和临时物资领取地点。':'邻近地区的战事影响航运和亲友联络，本地并未因此自动进入内战。');
  }
  if(/^cn_(collapse|total_civil|longmarch_civil)/.test(id))return exposure(loc.region==='china'?1.3:['hongkong','macau'].includes(loc.region)?0.35:0.1,'大陆的交通、供给与组织秩序变化，影响了相关家庭和货运往来。');
  if(id==='world_europe_war'||id==='world_usa_civil_war')return exposure(['japan','taiwan','hongkong'].includes(loc.region)||COAST.has(loc.province)?0.35:0.18,'远方冲突首先通过订单、能源与亲友消息传来。');
  if(listed.length){
    if(direct)return exposure(event.category==='social'?0.6:1,'当地的消息影响到日常议论、出行或家庭安排。');
    if(loc.region!==r)return exposure(0,'');
    if(neighbor)return exposure(event.category==='disaster'?0.25:0.12,'邻近地区的变化通过交通、货运或亲友消息传来。');
    return exposure(event.category==='disaster'?0.03:0.05,'你读到这则报道，本地生活尚未发生明显变化。');
  }
  if(r==='china'&&loc.region!=='china')return exposure(event.category==='economy'?0.08:0,'大陆消息可能通过贸易间接传来，并不意味着当地执行相同措施。');
  if(r===loc.region)return exposure(event.category==='social'?0.2:event.category==='science'||event.category==='technology'?0.15:0.75,'有关安排逐渐通过工作、公共服务与身边人的议论进入生活。');
  if(r==='global')return exposure(event.category==='pandemic'?(month<2?0.1:0.3):0.12,'国际消息通过航运、工作和亲友联络间接传来。');
  return exposure(event.category==='economy'?0.06:0.02,'这是一则外地报道，本地生活还没有明显变化。');
}

function currentAge(state){
  if(state.person?.ageOverride){const a=state.person.ageOverride;return (a.months+(state.turn??state.history?.length??0)-a.turn)/12;}
  if(Number.isFinite(state.startAgeMonths))return (state.startAgeMonths+(state.month||0))/12;
  if(Number.isFinite(state.profile?.startAgeMonths))return (state.profile.startAgeMonths+(state.month||0))/12;
  if(/^\d{4}-\d{2}/.test(state.profile?.birthDate||'')){const [y,m]=state.profile.birthDate.split('-').map(Number);return (2020*12+(state.month||0)-(y*12+m-1))/12;}
  return Number(state.profile?.age||0)+(state.month||0)/12;
}
export function culturalContext(state,query=''){
  const text=String(query||'').toLowerCase(),age=currentAge(state),local=locality(state.location),month=state.month||0,matches=[],anachronisms=[];
  const identity=String(state.profile?.name||'')+' '+String(state.profile?.backgroundText||'');
  for(const entry of memeData.entries){
    const explicit=entry.aliases.some(t=>text.includes(t.toLowerCase()));
    const identityRelevant=entry.people?.some(p=>identity.includes(p))&&entry.aliases.some(t=>identity.includes(t));
    if(!explicit&&!identityRelevant)continue;
    if(entry.startMonth>month){if(explicit)anachronisms.push({term:entry.term,availableFrom:entry.availableFrom});continue;}
    if(age<entry.minAge)continue;
    const regional=entry.regions.includes(local.region),crossCultural=explicit&&(entry.people?.some(p=>text.includes(p))||/梗|中文|中国|網路|网络|翻译|意思|视频|影片/.test(text));
    if(!regional&&!crossCultural)continue;
    matches.push({id:entry.id,term:entry.term,meaning:entry.meaning,usage:entry.usage,availableFrom:entry.availableFrom,explicit});
  }
  return {matches:matches.slice(0,4),anachronisms,guidance:'只在本人明确提到或自身经历相关时理解用语，不每月强加网络梗，不替真实人物编造私事。尚未流行的用语若被本人先说出，可视为个人说法，不能描述为当时人人皆知的潮流。'};
}
