# 所在地与新闻影响

`src/regions.js` 不依赖引擎，也不读取所选隐藏分支。所在地以 `state.location` 为准，出生地不会覆盖迁居后的制度与生活背景。它接受大陆 31 省级地区、泛称“中国大陆”、台湾、日本、香港、澳门、韩国及主要城市别名；“中国大陆”的 `province` 为 `null`，不会猜测公众人物的具体住址。韩国用于人物已知的居住背景，不自动增加随机出生点。

## 接口

- `backgroundsFor(place)`：保留七个稳定 id 和原经济初值，按所在地返回家庭名称与文字。台湾是“公职家庭”，日本是“公務員家庭”，港澳韩是“公务员家庭”。研究、劳动、乡镇及经商家庭也分别改写；职业本身不等于党派、政治忠诚或实际权力。
- `regionContext(state,lore)`：返回 `region/province/location/label`、当前 `government/leader/stage/institutions/terms/forbiddenAssumptions`、`institutionState`、`conflict/regionalConflict/pandemic` 和 `dailyContext/plainLocalDescription/localDetails/industry/pressures/knownChanges`。`dailyContext` 可用于个人叙事，制度约束是叙事输入，不能直接作为人物独白显示。
- `newsExposure(state,event)`：返回 `level/factor/effectText`，仅决定首次结算的生活影响。`factor` 范围 0–1.5；读到新闻不意味着本人参加事件，也不消耗行动。
- `culturalContext(state,query)`：见 `MEME-SOURCES.md`。

## 地方差异与资料边界

`regions.json` 的 31 省分别保存产业环境、城市生活、生活开支与服务难点、乡村环境、相邻地区和抗议影响系数。北京的公共服务与通勤、天津港区与城区距离、河北的环京县城与重工业、长三角制造及外贸、东北工业与冬季交通、河南物流与粮食、湖北科教水运、福建海峡航运、广东厂区与租住、海南旅游季节、高原长距离公共服务等均采用不同材料；不是只替换省名的一句模板。

地理和已有产业以[中国政府网国情](https://big5.www.gov.cn/gate/big5/www.gov.cn/guoqing/index.htm)、[国家统计局《中国统计年鉴2020》](https://www.stats.gov.cn/zs/tjwh/tjkw/tjzl/202302/t20230215_1907951.html)所涵盖的 2019 年经济社会分类，以及[商务部省区概览](https://fdi.mofcom.gov.cn/come-newzonghe.html?Liindex=2&comeID=8&parentId=161)作参考。商务部后期资料只用于核对长期地理和既有产业，不把后期新增规划、数字或设施倒放到 2020 年。通勤、家庭讨论与日常场景属于这些背景上的原创写作素材，不是对每位居民的调查结论；没有设定民族、省份对应的性格或立场。参数是叙事模型设计，不是现实灾损或政治参与率统计。

非大陆制度分别以[台湾总统府宪法资料](https://english.president.gov.tw/Page/94)、[日本参议院国会与内阁关系](https://www.sangiin.go.jp/eng/guide/relation/)、[香港基本法第四章](https://www.basiclaw.gov.hk/en/basiclaw/chapter4.html)、[澳门年鉴2020](https://yearbook.gcs.gov.mo/uploads/yearbook_pdf/2020/myb2020e.pdf)、[韩国政府制度介绍](https://www.korea.net/Government/Constitution-and-Government/Executive-Legislature-and-Judiciary)为起点。港铁/屋邨、公车/里办公室、电车/市役所、澳门口岸/街坊会等作为不同地区的生活词汇，不互相套用；制度发生变化后用已发生的故事公告更新。

开局人物是 2020 年初的历史基线，不代表现实今天的任职。台湾连任事实以本项目 MOD 事件 `world_opening` 为依据；香港任职可核对[2020年行政长官公开信](https://www.info.gov.hk/gia/general/202005/29/P2020052800745.htm)，澳门任职可核对上述年鉴，文在寅的 2020 年任职与讲话可核对[日本外务省2020外交蓝皮书](https://www.mofa.go.jp/policy/other/bluebook/2020/html/chapter2/c020102.html)。真实世界之后的换届不按日历自动插入架空历史。

## 已发生的政局

`knownEvents` 仅采纳 `newsHistory.month <= state.month` 的已读报道，以及 `seenEvents/seenNews/current.majorId` 中已经发生的事件。事件时间优先取 `eventMonths`，无实际时间时再取原事件最早月。读取 `lore.routes` 仅为了构造全部事件 id 的资料索引，没有读取 `state.routes`，不会从已选结局推断当前社会。

中国更新包括张又侠过渡、陈文清、胡春华、韩德强、张宏良、李克强、汪洋、薄熙来、王沪宁、毛远新、中华共和国、公社、秦晖、内战及终局领导。台湾四方内战结束后分别采用左翼共和国、民进党战后管治、国民党军政临时政府或基进党复仇主义体制。日本分别采用旧议会、联合政府、军事管治、民主战线、羽泽鸫左翼重建或丰川安全体制；羽泽鸫胜利后的制度争议不会被提前写成已经选定的最终宪法。事件依据是 `src/data/lore.json`，原文定位见 `LORE-SOURCES.md`。

## 暴露层次

| 报道 | 当地 | 周边或关联地区 | 不相关地区 |
| --- | --- | --- | --- |
| 河南洪灾 | 河南 1.5 | 邻省 0.3 | 其他大陆 0.04；港澳台日韩 0 |
| 大陆防控失序与游行 | 大陆按省 0.6–1.2 | 不直接复制到境外或特别行政区 | 港澳台日韩 0 |
| 湖北早期疫情报道 | 湖北早期 1.5 | 大陆邻省 0.25 | 其他大陆 0.08；港澳台日韩 0 |
| 台海战争 | 台湾 1.5 | 大陆近海 1.2、其他大陆 0.65、日本 0.6 | 港澳韩较低间接影响 |
| 台湾或日本内战 | 当地 1.5 | 另一地 0.3、大陆 0.18 | 更低间接影响 |
| 大亚洲战争 | 中日台 1.25 | 港澳韩 0.65 | 其他地区 0.25 |

2020 年开局的混合报道分别解释为大陆疫情影响、台湾选举与当地防疫、日本或港澳韩自己的卫生安排；不会让大陆居民参与台湾选举，也不把地方防疫等同于大陆封控。没有 `places/region` 的已知大陆新闻通过明确 id 识别，不会因为引擎的 `global` 默认值变成全球同等伤害。

独立断言已检查 31 省文案不同、七类背景完整、香港与泛称大陆识别、台日战后机构更新、未到期事件不生效、洪灾地域层次和未来网络词条不提前出现。主引擎仍负责家境调节、属性结算和仅结算一次。
