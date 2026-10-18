---
title: opc-aftersales 售后部技能
name: opc-aftersales
version: 1.1.1
description: 教育类培训机构「售后部」经营技能。把上游交付 delivery.json 与平台计量（usage_events）、审计（audit_replay）对账，产出 renewal.json（结算对账、OPC 级别推进、续费信号、下一级别课程）。不自动放行结算：金额只校验 approval 是否存在，判定权在人。同时完成 OPC 九级的晋级判定与能力档案写回（人判级只挂起）。当用户说「售后部」「这期结算对一下」「复购信号有哪些」「能不能晋级」「能力档案写回」时使用。
description_zh: 交付＋计量审计对账出结算与晋级；涉钱涉对外只挂起不自动。
version: 1.1.1
summary: 交付与计量对账，产结算与晋级信号，人判级只挂起。
min_scope: write
tags: [售后部, 结算, 复购, 晋级]
user-invocable: true
category: work
allowed-tools: [Read, Write, Bash, Glob]
triggers: [售后部, 结算, 对账, 复购, 续费, 晋级, 能力档案]
---

# opc-aftersales · 售后部

> **保密级别：内部件 · 禁止对外发布**（技能生产总纲定级）。

## 定位与边界

| | 内容 |
|---|---|
| **本 skill 干什么** | `delivery.json` ＋ 计量 ＋ 审计 → `renewal.json`（结算对账 ＋ 级别推进 ＋ 续费信号） |
| **上游（硬前提）** | `delivery.json`；平台计量与审计可查 |
| **下游** | 回流 `opc-market`（下一级别课程 ⇒ 复购闭环）|
| **不做** | 🔴 **不放行付款**；🔴 **不自动晋级 L6／L7**（涉钱涉对外，留人逐次放行） |

## 输入

| 字段 | 必填 | 说明 |
|---|---|---|
| `delivery.json` | 是 | 上游服务部产物 |
| 平台 `usage_events` | 是 | 计量记录（`agent_id` 按 Bearer 反查得到，非调用参数） |
| 平台 `audit_replay` | 是 | 按 trace_id 回放的时间线（含归属与 ack 状态） |
| `approval` | 是（结算用） | 审批记录 |

## 工作流

### Step 1 — 计量核对
拉取本交付周期内的 `usage_events`，按 `agent_id`（Bearer 反查归属）聚合，
与 `delivery.json` 的课时/班级记录对账。

### Step 2 — 审计回放（可选但推荐）
用 `audit_replay` 按 trace 回放关键调用链，确认无异常中断。

### Step 3 — 级别推进判定
按 OPC 标尺（装配层注入）判本周期可推进到哪一级：

| 判门档位 | 本 skill 的行为 |
|---|---|
| 🟢 **机判级**（L1–L5、L8） | 跑确定性校验，通过即可写入 `opc_level_after` |
| 🔴 **人判级**（L6、L7） | **只校验证据齐备性并挂起**，`promotion_pending=true`，等人工放行 |
| 🟡 半机判（L9） | 机判为主，链式证据（被培养者）交由人工确认 |

> 🔴 **L6／L7 涉钱涉对外，禁止本 skill 自动晋级。**

### Step 4 — 结算对账（**人的环节**）
> 🔴 本步**不决定金额**。只做：对账平衡校验 ＋ **检查 `approval` 是否存在**。

### Step 5 — 生成 `renewal.json`
字段：`settlement_id` · `usage_reconciled` · `amount_due` · **`opc_level_after`** · `renewal_signal` · `next_level_course`

### Step 6 — 校验 ⛔ 不能跳

| 门 | 查什么 | 判门 |
|---|---|---|
| AS-1 | 计量归属正确（`agent_id` 与交付主体一致） | 🟢 |
| AS-2 | 对账平衡（交付记录 ↔ 计量记录） | 🟢 |
| **AS-3** | **结算金额须带 `approval`** | 🔴 **人判** |
| AS-4 | 级别推进可追溯（晋级链不断层） | 🟢 |

> 校验器由装配层统一下发（与全流水线同一套实施待办，本版不内置命令位）。

### Step 7 — 输出与回流
`renewal.json` ＋ `renewal.md` ＋ `renewal-report.html`（三件套）；
**`next_level_course` 回流至 `opc-market`** ⇒ 复购闭环成立。

## 红线
**不自动放行付款**；**不自动晋级 L6／L7**。

## 能力总览

| 能力 | 做什么 | 入口 |
|---|---|---|
| **结算与复购** | 交付＋计量＋审计 → 结算对账与晋级信号，4 道门校验 | 本文件（简单技能，不拆子技能） |

## 路由判定表

| 用户这样说 | 前置门禁 | 进入 | 明确不要做 |
|---|---|---|---|
| 「结算对一下」「复购信号」「能不能晋级」 | `delivery.json` 在手 ＋ 计量可查 | 本文件工作流 | 不自动放行、不自动晋级 |
| 「直接把钱结了」「直接给他升到 L7」 | — | **停**：留人拍板 | 本 skill 只挂起 |

## 通则

- 涉钱涉对外的判定权在人：L6／L7 只核证据齐备性并挂起。
- 晋级不得断层：进入 L(n) 前必须已有 L(n-1) 通过记录。
- 交付末块统一：回复末块标题一律「交付后请确认」。

## 环境与约定

- 计量与审计记录由平台按 Bearer 反查归属，非调用参数。
- 标尺由装配层注入；本版不内置校验命令，校验器由装配层统一下发。

## 执行前核对

```
□ delivery.json 在手且计量窗口明确
□ 晋级链（L(n-1) 通过记录）完整
□ approval 表单已备（结算用）
```

## 目录

```
opc-aftersales/
├── SKILL.md                # 本文件
├── VERSION / CHANGELOG.md / README.md / LICENSE / manifest.json
└── references/
    └── 人工把关点.md       # 必须本人上手的动作
```

## 相关
`opc-service`（上游）｜`opc-market`（回流）｜三站联动体系
