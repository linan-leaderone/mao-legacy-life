# 2020 开局控制区与现实行政单位

`src/opening-control.js` 提供 MOD 开局控制基线。`world-territories`、地区叙事和出生地选择共用此结果；玩家已经造成的领土、战争、领导和制度变化由运行端优先覆盖。控制归属与地图资料的地理身份分开，例如克里米亚的原始行政数据仍以 UKR 编码，开局控制者是 SOV，控制方的国家背景是 RUS。

## 数据链

1. 先执行 `node scripts/build-country-catalog.mjs`。该脚本按顺序处理国家 history、跨 TAG 效果、州 history 和开局作用域，输出最终 `openingStates` 与 `openingWars`。
2. 再执行 `python scripts/build-opening-control.py`。需要 numpy、Pillow、shapely。MOD 只读，脚本不会改动原文件。
3. 在真实行政多边形内采样，结合 MOD `map/definition.csv`、`provinces.bmp`、`unitstacks.txt` 和城市本地化建立控制对应。城市经纬度来自 [GeoNames cities15000](https://download.geonames.org/export/dump/)，许可 CC BY 4.0，下载内容缓存在 `.cache/geography/`，不发布原始下载包。
4. 结果写入 `src/data/opening-control.json`，附输入文件哈希、参考城市、被剔除的参考点、MOD 州及原文行号。政权资料直接查询最终 `countries.json`，不会复制旧版本政体覆盖新版本结果。

本次结果包含 187 个实际存在的开局势力、2,566 个单独校对或投影的省县单位，其中 1,274 个可识别主控方、1,292 个混合控制或对应不确定单位；182 个命名城市作为地理参考点。普通统一国家使用最终国家开局基线。县界本身不变，MOD 州和战略省份不作为新行政区。

## 已处理的具体问题

- 州 137 的克里米亚和塞瓦斯托波尔归 SOV 控制，真实行政区的全部现有下属单位继承该控制基线。没有把它们改成现在才发生的战事。
- 叙利亚区分 SYR、HTS、ROJ、TUR 与戈兰的 ISR 控制。FSA 没有开局领土，不会仅因 TAG 存在就占有整个叙利亚。哈塞克、伊德利卜等行政座席保留命名城市所证明的控制方。
- 也门区分 YEM、HOU、AAS，并保留州 919、923 的战略省份控制覆盖。阿富汗区分 AFG、TAL，保留多个州内双方交错控制。
- `ZZZ - Anarchy.txt` 将州 1374 转给 BYA，并使 DPR 对 BYA 开战；该覆盖继续进入马里乌波尔附近的控制对应。BYA 的出生地点由控制地理范围识别为乌克兰，不按旧 TAG 名称误放俄罗斯。
- 利比亚、索马里、伊拉克、格鲁吉亚、摩尔多瓦、缅甸、阿塞拜疆、黎巴嫩和比利时的多方控制均纳入对应。中非卡加班多罗有明确命名地区对应，其他缺乏足够参考点的中非地区不伪造精确战线。
- 北塞浦路斯凯里尼亚使用 TUR 控制；尼科西亚和法马古斯塔行政界跨南北双方，保留混合。布鲁塞尔可用地理数据大于 MOD 的欧洲区，不将整座城市独占给 BRS。

## 精度和战争语义

MOD 地图会压缩、位移城市及海岸，现有行政资料与 MOD 战略格也不一一对应。投影在行政多边形内采样，并围绕拟合误差留出邻近样本；多方占有、低覆盖或较大偏差返回 `uncertain:true`，没有唯一 `controllerTag`。`mixedControllers` 罗列实际可能控制方，比例仅表示对应样本份额，不能解释为精确占领面积或统计测量。

`seatTag` 只证明命名行政座席落入的 MOD 城市属于该方，不能据此把整个大县独占给该方。出生地可以列入多方控制区，并明确显示范围混合。没有足够命名参考点的地区保持缺口。

`openingWars` 目前有 8 组直接声明的战争，双方各自控制地区均受战争背景影响。仅知道势力参战时 `frontline` 始终为 false；查看地图不会自动宣布所有县都正在发生战斗。叙利亚割据本身也不自动增加原 MOD 未声明的战争。

## 运行接口

- `openingFactions`：每方的 TAG、显示名称、控制方国家、领导、制度、意识形态、明确控制单位、可能控制单位、对手和原文来源。
- `getOpeningFaction(tagOrId)`：接受 `TAL` 或 `faction:TAL`。
- `openingFactionsForCountry(ISO)`：列出该地理国家的开局控制者，包括外国控制区。
- `openingControlForUnit(unitOrId,{month,scenario})`：返回单个行政区的基线；负月份返回 null，避免将 2020 控制图套到穿越之前。
- `openingFactionUnits(tagOrId,{includePossible})`：返回控制区和供逐级选择展示的真实祖先节点。祖先节点只是导航，不表示势力控制整个上级单位。

本模块只读。地区和世界覆盖、停火、玩家迁居与时间线变更由调用方应用，读取地图不写存档。针对测试位于 `tests/opening-control-v113.test.mjs`，覆盖克里米亚、叙利亚、也门、阿富汗、BYA 后续覆盖、塞浦路斯、布鲁塞尔和穿越到 2020 之前的隔离。
