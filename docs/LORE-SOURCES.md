# 剧情来源、路线树与时间契约

本版只读扫描 `D:/Users/ROG/Documents/GitHub/TFR-xinzuo-rebuild` 的事件、国策、决议、脚本效果、脚本条件、on_actions 与全部语言本地化，未修改模组。完整索引范围、逐 TAG 映射数量与未接入内容见 [MOD-COVERAGE.md](MOD-COVERAGE.md)。`src/data/lore.json` 含 **37 条路线：中国 24、台湾 5、日本 6、欧洲 2**，380 个路线节点引用、9 个世界事件、86 条区域社会报道，共 268 个不同宏观事件 ID。另有 `src/data/news.json` 的 **16 条社会、产业与民生新闻**，详见 [NEWS-SOURCES.md](NEWS-SOURCES.md)。

本作是架空政治科幻人生游戏。真实人物、机构和地点在模组中的言行与结局不是现实新闻。本作保留用户指定的路线因果，把国家事件改编为就业、学业、照护、居住、信息与公共参与体验，不宣称完整移植模组触发系统。

## 时间与调度

`earliestMonth` 从 2020 年 1 月零基计数。日期是本游戏的节奏安排，不是对原模组固定日期的声明。原模组大量事件由国策、战争胜负和旗标触发。

| 节点 | 时间 | 调度规则 |
| --- | --- | --- |
| `world_opening` | 2020 年 1 月 / 0 | 合并新冠与民进党连任，固定开局，不把选举挪到二月 |
| `world_protests` | 2021 年 7 月 / 18 | 防控失序与大游行，用户指定架空时序 |
| `world_usa_civil_war` | 2021 年 8 月 / 19 | 固定日期 |
| `world_strait_war` | 2021 年 10 月 / 21 | 台海开战，固定日期 |
| `world_europe_war` | 2022 年 6 月 / 29 | 欧陆战争，本作安排 |
| `world_strait_end` | 2022 年 8、9、10 月 / 31、32、33 | 每局抽取其一，三类结局描述由中国 `warOutcome` 决定 |
| `world_japan_civil` | 台海结束 12 个月后 | 仅军政府／共和内战叶子，前有 +4 月危机和 +8 月结盟，后有 +24 月结局 |
| `world_asia_war` | 2027 年 1 月 / 84 | 用户“1026年以后”按2026年以后处理；不在生物灾害、早期崩溃线强加同一战争 |
| `world_asia_end` | 2028 年 1 月 / 96 | 大战已发生才停火，毛远新此后才可发动第二次文革 |

张又侠政变在台海实际结束后 2 个月，胡春华或陈文清接任在 +5 个月，胡春华三种政策选择在 +8 个月。使用 `after: "strait_end"` 与 `delayMonths`，不会在战争结束前抢先触发。

主要政治节点相隔约 3—9 个月，长期战争和组织积累阶段保留更长生活空间。长征机诞生在第 55 月，即 2024 年 8 月；现人神、大众民主、赛博陈云等相关高级系统也不早于 2024 年。

毛远新先经历隐忍合作、再社会主义化、劳工网络接触、积蓄力量与战时联盟。`cn_second_cultural` 需要 `world_asia_end` 已发生至少 5 个月，`cn_total_civil_war` 再等待 6 个月。内战胜利与主席选举主要在 2030 年展开。

长征分支先诞生、交易、政变、内战、建立共和国，再制宪。右翼制宪与数字民主试验在 2027 年进行；2028 年 7 月进入大选季，第 106 月即 2028 年 11 月由秦晖当选，三种方向在后续月份分别展开。

- `requires` 是必须已经发生的事件 ID；`after` 可指动态日历键或事件 ID，延迟从实际发生月份算起。
- 世界事件与新闻独立于个人生活记录，同一月可出现多则，不占用个人行动。`fixedMonth` 保留固定日期；相对事件遵守真实前置。
- 每地区一个互斥叶子；`routeIds: []` 表示所有路线。共用事件 ID 只发生一次。`weight` 是本作相对抽样权重，保守政变低于常规改革，不冒充原模组概率。
- 台湾固定民进党 2020 连任。非陈文清情况下保留产业、贸易与居民生活及原有日本政治发展。陈文清两个叶子强制进入台湾四方内战与羽泽鸫／丰川祥子日本内战，台湾左胜严格绑定日本左胜，其余三方胜严格绑定日本右胜。
- 路线名、摘要和未发生后继不应送入当月叙事，避免提前透露领导人、战争胜者与技术突破。

