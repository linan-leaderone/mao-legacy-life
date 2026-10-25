# 剧情插图来源

这七张图片均来自用户提供的 `TFR-xinzuo-rebuild`，保留原构图，以 Pillow 转为 WebP（quality=90）。没有从参考网页复制图片或代码。路径以下述 MOD 根目录为基准：

`D:/Users/ROG/Documents/GitHub/TFR-xinzuo-rebuild`

| 游戏图片 | 原素材 | MOD 映射依据 | 用途与说明 |
| --- | --- | --- | --- |
| `public/art/cover.webp` | `gfx/optimized_ui/loadingscreens/main_menu.dds.dds` | `interface/frontendmainviewbg.gfx:4`，`GFX_frontend_bg` | MOD 原主界面背景，1600×1200 |
| `public/art/strait.webp` | `gfx/super_events/super_invasion_of_taiwan.dds` | `interface/TFR_Super_Events.gfx:180`，`GFX_super_invasion_of_taiwan` | 台海战争原超级事件图，982×594 |
| `public/art/japan.webp` | `gfx/super_events/super_japanese_civil_war.dds` | `interface/TFR_Super_Events.gfx:476`，`GFX_super_JAP_japanese_civil_war` | 日本内战原超级事件图，982×594 |
| `public/art/zombie.webp` | `gfx/MAOYUANXIN/super_shwj.dds` | `interface/_TFR_mao.gfx:686`，`GFX_super_shwj` | 丧尸危机原超级事件图，982×594 |
| `public/art/longmarch.webp` | `gfx/super_events/super_loji_victory.dds` | `interface/TFR_Super_Events.gfx:617`，`GFX_super_loji_victory` | 原长征机路线胜利图，用作 AI 路线主题插图；不是“诞生”事件专属原图，982×594 |
| `public/art/europe.webp` | `gfx/super_events/super_european_war.dds` | `interface/TFR_Super_Events.gfx:490`，`GFX_super_european_war` | 欧陆战争原超级事件图，982×594 |
| `public/art/asia.webp` | `gfx/super_events/super_great_asian_war.dds` | `interface/TFR_Super_Events.gfx:557`，`GFX_super_great_asian_war` | 大亚洲战争原超级事件图，982×594 |

`interface/eventpictures.gfx:1009` 中的 `gfx/event_pictures/report_event_long_march.dds` 在当前 MOD 文件夹中缺失，因此没有使用该缺失引用。长征机图使用同路线的现有象征画面，保留真实来源，不声称它是特定事件的原插图。

## 校验

2026-10-24 完成主界面原尺寸查看及六张事件图拼图查看，七张图片各不相同，未作裁切、镜像或重绘。六张事件图显示内容依次为海陆空军、城市冲突、感染者、红色代码与日出、欧洲军队、海上舰队。图片合计约 1.25 MiB。

| 文件 | SHA-256 |
| --- | --- |
| `cover.webp` | `a3aa90c6ade9a0712ffccdf93fd1706fac468b350dc3514049378a27b76904cd` |
| `strait.webp` | `6c1dc835703a78356307fda4a8108d15aec6c94fc2683e242364fe84b351004a` |
| `japan.webp` | `bdc5a87d7003e99a5a00bffdf6a0581031b5cd26250a92df315ba87481bc6e63` |
| `zombie.webp` | `46ead01069fa26d6217ec0ed5b9a04929e9f169d6a13254839c29f413d1e6198` |
| `longmarch.webp` | `1ed233f729abfb5962764d3362f57fbb70b1e046498781aa55d0eecfa82d1943` |
| `europe.webp` | `515cf59e1d3590d26fa4dc3e1ca71402cf29bbc44c15be57519f2dc57eee19da` |
| `asia.webp` | `2c8a1bd968bbbcfeaad6fa2ee2814f509dda23341f9b1088860752fa96c22cf1` |

原素材归属沿用 MOD 自身来源；本项目的程序许可不自动改变这些素材的许可。

## 参考网页的交互概念

