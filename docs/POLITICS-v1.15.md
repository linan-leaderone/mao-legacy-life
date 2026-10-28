# 1.15 政治活动权限与巴勒斯坦开局

## 当前身份决定活动范围

`src/political-actors.js` 统一从人物所属地区的当前政务资料判定权限，不使用玩家所在地代替人物管辖范围。`src/personas.js` 只提供已公开阶段，当前月之后的明确覆盖不参与判定。阶段切换保留已知党派依据，但不会因此恢复旧职权。

| 身份依据 | 自主活动范围 |
| --- | --- |
| 当前地区领导或政府首脑 | 政务磋商；会议本身不等于政策已实施 |
| 分裂局势中的所属当局负责人 | 所属当局实际控制地区的事务 |
| 当前地方行政职务 | 权限内的地方公共事务；其他党派议题按党务表述 |
| 议事机构或民意代表 | 提出议案、代表协商与议事程序 |
| 执政党成员、在野党成员 | 党务、公开主张、支持者联系 |
| 民间活动参与者 | 公共表达与组织交流 |
| 礼仪性元首 | 公开礼仪活动 |

现任身份需要与当前地区资料相符。失去执政身份的总统、政府领导、过渡当局主持人和制宪会议主持者，不再沿用原执政头衔。明确标注卸任或已结束任期的地方职务不授予地方行政权限。普通乐队成员与隐藏身份继续遵守原有公开与活动条件。

韩国瑜在现有库的开局阶段是“国民党政治人物”。民进党执政时，生成的报道是“韩国瑜在国民党活动中提出主张”，不称政府实施新安排。MOD 开局选举文本 `localisation/simp_chinese/TFR_country_localisation_CHI_l_simp_chinese.yml:221` 提到其高雄市长身份；现有库没有完整地方任期与卸任排程，本轮继续采用保守的党务身份，不追加现实后续年表。四方分裂或国民党接掌中央政府后，权限再随已发生事实改变。

自主活动保存为 `source: political_actor`，与 `source: focus_policy` 的国策政策分开。`src/policies.js` 只从当前执政势力允许的政策池选取，保留战争、前置、互斥与冷却条件；分裂状态不套用统一政府政策。非中国大陆的自主活动与政策报道使用 `newsroom`，不会再套用描绘人民大会堂的 `politics` 配图。报道的 `pressureRegion` 为活动人物所属地区；引擎仅让中国大陆人物影响中国路线压力。

## 巴勒斯坦社会民主主义

`node scripts/build-country-catalog.mjs` 已重新只读提取相邻 `TFR-xinzuo-rebuild`，生成实际运行文件 `src/data/countries.json`。PAL/PSE 开局展示采用用户指定的“社会民主主义”，不修改 MOD：

| 字段 | 生成值 |
| --- | --- |
| `ideology` / `ideologyId` | 社会民主主义 / `social_democracy` |
| `ideologyGroup` | `social_democrat` |
| `modIdeology` / `modIdeologyId` | 进步主义 / `progressivism` |
| `ideologyAdaptation.id` | `palestine-social-democracy` |
| `ideologyAdaptation.basis` | `user-requested-opening` |

`ideologyAdaptation` 保留原执政组、原本地化名称和原子类型。原始证据包括 `history/countries/PAL - Palestine.txt:112` 的 `set_politics`、`common/characters/TFR_characters_PAL.txt:8` 的领导角色，以及 `localisation/simp_chinese/TFR_ideologies_l_simp_chinese.yml:103` 的 `social_democracy` 名称。`sourceRefs` 保留这些引用和开局覆盖，`sourceFiles` 继续保存全部来源哈希。

`src/countries.js` 只修正与原开局领导、政体及思想完全匹配的自动保存快照；玩家明确指定的覆盖和后续政权思想保留。重新生成资料包含 692 个 TAG、252 项地理身份、187 个开局存在实体和 4,162 个来源文件，提取器报告 0 条语法警告；原有 522 项未确定条件及 4 项未处理效果仍作为审计边界保留。

## 本轮检查边界

按用户要求，仅进行静态源代码与导入关系审查、资料重新生成和后续构建封装。从人物、政治活动、政策和国别模块追踪到 11 个 JavaScript 文件，静态导入图没有循环。没有运行游戏测试脚本、模拟游玩、浏览器验收或真实模型请求。编译封装和交付状态以 `docs/VERIFICATION.md` 为准。
