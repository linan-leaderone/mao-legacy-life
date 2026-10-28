# API 连接（1.17.4）

进入首页即可在 ShiWuYan、DeepSeek、Gemini、自定义 API 中选择。四份密钥、模型和服务地址独立保存，切换服务不会把另一份密钥送给当前服务。设置保存在本机，人生存档及其导出文件不包含连接设置。个人 Windows/Android 构建从 `.private/settings.json` 注入用户指定的默认密钥，公开 iPhone 网页按作者最新授权内置DeepSeek、Gemini、ShiWuYan三组共享默认；公开GitHub源码不带任何密钥。本文不记录任何密钥、订单号或兑换码。

| 选择 | 默认模型 / 协议 | 接口 |
| --- | --- | --- |
| ShiWuYan | `grok-4.7` / Anthropic Messages兼容 | 固定 `https://aiapi.shiwuyan.cn/v1/messages`，使用 `x-api-key` 与 `anthropic-version` |
| DeepSeek | `deepseek-flash` | 固定 `https://api.deepseek.com`，Chat Completions |
| Gemini | `gemini-4-argon` | 默认 `https://aiapi.shiwuyan.cn/v1beta`，Gemini Generate Content；可编辑地址并选择 Gemini 原生或 OpenAI 兼容 |
| 自定义 API | 手动填写模型；OpenAI 兼容、Gemini 原生或 Anthropic Messages | 用户填写 HTTPS 服务地址；本机服务支持 loopback HTTP |

模型名称可以手动填写，包含供应商前缀的名称如 `vendor/model-name` 也可用于兼容服务。自定义服务请按其文档选择协议：OpenAI 兼容地址常见为 `https://example.com/v1`，Gemini 原生为 `https://example.com/v1beta`，Anthropic 为 `https://example.com/v1`。粘贴完整的 `/chat/completions`、`/messages` 或 Gemini 模型生成地址时，设置层会提取接口根路径。服务地址不接受 URL 内嵌账号、密码、查询参数或片段；密钥应写入专用输入框。本机 OpenAI 兼容服务允许留空密钥。

“测试连接”只读取模型列表，不生成剧情。Gemini 原生使用 `models.list` 并跟随 `nextPageToken`，通常只列出声明支持 `generateContent` 的模型；已核验的 `aiapi.shiwuyan.cn/v1beta` 列表省略能力字段，因此仅对这个端点兼容缺失字段，明确只支持嵌入的模型仍会排除。Anthropic 使用 `/models`、`has_more` 与 `last_id` 分页。OpenAI 兼容服务使用 `/models`。所有返回名称去重；服务未提供模型列表时可以直接手填，不将查询失败等同于生成失败。

## 已保存连接的迁移

`providerRevision: 5` 为 Gemini 增加 `baseUrl` 与 `protocol`。新安装默认使用用户指定的转发站。旧存储只有 Gemini 密钥、没有地址时，仍使用 Google 官方地址和原有模型：不能把一个可能由用户自行填写的 Google 密钥自动发送给第三方。原有显式空密钥、模型和自定义地址均保留。

首页或设置中的“使用默认连接”是显式更换当前服务配置的入口。它只替换选中的服务，保留其他服务和不联网偏好；个人包采用新的本地默认密钥，公开网页三项内置服务均恢复各自授权的共享默认。使用转发站时默认模型须为该账户列表中实际授权的名称，不能凭其他供应商目录猜测。

## 叙事与错误处理

四个选择共用 `deepseek.buildPrompt` 和 `engine.validateResponse`：使用当前年龄、行动日期、职业、地区制度、独立新闻影响与已经发生的 MOD 事实。Gemini 已替换旧版叙事逻辑，不再强制每月五个选项，也不重复结算模型返回的属性变化。模型切换只改变叙事服务，不改动人生状态或世界排程。

1.17.3起，每次生成只发送一个请求。取消旧版遇到 `PROSE_REPAIR` 自动追加第二次付费调用的行为；格式、文风、年龄或日期不合格时保留原月。所有适配器共用 `src/narrative-response.js`、`src/narrative-recovery.js` 和原结果校验。`src/prompt-compact.js` 继续压缩未启用规则与重复上下文，保留实际状态与行动结果。不会悄悄切换服务或自动重试网络请求。

本地解析接受完整且无歧义的JSON对象，可识别常见代码围栏、前后说明、BOM、标准双重JSON编码及完整前置think/thinking块；仅对字符串实际换行、制表符和合法值后的尾逗号作无损语法整理。不同对象并列、未闭合字符串或括号、根数组/标量、危险属性名及超过256KiB的文本仍拒绝，不补写缺少的剧情或字段。完整对象读取后仍须通过原语义校验，不能把解析成功当作可直接推进。

