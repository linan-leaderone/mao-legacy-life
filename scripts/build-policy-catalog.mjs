// Authoring-only: retain exact MOD focus references beside bounded monthly adaptations.
import fs from 'node:fs/promises';
const corpus=JSON.parse(await fs.readFile(new URL('../src/data/mod-corpus.json',import.meta.url),'utf8'));
const rows=[
 ['PRC_stabilize_the_economic_sphere','china_initial','相关部门公布稳定订单与就业的安排，企业可申报流动资金需求。地方窗口开始受理材料，具体拨款仍须按公布的条件审核。'],
 ['PRC_food_safety_reforms','china_initial china_hu china_mao','市场与卫生部门联合检查食品来源，公布抽检与投诉渠道。商户补齐进货记录，学校食堂与工厂食堂也收到新的验收要求。'],
 ['PRC_optimize_the_supply_chain','china_initial','重点港口与工厂核对运输瓶颈，公布临时仓储及转运安排。供应商重新确认到货日期，尚未恢复的线路仍保留风险提示。'],
 ['PRC_stability_and_security','china_chen','国安系统公布重点设施与公共活动的审查安排。地方机关开始核对通行及活动申请，居民办理有关事务所需的手续增加。'],
 ['PRC_encourage_digitalization_nat','china_chen','政府扩大行政信息系统，要求部门统一登记资料。部分业务改为线上受理，信息纠错与访问权限成为居民关心的问题。'],
 ['PRC_improve_party_discipline','china_transition china_initial','组织部门公布纪律检查与整改名单，各地单位须说明预算和人员任用。原有行政事务继续办理，涉及调查的事项暂缓签批。'],
 ['PRC_niaolong_33','china_hu china_socialdem china_mao','劳动部门公布合同、休假与工伤保障的改革安排，工会代表参与征求意见。外包与临时用工的待遇列入审查，已经发生的争议可以递交记录。'],
 ['PRC_reform_local_elections','china_hu china_socialdem','地方议事机构开始公布代表产生办法与议程，居民能够登记意见并查询办理结果。先行地区要公开会议记录，具体执行办法仍接受修订。'],
 ['PRC_niaolong_3','china_mao china_socialdem','公共医疗部门开始调整基础诊疗的收费与财政补助，县镇卫生机构报送药品和人员缺口。免费项目分批办理，医院需公开实际可用的诊疗范围。'],
 ['PRC_agricultural_self_sufficiency','china_mao china_socialdem china_front','各地合作组织与农业部门核对耕地、种子和农机需求，安排本季生产与收购。农户可以核查合同和交付时间，地方供销渠道开始调整。'],
 ['PRC_push_for_local_democracy','china_hu china_liberal','媒体管理部门公布新的采访与信息公开办法，地方记者开始追问预算、工程和公共服务。办事机关被要求答复已经提出的查询。'],
 ['PRC_greening_economy_campaign','china_liberal','环保部门公布节能改造与污染治理计划，企业按行业提交方案。居民可以查看附近项目的排放记录，工程费用与停工安排分别公布。'],
 ['PRC_support_agricultural_modernization','china_liberal','农业部门开放农机与技术改造申请，合作组织核对灌溉、仓储和运输需求。首批项目开始施工，农户按合同决定是否参与。'],
 ['PRC_niaolong_51','china_whn','行政机关启用集中监督系统，单位须定期上传人员和业务记录。申诉窗口仍在受理纠错，更多日常手续纳入统一审查。'],
 ['PRC_WHN_quiet_day','china_whn','政府调整劳动教育与管理程序，相关机构统一登记人员、课程和考核。家属与工作人员开始按照新的规定办理联络和申诉。'],
 ['PRC_niaolong_109','china_digital china_commune china_cybermao','地方生产委员会试行按公共需求协调订单，公布库存、运输与设备状况。工人和居民能够核对数据，算法提出的安排仍须由负责机构确认。'],
 ['PRC_niaolong_108','china_digital china_republic china_qin','公共议事平台开放新的提案与复核渠道，居民可以核查表决记录。线下办事处为不便使用网络的人登记意见，技术人员公开修订故障。'],
 ['PRC_the_Flower_of_Freedom_20','china_populist china_commune','公职人员参加新的公共服务与问责培训，居民代表检查办理记录。地方机构收集积压事项，开始公布负责人员和答复日期。'],
 ['PRC_reorient_the_economy','china_bo china_ling china_junta china_han china_april_bo','政府重新安排重点行业的订单与预算，优先处理已公布的生产和基础设施项目。企业、工会与地方机关接到落实通知，资金和用工仍按具体项目核算。'],
 ['PRC_economic_conversion_to_military_needs','china_initial china_chen china_hu china_bo china_mao china_junta china_april_bo','战时管理机关调整工厂订单和运输优先次序，医疗与生活物资保留专门运力。相关企业通知工人排班变化，家庭开始核对供给与出行安排。',{war:true}],
 ['CHI_TWW_FOCUS_2','taiwan_dpp taiwan_april_lai','行政部门公布疫情救助的申请日期与条件，县市窗口接受受影响的家庭和商户登记。补助逐项审核，民间团体继续追问遗漏对象。'],
 ['CHI_TWW_FOCUS_14','taiwan_dpp taiwan_kmt','经贸部门公布新的出口与采购联系计划，厂商重新寻找客户和运输渠道。相关订单需要逐一确认，政府说明融资与保险安排。'],
 ['CHI_TWW_FOCUS_21','taiwan_dpp taiwan_april_lai','劳工团体与行政部门就工资、工时和派遣用工举行公开会谈。行业代表提交争议清单，雇主须说明现有合同的履行情况。'],
 ['CHI_engineering_maintenance_brigade','taiwan_dpp taiwan_kmt taiwan_revanchist taiwan_april_lai','工程维修队核查供水、供电与道路损坏，发布分区抢修日期。居民据此安排出行，医院与避难设施获得优先修复。',{war:true}],
 ['CHI_solidify_civil_defence','taiwan_dpp taiwan_kmt taiwan_revanchist taiwan_april_lai','地方机关更新避难地点、紧急联络与救护安排，志愿者按街区登记。通知说明物资领取和伤员转送办法，家庭核对亲友联络方式。',{war:true}],
 ['TZL_TWW_FOCUS_47','taiwan_left','左翼联盟公布分阶段改革日程，优先恢复公共服务并逐项讨论制度调整。工会、居民与行政人员公开核对承诺，尚有争议的条款留待后续议事。'],
 ['TZL_TWW_FOCUS_70','taiwan_left','政府公布最低工资、工时、保险与工会组织的保障办法，劳动部门接受申诉。厂方须向工人说明调整后的合同，工会代表检查执行情况。',{requiresPolicies:['TZL_TWW_FOCUS_47']}],
 ['TZL_TWW_FOCUS_72','taiwan_left','工会、政府与雇主代表建立公开的劳资协调会议，工资和工时争议按期受理。会议留下记录，当事人可以要求复核。',{requiresPolicies:['TZL_TWW_FOCUS_70'],exclusiveGroup:'taiwan-production'}],
 ['TZL_TWW_FOCUS_45','taiwan_left taiwan_april_commune','计划经济委员会公布首批物资与生产调查，工厂和地方组织报送实际需求。公众能够核查配给与交付记录，未完成的项目继续登记。',{exclusiveGroup:'taiwan-production'}],
 ['TZL_TWW_FOCUS_59','taiwan_left taiwan_april_commune','群众监督机构公布投诉、核查和答复程序，居民代表检查公共开支。地方办公室需解释未办结事项，调查结果按规定公开。'],
 ['TZL_TWW_FOCUS_54','taiwan_left taiwan_april_commune','农业部门与耕作者核对农地、水利和农机，讨论共同经营的范围。地块与分配记录公开登记，生产安排按当地会议结果逐项办理。'],
 ['JAP_provide_heavy_inflation_relief_packages','japan_ldp japan_coalition','内阁公布针对生活必需品涨价的补助安排，自治体按家庭与商户情况受理。能源和运输企业同时提交价格说明，公众可查询申请进度。'],
 ['JAP_green_energy_plan','japan_ldp japan_coalition','能源部门公布电网与节能设施的更新计划，自治体说明施工和预算。居民与企业提交用电需求，部分项目开始公开征求意见。'],
 ['JAP_harmony_labor_life','japan_ldp','劳动部门要求企业说明加班和休假安排，行业团体开始检查执行情况。员工能够查阅记录，企业调整排班并答复已经提出的争议。'],
 ['JAP_labor_code_reform','japan_coalition japan_republic','联合政府公布劳动法修订草案，工会与雇主分别提出意见。议会讨论工时、派遣和申诉程序，自治体为当事人提供咨询。'],
 ['JAP_accessible_education','japan_coalition japan_republic','教育部门公布学费援助与公共教育安排，学校说明可申请的名额和期限。自治体优先核查困难家庭的需要，教师讨论新的教学资源分配。'],
 ['JAP_maintain_constitutionalism','japan_coalition japan_republic','议会要求行政机关公开紧急措施的期限与复核办法，法院继续受理相关诉讼。公民团体和地方代表围绕权利保障提交意见。'],
 ['JAP_restore_order','japan_toyokawa japan_junta','紧急管理机关统一交通、治安与物资调度，公布各地办事地点。地方居民核对通行手续，商户按照实际运输条件安排营业。'],
 ['JAP_rigid_centralization','japan_toyokawa japan_junta','紧急委员会要求地方机关按统一程序报送资料，重要行政决定集中签批。地方代表提出的异议登记在案，办理公共事务需要更多证明。',{requiresPolicies:['JAP_restore_order']}],
 ['TSU_TWW_FOCUS_44','japan_left','左翼联合阵线开展财阀资产与旧官僚行政记录的调查，工会和地方组织提交材料。调查机关公布受理范围，涉及生产的企业仍需维持工资与基本供应。'],
 ['TSU_TWW_FOCUS_47','japan_left','各左翼组织召开协调会议，就劳动保障、行政过渡和公共服务列出共同要求。尚有分歧的议题继续公开讨论，地方代表负责收集具体意见。'],
 ['TSU_TWW_FOCUS_79','japan_left','产业部门与工人代表讨论电子产业的设备、能源和订单安排，科研人员提出技术需求。首批改造项目公布预算，生产计划按实际供应调整。'],
 ['TSU_TWW_FOCUS_106','japan_left','公共机构公布反歧视与平等服务的实施办法，学校、工厂和地方组织讨论申诉程序。居民可要求复核差别待遇，执行人员接受相关培训。']
];
const policies=rows.map(([focusId,factions,description,extra={}])=>{
 const e=corpus.entities.find(e=>e.kind==='focus'&&e.id===focusId);if(!e)throw new Error(`Missing focus: ${focusId}`);
 const title=corpus.texts[focusId]?.text?.replace(/§./g,'').replace(/£\S+/g,'').trim();if(!title)throw new Error(`Missing localisation: ${focusId}`);
 const desc=corpus.texts[focusId+'_desc'];
 return {id:`policy_${focusId}`,focusId,title,description,region:factions.split(' ')[0].split('_')[0],factions:factions.split(' '),minMonth:2,settleMonths:2,category:'policy',impact:{},...extra,
  sourceRefs:[{file:corpus.files[e.file].path,key:focusId,line:e.line},...(desc?[{file:corpus.files[desc.file].path,key:focusId+'_desc',line:desc.line}]:[])],
  sourcePrerequisites:(e.links||[]).filter(l=>l.type==='prerequisite').map(l=>l.target),sourceExclusions:(e.links||[]).filter(l=>l.type==='mutually_exclusive').map(l=>l.target),
  adaptation:'原国策前置压缩为当前政权、成立后准备期、已完成政策与战争状态；不把原国策全文或将来结果视为已发生。'};
});
await fs.writeFile(new URL('../src/data/policies.json',import.meta.url),JSON.stringify({version:1,policies},null,2)+'\n');
console.log(`Wrote ${policies.length} source-bound monthly policies.`);
