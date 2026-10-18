# opc-aftersales · 售后部技能（v1.1.1）

> 交付＋计量＋审计对账，出**结算与晋级**：涉钱涉对外的动作只挂起，永不自动。
> 版本：**1.1.1** · 许可：MIT
> **定位：仅内部运维用**——经营复盘与财务对账岗。

---

## 一、它解决什么问题

售后环节的两笔糊涂账：

- **交付完就忘**——学员学完了，平台计了多少量、该结算多少、谁也没对过账；
- **晋级靠印象**——学员能力到没到下一级，没有证据链，续费话术全凭感觉。

这个技能把三份东西（交付记录、平台计量、审计回放）摆到一张桌上对账：**计量核对 → 审计回放 → 级别推进判定 → 结算对账**，全程只核「approval 是否存在」，**金额判定与付款动作永不自动**。

## 二、它长什么样

```
opc-aftersales（一条流水作业，不拆子技能）
├── SKILL.md            根路由 + 4 道门定义（AS-1…AS-4）
├── references/人工把关点.md   机器全包 + 必须本人事项
└── README / VERSION / CHANGELOG / LICENSE / manifest.json
```

**4 道门**：

```
AS-1 计量核对     usage_events 与交付记录一致
AS-2 审计回放     audit_replay 无缺口
AS-3 级别推进     L6/L7 只挂起，永不自动晋级
AS-4 结算对账     只核 approval 是否存在，金额判定留人
```

## 三、怎么用

对话里直接说：

| 你想干什么 | 这样说 |
|---|---|
| 对账 | 「这批交付对一遍账」「计量和交付核一下」 |
| 回放审计 | 「审计回放有没有缺口」 |
| 判晋级 | 「这批学员谁够晋级」「L6 的先挂着别动」 |
| 出结算 | 「结算单出一下」「复购信号列出来」 |

**输入**（缺一即拒）：

- `delivery.json` —— 服务部产出；
- 平台计量（usage_events）；
- 审计回放（audit_replay）。

**输出**：`renewal.json` ＋ `renewal.md` ＋ `renewal-report.html`。

```json
{
  "settlement_id": "stl-…",
  "usage_reconciled": true,
  "opc_level_after": "L4", "promotion_pending": false,
  "renewal_signal": { … }, "next_level_course": "…"
}
```

## 四、安装

```bash
cp -r opc-aftersales ~/.workbuddy/skills/     # WorkBuddy
cp -r opc-aftersales ~/.codex/skills/         # Codex 系
```

装好后说「售后部」「对账」即可唤起。

## 五、机器干 ／ 人来干

**机器全包**：三源齐备核验 · 计量核对 · 审计回放 · 级别推进判定（有证据的自动）· 结算对账（只核 approval）· 复购信号生成 · 三件套输出。

**必须本人**：付款放行 · L6/L7 晋级确认 · 对外结算沟通——涉钱涉对外，只挂起、永不自动。

## 六、硬红线

```
1  不自动放行付款 —— 结算单只核 approval 存在性，金额判定留人
2  不自动晋级 L6/L7 —— 高级别晋级一律挂起等人工确认
3  不动钱、不对外 —— 本技能只产出对账与信号，动作全在人
```

## 七、上下游

- **上游**：`opc-service`（交付）＋ 平台计量 ＋ 审计回放。
- **下游（闭环）**：`next_level_course` 复购信号**回流 `opc-market`**——这就是鱼塘模型里的「打鱼再放苗」。

## 八、版本与许可

- 现行版本见 `VERSION`；历次变更见 `CHANGELOG.md`。
- 许可 MIT，见 `LICENSE`。
