// Political labels belong to the current government, never to its 2020 predecessor.
// Keys describe the MOD's fictional administrations; they are not modern sovereignty claims.
export const REGIMES=Object.freeze({
  china_initial:{factionId:'china_initial',ideology:'市场毛主义、修正主义与主席独裁制'},
  china_transition:{factionId:'china_transition',ideology:'战后军事问责与过渡管治'},
  china_chen:{factionId:'china_chen',ideology:'国安系统主导的极权主义'},
  china_hu:{factionId:'china_hu',ideology:'团派主导的改革与社会市场取向'},
  china_socialdem:{factionId:'china_socialdem',ideology:'民主社会主义与社会民主主义'},
  china_populist:{factionId:'china_populist',ideology:'左翼民粹主义与大众民主'},
  china_han:{factionId:'china_han',ideology:'正道革命与毛主义'},
  china_cybermao:{factionId:'china_cybermao',ideology:'赛博毛主义与自动化生产组织'},
  china_liberal:{factionId:'china_liberal',ideology:'自由主义改革与市场经济'},
  china_bo:{factionId:'china_bo',ideology:'个人崇拜与威权民族主义'},
  china_whn:{factionId:'china_whn',ideology:'保守派高压统治与技术官僚威权主义'},
  china_mao:{factionId:'china_mao',ideology:'再社会主义化与毛主义'},
  china_fragmented:{factionId:'china_fragmented',ideology:'各地势力分立，尚无统一执政纲领'},
  china_leftfront:{factionId:'china_leftfront',ideology:'泛左翼联合与共和国重建'},
  china_republic:{factionId:'china_republic',ideology:'共和国制宪与多派协商'},
  china_digital:{factionId:'china_digital',ideology:'实验性数字民主与多元自治'},
  china_commune:{factionId:'china_commune',ideology:'公社社会主义与基层直接民主'},
  china_qin:{factionId:'china_qin',ideology:'秦晖领导下的共和国政治与公共协商'},
  china_front:{factionId:'china_front',ideology:'革命阵线的社会主义联合政治'},
  china_ling:{factionId:'china_ling',ideology:'令计划主导的战后集中统治'},
  china_junta:{factionId:'china_junta',ideology:'红色军事政府与军队极权统治'},
  taiwan_dpp:{factionId:'taiwan_dpp',ideology:'社会自由主义与民进党台湾进步主义'},
  taiwan_fragmented:{factionId:'taiwan_fragmented',ideology:'左翼联盟、民进党、国民党与基进党分别管治'},
  taiwan_left:{factionId:'taiwan_left',ideology:'左翼联盟主导的社会主义与劳工民主'},
  taiwan_kmt:{factionId:'taiwan_kmt',ideology:'国民党保守主义与战后秩序优先'},
  taiwan_revanchist:{factionId:'taiwan_revanchist',ideology:'基进党复仇民族主义与民族革命'},
  taiwan_takeover:{factionId:'taiwan_takeover',ideology:'战后接管与重建，新的政治制度尚未公布'},
  japan_ldp:{factionId:'japan_ldp',ideology:'自民党保守主义与议会民主'},
  japan_coalition:{factionId:'japan_coalition',ideology:'多党联合与民主改革'},
  japan_junta:{factionId:'japan_junta',ideology:'军事威权主义'},
  japan_republic:{factionId:'japan_republic',ideology:'统一民主战线与共和民主'},
  japan_toyokawa:{factionId:'japan_toyokawa',ideology:'丰川财阀与安全机关主导的威权国家主义'},
  japan_fragmented:{factionId:'japan_fragmented',ideology:'左翼民主联合军与丰川紧急委员会分区管治'},
  japan_left:{factionId:'japan_left',ideology:'羽泽鸫主义、左翼联合与基层劳动民主'},
  china_april_bo:{factionId:'china_april_bo',ideology:'市场毛主义与太子党主席独裁'},
  taiwan_april_lai:{factionId:'taiwan_april_lai',ideology:'毛泽东借魂赖清德推动的群众政治'},
  taiwan_april_commune:{factionId:'taiwan_april_commune',ideology:'群众直接民主与计划经济'}
});
const groups={
  china_transition:['cn_zhang_coup'],china_chen:['cn_chen_emergency','cn_chen_totalitarian'],china_hu:['cn_hu_inauguration','cn_hu_reform'],china_socialdem:['cn_socialdem'],china_populist:['cn_zhang_hongliang','cn_mass_democracy'],china_han:['cn_han_rise'],china_cybermao:['cn_cyber_order'],china_liberal:['cn_li_elected','cn_wang_elected'],china_bo:['cn_bo_elected','cn_bo_deity','cn_bo_war_leader','cn_bo_stolen_victory'],china_whn:['cn_whn_coup'],china_mao:['cn_mao_succession'],china_fragmented:['cn_collapse_civil','cn_total_civil_war'],china_leftfront:['cn_longmarch_coup','cn_longmarch_civil'],china_republic:['cn_republic_foundation'],china_digital:['cn_digital_democracy'],china_commune:['cn_peoples_commune'],china_qin:['cn_qin_elected'],china_front:['cn_front_victory','cn_front_mao_chair','cn_front_yue_chair','cn_front_han_chair'],china_ling:['cn_ling_victory'],china_junta:['cn_li_stopwar','cn_red_junta'],taiwan_dpp:['rs_tw_tsai_resignation','rs_tw_full_mobilization','tw_martial_protest','tw_dpp_end'],taiwan_fragmented:['tw_four_factions','tw_civil_war'],taiwan_left:['tw_left_end','tw_left_constituent','tw_left_transition'],taiwan_kmt:['tw_kmt_end','tw_kmt_security'],taiwan_revanchist:['tw_revanchist_end'],japan_coalition:['civic_vote'],japan_ldp:['ldp_vote'],japan_junta:['mil_crisis','mil_end'],japan_republic:['rep_crisis','rep_end'],japan_toyokawa:['jp_emergency_committee','jp_toyokawa_end','jp_toyokawa_parties'],japan_fragmented:['jp_hazawa_toyokawa_war'],japan_left:['jp_hazawa_end','jp_hazawa_congress','jp_hazawa_constitution']
};
export const EVENT_REGIMES=Object.freeze(Object.fromEntries(Object.entries(groups).flatMap(([key,ids])=>ids.map(id=>[id,key]))));
export const baselineRegime=region=>REGIMES[({china:'china_initial',taiwan:'taiwan_dpp',japan:'japan_ldp'})[region]]||{factionId:region};
export function inferredOverrideRegime(region,patch){
  if(/_april_/.test(patch.factionId||''))return REGIMES[patch.factionId];
  const text=[patch.leader,patch.government,patch.stage].filter(Boolean).join(' ');
  const choices=region==='taiwan'?[
    [/四方|四个指挥|fragmentation/,'taiwan_fragmented'],[/左翼联盟|社会主义共和国|left_reconstruction/,'taiwan_left'],[/韩国瑜|國民黨|国民党|postwar_kmt/,'taiwan_kmt'],[/陈奕齐|基进党|revanchist/,'taiwan_revanchist'],[/民进党|赖清德|蔡英文|postwar_dpp/,'taiwan_dpp']
  ]:region==='japan'?[
    [/羽泽.*丰川|两方分区/,'japan_fragmented'],[/丰川|紧急委员会/,'japan_toyokawa'],[/羽泽|左翼联合|left_reconstruction/,'japan_left'],[/军政府|military_rule/,'japan_junta'],[/统一民主战线|共和国/,'japan_republic'],[/联合政府|coalition/,'japan_coalition'],[/自民党/,'japan_ldp']
  ]:region==='china'?[
    [/陈文清|国安系统/,'china_chen'],[/毛远新|再社会主义化/,'china_mao'],[/王沪宁/,'china_whn'],[/韩德强|正道派/,'china_han'],[/社会民主/,'china_socialdem'],[/张宏良|大众民主/,'china_populist'],[/李克强|汪洋/,'china_liberal'],[/薄熙来/,'china_bo'],[/李作成|红色军政府/,'china_junta'],[/令计划/,'china_ling'],[/中华人民公社/,'china_commune'],[/秦晖/,'china_qin'],[/数字民主/,'china_digital'],[/中华共和国/,'china_republic'],[/胡春华/,'china_hu'],[/张又侠/,'china_transition']
  ]:[];
  return REGIMES[choices.find(([pattern])=>pattern.test(text))?.[1]]||REGIMES[patch.factionId]||null;
}
/** Repair only stale default ideology. A declared non-default ideology remains authoritative. */
export function normalizedGovernmentOverride(region,patch){
  if(!patch||typeof patch!=='object')return patch;
  const next=structuredClone(patch),regime=inferredOverrideRegime(region,patch),base=baselineRegime(region);
  if(regime){
    next.factionId=regime.factionId;
    const stale=!next.ideology||[base.ideology,'社会自由主义；民进党台湾进步主义','自民党保守主义','市场毛主义、修正主义与专制主义'].includes(next.ideology);
    if(stale)next.ideology=regime.ideology;
  }else if((patch.leader||patch.government)&&!next.ideology){next.ideology='新当局尚未公布完整政治纲领';next.factionId=`${region}_custom`;}
  return next;
}
