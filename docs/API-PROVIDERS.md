# API 连接（1.17.0）

进入首页即可在 ShiWuYan、DeepSeek、Gemini、自定义 API 中选择。四份密钥、模型和服务地址独立保存，切换服务不会把另一份密钥送给当前服务。设置保存在本机，人生存档及其导出文件不包含连接设置。个人 Windows/Android 构建从 `.private/settings.json` 注入用户指定的默认密钥，公开 iPhone 网页按作者本次明确授权内置新的ShiWuYan共享默认，其他默认密钥仍为空；公开GitHub源码不带任何密钥。本文不记录任何密钥、订单号或兑换码。

| 选择 | 默认模型 / 协议 | 接口 |
| --- | --- | --- |
| ShiWuYan | `grok-4.7` / OpenAI兼容 | 固定 `https://aiapi.shiwuyan.cn/v1`，使用 `x-api-key` |
| DeepSeek | `deepseek-flash` | 固定 `https://api.deepseek.com`，Chat Completions |
| Gemini | `gemini-4-argon` | 默认 `https://aiapi.shiwuyan.cn/v1beta`，Gemini Generate Content；可编辑地址并选择 Gemini 原生或 OpenAI 兼容 |
| 自定义 API | 手动填写模型；OpenAI 兼容、Gemini 原生或 Anthropic Messages | 用户填写 HTTPS 服务地址；本机服务支持 loopback HTTP |

模型名称可以手动填写，包含供应商前缀的名称如 `vendor/model-name` 也可用于兼容服务。自定义服务请按其文档选择协议：OpenAI 兼容地址常见为 `https://example.com/v1`，Gemini 原生为 `https://example.com/v1beta`，Anthropic 为 `https://example.com/v1`。粘贴完整的 `/chat/completions`、`/messages` 或 Gemini 模型生成地址时，设置层会提取接口根路径。服务地址不接受 URL 内嵌账号、密码、查询参数或片段；密钥应写入专用输入框。本机 OpenAI 兼容服务允许留空密钥。

“测试连接”只读取模型列表，不生成剧情。Gemini 原生使用 `models.list` 并跟随 `nextPageToken`，通常只列出声明支持 `generateContent` 的模型；已核验的 `aiapi.shiwuyan.cn/v1beta` 列表省略能力字段，因此仅对这个端点兼容缺失字段，明确只支持嵌入的模型仍会排除。Anthropic 使用 `/models`、`has_more` 与 `last_id` 分页。OpenAI 兼容服务使用 `/models`。所有返回名称去重；服务未提供模型列表时可以直接手填，不将查询失败等同于生成失败。

## 已保存连接的迁移

`providerRevision: 5` 为 Gemini 增加 `baseUrl` 与 `protocol`。新安装默认使用用户指定的转发站。旧存储只有 Gemini 密钥、没有地址时，仍使用 Google 官方地址和原有模型：不能把一个可能由用户自行填写的 Google 密钥自动发送给第三方。原有显式空密钥、模型和自定义地址均保留。

首页或设置中的“使用默认连接”是显式更换当前服务配置的入口。它只替换选中的服务，保留其他服务和不联网偏好；个人包采用新的本地默认密钥，公开网页ShiWuYan恢复授权的共享默认，其他服务不带默认密钥。使用转发站时默认模型须为该账户列表中实际授权的名称，不能凭其他供应商目录猜测。

## 叙事与错误处理

四个选择共用 `deepseek.buildPrompt` 和 `engine.validateResponse`：使用当前年龄、行动日期、职业、地区制度、独立新闻影响与已经发生的 MOD 事实。Gemini 已替换旧版叙事逻辑，不再强制每月五个选项，也不重复结算模型返回的属性变化。模型切换只改变叙事服务，不改动人生状态或世界排程。

行文、年龄或日期校验可自动请求修正一次；两次请求使用同一份预计算状态，不重新结算行动。结构错误、截断、服务拒绝、超时和取消不提交月份；不会悄悄切到其他服务或自动重试网络请求。错误提示不显示服务原始响应、密钥或完整请求地址。

OpenAI 兼容请求默认只发送 `model`、`messages`、`max_tokens` 与 `stream:false`，依靠共有提示要求完整 JSON，不附加 DeepSeek 专属参数。Gemini 使用 `systemInstruction`、`contents` 与 JSON 响应类型；修正时保留服务给出的 thought signatures。指定转发站的完整请求曾在 `STOP` 状态返回 Markdown 散文，没有遵守原生系统指令及 JSON 响应类型；对此端点的 `gemini-4-argon` 将规则与 JSON 结构要求只放在用户消息中发送一次，使用实测接受的 `thinkingLevel: low`，保留 6,000 输出 token 上限。普通 Google 和其他 Gemini 端点保持系统、用户消息分离，不添加未验证的思考参数。Gemini 请求使用 `src/prompt-compact.js` 删除本月未启用的规则分支与完全重复的输入字段；当前身份、地区制度、全部已有世界历史、长期记忆、固定事实、金钱与行动结算均保留。关系提示保留最近联系人、当前行动/主线提到的人和最强的直接关系；完整图谱仍在存档中。Anthropic 使用独立 `system`、`messages`、`max_tokens`，发送 `x-api-key`、兼容版本 `anthropic-version: 2023-06-01` 以及浏览器直连标记，不发送 temperature。

