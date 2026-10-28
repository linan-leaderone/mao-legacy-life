# 1.17.2：网页兼容连接与等待处理

本版处理网页版反复出现“无法连接”和60秒等待结束的问题。内置Gemini、ShiWuYan增加同源兼容通道，保留直接连接；三组授权默认密钥、人物资料和人生存档沿用原配置。源码版本1.17.2，Android versionCode 21，连接配置版本仍为9。产物及部署完成情况见 [验证记录](VERIFICATION.md) 与 [iOS验证记录](IOS-VERIFICATION.md)。

## 连接与等待

- 公开PWA内置Gemini/ShiWuYan仅在地址准确指向`https://aiapi.shiwuyan.cn`的`/v1`或`/v1beta`时，默认`route:auto`经本站`/api/relay`访问供应商。首页和设置可改为`direct`。DeepSeek官方、自定义入口、其他主机和原生客户端继续直连，失败不自动改通道或重发。
- 所有服务的一次生成与最多一次行文修订共用180秒预算；模型目录及分页共用15秒。各生成入口复用精简提示，保留行动、当前状态与结算事实。
- 等待区显示实际经过秒数、正在连接/等待/接收等阶段及通道。没有百分比或虚构完成进度。用户可取消等待；取消与超时分别提示，失败保留原月、安排和未提交结果。

兼容Worker只接受固定主机、接口路径、分页参数与请求头，限制输入和响应大小，不跟随重定向，不缓存或重发请求。它仅在内存处理本次传入的凭据和内容，不写应用日志、数据库或持久记录。NDJSON每10秒发一条等待心跳，最终发送一份完整结果；心跳不会产生新模型调用。取消通过请求信号及流取消事件传递到上游。

## 发布结构

继续使用原公开Site及其项目ID。`pnpm build:ios`输出`dist-ios`，`scripts/prepare-ios-site.mjs`将已有站点静态内容迁入`dist/client`并复制新构建，写入`dist/server/index.js`和绑定`ASSETS`的wrangler配置。脚本默认保留旧散列；归档资源超限时仅按当前清单清理不再引用的历史哈希JS/CSS，当前资源、地图与立绘不在清理范围。移除清单的`static`项后按Worker方式部署，地图、旗帜、肖像及其他静态资产仍通过同一网站提供。公开源码继续排除所有密钥。

已安装PWA获取更新后，关闭相关网站标签页和主屏幕窗口，再重新打开激活新版本；不强制刷新正在进行的行动。无需清除网站数据或人生存档。

## 检查边界

遵照用户要求，本轮不运行游戏测试、模拟月度推进、浏览器游玩或有效模型生成。检查限于静态审查、编译封装、部署健康及只读模型目录网络诊断；具体结果单独写入验证文档。此改动减少浏览器跨域及长时间无响应造成的问题，没有中国大陆各运营商或地区的速度实测，不保证第三方服务的可用性或返回时长。

官方依据：[Cloudflare Static Assets绑定](https://developers.cloudflare.com/workers/static-assets/binding/)、[Request.signal取消处理](https://developers.cloudflare.com/changelog/post/2025-05-22-handle-request-cancellation/)、[Request接口](https://developers.cloudflare.com/workers/runtime-apis/request/)。2026-10-28核对；本部署开启`enable_request_signal`，并显式取消上游fetch。
