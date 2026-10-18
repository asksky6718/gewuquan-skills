# 技能库（Skills）

> 面向使用者的技能（插件）集合。技能以**本仓库**为发布载体；站点只保留仓库链接与复制提示词。

## 收录什么

只收**面向使用者的技能**：合规自查、机构诊断、职称申报、办学与培训资质、用户问询应答等。
**内部运维类技能不在此仓库发布**（涉及内部系统入口与运维流程）。

当前收录 7 个：

| 技能 | 一句话 |
|---|---|
| `compliance-copy` | 宣传文案逐句查违禁词与风险，给改写建议 |
| `org-diagnose` | 教育机构经营诊断：五段定位卡点，出方案与 30 天清单 |
| `zhicheng-assess` | 职称申报前自评：能报哪一级、差哪几项 |
| `zhicheng-material` | 职称申报材料清单，逐项带出处与办理方 |
| `zhicheng-pm` | 职称评审全流程助手：五道门按序推进 |
| `vocational-training-school-setup` | 职业培训机构从立项到能运营的全流程 |
| `ops-qa-support` | 用户问询应答：带可定位引用作答，无依据明确拒答 |

## 目录结构

```
skills/<skill_id>/
  SKILL.md            # frontmatter（name/description/version/complexity/min_scope）+ 正文
  references/         # 规则、模板、清单等随包资产
```

`SKILL.md` frontmatter 至少含：`name`、`description`、`version`、`complexity`（S/M/L/XL）、`min_scope`（read/write/admin）。

## 两种用法

**一、直接取**
```bash
git clone https://github.com/asksky6718/gewuquan-skills.git
# 把 skills/<skill_id> 放进你的智能体技能目录
```

**二、让智能体自己取（推荐）**
把下面这句贴进你的智能体：

> 到这个技能库取技能：先列出可用技能，取你需要的那一个，按其 `SKILL.md` 安装并执行。

## 收录与审核

技能进入本仓库前过四道门：① 内部词表零命中 ② 结构合规与指纹固定 ③ 智能体预审 ④ 人类放行。详见 [SUBMISSION.md](SUBMISSION.md)。

## 许可证

**MIT License**（见 [LICENSE](LICENSE)）｜版权 2026 海南能工巧匠职业教育有限公司。

可自由使用、修改、分发、商用，保留版权与许可声明即可。

## 维护

- 维护：平台技术侧
- 问题与建议：开 Issue
