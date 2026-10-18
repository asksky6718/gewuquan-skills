# kb-corpus-pipeline · 知识库语料流水线

把「采集 → 纠偏 → 清洗 → 分类」做成一条可一键调用的语料生产线，产出**可被知识库入库工具直接吃下**的候选条目包。

- **唯一事实源**：`SKILL.md`
- **引擎声明**：`references/engine.json`
- **入库契约**：`references/corpus-contract.md`
- **人工把关点**：`references/人工把关点.md`
- **W-21 检索留痕**：`references/retrieval-trace.md`

## 快速开始

```bash
# 一键四段（联网采集）
node scripts/pipeline.mjs --workdir <workdir> --topics <topics.json> \
  --authority <authority.json> --domains <domains.json>

# 离线复跑（fixtures 当素材）
node scripts/pipeline.mjs --workdir <workdir> --topics test/fixtures/topics.json \
  --authority test/fixtures/authority/authority.json \
  --domains references/domains.example.json --fixtures test/fixtures/raw

# 自测 S1–S9（离线，打印逐项原始输出）
node scripts/selftest.mjs
```

## 产物

```
<workdir>/
├── raw/           原始素材（每条带 url + fetched_at；仅 GET）
├── verified/      三态纠偏结果（有依据 / 存疑 / 无依据）
├── clean/         清洗后条目（无元信息头 / 一问一条 / 词表零命中）
├── candidates/    候选包（concepts/ entities/ faq/ + manifest.json，可直入库）
└── reports/       各段报告与总报告
```

## 硬门

内部词表零命中 · 无依据不进候选 · 无 YAML 元信息头 · 一问一条 · `counts.total`＝条数且可入库。

## 边界

只做知识库生产线**第 1–4 段**；不代审查/入库/调取；不发布/留言/注册；候选未经放行不得对外。

## 许可

MIT（见 `LICENSE`）。
