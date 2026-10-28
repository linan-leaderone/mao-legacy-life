# 弦卷心隐藏档案

新增 `src/data/personas-mod.json` 的 `tsurumaki_kokoro` 档案；既有姓名索引自动读取该数组。没有把她加入 `actors`、随机生活事件、国策抽样或未来事件排程。既有跨地区联络摘要中对她的自动点名改为“支持者”。没有改动 MOD 源文件。

## 官方资料与开局适配

核对日期：2026-10-26。以下来源为作品官网或官方运营网站。

| 资料 | 来源与处理 |
| --- | --- |
| 中文名弦卷心、日文名弦巻こころ、英文名 Kokoro Tsurumaki | [台服角色页](https://www.mobimon.com.tw/bang-dream/character/tsurumaki-kokoro/index.aspx)、[英文官方角色页](https://bang-dream-gbp-en.bushiroad.com/character/hello-happy-world/tsurumaki-kokoro/)。支持两种英文姓名顺序和日文空格写法，未添加单独的“心”或“Kokoro”这类易撞名简称。 |
| Hello, Happy World! 主唱，校园与乐队生活 | [作品官网角色页](https://bang-dream.com/artist/hello-happy-world/tsurumaki-kokoro/)、[官方动画第二季角色页](https://anime.bang-dream.com/2nd/character/hello-happy-world/)。开局是学生与音乐人，不是国家领导人。 |
| 生日 8 月 8 日 | 台服与英文官方角色页都只给月日，没有出生年份。`birthdayMonthDay` 为 `08-08`，`birthDate` 留空，`openingAgeEstimate:16` 仅为本作2020年校园时序适配。 |
| 富裕家庭的独生女 | 台服和英文官方角色页有明确依据。父母不编造姓名、具体职业或近况。富可敌国的家族规模是用户指定的本作适配，不能当成官方精确财产数据。 |
| 好奇、爱尝试、希望别人开心、主动组织表演 | 来自官方人物介绍，改写为简洁的性格与日常动机；未把富裕等同政治意识形态。 |
| 乐队关系 | 官方乐队成员表支持濑田薰、北泽育美、松原花音和奥泽美咲的同伴关系。米歇尔与美咲属于同一个人的表演身份，不在开局关系图再复制一个独立成员。心对该身份的认知差异留在备注。 |

台服角色页读取成功。英文、日文官网和官方动画页的搜索结果可以核对相关内容；直接读取这三个页面时服务返回503，本次没有据此声称获得其完整页面。

初始 `family:10` 对应显著富裕的家庭背景；`funds:50000000` 是本作可调动个人和项目资源的估值，不代表弦卷家总资产或某种官方货币金额。其他能力、影响力和压力同样属于叙事估值。未成年开局保留 `promiscuity:0`。

## MOD 依据与公开时序

| 来源 | 可以支持的内容 | 开局处理 |
| --- | --- | --- |
| `common/characters/TFR_MAO.txt:TSU_xjx` | 同名角色、`technocracy` 领导人意识形态、`gfx/MAOYUANXIN/xjx.png` 参考图。 | 仅记录证据；角色定义中的领导人槽位不意味着2020年已经执政。 |
| `localisation/simp_chinese/replace/_yuzedong_idealeader_l_simp_chinese.yml:TSU_technocracy_desc` | 日本革命后的“闪耀未来主义”，包括公有经济、产业统筹、劳动者再分配、科技与青年参与。 | 保存在 `modLore.laterIdeology`，开局仍为尚无明确政治纲领。 |
| `_yuzedong_event_l_simp_chinese.yml:PRC_MAO5.61.d` | 场地、经费和联络帮助，以及与羽泽鸫等人的革命合作。 | 属于后续 MOD 经历，不建立2020年已完成政治联盟。 |
| `events/TFR_MAO6_EVENT.txt:PRC_MAO6.5.g` | 革命后的胜选选项，前置旗标 `tsu_pol_soc`，效果设 `tsu_pol_kkr`；该选项 `ai_chance.base = 0`。 | 不自动安排胜选，也不因年份推进默认上台。 |
| `common/national_focus/TFR_national_focus_TSU.txt:TSU_TWW_FOCUS_42` | 分支要求 `TSU_xjx` 已是国家领导人；后续政策和财团技术公开受此前提约束。 | 只存来源，不放入开局记忆或普通月度事件。 |
| `_yuzedong_event_l_simp_chinese.yml:PRC_MAO6.50/52/54/56/57` | 财团技术公开、资源重新分配、米歇尔机甲、公共养育和火星设施等分支内容。 | 保留在 `modLore.laterEvents`；不能提前写成普遍可见的2020年现实。 |
| `TSU_TWW_FOCUS_100` | 分支后期的数字民主制度效果。 | 仅存国策来源，不改变开局日本制度。 |

`modLore` 是审计及后续适配资料。现有政治更新代码只消费 `modPolitics`；该角色的 `modPolitics` 只有开局的未知政治纲领和空 `stages`，未把原 MOD 的未来内容投进运行排程。不得将整个 `modLore` 原样送作当前世界事实。

## 出场与头像

精确输入“弦卷心”“弦巻こころ”“Tsurumaki Kokoro”“Kokoro Tsurumaki”等已列别名，可由既有 `findPersona`/`lockPersonaProfile` 机制识别。玩家明确引入或接触她时，既有姓名识别可以使用同一档案身份。`appearancePolicy:explicit-only` 是该档案的约定；实际防止自主抽选的措施是没有新增政治 `actor`，也没有新增随机事件。普通人生的姓名输入框仍无候选名单。

`src/personal-cast.js` 根据本人身份、背景、明确行动和已有接触确定是否允许她出现。未获明确引入时，模型上下文排除相关人物片段，并校验返回正文及新增关系；不能在普通月份自行点名。已允许出场时只发送开局身份与公开关系，不把未来 MOD 经历当作当前事实。

`portraitReference` 只指向原 MOD 的 `gfx/MAOYUANXIN/xjx.png` 和 `TSU_KKR_xiao.png`；`interface/_TFR_HDQ.gfx:GFX_idea_TSU_xjx_hog` 也指向后者的优化版本。未复制、生成或直接展示这些图片。新档案有稳定的隐藏人物ID，既有头像模块会在没有改绘成品时返回缺图状态，不用普通随机像素头像替代她本人。

## 验证边界

本轮按用户明确要求只做联网资料核对、静态代码阅读与文件修改。没有运行测试、游戏脚本模拟、构建或浏览器验收。日期、金额和字段处理以上述来源及静态调用关系为准，未把运行结果写成已经验证。
