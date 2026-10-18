---
name: aito-self-media-distribution
description: AiToEarn 多平台自媒体分发控制台的完整操作技能（面向自部署实例；平台地址与账号由使用者自填）。覆盖浏览器插件安装与就绪、账号绑定、Playwright CDP 自动化驱动、发布四步流与 data-testid 选择器真相、单账号发布纪律、定时发布不生效的坑与绕法、草稿仅存本地、只读 API 核对与排障。当需要在 AiToEarn 上发布/登记小红书、微信视频号、B站等内容，或排查插件未就绪、发布按钮无响应、排期不生效、上传报错等问题时使用。
display_name: AiToEarn 自媒体分发
version: "1.0.0"
description_zh: AiToEarn 分发操作技能：插件安装、账号绑定、发布四步流、只读核对与排障。
summary: 在 AiToEarn 控制台做多平台自媒体分发：插件安装、账号绑定、发布与排障。
user-invocable: true
category: work
argument-hint: "[可选：安装 / 绑定 / 发布 / 排障 / 核对]"
allowed-tools: [Read, Write, Edit, Grep, Glob, Bash]
min_scope: write
tags: [social-media, publishing, browser-automation, playwright, self-hosted]
triggers: [自媒体分发, 多平台发布, 小红书发布, 视频号发布, B站发布, 插件未就绪, 发布没反应, 排期不生效, 账号绑定, aito]
complexity: M
---

# AiToEarn 自媒体分发（操作技能）

按用户意图 **`Read`** 对应环节的说明，再动手。**先查「路由判定表」定去向，再看「通则」。**

> **本技能面向自部署实例**：平台地址 ＝ **你自己部署的实例域名**；账号 ＝ **你在该实例绑定的平台账号**。
> 技能内所有地址与账号位置一律用**占位符**，由使用者自填；**技能不含、也不指向任何第三方实例与凭据**。

**一句话机制**：控制台页面本身**不发**发布请求——点「发布」后由**浏览器扩展**打开目标平台页、自动上传并回填记录。所以**插件就绪是第一前提**，插件不成就什么都发不出去。

## 能力总览

| 能力 | 做什么 | 入口 |
|---|---|---|
| **插件就绪** | 装扩展、解包加载、加域允许、授 cookies 权限，确认控制台显示「浏览器插件 已就绪」 | `skills/plugin-setup/SKILL.md` |
| **账号绑定** | 在控制台绑定目标平台账号，并用只读接口核对 `status` | `skills/account-bind/SKILL.md` |
| **发布作品** | 走「新建作品 → 填内容 → 下一步 → 定时或立即 → 发布」四步流 | `skills/publish/SKILL.md` |
| **排障核对** | 现象→处置清单；只读接口核对账号与发布记录 | `skills/troubleshoot/SKILL.md` |

## 路由判定表

「须点名」= 只有用户明确说出该行触发词才进入。

| 用户这样说 | 前置门禁（不满足就停下说明） | 进入 | 明确不要做 |
|---|---|---|---|
| 插件没装 / 插件未就绪 / 发布没反应 | 需先知道实例域名；没有就先问 | 插件就绪 | 不代使用者登录其平台账号、不代扫码 |
| 绑定账号 / 加频道 / 账号状态 / 发现 N 个账号有问题 | 须插件已就绪 | 账号绑定 | 不代填平台口令、不代点授权 |
| 发一条 / 发布作品 / 上传图文 / 排期 | 须插件已就绪 ＋ 目标账号 `status=1` | 发布作品 | **不得同时选多个账号**；对外可见内容须先经负责人过目 |
| 报错 / 点了没反应 / 排期不生效 / 上传失败 | 需给出**现象原话**与当前步骤 | 排障核对 | 不猜结论，须以实跑证据为准 |
| 支持哪些平台 / 换平台 / 能不能发某平台 | — | 读 `references/platform-coverage.md` | 不对未接入平台作承诺 |

## 通则

- **根只做路由**：业务步骤一律在 `skills/<环节>/SKILL.md` 与 `references/`；本文件不装正文。
- **地址与账号只写占位符**：形如 `<你的部署域名>`、`<你在本实例绑定的账号>`；**禁写第三方实例域名与任何口令/Key**。
- **选择器以实测为准**：`publish-*` / `accounts-*` / `draftbox-*` **全是 `data-testid`，不是 `id`**；唯一真 `id` 是 `#mention-input-editor`。
- **一次只操作一个账号**：多账号同选会让「发布」按钮静默无响应（详见 `references/pitfalls.md`）。
- **对外发布是人类门禁**：技能负责「把内容准备好、发到自己的账号」；**对外可见内容须先经负责人过目**，代他人发布不作承诺。
- **脚本归属**：本包不附脚本；驱动用使用者本机已装的 Playwright，骨架见 `references/driving.md`。
- **占位符统一**：未填内容一律以固定占位形式标注（`TODO` ＋ 尖括号内字段名），**禁止空字符串占位**。
- **只报事实**：核对只输出「读到的值」与「与期望是否一致」，不给主观评价与分数。

## 目录

```
SKILL.md
references/driving.md            # Playwright CDP 驱动骨架
references/selectors.md          # 选择器真相对照表
references/api-readonly.md       # 只读 API 清单与鉴权取法
references/pitfalls.md           # 三条硬纪律与坑
references/platform-coverage.md  # 支持平台以本实例控制台为准
skills/plugin-setup/SKILL.md
skills/account-bind/SKILL.md
skills/publish/SKILL.md
skills/troubleshoot/SKILL.md
README.md  CHANGELOG.md  VERSION  LICENSE  manifest.json
```

## 环境与约定

- **默认语言**：面向用户的一切文本用简体中文；`name` / 目录名 / 字段名用英文小写连字符。
- **运行环境**：浏览器 ＝ 以**固定 profile** ＋ **远程调试端口**启动的 Chromium（版本以使用者本机为准）；驱动 ＝ Playwright Python；解释器用使用者本机已装的那一个。
- **依赖**：不自动安装任何包；缺 Playwright 时报错退出，由使用者自行准备。
- **网络**：本技能自身不发起网络请求；一切操作经使用者浏览器与控制台完成。
- **用户产出**：无脚本落盘；技能只给操作步骤与判据。
- **版本口径**：流程或选择器有变 → 升版本，并同时改 `VERSION` 与 `CHANGELOG.md`。

## 执行前核对

```
□ 已 Read 对应环节的 references/，未把本文件当业务正文
□ 全文无第三方实例域名、无任何口令/Key
□ 无本机绝对路径（盘符路径、类 Unix 家目录）
□ 未填内容一律以固定占位形式标注（`TODO` ＋ 字段名），无空字符串占位
□ 交付回复末块标题为「交付后请确认」
```
