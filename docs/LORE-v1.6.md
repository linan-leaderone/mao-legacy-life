# v1.6 台湾报道与模组人物

本轮只读检查相邻 `TFR-xinzuo-rebuild`，未修改模组。新增 **18 条台湾报道**，`regionalStories` 从 86 条增至 **104 条**，原有 16 条独立民生新闻保留。全部新增报道使用已有主题配图，沿用界面的 16:9 画框。新增 **6 份隐藏姓名档案**，本地合并库为 **9,074 份**；另整理 **29 份模组政治人物元数据**。

## 台湾报道的联系

以下 T 代表 `localisation/simp_chinese/replace/_tzl_l_simp_chinese.yml`，C 代表 `localisation/simp_chinese/TFR_country_localisation_CHI_l_simp_chinese.yml`。月份是人生模拟的节奏安排，原模组大量段落由脚本及旗标推进，不能称为原作的固定日期。

| 新增报道 | 前置与间隔 | 本地化依据 |
| --- | --- | --- |
| 选后蓝绿政策争论 | 开局后 1 月 | C `taiwan.5.d`、`CHI_KMT_protests` |
| 避难、商店与非武装民防 | 台海开战后 1 月 | C `taiwan.35.d` |
| 民众党、时代力量表态 | 开战后 1 月 | T `PRC_MAO2.62.d`、`.64.d` |
| 基进党战时志愿队伍 | 开战后 2 月 | T `PRC_MAO2.63.d` |
| 国际左翼团体合作 | 开战后 2 月 | T `PRC_MAO2.66.d` |
| 立法院政治冲突 | 开战后 3 月 | T `PRC_MAO2.75.d` |
| 左翼联盟成立 | 立法院冲突后 1 月 | T `PRC_MAO2.83.d` |
| Afterglow 抵台 | 开战后 2 月 | T `PRC_MAO2.85.d` |
| Afterglow 交通中断与生活困难 | 抵台后 1 月 | T `PRC_MAO2.86.d` |
| 陈信行接待与战时记录 | 滞台后 1 月，且左联成立 | T `PRC_MAO2.89.d` |
| 新竹临时演出 | 开始记录后 1 月 | T `PRC_MAO2.97.d` |
| 军队与民兵的装备争议 | 左联成立后 2 月 | T `PRC_MAO2.91.d` |
| 民进党青年军 | 开战后 5 月 | T `PRC_MAO3.7.d` |
| 蔡英文辞职、赖清德接任 | 开战后 7 月，限四方内战的台湾发展方向 | T `PRC_MAO3.15.d` |
| 全面动员紧急状态 | 赖接任后 1 月 | T `PRC_MAO3.16.d` |
| Afterglow 返日 | 台海停火后 1 月，已在台湾记录见闻 | T `PRC_MAO3.46.d` |
| 停火后的戒严争议 | 战后分裂节点后 1 月，已停火 | T `PRC_MAO3.45.d` |
| 四方内战中的通行与家庭 | 台湾内战开始后 1 月 | T `PRC_MAO3.48.d`、`.49.d`、`.50.d`、`.54.d` |

战时报导带有 `blockAfter: ["world_strait_end"]`，Afterglow 在台阶段也受返日节点排除。报道不能在停火后补发为正在发生的战事。普通民防、民兵和正规军的身份保持区分。台湾内战仍以前置台海停火为依据；主动改变政治格局的行为由引擎覆盖当前状态，不能被后续静态描述悄悄撤销。

Afterglow 的志愿经历在台海战争中发生，日本内战在返日及之后的政治变化后发生。五人开局仅有乐队生活与伙伴关系，不能提前变成革命军领导人。新增台湾民兵新闻没有宣称岛内已发生四方内战，也不把台湾本地征召写成大陆省份的征召。

## 隐藏人物与未知字段

新增美竹兰、丰川祥子、羽泽鸫、青叶摩卡、上原绯玛丽、宇田川巴；精确姓名和列明别名才匹配，姓名框不增加候选名单。

