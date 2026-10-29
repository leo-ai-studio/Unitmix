"""Chép đoạn SẢNH THANG MÁY tính chung khoang hành lang (app cũ `hlSanhTruc`, QT-100 / QT-104) sang hệ toạ độ KHỐI LÕI.

Đầu vào: kết quả `scripts/cnc_cu.js` chạy headless trên app cũ (đoạn sảnh theo toạ độ thế giới của bố cục gốc từng mẫu tòa) +
`web/public/lib/toa.json` (điểm chèn lõi). Đoạn sảnh là tính chất của khối lõi (dải trống xuyên lõi `sanhLoi` / giữa hai dãy giếng
`sanhThang`), nên ghi theo toạ độ khối: tự chỉnh mặt bằng dời lõi thì đoạn sảnh dời theo. Khối dùng ở nhiều tòa: báo nếu lệch > 50 mm.

    python scripts/chep_sanh_hl.py <cnc_cu.json>   → web/src/tinh/sanhHL.json  (+ web/src/thu/cnc_cu.json số đối chiếu cửa)
"""
import json
import math
import sys
from pathlib import Path

GOC = Path(__file__).resolve().parents[1]
cu = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
toa = json.loads((GOC / "web/public/lib/toa.json").read_text(encoding="utf-8"))
theo_ma = {t["ma_goc"]: t for t in toa}


def loi_json(block):
    p = GOC / "web/public/lib/loi" / ("loi-" + block.removeprefix("x_").replace("_", "-") + ".json")
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def ve_cuc_bo(q, p):
    r = math.radians(q["rot"])
    dx, dy = p[0] - q["x"], p[1] - q["y"]
    X, Y = dx * math.cos(r) + dy * math.sin(r), -dx * math.sin(r) + dy * math.cos(r)
    return [round(X / q["sx"], 1), round(Y / q["sy"], 1)]


def ve_the_gioi(q, p):
    r = math.radians(q["rot"])
    X, Y = p[0] * q["sx"], p[1] * q["sy"]
    return [q["x"] + X * math.cos(r) - Y * math.sin(r), q["y"] + X * math.sin(r) + Y * math.cos(r)]


def trong(p, P):
    c = False
    j = len(P) - 1
    for i in range(len(P)):
        a, b = P[i], P[j]
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
            c = not c
        j = i
    return c


kq = {}  # khối lõi → {tòa → [đoạn]}
for ma, x in cu.items():
    t = theo_ma[ma]
    loi = [q for m in t["mat"] for q in m["phan_tu"] if q["loai"] not in ("can", "thang_bo") and not q.get("bang")]
    for s in x["sanh"]:
        giua = [(s["p0"][0] + s["p1"][0]) / 2, (s["p0"][1] + s["p1"][1]) / 2]
        chon = None
        for q in loi:
            j = loi_json(q["block"])
            if not j or not j.get("bao_tm"):
                continue
            P = [ve_the_gioi(q, p) for p in j["bao_tm"]]
            if trong(giua, P) or any(trong(e, P) for e in (s["p0"], s["p1"])):
                chon = q
                break
        if not chon:
            # dấu chân BAO-TM không trùm (lõi xh-l1): lõi có tâm bao gần trung điểm đoạn nhất, trong 15 m
            def tam(q):
                j = loi_json(q["block"]) or {}
                b = j.get("bao_tuong_mm") or [0, 0, 0, 0]
                return ve_the_gioi(q, [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2])
            gan = sorted(loi, key=lambda q: math.dist(tam(q), giua))
            if gan and math.dist(tam(gan[0]), giua) <= 15000:
                chon = gan[0]
        if not chon:
            sys.exit(f"{ma}: đoạn sảnh {s['ten']} không nằm trong lõi nào")
        kq.setdefault(chon["block"], {}).setdefault(t["id"], []).append({"p0": ve_cuc_bo(chon, s["p0"]), "p1": ve_cuc_bo(chon, s["p1"]), "w": s["w"], "tm": s["tm"]})

# gộp các tòa cùng bộ đoạn (lệch ≤ 50 mm) → [{toa: [...], ds: [...]}]; tòa khác khối dùng bộ đầu tiên
def giong(a, b):
    return len(a) == len(b) and all(max(abs(u - v) for u, v in zip(x["p0"] + x["p1"], y["p0"] + y["p1"])) <= 50 for x, y in zip(a, b))
ra = {}
for blk, theo in sorted(kq.items()):
    nhom = []
    for tid, ds in theo.items():
        g = next((n for n in nhom if giong(n["ds"], ds)), None)
        if g:
            g["toa"].append(tid)
        else:
            nhom.append({"toa": [tid], "ds": ds})
    ra[blk] = nhom
(GOC / "web/src/tinh/sanhHL.json").write_text(json.dumps({"_nguon": "app cũ hlSanhTruc (QT-100 / QT-104) qua scripts/cnc_cu.js + scripts/chep_sanh_hl.py; toạ độ khối lõi (mm)", "loi": ra}, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
# số đối chiếu cửa (gọn: tim cửa + cờ, khoang từng mạng)
doi = {theo_ma[ma]["id"]: {k: {"cua": [{"p": c["p"], "sach": c["sach"]} for c in x[k]["cua"]], "doan": [d for m in x[k]["mang"] for d in m["doan"]]} for k in ("30", "60")} for ma, x in cu.items()}
(GOC / "web/src/thu/cnc_cu.json").write_text(json.dumps(doi, ensure_ascii=False), encoding="utf-8", newline="\n")
print(f"sảnh: {len(ra)} khối lõi, {sum(len(v) for v in ra.values())} bộ đoạn")
