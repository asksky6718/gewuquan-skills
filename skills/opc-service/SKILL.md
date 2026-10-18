---
title: opc-service 服务部技能
name: opc-service
version: 1.1.1
description: 教育类培训机构「服务部」经营技能。把上游订单 order.json 与课程 course.json 落成交付 delivery.json（课时 ID、课堂 ID、班级 ID、讲师、播放链接、进度）。含专家库调度（专家＝注册主体）与评价活动挂接（回落 OPC 级别判据）。5 道门全部脚本校验；课堂有声非空壳为硬门。当用户说「服务部」「排课」「开课」「建班级」「课堂验收」「专家怎么调」「教学交付到哪了」时使用。
description_zh: 订单＋课程落成交付；课堂有声非空壳，交付即产生级别判据证据。
version: 1.1.1
summary: 订单与课程落成交付记录，五道门卡住空壳课堂。
min_scope: write
tags: [服务部, 交付, 排课, 课堂验收]
user-invocable: true
category: work
allowed-tools: [Read, Write, Bash, Glob]
triggers: [服务部, 交付, 排课, 开课, 班级, 课堂验收, 专家调度, 教学交付]
---

# opc-service · 服务部

> **保密级别：内部件 · 禁止对外发布**（技能生产总纲定级）。

## 定位与边界

| | 内容 |
|---|---|
| **本 skill 干什么** | `order.json` ＋ `course.json` → `delivery.json` |
| **上游（硬前提）** | 两件都要；缺任一即拒 |
| **下游** | `opc-aftersales`（售后部）吃 `delivery.json` |
| **不做** | 不生成课程（产品部）；不放行结算（售后部＋人） |

## 输入

| 字段 | 必填 | 说明 |
|---|---|---|
| `order.json` | 是 | 含 `approval`，否则拒 |
| `course.json` | 是 | 知识点与时长基线 |
| 专家库/师资 | 是 | 讲师＝平台注册主体或外部专家 |
| 承载方式 | 是 | 网校平台 / 模考练习平台 / 教室·场地 |

## 工作流

### Step 1 — 核硬前提
**`order.json` 无 `approval` ⇒ 拒**（未审批订单不得交付）。

### Step 2 — 建课时与课堂
按 `course.json` 的知识点**逐条**在课堂系统建课、在网校建互动课堂课时。
**课时标题必须＝知识点名**（与产品段对账）。

### Step 3 — 组班与归属
按系列/场景组建班级并加入课程；确认归属主体正确。

### Step 4 — 挂接评价活动
把 OPC 级别对应的评价活动（认证题库/组卷/评分）挂接到交付物，
使 **交付完成即产生级别判据证据**。

### Step 5 — 生成 `delivery.json`
字段：`delivery_id` · `lesson_ids` · `classroom_ids` · `class_ids` · `teacher` · `play_urls` · `progress`

### Step 6 — 校验 ⛔ 不能跳

| 门 | 查什么 | 判门 |
|---|---|---|
| DL-1 | **每个课堂有声非空壳**（有配音动作且播放器实际发声、非外链） | 🟢 |
| DL-2 | 课时已发布且可播放 | 🟢 |
| DL-3 | 课程归入正确班级 | 🟢 |
| DL-4 | 实际时长与 `course.json` 对账一致 | 🟢 |
| DL-5 | 评价活动已挂接（对应目标 OPC 级别） | 🟢 |

> DL-1／DL-2 须对接平台探活接口，由装配层校验器执行（与全流水线同一套实施待办，本版不内置命令位）。

### Step 7 — 输出
`delivery.json` ＋ `delivery.md` ＋ `delivery-report.html`（三件套）

## 红线
无声课堂不得过门；未审批订单不得交付。

## 能力总览

| 能力 | 做什么 | 入口 |
|---|---|---|
| **教学交付** | 订单＋课程 → 交付记录，5 道门校验 | 本文件（简单技能，不拆子技能） |

## 路由判定表

| 用户这样说 | 前置门禁 | 进入 | 明确不要做 |
|---|---|---|---|
| 「排课」「开课」「建班级」「课堂验收」 | `order.json` 带 `approval` ＋ `course.json` | 本文件工作流 | 无声课堂不过门 |
| 「这课能不能便宜点重排」 | — | **停**：交付不做商务变更 | 转 `opc-sales` |

## 通则

- 未审批订单不得交付；课时标题必须＝知识点名。
- 交付完成即产生级别判据证据（评价活动挂接）。
- 交付末块统一：回复末块标题一律「交付后请确认」。

## 环境与约定

- DL-1／DL-2 须平台探活接口凭据，由装配层校验器执行；本版不内置命令。
- 讲师＝平台注册主体或外部专家；讲师资质确认留人。

## 执行前核对

```
□ order.json 的 approval 三项留痕齐全
□ course.json 知识点与时长基线在手
□ 平台探活凭据可用
```

## 目录

```
opc-service/
├── SKILL.md                # 本文件
├── VERSION / CHANGELOG.md / README.md / LICENSE / manifest.json
└── references/
    └── 人工把关点.md       # 必须本人上手的动作
```

## 相关
`opc-sales`（上游）｜`opc-product`（上游）｜`opc-aftersales`（下游）｜网校平台｜认证题库系统
