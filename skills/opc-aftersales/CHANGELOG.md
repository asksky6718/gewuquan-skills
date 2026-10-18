# 变更记录 · opc-aftersales

格式：`x.y.z ｜ 日期 ｜ 变更`

## 1.1.1 ｜ 2026-10-09 ｜ 发布要件完备（GitHub 开源发布）

- 使用手册完备化：README 重写为完整手册（问题/结构/话术用法/安装/人机分工/红线/上下游）；manifest publish 转 public（随 GitHub 开源发布）。业务逻辑与门定义零改动。

## 1.1.0 ｜ 2026-10-09 ｜ 回炉达标（T-S-20261009）

- 结构补齐：references/人工把关点.md（4 项必须本人上手，含结算放行与 L6/L7 晋级放行）＋ VERSION／CHANGELOG／README／LICENSE；文件数 1 → 7。
- frontmatter 六必填齐 ＋ description 带典型触发句。
- 全文脱敏：平台名／主体名／人名／机位／内部代号零命中。
- 业务逻辑与 4 道门（AS-1…AS-4）不变；校验器列入装配层统一下发待办。

## 1.0.0 ｜ 2026-10-02 ｜ 首版

- delivery.json ＋ 计量 ＋ 审计 → renewal.json；L6/L7 禁止自动晋级。