2026-10-24 读取了 [AI 人生重开手帐](https://re.maa-ai.com/) 的 HTML 与公开前端脚本，未复制实现。可确认其流程为选择世界线、选择或自由描述身份、分配属性、进入人生叙事和决策，提供自动存档、继续翻页、人生总结及重开。其页面以约 460px 的移动阅读宽度为主，采用纸张与手帐视觉。

本项目借鉴“人物设定 → 事件阅读 → 玩家选择 → 历史回看”的交互概念，以用户要求的一回合一月、现实政治科幻路线和自主输入行动为本项目规则。

## Android 1.1 图标

依据用户第二张上传图（绿帽角色与挥手剪影）通过 imagegen 生成，保存为 `android/res/drawable-nodpi/launcher_art.png`。生成要求：方形安卓启动器图标，保留原图两个人物的布局、黄色到红色渐变、世界地图和扫描线；重新组织为居中构图，主体在圆形遮罩内可辨；不添加文字。原生成文件保留于用户本机 `.codex/generated_images`。自适应图标的内缩由 Android XML 实现。

## 1.2 新闻与地区事件配图

2026-10-24 新增以下 17 张本地 WebP，均直接从 MOD 的 PNG/DDS 素材转换，quality=90；不改绘内容，不增加文字，不在文件中裁切。新闻与大事卡片统一采用 **16:9** 显示框，以 `object-fit: cover` 适配原图；原始素材保留完整构图。前七张为明确主题的通用配图，不能视为每篇新闻的现场照片；后十张对应 MOD 的原事件素材。

| 图片键（`public/art/*.webp`） | MOD 原文件 | 映射及用途 |
| --- | --- | --- |
| `newsroom` | `gfx/event_pictures/PRC_grandpa_reads_newspaper.png` | 读报场景，新闻栏通用；同名优化素材映射见 `interface/TFR_event_pictures.gfx:9825` |
| `pandemic` | `gfx/event_pictures/Generic_COVID1.png` | 防护服医护人员，疫情通用；映射 `TFR_event_pictures.gfx:4290` |
| `protest` | `gfx/event_pictures/PRC_protest.png` | 街头集会，游行通用；映射 `TFR_event_pictures.gfx:9561` |
| `politics` | `gfx/event_pictures/prc_national_peoples_congress.png` | 人民大会堂，政治会议通用；映射 `TFR_event_pictures.gfx:8605` |
| `economy` | `gfx/event_pictures/PRC_factory.png` | 工厂生产线，经济通用；映射 `TFR_event_pictures.gfx:9409` |
| `science` | `gfx/event_pictures/PRC_chinese_academy_of_sciences_event.png` | 科学院建筑，科研通用；映射 `TFR_event_pictures.gfx:10345` |
| `social` | `gfx/event_pictures/PRC_chinese_old_street.png` | 城市老街，社会新闻通用；映射 `TFR_event_pictures.gfx:9869` |
| `palace` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_36.png.dds` | 故宫奔驰事件 `PRC_MAO2.35`；`interface/_TFR_mao1.gfx:432` |
| `dong` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_37.png.dds` | 董志民事件 `PRC_MAO2.36`，保留 MOD 非血腥新闻拼图；`_TFR_mao1.gfx:437` |
| `school` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_35.png.dds` | 学校新闻 `PRC_MAO2.34`；`_TFR_mao1.gfx:427` |
| `blackout` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_38.png.dds` | 限电新闻 `PRC_MAO2.37`；`_TFR_mao1.gfx:442` |
| `flood` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_39.png.dds` | 郑州洪灾 `PRC_MAO2.38`，原图为社交媒体求助文字；`_TFR_mao1.gfx:447` |
| `bank` | `gfx/optimized_ui/MAOYUANXIN/PRC_MAO2_event_40.png.dds` | 银行储户新闻 `PRC_MAO2.39`；`_TFR_mao1.gfx:452` |
| `taiwan-civil` | `gfx/optimized_ui_round3/MAOYUANXIN/PRC_MAO3_event_54.png.dds` | 台湾内战 `PRC_MAO3.54`；`interface/QHEND.gfx:290` |
| `taiwan-left` | `gfx/optimized_ui_round3/MAOYUANXIN/PRC_MAO3_event_55.png.dds` | 台湾左翼胜利 `PRC_MAO3.55`；`QHEND.gfx:295` |
| `japan-civil` | `gfx/optimized_ui_round3/MAOYUANXIN/PRC_MAO3_event_62.png.dds` | 日本内战 `PRC_MAO3.62`；`QHEND.gfx:330` |
| `japan-left` | `gfx/optimized_ui_round3/MAOYUANXIN/PRC_MAO3_event_89.png.dds` | 日本左翼胜利 `PRC_MAO3.89`；`QHEND.gfx:465` |

以上 17 张已逐一以联系表目视核验。前 13 张原尺寸为 500×250，台湾及日本新增四张为 400×150，显示尺寸由统一比例容器决定。用于检查的临时联系表已删除，不随应用分发。