## 中国分支证据

以下缩写路径均相对于模组根目录，前缀为 `localisation/simp_chinese/`：P=`TFR_country_localisation_PRC_l_simp_chinese.yml`；M=`replace/_maoyuanxi_events_l_simp_chinese.yml`；Z=`replace/_maoyuanxi_zaxiang_l_simp_chinese.yml`；G=`replace/_gzl_l_simp_chinese.yml`；T=`replace/_gqtpai_l_simp_chinese.yml`；H=`replace/_handeqiang_l_simp_chinese.yml`；Q=`replace/_qh_l_simp_chinese .yml`（实际文件名含空格）；W=`PRC_WHN_continuation_l_simp_chinese.yml`。

| 叶子 ID | 前置与结果 | 主要证据 |
| --- | --- | --- |
| `cn_chen_security` | 台海失败→张又侠→紧急会议→陈文清极权 | P: `china.21.d`、`PRC_CHEN_WENQING_DESC`、`PRC_party_under_mss_control_desc` |
| `cn_han_cyber` | 稳定优先→韩德强正道革命→赛博毛泽东 | M: `PRC_MAO6.70.d`；H: `PRC_MAO.3.t`、`PRC_MAO.164.d`、`PRC_MAO.193.t` |
| `cn_han_zombie` | 稳定优先→正道派复生实验→丧尸毛泽东 | H: `PRC_MAO.136.t`、`PRC_MAO.165.d`、`PRC_MAO.170.d`、`PRC_MAO.171.d` |
| `cn_han_duel` | 同上生物危机→赛博毛泽东→双龙大战 | H: `PRC_MAO.163.d`、`PRC_MAO.164.d`、`PRC_MAO.180.t` |
| `cn_hu_socialdem` | 政治改革→新左合作→胡春华社民化、重建社会党国际 | P: `china.17.d`、`china.352.d`；G: `china.193.d`、`PRC_tuanpai_26`、`TFR_SI_NAME` |
| `cn_zhang_mass` | 新左合作→张宏良→大众民主 | G: `market_socialism_5_desc`、`PRC_tuanpai_25`、`PRC_tuanpai_33` |
| `cn_li_police` | 自由派合作→李克强→亲俄、世界警察 | G: `PRC_MAO5.23.t`；俄罗斯结盟与团派外援本地化，见 JSON 完整路径 |
| `cn_wang_police` | 自由派合作→汪洋→亲俄、世界警察 | P: `china.19.d`；同上外交来源 |
| `cn_bo_deity` | 改革领导班子选举→薄熙来→现人神 | T: `PRC_MAO9.6.d`、`china.434.d`、`PRC_MAO5.30.d`、`china.432.d` |
| `cn_whn_cyberchen` | 低权重保守政变→王沪宁→第二次清场→赛博陈云 | G: `PRC_conservates_angry_1`、`china.174.d`、`PRC_MAO5.25.a`；W: `POLITICS_chenyuncb_DESC` |
| `cn_mao_mao_chair` | 经济失约→第二次白纸→毛远新隐忍→大战后第二次文革→全面内战革命阵线获胜→毛远新当选 | M: `PRC_MAO6.71`—`85` 系列、`PRC_MAO7.54.t`、`PRC_MAO7.58.d`；Z: `PRC_mao_yuanxin` |
| `cn_mao_yue_chair` | 同一革命阵线获胜→岳昕当选 | M: `PRC_MAO7.58.d`；具体候选人依照用户设定 |
| `cn_mao_han_chair` | 同一革命阵线获胜→韩东方当选 | M: `PRC_MAO7.58.d`；Z: `PRC_han_dongfang` |
| `cn_mao_ling_victory` | 同一全面内战→令计划获胜 | `replace/_maoap_l_simp_chinese copy.yml`: `PRC_ling_jihua_hog`、`PRC_AP_country_summary`；用户指定胜利组合 |
| `cn_mao_bo_victory` | 全面内战→毛远新遇刺→薄熙来接掌并窃取胜利 | M: `PRC_MAO6.95.d`、`PRC_MAO6.96.d`、`PRC_MAO6.97.d`；组合和次序见下文 |
| `cn_mao_li_junta` | 全面内战→毛远新遇刺→李作成停战、红色军政府 | M: `PRC_MAO6.95.d`、`PRC_MAO6.96.d`；停战终局依用户设定 |
| `cn_long_commune` | 经济兑现→长征与韩东方交易→泛左翼内战→中华共和国→左翼制宪→中华人民公社 | G: `china.668.d`、`PRC_MAO1.67.d`、`PRC_MAO1.14.d`、`PRC_MAO1.71.d`、`PRC_MAO1.74.d`、`PRC_MAO1.25.d`、`PRC_MAO.45.d` |
| `cn_long_qin_center` | 同上共和国→右翼制宪、太约和解、数字民主→2028秦晖→中间路线 | G: `PRC_MAO1.26.d`、`PRC_MAO1.27.d`、`PRC_MAO1.75.d`、`PRC_MAO1.54.d`；Q: `PRC_MAO2.20.d`、`PRC_MAO2.21.d` |
| `cn_long_qin_left` | 同上右翼制宪及秦晖当选→极左路线 | Q: `PRC_MAO2.11.d`、`PRC_MAO2.14.d`、`PRC_MAO2.20.d` |
| `cn_long_qin_traditional` | 同上右翼制宪及秦晖当选→回归传统→长征再次革命 | Q: `ROC_qinhui_right1` 明确警告通向长征政变；`PRC_MAO2.24.d`、`PRC_MAO2.27.d`、`PRC_MAO2.29.d` |
| `cn_collapse` | 台海结束→经济彻底崩溃→第二次中国内战、地方割据 | P: `china.248.d`；用户指定第三种台海结果，不擅定这次内战的赢家 |
| `cn_victory_chen` | 高代价胜利→张又侠→陈文清 | 复用陈文清叶子；惨胜触发政变属于用户覆盖设定 |
| `cn_victory_hu` | 高代价胜利→张又侠→胡春华社民改革 | 复用社民改革叶子；同上 |
| `cn_victory_qin` | 高代价胜利→经济兑现→长征→秦晖中间路线 | 复用长征右翼叶子；同上 |

