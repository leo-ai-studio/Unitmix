"""BƯỚC 2 · Bóc TỔNG MẶT BẰNG QUY HOẠCH → danh sách lô đất (tên · loại · chỉ tiêu · ranh VN2000 + WGS84) — Python thuần.

Đầu vào: tệp thô của bước 1 (`scripts/boc_tmb_qh_autocad.py`, chạy trong AutoCAD).
Đầu ra : --json lo_dat.json (app nạp ở "Tổng mặt bằng QH") · --kmz lo_dat.kmz (mở bằng Google Earth).

    PYTHONIOENCODING=utf-8 python scripts/boc_tmb_qh.py C:/Temp/mdi_qh/raw_tmb.json --kt 105.75 \\
        --json C:/Temp/mdi_qh/lo_dat.json --kmz C:/Temp/mdi_qh/lo_dat.kmz

Quy ước bản vẽ QH 1/500 mà bộ này đọc (đo trên bản vẽ NOXH Tràng Cát, Hải Phòng — 37 lô):
  · KÝ HIỆU LÔ = cụm chữ rời: TÊN LÔ (chữ cái + số, vd NXH1, CC4, GD2, CCĐT); ngay dưới là DIỆN TÍCH (m², dấu chấm hàng
    nghìn, phẩy thập phân: "23.805,3"); hàng dưới cùng hai số: TRÁI = MĐXD (%), PHẢI = TẦNG CAO ("-" = không quy định).
  · RANH LÔ = polyline KÍN (lớp tuỳ văn phòng — mẫu này nằm ở VIAHE) có diện tích KHỚP số ghi. Không có polyline kín
    (lô vẽ bằng nét rời — NXH3, NXH4 ở mẫu) thì dựng mạng nét phẳng (polygonize) rồi lấy ô chứa tên lô có diện tích khớp.
  · Không khớp được (lệch > 3 %) → vẫn ghi lô nhưng `ranh = null` + cảnh báo — KHÔNG đoán ranh.
Bản TMB / QHPK KHÔNG ghi ký hiệu lô (đo trên TMB M7 Đan Phượng): ô đất chỉ là HATCH tô màu + bảng chú thích ("ĐẤT NHÀ Ở XÃ HỘI
  - 12 TẦNG"). NOXH / NOTM dùng CHUNG một lớp, chỉ khác MÀU → chú thích ghép theo (lớp, màu, mẫu tô). Hatch đất nhà ở cao tầng
  (xã hội / thương mại / chung cư / hỗn hợp) không nằm trong lô có ký hiệu → thêm lô: tên tự đặt (NOXH-1, NOTM-1…), ranh = vòng
  ngoài hatch, DT = DT đo, tầng đọc từ chú thích, MĐXD để trống (app dùng Bảng 2.9).
CHỈ GIỚI XÂY DỰNG (QT-118b): polyline / nét ở lớp có chữ "cgxd" hoặc "chi gioi xay dung" (đổi bằng --lop-cgxd "<regex>", không
  phân biệt hoa thường) nằm trong lô → với mỗi cạnh giáp đường đo khoảng cách vuông góc tới nét CGXD gần nhất song song cạnh đó →
  `lui_qh` (m, trung vị, làm tròn 0,1) + `lui_qh_canh` (theo cạnh, None = không đo được). Ghi bằng CHỮ ("khoảng lùi 6m", "KL ≥ 6 m",
  "lùi 10m") trong / sát lô cũng đọc vào `lui_qh`; hai nguồn lệch > 1 m → lấy số đo hình học + `canh_bao`. Không có lớp CGXD và không
  có chữ → KHÔNG ghi khoá (app dùng QCVN 01:2021 Bảng 2.7). Khoảng lùi yêu cầu = max(Bảng 2.7, lui_qh).
Toạ độ giữ nguyên của bản vẽ (VN2000, mét); `--kt` = kinh tuyến trục VN2000 của tỉnh (xem scripts/vn2000.py).
"""
import json
import math
import re
import sys
import unicodedata
import zipfile
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vn2000 import vn2000_sang_wgs84  # noqa: E402

TEN_LO = re.compile(r"^[A-Za-zĐđ]{1,6}[-_.]?\d{0,3}[A-Za-z]?\d{0,2}$")
SO = re.compile(r"^\d{1,3}(?:\.\d{3})*(?:,\d+)?$|^\d+(?:,\d+)?$")
LOAI = [("NOXH", "nha_o_xa_hoi"), ("NXH", "nha_o_xa_hoi"), ("CT", "chung_cu"), ("CCĐT", "cong_cong"), ("CC", "cong_cong"),
        ("HH", "hon_hop"), ("TM", "thuong_mai_dich_vu"), ("GD", "giao_duc"), ("MN", "giao_duc"), ("TH", "giao_duc"),
        ("CX", "cay_xanh"), ("LK", "lien_ke"), ("BT", "biet_thu"), ("DMKT", "ha_tang_ky_thuat"), ("HT", "ha_tang_ky_thuat"),
        ("P", "bai_do_xe"), ("YT", "y_te")]
