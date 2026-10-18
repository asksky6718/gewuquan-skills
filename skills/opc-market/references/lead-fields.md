# lead.json 字段契约（受理段）

> 与流水线契约 `pipeline/opc-company.pipeline.v1.0.json` 的 `stages[0].fields` 一致；
> 改字段先改契约，再同步本页与 `tools/lead_check.py`，三处一致。

## 字段表

| 字段 | 必填 | 说明 |
|---|---|---|
| `lead_id` | 是 | 线索唯一标识（建议 `lead-YYYYMMDD-序号`） |
| `source_channel` | 是 | 渠道唯一归因：`short_video` ／ `live` ／ `wechat_mp` ／ `zhihu` ／ `community` ／ `referral` ／ `event` ／ `other:<说明>` |
| `subject` | 是 | 主体（机构名或学员身份标识） |
| `contact` | 是 | 联系方式（手机号或邮箱，格式由 IN-3 校验；**只入主体库，不入共享库正文**） |
| `need` | 是 | 需求描述（想解决什么） |
| `opc_level` | 条件 | L1–L9；**有证据则必填**；无证据留空且必须 `pending_level_review=true` |
| `opc_level_source` | 是 | `auto_with_evidence`（附 `evidence_ref`）或 `human`（附 `level_by`） |
| `evidence_ref` | 条件 | `auto_with_evidence` 时必填：证据指针（考试分数／产物／方案文档的存档位置） |
| `level_by` | 条件 | `human` 时必填：定级人 |
| `pending_level_review` | 是 | 布尔；`opc_level` 为空时必须为 `true` |
| `owner_subject` | 是 | 归属主体（本主体名册内的运营主体） |
| `created_at` | 是 | ISO-8601 时间 |

## 5 道门（`tools/lead_check.py` 代码强制）

| 门 | 查什么 | 判定 |
|---|---|---|
| IN-1 | `source_channel` 存在且非空非 `unknown`（渠道归因完整） | 机判 |
| IN-2 | `subject` 与 `owner_subject` 存在且在主体名册（`--registry` 注入的 JSON）内 | 机判 |
| IN-3 | `contact` 为合法手机号（11 位 1 开头）或邮箱（正则） | 机判 |
| IN-4 | 同文件内 `subject`＋`need` 重复即拒（幂等去重；跨文件去重由主体库负责） | 机判 |
| IN-5 | 级别有出处：`opc_level` ∈ L1–L9 且 `opc_level_source` 合法（`auto_with_evidence` 须附 `evidence_ref`；`human` 须附 `level_by`）；`opc_level` 为空时必须 `pending_level_review=true` | 机判 |

## 输出三件套

```bash
python tools/lead_check.py validate <lead.json> --registry <主体名册.json>   # 校验
python tools/lead_check.py render   <lead.json> --md                        # lead.md
```

`lead-report.html` 由装配层统一拼装（本包不内置模板）。