`PRC_MAO2.85.d` 在赴台时称鸫 22 岁，但没有完整生日。本作以 2021 年开战推算，五名乐队成员 2020 开局约 20 岁；其余四人同龄属于适配设定。丰川相关国策 `JAP_REV_UI_skdie_TOOLTIP_DELAYED` 写台海开战后 15 岁，`PRC_MAO5.51.d` 写返日时期 17 岁，`PRC_MAO3.61.d` 写紧急委员会时期 18 岁；本作开局使用约 13 岁。模组的剧情时间浮动，不能据此编造精确生日。六人保留空 `birthDate`、`birthDatePrecision: estimated` 和年龄估值说明。

Afterglow 家庭收入、具体出生地及完整亲属履历在已核查文本中不足，保留未知。丰川家与瑞穗、古河的联系有原文，2020 年初未预先套用后来的财阀合并或统治职务。9,058 条广泛人物库仍是公开基础资料，**本轮没有声称补齐全部人物的私人家庭、性格或模组剧情**。

## 意识形态、关系与公开阶段

`src/data/personas-mod.json` 分开保存隐藏档案与政治元数据。`findPersona(name)` 返回档案及审计用 `modPolitics`；其中 `stages` 包含未来阶段，不能原样送入当月叙事。`getPoliticalActors(state)` 才是叙事接口：最多 12 人，当前地区优先，返回 `id/name/region/ideology/role/priorities/relationships/influence/sourceRefs`，排除当前主角，尊重已知事件及 `worldOverrides` 的领导人变更。

人物倾向、阵营和关系是模组的虚构设定，不是对现实人物思想或私生活的评断。人物脚本常允许多个意识形态，不把全部候选类型同时当成开局立场。羽泽鸫主义来自 `replace/_qh_l_simp_chinese .yml:Tsuguism_desc` 和 `common/characters/TFR_MAO.txt`，仅在相关经历后生效；与陈信行的关系在台湾记录事件后出现。丰川与 Afterglow 的对立依据 `replace/_yuzedong_event_l_simp_chinese.yml:PRC_MAO5.52.d`，不预设开局敌对。胡春华的稳定、改革、经济重心分阶段；毛远新与薄熙来的合作、与韩东方的联系有各自事件前置。

中国开局沿用户要求采用市场毛主义、修正主义主席独裁制。原人物脚本 `PRC_xi_jinping` 为 `market_socialism`，覆盖本地化 `_jinxianqian_l_simp_chinese.yml` 的 `market_socialism_1_desc`、`market_socialism_6_desc` 明列市场毛主义；本作的完整制度措辞是用户覆盖设定，不冒充单一模组键的逐字表述。台湾开局蔡英文的人物类型为 `taiwanese_progressivism`，文本强调社会自由与台湾进步主义；赖清德脚本另列 `classical_liberalism`，不直接与其战时紧急状态混为一项。日本按自民党占优势的保守主义议会民主制度描述。

## 时间旅行与制度覆盖

`regionContext` 对负月份不沿用 2020 年执政者、疫情、产业和手机生活。1976 年提供大陆、台湾、日本及港澳的历史制度基线；其他未整理年份只返回保守的时代描述，领导人保持未知。历史资料依据：中国共产党新闻网[1976 年大事记](https://cpc.people.com.cn/GB/64162/64164/4416105.html)、台湾总统府[严家淦任期资料](https://www.president.gov.tw/Page/84)、日本首相官邸[三木内阁](https://www.kantei.go.jp/jp/rekidainaikaku/066.html)。这些资料用于时间旅行的历史基线，不与 2020 后架空模组事实混写。

自然事件派生完成后，`state.worldOverrides[region]` 覆盖 `leader/government/stage/conflict/ideology/institutions/terms`，显式 `conflict: null` 表示冲突已结束。人物年龄辅助函数接受负月份；人物因穿越或返老还童产生的身体年龄以引擎当前状态为准。

## 验证

新增 `tests/mod-personas-v16.test.mjs` 覆盖六名隐藏姓名、年龄精度、公开阶段关系、领导人覆盖、1976 年地区环境、台湾新闻影响和来源键。来源检查在相邻 MOD 可用时逐条验证文件与键存在。与现有地区、人物索引测试合计 31 项通过。全项目及打包结果由主任务的验证记录说明；这些单元检查不能证明所有路线都已实机游玩。
