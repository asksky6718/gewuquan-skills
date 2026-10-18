# 变更记录 · compliance-copy

## [1.0.0] — 2026-10-10

> **首个版本**：宣传文案逐句合规自查技能包，对齐《技能引擎契约 v1.0》的 `compliance` 引擎。

### 新增
- `SKILL.md` —— 唯一事实源：frontmatter（`name` / `version` / `summary` / `min_scope` / `tags` 等）＋ 七段正文（这个技能解决什么 · 典型触发句 · 输入 · 输出 · 人工把关点 · 口径来源 · 边界）。
- `references/engine.json` —— 引擎声明 `{"engine":"compliance","rules":"rules.json"}`。
- `references/rules.json` —— 业务规则唯一事实源：
  - `words` 词表 15 条（含 `包过`、`保过`、`包拿证`、`免考`、`直出`、`内部名额`、`保就业`、`人社部授权`、`年审激活费`），每条带 `level` 与 `suggestion`；
  - `patterns` 风险模式 8 条（保证通过、绝对通过率、免考免学、内部名额、假冒授权、退款承诺、就业承诺、绝对化用语）；
  - 公共字段：`outputs`、`boundary`、`declarations`、`evidence`、`fields`、`sample`。
- `references/口径来源.md` —— 违禁词依据＝《广告法》《反不正当竞争法》及平台规则的公开口径，不引用内网文件。
- `references/人工把关点.md` —— 机器不代办的步骤清单。
- `README.md` / `LICENSE`（MIT） / `VERSION`。

### 边界
- **只标风险，不给「能发」结论**；最终以市场监督管理部门与平台规则为准；不替代法律意见。