三个惨胜变体为 `costlyVictory`，其余常规政治叶子为 `defeat`，早期崩溃为 `collapse`。惨胜变体不是三个额外的原作国策树，而是同一政治路径在不同战后背景下的完整叶子。

## 其余地区与六类配图

非陈文清情况下，台湾采用 `tw_dpp`，选举依据 `TFR_game_rules_l_simp_chinese.yml` 的 `CHI_election_green_TXT_DESC`；产业与贸易依据台湾本地化的 `CHI_toughen_industries`、`CHI_farplanning_infrastructure`、`CHI_prc_embargo_idea_desc`。

非陈文清情况下，日本保留 `jp_ldp`、`jp_civic`、`jp_military`、`jp_republic`。前两者采用党派、预算、婚姻、劳动和产业本地化；后两者依据 `events/TFR_events_JAP.txt` 的 `jap.33`—`jap.43` 及其不同胜利事件。军政府和共和国国策文件仍不完整，居民战后重建为本作补充。

欧洲 `eu_nato` 与 `eu_russia` 分别采用超级事件本地化中的 `nato_victory_super` 和 `SOV_ur_victory_super`，胜负互斥。六类重大配图复用 `strait`、`japan`、`zombie`、`longmarch`、`europe`、`asia`，由 `illustrated` 标记配图；日常政治与社会报道使用相应主题图片，所有画框由界面统一为 16:9。

## 与原文不同的明确改编

