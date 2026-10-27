# -*- coding: utf-8 -*-
"""Dựng 7 tệp việc xuất CAD (một tệp / tòa) từ chính PY_THAN của app.

Cầu MCP chạy tuần tự trên luồng chính AutoCAD, nên KHÔNG bắn 7 lệnh liền —
ghi 7 tệp rồi exec từng tệp một.
"""
import json
import pathlib
import re

ROOT = pathlib.Path(r"E:\OneDrive\_SETUP\AI_Tool\MDI_Unitmix_v4")
src = (ROOT / "prototype" / "shell.src.html").read_text(encoding="utf-8")

MOC = "const PY_THAN = String.raw`"
i = src.index(MOC) + len(MOC)
j = src.index("\n`;", i)
than = src[i:j]
assert "`" not in than, "PY_THAN con backtick"
assert "ACAD_FILTER" in than, "PY_THAN thieu XCLIP"

paths = {}
for f in (ROOT / "data/dwg").glob("*/*.dwg"):
    paths[f.stem] = f.relative_to(ROOT / "data/dwg").as_posix()

# Danh sách tòa PHẢI lấy từ TOWER_FILES của app, không tự vét toa_dwg.json.
# toa_dwg.json có 16 mã nhưng app chỉ mời dùng 7 mã có bản vẽ thật; vét cả 16
# thì 8 lượt xuất đổ vào tòa app không dùng, và AutoCAD sập trước khi tới
# 3 tòa NOXH — đúng 3 tòa cần kiểm. Đã cắn một lần.
mo = re.search(r"const TOWER_FILES = \{(.*?)\};", src, re.S)
assert mo, "khong tim thay TOWER_FILES"
DUNG = re.findall(r"(hn_[a-z0-9_]+)\s*:", mo.group(1))
assert len(DUNG) == 7, "TOWER_FILES co %d ma, cho doi 7" % len(DUNG)

d = json.loads((ROOT / "data/master/toa_dwg.json").read_text(encoding="utf-8"))
viec = []
for t in d:
    ma = t["ma"]
    if ma not in DUNG:
        continue
    if not t.get("duong_bao") or not t.get("mat"):
        continue
    xr = []
    for m in t["mat"]:
        for e in m["phan_tu"]:
            code = e.get("ma_ve_thuc") or e.get("ma_thu_vien") or e.get("block")
            if not code or code not in paths:
                continue
            xr.append({"c": code, "x": round(e["x"], 2), "y": round(e["y"], 2),
                       "r": round(e.get("rot") or 0, 4),
                       "s": -1 if (e.get("sx") or 1) < 0 else 1,
                       "n": "", "k": e["loai"]})
    if not xr:
        continue
    thu = ROOT / "xuat" / "kt2" / ma
    thu.mkdir(parents=True, exist_ok=True)
    D = {
        "goc": (ROOT / "data/dwg").as_posix(),
        "ra": (thu / ("MB_" + ma + ".dwg")).as_posix(),
        "xr": xr,
        "paths": {z["c"]: paths[z["c"]] for z in xr},
        "bao": [[round(q[0], 1), round(q[1], 1)] for q in t["duong_bao"]],
        "nhan": [],
        "bang": ["MẶT BẰNG TẦNG ĐIỂN HÌNH — " + ma,
                 "Ghép từ XREF · %d lượt chèn · XCLIP mô-đun" % len(xr)],
        "kem": 0,
    }
    tv = ROOT / "xuat" / "kt2" / ("_viec_" + ma + ".py")
    tv.write_text("D = " + json.dumps(D, ensure_ascii=False) + "\n" + than,
                  encoding="utf-8")
    viec.append((ma, len(xr), tv.as_posix()))

for ma, n, p in viec:
    print("%-12s %3d luot  %s" % (ma, n, p))
print("tong", len(viec), "toa ·", ", ".join(DUNG))
