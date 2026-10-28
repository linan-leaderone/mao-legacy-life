# 项目事实

- 本目录是独立游戏，不修改相邻 `TFR-xinzuo-rebuild`。MOD 剧情来源见 `docs/LORE-SOURCES.md`，配图来源见 `docs/ART-SOURCES.md`。
- 当前源码版本1.15.0，`timelineVersion: 5`、`providerRevision: 7`。`src/engine.js` 控制年月、路线排程、属性、行动结果、人物状态和存档提交，`src/agency.js` 解析肯定行动、时间/年龄/世界变更与就业收支；`src/regions.js` 提供地区制度与新闻影响。`src/api.js` 分发 DeepSeek、Gemini、自定义请求，所有服务共用提示与结果校验。叙事成功并校验后才提交一次行动；失败或取消不提交预先计算的副本。
- 用户只有iPhone，iOS交付采用Safari“添加到主屏幕”的PWA（iOS/iPadOS 15.4+），不是原生IPA或TestFlight。`pnpm build:ios`单独输出`dist-ios`，不改变既有Windows/Android产物。`src/ios-install.js`只在`__IOS_PWA__`构建启用；`src/file-export.js`在iPhone使用支持JSON文件的系统分享面板，否则回退下载，原生导出优先级保留。核心离线缓存成功才显示就绪，地方地图按查看范围加载并校验缓存，首次查看未缓存地区需要联网，更新不强制刷新当前人生。
- iOS发布副本为相邻`mao-legacy-life-ios-site`，Site身份在其`.openai/hosting.json`，必须沿用。这个目录只同步已经移除默认密钥的`dist-ios`内容，不能复制整个游戏目录、`.private`、原始查询缓存或完整MOD审计索引。iOS网页禁止内置个人默认密钥，手机自行填写并保存在当地浏览器/主屏幕存储中。用户于2026-10-24明确要求免注册登录分享，Site已设为public；后续更新保留公开访问，使用普通保存/部署流程，不得调用会要求owner-only的私有部署操作。发布方式和验证边界见`docs/IOS.md`。
- 每次启动先显示首页 API 卡，包括有存档时；支持 DeepSeek、Gemini、自定义 API 三选一，以及不联网、继续、新人生和读取。品牌入口返回首页，切换连接不丢失进度，请求进行中不得切换。首页和设置共用连接表单，编辑自动保存，开始和继续前提交当前表单；测试连接必须使用当前草稿，迟到结果不能覆盖已修改配置。
- `src/api-settings.js` 使用 `providers.deepseek/gemini/custom` 分别保存密钥与模型，不能跨服务串用。DeepSeek默认`deepseek-flash`；Gemini新默认为用户指定转发站`https://aiapi.shiwuyan.cn/v1beta`、Gemini原生协议与`gemini-4-argon`，也允许配置OpenAI兼容协议。只有最早版本随包的原默认Google密钥按固定指纹识别并在升级时替换整个Gemini连接（私有包使用新默认，公共包清空旧密钥）；用户自填Google密钥或自定义地址保留，不能把用户旧密钥自动发给新主机。旧flat配置迁移到对应服务，保留不联网和显式空密钥；空值不能被默认值覆盖。自定义支持OpenAI兼容、Gemini原生、Anthropic Messages，可手填模型、允许匿名本机服务，测试模型列表可暂不填模型。
- `src/api-transport.js` 优先使用 Windows `desktopBridge.requestApi` 或 Android `NativeBridge.requestApi`，通过原生 HTTP 请求避免 WebView CORS 限制；普通浏览器使用 fetch。只允许 HTTPS 或 loopback HTTP，禁止重定向；取消、超时与迟到响应规则在各端保持一致。原生请求失败不能偷偷再发浏览器请求。协议、模型查询和桥接契约见 `docs/API-PROVIDERS.md`。
- 初始20点分配到智力、家境、体力、颜值，每项0–10；影响力根据背景、身份、家境与年龄推导。现有动态数值另含道德、淫乱值和魅力，意识形态偏好保存在`person.ideology`。未成年人或未成年特殊身体的淫乱值为0；只有明确成年的人形身体可涉及自愿、非露骨的成人关系，数值不代表他人同意。`statChanges`展示各项实际净变化与原因，`monthlyLedger`记录劳动收入和开支；就业收入逐月结算，辞职停止工资。模型`actionDelta`不直接结算。
- 每四个月为一组，按种子随机安排1–2个抉择月，提供3–5项选择；其余月份使用57条个人事件各自的 `diary` 或当前职业生活记述。所有月份都保留“下个月”和手动安排。新闻与宏观事件独立呈现，同月可有多条，查看不消耗行动；图片画框统一16:9，影响只在首次进入月份时应用。
- 开局三个自由度为`unlimited`（完全不受限）、`influential`（影响力偏大）、`grounded`（更受世界规则限制），前两者兼容`narrative: player`，后者兼容`balanced`。肯定陈述的自定义行动实际成立，允许穿越、改变身体年龄、发动/结束战争、担任领导和帮助他人获胜；否定、条件句、传闻和单纯设想不当成已完成结果。属性影响成本、协作和具体结果，grounded保留条件与概率。玩家主动改变可取代原先安排的政治结果，历史发生记录仍保留，不能同时维持互斥胜者。
- 普通开局使用国家/实际管治势力→省份→城市→区划/县四级选择，缺失或不适用层级跳过；旧35项出生地兼容读取。国籍留空按开局实际管治方对应国家填写，玩家自填国籍保留，迁居不自动改国籍。隐藏库9,075份：55份原有主要/特殊档案、7份模组虚构人物与9,058条Wikidata记录合并45条重复。新增美竹兰、丰川祥子、羽泽鸫、青叶摩卡、上原绯玛丽、宇田川巴；生日未知保持空值，开局年龄是有说明的时序适配。姓名栏不提供候选项，精确姓名/别名匹配，歧义不任选。批量库不冒充逐人完整的2020年家庭与职业履历。韩国通过人物及迁居支持。来源见`docs/LORE-v1.6.md`和既有人物来源文档。
- `src/special-lives.js` 管理毛泽东水晶棺苏醒/复活和邓小平海洋吞噬进化，保存形态、阶段与身体年龄。毛泽东公开苏醒产生不同群体的支持、担忧与反对反应，棺内未公开时不让全国提前知情。`src/fish-game.js`提供鼠标/触屏捕食，收获随实际行动提交，取消不提交月份或成长。海洋身体不套陆地办事与开支。120岁自然终止只用于grounded普通人物；自由模式仍受实际健康归零约束。明确复活、进化和自由行动中的身体变化不能改成梦或准备。
- `month`是相对2020年1月的日历月，可为负；`turn`是实际经历次数，等于`history.length`。穿越保留身体年龄与记忆，原世界新闻归入`timeJournals`并按目的年代建立当前环境。`person.ageOverride`按经历月份推进，优先于出生日期；无覆盖时公开人物按生日计算年龄。提示区分行动日期、抵达日期和当前日期。`person`保存职业、身份、拘押、技能、项目、关系、事实及意识形态，静态开局资料不能撤销已完成变化。
- `src/data/lore.json`含37条分支、286个不同宏观ID，其中104条在`regionalStories`，本轮新增18条台湾报道；`news.json`保留16条独立新闻，个人事件57条。战时台湾报道受`blockAfter`约束，停火后不补写正在发生的战争；Afterglow赴台、记录、演出和返日依各自前置。来源与改编边界见`docs/LORE-v1.6.md`及既有剧情文档。
- `scripts/build-mod-corpus.mjs` 只读扫描685个脚本及1,164个本地化文件，索引21,218个定义。完整 `mod-corpus.json` 只供审计，不导入运行端或安装包；全量索引不代表全部内容可游玩。`src/mod-content.js` 每次只返回最多6条已公开阶段片段，不用图邻居或未完成国策推断世界事实。详见 `docs/MOD-COVERAGE.md`。
- 未经直接干预时，`couplings`约束陈文清分支的台日内战及胜负绑定；`selectionOnly: chen`不进入其他自然发展方向。直接改变台日胜者设`playerChangedCoupling`，不再强行恢复旧绑定。`worldOverrides[region]`是当前领导、制度、意识形态和冲突的优先事实，显式`conflict:null`表示停火；`terminatedConflicts/lastingPeace`禁止旧排程重新开战。模型`worldUpdates`只能补肯定成功行动明确造成且本地未解析的公共结果，不能为被动生活/普通打工发起战争，不能反转同地区已落实的结果，也不能把他人的领导职位授予玩家。
- `getPoliticalActors(state)`返回29份政治元数据中当前已公开的人物、立场与关系；不把`modPolitics.stages`完整未来阶段传入叙事。人物自主活动写入`npcActivity/npcPressure`，与玩家`worldPressure`分开呈现，参与尚未锁定方向的演变。显式选择的审计路线不被NPC抽样改动。中国、台湾、日本开局制度使用模组与用户指定设定；1976年的历史基线和其他未知年份不得套用2020年身份与疫情。
- 自然排程保留2020疫情与民进党连任，2021年7月游行、8月美国内战、10月台海战争，2022年8/9/10月停火和长征不早于2024年的基础顺序。大亚洲战争原始最早2027年，须在中华共和国成立24个月、制宪会议18个月之后，制度落实节点另留12个月，并避开当前未结束内战；可推迟，不能固定到某年强行开战。相关选举与战争标题按实际时间更新，毛远新第二次文革仍在大战结束之后。台日自然内战须在台海停火之后，玩家明确主动引发的内战可以改变时序。相对事件依实际前置和间隔，细节可随机延迟。
- 进行中保留三个可命名保存位置、独立自动保存、JSON导入导出、上一份备份，以及自身状况、世界局势入口。存档兼容迁移保留 `history`，当前页改为个人生活与独立新闻。`history.consequence` 保存对应本次行动结果，不能误配上一月回响。存档不包含API密钥。世界局势只展示已发生事实。
- `nextContext` 先结算明确且成功的迁居（支持主要城市与省份别名），再结算下个月所在地新闻与影响；模型返回的地点不能直接替换人物所在地。
- 新闻 `exposure` 分为 direct、indirect、remote、none。远方报道不自动在本地造成灾害、封控、拘押或收入损失；大陆政治和办事机构不套到台日港澳韩。地区环境只应用已经发生的制度变化。
- 面向人物的正文、选项与新闻必须沉浸式，不插入开发者、玩家、本局、触发节点、路线锁定、属性加成等局外说明。来源、适配说明和隐藏分支仅保留在数据元信息与文档，不能拼入叙事或提前透露终局。
- `src/narrative.js` 管理简洁文风与可识别错龄校验；各叙事服务最多自动重写一次，不在重写时推进月份或重算行动。格式错误、再次不合格或网络失败交由界面重试或本地叙事。实际 DeepSeek 接口样例见 `docs/DEEPSEEK-SAMPLES-v1.3.json`；样例不是其他供应商或全场景的证明。
- 共享页面经Vite构建到`dist`，Electron和Android包装同一构建。目标1.15.0；Android versionCode 17；Windows目录`release/MaoLegacyLife-1.15.0-Windows-x64/`，ZIP名称保持不变。人物扩展库进入本地构建，原始查询缓存和完整MOD审计索引不进入。实际打包、上线与验证以`docs/VERIFICATION.md`为准，源码版本不代表交付已完成。
- 用户授权本人的APK/ZIP预填DeepSeek密钥及本轮新的Gemini转发服务密钥，默认选择DeepSeek。Vite从`.private/settings.json`注入，私有目录与签名文件本身不打包；公开PWA一律空默认密钥。不要在日志、截图、测试输出或文档回显凭据；兑换码和订单信息不作为API配置。UI保持密码输入，允许替换/清除，存档不含密钥。
- 修改核心行为后运行相应测试并完成 `pnpm test`；构建用 `pnpm build`，原生包需重新封装后才能交付。实际验证边界与最终测试结果在 `docs/VERIFICATION.md`，不得把源码更新直接写成已交付新包。

