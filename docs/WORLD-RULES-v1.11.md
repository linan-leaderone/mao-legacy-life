# 当前政权、政治人物与随机国策

`regions.js` 从已发布事件、明确的世界变更和开局时代记录派生当前制度。`regime-rules.js` 为大陆、台湾、日本的既有阶段提供一致的 `factionId` 与意识形态。左翼联盟胜利后的台湾不再继承民进党社会自由主义；丰川紧急委员会及日本左翼政府不再继承自民党保守主义。旧存档缺失或复制了开局意识形态时，按明确的执政者/政府名称修复；用户另行明确的非默认纲领保留。

`deriveGovernmentState(state,lore)` 返回当前领导、政府、意识形态、阶段和冲突，供存档、地图与提示共同使用。`normalizeWorldOverrides(state)` 返回可序列化的修复副本。两者不修改输入。

## 乐队的政治化

`getPoliticalActors` 仍可提供已遇见音乐人的公开身份和现阶段关系，但增加 `autonomyEligible` 与 `activityScope`。Afterglow 的排练、赴台记录和返日公共讨论不授予政府职务。日本内战或玩家明确任命/政治干预发生前，其成员不会进入自主政治新闻抽样。丰川祥子在财阀接管等相应事件前也只保留个人身份。传入叙事的阶段仍限于已经发生的事情。

## 随机政策

`src/data/policies.json` 包含43条从PRC、CHI、TZL、TSU、JAP国策改编的月度政策。`scripts/build-policy-catalog.mjs` 从本地审计索引提取对应国策及中文本地化的文件、键、行号和原始前置，不修改MOD。运行端只导入小型政策库。

这43条是有明确出处的生活叙事适配，不是HOI4国策解释器，也不代表全部国策已可执行。原版前置在本作压缩为当前执政势力、成立后的准备期、已发布政策及战争状态；原始前置同时保留在来源元数据中。不得把未发生国策的描述当作世界事实。

- `eligibleMonthlyPolicies(state,lore)` 审查已知前置、当前政权、战争条件及互斥关系，不抽样、不写档。
- `selectMonthlyPolicies(state,lore)` 用人生种子与月份稳定抽样，每月最多一条，普通月份有54%概率没有政策公告。
- 世界政策至少间隔两个月，同地区至少间隔四个月；新政权或新制度至少留两个月准备。
- 已发布的政策不重复。台湾劳资协调与集中计划的适配方案互斥；劳动保障需先有渐进改革政策。
- `enactedPolicyContext(state)` 只给出最近八条已经公布的政策，供叙事延续其制度影响。

新闻不会替玩家花掉月度行动。政策描述记录公共安排，没有将每一项国家政策都直接折算成每个居民的一笔钱。

# 水浒传开局时代

选择 `shuihu` 新开局时保存 `profile.scenario={id:'mao-april',version:1}`。普通新开局保存 `standard`。旧档即使曾选择水浒文风，也不会仅凭语言设置追改原世界；开局记录与后续语言表达相互独立。

原MOD关系：

1. `common/on_actions/_Zmaos_ap.txt` 在 `yurenjie_start` 下把薄熙来设为PRC领导人，使用 `market_socialism_6`，并设置主席独裁与太子党。
2. `events/TFR_events_CHI.txt` 调用 `PRC_MAO7.11`、`PRC_MAO7.12`。中文文本在 `localisation/simp_chinese/replace/_maoap_l_simp_chinese copy.yml`：前者为毛泽东向赖清德借魂，后者发生在夺权后，明确赖认出毛泽东并讨论群众政治。
3. `common/national_focus/TFR_national_focus_CHI.txt` 通过 `laisang_maodie_2` 选择相关分支。`events/TFR_MAO7_EVENT.txt` 的 `PRC_MAO7.17` 切换计划经济与共产党国家体制，并调用 `PRC_MAO7.19` 发布消息。

按用户指定，把薄熙来执政和借魂状态前移为2020年开局事实。群众议事与新经济制度依次发展，最早为开局后三个月、七个月，各前置实际发布后再留至少三个月；这是月度人生模拟的时序适配，不声称原MOD按这些月份发生。普通大陆继承链与台湾四方内战链在此时代不再自动覆盖开局，主动行为仍可改变政治结果。

选择隐藏毛泽东时，意识与记忆属于毛，身体与年龄属于赖清德（2020年1月约60岁2个月），实际身处台湾。为兼容已有特殊人生存档校验，身体记录沿用复活类型的 `stage:4,body:'human'`，同时在 `person.bodyIdentity/bodyPersonaId/status` 明确借魂事实。人物职业为借赖清德之身处理政务，不会继续写北京棺内苏醒，也没有第二个可独立行动的毛。公开政治人物列表不再把同一身体里的赖列作另一位独立NPC。

接口：`createOpeningScenario(profile)`、`applyOpeningScenario(state)`、`scenarioMonthlyEvents(state)`、`scenarioAllowsEvent(state,event)`、`scenarioAdaptEvent(state,event)`、`scenarioContext(state)`。初始化只执行一次；叙事使用时代事实覆盖静态现实人物开局资料。

针对性验证：`node --test tests/world-rules-v111.test.mjs tests/mod-personas-v16.test.mjs tests/regional.test.mjs`，34项通过。整包与交付结果由主流程另行记录。
