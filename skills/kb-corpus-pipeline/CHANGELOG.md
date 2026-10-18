# 变更记录 · kb-corpus-pipeline

## [1.0.0] — 2026-10-12

> **首个版本**：知识库生产线的第 1–4 段工具化为技能（采集 / 纠偏 / 清洗 / 分类），
> 产出对齐既有入库契约的候选条目包。

### 新增

- `SKILL.md` —— 唯一事实源：frontmatter（`name` / `version` / `summary` / `min_scope` / `tags` / `complexity` 等）＋ 四段流水线、硬门、契约、边界。
- `scripts/lib.mjs` —— 零依赖公共库（sha256_16 / 元信息头剥离 / 二元组相似度 / 参数解析 / 文件遍历）。
- `scripts/wordlist.mjs` ＋ `references/internal-wordlist.json` —— 内部词表（与技能上架门禁同源；含内部标识的模式分段存储以自过门禁）。
- `scripts/collect.mjs` —— 第 1 段采集：**仅 GET**，逐条留 `url` + `fetched_at`；支持 `--fixtures` 离线复跑。
- `scripts/verify.mjs` —— 第 2 段纠偏：白名单域名 + 权威文本比对，输出**有依据 / 存疑 / 无依据**；无依据不进候选；问句挂答句、不参与事实判定。
- `scripts/clean.mjs` —— 第 3 段清洗：精确去重 + 近似去重（二元组包含度）、去 YAML 元信息头、一问一条；**内部词表命中即整批拒绝（退出码 3）**。
- `scripts/classify.mjs` —— 第 4 段分类：归入 `concepts` / `entities` / `faq`，打 `domain` 与 `subject_domain`，生成 `manifest.json` 与分布统计。
- `scripts/pipeline.mjs` —— 四段编排 + 总报告；`scripts/selftest.mjs` —— 离线自测 S1–S9（含隔离入库 +N 与幂等复跑）。
- `references/engine.json` / `authority.example.json` / `domains.example.json` / `corpus-contract.md` / `人工把关点.md` / `retrieval-trace.md`。
- `test/fixtures/` —— 离线自测素材（权威源节选 + 原始素材；含无依据、近似重复、元信息头三种用例）。
- `README.md` / `LICENSE`（MIT） / `VERSION`。

### 边界

- 只做第 1–4 段；不代审查/入库/调取；不改门户/网关/技能目录；不发布/留言/注册。
- 候选条目未经人类放行不得对外；技能上架归人类门禁。
