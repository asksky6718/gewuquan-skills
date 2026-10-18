# 变更记录

## 1.0.0 — 2026-10-13

**首版**。由「AiToEarn 分发实测底稿」升格为正式技能包，按技能包骨架规范重排：

- **结构调整**：单文件 → 「根路由 ＋ 4 个子技能六段 ＋ 5 份 references」，补齐 README / CHANGELOG / VERSION / LICENSE / manifest.json。
- **参数化（对外）**：正文**去除第三方实例域名与一切凭据**；平台地址与账号一律占位符，由使用者自填。
- **内容保留并细化**：
  - 插件安装（CRX 解包 → Chromium 加载 → 域允许 → cookies）与就绪判据；
  - 账号绑定与**只读接口核对**（`status` 字段）；
  - 发布四步流 ＋ `data-testid` 选择器真相 ＋ 单账号纪律；
  - 定时发布不生效、草稿仅本地两条已知限制；
  - 排障清单与未授权响应判据（HTTP 200 ＋ 业务 `code=401`）。
- **新增**：Playwright CDP 驱动骨架（`references/driving.md`）、平台覆盖口径（`references/platform-coverage.md`）。
- **护栏**：对外发布＝人类门禁；不代登录、不代发布他人内容；凭据不入正文与产出物。
