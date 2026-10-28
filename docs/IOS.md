# iPhone 主屏幕安装版

本版针对只有iPhone的使用方式，通过Safari添加到主屏幕，以独立窗口运行，支持iOS/iPadOS 15.4及以上。1.16.0构建共用本项目源码，共用9,075份人物档案、新闻配图、自由行动与JSON存档；当前线上部署版本及匿名访问验收见[iOS验证记录](IOS-VERIFICATION.md)。交付形式为PWA，尚未生成Apple签名的原生IPA，也没有提交TestFlight或App Store。

## 安装

安装入口：[毛的遗产 · 人生档案](https://mao-legacy-life-iphone.linanna.chatgpt.site)。网站已公开，任何人都能通过链接打开，无需注册或登录。

1. 在iPhone的Safari打开上面的安装入口。
2. 点击分享按钮，选择“添加到主屏幕”。如果出现“作为网页App打开”，保持开启，再点“添加”。
3. 从主屏幕图标首次联网打开，等待首页显示“离线内容已就绪”。然后填写API连接，或勾选“不联网”开始。
4. 需要转移进度时，在原版本导出JSON，在iPhone的“读取”中选择同一文件。导出可使用系统分享面板的“存储到文件”。

Safari与主屏幕App的数据可能分开保存；Safari里已有的密钥、存档和离线资源不能假定自动迁移。应先安装，再从主屏幕设置和游玩。离线内容包括本地人物库和全部图片，1.7增加角色立绘与小游戏，最终资源数量和字节数见[构建报告](../release/ios-web-verification.json)；1.13的地方地图与旗帜按查看范围加载，首次查看未缓存区域需要联网，已查看地图可以离线使用。AI续写始终需要网络。手机清除网站数据会清除本地记录，重要进度可导出保存。

网页不内置个人API密钥。DeepSeek、Gemini和自定义API入口继续保留，在手机上填写，数据保存在当前浏览器/主屏幕App中。1.6的Gemini新默认地址为`https://aiapi.shiwuyan.cn/v1beta`，模型`gemini-4-argon`；原随包Google默认配置在1.7定向迁移，公共版清空其旧默认密钥；用户自己填写的Google配置仍保留原主机。PWA采用浏览器请求，服务需要允许跨域；原生HTTP桥不适用于Safari。DeepSeek与新Gemini转发站已有CORS检查。新Gemini转发站另经生产请求与状态提交调用链完成一次真实剧情生成，穿越至1976年1月后保留25岁身体年龄；[脱敏记录](GEMINI-v1.6-VERIFICATION.json)注明桌面桥及HTTP适配的验证范围。尚无Safari或iPhone实机续写验证。

新人生可选择三种行动自由度，游玩中显示本月属性净变化、收入与开支。时间旅行使用目的年月，返老还童后的身体年龄继续随实际经历推进；旧档案仍可导入。邓小平海洋身体的捕食可打开触屏小游戏，结束后的收获随本月行动保存，取消会回到原有进度。1.7另加入丧尸战斗与四类工作小游戏、持续伤势和装备、人物立绘，详情见[更新说明](RELEASE-v1.7.md)。

此前1.6完整自动检查235项通过；历史1.7的测试与产物校验见[验证记录](VERIFICATION.md)。本机浏览器实测了捕食1条鱼后一次提交至次月，以及变成人、穿越至1976年1月并返老还童至18岁的连续操作，世界局势显示对应年代的中台日制度。界面截图与原生安装包核验见[本轮验证记录](VERIFICATION.md)。本轮没有iPhone或Android实机测试，主屏幕安装、系统分享与软键盘仍未在设备上验收。

## 构建与发布

```powershell
pnpm build:ios
pnpm exec vite preview --mode ios --host 127.0.0.1 --port 4174
```

`scripts/build-ios-web.mjs`使用Vite的ios模式，目标Safari 15.4，产物在`dist-ios`。此模式不注入默认私有密钥，构建后再次逐文件检查已配置凭据不得进入产物。不会覆盖普通`dist`或旧APK/Windows ZIP。

启动图标复用此前按用户参考图生成的安卓图标原图，RGB PNG 1254×1254；清单使用standalone显示。iPhone样式处理安全区、16px输入字号、横屏及软键盘时弹窗可视高度。存档导出优先`navigator.share({files})`且先检查`canShare`，用户取消不会重复下载。

`scripts/pwa-worker-template.js`仅预缓存明确列出的静态资源，不缓存AI请求、认证路径、密钥、用户存档或未知链接。核心静态资源逐一校验SHA-256，首页校验本次构建标记，核心缓存完成才写就绪标记。地方地图与旗帜标为lazy，首次请求校验SHA-256后再存入同版本缓存。首页从根路径请求并使用`index.html`缓存键，兼容托管服务的首页规范化；其他重定向继续禁止。版本散列同时包含应用资源和worker模板，防止仅更新worker且安装失败时误删旧缓存；失败会回滚本次缓存。新版不强制激活，不自动刷新正在进行的行动。

发布目录为相邻`mao-legacy-life-ios-site`，其中`.openai/hosting.json`保留Site项目ID及`static.directory=dist`。只同步无默认密钥的最终`dist-ios`到该站点的`dist`，通过Sites源仓库工作流推送、打包，再保存版本并使用普通部署操作；保留用户指定的public访问权限。不得把含默认密钥的普通`dist`误用作网页发布。真实发布URL、版本与验收结果见 [iOS验证记录](IOS-VERIFICATION.md)。

## 平台依据

- [Apple：把网站变成iPhone上的App](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios)
- [WebKit：Safari 15.4的新功能](https://webkit.org/blog/12445/new-webkit-features-in-safari-15-4/)
- [WebKit：存储隔离](https://webkit.org/tracking-prevention/)
- [WebKit：Safari 17.2主屏幕App只复制Cookie，不复制其他本地存储](https://webkit.org/blog/14787/webkit-features-in-safari-17-2/)

## 1.16 更新的验收边界

1.16按用户要求不运行游戏测试或浏览器游玩。仅完成静态审查、公开构建与发布流程；最终部署状态见IOS-VERIFICATION.md，人类实际游玩后再确认行为。
