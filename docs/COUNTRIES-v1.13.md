# 1.13 开局历史合并与势力资料

`node scripts/build-country-catalog.mjs` 只读相邻 MOD，生成 `src/data/countries.json`。`--mod=目录` 可指定来源，`--output=文件` 可将结果写到独立位置。没有修改 MOD。此版本替代 1.12 国别文档中的开局解析范围与人工政治口径。

## 修复原因与规则

旧提取器把国家历史文件当成仅属于文件名前三个字母的静态资料，跳过其中指向别国的 TAG 作用域。例如 `history/countries/ZZZ - Anarchy.txt` 第 22–37 行明确把朝鲜执政组改为 `national_socialist`，调用 `change_government_type_fascist_dictatorship`，并覆盖党名和支持度。这些效果现在和其他跨国历史一起处理。

生成过程按以下顺序合并：

1. 读取 TAG、人物、思想、ideas、游戏规则、scripted effects、scripted triggers、事件定义与本地化。文件名使用不依赖系统语言的、忽略大小写的字典顺序；同名定义由后读文件覆盖。简体中文优先，`replace` 优先，同优先级后读文本生效。
2. 读取全部州历史及默认 owner/controller、省地块控制者。日期块仅采用 2020-01-01 当日或更早的部分。
3. 按相同文件顺序逐份执行国家历史，包含其中明确指定其他国家的嵌套作用域。693 个文件全部读取，包含两个 `TIG` 文件，避免用单值 Map 静默丢掉前一文件。
4. 执行 `on_startup` 的确定性效果，展开实际调用到的 scripted effects。只使用 `common/game_rules` 中 `default` 定义，不把第一个可选选项当默认值。DLC 条件采用可用；玩家身份、AI 身份等无法确定的条件保留未知。
5. 无延迟、无随机延迟的事件只处理可判定触发条件下的 `immediate`。不替玩家选择 `option`。延迟事件、国策奖励、未调用脚本、未知条件下的分支均不提前执行。
6. 重新汇总 owner、controller 和局部省地块控制，得到最终开局存在性、战争和政治资料。所有国家填完后再导出，不在读取半途给界面提供结果。

这是本作的有限开局提取器，未启动 HOI4 引擎做逐项运行比对。`openingAudit.loadOrder` 记录具体读取与执行顺序，`sourceFiles` 记录全部来源 SHA-256，`openingChanges` 记录政治字段修改来源、顺序与调用链。

## 政体冲突的处理

MOD 自身存在不互斥的附加制度：朝鲜在 ZZZ 中显式切换为法西斯专政后，通用 startup 按 TAG 又添加 `ZZZ_communist_party_state`。中国、古巴、尼泊尔也有类似情形。此版本把明确 `change_government_type_*` 作为展示制度；通用 `add_ideas` 不抹掉明确切换。没有明确切换时，使用最后添加的制度 idea。

这是一项有记录的展示消歧约定，并非声称原 MOD 在运行中删除了旧 idea。`governmentResolution` 同时保存选择方法、来源、全部有效制度 idea 和冲突标记。5 个开局实体含多个制度 idea：`CUB/CHI/NEP/PRK/PRC`。

| TAG | 最终开局展示 | 来源变化 |
| --- | --- | --- |
| PRK | 金正恩；法西斯专政；主体思想；`national_socialist`；指令经济 | ZZZ 第 22–37 行；`_prc_left.txt` 开局经济覆盖 |
| NEP | 比迪亚·德维·班达里；总统/主席独裁；市场毛主义 | ZZZ 第 40 行起的后续角色与政治覆盖 |
| LAO | 本扬·沃拉吉；总统/主席独裁；市场毛主义 | ZZZ 与 `_prc_left.txt` 开局制度调用 |
| VIN | 苏林；总统/主席独裁；市场毛主义 | ZZZ 的 `promote_character` 与政治覆盖 |
| CUB | 劳尔·卡斯特罗；总统/主席独裁；卡斯特罗主义；党国资本主义 | ZZZ 后一次匹配执政组的人物晋升与 `_prc_left.txt` |
| PRC | 习近平；总统/主席独裁；习大林主义；中国共产党-习近平派 | ZZZ 明确设定，未把胡春华/陈文清的其他思想角色当现任 |
| BYA | 亚速营；马克西姆·若林；军事独裁；纳粹毛主义 | ZZZ 转交 1374 马里乌波尔；cosmetic TAG `YASHUYING` |