LOP_CGXD = r"cgxd|chi[ _.-]?gioi[ _.-]?xay[ _.-]?dung|chỉ[ _.-]?giới[ _.-]?xây[ _.-]?dựng"   # lớp chỉ giới xây dựng (--lop-cgxd)
CHU_LUI = re.compile(r"(?<!\w)(?:kho[ảa]ng\s+l[ùu]i|l[ùu]i|kl)(?!\w)\s*[:≥>=]*\s*(\d+(?:[.,]\d+)?)\s*m(?!\w)", re.I)
LOP_TIM = r"(^|[^a-z])tim"                             # lớp tim đường (đổi bằng --lop-tim)
XAY_CAN_HO = {"nha_o_xa_hoi", "chung_cu", "hon_hop"}     # lô đặt được tòa chung cư


# TCVN3 (ABC, font .VnTime/.VnHelvet…) → Unicode. Bản chữ thường; font "…H" (chữ hoa) dùng CÙNG mã nên giải ra chữ thường.
_TCVN3 = dict(zip(
    "¸µ¶·¹¨¾»¼½Æ©ÊÇÈÉË®ÐÌÎÏÑªÕÒÓÔÖÝ×ØÜÞãßáâä«èåæçé¬íêëìîóïñòô­øõö÷ùýúûüþ¡¢§£¤¥¦",
    "áàảãạăắằẳẵặâấầẩẫậđéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵĂÂĐÊÔƠƯ"))
_DAU_TCVN3 = set("¸µ¶·¹¨¾»¼½Æ©ÊÇÈÉË®ÐÌÎÏÑªÕÒÓÔÖÝ×ØÜÞãßáâä«èåæçé¬íêëìîóïñòô­øõö÷ùýúûüþ")


def tcvn3(s):
    """Chuỗi có ký tự đặc trưng TCVN3 và KHÔNG có chữ Việt Unicode dựng sẵn → giải mã; còn lại giữ nguyên."""
    if not s or not any(ch in _DAU_TCVN3 for ch in s) or any("Ạ" <= ch <= "ỹ" or ch in "đĐăĂơƠưƯ" for ch in s):
        return s
    r = "".join(_TCVN3.get(ch, ch) for ch in s)
    # font chữ HOA (.VnTimeH…) dùng chung mã với chữ thường → chuỗi phần lớn là chữ hoa ASCII thì viết hoa toàn bộ
    hoa = sum(c.isupper() for c in s if c.isascii() and c.isalpha())
    thuong = sum(c.islower() for c in s if c.isascii() and c.isalpha())
    return r.upper() if hoa > 0 and hoa >= 2 * thuong else r


def so_vn(s):
    s = s.strip()
    if s in ("-", "–", ""):
        return None
    return float(s.replace(".", "").replace(",", "."))


def dien_tich(P):
    return abs(sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))) / 2


