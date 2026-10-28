# iPhone 主屏幕安装版

本版针对只有iPhone的使用方式，通过Safari添加到主屏幕，以独立窗口运行，支持iOS/iPadOS 15.4及以上。1.17.2构建共用本项目源码，共用9,075份人物档案、新闻配图、自由行动与JSON存档；当前线上部署版本及检查范围见[iOS验证记录](IOS-VERIFICATION.md)。交付形式为PWA，尚未生成Apple签名的原生IPA，也没有提交TestFlight或App Store。

## 安装

安装入口：[毛的遗产 · 人生档案](https://mao-legacy-life-iphone.linanna.chatgpt.site)。网站已公开，任何人都能通过链接打开，无需注册或登录。

1. 在iPhone的Safari打开上面的安装入口。
2. 点击分享按钮，选择“添加到主屏幕”。如果出现“作为网页App打开”，保持开启，再点“添加”。
3. 从主屏幕图标首次联网打开，等待首页显示“离线内容已就绪”。使用预填的ShiWuYan默认连接，或自行设置、勾选“不联网”开始。
4. 需要转移进度时，在原版本导出JSON，在iPhone的“读取”中选择同一文件。导出可使用系统分享面板的“存储到文件”。

Safari与主屏幕App的数据可能分开保存；Safari里已有的密钥、存档和离线资源不能假定自动迁移。应先安装，再从主屏幕设置和游玩。离线内容包括本地人物库和全部图片，1.7增加角色立绘与小游戏，最终资源数量和字节数见[构建报告](../release/ios-web-verification.json)；1.13的地方地图与旗帜按查看范围加载，首次查看未缓存区域需要联网，已查看地图可以离线使用。AI续写始终需要网络。手机清除网站数据会清除本地记录，重要进度可导出保存。

网页版沿用1.17.1授权的DeepSeek、Gemini、ShiWuYan三组共享默认，打开无需手填，各服务及自定义API独立保存配置。共享默认的使用次数共用，源码仓库不包含密钥。Gemini默认地址为`https://aiapi.shiwuyan.cn/v1beta`，模型`gemini-4-argon`；用户自己填写的Google配置仍保留原主机。

1.17.2中，内置Gemini/ShiWuYan指向准确的`https://aiapi.shiwuyan.cn`及`/v1`或`/v1beta`时，默认通过本站`/api/relay`兼容连接，可在首页或设置改为“直接连接”。DeepSeek官方及自定义主机保持浏览器直连，仍受供应商跨域策略约束；原生HTTP桥不适用于Safari。兼容通道每10秒发送等待心跳，生成与一次可选修订合计最多180秒，模型目录查询合计15秒。界面显示实际等待时间并提供取消，失败和取消不推进月份。

转发Worker只在内存中处理本次请求，不写凭据、人生内容或应用日志；它只接受指定供应商及固定接口，不跟随重定向、不自动重发。此前Gemini通过桌面桥完成的历史生成案例仍见[1.6脱敏记录](GEMINI-v1.6-VERIFICATION.json)，不能代替本版iPhone实机或中国大陆线路验证。本轮没有进行有效模型生成或游戏测试。

新人生可选择三种行动自由度，游玩中显示本月属性净变化、收入与开支。时间旅行使用目的年月，返老还童后的身体年龄继续随实际经历推进；旧档案仍可导入。邓小平海洋身体的捕食可打开触屏小游戏，结束后的收获随本月行动保存，取消会回到原有进度。1.7另加入丧尸战斗与四类工作小游戏、持续伤势和装备、人物立绘，详情见[更新说明](RELEASE-v1.7.md)。

历史1.6完整自动检查235项通过，1.7曾进行浏览器捕食、穿越与身体年龄相关操作；旧结果及界面截图保留在[验证记录](VERIFICATION.md)。这些历史记录不代表1.17.2经过同样操作。本轮没有iPhone或Android实机测试，主屏幕安装、系统分享与软键盘仍待人类在设备上验收。

## 构建与发布

```powershell
pnpm build:ios
node scripts/prepare-ios-site.mjs ../mao-legacy-life-ios-site
```

`scripts/build-ios-web.mjs`使用Vite的ios模式，目标Safari 15.4，产物在`dist-ios`。此模式注入作者明确授权的三组共享默认；构建逐文件确认这些默认存在，并阻止其他未授权凭据进入网页。公开源码导出仍检查并排除所有密钥。不会覆盖普通`dist`或旧APK/Windows ZIP。

启动图标复用此前按用户参考图生成的安卓图标原图，RGB PNG 1254×1254；清单使用standalone显示。iPhone样式处理安全区、16px输入字号、横屏及软键盘时弹窗可视高度。存档导出优先`navigator.share({files})`且先检查`canShare`，用户取消不会重复下载。

`scripts/pwa-worker-template.js`仅预缓存明确列出的静态资源，不缓存AI请求、认证路径、用户自填配置、用户存档或未知链接；授权的共享默认随应用静态代码一起缓存。核心静态资源逐一校验SHA-256，首页校验本次构建标记，核心缓存完成才写就绪标记。地方地图与旗帜标为lazy，首次请求校验SHA-256后再存入同版本缓存。首页从根路径请求并使用`index.html`缓存键，兼容托管服务的首页规范化；其他重定向继续禁止。版本散列同时包含应用资源和worker模板，防止仅更新worker且安装失败时误删旧缓存；失败会回滚本次缓存。新版不强制激活，不自动刷新正在进行的行动。

发布目录为相邻`mao-legacy-life-ios-site`。`scripts/prepare-ios-site.mjs`要求已有`.openai/hosting.json`，保留原Site项目ID和public访问方式，将旧静态资源迁入`dist/client`，再将最终`dist-ios`复制到该目录。脚本默认保留既有散列文件；发布归档超出资源上限时，可依据当前`dist-ios/assets`清单清理已不再引用的历史哈希JS/CSS，不删除当前资源、地图数据或立绘。脚本同时写入`dist/server/index.js`和`dist/server/wrangler.json`，使用`ASSETS`绑定`../client`，`/api/*`先交给Worker，其他内容继续由静态资源服务提供。

Site清单移除`static`项，以使用Worker部署；这个清单变更本身不删除静态资源。只通过Sites源仓库工作流推送、打包、保存版本和普通部署，不新建项目、不改为登录访问。不得把普通`dist`误用作网页发布，服务器也不复制`.private`。纯Vite静态预览不提供`/api/relay`，需要请求服务时应选择直接连接或使用配置了此Worker的部署。真实发布URL、版本与检查结果见 [iOS验证记录](IOS-VERIFICATION.md)。

已安装PWA收到更新后，关闭该网站的所有标签页和主屏幕窗口，再重新打开即可让待安装版本激活。更新不强制刷新正在进行的行动，也不要求清除网站数据或存档。

## 平台依据

- [Apple：把网站变成iPhone上的App](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios)
- [WebKit：Safari 15.4的新功能](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/)
- [WebKit：存储隔离](https://webkit.org/tracking-prevention/)
- [WebKit：Safari 17.2主屏幕App只复制Cookie，不复制其他本地存储](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/)
- [Cloudflare：Static Assets绑定](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Cloudflare：Request.signal取消处理](https://developers.cloudflare.com/changelog/post/2025-05-22-handle-request-cancellation/)，部署开启`enable_request_signal`。

## 1.17.2 更新的验收边界

1.17.2按用户要求不运行游戏测试、浏览器游玩或有效模型生成。检查范围为静态审查、编译封装、部署健康与只读模型目录网络诊断；最终完成结果见IOS-VERIFICATION.md。目录读取和服务健康不等于剧情续写速度实测，也不代表中国大陆所有运营商均可连接。
