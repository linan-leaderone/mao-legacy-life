# iPhone 网页 1.12.0 全球行政地图

2026-10-26已发布最终修正版，沿用原公开入口，无需注册或登录。

| 项目 | 最终值 |
| --- | --- |
| 应用版本 | 1.12.0 |
| PWA标记 | a2d42b0a61434432 |
| Site源码提交 | 96403ee37aeb67df04cd5d62fa716f2f23210c70 |
| Site版本 | appgprj_6adcc793ef4481918148a8ce82d7832d~appgver_4a5d2b5b48188191b1b3205a8cbcbec9（版本14） |
| 部署 | appgdep_6adf122c216881919f201dfc7fa976a8 |
| 核心预缓存 | 63份，42,420,894字节 |
| 按需地方地图 | 383份，59,391,610字节 |

[正式入口](https://mao-legacy-life-iphone.shady-shell-6921.chatgpt.site/)于08:41:37 UTC部署成功。地名索引、国家资料与主程序拆分，每个静态文件低于25MiB；上一版需要的资源保留，更早的静态资源移至本机备份，发布包低于256MiB解压上限。个人默认密钥已排除。

495项完整测试通过。公开源码副本独立构建得到相同PWA标记；正式构建在浏览器正常启动、进入世界地图，控制台没有错误。七层定位、跨国迁居、地图搜索不改变本人位置、390像素布局与数据完整性验收见[验证记录](VERIFICATION.md)。没有iPhone/Safari实机验收，交付仍为PWA。

平台再次确认访问权限为public。无认证、无Cookie的顺序HTTP核验通过首页标记和前续资源后，在`maps/AUT-ADM2-boundaries.json`遇到25秒超时；并行重试仍超时，随后独立HEAD请求得到Cloudflare 403。没有把这次核验记为全量通过。边界记录在`release/ios-public-verification.json`；平台部署成功和本地全量文件哈希检查已确认，尚未完成全部446项静态资源的线上匿名获取核验。

先保存人生，关闭旧游戏页面后重新打开可载入新版；不会强制刷新正在进行的人生。世界底图及核心内容可离线使用，未缓存地方地图首次查看需要联网。

---

# iPhone 网页 1.11.0 世界地图与世界规则

2026-10-26发布成功，沿用原公开入口，无需注册或登录。

| 项目 | 最终值 |
| --- | --- |
| 应用版本 | 1.11.0 |
| PWA标记 | ec719d132c821473 |
| Site源码提交 | fa859e6c251e20e71d137b803baeff083455cfe2 |
| Site版本 | appgprj_6adcc793ef4481918148a8ce82d7832d~appgver_6318785c40788191b0ed93b508ca7b9c（版本11） |
| 部署 | appgdep_6adefcf25c6c819195f9539002080c47 |
| 预缓存 | 61份，33,665,344字节 |

[正式入口](https://mao-legacy-life-iphone.shady-shell-6921.chatgpt.site/)于07:11:02 UTC部署成功，权限仍为public。07:11:41 UTC完成62项无认证、无Cookie且禁止重定向的HTTP检查，全部直接200；首页标记与全部非HTML资源匹配最终构建。报告保存在 `release/ios-public-verification.json`。公开构建排除个人默认密钥，保留旧散列资源以兼容尚未退出的页面。

451项完整测试通过；最后一处水浒名词措辞调整后，21项语言和集成回归通过。浏览器验证世界地图、台湾板桥区详情、关系图、固定语言和水浒隐藏人物开局。地图数据的范围与年份见[地图说明](WORLD-MAP-v1.11.md)，验证范围见[验证记录](VERIFICATION.md)。没有iPhone/Safari实机验收，交付仍为PWA。

先保存人生，关闭所有游戏页面后重新打开，可载入新版。更新不强制刷新进行中的人生。

---

# iPhone 网页 1.10.0 像素头像与请求优化

2026-10-25发布成功，继续使用原公开链接，免注册登录。

| 项目 | 最终值 |
| --- | --- |
| 应用版本 | 1.10.0 |
| PWA标记 | 3d384b5401293236 |
| 源码提交 | 00aedec29a39ae313dda6a1ce99e62485493422d |
| Site版本 | appgprj_6adcc793ef4481918148a8ce82d7832d~appgver_7a000f4883748191b1e63bf7b9c5f9c3（版本9） |
| 部署 | appgdep_6ade1bf576c08191b5406bd13e47cde9 |
| 预缓存 | 58份，21,561,102字节 |

[正式入口](https://mao-legacy-life-iphone.shady-shell-6921.chatgpt.site/)于15:11:06 UTC部署成功。随后59项无认证、无Cookie且禁止重定向的HTTP检查全部直接200，首页标记与全部非HTML资源匹配最终构建。报告 `release/ios-public-verification.json`。公开源码副本独立构建产生相同PWA标记，个人默认密钥排除。

完整414项测试通过；浏览器检查普通头像、固定像素鱼、关系图及工作/回合战斗/实时战斗中的本人标记，包含手机尺寸检查。具体内容与设备边界见[验证记录](VERIFICATION.md)。没有iPhone/Safari实机验收。

保存版本一次成功。前三次部署调用出现传输错误，每次读取已保存版本确认没有部署ID后再重试，第四次成功；没有更换站点或公开权限。旧窗口可继续使用既有Service Worker，关闭其他游戏页面后重新打开可载入更新，不强制刷新进行中的人生。

---

# iPhone 网页 1.9.0 人物关系与身份语言更新

2026-10-25发布成功，沿用原公开链接，无需注册或登录。

| 项目 | 最终值 |
| --- | --- |
| 应用版本 | 1.9.0 |
| PWA标记 | eee2ef7174afe94f |
| 源码提交 | e4899fc1bb82b0f61db15421a55116eb80969cc3 |
| Site版本 | appgprj_6adcc793ef4481918148a8ce82d7832d~appgver_8fb39bc02ef481918a6cef41760347f4（版本8） |
| 部署 | appgdep_6ade0592c1188191af1d4f71225e2820 |
| 预缓存 | 48份，19,503,211字节 |

[正式入口](https://mao-legacy-life-iphone.shady-shell-6921.chatgpt.site/)于13:35:36 UTC部署成功。13:36:18 UTC完成无认证、无Cookie且禁止重定向的49项检查，全部直接200；首页标记和非HTML资源字节匹配最终构建。报告`release/ios-public-verification.json`。个人默认密钥排除，原散列资源保留以支持旧缓存。

完整398项测试通过；最终工具栏布局修正后另外重跑9项关系图测试全部通过。真实浏览器验证关系图、手机分页与定位、自填身份、七种语言选择及具体英文选项；截图和真实DeepSeek英文样本见[验证记录](VERIFICATION.md)。本轮没有iPhone/Safari实机验证。

发布过程中先遇到上传确认失败及服务传输错误，查询版本列表确认没有产生版本后重试。最终源提交保存为版本8；首次部署调用发生传输错误，查询该版本确认没有部署ID，再对同一已保存版本重试，成功上线。没有更换站点或公开权限。旧窗口可能继续使用已有Service Worker；关闭其他游戏页面后重新打开可载入更新，不强制刷新正在进行的人生。

---

# iPhone 网页 1.8.0 战斗更新

2026-10-25发布成功，原链接继续公开、免注册登录访问。

| 项目 | 最终值 |
| --- | --- |
| 应用版本 | 1.8.0 |
| PWA标记 | cd7612a771f28939 |
| 源码提交 | 679d19e62835ecf56242f312e60608b5e0f0f21b |
| Site版本 | appgprj_6adcc793ef4481918148a8ce82d7832d~appgver_3857766398988191a96332244f437886 |
| 部署 | appgdep_6addf6d74a708191bbaeff08d248485d |
| 预缓存 | 45份，17,945,426字节 |

[正式入口](https://mao-legacy-life-iphone.shady-shell-6921.chatgpt.site/)在12:32:50 UTC返回部署成功。随后无认证、无Cookie且禁止跳转的46项HTTP检查全部200，首页标记与非HTML资产匹配最终产物。默认个人密钥排除；旧散列资源保留且不列入当前预缓存。

最终338项自动检查通过；桌面浏览器实际操作了10人回合制、11人60秒战斗、独立小地图、暂停、退出不记录及撤离后只推进一个月。390×844视口验证两种战斗按钮与地图布局，截图见`release/v1.8.0-turn-mobile.png`和`release/v1.8.0-large-mobile.png`。没有iPhone/Safari实机操作，PWA不代表签名IPA。

保存版本第一次发生传输错误，读取版本列表确认未生成新版本后，重试同一归档成功；随后只部署已保存版本一次。没有改变原站点公开权限。原有窗口可能继续使用旧Service Worker，关闭其他游戏页面后重新打开可载入新版；不强制刷新进行中的人生。

---

# iPhone 网页 1.7.1 连接修复

2026-10-25发布成功，继续公开免注册、免登录访问。

| 项目 | 最终值 |
| --- | --- |
| 应用版本 | 1.7.1 |
| PWA标记 | 43032237812cbf2c |
| 源码提交 | c477c3fcae4589e24de642936bc06ce4dbfbcf3a |
| Site版本 | appgprj_6adcc793ef4481918148a8ce82d7832d~appgver_828d8f87eddc81919595b64a03e9b240 |
| 部署 | appgdep_6addf01ac8048191991f795a36fdc91a |
| 预缓存 | 45份，17,898,519字节 |

[正式入口](https://mao-legacy-life-iphone.shady-shell-6921.chatgpt.site/)在12:04:38 UTC部署成功，首次失败的同版本重试已核对状态。46项无认证头、无Cookie且禁止跳转的HTTP检查全部200，首页标记和非HTML哈希匹配。记录见`release/ios-public-verification.json`。

本机浏览器已保存用户指定新连接并实测返回1个模型，关闭后重开仍保留；其他设备需重新打开以载入新版，已经打开的旧PWA可能等待其他窗口关闭。网站仍不内置个人密钥，个人原生包按用户授权预填。全套303项自动测试通过；没有新的iPhone实机验收。

---
# iPhone 主屏幕安装版 1.7.0 验证记录

2026-10-25部署成功，继续公开免注册、免登录访问。交付仍为PWA，无原生IPA。

| 项目 | 最终值 |
| --- | --- |
| 应用版本 | 1.7.0 |
| PWA标记 | 6d91e82545dbc543 |
| 源码提交 | 23ce4204b00b7ce79b9ee44efaa4c7912098db5d |
| Site项目 | appgprj_6adcc793ef4481918148a8ce82d7832d |
| Site版本 | appgprj_6adcc793ef4481918148a8ce82d7832d~appgver_dc0617b802588191862ebcdb28c765d2 |
| 部署 | appgdep_6addeaa1cf24819180af8015c64177a3 |
| 预缓存资源 | 45份，17,897,904字节 |

[正式入口](https://mao-legacy-life-iphone.shady-shell-6921.chatgpt.site/)部署在11:40:36 UTC返回succeeded。之后无认证头、禁用Cookie且禁止重定向的46项HTTP检查全部直接返回200；首页含最终标记，非HTML资源与本地最终构建逐字节相同。检查时间与SHA-256在`release/ios-public-verification.json`。

构建明确排除个人默认密钥；来源仓库沿用原Site，只同步dist-ios。旧未引用散列文件保留，不在本轮45项预缓存中。源码归档匹配已推送提交，未上传.private、私钥或MOD审计索引。

全套297项测试通过，最终PWA本机浏览器390×844视口已检查人物立绘、属性、战斗控件、取消不提交及本机立绘重载持久化。其他本轮生产预览实际操作见[验证记录](VERIFICATION.md)。没有iPhone实机安装、Safari续写、系统分享或软键盘验收；不将桌面手机尺寸视图当成实机验证。Gemini此前真实调用证据沿用1.6记录，本轮未重新付费请求。

---

# iPhone 主屏幕安装版 1.6.0 验证记录

验证日期：2026-10-25（Asia/Taipei）。本次已发布1.6.0，继续保留免注册、免登录的公开访问。iPhone交付是Safari主屏幕PWA，没有Apple签名IPA。

## 本次发布

[正式入口](https://mao-legacy-life-iphone.shady-shell-6921.chatgpt.site)于18:41部署成功，Sites返回`succeeded`。随后完成最终构建的匿名HTTP资源检查，准确时间见`../release/ios-public-verification.json`。没有改变既有public访问权限。

| 项目 | 值 |
| --- | --- |
| 应用版本 | `1.6.0` |
| PWA构建标记 | `2d1fccca828bb8de` |
| 发布源码提交 | `5e6934db03858df6cccf7138230bc27539e5b3da` |
| Site项目 | `appgprj_6adcc793ef4481918148a8ce82d7832d` |
| 部署 | `appgdep_6adddcac298c8191b90a1c7cb85fa247` |
| Site版本 | `appgprj_6adcc793ef4481918148a8ce82d7832d~appgver_47c8684b8928819185987f9b1dde8dee` |
| 预缓存资源 | 30份，共15,616,648字节 |

`pnpm build:ios`成功，扫描确认公开资源不含个人默认API密钥；资源清单和SHA-256见`../release/ios-web-verification.json`。发布目录只同步公开构建，旧的未引用散列文件保留，不加入新版本的预缓存清单。

`scripts/verify-ios-hosted.ps1`使用无认证头、禁用Cookie且禁止重定向的独立HTTP客户端检查31项资源：全部直接返回200，根首页包含最终构建标记，全部非HTML资源逐字节一致。证据见`../release/ios-public-verification.json`。发布归档与源码提交对应，未发布`.private`、签名材料或完整MOD审计索引。

## 功能与验证边界

本轮完整`pnpm test`235项全部通过。最后仅调整历史时期疫情提示，避免在1976年提及2020年疫情；修改后25项地区与提示检查通过，三端重新构建。生产PWA本机浏览器实际检查了三种自由度、邓小平隐藏身份、鼠标捕食1条鱼后只结算一次并推进至2月、穿越1976年1月并把身体年龄改为18岁，以及当时的中国大陆、台湾与日本制度。截图见`../release/v1.6-world-1976.png`，截图早于最后一处文案调整。公开站点额外尝试浏览器打开时自动化工具超时，线上验收依据以上匿名HTTP检查；不把这次浏览器工具调用记录为成功的界面验收。

新Gemini转发配置通过公开站点Origin的CORS预检，并完成一次生产叙事链路的真实请求：HTTP 200、JSON校验通过、推进到1976年1月且保留25岁身体年龄。脱敏证据见`GEMINI-v1.6-VERIFICATION.json`。这次真实请求使用桌面桥接测试环境，没有在Safari实机提交；手机使用者仍需自行填写密钥。

没有连接iPhone或Android实机，本次未再次执行Safari系统分享、主屏幕安装和软键盘人工检查。此前Chromium离线加载实测保留在以下历史记录中，不能替代本次iPhone实测。Windows和Android1.6.0已另行构建并完成包内资产核验，见`VERIFICATION.md`。

---

# iPhone 主屏幕安装版 1.5.0 历史验证记录

验证日期：2026-10-24（Asia/Taipei）。本次交付为iOS/iPadOS 15.4+的PWA，沿用1.5.0内容；Windows和Android安装包未重新打包。

## 发布版本

[正式入口](https://mao-legacy-life-iphone.shady-shell-6921.chatgpt.site)已于2026-10-24 23:18（Asia/Taipei）部署成功，Sites返回状态`succeeded`。按用户明确要求，23:25将访问权限改为public（revision 2），无需注册或登录，可直接分享。安装步骤见 [iPhone安装说明](IOS.md)。

| 项目 | 值 |
| --- | --- |
| 应用版本 | `1.5.0` |
| PWA构建标记 | `70a4eb497baae4c5` |
| 发布源码提交 | `d9d2de43ca3669cdf6337bd78391f13c4e0121be` |
| Site项目 | `appgprj_6adcc793ef4481918148a8ce82d7832d` |
| 部署 | `appgdep_6adccc220ee48191a3369376de49a83a` |
| Site版本 | `appgprj_6adcc793ef4481918148a8ce82d7832d~appgver_14a35a54dda8819183eb5dac61b60415` |
| 预缓存资源 | 30份，共15,495,660字节 |

`pnpm build:ios`生成独立的`dist-ios`。构建校验确认网页产物未包含此前配置的两份个人默认密钥；未打包私有配置、签名材料、原始查询缓存或完整MOD审计索引。逐文件SHA-256与字节数见 `../release/ios-web-verification.json`。手机上的API密钥由使用者填写，不随人生存档导出。

## 自动检查与离线运行

首页请求修复后重新运行`pnpm test`，170项全部通过。新增检查覆盖iPhone/iPad和独立窗口识别、原生环境隔离、缓存状态消息来源、注册竞态、可视区域变化，以及文件分享、取消和下载回退。Service Worker测试覆盖完整缓存就绪、失败回滚、更新保留旧缓存、认证路径与API请求排除；既有测试已加入托管首页跳转的回归情境。

本机Chromium预览中，首页显示“离线内容已就绪”。停止预览服务器后刷新，应用仍能打开；读取德仁的2020年1月档案并继续至2020年2月，人物身份、年龄和进度保持。这验证了已缓存资源的离线加载与本地存档继续，不代表iPhone实机测试。

首页截图见 [本机浏览器预览](screenshots/ios-home-v1.5.png)，并非iPhone实机截图。

## 线上接口与验证边界

公开访问变更后，使用不带认证头、禁用Cookie且禁止重定向的新HTTP客户端重新检查31项资源，全部直接返回200。首页包含最终构建标记，全部非HTML资源与发布产物一致；匿名访问未跳转登录页。记录见 `../release/ios-public-verification.json`。此次仅修改访问权限，未更换发布版本或重建游戏资源。

正式站点的认证HTTP检查发现`/index.html`以307跳转到`/`。已将Service Worker的首页网络请求改为根路径，缓存仍使用`index.html`键，其他重定向继续禁止。

修复后的正式部署于23:20完成31项认证HTTP检查（30份预缓存资源及Service Worker），全部返回200。根首页包含最终构建标记，所有非HTML资源与发布产物逐字节一致；安装清单类型为`application/manifest+json`，Service Worker类型为`text/javascript`。记录见 `../release/ios-hosted-verification.json`。这些检查确认资源能按预期提供，不作为Safari界面、Service Worker安装或实机运行的证明。

DeepSeek官方接口的OPTIONS预检允许正式站点Origin发起POST，并允许`Authorization`与`Content-Type`请求头。本次没有在Safari实际提交AI续写；Gemini和自定义服务也未进行Safari实机接口测试。

没有连接iPhone或iPad。系统分享面板、主屏幕安装、登录衔接及软键盘表现仍需在实际设备确认；自动检查与Chromium预览不能替代这些操作。当前Windows环境没有Xcode，本次未生成Apple签名IPA，未提交TestFlight或App Store。
