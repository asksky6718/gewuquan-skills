# 变更记录 · zhicheng-material

## 1.0.0 — 2026-10-10

> **首个版本**：申报材料助手技能包，对齐《技能引擎契约 v1.0》的 `material` 引擎。

### 新增
- `SKILL.md` —— 唯一事实源：frontmatter（`name` / `version` / `summary` / `min_scope` / `tags` 等）＋ 七段正文（这个技能解决什么 · 典型触发句 · 输入 · 输出 · 人工把关点 · 口径来源 · 边界）。
- `references/engine.json` —— 引擎声明 `{"engine":"material","rules":"rules.json"}`。
- `references/rules.json` —— 业务规则唯一事实源：
  - `fields` 4 项（目标等级 `level`、申报通道 `channel`、当前身份 `status`、已具备材料 `known`）；
  - `levels` 5 档、`channels` 3 类、`statuses` 3 类；
  - `base_items` 7 条公共基础项、`level_items` 等级专属项（技师 / 高级技师 / 高级工）、`channel_items` 通道专属项（社会培训评价组织 / 用人单位自主评价 / 技工院校）；
  - `subsidy_item` 与 `subsidy_levels`（三级 / 四级 / 五级附可选补贴申领材料）；
  - 公共字段：`outputs`、`boundary`、`declarations`（4 条）、`evidence`（5 条原始条目标题）、`notes`（2 条）、`sample`。
- `references/口径来源.md` —— 逐条出处与知识库原始条目标题对应，未单列的通用受理要件如实标注。
- `references/人工把关点.md` —— 机器不代办的步骤清单。
- `README.md` / `LICENSE`（MIT） / `VERSION`。

### 边界
- **不代提交／不代签字／不代盖章**；清单末页固定标**须本人核对**；能否报、报哪一级以评价机构与属地人社部门核定为准。
- 只出材料清单与生成指令，不给承诺话术；知识库未单列的口径不编造出处。