## 请求通道

`src/api-transport.js` 的 `requestJSON(url, options)` 为 Windows、Android 与浏览器提供相同超时和取消行为。Windows 优先 `window.desktopBridge.requestApi`，Android 优先 `window.NativeBridge.requestApi` 与 `window.__maoApiResponse` 回调。桥接失败不会再调用浏览器 fetch，避免重复请求。浏览器使用 fetch，不携带 Cookie 或页面来源，禁止跟随重定向。

Windows 原生桥使用 Electron 的 Chromium 网络栈，采用系统代理配置及 PAC/WPAD；没有自行修改代理或证书验证。原生总超时、取消信号、禁止重定向和响应大小限制继续生效。接口单元测试可注入 fetch 实现，不要求启动桌面窗口。依据：[Electron net 文档](https://www.electronjs.org/docs/latest/api/net)。

普通请求最长 60 秒；指定转发站的 `gemini-4-argon` 一次生成及可选的文风修正合计最长 180 秒，修正只使用剩余时间。取消会通知原生桥或中止 fetch，并丢弃迟到的响应。自定义服务可能采用不同字段或权限要求；当前兼容范围为上述三种标准文本接口，不包含任意供应商私有协议、工具调用、图片生成、流式界面或任意请求头编辑。

## 转发服务实测

核验日期：2026-10-25。以下使用本轮用户授权的密钥请求指定服务，未兑换兑换码、访问订单或创建公共付费代理。

同日补充核对了[卖家教程](https://www.workbuddy.link/p/btfagPxpxI4PVB9OYfgnHS?source=2)的公开正文：其流程为注册登录、钱包兑换额度、创建`default`分组API Key、配置客户端。兑换码用于一次性充值，不能作为请求密钥；已有API Key与兑换码是两种不同凭据。本文只确认教程所述用途，不推断用户的兑换码是否已经使用，也不代为兑换或申请退款。

教程明示的接口为OpenAI兼容`https://aiapi.shiwuyan.cn/v1`；本作采用的`/v1beta`原生兼容路径依据下面的实际请求确认。此次再次读取`/v1/models`与`/v1beta/models`，均返回HTTP 200，当前这把密钥的模型列表均只有`gemini-4-argon`。公开价格表中其他模型不代表此密钥有权限使用。本次复查只读取列表及CORS响应，没有追加剧情生成；此前完整月度生成的结果保留在下方记录。

替换旧连接的操作是：首页选择Gemini → 使用默认连接 → 确认协议为Gemini原生、地址为`https://aiapi.shiwuyan.cn/v1beta`、模型为`gemini-4-argon` → 填写对应API Key → 测试连接，关闭“不联网”后继续。个人1.6原生包恢复默认时会带入已授权的预填密钥；公开网页恢复默认后密钥为空，需要本人填写。该操作只改变连接，不删除或重置人生存档。不能仅把新密钥填入旧Google官方地址。

- [公开价格表](https://aiapi.shiwuyan.cn/pricing) 对应的 `/api/pricing` 返回 HTTP 200，公开目录列出多种 Gemini 名称；账户 `/v1/models` 只返回 `gemini-4-argon`，因此采用这个已获授权的模型。
- `/v1/chat/completions` 小请求返回 HTTP 200、`finish_reason: stop`，正文为要求的 `OK`。服务实际响应模型标记为 `gemini-argon-high`；这只确认转发服务接受该名称，不证明上游真实模型身份。
- `/v1beta/models` 返回 HTTP 200 和 `gemini-4-argon`，未提供 `supportedGenerationMethods`。`/v1beta/models/gemini-4-argon:generateContent` 使用 `x-goog-api-key`，小请求 HTTP 200、`finishReason: STOP`，按 JSON 响应设置返回正确 JSON。两次小生成合计报告 46 tokens。
- 以公开游戏站点 `https://mao-legacy-life-iphone.shady-shell-6921.chatgpt.site` 为 Origin 的预检返回 HTTP 204，允许 `GET,POST,PUT,DELETE,OPTIONS`，允许来源和请求头为 `*`；实际生成也返回允许来源 `*`。由于 [Fetch 标准](https://fetch.spec.whatwg.org/#cors-non-wildcard-request-header-name) 要求 `Authorization` 必须明确列出，网页默认选用支持通配的 `x-goog-api-key` 原生协议。OpenAI 兼容协议仍可供原生包或已正确配置 CORS 的其他服务使用。预检检查不代替 iPhone 实机测试。
- 完整时间旅行案例经生产 `generateMonth`、`buildPrompt`、`validateResponse` 和 `advance` 验收：单次 HTTP 200、`STOP`、826 输出 tokens，无文风修正；人物从2020年抵达1976年1月，保留25岁的身体年龄，正文按目的年代描述生活。脱敏记录见 `docs/GEMINI-v1.6-VERIFICATION.json`。使用 PowerShell HTTP 桥接实际网络，未把它当作 iPhone 实机验收。此前返回的 Markdown 散文经回放仍被拒绝，不伪造成成功，也不推进人生。

没有把个人 API Key 放入 URL、报错、测试断言、文档、存档或公开网页。请求禁止重定向，避免认证头随跳转发送给另一个域名。

## 标准协议参考

核验日期：2026-10-24。模型可用性与额度以当前服务账户为准，代码内默认名称不代表账户必有权限。

- [Google 模型目录](https://ai.google.dev/gemini-api/docs/models)：用于使用 Google 官方连接时核对模型；转发站的名称与授权范围以它自己的实际模型列表为准。
- [Google Generate Content 接口](https://ai.google.dev/api/generate-content)：固定官方 v1beta 生成端点、系统指令、会话内容与 JSON 响应设置。
- [Google Models 接口](https://ai.google.dev/api/models)：生成能力标记及模型分页。
- [Google API Key 文档](https://ai.google.dev/gemini-api/docs/api-key)：使用 `x-goog-api-key` 请求头。
- [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create) 与 [Models](https://platform.claude.com/docs/en/api/models/list)：消息结构、文本内容及列表分页。
- [Anthropic 版本历史](https://platform.claude.com/docs/en/api/versioning)：保留 `2023-06-01` 兼容版本；新版本已移除 temperature 等采样参数，本适配也不发送这些参数。
- [Anthropic 官方 TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/src/client.ts)：浏览器请求使用 `anthropic-dangerous-direct-browser-access: true`。

自动化验证覆盖旧 Google 凭据保留、默认转发配置、独立恢复默认、原生和 OpenAI 两种 Gemini 请求、请求隔离、错误与取消、文风修正共享超时等，共 34 项 API 测试通过。真实网络验证限于上述指定转发服务的小请求与一个完整时间旅行案例，不代表逐一验证所有第三方服务或所有剧情。实际构建与实测状态以 `docs/VERIFICATION.md` 为准。

## 1.7默认连接升级

`providerRevision: 6`以固定指纹仅识别最早随包的Google默认密钥；识别后整个Gemini连接更新为ShiWuYan Gemini原生端点及`gemini-4-argon`。私有包注入用户授权的新默认密钥，公共PWA清空原默认密钥并等待用户填写。显式清空、其他Google密钥、其他地址和自定义服务保持原状。指纹仅用于版本迁移，不作认证或密钥保管。

## 1.7.1 定向修复

配置版本为7。旧版无条件写入版本6，迁移函数又跳过版本6，导致部分旧Google连接始终保留。此前只有密钥没有地址的配置也统一按Google处理，新转发密钥同样受到影响。

现在检查实际连接：已知旧默认Google密钥仍可升级；本轮授权的ShiWuYan密钥误配Google origin或缺少地址时，保留密钥并同步修正为`https://aiapi.shiwuyan.cn/v1beta`、Gemini原生和`gemini-4-argon`。已标记版本7的误配也可修正。自定义服务、其他Google密钥、自选其他主机与显式清空不受影响。只识别固定指纹，不根据所有`sk-`前缀推断服务商。

输入过程中保留草稿；失焦、测试连接、开始或继续前规范化并同步表单，避免请求已更新而界面仍显示旧地址。2026-10-25本轮重新实测指定密钥的`/v1beta/models`返回HTTP 200，列表为`gemini-4-argon`；本轮没有再调用付费生成或兑换充值码。

## 1.17新增共享默认（2026-10-28）

新密钥的GET /v1/models实际返回HTTP200，仅列出grok-4.7。它作为独立ShiWuYan入口加入，未替换原Gemini密钥或模型。网页不再清空这项授权默认，新访问者默认选中；旧空连接一次迁移到新默认，自填连接保留。主动清除后的空值继续保留，可用“使用默认连接”恢复。

OPTIONS预检返回204，允许来源及请求头为通配。Authorization是CORS非通配头，因此此provider限定使用x-api-key；该头GET /v1/models确认200与grok-4.7列表，响应允许来源为通配。没有进行生成调用、浏览器游玩或游戏测试，完整叙事效果待人类验证。以前章节中的网页空默认策略是历史版本记录。