格式或校验失败时，完整且不超过256KiB的原文、原prompt与有限元数据仅作为当前页临时草稿，不进入人生存档、应用日志或服务器持久记录，不后台上传。只有当前人生与原安排未变，且本人明确点击“整理已收到的内容”，才发送额外一个请求，沿用原prompt、预计算事实和已收到的文字。整理成功并通过校验后才提交原行动；整理断线或取消保留草稿。供应商标记截断或block的回复不提供整理，只允许主动下载诊断或手动重新生成。刷新、关页会丢失临时草稿，不会改变原存档。

1.17.4的`src/narrative-style.js`只对有限中文显示措辞进行本地机械整理，不追加模型调用。原话、名字、事实字段和选项label保持原样；consequence包含economicUpdates证据时也不改动。整理后先核对fixedFacts所保留的结构及可识别现金事实，再执行完整validateResponse，年龄、同意、内容和事实校验继续生效。无法安全整理或仍不合格时继续拒绝提交，并显示具体原因。

诊断下载仅在本人操作时生成，只含脱敏响应正文及白名单元数据；不含prompt、action、state、npc、key、请求头或完整请求地址。v2新增issues和validationSummary：issues与错误框共用最多8条、每条200字符的限制，先脱敏再截断，界面另做HTML转义；validationSummary仅允许language、decision、month、priorMonth、ageYears、priorAgeYears、intimacyAllowed七字段及基本类型，未知值为null。普通报错不直接回显完整原文。诊断用于区分格式与内容校验失败，服务记账或模型目录成功不等于内容可通过游戏校验。

OpenAI 兼容请求默认只发送 `model`、`messages`、`max_tokens` 与 `stream:false`，依靠共有提示要求完整 JSON，不附加 DeepSeek 专属参数。DeepSeek保留JSON mode及原有参数。Gemini使用 `systemInstruction`、`contents` 与JSON响应类型；主动整理使用原始提示和失败原文，不自动延续第二次付费请求。指定转发站的完整请求曾在 `STOP` 状态返回 Markdown 散文，没有遵守原生系统指令及 JSON 响应类型；对此端点的 `gemini-4-argon` 将规则与 JSON 结构要求只放在用户消息中发送一次，使用实测接受的 `thinkingLevel: low`，保留 6,000 输出 token 上限。普通 Google 和其他 Gemini 端点保持系统、用户消息分离，不添加未验证的思考参数。Gemini 请求使用 `src/prompt-compact.js` 删除本月未启用的规则分支与完全重复的输入字段；当前身份、地区制度、全部已有世界历史、长期记忆、固定事实、金钱与行动结算均保留。关系提示保留最近联系人、当前行动/主线提到的人和最强的直接关系；完整图谱仍在存档中。普通Anthropic兼容连接使用独立 `system`、`messages`、`max_tokens`，发送 `x-api-key`、兼容版本 `anthropic-version: 2023-06-01` 以及浏览器直连标记，不发送temperature。ShiWuYan例外：完整原system规则与输入放入同一user消息，末尾再次约束完整JSON，以减少转发转换忽略system字段时丢失规则的影响；端点、模型与鉴权头不变。所有服务的格式约束都保留原行动与世界事实，不能用简单演示提示替换实际输入。

## 请求通道

`src/api-transport.js` 的 `requestJSON(url, options)` 为 Windows、Android 与浏览器提供相同超时和取消行为。Windows 优先 `window.desktopBridge.requestApi`，Android 优先 `window.NativeBridge.requestApi` 与 `window.__maoApiResponse` 回调。原生桥直连供应商，失败不会再调用浏览器 fetch，避免重复请求。

公开PWA的内置Gemini/ShiWuYan连接增加 `route: 'auto' | 'direct'`，保存在各自provider中，`providerRevision`仍为9。仅当主机准确为 `https://aiapi.shiwuyan.cn` 且根路径为 `/v1` 或 `/v1beta` 时，默认auto通过当前网站的 `/api/relay` 兼容连接。首页和设置可改为direct，浏览器直接访问原服务。DeepSeek官方、自定义入口、Gemini其他主机、普通开发构建和原生包保持直连；兼容连接失败不会自动重发到直连路径。浏览器不携带Cookie或Referer，所有路径均禁止跟随供应商重定向。

