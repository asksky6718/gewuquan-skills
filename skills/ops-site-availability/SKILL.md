---
skill_id: ops-site-availability
version: 1.0.0
min_scope: read
summary: 站点可用性巡检——对已接入格物圈的三站做真实出站探测，量状态码／时延／最终地址／标题，异常给 error_code
tags: [运维, 站点, 可用性, 巡检, T-67]
---

# 站点可用性巡检（ops-site-availability）

## 用途
三站（Core 生产站／智训宝网校／AI 工具集）接入格物圈后的**AI 运维**基础能力之一：由格物圈供给、
站点侧调用，对站点自身做真实可用性巡检，结果结构化、可复核，不采信自述。

## 调用
- 工具：`site_probe`
- 入参：
  - `station`（必填）：`core`｜`learn`｜`app`，或该站 `agent_id`／`host`
  - `timeout_ms`（选填，默认 8000）
- 返回：`probe.status_code`／`probe.ok`／`probe.latency_ms`／`probe.slow`／`probe.final_url`／
  `probe.server`／`probe.title`；失败时 `probe.error_code`（`timeout`／`dns_error`／`connect_refused`／`tls_error`…）

## 判据（机判）
1. `status_code` 为 2xx/3xx 判 `ok=true`；5xx／连接失败／超时判 `ok=false` 并给 `error_code`（不静默）。
2. `latency_ms > 3000` 只记 `slow=true`（时延告警），仍按状态码判可用性。
3. 探测地址仅限 `public/content/stations.json` 白名单；越界地址返回 `station_url_not_allowed`。

## 边界
只发出站 GET，不写站点侧任何数据；不持有、不回显任何凭据（W-09）。