def trong(pt, P):
    x, y = pt
    c = False
    for i in range(len(P)):
        x1, y1 = P[i]
        x2, y2 = P[(i + 1) % len(P)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


# ---------------------------------------------------------------------------------------------- ký hiệu lô
def tim_ky_hieu(texts):
    """Cụm chữ ký hiệu lô → [{ten, x, y, dt_ghi, mdxd, tang}]."""
    so = [t for t in texts if SO.match(t["t"].strip()) or t["t"].strip() in ("-", "–")]
    out = []
    for t in texts:
        ten = t["t"].strip()
        if not TEN_LO.match(ten) or ten.isdigit():
            continue
        h = max(t.get("h") or 1.0, 0.5)
        gan = [u for u in so if u is not t and -6 * h < u["y"] - t["y"] < 0 and abs(u["x"] - t["x"]) < 4 * h]
        if len(gan) < 2:
            continue
        gan.sort(key=lambda u: (u["y"] - t["y"]) ** 2 + (u["x"] - t["x"]) ** 2)
        dt = next((u for u in gan if ("." in u["t"] or "," in u["t"] or (so_vn(u["t"]) or 0) > 100)), gan[0])
        duoi = sorted([u for u in gan if u is not dt and u["y"] < dt["y"] - 0.3 * h], key=lambda u: u["x"])[:2]
        mdxd = so_vn(duoi[0]["t"]) if len(duoi) >= 1 else None
        tang = so_vn(duoi[1]["t"]) if len(duoi) >= 2 else None
        try:
            dt_ghi = so_vn(dt["t"])
        except ValueError:
            continue
        if dt_ghi is None or (mdxd is not None and mdxd > 100):
            continue
        out.append({"ten": ten, "x": t["x"], "y": t["y"], "h": h, "dt_ghi": dt_ghi, "mdxd": mdxd, "tang": tang})
    return out


# ---------------------------------------------------------------------------------------------- polygonize
def polygonize(segs, tol=1e-3, o_luoi=25.0):
    """Mạng nét phẳng → các ô kín (đi theo mặt trái). Python thuần: bẻ nét ở giao điểm (lưới băm), rồi duyệt nửa-cạnh."""
    ds = []
    for s in segs:
        p = s["p"]
        for i in range(len(p) - 1):
            if math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]) > tol:
                ds.append((p[i], p[i + 1]))
        if s.get("c") and len(p) > 2:
            ds.append((p[-1], p[0]))
    luoi = defaultdict(list)
    for k, (a, b) in enumerate(ds):
        for gx in range(int(min(a[0], b[0]) // o_luoi), int(max(a[0], b[0]) // o_luoi) + 1):
            for gy in range(int(min(a[1], b[1]) // o_luoi), int(max(a[1], b[1]) // o_luoi) + 1):
                luoi[(gx, gy)].append(k)
    cat = defaultdict(list)                                  # k → các tham số t chỗ bị cắt
    for ks in luoi.values():
        for i in range(len(ks)):
            a, b = ds[ks[i]]
            for j in range(i + 1, len(ks)):
                c, d = ds[ks[j]]
                r = (b[0] - a[0], b[1] - a[1])
                s_ = (d[0] - c[0], d[1] - c[1])
                den = r[0] * s_[1] - r[1] * s_[0]
                if abs(den) < 1e-12:
                    continue
                t = ((c[0] - a[0]) * s_[1] - (c[1] - a[1]) * s_[0]) / den
                u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den
                if -1e-9 <= t <= 1 + 1e-9 and -1e-9 <= u <= 1 + 1e-9:
                    cat[ks[i]].append(t)
                    cat[ks[j]].append(u)
    snap = lambda p: (round(p[0] / tol), round(p[1] / tol))
    canh = set()
    for k, (a, b) in enumerate(ds):
        ts = sorted(set([0.0, 1.0] + [min(1, max(0, t)) for t in cat.get(k, [])]))
        pts = [snap((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) for t in ts]
        for p, q in zip(pts, pts[1:]):
            if p != q:
                canh.add((p, q))
                canh.add((q, p))
    ke = defaultdict(list)
    for p, q in canh:
        ke[p].append(q)
    goc = {}
    for p, qs in ke.items():
        qs.sort(key=lambda q: math.atan2(q[1] - p[1], q[0] - p[0]))
        goc[p] = {q: i for i, q in enumerate(qs)}
    da = set()
    mat = []
    for e in canh:
        if e in da:
            continue
        vong, cur = [], e
        while cur not in da and len(vong) < 5000:
            da.add(cur)
            p, q = cur
            vong.append(p)
            qs = ke[q]
            i = goc[q][p]
            nxt = qs[(i - 1) % len(qs)]                       # rẽ phải nhất ở đỉnh q → mặt bên trái
            cur = (q, nxt)
        if len(vong) >= 3:
            P = [(x * tol, y * tol) for x, y in vong]
            a = sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P))) / 2
            if a > 1.0:                                       # mặt trong (ngược kim đồng hồ); bỏ mặt ngoài
                mat.append(P)
    return mat


# ---------------------------------------------------------------------------------------------- cạnh giáp đường
def _cat_tia(o, d, a, b):
    """Tia o + t·d (t > 0) cắt đoạn ab → t hoặc None."""
    ex, ey = b[0] - a[0], b[1] - a[1]
    den = d[0] * ey - d[1] * ex
    if abs(den) < 1e-12:
        return None
    t = ((a[0] - o[0]) * ey - (a[1] - o[1]) * ex) / den
    u = ((a[0] - o[0]) * d[1] - (a[1] - o[1]) * d[0]) / den
    return t if t > 1e-6 and -1e-9 <= u <= 1 + 1e-9 else None


def canh_giap_duong(ranh, ranh_khac, tim, xa=150.0, ranh_phu=()):
    """Mỗi cạnh lô: dóng tia ra NGOÀI từ trung điểm. Tia cắt TIM ĐƯỜNG trước khi chạm lô khác → cạnh giáp đường;
    lộ giới = khoảng tới chỉ giới lô bên kia (nếu ≤ 2,6 × khoảng tới tim) — không có thì 2 × khoảng tới tim.
    ranh_phu = ô hatch không có ký hiệu (cây xanh, công cộng…): CHỈ dùng làm chỉ giới bên kia khi nằm SAU tim — không dùng để
    quyết định giáp đường (hatch dải cây xanh giữa đường che tim).
    Trả [{i, dai, duong, rong}] (rong = lộ giới m, None khi không giáp đường)."""
    P = ranh[:]
    a2 = sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P)))
    ccw = a2 > 0
    out = []
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 1e-6:
            out.append({"i": i, "dai": 0, "duong": False, "rong": None})
            continue
        n = ((b[1] - a[1]) / L, -(b[0] - a[0]) / L) if ccw else (-(b[1] - a[1]) / L, (b[0] - a[0]) / L)
        m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        tt = [x for s in tim for k in range(len(s) - 1) for x in [_cat_tia(m, n, s[k], s[k + 1])] if x is not None and x < xa]
        tl = [x for R in ranh_khac for k in range(len(R)) for x in [_cat_tia(m, n, R[k], R[(k + 1) % len(R)])] if x is not None and x < xa]
        t_tim, t_lo = (min(tt) if tt else None), (min(tl) if tl else None)
        if t_tim is not None and (t_lo is None or t_tim < t_lo):
            bk = [t_lo] if t_lo is not None else []
            bk += [x for R in ranh_phu for k in range(len(R)) for x in [_cat_tia(m, n, R[k], R[(k + 1) % len(R)])]
                   if x is not None and t_tim < x < xa]
            t_bk = min(bk) if bk else None
            rong = t_bk if (t_bk is not None and t_bk <= 2.6 * t_tim) else 2 * t_tim
            out.append({"i": i, "dai": round(L, 2), "duong": True, "rong": round(rong, 1)})
        else:
            out.append({"i": i, "dai": round(L, 2), "duong": False, "rong": None})
    return out


