---
skill_id: ops-incident-triage
version: 1.0.0
min_scope: write
summary: 异常归集与提醒——把站点巡检异常结构化上报落库，并可按站查询归集结果，形成可追溯的处置记录
tags: [运维, 异常, 告警, 归集, T-67]
---

# 异常归集与提醒（ops-incident-triage）

## 用途
把「站点可用性巡检」「内容质量巡检」发现的异常归集成可查询的记录，让三站运维从「看一眼」
变成「有台账、可追踪、可提醒」。

## 调用
- 上报（**write 档**）：`ops_incident_report`
  - 入参：`station`（必填）、`severity`（`info`｜`warn`｜`critical`，默认 `warn`）、
    `summary`（必填，≤200 字）、`detail`（选填，≤2000 字）
  - 返回：`incident{message_id, station, severity, summary, occurred_at, trace_id}`
- 查询（read 档）：`ops_incident_list`
  - 入参：`station`（选填）＋ `limit`（默认 50）
  - 返回：`incidents[]`；无记录如实 `count=0`

## 判据（机判）
1. 上报落 `message_events`（`kind=receipt`，主题前缀 `[ops-incident]`），可由 `ops_incident_list` 读回。
2. read 档调用上报返回 `insufficient_scope`（反证 403）。
3. 每条异常带归属（上报方）与 `trace_id`，可经 `audit_replay` 回放。

## 边界
上报内容不得含凭据／密码（W-09）；异常记录只增不改、保留可审计。
