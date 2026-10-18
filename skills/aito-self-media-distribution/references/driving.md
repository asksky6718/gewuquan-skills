# Playwright CDP 驱动骨架

> 原理：**不要**用 Playwright 自己开浏览器（那样扩展不一定加载、登录态也不在）；而是**连到使用者已启动的那个浏览器**——扩展、profile、登录态全都在里面。

## 一、前置

浏览器须以**固定 profile ＋ 远程调试端口**启动（参数同 `../skills/plugin-setup/SKILL.md` 步骤 3）：

```
--remote-debugging-port=<端口>
--user-data-dir=<本机 profile 目录>
--load-extension=<解包目录>
```

启动后本机 `http://127.0.0.1:<端口>/json/version` 应可读。

## 二、连接骨架

```python
from playwright.sync_api import sync_playwright

CDP = "http://127.0.0.1:<端口>"

with sync_playwright() as p:
    b = p.chromium.connect_over_cdp(CDP)
    ctx = b.contexts[0]                      # 复用使用者现有上下文（含扩展与登录态）
    # 找到已打开的控制台页；没有则自行 navigate
    pg = [x for x in ctx.pages if "/accounts" in x.url][0]
    pg.bring_to_front()

    # ……按 ../skills/publish/SKILL.md 的步骤操作……

    b.close()                                # 断开连接，不关使用者的浏览器
```

## 三、要点

| 要点 | 说明 |
|---|---|
| **复用 `contexts[0]`** | 新建 context 会丢掉扩展与登录态 |
| **`bring_to_front()`** | 保证页面在前台，避免渲染与点击异常 |
| **禁 `goto`/`reload` 当"重置"** | 一 reload 对话框即关闭；只在需要彻底清态时用 |
| **`click(force=True)`** | 控件被遮挡时用；先尝试关掉遮罩再点 |
| **`set_input_files`** | 媒体一次性传多条（input 本身 `multiple`） |
| **解释器** | 用**使用者本机已装**的 Python（本技能不指定路径、不装包） |

## 四、环境自检（缺依赖就别硬跑）

```
□ python -c "import playwright" 无报错
□ http://127.0.0.1:<端口>/json/version 可读
□ ctx.pages 里能看到控制台页
```

任一不满足 → **如实报告缺什么**，不要伪造结论。
