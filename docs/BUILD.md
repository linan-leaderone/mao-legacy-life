# Windows / Android 构建

iPhone主屏幕安装版独立使用`pnpm build:ios`，发布、离线与密钥边界见 [IOS.md](IOS.md)。当前Windows环境没有Xcode，本轮未生成原生IPA。

两个客户端内置同一份 `dist/`，离线剧情无需服务器。每次打开先显示首页，可选择 DeepSeek、Gemini 或自定义 API，再继续、新建或读取人生档案。Windows 和 Android 的联网请求通过原生 HTTP 桥发送，避免 WebView 的 CORS 限制；浏览器开发页使用 fetch，仍受服务端跨域策略约束。

用户授权本人的原生包预填 DeepSeek 与本轮 Gemini 转发服务密钥。Vite 从 `.private/settings.json` 注入 `__DEFAULT_API_PROVIDERS__`；`.private/` 目录、兑换码与签名私钥不打包。公开网页构建保持空默认密钥，不能将普通 `dist` 发布到公开站点。文档、日志和截图不记录密钥。

当前源码版本为1.7.0，Android目标版本为1.7.0 / versionCode 8。下列路径描述打包脚本的输出约定，不表示安装包已经构建或验收；实际交付状态见 [VERIFICATION.md](VERIFICATION.md)，本轮行为变化见 [RELEASE-v1.7.md](RELEASE-v1.7.md)。

## 前置环境

- Node.js 22.12+ 与 pnpm；本项目网页使用 Vite。
- Windows PowerShell 5.1+。
- Android 编译需要 JDK 17+。已使用本机 JDK 26 验证编译；无需 Android Studio 或 Gradle。

## 构建

```powershell
pnpm install
pnpm build
pnpm --dir desktop --ignore-workspace install --ignore-scripts
node desktop/node_modules/electron/install.js
node scripts/package-windows.mjs
powershell -ExecutionPolicy Bypass -File scripts/package-android.ps1 -JavaHome 'C:\Program Files\Java\jdk-26.0.2.1'
```

Android 脚本首次运行从 Google 官方仓库下载 API 35 与 Build Tools 35.0.0，并校验仓库公布的 SHA-1。下载及中间文件放在 `.cache/`。Java 源码通过 `javac`、D8、AAPT2 构建，再经 `zipalign` 和 `apksigner` 签名、验证。

## 交付文件

- `release/MaoLegacyLife-Windows-x64.zip`：内含版本目录 `MaoLegacyLife-1.7.0-Windows-x64/`，完整解压后运行其中的 `MaoLegacyLife.exe`；不要单独移动 EXE。
- `release/MaoLegacyLife-Android.apk`：Android 8.0+；通过系统文件管理器安装，需要为安装来源启用系统安装许可。

Windows 便携应用未做商业代码签名。APK 使用本地生成的独立签名证书，且 `debuggable=false`。保留 `.private/android-signing.p12` 与对应密码文件，以便后续 APK 覆盖更新；丢失后无法用相同签名升级。它们不应加入版本控制或分发包。

Android 原生入口支持系统文档选择器导入、导出 JSON；不申请存储权限。游戏状态和设备 API 设置存储在对应客户端的 WebView / Electron localStorage。清除应用数据或卸载会清除本机数据，需先导出存档。

## 页面桥接接口

```js
// Android：调起系统保存位置，取消或完成由原生 UI 处理。
window.NativeBridge?.saveText('人生档案.json', JSON.stringify(save));
// Windows：返回 true（成功）或 false（取消）。
await window.desktopBridge?.saveText('人生档案.json', JSON.stringify(save));
// Electron 优先读取本机 %APPDATA%/MaoLegacyLife/settings.json。
// 开发运行再回退到项目 .private/settings.json；没有本机配置时返回 null。
await window.desktopBridge?.readLocalSettings();
```

Android 的 `<input type="file">` 使用系统文档选择器。远程网页不能在客户端主窗口导航，原生桥只供内置页面使用。

联网请求由 `src/api-transport.js` 统一调度：Windows 使用 `window.desktopBridge.requestApi` / `cancelApi`，Android 使用 `window.NativeBridge.requestApi` / `cancelApi` 和 `window.__maoApiResponse` 回调。浏览器环境使用 fetch；原生桥失败时不会再发送一份浏览器请求。请求最长60秒，取消会中止请求并丢弃迟到响应。消息结构、协议适配及约束见 [API-PROVIDERS.md](API-PROVIDERS.md)。

