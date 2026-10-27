# -*- coding: utf-8 -*-
"""QT-81 · BƯỚC 2 dò đường STRETCH phòng khách cho từng mẫu căn — Python thuần.

Đầu vào:  C:\\Temp\\mdi_stretch\\stretch_raw.json (bước 1: scripts/boc_stretch_autocad.py chạy trong AutoCAD)
          data/master/unit_geometry.json · data/master/units.json
Đầu ra:   data/master/units.json — mỗi mẫu căn thêm `stretch` (hoặc `stretch: null` + `stretch_ly_do`).

Luật (chủ nhiệm 16/10/2026: "STRETCH ở ô có phòng khách"; chọn "app tự dò"):
  1. Vùng phòng khách theo mặt tiền (x) = khung bao các block nội thất `F-PK-*` NẰM TRONG mô-đun căn
     (bỏ nội thất lạc ngoài mô-đun — bẫy XCLIP), nới 600 mm mỗi bên, chừa 300 mm tới mép căn.
  2. KHÔNG ĐƯỢC VỠ HÌNH (chủ nhiệm 16/10/2026, ảnh khoanh đỏ: kính logia đứt, cánh cửa đi tách khỏi vòng mở):
     đường cắt KHÔNG xuyên qua block "cứng" — block có cung tròn (cánh cửa mở) hoặc nội thất / thiết bị — và
     không xuyên nét cung / nội thất / thiết bị rời. Block chỉ gồm nét thẳng (kính lùa, lan can, louver, khung cửa sổ)
     ĐƯỢC cắt qua: lúc xuất AutoCAD TÁCH block (explode) rồi STRETCH từng đỉnh — kính / lan can giãn dài theo, không đứt.
     Quét x bước 50 mm, cách mọi nét tường DỌC ≥ 100 mm; chọn x cắt ÍT NÉT TƯỜNG NHẤT (không xẻ WC / phòng ngủ), rồi
     ÍT BLOCK NHẤT, rồi gần TÂM vùng phòng khách.
  3. Mô phỏng ĐÚNG lệnh STRETCH (cửa sổ cắt = mọi thứ có x > x_cắt, phủ hết chiều sâu căn):
       · nét rời / nét thuộc block bị cắt qua (đã tách): dời các ĐỈNH bên phải (kéo giãn) — `no: [số thứ tự block]`;
       · block KHÔNG bị cắt qua: STRETCH dời NGUYÊN block theo ĐIỂM CHÈN → nét nằm một phía mà điểm chèn ở phía
         kia thì app dời cứng theo điểm chèn — `cung: [[chỉ số nét, 0|1]]`.
  4. Chiều sâu cắt: tổng đoạn nằm trong polygon `space` (thông thuỷ) và `tim` (tim tường) trên đường x —
     kéo giãn st mm thì DT TT tăng st·sau_tt, DT tim tăng st·sau_tim (đúng shoelace của polygon đã STRETCH).
  Căn góc V (`khung`) và căn không có F-PK / không có x sạch: `stretch: null`.
"""
import hashlib, json, pathlib, sys

# dùng ĐÚNG bảng phân lớp của bộ bóc dự án (import có tác dụng phụ đọc RAW/insbase.json — trỏ tạm vào thư mục dump)
_argv = sys.argv; sys.argv = [_argv[0], r"C:\Temp\mdi_stretch"]
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import boc_cad_p16 as B  # noqa: E402
sys.argv = _argv

GOC = pathlib.Path(__file__).resolve().parent.parent
RAW = pathlib.Path(r"C:\Temp\mdi_stretch\stretch_raw.json")
D = 8500.0
BUOC, NOI, CHUA, CACH_TUONG, LE_BLK = 50, 600, 300, 100, 30


def doan(pts):
    return list(zip(pts, pts[1:]))


def cat_x(poly, x):
    """tổng chiều dài đường dọc x nằm trong polygon (luật chẵn–lẻ)"""
    ys = []
    P = poly if poly[0] == poly[-1] else poly + [poly[0]]
    for (x1, y1), (x2, y2) in doan(P):
        if (x1 <= x < x2) or (x2 <= x < x1):
            ys.append(y1 + (y2 - y1) * (x - x1) / (x2 - x1))
    ys.sort()
    return sum(ys[i + 1] - ys[i] for i in range(0, len(ys) - 1, 2))