- 1.7新增 `src/continuity.js`，本地与联网叙事均承接上一行动、具体收支、伤势与未完成事项，主页面合并行动后果与本月生活，不再使用独立“上月回响”框。提示禁止把零捕获写成进化，或把零差错工作写成失误；联网错误仍最多修订一次。
- `src/encounter-games.js` 管理丧尸遭遇、配送、质检、餐饮、办公小游戏；`src/encounter-state.js` 管理当前装备、弹药、免疫和感染。当前 equipment（包括空数组）覆盖背景旧装备，家属装备不继承；取消不提交，预览不改原档，小游戏结果和行动同次提交，工资与奖金分账，致命伤不能被本月其他增益复原。
- `src/portraits.js` 与 `portrait-manifest.json` 管理立绘。用户明确要求：隐藏人物缺少本人照片时保留空缺，不用通用脸代替。MOD虚构人物可按其模组素材改绘，普通自建人物使用原创样式；资料数量不代表立绘数量。水滴鱼按用户参考图改绘。用户导入的成品立绘只存本机IndexedDB，不含在JSON存档中，运行端不自动向外部服务发送照片。覆盖与来源见 `docs/PORTRAITS-v1.7.md`。

- 1.7.1 修复已标记升级的旧 Gemini 连接仍留在 Google 的问题。按明确授权的旧默认/新转发密钥指纹定向迁移，不受 revision 跳过；新转发密钥误配 Google 或缺失地址时保留密钥并同步改为 ShiWuYan 原生地址与 gemini-4-argon。任意其他 Google 密钥、自选非 Google 地址、显式空密钥保留。表单输入时保存草稿，失焦/测试/开始时规范化并同步显示，实际请求与可见字段一致。