日本保留德仁天皇为国家元首、安倍晋三为政府首脑；台湾按 MOD 的台式半总统制和台湾进步主义。政治资料不再使用 1.12 的人工覆盖字符串。香港、澳门仍是本作已有的特别行政区本地基线，因为 MOD 没有独立开局 TAG。

## 覆盖与边界

- 读取 **4,162 个来源文件**、**693 份国家历史**、**692 个 TAG**、**1,493 个 MOD 州**。
- **187 个开局存在实体**，均有明确领导资料；186 个有政体。缺少政体的是承载内部功能的 `ZZZ`，保持空值。
- 解析 1,642 个 scripted effect 定义和 657 个 scripted trigger 定义；本次开局执行路径展开 4,964 次脚本调用。定义数量不代表所有未来内容已经发生。
- **8 组明确开局宣战关系**，包括阿富汗、也门、利比亚、索马里、中非以及顿涅茨克与亚速营；**15 个州存在省地块级混合控制**。
- 地理身份仍为 252 项，163 项具有主政权或港澳本地基线。其他地区保留资料空缺；未来 TAG 不因资料齐全就成为开局政府。
- 开局临时国家精神保存剩余天数，例如澳大利亚山火 150 日；laws、ministers、dynamicModifiers 也保留来源。这些元数据不会自动成为每月重复施行的政策。
- 522 处不同来源的条件仍不能确定；4 处效果保留未执行记录，涉及 3 处英国各地限定州动态修正和 1 处全球数组循环。未知条件中有地图/变量/AI/界面等条件，不能把这个数量解释为 522 个缺失政权。
- 军队、装备、建筑、资源和地图胜利点不在国别政治模拟范围，记录为 `nonPoliticalEffects` 统计并保留原文件哈希；没有把兵棋数值直接用于人物生活结算。

## 控制权与运行接口

`openingStates` 的每条记录包含 `id/name/nameEnglish/ownerTag/controllerTag/provinceIds/provinceControllers/sourceRefs`。其中 `provinceControllers` 仅记录对州默认控制者的局部覆盖。MOD 省地块与州都不是现实县界；现实区划投影由控制权模块负责，不能因为州中一块由反对派控制就把整州都涂成反对派。

`openingWars` 每条包含 `attackerTag/defenderTag/sourceRefs`。没有明确宣战的割据地区仍可存在多个控制者，不能自动当作所有派系已互相开战。

每个 TAG 记录含 `ownedStateIds/controlledStateIds/cosmeticTag/ideologyGroup`。旗帜选择使用当前思想与 cosmetic TAG；后续世界变更优先于开局。

- `countryByTag(tag)` 返回独立 TAG 的最终开局资料。
- `getCountryContext(state,iso)` 返回地理国家的当前资料与不可变 `baseline`。
- `getFactionContext(state,tag)` 返回实际控制势力的当前资料。塔利班不会套用喀布尔政府总统；非主要政权只接收自己 TAG/factionId 的明确动态覆盖。

## 验证

`node --test tests/countries-v112.test.mjs tests/countries-v113.test.mjs`：**16 项通过**。包含真实 MOD 重点案例、混合控制与战争、当前/基线隔离，以及独立微型 MOD 夹具：跨 TAG 覆盖、脚本调用、真实默认游戏规则、未知条件不走 else、未来日期与延迟事件不执行、事件 option 不自动选择、明确制度切换保留和省地块控制。
