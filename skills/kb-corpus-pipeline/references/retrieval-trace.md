# W-21 检索留痕 · kb-corpus-pipeline

检索日期：2026-10-12 · 检索人：维护方@82（运行时）· 检索面：GitHub 仓库检索 + 社区技能/插件目录

## 一、检索词

- `knowledge base corpus ingestion pipeline deduplication cleaning classification`
- `corpus cleaning pipeline` / `document ingestion pipeline deduplication`
- `FAQ generation from documents` / `question answer extraction open source`
- `chinese text deduplication simhash` / `markdown frontmatter strip`
- 社区：`插件生态` 主题、`运行时-skill` 主题、社区技能商店与插件目录

## 二、命中项（名称 · 链接 · 许可 · 星标 · 相关点）

| # | 项目 | 链接 | 许可 | 星标 | 相关点 |
|---|---|---|---|---|---|
| 1 | nampara-ai/librarian | https://github.com/nampara-ai/librarian | MIT | 49 | 语料解析→清洗→分类→检索，最接近 |
| 2 | femboyisp/kibble | https://github.com/femboyisp/kibble | Apache-2.0 | 14 | 摄取 / RAG / 微调数据集工具链（Rust） |
| 3 | 1e0ng/simhash | https://github.com/1e0ng/simhash | MIT | 1038 | 近似去重算法实现（Python） |
| 4 | basicmachines-co/basic-memory | https://github.com/basicmachines-co/basic-memory | AGPL-3.0 | 4151 | 知识记忆与检索层 |
| 5 | cxy9204/运行时-skill-store | https://github.com/cxy9204/运行时-skill-store | MIT | 1 | 社区技能商店 |
| 6 | hikariming/openfind | https://github.com/hikariming/openfind | 未声明 | 300 | 插件目录 / 社区索引 |

> 另有一条命中仓库名与内部词表冲突，按上架门禁不在技能包内展开；完整链接与结论见 T-114 回执（`handoff/outbox/`）。

## 三、选型结论

**结论：自研为技能（不接入外部项目），并复用仓库内既有原语。**

| 候选 | 取舍 | 理由（一句） |
|---|---|---|
| librarian（MIT） | 不接入 | Python/Mac 重栈 + LLM 联网清洗；分类体系与 `concepts/entities/faq + domain` 不同，且无纠偏三态与内部词表硬门 |
| kibble（Apache-2.0） | 不接入 | 需 Rust 工具链；不覆盖一问一条、词表硬门与 manifest 契约 |
| simhash（MIT） | 借鉴不接入 | 近似去重只需精确哈希 + 字符二元组包含度，纯 Node 零依赖即可，避免引入 Python 运行时 |
| basic-memory（AGPL-3.0） | 不接入 | 强 copyleft，不引入生产 |
| upstash/faq-generator、Sakal1009/ai-faq-documentation-generator | 不接入 | 无许可声明 ⇒ 不可复用 |
| 社区（openbase / 运行时-skill-store / `插件生态` 主题） | 无同类 | 未见「采集→纠偏→清洗→分类」语料生产线技能，多为记忆/检索类插件 |

**复用的仓库内原语**（W-21「能复用不自主开发」）：

1. 入库契约对齐 `packages/gewu/kb-wiki` 的 manifest 口径（`path/domain/title/bytes/chars/sha256_16`、`counts.total`），产出可被 `kb_ingest` 直接吃下。
2. 脱敏词表与 `平台技能注册表` 的默认内部词表同源，保证「清洗零命中」与「技能上架词表扫描」同一把尺子。

**自研范围（唯一合理增量）**：纠偏三态判定、一问一条拆分、manifest 组装与幂等复跑编排；这些在候选项中均无可直接接入的实现。