- 1.8由battle-offer识别当前个人交战，人数含玩家、友军和敌军。总人数≤10为回合制，>10为60秒实时战斗并显示独立小地图；暂停与失焦不计时。battle-game管理结果校验，battle-view管理输入和绘制，encounter-games维持现有入口。工作45秒与鱼类小游戏不变。最终健康按healthAfter净变化入账，人类战斗不新增感染，局部结局不决定整场战争。取消不提交，叙事重试复用已完成记录；详见docs/MINIGAMES-v1.8.md。

- 1.9新增人物关系图、身份与语言。src/relationships.js只从实际接触及已公开的预设关系更新relationshipGraph；旧存档可迁移，新闻、假设不建立接触。src/relationship-view.js负责中心玩家、圆形肖像、避碰曲线、自由拖动、分页搜索与缩放；缺图联系人显示姓名首字，查看不改月。profile.identity独立保存性别、族裔、国籍/势力及描述，旧值未知保持空。src/language.js提供七种语言/文风、界面翻译和本地续写，历史保持原文；选项originalLabel供实际结算，显示用displayLabel可留在历史。src/action-language.js校验外文明确公共行动的地区与类别，不能为普通工作补战争。范围与边界见docs/RELEASE-v1.9.md；不宣称整个MOD已人工多语种翻译。

