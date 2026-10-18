#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""推进表机械核对 v2.1（认不出就拒答，绝不把「没认出来」当成「全都没有」）。

用法：
    python gap_check.py --xlsx "项目推进表.xlsx" [--region 湖北] [--sheet 工作截点]
                        [--json-out out.json] [--show-headers]

只做确定性检查并输出事实，不给主观评价。
退出码：0=无阻断  1=存在阻断  2=文件/依赖问题  3=未识别到可核对的表（拒答，不做缺失判定）
"""
import argparse
import json
import re
import sys

try:
    import openpyxl
except ImportError:  # pragma: no cover
    print("ERROR[environment] 需要 openpyxl。请在虚拟环境或已装 openpyxl 的解释器中运行"
          "（脚本不会自动安装任何依赖，也不联网）")
    sys.exit(2)

# 一次扫一个「像日期」的片段再分类，避免「2026-12」被当成「2026-12-01」的前缀重复计数
DATE_FRAG_RE = re.compile(r"(\d{4})\s*[-/年]\s*(\d{1,3})(?:\s*[-/月]\s*(\d{1,3}))?")
QUARTER_RE = re.compile(r"第[一二三四1-4]季度|[Qq][1-4](?!\d)|全年小计")

# 正常状态词：只做「认得出」，宁可放过也不误报（本技能不靠状态词判合规）
STATUS_OK = {
    "未开始", "未启动", "待启动", "待办", "待处理", "待推进",
    "进行中", "在办", "办理中", "部分完成",
    "已完成", "已办结", "已交付", "已完成验收",
    "待确认", "待核对", "待反馈", "待补充",
    "计划中", "规划中", "拟开展", "纳入计划",
    "暂停", "搁置", "已取消", "不适用", "无需办理",
}

# 「时间节点」写成软表述（不是硬日期）时降级为提示，不算缺陷
SOFT_DATE = ("待定", "暂缓", "另行", "后续", "视", "按", "长期", "持续", "不定期",
             "同步", "滚动", "即时", "审批后", "取得后", "完成前", "启动后")
# 「像推进表」的必要特征列：光有 模块/事项/备注 不算（那可能是说明表）
PLANISH = ("负责人", "当前状态", "时间节点", "交付物", "验收标准")

# 表头别名表：真实台账用的列名千差万别，这里只做「认得出」用；认不出一律拒答。
ALIASES = {
    "重点任务": ["重点任务", "模块", "阶段", "分类", "母项目", "大类", "一级任务", "任务类别", "所属阶段"],
    "具体事项": ["具体事项", "事项", "子项目", "细项", "任务", "工作事项", "具体任务", "事项名称"],
    "交付物": ["交付物", "关键交付物", "细项与关键交付物", "交付成果", "成果物", "产出", "产出物", "交付"],
    "负责人": ["负责人", "责任人", "责任", "主办人", "主办", "执行人"],
    "协同方": ["协同方", "协助", "相关协同方", "协同", "配合方", "协同部门"],
    "当前状态": ["当前状态", "状态", "完成状态", "进度状态", "进展"],
    "验收标准": ["验收标准", "验收", "标准", "完成标准", "达成目标", "目标"],
    "时间节点": ["时间节点", "节点", "到位时间", "截止时间", "完成时间", "计划完成时间", "计划时间", "开始时间"],
    "备注": ["备注", "说明", "风险", "问题", "备注说明"],
}

REQUIRED = [
    ("办学许可", ["办学许可", "办学许可证", "民办学校办学许可"], "资质链", True),
    ("法人登记", ["法人登记", "营业执照", "民办非企业", "登记证书"], "资质链", True),
    ("名称核准", ["名称核准", "核名", "名称自主申报", "名称预核准"], "资质链", True),
    ("立项/备案", ["立项", "备案", "决议", "批准书"], "资质链", True),
    ("场地产权/租赁", ["产权", "租赁", "场地合规", "场所", "面积"], "前置条件", True),
    ("消防", ["消防"], "前置条件", True),
    ("章程/管理制度", ["章程", "管理制度", "制度"], "前置条件", False),
    ("校长/教师资格", ["教师资格", "校长", "教师", "师资资格", "财会", "财务人员"], "前置条件", False),
    ("验资/注册资金", ["验资", "注册资金", "固定资产"], "前置条件", False),
    ("设施设备清单", ["设备清单", "设备采购", "设施设备"], "前置条件", False),
    ("收费公示", ["收费公示", "价格公示", "收费标准"], "运行合规", False),
    ("培训协议", ["培训协议", "合同模板"], "运行合规", False),
    ("实名制台账", ["台账", "实名制", "学员档案"], "运行合规", False),
    ("年检", ["年检", "检查评估"], "运行合规", False),
    ("评价资质", ["社评组织", "社会培训评价组织", "等级认定", "评价机构", "考核点"], "评价资质", False),
]
AFTER_LICENSE = ["招生", "宣传", "培训实施", "授课", "报名", "开课", "开班", "公示"]


def cell_text(v):
    return "" if v is None else str(v).strip()


def match_field(text, aliases):
    return re.sub(r"[\s\n]+", "", text) in aliases


def sheet_headers(ws, max_row=30):
    """返回 [(表头行, {规范字段: [列号]}, 命中数, 季度列数, 是否两行复合表头)]，按命中数降序。"""
    out = []
    for r in range(1, min(ws.max_row, max_row) + 1):
        for extra in (0, 1):          # 单行表头 / 两行复合表头
            merged, matrix = {}, 0
            for c in range(1, ws.max_column + 1):
                txt = cell_text(ws.cell(row=r, column=c).value)
                if extra:
                    txt = txt + cell_text(ws.cell(row=r + 1, column=c).value)
                if not txt:
                    continue
                if QUARTER_RE.search(txt):
                    matrix += 1
                for canon, al in ALIASES.items():
                    if match_field(txt, al):
                        merged.setdefault(canon, []).append(c)
            if merged:
                out.append((r, merged, len(merged), matrix, extra))
    out.sort(key=lambda x: (-x[2], -x[3]))
    return out


def collect_rows(ws, header_row, cols, extra=0):
    """从表头下第一行真实数据起读；extra=1（两行复合表头）才再下移一行。"""
    def g(r, canon):
        vals = [cell_text(ws.cell(row=r, column=c).value) for c in (cols.get(canon) or [])]
        return " ".join(v for v in vals if v)

    rows = []
    start = header_row + 1 + (1 if extra else 0)
    for r in range(start, ws.max_row + 1):
        item = {k: g(r, k) for k in ALIASES}
        item["_row"] = r
        if not any(item[k] for k in ("重点任务", "具体事项", "交付物", "时间节点", "当前状态", "负责人")):
            continue
        if any(item[k] == k for k in ("重点任务", "具体事项", "交付物", "时间节点")):
            continue
        rows.append(item)
    return rows


def dates_in(text):
    """返回 (good, bad)。good=[(年,月,日)]，日=0 表示只精确到「月」；bad=[原文片段]。"""
    good, bad, seen = [], [], set()
    for m in DATE_FRAG_RE.finditer(text):
        frag = m.group(0)
        if frag in seen:
            continue
        seen.add(frag)
        y, n2, n3 = int(m.group(1)), int(m.group(2)), m.group(3)
        if n3 is None:
            if 1 <= n2 <= 12:
                good.append((y, n2, 0))
            else:
                bad.append(frag)
        else:
            d = int(n3)
            if 1 <= n2 <= 12 and 1 <= d <= 31:
                good.append((y, n2, d))
            else:
                bad.append(frag)
    return good, bad


def as_start(t):
    y, m, d = t
    return (y, m, d or 1)          # 「只到月」的节点，取该月月初


def as_end(t):
    y, m, d = t
    return (y, m, d or 28)         # 「只到月」的节点，取该月月末（不用 31 以免跨月误判）


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--xlsx", required=True)
    ap.add_argument("--region", default="")
    ap.add_argument("--sheet", default="")
    ap.add_argument("--json-out", default="")
    ap.add_argument("--show-headers", action="store_true", help="打印每张表识别到的表头")
    args = ap.parse_args()

    wb = openpyxl.load_workbook(args.xlsx, data_only=True)
    sheets = [args.sheet] if args.sheet and args.sheet in wb.sheetnames else wb.sheetnames

    all_rows, findings, recognized, skipped, notes = [], [], [], [], []
    for sn in sheets:
        ws = wb[sn]
        cands = [c for c in sheet_headers(ws)
                 if c[2] >= 3 and any(k in c[1] for k in PLANISH)]
        if not cands:
            head = []
            for r in range(1, min(ws.max_row, 6) + 1):
                t = " | ".join(cell_text(ws.cell(row=r, column=c).value)
                               for c in range(1, min(ws.max_column, 12) + 1))
                if t.strip(" |"):
                    head.append("r%d: %s" % (r, t))
            skipped.append({"sheet": sn, "rows": ws.max_row, "cols": ws.max_column,
                            "head": head[:2], "best_hits": (cands[0][2] if cands else 0)})
            continue
        hr, cols, hits, matrix, extra = cands[0]
        if not args.sheet:
            for r2, _, h2, _, _ in cands[1:]:
                if r2 != hr and h2 >= 3:
                    notes.append("「%s」另有一处疑似表头在第 %d 行（命中 %d），本次按第 %d 行核"
                                 % (sn, r2, h2, hr))
                    break
        rows = collect_rows(ws, hr, cols, extra)
        is_matrix = matrix >= 3
        for r in rows:
            r["_sheet"] = sn
        all_rows.extend(rows)
        recognized.append({"sheet": sn, "header_row": hr, "hits": hits, "composite": bool(extra),
                           "matrix_cols": matrix, "matrix": is_matrix, "rows": len(rows),
                           "cols": {k: len(v) for k, v in cols.items()}})
        if is_matrix:
            notes.append("「%s」是按季度横向铺开的**计划矩阵**（季度列 %d 个）：按「分类/子项目/"
                         "责任人/到位时间」核，不对季度格逐格判日期。" % (sn, matrix))

    lines = ["# 推进表机械核对报告", "", "- 文件：`%s`" % args.xlsx]
    if args.region:
        lines.append("- 属地口径假设：%s（须以当地当期办事指南复核）" % args.region)
    lines.append("- 工作表：共 %d 张；识别为推进表 %d 张，跳过 %d 张"
                 % (len(sheets), len(recognized), len(skipped)))

    if args.show_headers:
        lines += ["", "## 识别到的表头"]
        for i in recognized:
            lines.append("- 「%s」第 %d 行（%d 列命中）：%s"
                         % (i["sheet"], i["header_row"], i["hits"],
                            "、".join("%s×%d" % (k, v) for k, v in i["cols"].items())))
        for s in skipped:
            lines.append("- 「%s」**未识别**（最佳命中 %d，需 ≥3）｜%s"
                         % (s["sheet"], s["best_hits"], s["head"][0] if s["head"] else ""))

    if not recognized:
        lines += ["", "## 结论：**拒答** —— 本文件里没有可核对的推进表", "",
                  "不做任何缺失判定（**绝不把「没认出来」当成「全都没有」**）。",
                  "请指定一张含「任务/事项/交付物/责任人/时间节点/状态」这类列的推进表；",
                  "或用 `--sheet <表名>` 指定工作表。各表实际表头如下：", ""]
        for s in skipped:
            lines.append("### %s（%d 行 × %d 列）" % (s["sheet"], s["rows"], s["cols"]))
            lines += ["- %s" % h for h in s["head"]]
            lines.append("")
        print("\n".join(lines))
        if args.json_out:
            with open(args.json_out, "w", encoding="utf-8") as f:
                json.dump({"file": args.xlsx, "verdict": "unrecognized",
                           "recognized": recognized, "skipped": skipped},
                          f, ensure_ascii=False, indent=2)
        sys.exit(3)

    blob = "\n".join(" ".join([r["重点任务"], r["具体事项"], r["交付物"]]) for r in all_rows)
    all_cols = {}
    for i in recognized:
        for k, n in i["cols"].items():
            all_cols[k] = all_cols.get(k, 0) + n
    filled = [r for r in all_rows if (r["交付物"] or r["具体事项"] or r["重点任务"])]
    blank_template = bool(filled) and not any(
        (r["时间节点"] or r["当前状态"] or r["负责人"]) for r in filled)
    if blank_template:
        notes.append("识别到的表**尚未填写**时间/状态/责任人 —— 属**空模板**；"
                     "「缺少××任务」不再作为缺口（避免把空表当缺件）。")

    if not blank_template:
        for label, kws, group, blocking in REQUIRED:
            if label == "评价资质" and not any(k in blob for k in kws + ["证书"]):
                findings.append(("提示", "评价资质",
                                 "表内未涉及职业技能等级认定/发证事项；如计划对外发证，须补评价资质路线"))
                continue
            if not any(k in blob for k in kws):
                findings.append(("阻断" if blocking else "重要", group,
                                 "缺少「%s」相关任务（关键词：%s）" % (label, "/".join(kws))))

        # 整列不存在时只报一次（否则会逐行刷屏）；存在才逐行查空值
        has_col = {k: bool(all_cols.get(k)) for k in ("交付物", "负责人", "验收标准", "时间节点")}
        for k, lvl in (("交付物", "重要"), ("负责人", "重要"),
                       ("时间节点", "重要"), ("验收标准", "建议")):
            if not has_col[k]:
                findings.append((lvl, "缺列", "全表没有「%s」这一列，无法逐项核对" % k))

        for r in all_rows:
            missing = [k for k in ("交付物", "负责人", "验收标准", "时间节点")
                       if has_col[k] and not r[k]]
            if missing:
                findings.append(("重要", "字段空值", "第%d行「%s」缺：%s" % (
                    r["_row"], r["具体事项"][:24] or r["重点任务"][:24], "、".join(missing))))

        bad_dates = {}
        for r in all_rows:
            good, bad = dates_in(r["时间节点"])
            for b in bad:
                bad_dates.setdefault(b, []).append(r["_row"])
            if r["时间节点"] and not good and not bad:   # 有 bad 片段的交给下面的片段级事实，不重复报
                if any(s in r["时间节点"] for s in SOFT_DATE):
                    findings.append(("提示", "日期", "第%d行时间节点是软表述「%s」，非硬日期，未纳入顺序核对"
                                     % (r["_row"], r["时间节点"][:20])))
                else:
                    findings.append(("重要", "日期",
                                     "第%d行时间节点无法解析：%s" % (r["_row"], r["时间节点"])))
        for b, rs in bad_dates.items():
            findings.append(("重要", "日期", "非法日期片段「%s」出现在第%s行" % (b, "、".join(map(str, rs)))))

        for r in all_rows:
            st = r["当前状态"]
            if st and st not in STATUS_OK and not any(s in st for s in STATUS_OK):
                findings.append(("重要", "状态", "第%d行状态越界：「%s」" % (r["_row"], st[:20])))
            if st == "已完成" and any(k in r["备注"] for k in ("待确认", "待核对", "需核对", "待核")):
                findings.append(("重要", "状态", "第%d行标「已完成」但备注含待核项：%s"
                                 % (r["_row"], r["备注"][:40])))

        lic = [r for r in all_rows if any(k in (r["重点任务"] + r["具体事项"] + r["交付物"])
                                          for k in ("办学许可", "办学许可证"))]
        promo = [r for r in all_rows if any(k in (r["重点任务"] + r["具体事项"] + r["交付物"])
                                            for k in AFTER_LICENSE)]
        if not lic and promo:
            findings.append(("阻断", "顺序", "表内有招生/宣传/培训实施类任务（第%s行），"
                             "但全表无「办学许可」任务 —— 资质未取不得招生办学"
                             % "、".join(str(r["_row"]) for r in promo)))
        elif lic and promo:
            lic_end = max((as_end(d) for r in lic for d in dates_in(r["时间节点"])[0]), default=None)
            promo_start = min((as_start(d) for r in promo for d in dates_in(r["时间节点"])[0]),
                              default=None)
            if lic_end and promo_start and promo_start < lic_end:
                findings.append(("阻断", "顺序", "招生/宣传类任务最早开始 %s 早于办学许可计划完成 %s"
                                 % ("-".join(map(str, promo_start)), "-".join(map(str, lic_end)))))

        owners = {r["负责人"] for r in all_rows if r["负责人"]}
        if len(owners) == 1 and len(all_rows) > 8:
            findings.append(("建议", "分工", "全部 %d 项任务仅 1 位负责人（%s），无复核人"
                             % (len(all_rows), list(owners)[0])))

        for word, tip in (("补贴", "补贴口径须引当期文件原文，不写金额承诺"),
                          ("就业", "就业类表述一律写「协助推荐与对接」，不承诺结果与薪资"),
                          ("包就业", "禁止承诺就业")):
            if word in blob:
                findings.append(("提示", "口径", "表内出现「%s」：%s" % (word, tip)))

    order = {"阻断": 0, "重要": 1, "建议": 2, "提示": 3}
    findings.sort(key=lambda x: order.get(x[0], 9))
    counts = {}
    for lvl, _, _ in findings:
        counts[lvl] = counts.get(lvl, 0) + 1

    lines.append("- 识别的表：%s" % "、".join("「%s」(%d 行)" % (i["sheet"], i["rows"]) for i in recognized))
    if skipped:
        lines.append("- 跳过的表（非推进表）：%s" % "、".join("「%s」" % s["sheet"] for s in skipped))
    lines.append("- 数据结构：%s" % ("**空模板**（尚无时间/状态/责任人）" if blank_template else "已填写"))
    lines.append("- 结论：阻断 %d / 重要 %d / 建议 %d / 提示 %d"
                 % (counts.get("阻断", 0), counts.get("重要", 0),
                    counts.get("建议", 0), counts.get("提示", 0)))
    if notes:
        lines += ["", "## 说明"] + ["- %s" % n for n in notes]
    lines += ["", "| 级别 | 类别 | 事实 |", "|---|---|---|"]
    for lvl, cat, msg in findings:
        lines.append("| %s | %s | %s |" % (lvl, cat, msg))
    if not findings:
        lines.append("| — | — | 无 |")

    print("\n".join(lines))
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump({"file": args.xlsx, "verdict": "ok", "blank_template": blank_template,
                       "recognized": recognized, "skipped": skipped, "notes": notes,
                       "findings": findings, "counts": counts}, f, ensure_ascii=False, indent=2)
    sys.exit(1 if counts.get("阻断") else 0)


if __name__ == "__main__":
    main()
