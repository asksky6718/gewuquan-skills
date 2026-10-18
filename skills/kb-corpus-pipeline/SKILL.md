---
name: kb-corpus-pipeline
display_name: 知识库语料流水线
description: 把「采集→纠偏→清洗→分类」做成一条可一键调用的语料生产线：给定行业/主题，从公开来源只读抓取原始素材并留来源与时间，与权威源比对标出有依据/存疑/无依据（无依据不进候选），去重、去 YAML 元信息头、一问一条、过内部词表硬门，再归入 concepts/entities/faq 并打 domain，产出可被知识库入库工具直接吃下的候选条目包。当用户说「扩充知识库语料」「采集某个行业/主题的资料」「把这篇资料整理成语料」「纠偏/查证这批素材」「清洗去重语料」「归类成概念/实体/问答」「生成候选语料包」时使用。
description_zh: 行业语料「采集→纠偏→清洗→分类」流水线：三态纠偏、词表硬门、一问一条，产出可直入库的候选条目包。
version: 1.0.0
summary: 行业语料采集→纠偏→清洗→分类一键成候选包，直供知识库入库。
min_scope: write
tags: [语料流水线, 知识库, 采集, 清洗, 分类]
complexity: L
user-invocable: true
category: work
triggers: ["扩充知识库语料", "采集行业资料", "整理成语料", "语料流水线", "素材纠偏", "素材查证", "语料清洗", "语料去重", "一问一条", "语料分类", "候选语料包", "知识库入库前处理", "把这篇资料收进知识库", "批量整理公开资料"]
---

# 知识库语料流水线（kb-corpus-pipeline）

> 一句话：给定行业/主题 → **采集**公开素材 → **纠偏**标三态 → **清洗**（去重/无元信息头/一问一条/词表零命中）→ **分类**（concepts/entities/faq + domain）→ 产出**可被知识库入库工具直接吃下**的候选条目包。

本技能只做知识库生产线的**第 1–4 段**；第 5–7 段（审查/入库/调取）已有工具，不重复造。

## 这个技能解决什么

行业语料从「网上找来的散料」到「能进库的条目」之间有四道手工活，慢且易漏：

1. **采集**：来源、抓取时间必须留痕，否则事后无法回溯。
2. **纠偏**：与权威源比对，**查不到就写「无依据」**，绝不编造；无依据的不能进候选。
3. **清洗**：去重（精确 + 近似）、去 YAML 元信息头、**一问一条**、过内部词表硬门（零命中）。
4. **分类**：归入 `concepts` / `entities` / `faq`，并打 `domain`。

本技能把这四步固化成脚本，一次调用产出候选包，并附分布统计与证据。

## 四段流水线

| 段 | 脚本 | 输入 | 输出 | 关键纪律 |
|---|---|---|---|---|
| 1 采集 | `scripts/collect.mjs` | `topics.json`（主题 + 公开 URL） | `raw/`，每条带 `url` + `fetched_at` | **只读 GET**；不 POST/留言/注册/发布 |
| 2 纠偏 | `scripts/verify.mjs` | `raw/` + `authority.json`（权威域名白名单 + 本地权威文本） | `verified/`，逐条 **有依据 / 存疑 / 无依据** | 无依据不进候选；无权威源即报错，不猜 |
| 3 清洗 | `scripts/clean.mjs` | `verified/` | `clean/`，一问一条、无元信息头 | 去重 + 近似去重；**内部词表命中＝整批拒绝** |
| 4 分类 | `scripts/classify.mjs` | `clean/` + `domains.example.json` | `candidates/`（`concepts/`、`entities/`、`faq/` + `manifest.json`） | `counts.total` 必须＝条数；字段齐全 |

一键编排：`scripts/pipeline.mjs`。全部产物落在调用方给的 `<workdir>` 内，**不写外部**。

## 怎么用

```bash
# 一键跑完四段（联网采集）
node scripts/pipeline.mjs --workdir <workdir> --topics <topics.json> \
  --authority <authority.json> --domains <domains.json> [--name <语料包名>]

# 离线复跑 / 自测（用本地 fixture 当素材，不联网）
node scripts/pipeline.mjs --workdir <workdir> --topics <topics.json> \
  --authority <authority.json> --domains <domains.json> --fixtures <raw-fixtures-dir>

# 只跑某一段
node scripts/collect.mjs  --topics <topics.json> --out <workdir>/raw [--fixtures <dir>]
node scripts/verify.mjs   --raw <workdir>/raw --authority <authority.json> --out <workdir>/verified
node scripts/clean.mjs    --verified <workdir>/verified --out <workdir>/clean
node scripts/classify.mjs --clean <workdir>/clean --out <workdir>/candidates --domains <domains.json>

# 离线自测 S1–S9（不联网；打印逐项原始输出）
node scripts/selftest.mjs [--workdir <dir>] [--repo <仓库根>]
```

配置模板：`references/authority.example.json`（权威源）、`references/domains.example.json`（主题域词表）。

## 硬门（任一不过＝本批不成立）

1. **内部词表零命中**（脱敏）：与技能上架门禁同一把尺子（`references/internal-wordlist.json`，可用 `--wordlist` 追加），命中即整批拒绝、退出码 3、不落候选。
2. **无依据不进候选**：纠偏标「无依据」的条目被剔除；问句不参与事实判定（问句只作检索入口，挂到答句上）。
3. **无 YAML 元信息头**：正文首行不得是 `---`；元信息只进 `manifest.json`。
4. **一问一条**：FAQ 每条只含一个问题（问题作标题、答案作正文）。
5. **可入库**：`manifest.items` 逐条 `path/domain/title/bytes/chars/sha256_16`，`counts.total`＝条数——与知识库入库层校验口径一致。

## 与入库的契约

候选包 `candidates/` 是 `manifest.json` + `concepts/`、`entities/`、`faq/` 目录，字段与既有入库校验（`packages/gewu/kb-wiki`）对齐，可被知识库 `kb_ingest` 直接加载；自测在隔离环境以入库服务实跑，核对 `kb_stats` 条数按 `counts.total` **+N**。详见 `references/corpus-contract.md`。

## W-21 · 先搜后建留痕

检索词、命中项（链接 + 许可 + 星标）、选型结论见 `references/retrieval-trace.md`：**结论＝自研为技能，并复用仓库既有入库契约与词表口径**；外部候选（librarian / kibble / simhash 等）接入成本高于自研。

## 人工把关点（机器不代办）

本技能只产出**候选**。下列步骤必须由人/上游流程决定，机器不代：候选复核与取舍、入库放行、对外可见性、技能上架。清单见 `references/人工把关点.md`。

## 边界

- **不对外发**：全程只读外部，绝不发布/留言/注册；候选包未放行不得对外。
- **不替代审核**：纠偏是**机械比对**，只给三态与依据指针，不构成事实认定。
- **不做第 5–7 段**：不代审查、不代入库、不代调取；不改门户/网关/技能目录。
- **不写敏感**：口令、Token、密钥、证件一律不进语料（见 `AGENTS.md` W-09）。
