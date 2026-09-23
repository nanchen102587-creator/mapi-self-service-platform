# MAPI 真实数据接入工作台

本仓库已同步线上第 19 版源码。平台从零实现媒体接入、真实试拉、核对和补拉保护；不是预置成功数据的演示站，也不会在未收到媒体响应时显示“接入成功”。\n\n在线体验：https://mapi-self-service-next.nan-chen.chatgpt.site

## 巨量引擎：正式 OAuth 接入流程

当前巨量适配范围是巨量广告，不含巨量千川。页面将角色与参数分为三步：

1. 管理员一次配置开放平台应用：应用备注、使用方式、App ID、App Secret、巨量开发者后台为该应用展示的官方授权 URL、实际使用的回调地址，以及是否申请敏感物料授权。
2. 账户管理员在巨量官方页面完成 OAuth 授权。本站用一次性、10 分钟有效且不可重放的 `state` 校验回调，再由后端用 `auth_code` 换取 Access Token 和 Refresh Token；Token 不进入浏览器存储，也不会回显。
3. 平台调用官方账户接口读取已授权账户。直接广告账户进入下拉列表；旧版工作台通过 `customer_center/account/list` 展开；升级版工作台通过 `ebp/advertiser/list` 展开；代理商和纵横组织通过对应官方接口展开。页面分开展示三类账户来源。运营选择媒体返回的广告账户、日期和粒度后执行真实试拉。

Access Token 在每次拉数前检查，距离到期不足 5 分钟时由后端使用 Refresh Token 自动刷新并原子更新加密令牌。Refresh Token 过期、媒体解除授权或刷新失败时，授权状态转为“需要处理”，页面提供重新授权入口。有效期完全采用媒体响应中的 `expires_in` 和 `refresh_token_expires_in`，不写死天数。

由于巨量官方后台会在具体应用的管理页展示授权 URL，平台让管理员复制一次该完整地址，而不在代码中猜测。服务端校验当前官方入口 `https://open.oceanengine.com/audit/oauth.html`，并核对 URL 内 App ID 与表单一致；发起授权时自动替换 `state`、`redirect_uri` 和 `material_auth`。回调地址由管理员配置，页面仅把当前站点地址作为一键建议值；也可使用公司自有 HTTPS 域名或网关，但必须把巨量追加的 `auth_code` 与 `state` 通过 302 原样转发给本平台回调，并与巨量后台登记值完全一致。

开发联调仍保留折叠的“Access Token + 广告主 ID”入口，但该方式不能自动续期和发现账户，不作为正式运行方式。

## 巨量报表实现

- 先调用 `GET /open_api/v3.0/report/custom/config/get/` 查询该广告主真实开放的数据主题、维度、指标与互斥约束。
- 再自动匹配标准版 / 升级版的账户汇总、项目 / 计划、广告和素材维度。
- 核心指标要求同时具备 `show`、`click`、`stat_cost` 和媒体实际开放的 `convert`。字段不兼容即失败，不猜测或补 0。
- 调用 `GET /open_api/v3.0/report/custom/get/` 读取单日报表，检查分页、媒体声明总行数和重复维度 ID。当前每页 100 行并完整翻页，超过安全上限整次失败，不保存部分数据。
- 账户粒度由完整报表结果汇总；消耗保留 `stat_cost` 原始十进制字符串，转化口径在调用证据中保留媒体字段说明，仍需与巨量后台同日、同归因口径核对。

## 数据与安全

- App Secret、Access Token、Refresh Token 和手动联调凭证均使用 AES-256-GCM 加密；随机 IV，并用用户 ID 与记录 ID 作为 AAD 隔离。
- 所有 API 均检查登录身份和记录归属；写接口检查 Origin；OAuth 回调使用不可重放 `state` 防止跨站授权混淆。
- GET 接口只返回应用、授权、账户与到期状态，不返回任何密钥或 Token。
- 真实试拉成功后仍需人工核对并确认，才会切换该产品 / 渠道 / 账户 / 日期 / 粒度范围的生效版本。
- 空报表、媒体错误、字段变化、分页不完整、重复源行和并发版本冲突都不能覆盖现有正式数据。历史任务和旧版本保留。

