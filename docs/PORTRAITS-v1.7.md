# 1.7 人物立绘

本轮已完成人物参考改绘 9 张：羽泽鸫、美竹兰、青叶摩卡、上原绯玛丽、宇田川巴、丰川祥子、毛泽东、邓小平人形、习近平。另有普通人物原创基础图 5 张（男性、女性、中性成人，以及儿童和老人中性形象）；邓小平的海洋形态优先使用本轮用户水滴鱼照片改绘的独立角色图。

所有立绘通过内置 `imagegen` 生成，按一人一图分别制作。运行资源为 `public/portraits/*.webp`，懒加载相对路径，无内嵌 base64。原始生成 PNG 与本轮下载参考留在 `.cache/portrait-references`，不进入安装包。`scripts/portrait-pack.py` 仅压缩九张已目检成品，最长边 960、WebP quality 86；不生成或修改人物身份。

## 真实覆盖边界

现有扩展库 9,058 条 Wikidata 原始记录没有任何照片字段，本轮没有为 9,074 个最终身份全部找到本人照片或全部改绘。用户已明确选择“保留空缺，找到本人照片后再改绘”，因此没有可靠参考的隐藏人物和世界人物返回 `src:null`，不分配原创替身，不拿通用人脸冒充本人。姓名输入仍不提供隐藏人物候选。

普通自建人物采用原创基础图并按稳定身份保存个人选型和细微色调；这是可个性化的原创形象体系，并非每个可能姓名都另行生成了一张独一无二的脸。年龄段优先匹配，缺少相同性别年龄图时使用同龄中性图。儿童不会套用成人图。人体年龄覆写优先于日历穿越，普通年龄按月份增长。

真实人物改绘保持照片原有年龄与脸部身份。毛泽东素材来自 1950 年照片，邓小平来自 1979 年照片；历史形象不声称是 2020 年实际外貌。人物时间变化与身体年龄由游戏状态表达，已生成参考图不自动伪造某年龄的真实照片。

## 来源

