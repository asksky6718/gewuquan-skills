---
name: publish
description: AiToEarn 发布作品四步流（新建作品→填内容→下一步→定时或立即→发布），含选择器真相与单账号纪律。当用户说「发一条」「发布作品」「上传图文」「排期发布」时使用；须插件已就绪且目标账号 status=1，否则停下先做前置。
---

# 发布作品

## 用途

把「一条待发内容 ＋ 一个有效账号」变成一条**已发出**的记录；**只到「记录出现」为止，不代表内容合规由技能背书。**

## 何时用

- 用户说：发一条 / 发布作品 / 上传图文 / 排期发布
- 上游给到了：**插件已就绪** ＋ 目标账号 `status=1` ＋ 内容（标题/正文/媒体）
- 任一前置不满足就停，先回 `skills/plugin-setup/SKILL.md` 或 `skills/account-bind/SKILL.md`

## 输入

| 项 | 形态 | 从哪来 | 缺了怎么办 |
|---|---|---|---|
| 内容标题 | 文本 | 用户 / 内容线 | 停下先要；**注意目标平台标题字数上限不同** |
| 正文 | 文本 | 同上 | 停下先要 |
| 媒体文件 | 图片/视频文件 | 同上 | 停下先要；视频类账号必须有视频 |
| 目标账号 | 一个（**仅一个**） | 账号状态核对表 | 未核对则先核对 |
| 实例域名 | URL | 用户 / 部署方 | 停下先要 |

## 步骤

1. 打开发布页（`/accounts`）→ 点 `[data-testid=accounts-new-work-btn]`「新建作品」→ 弹对话框；**右侧「发布作品」tab 默认激活**。→ 结果：对话框打开，右侧 tab 为选中态。
2. **先清遮罩**：若出现「系统检测到您有未完成的发布记录，是否要恢复？」提示，它会拦截所有点击 → 用**精确匹配**关掉：`get_by_role("button", name="不恢复", exact=True).click()`。→ 结果：遮罩消失，可点到底层控件。
3. 填标题 → `[data-testid=publish-title-input]`。→ 结果：标题框回显输入值。
4. 填正文 → 真 `id` 为 `#mention-input-editor`（contenteditable）：先 `click()` 再 `keyboard.type()`；`#` 触发话题。→ 结果：正文区回显文本。
5. 传媒体 → `[data-testid=publish-file-input]`，**直接 `set_input_files(...)` 传多条**（该 input 本身 `multiple`）；**不要用** `publish-upload-local-button`（它不触发文件选择器）。→ 结果：缩略图出现，文件计数与实传数一致。
6. 点 `[data-testid=publish-customize-button]`「下一步」→ 进入预览页（此后仍可见 `publish-submit-btn`）。→ 结果：预览页渲染出所填内容。
7. **选账号（一次只选一个）**：账号项 `[data-testid=publish-account-item-<平台>_<uid>]` 是 **可多选** 的；选中态判据 ＝ `className` 含已选标记（`--publish-account-platform-border`），含 `border-transparent` 为未选。→ 结果：**有且仅有一个**账号处于选中态。
8. （可选）定时：底部 `[data-testid=publish-schedule-trigger]` → 打开定时选择器 → 选日期/时间 → `[data-testid=publish-schedule-confirm-button]`「确认」。**注意：实测定时不生效，见 `references/pitfalls.md`**，需要真排期请改走外部触发。
9. 点 `[data-testid=publish-submit-btn]`「发布」→ 插件接管，弹出「自动发布(N)」进度 → 完成后显示作品 ID 与分享链接。→ 结果：拿到作品 ID / 分享链接。
10. **回读核对**：`GET <实例域名>/api/v2/channels/publish/records?time=<ISO起>,<ISO止>` 读最新记录（`publishTime` / `accountType` / `status` / `title` / `platformWorkId` / `workLink`）。→ 结果：记录里出现该条，`publishTime` 是**当前时刻**（印证定时不生效）。

## 护栏

- **不得同时选多个账号**；含视频类账号（视频号/B站）时若只给图文，点发布会**静默无响应**。切换账号用 `click(force=True)`。
- **不代他人发布对外内容**：对外可见内容须**先经负责人过目**再发。
- **禁把 `goto`/`reload` 当"重置"**：一 reload 对话框即关闭，只在需要彻底清态时用。
- 拿不准按钮是否被遮挡时，统一话术：**「先关掉遮罩提示；仍无响应就改 `click(force=True)`」**。
- 「保存草稿」只在本地（`localStorage`），**不落服务端**，换机即失 —— 别把它当排期登记。

## 产出物

- 一条发布记录（作品 ID ＋ 分享链接 ＋ 回读到的 `publishTime`）—— 交使用者确认；失败项转 `skills/troubleshoot/SKILL.md`。