# ---------------------------------------------------------------------------------------------- chỉ giới xây dựng
def lui_cgxd_canh(ranh, canh, cg, sin_max=0.0873, phu_min=0.25):
    """Mỗi cạnh giáp đường: khoảng cách vuông góc (về phía TRONG lô) tới nét CGXD song song gần nhất → [m | None] theo `canh`
    (chỉ các cạnh giáp đường, đúng thứ tự). cg = danh sách polyline (list điểm) lớp CGXD.
    Song song: |sin góc| ≤ 5°; phủ chiếu lên cạnh ≥ 25 % (và ≥ 0,5 m)."""
    P = ranh
    ccw = sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P))) > 0
    out = []
    for c in canh:
        if not c["duong"]:
            continue
        a, b = P[c["i"]], P[(c["i"] + 1) % len(P)]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 1e-6:
            out.append(None)
            continue
        u = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        n = (-u[1], u[0]) if ccw else (u[1], -u[0])               # pháp tuyến hướng VÀO lô
        ds = []
        for pl in cg:
            for k in range(len(pl) - 1):
                p, q = pl[k], pl[k + 1]
                l2 = math.hypot(q[0] - p[0], q[1] - p[1])
                if l2 < 1e-6 or abs(u[0] * (q[1] - p[1]) - u[1] * (q[0] - p[0])) / l2 > sin_max:
                    continue
                t1 = (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1]
                t2 = (q[0] - a[0]) * u[0] + (q[1] - a[1]) * u[1]
                ov = min(max(t1, t2), L) - max(min(t1, t2), 0.0)
                if ov < phu_min * min(L, l2) or ov < 0.5:
                    continue
                m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
                d = (m[0] - a[0]) * n[0] + (m[1] - a[1]) * n[1]
                if -0.05 <= d <= 60:
                    ds.append(max(d, 0.0))
        out.append(round(min(ds), 2) if ds else None)
    return out


def lui_chu(texts, ranh, nhan, h):
    """Ghi chú khoảng lùi bằng chữ trong lô (hoặc sát nhãn lô khi thiếu ranh) → m hoặc None (nhiều ghi chú: lấy lớn nhất)."""
    v = []
    for t in texts:
        if ranh:
            if not trong((t["x"], t["y"]), ranh):
                continue
        elif math.hypot(t["x"] - nhan[0], t["y"] - nhan[1]) > 12 * h:
            continue
        for m in CHU_LUI.finditer(t["t"] + " | " + t.get("t0", "")):
            v.append(float(m.group(1).replace(",", ".")))
    return max(v) if v else None


# ---------------------------------------------------------------------------------------------- chính
def _tam(lp):
    return (sum(q[0] for q in lp) / len(lp), sum(q[1] for q in lp) / len(lp))


def khoa_hatch(h):
    return "%s|%s|%s" % (h["l"], h.get("m", ""), h.get("pat", ""))


