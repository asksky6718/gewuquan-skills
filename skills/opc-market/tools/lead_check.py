#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""lead_check.py — 受理段 5 道门机判（IN-1…IN-5）。

只依赖 Python 标准库，不联网、不装包、不调模型。
用法：
  python tools/lead_check.py validate <lead.json> [--registry <主体名册.json>]
  python tools/lead_check.py render   <lead.json> --md | --html
退出码：0 全部通过 ｜ 1 存在拒收 ｜ 2 文件或参数错误
"""
import json
import re
import sys

PHONE_RE = re.compile(r"^1\d{10}$")
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
LEVELS = {"L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9"}
KNOWN_CHANNELS = {"short_video", "live", "wechat_mp", "zhihu", "community",
                  "referral", "event"}


def load(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and isinstance(data.get("leads"), list):
        return data["leads"]
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    raise ValueError("lead.json 结构不支持：须为对象、数组或 {leads:[…]}")


def check_one(rec, registry, seen):
    """返回 [(gate, reason), …]；空列表＝通过。"""
    fails = []

    def s(k):
        v = rec.get(k)
        return v.strip() if isinstance(v, str) else ""

    # IN-1 渠道归因完整
    ch = s("source_channel")
    if not ch or ch.lower() == "unknown":
        fails.append(("IN-1", "渠道归因缺失或为 unknown"))
    elif ch not in KNOWN_CHANNELS and not ch.startswith("other:"):
        fails.append(("IN-1", "渠道「%s」不在已知集，且未用 other:<说明>" % ch))

    # IN-2 主体合法
    subject, owner = s("subject"), s("owner_subject")
    if not subject or not owner:
        fails.append(("IN-2", "subject 或 owner_subject 缺失"))
    elif registry is not None:
        names = registry.get("subjects") if isinstance(registry, dict) else registry
        names = {n if isinstance(n, str) else n.get("name", "") for n in (names or [])}
        if subject not in names:
            fails.append(("IN-2", "主体「%s」不在名册内" % subject))

    # IN-3 联系方式格式
    contact = s("contact")
    if not contact:
        fails.append(("IN-3", "contact 缺失"))
    elif not (PHONE_RE.match(contact) or EMAIL_RE.match(contact)):
        fails.append(("IN-3", "contact 既非 11 位手机号也非合法邮箱"))

    # IN-4 幂等去重（同文件内 subject＋need）
    key = (subject, s("need"))
    if key in seen:
        fails.append(("IN-4", "与先前记录重复（同主体＋同需求）"))
    else:
        seen.add(key)

    # IN-5 级别有出处（②D：有证据的自动、无证据的挂人工）
    level, src = s("opc_level"), s("opc_level_source")
    pending = rec.get("pending_level_review")
    if not level:
        if pending is not True:
            fails.append(("IN-5", "opc_level 为空时必须 pending_level_review=true"))
        if src != "human":
            fails.append(("IN-5", "无证据线索 opc_level_source 必须为 human"))
    else:
        if level not in LEVELS:
            fails.append(("IN-5", "opc_level「%s」不在 L1–L9 内" % level))
        if src == "auto_with_evidence":
            if not s("evidence_ref"):
                fails.append(("IN-5", "auto_with_evidence 必须附 evidence_ref"))
        elif src == "human":
            if not s("level_by"):
                fails.append(("IN-5", "human 定级必须附 level_by"))
        else:
            fails.append(("IN-5", "opc_level_source 须为 auto_with_evidence 或 human"))
    return fails


def cmd_validate(args):
    path, registry = args[0], None
    if "--registry" in args:
        i = args.index("--registry")
        with open(args[i + 1], encoding="utf-8") as f:
            registry = json.load(f)
    try:
        leads = load(path)
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}, ensure_ascii=False))
        return 2
    seen, failures = set(), []
    for idx, rec in enumerate(leads):
        for gate, why in check_one(rec, registry, seen):
            failures.append({"row": idx, "lead_id": rec.get("lead_id", ""),
                             "gate": gate, "reason": why})
    out = {"ok": not failures, "total": len(leads),
           "rejected": len({f["row"] for f in failures}), "failures": failures}
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return 0 if out["ok"] else 1


def cmd_render(args):
    path, mode = args[0], "md"
    if "--html" in args:
        mode = "html"
    elif "--md" in args:
        mode = "md"
    try:
        leads = load(path)
    except Exception as e:
        print("render 失败：%s" % e, file=sys.stderr)
        return 2
    cols = ["lead_id", "source_channel", "subject", "need", "opc_level",
            "opc_level_source", "pending_level_review", "created_at"]
    if mode == "md":
        print("| " + " | ".join(cols) + " |")
        print("|" + "---|" * len(cols))
        for r in leads:
            print("| " + " | ".join(str(r.get(c, "")) for c in cols) + " |")
        return 0
    rows = "".join("<tr>%s</tr>" % "".join(
        "<td>%s</td>" % r.get(c, "") for c in cols) for r in leads)
    head = "".join("<th>%s</th>" % c for c in cols)
    print("<html><head><meta charset='utf-8'><title>线索受理单</title></head>"
          "<body><h1>线索受理单（%d 条）</h1><table border='1'>%s%s</table>"
          "</body></html>" % (len(leads), "<tr>%s</tr>" % head, rows))
    return 0


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    cmd = sys.argv[1]
    if cmd == "validate":
        return cmd_validate(sys.argv[2:])
    if cmd == "render":
        return cmd_render(sys.argv[2:])
    print("未知命令：%s" % cmd)
    return 2


if __name__ == "__main__":
    sys.exit(main())
