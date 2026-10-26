# 世界地图与地方管治

地图是当前已知局势的只读视图。使用真实行政边界；不会把 HOI4 的州或地图地块称作现实县。拖动、滚轮和双指缩放均可用，点击多边形可查看实际管治、政治取向、战事及资料年份。搜索支持本地名称，中文简繁等价；同名县区没有足够上级地区信息时不擅自选择。

## 离线地理范围

世界底图使用 Natural Earth 1:110m 的177个国家、地区多边形。小岛国不保证全部出现在这个比例尺中。亚洲边界来自 geoBoundaries 的简化 GeoJSON，各地实际行政层级分别保留：

| 地区 | 本包实际单元 | 层级 | 边界参考年份 |
|---|---:|---|---|
| 中国大陆 | 2,864 | ADM3，县、市、区；另有31省级轮廓 | 2017 |
| 台湾 | 368 | ADM2，乡镇、市、区 | 2017 |
| 日本 | 1,742 | ADM2，市町村等地方单位 | 2017 |
| 韩国 | 228 | ADM2，市、郡、区 | 2020 |
| 朝鲜 | 179 | ADM2，市、郡 | 以来源元数据为准 |
| 蒙古 | 339 | ADM2，苏木、区 | 同上 |
| 越南 | 708 | ADM2，县、郡、县级市 | 同上 |
| 泰国 | 928 | ADM2，县、区 | 同上 |
| 印度 | 735 | ADM2，县 | 同上 |
| 巴基斯坦 | 126 | ADM2，县 | 同上 |
| 缅甸 | 74 | ADM2，专区 | 同上 |
| 印度尼西亚 | 519 | ADM2，县、市 | 同上 |
| 菲律宾 | 87 | ADM2，省及独立城市 | 同上 |
| 香港、澳门 | 各1 | 特区整体轮廓，尚无区级细分 | 2017 |

本包共9,107个可查询单元，包括177个世界轮廓、8,897个亚洲细分单元、31个大陆省级轮廓、2个特区轮廓。geoBoundaries API 的 `admUnitCount` 与其简化文件有少量差别；表中数字按真实读取的 Feature 数统计，没有把已缺失的简化单元计作可用。

为方便中文、日文、韩文查询，GeoNames 的行政点与对应行政多边形做空间匹配，并优先要求罗马化名称一致。多个候选、没有明确匹配时保留上游英文名。获得本地名称4,882个：大陆2,717、日本1,576、台湾368、韩国221。名称来自2026年10月26日下载的 GeoNames，仅用于标签，不把较新的名称资料当作边界已更新。

## 来源、许可与加工

- [geoBoundaries API](https://www.geoboundaries.org/api.html)与[原始数据库](https://github.com/wmgeolab/geoBoundaries)。API下载地址锁定其实际返回的 `9469f09` 数据版本。每层的下载地址、年份、原始SHA-256、原始计数及许可保存在 `public/maps/sources.json`。
- [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/)地理数据为 Public Domain。世界层保留下载SHA-256。
- [GeoNames](https://download.geonames.org/export/dump/)名称数据为 CC BY 4.0。
- geoBoundaries各层源许可分别保留，不能一概改称CC BY。中国大陆细分层为Open Database License 1.0；日本、台湾的元数据标为CC BY-SA 2.0，来源为OpenStreetMap/Wambacher；韩国为CC BY 3.0。OSM来源同时注明© OpenStreetMap contributors及[ODbL](https://www.openstreetmap.org/copyright)。其他层许可见来源清单。

这些地图数据库和加工后的JSON保留原有数据许可，与游戏源码分开。公开源码同时提供全部加工数据和再构建脚本。数据来自行政资料原来的边界表达，不以颜色或图层表达现实领土主张；颜色只表示当前架空叙事内已经确认的实际管治。

`scripts/build-world-geography.py`使用Python 3和Shapely。执行前安装`shapely`，然后运行该脚本。原始下载放`.cache/geography`，不进入发布源码。保留岛屿、孔洞与有效多边形，以0.0025度容差作简化，再按1/10000度量化及差分编码。整体资产约9.1 MB，世界与亚洲分层延迟加载，可被PWA缓存离线使用。不是导航精度或最新行政区划数据库。

## MOD核对

只读查看了相邻MOD的 `map/definition.csv`、`map/provinces.bmp`、`history/states`、`events/TFR_events_CHI.txt`、`events/TFR_events_JAP.txt`以及TSU/TZL的国策与on_actions。MOD台湾战略州使用1148台北、1149台中、1150台南、524台湾；日本存在1332东京等战略州。脚本中的`transfer_state`是战略州转移，与本图县区没有一一对应的现实编码。不能根据这些数字宣称整县已被某方占领。

宏观内战发生而地方控制缺失时，地图显示“各方争夺，地方管治待确认”。已明确出现的胜利、制度变更由 `regionContext` 和 `factionId` 更新整体管治。详细控制权只接受已经提交的地方行动记录，地图不抽签分配胜者，也不凭查看操作写存档。

现有欧陆战争和大亚洲战争通报没有列出完整国别参战清单，所以不会把整洲所有国家都标成参战方。当前地区环境明确记载的参战地区与玩家明确指定的国家、势力战争记录会显示。没有可靠参战身份的第三国保持未知，不因距离近而被自动宣战。接管地方后，已识别的新控制方使用其本身意识形态；未知势力显示地方制度尚待确认，不继承原政权标签。

## 接入契约

`src/world-territories.js`提供：

- `resolveTerritoryTargets(text, {region?})`：返回明确地理单元，字段包括`id,name,region,country,level,parent,center,bounds`。
- `deriveTerritorySituation(state, featureOrId, lore, prepared?)`：返回管治、制度、战争、前线与影响程度。
- `territoryExposure(state, location, lore)`：供人生月度结算读取同一套局势；自身不扣属性或推进时间。
- `createTerritoryContext(state,lore)`：一次构造地图批量查询所用地区与势力战事事实。

存档`territoryOverrides`支持`country:CHN`、`region:china`、`province:河南`及具体地方ID，优先级从宽到细。每项可含`controller,controllerId,conflict,frontline,month,source`。`factionConflicts[controllerId]`是战争说明或显式`null`停火，保证一个势力在其他地区新获得的控制区也受参战影响。地方战争影响为0、0.45、1三级，确认交战地区更强；参战后方不自动写成当地发生战斗。`lastingPeace`强制清除旧战时显示。

`mountWorldMap(host,state,lore)`返回`{update,destroy}`。视图关闭必须`destroy()`，以取消尚未完成的载入、断开ResizeObserver与输入事件。读图、缩放、查询不会改变游戏状态。

## 验证

`tests/world-territories.test.mjs`覆盖实际边界数量、全部编码多边形闭合、标签与歧义、政权更替及旧意识形态修复、分层控制覆盖、跨区势力参战影响、停火、前线区分和视图投影不修改原档。浏览器与整包验证由本轮主发布记录单独记载。
