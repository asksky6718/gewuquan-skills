# 选择器真相对照表

> 实测结论：AiToEarn 控制台交互控件**几乎全部用 `data-testid`**；用 `id` 定位会大面积失败。
> 唯一真 `id` 是正文编辑器 `#mention-input-editor`。以下为常用项对照（以本实例实测为准）。

## 一、账号与作品

| 用途 | 选择器 | 备注 |
|---|---|---|
| 新建作品按钮 | `[data-testid=accounts-new-work-btn]` | 发布页入口 |
| 账号头像项 | `[data-testid=publish-account-item-<平台>_<uid>]` | **可多选**；`<平台>`/`<uid>` 按实际替换 |
| 已选态判据 | `className` 含 `--publish-account-platform-border` | 含 `border-transparent` ＝ 未选 |

## 二、发布对话框（发布作品 tab）

| 用途 | 选择器 | 备注 |
|---|---|---|
| 标题输入 | `[data-testid=publish-title-input]` | **各平台字数上限不同**（如小红书实测上限 16） |
| 媒体输入 | `[data-testid=publish-file-input]` | 本身 `multiple`，**直接 `set_input_files`** |
| 上传本地按钮 | `publish-upload-local-button` | **不要用**：不触发文件选择器 |
| 下一步 | `[data-testid=publish-customize-button]` | 进预览页 |
| 定时触发 | `[data-testid=publish-schedule-trigger]` | 「立即发布 ▾」 |
| 定时确认 | `[data-testid=publish-schedule-confirm-button]` | — |
| 提交 | `[data-testid=publish-submit-btn]` | 插件接管点 |
| 立即发布 | `publish-now-button` | — |
| 关闭 | `publish-close-button` | 点不动时用 JS 直点或 `Escape` |
| 草稿箱 | `draftbox-*` 系列 | 同为 `data-testid` |

## 三、正文编辑器（唯一真 `id`）

| 用途 | 选择器 | 备注 |
|---|---|---|
| 正文 | `#mention-input-editor` | contenteditable；先 `click()` 再 `keyboard.type()`；`#` 触发话题 |

## 四、遮罩

「系统检测到您有未完成的发布记录，是否要恢复？」遮罩会 `intercepts pointer events`，挡住一切点击。

- 正确关法：精确匹配 `get_by_role("button", name="不恢复", exact=True).click()`
- **不要**用 `name="恢复"`：strict mode 下会匹配到 2 个元素报错

> 选择器可能随控制台版本变化；**以实跑为准**，失效时以原始 DOM 重新提取并回填本表。