| 人物 | 参考 | 类型 |
|---|---|---|
| 羽泽鸫 | `TFR-xinzuo-rebuild/gfx/MAOYUANXIN/Tsugumi.png` | 模组人物形象 |
| 美竹兰 | `TFR-xinzuo-rebuild/gfx/MAOYUANXIN/Ran.png` | 模组人物形象 |
| 青叶摩卡 | `TFR-xinzuo-rebuild/gfx/MAOYUANXIN/Moka.png` | 模组人物形象 |
| 上原绯玛丽 | `TFR-xinzuo-rebuild/gfx/MAOYUANXIN/Himari.png` | 模组人物形象 |
| 宇田川巴 | `TFR-xinzuo-rebuild/gfx/MAOYUANXIN/Tomoe.png` | 模组人物形象 |
| 丰川祥子 | `TFR-xinzuo-rebuild/gfx/MAOYUANXIN/saki.png` | 模组人物形象 |
| 毛泽东 | [Commons: Mao Tse Tung.jpg](https://commons.wikimedia.org/wiki/File:Mao_Tse_Tung.jpg)，陈正清，1950 | 历史本人照片；来源页标注公共领域 |
| 邓小平 | [Commons: Deng Xiaoping.jpg](https://commons.wikimedia.org/wiki/File:Deng_Xiaoping.jpg)，NARA 183165，1979-01-29 | 历史本人照片；美国联邦政府作品 |
| 习近平 | `TFR-xinzuo-rebuild/gfx/Leaders/PRC/PRC_xi_jinping1.png` | 模组中的本人照片头像加工版 |

六名虚构人物的 MOD 参考为模组拟真人外貌，不称作现实本人的生平照片，服装与画幅是本次视觉改编。丰川祥子最终采用高领外套的头肩像。

## 运行契约

- `getPortrait(stateOrProfile)`：同步返回 `id/identityKey/src/kind/sourceStatus/name/age/ageVariant/style/canUpload`；已知人物还含参考来源和源图年龄。`kind` 分为 `character/original/special/missing/custom`。
- `portraitIdentity` 使用隐藏人物稳定 id，普通人物由开局姓名、出生与所在地等建立稳定标识，迁居和日历穿越不会换脸。
- `loadPortraitOverrides()`：启动时读取本机 IndexedDB；初始化失败时继续使用内置素材。
- `setCustomPortrait(value, file)`：接受 12 MB 以内 PNG/JPEG/WebP，浏览器解码后保留比例压缩，再保存到 `mao-legacy-portraits` IndexedDB。拒绝 SVG、外部 URL、超大图片和错误格式。上传只在本机进行，不请求外部 API。
- `clearCustomPortrait(value)`：删除同一身份的本机覆盖图，恢复参考图或已明确的空缺状态。自定义图片不会随人生存档导出，不含模型凭据。
- 普通人物的 `profile.portraitPresentation` 可为 `male/female/neutral`。此项是外观偏好，不从姓名猜测性别或政治身份。
- 来源说明和缺失说明仅出现在肖像管理，不能拼入当月正文或行动结果。

## 生成提示规范

最终提示使用 `style-transfer` 或 `identity-preserve style-transfer`。共同要求：一张图片仅一个人物，适合视觉小说的独立立绘，清晰日式二次元线稿与克制赛璐璐阴影，保留参考人物脸型、发型与年龄感；无文字、标志、旗帜、口号和额外人物，透明背景。

人物附加约束如下，结合各自参考图片逐张执行：

- 羽泽鸫：约 20 岁，短浅棕 bob、侧刘海、棕眼，白衬衣深色领、小粉色蝴蝶结与深裙，去掉遮脸大帽，温和表情，头到大腿上部。
- 美竹兰：约 20 岁，短黑 bob、红挑染、沉静坚定目光，炭黑外套和暗红上衣、深裤，红色无标电吉他，去掉参考中的头盔。
- 青叶摩卡：约 20 岁，灰棕银色短 bob、水色眼睛，宽松米白卫衣和深裙，双手放口袋，松弛神态。
- 上原绯玛丽：约 20 岁，浅暖金粉色长发、侧刘海，粉色针织外套、白 T 恤与深裤，抱无标深色贝斯。
- 宇田川巴：约 20 岁，长赤棕发、琥珀眼，黑色上衣、红格衬衣、牛仔裤，一手自然持两根鼓棒。
- 丰川祥子：最终完整提示为：`Use case: style-transfer. Repaint the attached portrait of fictional character 丰川祥子 Toyokawa Sakiko as a Japanese 2D anime character portrait. Keep facial identity, long dark blue-black hair, straight bangs, hair ribbons, serious thoughtful expression. Portrait framing: head and shoulders, wearing a plain navy high-collar jacket fully closed. Clean ink outlines and restrained cel shading, transparent background. No text, no border, no symbols.`
- 毛泽东：保留照片中宽额头、发际线、面部结构和下唇下方的痣，灰中山装，双手自然垂落，真实中年比例，不变成无关的年轻美型人物。
- 邓小平人形：保留照片中老人脸部、短灰黑发、宽面颊、小眼睛和笑容，深蓝中山装及普通长裤，无鱼形特征，保留老人皱纹与比例。
- 习近平：保留模组照片头像中的侧分黑发、眼睛、宽面颊和神态，深蓝西服、白衬衫、暗蓝领带，保持中老年脸部特征。

普通原创图片由本轮独立图像任务生成，没有采用任何现实人物照片，不暗示是某位真实人物的外貌。

## 验证

`node --test tests/portraits.test.mjs` 覆盖独立资源存在、引用唯一性、未知人物留空、别名一致、特殊身体优先、穿越与返老还童、逐月年龄增长、同龄基础素材选择，以及本机上传格式边界。图片另经逐张目检。部署前须以完整测试与发布资源核验为准。
