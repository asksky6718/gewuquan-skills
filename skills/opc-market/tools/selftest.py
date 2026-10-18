#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""selftest.py — lead_check.py 击穿用例（不调模型、不花额度）。

每道门都有「必须被拒」的用例 ＋ 一组「必须全过」的正例。
运行：python tools/selftest.py    退出码 0 全绿 ｜ 1 有用例失败
"""
import json
import os
import subprocess
import sys
import tempfile

TOOL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lead_check.py")
REG = {"subjects": ["示例培训学校", "示例科技"]}


def good(idx):
    return {"lead_id": "lead-20261009-%03d" % idx, "source_channel": "short_video",
            "subject": "示例培训学校", "contact": "138%08d" % idx,
            "need": "人工智能训练师课程咨询-%03d" % idx, "opc_level": "L2",
            "opc_level_source": "auto_with_evidence", "evidence_ref": "archive://demo/%d" % idx,
            "pending_level_review": False, "owner_subject": "示例科技",
            "created_at": "2026-10-09T10:00:00"}


CASES = [
    ("IN-1 渠道缺失", lambda g: {**g, "source_channel": ""}, 1),
    ("IN-1 渠道 unknown", lambda g: {**g, "source_channel": "unknown"}, 1),
    ("IN-2 主体不在名册", lambda g: {**g, "subject": "无名册主体"}, 1),
    ("IN-3 手机号非法", lambda g: {**g, "contact": "12345"}, 1),
    ("IN-3 邮箱非法", lambda g: {**g, "contact": "a@b"}, 1),
    ("IN-4 同主体同需求重复", None, 1),
    ("IN-5 空级别未挂人工", lambda g: {**g, "opc_level": "", "pending_level_review": False,
                                       "opc_level_source": "human", "level_by": "someone"}, 1),
    ("IN-5 自动定级无证据指针", lambda g: {**g, "evidence_ref": ""}, 1),
    ("IN-5 级别越界", lambda g: {**g, "opc_level": "L10"}, 1),
    ("正例：自动定级", lambda g: g, 0),
    ("正例：空级别挂人工", lambda g: {**g, "opc_level": "", "pending_level_review": True,
                                      "opc_level_source": "human", "level_by": "定级人"}, 0),
    ("正例：other 渠道带说明", lambda g: {**g, "source_channel": "other:行业展会扫码"}, 0),
]


def run(args):
    r = subprocess.run([sys.executable, TOOL] + args,
                       capture_output=True, text=True, encoding="utf-8")
    return r.returncode, r.stdout


def main():
    fails = 0
    with tempfile.TemporaryDirectory() as tmp:
        reg_path = os.path.join(tmp, "reg.json")
        with open(reg_path, "w", encoding="utf-8") as f:
            json.dump(REG, f, ensure_ascii=False)
        for name, mutate, want in CASES:
            leads = [good(i) for i in range(3)]
            if name.startswith("IN-4"):
                leads.append(dict(leads[0]))           # 同主体同需求重复
            elif mutate:
                leads[1] = mutate(leads[1])            # 第 2 条带伤，其余健康
            p = os.path.join(tmp, "leads.json")
            with open(p, "w", encoding="utf-8") as f:
                json.dump({"leads": leads}, f, ensure_ascii=False)
            rc, out = run(["validate", p, "--registry", reg_path])
            ok = rc == want
            if not ok:
                fails += 1
            print(("OK  " if ok else "FAIL ") + name + " | rc=%d want=%d" % (rc, want))
            if not ok:
                print("     " + out.strip()[:200])
    print("RESULT:", "ALL GREEN" if fails == 0 else "%d FAILED" % fails)
    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