`scripts/site-api-worker.mjs` 只代理固定供应商。目标host、生成/目录路径、分页参数和请求头有白名单，请求体上限1MiB、响应上限4MiB；不是任意目的地代理。Worker在请求期间使用内存，不写凭据、人生内容或应用日志，不使用数据库或持久存储，也不缓存请求/响应。上游错误仅返回状态，不回传任意错误正文。兼容通道使用NDJSON，每10秒发送等待心跳，最终仅返回一份结果；心跳不代表额外模型调用。浏览器取消会中止连接，Worker通过 `Request.signal` 和流取消信号中止上游请求。

Windows 原生桥使用 Electron 的 Chromium 网络栈，采用系统代理配置及 PAC/WPAD；没有自行修改代理或证书验证。原生总超时、取消信号、禁止重定向和响应大小限制继续生效。接口单元测试可注入 fetch 实现，不要求启动桌面窗口。依据：[Electron net 文档](https://www.electronjs.org/docs/latest/api/net)。

所有服务的每次生成请求最长180秒；本人明确点击整理时会另发一个请求，同样最多180秒。模型目录查询及分页合计最长15秒。等待界面显示真实经过秒数、连接阶段及所走通道，不显示虚构百分比。用户取消与等待超时分开提示；取消会通知原生桥或中止fetch，并丢弃迟到响应。自定义服务可能采用不同字段或权限要求；当前兼容范围为上述三种标准文本接口，不包含任意供应商私有协议、工具调用、图片生成、逐字流式叙事或任意请求头编辑。NDJSON只用于转发心跳与完整结果，不改变供应商的 `stream:false` 请求。

这项改动针对浏览器跨域限制和长时间无响应的等待处理。尚未完成中国大陆运营商、地区与设备覆盖实测，不把部署健康或目录查询成功当作实际剧情生成速度的证明。

## 历史转发服务实测（1.6）

核验日期：2026-10-25。以下使用本轮用户授权的密钥请求指定服务，未兑换兑换码、访问订单或创建公共付费代理。

同日补充核对了[卖家教程](https://www.workbuddy.link/p/btfagPxpxI4PVB9OYfgnHS?source=2)的公开正文：其流程为注册登录、钱包兑换额度、创建`default`分组API Key、配置客户端。兑换码用于一次性充值，不能作为请求密钥；已有API Key与兑换码是两种不同凭据。本文只确认教程所述用途，不推断用户的兑换码是否已经使用，也不代为兑换或申请退款。

教程明示的接口为OpenAI兼容`https://aiapi.shiwuyan.cn/v1`；本作采用的`/v1beta`原生兼容路径依据下面的实际请求确认。此次再次读取`/v1/models`与`/v1beta/models`，均返回HTTP 200，当前这把密钥的模型列表均只有`gemini-4-argon`。公开价格表中其他模型不代表此密钥有权限使用。本次复查只读取列表及CORS响应，没有追加剧情生成；此前完整月度生成的结果保留在下方记录。

1.6时替换旧连接的操作是：首页选择Gemini → 使用默认连接 → 确认协议为Gemini原生、地址为`https://aiapi.shiwuyan.cn/v1beta`、模型为`gemini-4-argon` → 填写对应API Key → 测试连接，关闭“不联网”后继续。个人1.6原生包恢复默认时会带入已授权的预填密钥；当时公开网页恢复默认后密钥为空，需要本人填写。该历史策略已被1.17.1授权三组网页默认取代。该操作只改变连接，不删除或重置人生存档。不能仅把新密钥填入旧Google官方地址。

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
- [Cloudflare Static Assets 绑定](https://developers.cloudflare.com/workers/static-assets/binding/)：Worker使用 `ASSETS` 服务同站静态内容。
- [Cloudflare Request.signal](https://developers.cloudflare.com/workers/runtime-apis/request/#properties) 与 [取消请求说明](https://developers.cloudflare.com/changelog/post/2025-05-22-handle-request-cancellation/)：开启 `enable_request_signal` 后监听访问者断开连接，取消上游请求。相关官方文档于2026-10-28核对。

历史自动化验证（不代表1.17.4的检查结果）覆盖旧 Google 凭据保留、默认转发配置、独立恢复默认、原生和 OpenAI 两种 Gemini 请求、请求隔离、错误与取消、文风修正共享超时等，共 34 项 API 测试通过。真实网络验证限于上述指定转发服务的小请求与一个完整时间旅行案例，不代表逐一验证所有第三方服务或所有剧情。实际构建与实测状态以 `docs/VERIFICATION.md` 为准。

## 1.7默认连接升级

`providerRevision: 6`以固定指纹仅识别最早随包的Google默认密钥；识别后整个Gemini连接更新为ShiWuYan Gemini原生端点及`gemini-4-argon`。私有包注入用户授权的新默认密钥，公共PWA清空原默认密钥并等待用户填写。显式清空、其他Google密钥、其他地址和自定义服务保持原状。指纹仅用于版本迁移，不作认证或密钥保管。

## 1.7.1 定向修复

配置版本为7。旧版无条件写入版本6，迁移函数又跳过版本6，导致部分旧Google连接始终保留。此前只有密钥没有地址的配置也统一按Google处理，新转发密钥同样受到影响。

现在检查实际连接：已知旧默认Google密钥仍可升级；本轮授权的ShiWuYan密钥误配Google origin或缺少地址时，保留密钥并同步修正为`https://aiapi.shiwuyan.cn/v1beta`、Gemini原生和`gemini-4-argon`。已标记版本7的误配也可修正。自定义服务、其他Google密钥、自选其他主机与显式清空不受影响。只识别固定指纹，不根据所有`sk-`前缀推断服务商。

输入过程中保留草稿；失焦、测试连接、开始或继续前规范化并同步表单，避免请求已更新而界面仍显示旧地址。2026-10-25本轮重新实测指定密钥的`/v1beta/models`返回HTTP 200，列表为`gemini-4-argon`；本轮没有再调用付费生成或兑换充值码。

## 1.17新增共享默认（2026-10-28）

新密钥的GET /v1/models实际返回HTTP200，仅列出grok-4.7。它作为独立ShiWuYan入口加入，未替换原Gemini密钥或模型。网页不再清空这项授权默认，新访问者默认选中；旧空连接一次迁移到新默认，自填连接保留。主动清除后的空值继续保留，可用“使用默认连接”恢复。

OPTIONS预检返回204，允许来源及请求头为通配。Authorization是CORS非通配头，因此此provider限定使用x-api-key；该头GET /v1/models确认200与grok-4.7列表，响应允许来源为通配。没有进行生成调用、浏览器游玩或游戏测试，完整叙事效果待人类验证。以前章节中的网页空默认策略是历史版本记录。

## 1.17.1鉴权更正（2026-10-28）

上一版由GET /v1/models成功推断Chat Completions也接受x-api-key，判断不成立。无剧情空请求确认：该生成路径的x-api-key返回401；Bearer通过鉴权。由于此站CORS通配不允许Authorization，ShiWuYan改用同站/v1/messages，发送x-api-key与anthropic-version:2023-06-01。使用新密钥与grok-4.7、故意缺少messages的格式探测返回field messages is required，确认请求通过鉴权与模型权限阶段；预检204与错误响应都允许公开站点跨域。没有发送有效生成输入或推进游戏。

原DeepSeek和Gemini默认密钥只读模型列表均为200，分别有deepseek-flash/deepseek-v4-pro与gemini-4-argon。网页三组默认按本次授权一起预填，旧空配置一次迁移，用户自填连接保留。上文1.17中的OpenAI+x-api-key实现属于已修正的历史记录。

## 1.17.2 兼容连接（2026-10-28）

浏览器访问指定转发站的内置连接默认改走同源Worker，保留direct选项和三组原默认。所有生成共用180秒预算，目录查询共用15秒；原生桥、DeepSeek官方和自定义连接继续直连。Site保留原项目与public访问权限，静态内容通过ASSETS绑定继续提供，发布结构见 [IOS.md](IOS.md)。本轮不运行游戏测试或有效模型生成，只进行静态审查、构建封装及部署健康、只读模型目录诊断；实际完成情况单独记入验证文档。

## 1.17.3 返回内容与显式整理

本节及上方当前错误处理规则覆盖历史版本的自动修订约定。1.17.3实施时仅有用户截图显示客户端失败且服务侧已有计费，当时尚未取得失败响应原文，不能确定是哪一种格式或校验原因。该版加强本地完整对象识别、保留临时草稿与主动脱敏诊断，并取消隐藏的第二次调用。之后收到的v1诊断结论见下节；不把历史缺少原文的状态当作当前结论。

## 1.17.4 本地措辞整理与诊断摘要

用户提供的v1诊断显示JSON完整、finishReason为end_turn，errorCode为PROSE_REPAIR；至少可以明确禁用措辞“进一步”触发了校验。这份旧诊断没有issues或校验年龄，不能断定只有这一项问题，也不能据此认定角色成年。项目文档只保留这些中性结论，不收录用户的原始剧情、行动或亲密内容。

本版增加有边界的本地措辞整理、具体issues显示及v2诊断摘要，完整结果仍须通过原有校验。单次生成、本人主动追加整理、原稿临时内存和存档兼容规则不变。继续遵守不运行游戏测试、模拟用例或有效模型生成的要求；本节不声明部署或验证已完成。
