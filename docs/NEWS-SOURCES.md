# 新闻来源与改编说明

`src/data/news.json` 包含16条新闻。它们是世界中的报道，不附个人行动选项；阅读新闻不推进月份。`places` 用于限定直接生活影响的地区，新闻本身仍可由其他地区的人阅读。`impact` 为小幅民生影响，不预设每个读者都亲历新闻。

所有路径相对于 `TFR-xinzuo-rebuild`。内容是 MOD 叙事的重写或精简，不能当作现实事件资料集；尤其不得将 MOD 的虚构政治行为、未证实指控和人物台词当作现实新闻。这里只记录创作来源，不把来源说明放进人物的日常叙述。

| 新闻 ID | 安排时间 | 本地化键 | 改编说明 |
| --- | --- | --- | --- |
| `news_palace` | 2020年1月 | `_jinxianqian_l_simp_chinese.yml → PRC_MAO2.35.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_wuhan` | 2020年3月 | `_jinxianqian_l_simp_chinese.yml → china.74.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_mourning` | 2020年4月 | `TFR_country_localisation_PRC_l_simp_chinese.yml → china.75.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_taiwan_manufacturing` | 2020年9月 | `_tzl_l_simp_chinese.yml → taiwan_temp_skeleton.5.d` | 依据国策后续本地化安排在2020年9月；原模组并无该固定月份。 |
| `news_green_energy` | 2020年11月 | `_tzl_l_simp_chinese.yml → taiwan_temp_skeleton.7.d` | 将绿能国策改编为2020年11月政策新闻，地方生活影响为改编。 |
| `news_school_pressure` | 2021年4月 | `_jinxianqian_l_simp_chinese.yml → PRC_MAO2.34.d` | 取原文本的学业与健康冲突，未搬用原文全面放开后的背景，月份为适配安排。 |
| `news_zhengzhou_flood` | 2021年7月 | `_jinxianqian_l_simp_chinese.yml → PRC_MAO2.38.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_panda` | 2021年7月 | `TFR_country_localisation_PRC_l_simp_chinese.yml → china.76.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_fuel` | 2021年9月 | `TFR_country_localisation_PRC_l_simp_chinese.yml → china.11.d` | 提炼燃油短缺的民生后果，不强行引入尚未排程的沙特内战。 |
| `news_rationing` | 2021年11月 | `_jinxianqian_l_simp_chinese.yml → PRC_MAO.51.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_blackout` | 2021年12月 | `_jinxianqian_l_simp_chinese.yml → PRC_MAO2.37.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_dong` | 2022年2月 | `_jinxianqian_l_simp_chinese.yml → PRC_MAO2.36.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_supply_scandal` | 2022年3月 | `_jinxianqian_l_simp_chinese.yml → PRC_MAO.48.d`；`_jinxianqian_l_simp_chinese.yml → PRC_MAO.50.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_banks` | 2022年4月 | `TFR_country_localisation_PRC_l_simp_chinese.yml → china.317.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_export_factory` | 2022年5月 | `_jinxianqian_l_simp_chinese.yml → china.237.d` | 精简并重写本地化，保留公众可观察的事情与生活影响；不沿用原文中未证实的细节指控。 |
| `news_bank_petition` | 2022年7月 | `_jinxianqian_l_simp_chinese.yml → PRC_MAO2.39.d` | 保留储户遭遇与问责诉求，省略原文未核实的细节性指控；月份按2022年7月安排。 |

故宫奔驰与董志民均有直接条目：`_jinxianqian_l_simp_chinese.yml: PRC_MAO2.35.d` 与 `.36.d`。董志民原文明确写“2022年初”，安排在2022年2月；故宫原文为冬日，按2020年1月安排。原事件脚本均为 `is_triggered_only = yes`，本作月度日历并不等于原脚本的固定日期。

郑州洪灾与大熊猫保护消息均安排在2021年7月，与防控大游行同月；世界新闻应同时存在，不应挤掉个人生活或者把其中一条挪至下一月。配给、物资丑闻与宁波厂主公开信要求 `world_strait_war` 已发生；后续储户新闻要求 `news_banks` 已发生。

图像映射：

| art | 原脚本 / sprite | 图像文件 |
| --- | --- | --- |
| `school` | `events/TFR_MAO2_EVENT.txt: PRC_MAO2.34` / `interface/_TFR_mao1.gfx: GFX_PRC_MAO2_event_35` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_35.png.dds` |
| `palace` | `events/TFR_MAO2_EVENT.txt: PRC_MAO2.35` / `interface/_TFR_mao1.gfx: GFX_PRC_MAO2_event_36` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_36.png.dds` |
| `dong` | `events/TFR_MAO2_EVENT.txt: PRC_MAO2.36` / `interface/_TFR_mao1.gfx: GFX_PRC_MAO2_event_37` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_37.png.dds` |
| `blackout` | `events/TFR_MAO2_EVENT.txt: PRC_MAO2.37` / `interface/_TFR_mao1.gfx: GFX_PRC_MAO2_event_38` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_38.png.dds` |
| `flood` | `events/TFR_MAO2_EVENT.txt: PRC_MAO2.38` / `interface/_TFR_mao1.gfx: GFX_PRC_MAO2_event_39` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_39.png.dds` |
| `bank` | `events/TFR_MAO2_EVENT.txt: PRC_MAO2.39` / `interface/_TFR_mao1.gfx: GFX_PRC_MAO2_event_40` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_40.png.dds` |

其他报道使用 `pandemic`、`economy`、`science`、`social` 等主题插图。原图与转换记录见 [ART-SOURCES.md](ART-SOURCES.md)。画框统一为16:9，原图保留，不拉伸人物或破坏原始构图。

校验：201组不同的 `sourceRefs` 文件与键均在只读 MOD 内找到；新增每条新闻有图片键，新增每条台日分支有因果前置及相对月份。台湾非左翼的完整胜利后续在模组中不足，本版已明确作改编标记，没有伪造对应的本地化胜利事件。