1. 用户时间和因果优先于旧 `game_rules`。原模组多以台海失败触发这些改革路径，本版应用户要求允许惨胜后也有张又侠政变，路线级 `adaptationNote` 明确说明。
2. M 的 `PRC_MAO6.69`—`74` 确实提供广场承诺、三种重心、经济失约、第二次白纸、胡春华辞职及毛远新君子协定。本版采用这些较新的覆盖文本，避免旧版笼统新左路线混入互斥结局。
3. G 的 `PRC_MAO5.25` 原文是王沪宁、金正恩死亡后由薄熙来下令清场。用户要求王沪宁上台并发生第二次天安门清场，本版将清场归入其统治期，标为 `adaptation: true`。W 赛博陈云原文明说它是长征架构逆向、历史记忆与固定制度前提，没有人从机房复活。
4. 毛远新死后军方接管、重庆政治中心与全国分裂有原文，但“全面内战中遇刺→薄熙来窃取胜利／李作成成功停战”按用户要求重新组合。岳昕等当选、令计划在这一轮内战胜出和军政府停战的完整组合依用户设定补充；人物名称键不冒充完整胜利事件的证据。
5. H 的 `PRC_MAO.164` 原本在丧尸危机后启动赛博毛泽东，本版拆出独立赛博和双龙大战两个叶子，赛博单独线不强行出现丧尸。正道派神秘主义、外星文明和现人神永生改写为实验、人工智能、宣传及权力制度。
6. G 的制宪会议讨论国家性质、劳动权利、信息开放和市场存废，`PRC_MAO1.75` 明确是2028大选前夜，`PRC_MAO1.54` 明确秦晖当选。左右制宪与太约和解、数字民主试验的组合遵从用户要求。原文另有韩东方连任、工业党等结局，本轮只展开用户要求的秦晖三路。
7. 大亚洲战争结束不把所有路线写成同一赢家。毛远新战后胜利作为其后续革命前提；已经和解的中华共和国不自动毁约参战。早期崩溃和全球生物灾害线不强行叠加同一联盟战争。
8. 所有个人生活场景、行动建议与月份间隔均是人生模拟改编。`actionHints` 提供多种个人选择，最终选项应适应年龄、背景、所在地及玩家自由叙述，不强制认同意识形态或参战。

## 旧存档与验证

`legacyRouteMap` 将旧8条中国路线映射到新叶子，`tw_kmt` 映射为固定民进党开局。该表只负责路线映射，历史和游标迁移由引擎处理，不应把新路线未发生前置直接宣布为完成。

数据层核对覆盖37个路线 ID、24个中国 `warOutcome`、区域前置与图片文件。当前宏观内容有330个不同来源引用，均按文件和精确键名定位；这只证明可追溯，不等于完整复现原作条件，也不替代引擎的逐月排程和存档验证。


## 第三版：陈文清执政后的台日内战

本地化证据以 `localisation/simp_chinese/replace/_tzl_l_simp_chinese.yml`（下称 TZL）、`_yuzedong_event_l_simp_chinese.yml`（下称 YE）、`_yuzedong_focus_l_simp_chinese.yml`（下称 YF）为主。

`lore.couplings` 显式列出 `cn_chen_security`、`cn_victory_chen` 两个中国叶子。新台湾和日本叶子设 `selectionOnly: "chen"`，非陈文清的抽取不应混入这些战事。台日共用的序章事件在不同叶子保持同一 ID；日本胜利先于台湾胜利，后者有相应胜利 ID 的 `requires`。胜负绑定是用户明确要求的改编约束，不声称原模组的随机算法必然如此。

| 台湾叶子 | 战时力量与结局 | 证据与改编边界 |
| --- | --- | --- |
| `tw_left` | 新竹左翼联盟、郑村棋；胜利后制宪、经济／政体争论、与日本左翼合作、领导人交接 | TZL `PRC_MAO3.49.d`、`.52.d`、`.54.d`、`.55.d`、`.73.d`—`.82.d`；原文直接有左翼胜利与制宪全文 |
| `tw_dpp_civil` | 花莲民进党、赖清德；重返台北，处理战时权力和产业重建 | TZL `PRC_MAO3.50.d`、`.54.d`；制造业借用 `taiwan_temp_skeleton.5.d`、`.8.d`。民进党胜利及后续并无对等完整原文，已标 `adaptation` |
| `tw_kmt` | 台北国民党、韩国瑜；恢复行政、港口与对外谈判 | TZL `PRC_MAO3.50.d`、`.54.d`、`taiwan_detente.6.d`。国民党胜利后的生活与外交为基于既有派系的改编，已标记 |
| `tw_revanchist` | 台南基进党、陈奕齐；民族革命、复仇主义、持续动员与国防工业 | TZL `PRC_MAO3.48.d`、`.54.d`、`.73.d`。胜利与后续为依据起义宣言和战俘叙述延伸，已标记；未把左翼胜利原文冒充基进党胜利原文 |