- 1.10普通人物与普通联系人的头像由 src/pixel-avatars.js 按人生种子和稳定身份生成二次元像素图；getContactPortrait区分普通联系人与固定隐藏人物。固定人物9份及水滴鱼采用imagegen改绘的像素版，manifest.originalSrc保留原参考图，用户导入图保留；缺参考的固定人物继续空缺。src/minigame-avatar.js仅用于显示，共用于鱼/工作/战斗及小地图，不进入结算。Gemini经prompt-compact删重复规则与字段、筛选相关关系，原档不变；转发站的gemini-4-argon使用已验证的low思考配置。速度实测见docs/GEMINI-SPEED-v1.10.md，不保证转发服务响应时间。公开源码只通过scripts/export-public-source.mjs的清单与凭据检查后导出；GitHub发布状态单独记录，不能把本地仓库当作已公开。

- 1.11 世界地图由 world-map/world-territories 与离线 maps 数据组成，细区覆盖范围和数据年份见地图来源文档，不把 MOD 州/位图当作现实县界。territoryOverrides 保存明确控制和交战地点，factionConflicts 保存参战；同势力参战区有广域影响，只有明确交战地才显示前线。月度战时费用和压力只在 nextContext 副本结算，advance 一次提交。
- 1.11 deriveGovernmentState/normalizeWorldOverrides 同步政权、意识形态和势力，旧档只修复已知旧默认错配。普通乐队成员没有公共决策权，转为政治人物需已发生的内战/政治事实。policies 从 43 条 MOD 国策来源适配，按政权/战争/前置/互斥与冷却抽样，不表示全部国策可玩。scenario 固定在新开局，shuihu 新档启用 mao-april；旧档缺 scenario 迁移为 standard，读取不重开彩蛋。
- 1.11 语言只在首页为新人生选择，进行中的 profile.language 不受首页偏好或连接设置改变。水浒古白话覆盖界面、正文、选项与报道；保持人名和现代制度原称。关系图取消分组与分页，搜索只定位/高亮；旧档清理明显误抽取短语，显式自定义姓名保留。story-flow 合并正文去重，成人关系偏好只从成年自愿非露骨交往变化，概率只生成邀请，不推定同意。