def chu_giai(raw):
    """Bảng chú thích loại đất → {khoá: tên}. Ô mẫu = polyline kín NHỎ (≤ 2.000 m²) chứa hatch một loại, HOẶC chính hatch một vòng
    (≤ 20.000 m² — bản TMB M7 vẽ ô mẫu bằng hatch, không viền); chữ gần nhất BÊN PHẢI ô trên cùng hàng, bắt đầu "đất" = tên.
    Khoá: "lớp|màu|mẫu tô" (luôn có) và "lớp" (chỉ khi mọi ô mẫu của lớp cùng một tên — NOXH / NOTM chung lớp khác màu thì không).
    Hatch làm ô mẫu được đánh dấu h["_mau"] = True để không bị nhận nhầm là lô."""
    H = raw.get("hatches", [])
    o = []                                                    # (P ô, [hatch trong ô])
    for s in raw["segs"]:
        P = s["p"]
        if not s.get("c") or len(P) < 4 or dien_tich(P) > 2000:
            continue
        hs = [h for h in H for lp in h["loops"][:1] if trong(_tam(lp), P)]
        if hs and len({khoa_hatch(h) for h in hs}) == 1:
            o.append((P, hs))
    for h in H:
        if len(h["loops"]) == 1 and dien_tich(h["loops"][0]) <= 20000:
            o.append((h["loops"][0], [h]))
    theo_khoa, theo_lop = {}, defaultdict(set)
    for P, hs in o:
        xs, ys = [p[0] for p in P], [p[1] for p in P]
        cy, h_o = (min(ys) + max(ys)) / 2, max(ys) - min(ys)
        # chỉ nhận dòng chú thích LOẠI ĐẤT (bắt đầu "đất") — chữ khác cạnh ô (tiêu đề bảng, "mật độ xd"…) là nhầm
        ung = [t for t in raw["texts"] if t["x"] > max(xs) and abs(t["y"] - cy) < 1.5 * h_o and t["x"] - max(xs) < 8 * h_o
               and t["t"].strip().lower().startswith("đất")]
        if not ung:
            continue
        ten = " ".join(min(ung, key=lambda t: (t["x"] - max(xs)) + abs(t["y"] - cy))["t"].split())
        for h in hs:
            h["_mau"] = True
            theo_khoa.setdefault(khoa_hatch(h), ten)
            theo_lop[h["l"]].add(ten)
    out = dict(theo_khoa)
    for l, tens in theo_lop.items():
        if len(tens) == 1:
            out.setdefault(l, next(iter(tens)))
    return out


def ten_dat(h, ten_hatch):
    """Tên loại đất của một hatch: khớp (lớp, màu, mẫu tô) → (lớp, mẫu tô) nếu chỉ một tên → lớp."""
    k = khoa_hatch(h)
    if k in ten_hatch:
        return ten_hatch[k]
    cung = {v for kk, v in ten_hatch.items() if kk.count("|") == 2 and kk.split("|")[0] == h["l"]
            and kk.split("|")[2] == h.get("pat", "")}
    if len(cung) == 1:
        return next(iter(cung))
    return ten_hatch.get(h["l"]) or ten_theo_ten_lop(h["l"])


def ten_theo_ten_lop(l):
    """Bản vẽ không có chú giải "đất …" trong model space: đọc loại đất từ TÊN LỚP hatch (như app, QT-91)."""
    k = re.sub(r"[^a-z0-9à-ỹ]", "", unicodedata.normalize("NFC", l or "").lower())
    if re.search(r"noxh|nhaoxahoi|nhaoxh", k):
        return "Đất nhà ở xã hội"
    if re.search(r"nhaochungcu|nhaocaotang|chungcu", k):
        return "Đất nhà ở chung cư"
    if re.search(r"honhop|hỗnhợp", k):
        return "Đất hỗn hợp"
    return None


def loai_theo_chu_giai(ten):
    """Tên loại đất (chú thích) → (loại, tiền tố tên lô) cho lô xây chung cư; None nếu không phải đất nhà ở cao tầng."""
    s = (ten or "").lower()
    if any(k in s for k in ("thấp tầng", "làng xóm", "hiện có", "biệt thự", "liền kề")):
        return None
    if "xã hội" in s and "nhà ở" in s:
        return "nha_o_xa_hoi", "NOXH"
    if "thương mại" in s and "nhà ở" in s:
        return "chung_cu", "NOTM"
    if "chung cư" in s or "nhà ở cao tầng" in s:
        return "chung_cu", "CT"
    if "hỗn hợp" in s and "địa phương" not in s:
        return "hon_hop", "HH"
    return None


def loai_dat_khac(ten, lop):
    """Đất KHÔNG phải nhà ở cao tầng (giáo dục · văn hoá · dịch vụ · cây xanh · TDTT · nghĩa trang · hạ tầng) → (loại, tiền tố)."""
    t = unicodedata.normalize("NFD", ((ten or "") + " " + (lop or "")).lower().replace("đ", "d"))
    k = re.sub(r"[^a-z0-9]", "", "".join(c for c in t if not unicodedata.combining(c)))
    for kw, kq in (("giaoduc", ("giao_duc", "GD")), ("vanhoa", ("cong_cong", "VH")), ("dichvu", ("thuong_mai_dich_vu", "DV")),
                   ("thuongmai", ("thuong_mai_dich_vu", "TM")), ("theduc", ("cong_cong", "TT")), ("nghiatrang", ("khac", "NT")),
                   ("cayxanh", ("cay_xanh", "CX")), ("hatang", ("ha_tang_ky_thuat", "HT")), ("congcong", ("cong_cong", "CC"))):
        if kw in k:
            return kq
    return None


