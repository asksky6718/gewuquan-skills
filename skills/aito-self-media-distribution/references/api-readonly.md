# 只读 API 清单与鉴权取法

> 全部为**只读**端点，用于核对账号与发布记录。**不提供发布写接口**（见文末）。

## 一、鉴权取法

在**控制台页面上下文**里取 token，作为请求头 `Authorization: Bearer <token>`：

```js
JSON.parse(localStorage.getItem('User')).state.token
```

> token 属敏感信息：**只用于当次核对，不写入产出物、不入对话、不入技能**。

## 二、只读端点

基址 ＝ `<你的部署域名>/api/v2`。

| 用途 | 方法 | 路径 | 关键字段 |
|---|---|---|---|
| 账号清单 | GET | `/channels/accounts` | 每账号 `status`（1＝有效）、`fansCount`、`type` |
| 发布记录 | GET | `/channels/publish/records?time=<ISO起>,<ISO止>` | `publishTime` / `accountType` / `status` / `title` / `platformWorkId` / `workLink` |
| 账号分组 | GET | `/channels/account-groups` | 分组结构 |

## 三、未授权响应形态（判据）

未带 token 访问只读端点，服务端返回 HTTP 200 但响应体为业务错误码，例如：

```json
{"data":{},"code":401,"message":"Unauthorized","timestamp":0,"requestId":"..."}
```

⇒ **看响应体 `code`，不要只看 HTTP 状态码**；`code=401` ＝ 未授权/凭据失效。

## 四、发布无公开写端点

实测 `POST /api/v2/channels/publish`、`/channels/publish/records`、`/channels/publish/drafts` 均 404。

⇒ **发布记录由浏览器插件回填**；不要试图用 API 直接发布。
⇒ 需要批量/自动化发布时，走浏览器自动化通道（见 `driving.md`），并遵守 `skills/publish/SKILL.md` 的护栏。