| 日本叶子 | 政治与社会内容 | 证据 |
| --- | --- | --- |
| 共用前置 | 羽泽鸫归国、公序良俗法、丰川财团扩张、米价危机、皇居遇袭、紧急委员会、左右内战、海自中立 | YE `PRC_MAO5.48.d`、`.46.d`、`.47.d`；TZL `PRC_MAO3.57.d`—`.62.d` |
| `jp_hazawa` | 左翼统一阵线、羽泽鸫胜利、全日本革命联合代表大会、经济／政体／地方权利讨论、台日合作 | YE `PRC_MAO5.56.d`、`.61.d`；TZL `PRC_MAO3.89.d`；YE `PRC_MAO6.1.d`—`.4.d` |
| `jp_toyokawa` | 驱鬼行动、丰川祥子胜利、政党整合、财团重建、对外资本与安全合作 | YF `JAP_operation_oni_desc`、`JAP_kill_red_desc`、`JAP_kill_traitors_desc`、`JAP_ldp_restoration_desc`、`JAP_military_government_desc`、`JAP_help_from_abroad_1_desc`；胜利报道与重建生活为国策内容的改编 |

节奏按台海实际停火月计算：陈文清接任之后，台湾战后 +6 月出现行政裂缝、+9 月镇压抗议、+10 月四方指挥中心、+12 月开战。日本 +6 月归国、+8 月文化管制、+10 月财团政治、+12 月米价危机、+14 月紧急委员会、+16 月内战，次月海自中立。日本 +34 月胜负确定，台湾 +36 月胜负确定；重建与制度讨论再以 3—5 个月间隔展开。这些月份是适配时序，不是 MOD 的硬编码日期。

大陆惨胜后仍出现台湾四方内战，是本轮用户要求覆盖原有默认的结果：战后安排无法落实、大陆政变与地方力量重新组织给岛内政治留下空间。`tw_postwar_fracture` 已单独标注改编，避免把大陆惨胜直接写成岛内永远没有政治势力。

所有新增新闻及大事件都有 `art`；台湾内战 `taiwan-civil`、左胜 `taiwan-left`、日本内战 `japan-civil`、左胜 `japan-left` 使用原 MOD 对应事件图。其他政治与民生主题复用有来源的配图，由 UI 统一使用 16:9 画框。


## 1.3：全量索引、区域生活与可检索片段

`scripts/build-mod-corpus.mjs` 递归读取指定六类脚本目录的全部685个TXT，以及全部1,164个YML本地化文件。索引包含21,218个定义、73,412条字面联系与483,407个本地化定义。`src/data/mod-corpus.json` 记录文件散列、行号、定义、条件、互斥、调用及来源绑定，供审查与继续扩写；浏览器与模型不导入完整索引。该索引不执行HOI4作用域、旗标和战争规则。

本次新增29个不同国策后续节点，以及86条`regionalStories`。区域层中中国46条、台湾24条、日本16条。实际排程总数268与索引定义数不能混同；某些不同前置下的战后生活文字相同，268是不同ID数，不是268篇独立原作全文。

