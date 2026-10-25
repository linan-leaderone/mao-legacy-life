# 人物头像 1.10

普通自建人物及途中接触的原创人物，现在由 `src/pixel-avatars.js` 本机生成 64×64 二次元像素头像。发型、刘海、肤色、眼睛、服装、饰物、背景分别组合，使用稳定的人生种子与人物身份；同一人物查看关系图、推进月份、迁居、穿越、存读档后仍保持相同特征。不同人生会重新组合。儿童、成年、老年外观保留相同的基础特征，年龄变化不会重抽人物身份。

`getPortrait(state)` 保留现有返回结构，普通头像仍为 `kind: original`，新增 `sourceStatus: generated-pixel` 和 `artworkStyle: anime-pixel`；`src` 是没有外部资源的 SVG data URI，可以供页面图片和小游戏 Canvas 使用。源图仅包含整数坐标的像素几何，玩家输入不会拼入 SVG。头像按需生成，不需要 API，不增加每月网络请求，也不向存档写入大图。生成算法版本固定为 1，后续维护不能随意改变已经发布版本的参数。

关系图使用 `getContactPortrait(state, node)`，由已保存的关系人物 ID 保持身份。固定人物使用已有来源的肖像，用户导入的图保持优先。已有历史人物缺少本人参考图时继续留空；不会给此类人物生成任意面孔。9位已有来源的固定人物及水滴鱼新增像素风改绘，保留原始参考和身份特征；用户自行导入的图片仍使用原图。族裔、国籍不用于推断肤色或其他外貌；生理性别只提供初始形象倾向，用户可以在整理肖像中独立修改形象风格。

验证包含 1,000 名普通人物的不同图像、缓存淘汰后重新生成的一致性、保存/读取稳定性、固定人物与缺图政策、年龄/族裔/性别偏好、关系图实际显示头像及只读行为。生成 SVG 只由可信模块写出；用户上传仍只接受 PNG/JPG/WebP，不开放任意 SVG 文件上传。

## 固定人物像素素材

2026-10-25 使用内置图像生成工具逐张改绘已有参考，保留人物身份、年龄与服饰特征，输出512×512透明WebP；只做常规压缩，没有用缩放或像素化滤镜冒充改绘。原图仍保留，`portrait-manifest.json` 的 `originalSrc` 与 `reference` 记录来源。

| 人物 | 像素文件 |
| --- | --- |
| 羽泽鸫 | `portraits/pixel-hazawa-tsugumi.webp` |
| 美竹兰 | `portraits/pixel-mitake-ran.webp` |
| 青叶摩卡 | `portraits/pixel-aoba-moca.webp` |
| 上原绯玛丽 | `portraits/pixel-uehara-himari.webp` |
| 宇田川巴 | `portraits/pixel-udagawa-tomoe.webp` |
| 丰川祥子 | `portraits/pixel-toyokawa-sakiko.webp` |
| 毛泽东 | `portraits/pixel-mao-zedong.webp` |
| 邓小平 | `portraits/pixel-deng-xiaoping.webp` |
| 习近平 | `portraits/pixel-xi-jinping.webp` |
| 邓小平的水滴鱼形态 | `characters/deng-blobfish-pixel.webp` |

水滴鱼像素头像沿用用户提供照片及此前改绘图作为参考；小游戏中的鱼形身体与本人标记均使用这张像素图。
