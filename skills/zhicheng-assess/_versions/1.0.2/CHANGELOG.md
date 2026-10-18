# 变更记录（CHANGELOG）

本文件记录 `zhicheng-assess` 技能包的历次变更。
版本口径：**规则或口径有变 → 升版本；只补发布要件 → 同样升版本**，每次都留痕。

---

## 1.0.2 — 2026-10-11

- 补申报 `complexity: M`（本技能为多步规则判定：逐年比对 → 差项 → 补法 → 下一步）。
- 背景：`complexity` 字段于 T-97/T-99 引入，用于技能调用的积分定价（S/M/L/XL = 1/3/8/20）；在册技能未申报时按缺省 `S` 计价，与本技能实际复杂度不符。本次申报后按 **M（3 积分/次）** 计价。
- 放行留痕：属「技能数据面」变更，经待人类放行队列（`skills/pending.jsonl`）提交，人类放行后登记 `approvals.log`。

## 1.0.1 — 2026-10-10

**主题**：口径校正（T-94 D1）。业务显示名由「职称评审自评」改为「**职业技能等级认定·自评**」，明确业务对象＝人工智能训练师职业技能等级认定（五级／初级工 → 一级／高级技师）；「职称」只保留为部分申报路径的条件表述。
**范围**：`SKILL.md`（`display_name`／`description`／`summary`／`tags`／`triggers`／正文 H1 与触发句）＋ `README.md` ＋ `references/rules.json` 的 `outputs` 文案 ＋ `VERSION`。**规则结构、技能 id、文件路径一律不动**。

---

## 1.0.0 — 2026-10-10

**主题**：首个版本。把「职业技能等级认定·自评」的申报条件规则从页面逻辑抽成技能包数据，交通用 `assess` 引擎执行。

### 新增
- `SKILL.md`：frontmatter（触发语、边界、字段清单）＋ 正文七节（这个技能解决什么 / 典型触发句 / 输入 / 输出 / 人工把关点 / 口径来源 / 边界）。
- `references/engine.json`：声明 `engine: assess`、`rules: rules.json`。
- `references/rules.json`：
  - 公共字段：`outputs` / `boundary` / `declarations` / `evidence` / `fields` / `sample`；
  - `level_names`、`min_age: 16`；
  - 业绩提示：`achievement_note_threshold: 3` 与含 `{count}` 占位符的 `achievement_note`；
  - 补贴口径：`subsidy_levels: [3,4,5]`、含 `{level}` 占位符的 `subsidy_note` 与 `no_subsidy_note`；
  - `levels`：五级 → 一级共 17 条申报路径，逐条改成契约谓词 DSL（`cert_at_least` / `title_at_least` / `edu_at_least` / `edu_extra_in` / `major_is` 与数值比较 `all` 组合），阈值与源逻辑逐条对齐；
  - `next_steps` 3 条、`uncovered` 4 条（保留「本条库里没有」字样）。
- `references/口径来源.md`：6 条知识库条目的原始标题与 id 对照。
- `references/人工把关点.md`：必须本人做的步骤逐条列出。
- `README.md` / `VERSION` / `LICENSE`（MIT）。

### 说明
- 规则数据**不含写死结论**：能满足哪一级、差哪几项、怎么补，全部由 `assess` 引擎按 `rules.json` 现算。
- 抽样口径：本科 / 相关专业 / 工作 6 年 / 无证书 / 无职称 / 业绩 2 条 → 满足四级，下一级（三级）6 条路径全未满足，并附业绩补充提示。