## 其他渠道现状

- Apple Ads v5 已实现 Client ID + Client Secret JWT 换取 Access Token、ACL 组织权限检查，以及计划 / 指定计划下的广告单元 / 广告报表，但尚未使用真实账户验收。
- 腾讯、百度、Bing、小红书、360、华为、小米国内、OPPO、vivo、荣耀尚未开放凭证提交或模拟成功结果。巨量验收完成后再按渠道逐个实现。
- 当前没有每天自动调度、浏览器关闭后可靠执行的任务队列、离线预警通知或自动对媒体后台数。手动拉取和补拉按 UTC 自然日执行。
- 服务端出口 IP 不保证固定；若媒体要求白名单，需要单独的固定出口设施。

## 巨量实际 API

- `POST https://ad.oceanengine.com/open_api/oauth2/access_token/`
- `POST https://ad.oceanengine.com/open_api/oauth2/refresh_token/`
- `GET https://ad.oceanengine.com/open_api/oauth2/advertiser/get/`
- `GET https://ad.oceanengine.com/open_api/v3.0/customer_center/account/list/`
- `GET https://ad.oceanengine.com/open_api/2/ebp/advertiser/list/`
- `GET https://ad.oceanengine.com/open_api/2/agent/advertiser/select/`
- `GET https://ad.oceanengine.com/open_api/2/majordomo/advertiser/select/`
- `GET https://ad.oceanengine.com/open_api/v3.0/report/custom/config/get/`
- `GET https://ad.oceanengine.com/open_api/v3.0/report/custom/get/`

浏览器授权入口仍为 `https://open.oceanengine.com/audit/oauth.html`；上面的 `ad.oceanengine.com` 仅用于服务端换 Token、发现账户和读取报表。请求地址固定在服务端，用户不能输入任意 API URL。报表调用只读，不修改媒体投放。

## 官方依据

| 适配点 | 官方资料 |
|---|---|
| 开始使用与账户体系 | https://open.oceanengine.com/labels/7/docs/1696710508029967?origin=left_nav |
| 应用申请账户授权 | https://open.oceanengine.com/labels/41/docs/1812506430648330?origin=left_nav |
| Token 获取与维护 | https://open.oceanengine.com/labels/41/docs/1812506522148059?origin=left_nav |
| 升级版工作台账户列表 | https://open.oceanengine.com/docs/1829550825614739 |
| 巨量官方 Go SDK | https://github.com/oceanengine/ad_open_sdk_go |
| 自定义报表 | https://open.oceanengine.com/labels/7/docs/1741387668314126 |
| 自定义报表配置 | https://open.oceanengine.com/labels/7/docs/1755261744248832 |
| Apple Ads | https://developer.apple.com/documentation/apple_ads/ |

## 运行与验证

Vinext / React / D1；页面入口为 `app/workbench.tsx`，巨量 OAuth 页面为 `app/ocean-connect.tsx`，业务 API 为 `app/api/mapi/route.ts`，OAuth 回调为 `app/api/mapi/ocean/callback/route.ts`，媒体适配器位于 `lib/mapi`。

生产运行时需要 `CREDENTIAL_ENCRYPTION_KEY`（32 字节随机值的十六进制表示）和 `SITE_ORIGIN`。不要把真实密钥写入 Git；不要随意更换主加密密钥，否则已有凭证将无法解密。正式环境建议保持 owner-only；如需开放访问，应先完成凭证隔离、权限审计和安全评估。

```bash
pnpm db:generate
node scripts/check-mapi.cjs
pnpm build
```

Drizzle 迁移只追加不重写。`scripts/check-mapi.cjs` 使用内存 SQLite 与隔离的媒体响应 fixture，检查登录、Origin、所有权、加密与脱敏、OAuth state、auth_code 换 Token、账户发现、Token 轮换、真实路径解析、空数据保护、幂等保存和版本竞争。它不是巨量真实账户验收。

真实验收仍需要管理员在私有页面填写自己的巨量应用信息并完成官方授权，选择确认有投放的日期，取回报表后与巨量后台逐项对数。
