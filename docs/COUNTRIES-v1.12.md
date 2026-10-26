# 全球开局国家资料与动态管治

生成命令：`node scripts/build-country-catalog.mjs`。可用 `--mod=绝对路径` 指定只读 MOD 来源。脚本仅写本项目的 `src/data/countries.json`；不修改原 MOD。

这份资料覆盖 MOD 注册的 **692 个 TAG**及其 **692 个国家历史文件**，根据州历史的开局 `owner` 识别 **186 个开局有领土的实体**。**252 个地理身份**包含 ISO 3166 的国家与地区、科索沃、北塞浦路斯、索马里兰；其中 **161 个地理身份**有可映射的开局 MOD 政权，香港、澳门另沿用本作已有的特区资料，合计 **163 份可显示的开局管治资料**。剩余地区明确保留资料空缺，不能用后续内战 TAG、现实2026年的政府或邻国政府填充。

读取范围共 **3,809 个文件**：`common/country_tags`、`history/countries`、`history/states`、`common/characters`、`common/ideas`、`common/ideologies`、`common/national_focus`、`common/on_actions`、`common/bookmarks`及全部语言本地化。实际采用简体中文优先、`replace` 优先、英文补缺；每份来源记录相对路径与 SHA-256，字段证据包含原文件行号。基准日期由书签确定为 **2020-01-01**。

## 内容和边界

- 可查询国家名、MOD TAG、国家元首、政府首脑、政体、执政党、思想分支、政党支持度、首都所在 MOD 州、初始稳定度、战争支持度、经济体制、国家精神及开局选中的国策树。
- 国家元首与政府首脑分列。例如日本为德仁天皇与安倍晋三，英国为伊丽莎白二世与鲍里斯·约翰逊，德国为施泰因迈尔与默克尔。`head_minister` 在美国对应副总统，展示时美国政府首脑仍为总统。
- 中国大陆、台湾、日本沿用用户明确指定的既有政治口径；原始 MOD 角色、思想 ID 与证据仍保留。香港与澳门在本 MOD 中没有独立开局国家 TAG，本作特区资料不会写成独立 MOD 国家。
- `startingStatus: active` 表示该 TAG 在 MOD 州历史中有开局领土，`not-present` 表示没有。无开局领土的未来势力仍保留在 TAG 数据库，供后续明确激活时查询，不参与当前国家政府选择。
- 现实国家与 MOD TAG 使用显式映射。`AST → AUS` 为澳大利亚，`AUS → AUT` 为奥地利；`MAC → MKD` 为北马其顿，现实 `MAC` 为澳门；波兰选用实际占有开局州的 `PLD`。阿富汗、利比亚等地区的武装参与者另列在 `openingTags`，不会因领土数量较大就覆盖主要开局政府。
- 首都使用 MOD 州标识和本地化州名，是 MOD 政治资料的定位依据，不是县级地理坐标。州数量与现实行政区数量不同。
- 只执行明确国家作用域、可判定 TAG/政体/旗标条件和有限直接效果；无法判定的条件不会执行。定时事件、随机分支、动态脚本、玩家国家视角及愚人节开关不作为普通开局事实。开局国策选择采用最高确定权重，专属树存在时不再并列通用树。
- 朝鲜、越南的角色思想分支与当前执政组不一致时，选用国家历史首次招募且有国家领导角色的明确人物，标记 `leaderResolution: first-recruited-role`。没有把候选人名单中的后继人物任选为现任。
- 国家精神是开局元数据，不会被自动重复作为每月政策实施，也不会直接使外国人物受到当地灾害、拘押或行政管制。

## 运行端接口

`src/countries.js` 不依赖引擎、地区叙事或地理模块，避免循环依赖。

| 接口 | 返回 |
| --- | --- |
| `resolveCountry(query)` | 国家 ISO 身份、区域 ID、名称与别名；不存在或歧义不匹配 |
| `countryByTag(tag)` | 指定 MOD TAG 的独立记录，包含是否开局存在 |
| `countryByIso(iso, state?)` | 与 `getCountryContext` 相同的当前资料 |
| `getCountryContext(state, iso)` | 当前国家资料及永远不被动态覆盖的 `baseline` |

地区键沿用 `china/taiwan/japan/korea/hongkong/macau`，其他为 ISO3 小写。`KOS`、`SDS` 等旧地图编码兼容到 `XKX`、`SSD`。支持国家中英文名及 ISO2/ISO3；MOD TAG 应优先使用 `countryByTag`，避免与 ISO 同名歧义。

动态优先级为：开局资料 → `worldState[region]` → `worldOverrides[region]`。后两者只接收当前年月已发生的条目。战争字段保留显式 `null` 停火，`lastingPeace` 优先。开局时代之前的穿越不继承2020年的领导、思想或国家精神；明确的穿越后政治结果仍可覆盖未知历史背景。

`baseline` 供地图折叠的“2020年开局资料”使用；地图主要管治面板应使用当前 `regionContext/deriveTerritorySituation`，避免再出现左翼胜利后仍显示民进党思想的错配。新政权没有交代执政党或其他职位时留空，不保留原政府的人员名单。

## 验证

`node --test tests/countries-v112.test.mjs` 覆盖 TAG 全量、开局存在性、ISO/TAG 冲突、未来势力排除、主要国家资料、港澳基线、动态政府优先、2020年前穿越、显式停火、不可变查询与来源约束。测试不表示完整执行了 HOI4 运行逻辑，也不表示没有原始 MOD 资料的国家已经补齐政府履历。