| 内容组 | 已纳入的具体内容 | 原文与关系依据 |
| --- | --- | --- |
| 中国陈文清 | 社会政审、官方舆情岗位 | `PRC_all_society_political_investigation`、`PRC_officials_on_social_media` 及实际国策定义 |
| 胡春华与张宏良 | 游说监管、基层选举、社区议事、大众民主与制造业 | `PRC_anti_lobbying_laws` → `PRC_reform_local_elections`；`PRC_popular_socialist_democracy`、`PRC_modernize_manufacturing_clasters`；没有并入与游说监管互斥的企业协会选项 |
| 韩德强三支 | 漫展驱散、少数群体处境、儒学文化工程、数字隔离、京津感染封锁、救援通信 | H：`PRC_MAO.117`、`.118`、`.123`、`.194`、`.166`、`.167`、`.181`；生物灾害内容只进入丧尸及双龙两支 |
| 毛远新准备期 | 保健品店清查、农业历史争论、文化奖励、佳士平反、青年干部、基层办事 | M：`PRC_MAO6.75`、`.77`、`.78`、`.82`、`.84`、`.85`；只公布已经发生的政策，不提前转述其推翻旧政权的秘密打算 |
| 毛远新制度与后续 | 制造业与合作社、战后工会参与和工业复工 | `PRC_modernize_manufacturing_clasters` → `MAO_RE_FOCUS_7`；M：`PRC_MAO7.58`。岳昕／韩东方／毛远新胜利叶共享事实；令计划、薄熙来、李作成叶的行政和返乡后果明确标记有限延伸 |
| 王沪宁 | 监控、最低保障名单、国企扩张 | W及`PRC_WHN_response_chain`、`PRC_WHN_single_case_number`、`PRC_WHN_familiar_hands`；部分国策描述为空，只能依据标题和脚本，未声称存在完整正文 |
| 薄熙来现人神 | 特权账户审核、行为预测误差、AI依赖、渐进自动化与成人教育 | T：`china.432`、`.433`、`.485`、`.486`；缩小原文无条件后稀缺与神力为可讨论的技术和制度后果 |
| 自由派合作 | 政纲竞争、公开监督、海外预算和合同劳动 | G：`china.191`、`.192`；团派对外介入资料。没有把已结束的欧陆战争重新宣告为正在进行 |
| 长征共和国 | 企业管理、药品监管、工会竞争、市长选举、学校与矫正机构讨论 | G：`PRC_MAO1.9`、`.12`、`.47`、`.48`、`.50`、`.57`；市长选举和政党竞争只进入右翼制宪后的数字民主阶段 |
| 秦晖三支 | 中间派社区自治和表决、极左计划与工人民主、传统派家庭与宗族 | `PRC_niaolong_105`—`108`；`109`、`111`、`112`；`95`、`96`，分别绑定相容叶子。传统派两条在长征再次革命前完成 |
| 台湾共同前期 | 指挥中心、疫情救助、口罩措施、疫苗研发分发、外贸、宣传和反渗透 | `CHI_TWW_FOCUS_1`、`2`、`3`、`5`、`9`、`14`、`8`、`19`。月份为本作安排；研发不等于同月完成疫苗 |
| 台湾四方内战 | 参战者家属、左翼控制区妇女组织、十小时工时、配给与贵金属征用、广场、工厂委员会 | TZL：`PRC_MAO3.65`、`.69`、`.70`；`TZL_TWW_FOCUS_5`、`9`、`10`。报道明确限定左翼控制区，出现并不等于左翼必胜 |
| 台湾战后 | 制宪讨论落实到管理、企业修复、返乡与失散登记 | 复用各叶已经成立的政治、产业和外交事实；民进党／国民党／基进党缺文部分均为`consequence-adaptation` |
| 日本共同前期与两方内战 | 防疫与中小企业救助、SOX跨区联络、日共分裂、新左派联合、对外求援争论 | `JAP_deal_with_the_pandemic`、`JAP_provide_emergency_response_packages`、`JAP_support_small_medium_enterprises`；YE：`PRC_MAO5.71`、`.61`、`.56`、`.67`。求援争论不自动宣告中国已经答应援助 |
| 日本不同政府 | 自民党下产假托育、职场与教育；联合政府下劳动、难民与执法讨论；丰川集权与警务；旧内战结局的公共设施恢复 | 日本国策和现有胜利脚本。缺乏原文的战后生活有单独改编标记，没有强接需韩国征服完成的TSU后期国策 |

新增节点的`modRelations`保留所用事件／国策的原始前置、互斥及被调用关系；这些字段供审查，不发送给当月叙事。`evidenceLevel`区分本地化改写、结果后的生活延伸与纯脚本后果。国策效果可能包括多个分支，文本只采用当前相容阶段的部分，不把全部效果宣布为发生。

所有台湾、日本内战及其胜利节点都显式要求`world_strait_end`。区域社会报道从所属阶段的实际月份延后，非关键细节允许0—2个月浮动；中国关键固定日期、台海停火窗口与原有互斥终局保持。

`getModContext(state,lore,{region,tags,query,limit=6})`仅查阅当前叶已发生节点、已发生区域报道与16条社会新闻；要求发布日期不晚于当前月，前置均已发生。返回有上限的已审原文短段或已公开改写、来源和已经发生的关联ID。八条短原文经过单独筛选，其余使用公开摘要。函数不会用关键词越过阶段门槛，也不采用导入存档自带的任意描述作为MOD原文。
