# 变更记录 · org-diagnose

格式：`x.y.z ｜ 日期 ｜ 变更`

## 1.0.0 ｜ 2026-10-10 ｜ 首版

- 新增可执行技能包 `org-diagnose`（机构经营诊断），引擎声明 `diagnose`（见 `references/engine.json`）。
- 依据既有经营诊断业务逻辑与知识库出处，落为 `references/rules.json`：五段诊断规则、三类方案、30 天清单、说明与出处目录。
- 入参四字段：机构类型（select）、主营项目（text，2–60 字）、机构规模（select）、当前卡点（textarea，4–200 字）；样例见 `sample`。
- 文案已按合规口径处理：三类方案与诊断建议不含经营承诺话术，只给建议动作。
- 配套人读件：`references/口径来源.md`（条目出处与当前口径）、`references/人工把关点.md`（必须人做的步骤）。