- 1.12地图索引在src/geography.js，位置记录在src/player-position.js，国别资料在src/countries.js。全球55,588单位/258轮廓/203个国家与地区有地方层，55个仅轮廓；384几何分片按视窗加载。七层视图跟随本人当前位置，搜索不迁居，行政区中心是示意位置，未知地点不伪造坐标。保留v1.11单位ID；来源与未覆盖层见docs/WORLD-MAP-v1.12.md。state.location保留兼容宏观地区，state.position存真实可解析县市、精度和月份，已完成迁居才提交。

- 1.13 country-catalog按history、启动effect/on_action与ZZZ覆盖解析最终开局状态，保留条件未确定记录；不等同运行完整HOI4脚本引擎。PRK政府为法西斯专政、主体思想。opening-control将MOD控制与现实行政单位关联，多方或映射不确定处明确标注，不把采样比例当面积比例。territory/worldOverrides继续优先。faction-flags收录全部尺寸的旗帜标识并按cosmetic、控制TAG、已知路线选择，玩家新势力匹配标识注明拟用。PWA地方地图及旗帜按需校验缓存。来源见docs/COUNTRIES-v1.13.md、OPENING-CONTROL-v1.13.md与FLAGS-v1.13.md。

- 1.14 不确定市县使用 territory-simulation 按人生种子和区划ID建立固定控制，原始opening-control证据保留；明确接管/停火优先。world-map按ownerId着色，frontline叠attackerId斜纹，战时广域影响不覆盖势力色。fragmentedCountryIds指导县级层提前展开。界面不再显示被用户删除的来源说明，来源与许可留在资源文件与文档。opening-relationships初始化普通新人物家庭，真实隐藏人物只复用档案，referenceRequired无参考图保留空缺。旧档仅证据迁移，不能随机补在世亲属。详见docs/RELEASE-v1.14.md。

- 1.15 本轮用户明确要求不运行游戏测试，测试交由人类完成。此指令优先于上面的默认测试约定；本轮仅静态审查、编译封装与发布，不进行测试脚本、模拟游玩、浏览器验收或真实模型调用。GitHub 本轮提交使用 [skip ci] 避免自动游戏测试。

- 1.15 economy 保存本人已完成收支，短期就业按经历次数到期，长期就业才继续发薪；旧档按原始行动迁移，不补算历史余额。personal-health 保存诊断、待检、照护与知情联系人，正文继续承接身体变化，未告知亲友不自动知道。political-actors 约束活动的实际职权；PAL适配社会民主主义并保留原思想来源。personal-cast 限制弦卷心只在本人选择或主动引入后出现，不把MOD未来经历当作开局事实。
