# 语料入库契约（kb-corpus-pipeline ↔ 知识库入库层）

> 目的：本技能产出的候选条目包，必须能被既有知识库入库工具**直接吃下**，不靠中间转换。

## 一、候选包目录形态

```
candidates/
├── concepts/*.md        # 概念类条目
├── entities/*.md        # 实体类条目
├── faq/*.md             # 一问一条问答
└── manifest.json        # 语料清单（入库读取口径）
```

## 二、条目正文约束

- **无 YAML 元信息头**：正文首行不得是 `---`。元信息只进 `manifest.json`。
  （检索窗口会回带正文前若干字，元信息混入会被当答案。）
- **一问一条**：FAQ 文件形如 `# <问题>` + 空行 + 答案；每文件只含一个问题。
- **脱敏**：全文过内部词表扫描，**零命中**为硬门。
- 编码 UTF-8；换行 LF。

## 三、manifest 字段（入库校验口径）

```json
{
  "name": "<语料包名>",
  "schema": "pilot-kb.v2",
  "counts": { "total": 6, "by_domain": {"concepts":3,"entities":1,"faq":2},
              "by_subject_domain": {"职业技能评价":4,"课程与教研":2},
              "total_bytes": 1075, "with_other_subject": 0 },
  "items": [
    { "path": "faq/xxx.md", "domain": "faq", "title": "……？",
      "subject_domain": "职业技能评价", "visibility": "internal",
      "bytes": 321, "chars": 120, "sha256_16": "abcdef0123456789",
      "contains_other_subject": false, "other_subject_hits": [] }
  ]
}
```

| 字段 | 规格 |
|---|---|
| `path` | 相对候选包根的路径 |
| `domain` | 知识类型：`concepts` / `entities` / `faq`（**与目录一致**） |
| `subject_domain` | 主题域（行业维度），由 `domains.json` 关键词表决定 |
| `title` | 条目标题（FAQ 为问题） |
| `visibility` | `public` / `internal` / `subject-private`（默认 `internal`） |
| `bytes` / `chars` | 文件字节数 / 字符数 |
| `sha256_16` | 文件内容前 16 位 sha256（与入库层回查键同口径） |
| `counts.total` | **必须等于 `items` 条数**（不一致＝整库拒绝） |

入库层逐条复核 `sha256_16` 与 `bytes`，任一不符即 `ingest_mismatch`。

## 四、隔离环境实测（自测 S6 口径）

1. 以入库服务加载**基线语料**，取 `document_count` = B；
2. 把本技能候选包作为**补充语料目录**再加载一次，取 `document_count` = B + N；
3. 断言 `N === manifest.counts.total`，并对同目录重复 `ingest` 一次核对条数不增（幂等）。

> 该实测走的是与 `kb_stats` / `kb_ingest` 相同的入库代码路径，只在隔离进程内进行，**不改生产语料目录**。

## 五、复跑幂等

- 采集：覆盖写同名来源文件；
- 纠偏 / 清洗：覆盖写本段目录，清空本段 `entries/`；
- 分类：只清 `concepts/`、`entities/`、`faq/` 与 `manifest.json` 后重写。

因此同主题重跑**不产生重复条目**；`manifest.items` 逐项稳定（时间戳字段除外）。