原生桥仍支持读取位于 `%APPDATA%/MaoLegacyLife/settings.json` 的本机配置。新版页面使用构建默认值与自己的已保存设置，不自动读取该文件；需要时可在首页或设置中选择文件导入。导入接受旧版 `apiKey`、`model`、`mode` 单份配置或新版 `providers` 配置。该文件位于分发目录以外，两种构建脚本都不会复制它。

## MOD审计数据

人物扩展库 `src/data/personas-catalog.json` 与新增 `personas-mod.json` 编入本地运行端，游玩时无需访问Wikidata。1.6合并库共9,074份，完整体积以本轮构建报告为准。重建扩展库使用 `node scripts/build-persona-catalog.mjs`，查询缓存位于`.cache/persona-catalog/`并不分发，已有全部缓存时支持`--offline`。覆盖与资料精度见 `PERSONA-CATALOG.md` 和 `LORE-v1.6.md`。普通构建不重新抓取人物数据。

常规 `pnpm build` 只编译运行时依赖，不要求原 MOD 文件夹存在。全量扫描用于更新来源审计：

```powershell
node scripts/build-mod-corpus.mjs
# 来源不在相邻目录时：
node scripts/build-mod-corpus.mjs '--mod=D:\资料\TFR-xinzuo-rebuild'
```

脚本只读原 MOD，写入 `src/data/mod-corpus.json` 和 `docs/MOD-COVERAGE.md`。约52 MB的完整索引不被运行端导入，不复制进 `dist`、APK或Windows应用。已映射的286个宏观ID、16条独立新闻与个人内容由运行数据承载；每次叙事最多取得6条已经公开的来源片段。全量扫描不等于全部MOD内容可游玩。

## 验证范围

构建脚本会验证 APK 签名和清单。Windows 版本应检查首页三种连接入口、各服务配置隔离、清空密钥后重启、当前草稿测试连接，以及创建角色、月度推进、保存导出和退出后恢复。原生桥还需检查取消、超时和不会重复发送请求。Android 构建成功和签名有效不等同于实机测试；需在设备上验证软键盘、系统文件选择器、各连接方式和返回键行为。真实接口验证、mock 覆盖与原生实测范围分别记录在 `VERIFICATION.md`，不以源码配置或构建成功代替实测结论。

工具文档：[Android AAPT2](https://developer.android.com/tools/aapt2)、[APK 签名工具](https://developer.android.com/tools/apksigner)、[Electron 安全建议](https://www.electronjs.org/docs/latest/tutorial/security)。

## 1.6 连接配置与图标

构建前 `.private/settings.json` 的 `providers.deepseek` 与 `providers.gemini` 提供各自 `apiKey`、`model`；Gemini另有 `baseUrl` 与 `protocol`。旧顶层 `apiKey` 仅作为 DeepSeek 默认密钥的兼容回退。默认选择 DeepSeek / `deepseek-flash`；Gemini新默认是 `https://aiapi.shiwuyan.cn/v1beta`、`gemini-4-argon` 和 Gemini 原生协议。服务选择与模型/地址可在首页调整。

连接设置规范化为 `providerRevision: 5`，三个服务独立保存密钥、模型与对应地址。旧Google密钥没有明确地址时保留官方Google主机，不自动发送到新转发站。旧版单份配置只迁移到对应服务，保留不联网偏好。已保存的空密钥覆盖默认值，不能在重启或切换时恢复。输入自动保存，开始与继续前再提交当前表单；测试使用当前草稿，切换服务后不接受旧测试结果。存档 JSON 不导出连接配置。

自定义 API 支持 OpenAI 兼容、Gemini 原生、Anthropic Messages 三种协议，模型名称可手动填写。测试连接读取模型列表，允许先留空自定义模型；实际联网叙事前要求模型名称与有效地址。自定义服务可不填密钥，以支持匿名本机服务。远程地址要求 HTTPS，本机服务允许 `localhost`、`127.0.0.1`、`[::1]` 的 HTTP；Android 使用 `@xml/network_security_config` 仅为这些 loopback 地址放行明文请求，`usesCleartextTraffic=false` 保留。页面 CSP 的连接范围为 HTTPS 与 loopback HTTP，不开放任意远程 HTTP。

Android 目标版本1.7.0 / versionCode 8，保持原 package 与签名，以支持覆盖旧版安装。`drawable-nodpi/launcher_art.png` 是按用户参考图生成的方形画面；Android 8+ 使用自适应图标和12dp内缩保护构图。

Windows 打包目录带版本号：`release/MaoLegacyLife-1.7.0-Windows-x64/`。ZIP名称保持不变。旧版本运行中时不覆盖其可执行文件；请从新版目录启动。源码版本不代表原生包自动更新，修改网页或原生桥后必须重新执行构建与封装。