def vong_ngoai(loops):
    """Các vòng KHÔNG nằm trong vòng khác của cùng hatch (vòng nằm trong = lỗ)."""
    out = []
    for i, L in enumerate(loops):
        if not any(j != i and dien_tich(M) > dien_tich(L) and trong(_tam(L), M) for j, M in enumerate(loops)):
            out.append(L)
    return out


def net_duong(raw):
    """Nét đường giao thông để VẼ NỀN trên TMB: lòng đường · hè đường · tim đường (theo tên lớp) → {long|he|tim: [[[x,y]…]…]}."""
    out = {"long": [], "he": [], "tim": []}
    for sg in raw["segs"]:
        t = unicodedata.normalize("NFD", sg["l"].lower().replace("đ", "d"))
        k = re.sub(r"[^a-z0-9]", "", "".join(c for c in t if not unicodedata.combining(c)))
        loai = "long" if "longduong" in k else "he" if "heduong" in k else "tim" if re.search(LOP_TIM, sg["l"], re.I) else None
        if loai and len(sg["p"]) > 1:
            out[loai].append([[round(x, 2), round(y, 2)] for x, y in sg["p"]])
    return out


def boc(raw, kt, tol_dt=0.03):
    for t in raw["texts"]:
        t["t0"] = t["t"]                                   # bản gốc (chữ Unicode có dấu Latin-1 như "ù" dễ bị tcvn3 giải nhầm)
        t["t"] = tcvn3(t["t"])
    texts = raw["texts"]
    ten_hatch = chu_giai(raw)
    kh = tim_ky_hieu(texts)
    kin = [s for s in raw["segs"] if s.get("c") and len(s["p"]) >= 3]
    hatches = raw.get("hatches", [])
    mat = None
    lots = []
    for k in kh:
        pt = (k["x"], k["y"])
        cb = []
        ung = [(abs(dien_tich(s["p"]) - k["dt_ghi"]) / k["dt_ghi"], s["p"], s["l"]) for s in kin if trong(pt, s["p"])]
        ung = [u for u in ung if u[0] <= tol_dt]
        nguon = None
        if ung:
            lech, ranh, lop = min(ung, key=lambda u: u[0])
            nguon = "polyline kín · lớp " + lop
        else:
            if mat is None:
                mat = polygonize(raw["segs"])
            um = [(abs(dien_tich(P) - k["dt_ghi"]) / k["dt_ghi"], P) for P in mat if trong(pt, P)]
            um = [u for u in um if u[0] <= tol_dt]
            if um:
                lech, ranh = min(um, key=lambda u: u[0])
                ranh = [list(p) for p in ranh]
                nguon = "dựng từ mạng nét (polygonize)"
            else:
                ranh, lech = None, None
                cb.append("không tìm được ranh lô có diện tích khớp số ghi (±%d %%)" % round(tol_dt * 100))
        loai = next((v for p, v in LOAI if k["ten"].upper().startswith(p)), "khac")
        hh = [h for h in hatches for lp in h["loops"][:1] if ranh and trong(_tam(lp), ranh)]
        hat = sorted({h["l"] for h in hh})
        lo = {"ten": k["ten"], "loai": loai, "xay_can_ho": loai in XAY_CAN_HO, "dt_ghi": k["dt_ghi"], "mdxd": k["mdxd"],
              "loai_dat_chu_giai": next((n for h in hh for n in [ten_dat(h, ten_hatch)] if n), None),
              "tang": k["tang"], "nhan": [round(k["x"], 3), round(k["y"], 3)], "hatch": hat, "canh_bao": cb}
        if ranh:
            dt = dien_tich(ranh)
            lo.update({"ranh": [[round(x, 3), round(y, 3)] for x, y in ranh], "dt_do": round(dt, 1),
                       "lech_pct": round((dt - k["dt_ghi"]) / k["dt_ghi"] * 100, 3), "nguon_ranh": nguon})
            if kt:
                lo["ranh_wgs84"] = [[round(v, 8) for v in vn2000_sang_wgs84(x, y, kt)] for x, y in ranh]
        else:
            lo["ranh"] = None
        lots.append(lo)
    # lô THEO HATCH (bản không ghi ký hiệu lô): hatch đất nhà ở cao tầng, không phải ô mẫu chú thích, không nằm trong lô đã có
    dem = defaultdict(int)
    them = []
    # mỗi VÒNG ngoài của hatch = một lô (hatch hai vòng rời = hai lô; vòng nằm trong vòng khác = lỗ, bỏ). Đủ mọi loại đất như CAD.
    for h in hatches:
        if h.get("_mau"):
            continue
        ten = ten_dat(h, ten_hatch) or ""
        lt = loai_theo_chu_giai(ten)
        xay = bool(lt)
        if not lt:
            lt = loai_dat_khac(ten, h["l"])
        if not lt:
            continue
        for ranh in vong_ngoai(h["loops"]):
            dt = dien_tich(ranh)
            c = _tam(ranh)
            if dt < 500 or any(l["ranh"] and trong(c, l["ranh"]) for l in lots)                     or any(abs(u[4] - dt) < 0.5 and math.hypot(_tam(u[3])[0] - c[0], _tam(u[3])[1] - c[1]) < 0.5 for u in them):
                continue
            them.append((h, ten, lt, ranh, dt, xay))
    them.sort(key=lambda u: (-round(_tam(u[3])[1], -1), _tam(u[3])[0]))     # trên xuống, trái sang
    for h, ten, (loai, tien_to), ranh, dt, xay in them:
        dem[tien_to] += 1
        m = re.search(r"(\d+)\s*tầng", ten, re.I)
        c = _tam(ranh)
        lo = {"ten": "%s-%d" % (tien_to, dem[tien_to]), "loai": loai, "xay_can_ho": xay, "dt_ghi": round(dt, 1), "mdxd": None,
              "loai_dat_chu_giai": ten or None, "tang": float(m.group(1)) if m else None, "nhan": [round(c[0], 3), round(c[1], 3)],
              "hatch": [h["l"]], "canh_bao": ["không có ký hiệu lô trên bản vẽ: tên tự đặt, DT = DT đo của hatch, "
                                              "MĐXD chưa có (app dùng Bảng 2.9)"],
              "ranh": [[round(x, 3), round(y, 3)] for x, y in ranh], "dt_do": round(dt, 1), "lech_pct": 0.0,
              "nguon_ranh": "hatch lớp %s (màu %s) — bản vẽ không ghi ký hiệu lô" % (h["l"], h.get("m", "?"))}
        if kt:
            lo["ranh_wgs84"] = [[round(v, 8) for v in vn2000_sang_wgs84(x, y, kt)] for x, y in ranh]
        lots.append(lo)
    # cạnh giáp đường (cần lớp tim đường — mặc định mọi lớp có chữ "tim" trong tên, vd "Tim QH")
    tim = [s["p"] for s in raw["segs"] if re.search(LOP_TIM, s["l"], re.I)]
    co = [l for l in lots if l["ranh"]]
    # "lô bên kia đường" = lô khác + mọi ô đất tô hatch (cây xanh, công cộng… — bản TMB không ghi ký hiệu cho các ô này)
    o_hatch = [max(h["loops"], key=dien_tich) for h in hatches if not h.get("_mau")]
    for l in co:
        phu = [R for R in o_hatch if not trong(_tam(R), l["ranh"])]
        l["canh"] = canh_giap_duong(l["ranh"], [k["ranh"] for k in co if k is not l], tim, ranh_phu=phu) if tim else None
        if not tim:
            l["canh_bao"].append("không thấy lớp tim đường — app áp khoảng lùi cho mọi cạnh")
    # chỉ giới xây dựng (QT-118b)
    cg = [s["p"] for s in raw["segs"] if re.search(LOP_CGXD, s["l"], re.I)]
    for l in lots:
        hh = next((k["h"] for k in kh if k["ten"] == l["ten"]), 2.5)
        hinh = None
        if l.get("ranh") and l.get("canh") and cg:
            ranh = l["ranh"]
            trong_lo = [p for p in cg if any(trong(q, ranh) for q in p)]
            if trong_lo:
                ds = lui_cgxd_canh(ranh, l["canh"], trong_lo)
                l["lui_qh_canh"] = ds
                co_do = sorted(d for d in ds if d is not None)
                if co_do:
                    n = len(co_do)
                    hinh = round(co_do[n // 2] if n % 2 else (co_do[n // 2 - 1] + co_do[n // 2]) / 2, 1)
                else:
                    l["canh_bao"].append("có nét CGXD trong lô nhưng không đo được khoảng lùi (không có nét song song cạnh giáp đường)")
        chu = lui_chu(texts, l.get("ranh"), l["nhan"], hh)
        if hinh is not None and chu is not None and abs(hinh - chu) > 1.0:
            l["canh_bao"].append("khoảng lùi đo hình học %.1f m lệch chữ ghi %.1f m (> 1 m) — lấy số đo hình học" % (hinh, chu))
        v = hinh if hinh is not None else chu
        if v is not None:
            l["lui_qh"] = v
            l["lui_qh_nguon"] = "hình học (lớp CGXD)" if hinh is not None else "chữ ghi trên bản vẽ"
        elif not cg:
            l["canh_bao"].append("không thấy lớp CGXD / chữ khoảng lùi — app dùng QCVN 01:2021 Bảng 2.7 (--lop-cgxd để chỉ lớp)")
    return lots


def ghi_kmz(lots, duong, ten_tep):
    def mo_ta(l):
        return "Loại: %s · DT %s m² · MĐXD %s %% · tầng %s" % (l["loai"], l["dt_ghi"], l["mdxd"] if l["mdxd"] is not None else "-",
                                                            l["tang"] if l["tang"] is not None else "-")
    pm = []
    for l in lots:
        if not l.get("ranh_wgs84"):
            continue
        toa = " ".join("%.8f,%.8f,0" % (lon, lat) for lat, lon in l["ranh_wgs84"] + [l["ranh_wgs84"][0]])
        mau = "7f1fa0ff" if l["xay_can_ho"] else "4dffffff"
        pm.append("<Placemark><name>%s</name><description>%s</description><Style><LineStyle><color>ff0000ff</color>"
                  "<width>2</width></LineStyle><PolyStyle><color>%s</color></PolyStyle></Style><Polygon><outerBoundaryIs>"
                  "<LinearRing><coordinates>%s</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>"
                  % (l["ten"], mo_ta(l), mau, toa))
    kml = ('<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>%s</name>%s'
           "</Document></kml>" % (ten_tep, "".join(pm)))
    with zipfile.ZipFile(duong, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("doc.kml", kml)
    return len(pm)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    arg = lambda ten, mac=None: sys.argv[sys.argv.index(ten) + 1] if ten in sys.argv else mac
    raw = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if raw.get("err"):
        print("Bước 1 báo lỗi:", raw["err"][-400:])
    kt = float(arg("--kt")) if arg("--kt") else None
    global LOP_TIM
    LOP_TIM = arg("--lop-tim", LOP_TIM)
    global LOP_CGXD
    LOP_CGXD = arg("--lop-cgxd", LOP_CGXD)
    lots = boc(raw, kt)
    oqh = [a for a in raw.get("attrs", []) if {"A", "DTDVO"} <= set(a["a"])]
    if oqh:
        print(f"Ô quy hoạch phân khu (block thuộc tính — chỉ tiêu cả ô, không phải lô xây dựng): {len(oqh)} · "
              + ", ".join(f"{a['a']['A']} {a['a']['DTDVO']} ha tầng {a['a'].get('TC', '-')}" for a in oqh[:8]))
    co = [l for l in lots if l["ranh"]]
    print(f"{len(lots)} lô ({sum(1 for l in lots if str(l.get('nguon_ranh', '')).startswith('hatch'))} lô theo hatch) · {len(co)} có ranh · {len(lots) - len(co)} THIẾU ranh · "
          f"{sum(l['xay_can_ho'] for l in lots)} lô đặt được chung cư · toạ độ WGS84: {'có (KTT %s°)' % kt if kt else 'KHÔNG (thiếu --kt)'}")
    for l in lots:
        print(f"  {l['ten']:<6} {l['loai']:<18} DT {l['dt_ghi']:>10,.1f}  MĐXD {str(l['mdxd']):>5}  tầng {str(l['tang']):>4}  "
              + (f"ranh {len(l['ranh'])} đỉnh · đo {l['dt_do']:,.1f} (lệch {l['lech_pct']:+.3f} %) · {l['nguon_ranh']}"
                 + (" · giáp đường: " + ", ".join(f"c{c['i']} {c['rong']} m" for c in l["canh"] if c["duong"]) if l.get("canh") else "") if l["ranh"]
                 else "⚠ " + "; ".join(l["canh_bao"])))
    ra = {"app": "MDI UnitMix · TMB QH", "ban": 1, "nguon": raw.get("meta", {}), "he_toa_do": "VN2000",
          "kinh_tuyen_truc": kt, "lots": lots,
          "duong_ve": net_duong(raw), "o_quy_hoach": [{"ten": a["a"]["A"], "x": a["x"], "y": a["y"], "chi_tieu": a["a"]} for a in oqh]}
    if arg("--json"):
        Path(arg("--json")).write_text(json.dumps(ra, ensure_ascii=False, indent=1), encoding="utf-8")
        print("→", arg("--json"))
    if arg("--kmz"):
        if not kt:
            print("Bỏ KMZ: cần --kt (kinh tuyến trục) để đổi sang WGS84")
        else:
            n = ghi_kmz(lots, arg("--kmz"), Path(raw.get("meta", {}).get("file", "TMB QH")).stem)
            print(f"→ {arg('--kmz')} ({n} lô)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
