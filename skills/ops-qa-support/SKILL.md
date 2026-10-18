---
skill_id: ops-qa-support
version: 1.0.0
min_scope: read
summary: 用户问询应答——复用格物圈教育行业知识库能力，带可定位引用回答考生／用户问题，无依据明确拒答
tags: [运维, 问答, 知识库, 考生, T-67]
---

# 用户问询应答（ops-qa-support）

## 用途
三站接入格物圈后的「有行业知识的问询支持」：学员／用户问题经知识库检索与带引用回答，
答案可定位到原文；库里没有的内容明确拒答，不臆测。

## 调用
- 工具：`kb_answer`（先用 `kb_search` 检索定位）
- 入参：`query`（必填）；`domain`（`entities`｜`concepts`｜`synthesis`）；
  `exclude_other_subject`（默认安全：排除其他主体语料）
- 返回：`answer{answered, text, citations[]}` ＋ `verification`（引用可定位校验）

## 判据（机判）
1. 有依据时 `answered=true`，且每条引用可定位到原文区间。
2. 无依据时 `answered=false`（拒答红线），不得编造。
3. 默认排除跨主体语料；确需跨主体须显式传 `exclude_other_subject=false`，响应带 `cross_subject` 警示。

## 边界
只读知识库；答案归属按调用方 Bearer 落计量与审计（谁问的、问了什么、返回指纹可回放）。