def main():
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    ug = json.loads((GOC / "data/master/unit_geometry.json").read_text(encoding="utf-8"))
    up = GOC / "data/master/units.json"
    um = json.loads(up.read_text(encoding="utf-8"))
    bang = []
    for u in um:
        ma, F = u["ma"], float(u["dai_mm"])
        u.pop("stretch_ly_do", None)
        g, r = ug.get(ma), raw.get(ma)
        ly = None
        if not g: ly = "chưa có hình học"
        elif any(p["cat"] == "khung" for p in g): ly = "căn góc V (khung nêm góc tòa)"
        elif not r or r.get("loi"): ly = "chưa bóc được tệp CAD"
        pk = [] if ly else [b for b in r["pk"] if b[0] > -500 and b[1] < F + 500 and b[2] > -500 and b[3] < D + 500]
        if not ly and not pk: ly = "không có nội thất phòng khách (F-PK-*)"
        if ly:
            u["stretch"] = None; u["stretch_ly_do"] = ly; bang.append((ma, "—", ly)); continue
        X0 = max(CHUA, min(b[0] for b in pk) - NOI); X1 = min(F - CHUA, max(b[1] for b in pk) + NOI)
        tam = (min(b[0] for b in pk) + max(b[1] for b in pk)) / 2
        mm = [[(q[0] * F, q[1] * D) for q in p["pts"]] for p in g]
        # điểm chèn block của từng nét app — lọc `net` thô ĐÚNG như boc_cad_p16.boc_can() (bỏ khung DefPoints kín,
        # bỏ lớp không phân loại) để chỉ số trùng unit_geometry.json
        net = [n for n in r.get("net", [])
               if not ((n[0] or "").lower() == "defpoints" and n[1]) and B.phan_loai(n[0], B.LOP_CAN)]
        chen = [n[2] for n in net]
        if len(chen) > len(g) or len(chen) < len(g) - 2:
            u["stretch"] = None; u["stretch_ly_do"] = f"số nét bóc lại ({len(chen)}) không khớp hình học ({len(g)}) — bóc lại CAD"
            bang.append((ma, "—", u["stretch_ly_do"])); continue
        tuong_doc = [s for p, m in zip(g, mm) if p["cat"] == "wall" for s in doan(m)
                     if abs(s[0][0] - s[1][0]) < 1]

        # nhóm nét app theo block cấp ngoài cùng; block "cứng" = có cung tròn (cánh cửa mở) hoặc nội thất / thiết bị
        CUNG_TRON = {"Arc", "Circle", "Ellipse", "Spline"}
        nhom = {}
        for i, n in enumerate(net[:len(g)]):
            if n[3] is not None and n[3] >= 0: nhom.setdefault(n[3], []).append(i)
        cung_khoi = {k for k, ids in nhom.items()
                     if any(net[i][4] in CUNG_TRON or g[i]["cat"] in ("furn", "equip") for i in ids)}
        rong = {k: (min(q[0] for i in ids for q in mm[i]), max(q[0] for i in ids for q in mm[i])) for k, ids in nhom.items()}
        roi_cam = [i for i in range(min(len(net), len(g))) if (net[i][3] is None or net[i][3] < 0)
                   and (net[i][4] in CUNG_TRON or g[i]["cat"] in ("furn", "equip"))]

        def cat_blk(x):
            return [k for k, (a, b) in rong.items() if a + LE_BLK < x < b - LE_BLK]

        def sach(x):
            if any(k in cung_khoi for k in cat_blk(x)): return False
            return not any(min(q[0] for q in mm[i]) < x < max(q[0] for q in mm[i]) for i in roi_cam)

        cand = [x for x in range(int(X0 // BUOC * BUOC), int(X1) + 1, BUOC)
                if X0 <= x <= X1 and all(abs(s[0][0] - x) >= CACH_TUONG for s in tuong_doc) and sach(x)]
        if not cand:
            u["stretch"] = None
            u["stretch_ly_do"] = "không có đường cắt qua phòng khách mà không xuyên cửa đi / nội thất / tường dọc"
            bang.append((ma, "—", u["stretch_ly_do"])); continue
        tuong = [m for p, m in zip(g, mm) if p["cat"] == "wall"]

        def cat_tuong(x):
            # số nét tường bị đường cắt xuyên qua — đường qua phòng khách thông thoáng chỉ cắt tường ngoài
            # (mặt đứng, hành lang, logia); cắt thêm là đang xẻ cả WC / phòng ngủ ra (đo: 2pn_m2 x=2.150 xẻ WC)
            return sum(1 for m in tuong if any(min(x1, x2) < x < max(x1, x2) for (x1, _), (x2, _) in doan(m)))

        x = min(cand, key=lambda v: (cat_tuong(v), len(cat_blk(v)), abs(v - tam), v))
        no = sorted(cat_blk(x))           # block bị cắt qua — AutoCAD tách ra rồi STRETCH đỉnh
        # Block KHÔNG bị cắt: STRETCH dời nguyên block theo điểm chèn → ghi `cung` khi luật đỉnh của app cho kết quả
        # khác (nét nằm một phía mà điểm chèn ở phía kia — cánh cửa, ghế). Biết CHÍNH XÁC nét nào thuộc block nào
        # từ bước 1, không đoán bằng khung bao (bản đầu gán nhầm đoạn tường nhỏ trong khung cửa: lệch 500 mm).
        cung = []
        for i, (p, m) in enumerate(zip(g, mm)):
            if i >= len(net) or chen[i] is None or net[i][3] in no or p["cat"] in ("space", "tim"): continue
            xs = [q[0] for q in m]
            dich = 1 if chen[i] > x else 0
            if (1 if min(xs) > x else 0) != dich or min(xs) < x < max(xs):
                cung.append([i, dich])
        nb = len(cat_blk(x))
        space = [m for p, m in zip(g, mm) if p["cat"] == "space"]
        tim = [m for p, m in zip(g, mm) if p["cat"] == "tim"]
        sau_tt = round(sum(cat_x(m, x) for m in space)); sau_tim = round(sum(cat_x(m, x) for m in tim))
        if not sau_tt or not sau_tim:
            u["stretch"] = None; u["stretch_ly_do"] = "thiếu polygon thông thuỷ / tim tường tại đường cắt — không tính được diện tích"
            bang.append((ma, "—", u["stretch_ly_do"])); continue
        tep = GOC / "data/dwg/x-canho-bt" / (ma + ".dwg")
        sha = hashlib.sha256(tep.read_bytes()).hexdigest() if tep.exists() else None
        u["stretch"] = {"x_mm": x, "sau_tt_mm": sau_tt, "sau_tim_mm": sau_tim, "nguon": "tu_do", "cung": cung, "no": no,
                        # gắn với PHIÊN BẢN CAD đã dò (cùng kiểu băm với trang_thai_boc_can.json): tệp .dwg đổi mà
                        # hai số băm khác nhau là phải chạy lại hai bước dò
                        "dwg_sha256": sha,
                        "ly_do": f"phòng khách (F-PK) {round(min(b[0] for b in pk))}–{round(max(b[1] for b in pk))} mm, "
                                 f"cắt {cat_tuong(x)} nét tường, {nb} block"}
        bang.append((ma, x, f"sâu TT {sau_tt} · tim {sau_tim} · {cat_tuong(x)} tường · {nb} block · {len(cung)} nét dời cứng"))
    # `cung` (hàng chục cặp [chỉ số, 0|1]) viết trên MỘT dòng — giữ units.json đọc được, diff gọn
    giu = {}
    for u in um:
        if u.get("stretch"):
            k = "@@CUNG_%s@@" % u["ma"]
            giu[k] = json.dumps(u["stretch"]["cung"]); u["stretch"]["cung"] = k
            giu[k + "N"] = json.dumps(u["stretch"]["no"]); u["stretch"]["no"] = k + "N"
    txt = json.dumps(um, ensure_ascii=False, indent=1)
    for k, v in giu.items():
        txt = txt.replace('"%s"' % k, v)
    up.write_text(txt + "\n", encoding="utf-8")
    for z in bang: print(*z, sep=" | ")
    print(f"{sum(1 for z in bang if z[1] != '—')}/{len(bang)} mẫu có đường STRETCH")


if __name__ == "__main__":
    sys.exit(main())
