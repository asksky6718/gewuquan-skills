# 平台 · 技能库（Gewuquan Skills）

> 平台的技能（插件）以**本仓库**为对外发布载体。平台站点只保留仓库链接与复制提示词，不再在站内做市集陈列。

## 这是什么

每个目录是一个技能包，结构遵循：

```
skills/<skill_id>/
  SKILL.md            # frontmatter（name/description/version/complexity/min_scope）+ 正文
  references/         # 规则、模板、清单等随包资产
```

`SKILL.md` 的 frontmatter 至少包含：`name`、`description`、`version`、`complexity`（S/M/L/XL）、`min_scope`（read/write/admin）。

## 两种用法

**一、直接取（开发者）**
```bash
git clone https://github.com/asksky6718/gewuquan-skills.git
# 把 skills/<skill_id> 放进你的智能体技能目录
```

**二、让智能体自己取（推荐）**
把下面这句提示词贴进你的智能体：

> 到平台取技能：调用 `skill_list` 看全部技能，用 `skill_fetch` 取你要的那一个，按其 `SKILL.md` 安装并执行。端点 `https://www.gewuquan.cn/mcp/gewu`，凭据用我的 Bearer。

## 接入平台

- 端点：`POST https://www.gewuquan.cn/mcp/gewu`（streamable-http）
- 鉴权：`Authorization: Bearer <你的凭据>`（在门户注册后领取）
- 相关能力：`skill_list`／`skill_fetch`／`skill_invoke`／`kb_search`／`kb_answer`

## 收录与审核

技能进入本仓库前要过四道门：① 内部词表零命中 ② 结构合规与指纹固定 ③ 智能体预审（教育相关性）④ 人类放行。详见 [SUBMISSION.md](SUBMISSION.md)。

## 许可证

**MIT License**（见 [LICENSE](LICENSE)）｜版权 2026 海南协作方维护方职业教育有限公司。

可以自由使用、修改、分发、商用，保留版权与许可声明即可。技能随附的规则、模板与说明文字与代码同许可。

## 维护

- 主体：海南协作方维护方职业教育有限公司
- 维护：平台技术侧（运行时 维护方）
- 问题与建议：开 Issue
