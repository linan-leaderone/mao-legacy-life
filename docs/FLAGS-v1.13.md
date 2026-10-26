# 势力旗帜 · 1.13

## 来源与转换

`scripts/build-faction-flags.py` 只读扫描相邻 `TFR-xinzuo-rebuild/gfx/flags`。当前扫描 **6,257** 个源图，按同名旗帜优先标准目录、其次 medium、最后 small，得到 **2,375** 个旗帜标识：标准图 **1,956**、只有 medium 的图 **218**、只有 small 的图 **201**。完整标准图几乎均为原 MOD 的 82×52；不会把 small 放大后伪称完整图。

全部图以 Pillow 转为无损 RGBA PNG，保持像素、透明度与原始尺寸，无重新绘制或内容改动。按像素内容去重后为 **1,696** 张图片、**3,842,353** 字节。`public/flags/` 使用内容哈希文件名，`src/data/faction-flags.json` 保存尺寸、质量层、原始路径及 SHA256、输出 SHA256 和本地化名称。旗帜图案属于原 MOD 素材；格式转换不改变其原有归属。

原图 `GER_uprising_cosmetic.tga` 完全透明，保留来源与资产并标为 `visible=false`。选择器不会显示空白旗，使用该 TAG 的可见基础图作为回退。

先运行国家开局读取，再重建旗帜，可使 TAG 的国家名、地理映射与默认意识形态跟随最终开局覆盖结果：

```powershell
node scripts/build-country-catalog.mjs
python scripts/build-faction-flags.py
node --test tests/faction-flags-v113.test.mjs
```

## 选择与时序

`selectFactionFlag(input)` 接受当前的 `tag`、`controllerTag`、`cosmeticTag`、`ideologyId`、`ideologyGroup`、`ideology`、`government`、`iso`、`region`、`name`、`faction`、`factionId`、`createdByPlayer`。它返回相对路径 `src`、`alt`、`label`、`sourceId`、`sourceTag`、`match`、`confidence`、`adapted`、`description`、`width`、`height`、`quality`；无法定位合理标识时返回 `null`。

- 已公开的 cosmeticTag 优先，并使用当前意识形态的同名变体。
- 实际控制 TAG 优先于地理国家及国家显示名称。ISO 与 HOI4 TAG 分别解析，避免 AUS（澳大利亚/奥地利）与 MAC（澳门/北马其顿）混淆。
- 明确的势力名称能选中该势力，如台湾左翼联盟使用 TZL。一般形容词不会成为身份依据。
- 当前 `factionId` 采用下表已核对的 TAG/cosmetic，避免“日本社会主义共和国”等重复名称误用其他占领时期的同名旗。只有已发生状态可以提供这些 ID。
- 当前中文意识形态优先于旧存档遗留的默认 ideologyId/group。没有同意识形态旗帜时回退该 TAG 的基础旗帜。
- 玩家新建势力按所在地、明确意识形态、政治类别与原图质量评分，分数相同按来源 ID 排序。相同情况始终返回相同图。借用图标记 `adapted=true`、替代文字带“拟用”，保留图案来源说明，不宣称新势力已有真实的官方旗帜。`confidence` 表示匹配分数，不是概率。

完整资源含未来剧情可能用到的旗帜。运行时只根据调用方已确认的当前势力选择一张，不枚举尚未出现的势力，不修改世界状态，也不将完整资源库发送给叙事 API。

## 已发生路线与原作证据

| 当前势力状态 | 使用标识 | 核对依据（相对 MOD） |
| --- | --- | --- |
| 中国泛左翼阵线、中华共和国、数字民主、秦晖执政 | `PRC_GH` | `common/scripted_effects/TEST5.txt:2102–2126` 的 `PRC_lm_war_fight` 在 CHF 作用域设该 cosmetic；`events/TFR_MAO_EVENT.txt:494,619,657` 的共和国选举继续保留该标识 |
| 中华人民公社 | `PRC_AM` | `common/national_focus/TFR_national_focus_PRC_new_left.txt:741–802`，国策 `PRC_the_Flower_of_Freedom_24` 的完成效果 |
| 韩德强正道革命 | `PRC_HACHIMI_FLAG` | `events/TFR_MAO_EVENT.txt:95`，`PRC_MAO.3`；`localisation/simp_chinese/replace/_handeqiang_l_simp_chinese.yml:57` 题名“正道革命” |
| 赛博毛泽东 | `PRC` 基础旗 | `events/TFR_MAO_EVENT.txt:3699` 设置 `PRC_HACHIMI`，源旗帜目录没有同名图，使用 PRC 回退；不得把同前缀的其他韩德强/分支旗当成它 |
| 薄熙来、陈文清、毛远新 | `PRC` 基础旗 | 当前改编所依据的 `PRC_MAO5.30`/`china.432`、`china.535`/`china.543`、`PRC_MAO6.73` 没有切旗效果。`PRC_technocratic_mss` 等仅存在的 cosmetic 素材不能证明这些节点采用它 |
| 日本左翼胜利及重建 | `TSU` | 已有当前势力 ID `japan_left`（兼容 `japan_left_reconstruction`）明确指向 TSU；不通过同名国家猜测占领 cosmetic |
| 日本军政府 | `JAP_military_junta` | `events/TFR_events_JAP.txt:1459,1529` 的切旗效果 |
| 日本统一民主战线共和国 | `JAP_udf` | `events/TFR_events_JAP.txt:1831` 的切旗效果 |
| 台湾左翼胜利后的共和国 | `TZL_SOC` | `events/TFR_MAO3_EVENT.txt:1982–1983` 切旗并发出 `PRC_MAO3.55` 胜利报道 |
| 台湾国民党 / 基进党 | `KMT` / `TJJ` | 与已发生的 `taiwan_kmt/taiwan_revanchist` 当前阵营相符的 TAG，使用各自基础旗 |

新建势力不会因采用这些相似名称就继承对应剧情。显式 `createdByPlayer=true` 仍采用拟用标识匹配，直接指定已有 cosmetic 时保留指定并标为拟用。

## 验证

专用测试逐张校验 PNG 签名、尺寸、输出 SHA256、来源路径及文件大小，检查完整图优先、独有低分辨率图保留、实际控制 TAG、ISO/TAG 歧义、已发生的意识形态变化与新势力稳定匹配。素材扫描和选择器不等于每一个 MOD 事件都已经接入人生模拟；后续势力仍需通过已发生的剧情或玩家行动进入当前世界事实。
