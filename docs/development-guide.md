# MAPI 数据接入中心｜开发对接说明

## 1. 原型范围

当前仓库是可交互前端原型，用于运营、产品与开发确认信息架构、字段和操作路径。页面中的数量、异常账户、媒体返回信息均为模拟数据。

## 2. 角色和权限

| 能力 | 普通运营 | 高级运营 / 产品 |
|---|---:|---:|
| 查看总看板和异常明细 | 是 | 是 |
| 新增已接入渠道账户 | 是 | 是 |
| 配置新渠道鉴权 | 否 | 是 |
| 查看敏感凭证明文 | 否 | 否 |

建议后端返回权限点，前端只负责展示控制，不能只靠前端隐藏按钮实现鉴权。

## 3. 普通运营新增账户

### 输入字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `channel_code` | string | 是 | 渠道枚举值 |
| `account_id` | string | 是 | 媒体广告账户 ID，不能按数字类型存储 |
| `start_date` | date | 是 | 账户开始投放时间，也是历史补拉起点 |
| `report_levels` | string[] | 是 | 账户/计划/单元/创意/素材/关键词 |
| `metrics` | string[] | 是 | 从该渠道已配置的 oCPX 事件中选择 |

### 提交流程

1. 校验账户格式及重复配置。
2. 校验账户真实存在和授权范围。
3. 按选择的最细报表粒度真实试拉小时间窗。
4. 校验必需维度、指标及唯一键。
5. 创建从 `start_date` 开始的历史补拉任务。
6. 加入每日增量同步。

## 4. 高级运营 / 产品新增渠道

### 输入字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `channel_code` | string | 是 | 渠道枚举值 |
| `product_code` | string | 是 | 有道词典/翻译官/叭哥说等 |
| `credential` | object | 是 | 字段随渠道变化，仅发送到安全凭证服务 |
| `scope_type` | enum | 是 | `manager` 或 `single_account` |
| `scope_id` | string | 是 | 账户管家 ID 或广告账户 ID |

### 各渠道鉴权字段（原型阶段）

| 渠道 | 字段 |
|---|---|
| 百度搜索 | Access Token、API Key |
| 360 搜索 | Access Token、API Key |
| Bing | OAuth Token、Developer Token、Customer ID |
| 腾讯广告 | Access Token |
| 巨量引擎 | Access Token |

正式开发需根据实际媒体开放平台文档补充，例如 refresh token、account ID、customer account ID 等，不能直接以原型字段作为最终接口契约。

## 5. 建议接口

```text
GET  /api/v1/dashboard/summary
GET  /api/v1/accounts/exceptions
GET  /api/v1/channels
GET  /api/v1/channels/{channel_code}/metrics
POST /api/v1/accounts/validate
POST /api/v1/accounts
GET  /api/v1/channels/{channel_code}/credential-schema
POST /api/v1/channels/connection-test
POST /api/v1/channels
GET  /api/v1/jobs/{job_id}
```

异步操作（真实试拉、补拉、异步媒体报表）建议统一返回 `job_id`，由前端轮询或通过 SSE/WebSocket 接收状态。

## 6. 安全要求

- 浏览器不持久化 Access Token、API Key、Developer Token、OAuth Token。
- 凭证仅通过 HTTPS 发送给专门的凭证服务，并加密存储。
- 日志、异常追踪和媒体原始响应必须脱敏。
- 重新授权后保留审计记录，不回显旧凭证。
- 每次试拉和配置变更记录操作者、时间、渠道、范围及结果。

## 7. 状态模型建议

| 状态 | 含义 | 是否需要人工处理 |
|---|---|---:|
| `healthy` | 最近任务成功且数据完整 | 否 |
| `delayed` | 媒体报表尚未生成或短暂延迟 | 通常否 |
| `auth_expired` | Token/OAuth 失效 | 是 |
| `permission_denied` | 授权范围或账户权限不足 | 是 |
| `schema_changed` | 媒体字段发生变化 | 是 |
| `data_invalid` | 重复主键、缺字段或指标异常 | 是 |
| `retrying` | 系统正在自动重试 | 否 |

## 8. 第一阶段验收标准

- 普通运营能在 3 分钟内完成一个已接入账户配置。
- 敏感鉴权信息不出现在前端存储和普通业务日志中。
- 试拉能区分授权错误、报表延迟、字段异常和服务异常。
- 新账户配置成功后可查看历史补拉进度及每日同步状态。
- 总看板数字与账户明细可互相核对。
