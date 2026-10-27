"""Bóc PHÒNG của từng mẫu căn từ DWG/DXF trong `cad/xref/x-canho-bt/` → trường `phong` trong `web/public/lib/can.json`.

Cách làm (không cần shapely — chỉ ezdxf + numpy + OpenCV):
  1. DWG → DXF bằng `accoreconsole.exe` của AutoCAD (chạy nền, không đụng phiên AutoCAD đang mở); DXF lưu ở
     thư mục đệm (mặc định `%TEMP%/unitmix_dxf_can`, đổi bằng `--dxf`). Đã có DXF thì không đổi lại.
  2. Raster hoá căn ở 5 mm/px: VẬT CHẮN = nét tường (A-WALL*, A-CONC*, A-GLAZ*), lan can (A-RAIL*) và hình cửa
     (A-DOOR*: cánh, khung; cung mở cánh được thay bằng hai bán kính nên ô cửa bị đóng ở vị trí cánh đóng). Ngoài đường bao tim tường (A-AREA-WALL-CENTER) là ngoài căn.
  3. Mỗi miền trống liên thông (4-liên thông) có DT ≥ 1 m² và Ø nội tiếp ≥ 0,5 m là một PHÒNG. Mảnh nhỏ (góc
     quét cánh cửa, ô cửa xuyên tường) được trả về phòng kề bằng loang có giới hạn qua chỗ không phải tường;
     hộp kỹ thuật kín tường thì bị bỏ.
  4. Ranh = đường bao ngoài của miền, giản lược 10 mm, đổi sang hệ mm của mẫu căn trên web:
     X = u × rong_mm, Y = v × sau_mm, với (u, v) là toạ độ chuẩn hoá của `web/public/lib/can/<id>.json` (y = 0 phía
     hành lang). Phép đổi khớp theo khung bao đường tim tường của CAD với nét `tim` của hình học web.
  5. DT = số px × 25 mm²; `d_min_m` = 2 × khoảng cách lớn nhất tới vật chắn (biến đổi khoảng cách Euclid).

LOẠI PHÒNG — CAD mẫu căn KHÔNG có chữ tên phòng (đã quét mọi TEXT/MTEXT/ATTRIB của 34 bản vẽ: chỉ có số kích thước,
nhãn DT căn), nên loại phòng SUY từ tên block thiết bị/nội thất nằm trong phòng và mọi phòng mang `doan: true`:
  · có thiết bị vệ sinh (E-VS-*)                                → wc   "WC n"
  · có giường (GIUONG / P.NGU) và không có bếp, sofa            → ngu  "Phòng ngủ n" (n theo DT giảm dần)
  · có giường + bếp/sofa, căn không có phòng ngủ riêng (studio)  → khach "Phòng ở chung"
    (căn có phòng ngủ riêng thì giường phụ trong phòng khách bị bỏ qua)
  · có bếp (E-BEP-*, F-BEP-*, TULANH) và sofa/bàn ăn/bàn TV      → khach "Khách + bếp"
  · chỉ sofa/bàn ăn/bàn TV                                      → khach "Phòng khách"
  · chỉ bếp                                                     → bep  "Bếp"
  · giáp lan can (A-RAIL) hoặc có máy giặt                       → khac "Lô gia"
  · còn lại                                                     → khac "Sảnh / hành lang"
GIÁP MẶT NGOÀI (`ke_mat_ngoai`): phòng nằm trong 400 mm quanh kính / cửa sổ / lan can / louver / cửa đi trượt
(layer A-GLAZ*, A-RAIL* hoặc block CUASO, CUADITRUOT, LOUVER, LANCAN) — tức có ánh sáng trực tiếp hoặc qua lô gia.

    python scripts/boc_cad/boc_phong.py            # in bảng kiểm, không ghi
    python scripts/boc_cad/boc_phong.py --ghi      # ghi trường `phong` vào web/public/lib/can.json
    python scripts/boc_cad/boc_phong.py --anh DIR  # thêm ảnh PNG kiểm tra từng căn
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import ezdxf
import numpy as np
from ezdxf import path as ezpath

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from chep_thu_vien import ghi_can  # noqa: E402  (định dạng can.json dùng chung với bước chép thư viện)

GOC = Path(__file__).resolve().parents[2]
LIB = GOC / "web" / "public" / "lib"
DWG_DIR = GOC / "cad" / "xref" / "x-canho-bt"
ACCORE = Path(r"C:\Program Files\Autodesk\AutoCAD 2027\accoreconsole.exe")

RES = 5.0  # mm / px
CHAN = ("a-wall", "a-conc", "a-glaz", "a-rail", "a-door")
MAT_NGOAI_LAYER = ("a-glaz", "a-rail")
MAT_NGOAI_BLOCK = ("CUASO", "CUADITRUOT", "LOUVER", "LANCAN")
DT_MIN_M2, D_MIN_PHONG_M = 1.0, 0.5
LOANG_MAX_PX = int(1200 / RES)

LOAI_BLOCK = [  # (loại thiết bị, mẫu tên block)
    ("wc", re.compile(r"E-VS-|BONCAU|BONTAM|LAVABO|VOISEN", re.I)),
    ("giuong", re.compile(r"GIUONG|P\.NGU", re.I)),
    ("bep", re.compile(r"E-BEP-|F-BEP-|TULANH|BEP-0", re.I)),
    ("khach", re.compile(r"SOFA|BANAN|BAN-AN|BANTV", re.I)),
    ("giat", re.compile(r"MAYGIAT", re.I)),
]


# ---------- DXF ----------
def ten_layer(l: str) -> str:
    return l.rsplit("$0$", 1)[-1].strip() if "$0$" in l else l


def doi_dxf(dwg: Path, dxf_dir: Path) -> Path | None:
    out = dxf_dir / (dwg.stem + ".dxf")
    if out.exists():
        return out
    if not ACCORE.exists():
        return None
    dxf_dir.mkdir(parents=True, exist_ok=True)
    scr = dxf_dir / "_doi.scr"
    scr.write_text(f'FILEDIA\n0\n_.DXFOUT\n"{out}"\n16\n', encoding="ascii")
    subprocess.run([str(ACCORE), "/i", str(dwg), "/s", str(scr), "/l", "en-US"], capture_output=True, timeout=300)
    return out if out.exists() else None


def diem(e):
    try:
        pts = list(ezpath.make_path(e).flattening(distance=10, segments=16))
        return [(float(q.x), float(q.y)) for q in pts]
    except Exception:
        return []


def doc_dxf(f: Path):
    """→ (nét chắn, nét chắn cứng (không gồm cửa), nét mặt ngoài, nét rail, block [(tên, tâm)], đường tim tường, đường bao thông thủy)."""
    doc = ezdxf.readfile(f)
    tat = set()
    for l in doc.layers:
        try:
            if l.is_off() or l.is_frozen():
                tat.add(l.dxf.name)
        except Exception:
            pass
    chan, cung, ngoai, rail, blocks, tim, space = [], [], [], [], [], [], []

    def ten_that(name):
        """Block động chèn dưới tên vô danh `*Uxx` — tên gốc nằm ở XDATA AcDbBlockRepBTag của block record."""
        if not name.startswith("*"):
            return name
        try:
            t = doc.blocks.get(name).block_record.xdata.get("AcDbBlockRepBTag")
            return doc.entitydb[next(v for c, v in t if c == 1005)].dxf.name
        except Exception:
            return name

    def walk(e, inh, ten_blocks):
        layer = e.dxf.get("layer", "0")
        if layer == "0":
            layer = inh
        if e.dxf.get("invisible", 0) or layer in tat:
            return []
        t = e.dxftype()
        if t in ("INSERT", "MLINE"):
            ten = ten_blocks
            if t == "INSERT":
                ten = ten_blocks + (ten_that(e.dxf.name),)
            gom = []
            try:
                con = list(e.virtual_entities())
            except Exception:
                con = []
            for c in con:
                gom += walk(c, layer, ten)
            if t == "INSERT" and gom:
                xs = [p[0] for p in gom]
                ys = [p[1] for p in gom]
                blocks.append((ten[-1], ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2)))
            return gom
        if t not in ("LINE", "LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE", "ELLIPSE", "SPLINE"):
            return []
        pts = diem(e)
        if len(pts) < 2:
            return []
        lt = ten_layer(layer).lower()
        if t == "ARC" and lt.startswith("a-door"):
            # cung mở cánh: KHÔNG làm vật chắn (để góc quét cánh thuộc phòng cánh mở vào); thay bằng hai bán kính —
            # một trùng cánh đang mở (đoạn cụt, vô hại), một trùng vị trí cánh đóng = vạch đóng ô cửa
            c = tam_duong_tron(pts[0], pts[len(pts) // 2], pts[-1])  # tâm OCS sai khi block lật gương → tính từ điểm
            if c is None:
                chan.append(pts)
                return pts
            for q in (pts[0], pts[-1]):
                chan.append([c, q])
            return pts
        if lt.startswith("a-area-wall-center") and len(pts) >= 4:
            tim.append(pts)
        if lt.startswith("a-area-space") and len(pts) >= 4:
            space.append(pts)
        if lt.startswith(CHAN):
            chan.append(pts)
            if not lt.startswith("a-door"):
                cung.append(pts)
        if lt.startswith(MAT_NGOAI_LAYER) or any(k in n.upper() for n in ten_blocks for k in MAT_NGOAI_BLOCK):
            ngoai.append(pts)
        if lt.startswith("a-rail"):
            rail.append(pts)
        return pts

    for e in doc.modelspace():
        walk(e, "0", ())
    return chan, cung, ngoai, rail, blocks, tim, space


def tam_duong_tron(a, b, c):
    """Tâm đường tròn qua ba điểm (None nếu thẳng hàng)."""
    ax, ay = a
    bx, by = b
    cx, cy = c
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-9:
        return None
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    return (ux, uy)


def dt_dg(P) -> float:
    a = 0.0
    for i in range(len(P)):
        x0, y0 = P[i]
        x1, y1 = P[(i + 1) % len(P)]
        a += x0 * y1 - x1 * y0
    return abs(a) / 2


def _noi(P, d):
    """Nới đa giác (gần) trực giao ra ngoài d mm bằng raster — đủ cho ranh căn dùng làm mặt nạ."""
    a0, b0, a1, b1 = bbox(P)
    m = np.zeros((int((b1 - b0 + 4 * d) / 10) + 2, int((a1 - a0 + 4 * d) / 10) + 2), np.uint8)
    q = np.array([[round((x - a0 + 2 * d) / 10), round((y - b0 + 2 * d) / 10)] for x, y in P], np.int32)
    cv2.fillPoly(m, [q], 1)
    m = cv2.dilate(m, np.ones((2 * d // 10 + 1,) * 2, np.uint8))
    c = max(cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0], key=cv2.contourArea)[:, 0, :]
    return [(x * 10 + a0 - 2 * d, y * 10 + b0 - 2 * d) for x, y in c.tolist()]


def bbox(P):
    xs = [p[0] for p in P]
    ys = [p[1] for p in P]
    return min(xs), min(ys), max(xs), max(ys)


# ---------- raster ----------
def boc_mot(dxf: Path, can: dict, ve: list, anh: Path | None = None):
    chan, cung_ds, ngoai, rail, blocks, tims, spaces = doc_dxf(dxf)
    W, S = float(can["rong_mm"]), float(can["sau_mm"])
    tim_web = max((n["pts"] for n in ve if n["cat"] == "tim"), key=lambda P: dt_dg(P), default=None)
    tuong_web = [q for n in ve if n["cat"] == "wall" for q in n["pts"]]
    if tims and tim_web:
        # phép đổi CAD → hệ mm web: khớp khung bao đường tim tường
        tim = max(tims, key=dt_dg)
        a0, b0, a1, b1 = bbox(tim)
        u0, v0, u1, v1 = bbox(tim_web)
    elif spaces and tuong_web:
        # bản vẽ thiếu đường tim (2PN Y2, XH 2PN Y1): ranh căn = đường bao thông thủy A-AREA-SPACE nới 60 mm,
        # khớp theo khung bao nét tường
        tim = max(spaces, key=dt_dg)
        tim = cv2.approxPolyDP(np.array(tim, np.float32), 1, True)[:, 0, :].tolist()
        tim = _noi(tim, 60)
        a0, b0, a1, b1 = bbox([q for P in cung_ds for q in P])
        u0, v0, u1, v1 = bbox(tuong_web)
    else:
        return None, "không có đường tim tường (A-AREA-WALL-CENTER) lẫn đường bao thông thủy (A-AREA-SPACE)", None
    sx, sy = (u1 - u0) * W / (a1 - a0), (v1 - v0) * S / (b1 - b0)
    doi = lambda x, y: (u0 * W + (x - a0) * sx, v0 * S + (y - b0) * sy)  # noqa: E731
    # kiểm phép đổi: trung vị khoảng cách đỉnh tường CAD (đã đổi) tới đỉnh tường web gần nhất, mm
    sai = None
    if tuong_web:
        A = np.array([doi(x, y) for P in cung_ds for x, y in P])
        B = np.array([[x * W, y * S] for x, y in tuong_web])
        if len(A) and len(B):
            sai = float(np.median(np.sqrt(((A[:, None, :] - B[None, ::max(1, len(B) // 1500), :]) ** 2).sum(-1)).min(1)))

    pad = 40
    x0, y0 = a0 - 200, b0 - 200
    w = int((a1 - a0 + 400) / RES) + 2 * pad
    h = int((b1 - b0 + 400) / RES) + 2 * pad
    px = lambda P: np.array([[round((x - x0) / RES + pad), round((y - y0) / RES + pad)] for x, y in P], np.int32)  # noqa: E731

    trong_can = np.zeros((h, w), np.uint8)
    cv2.fillPoly(trong_can, [px(tim)], 1)
    vc_tuong = np.zeros((h, w), np.uint8)
    for P in chan:
        cv2.polylines(vc_tuong, [px(P)], False, 1, 2)
    tu_do = (trong_can > 0) & (vc_tuong == 0)
    n, nhan = cv2.connectedComponents(tu_do.astype(np.uint8), connectivity=4)

    # phòng lớn / mảnh nhỏ
    giu = np.zeros(n, bool)
    for k in range(1, n):
        m = (nhan == k).astype(np.uint8)
        dt = m.sum() * RES * RES / 1e6
        if dt < DT_MIN_M2:
            continue
        d = cv2.distanceTransform(np.pad(m, 1), cv2.DIST_L2, cv2.DIST_MASK_PRECISE).max() * 2 * RES / 1000
        giu[k] = d >= D_MIN_PHONG_M
    lab = np.where(giu[nhan], nhan, 0).astype(np.uint16)
    # loang mảnh nhỏ về phòng kề: chỉ qua chỗ trong căn và không phải nét tường/kính/lan can (được qua nét cửa)
    cung = np.zeros((h, w), np.uint8)
    for P in cung_ds:
        cv2.polylines(cung, [px(P)], False, 1, 2)
    duoc_loang = (trong_can > 0) & (cung == 0)
    ker = np.ones((3, 3), np.uint8)
    for _ in range(LOANG_MAX_PX):
        trong = (lab == 0) & duoc_loang
        if not trong.any():
            break
        lan = cv2.dilate(lab, ker)
        moi = trong & (lan > 0)
        if not moi.any():
            break
        lab[moi] = lan[moi]
    # nét vẽ dày 2 px nằm đè mép phòng: mỗi phòng nhận lại 1 px nét phía mình (bù ~5 mm mỗi cạnh)
    lan = cv2.dilate(lab, ker)
    moi = (lab == 0) & (trong_can > 0) & (lan > 0)
    lab[moi] = lan[moi]

    # thiết bị trong phòng
    def phong_tai(p):
        c = (int((p[0] - x0) / RES + pad), int((p[1] - y0) / RES + pad))
        for r in (0, 20, 40, 60):
            ys, xs = slice(max(0, c[1] - r), c[1] + r + 1), slice(max(0, c[0] - r), c[0] + r + 1)
            vals = lab[ys, xs]
            vals = vals[vals > 0]
            if vals.size:
                return int(np.bincount(vals).argmax())
        return 0

    tb = {}
    for ten, tam in blocks:
        for loai, re_ in LOAI_BLOCK:
            if re_.search(ten):
                k = phong_tai(tam)
                if k:
                    tb.setdefault(k, set()).add(loai)
                break

    mat_ngoai = np.zeros((h, w), np.uint8)
    for P in ngoai:
        cv2.polylines(mat_ngoai, [px(P)], False, 1, 2)
    mat_ngoai = cv2.dilate(mat_ngoai, np.ones((int(800 / RES) + 1,) * 2, np.uint8))
    m_rail = np.zeros((h, w), np.uint8)
    for P in rail:
        cv2.polylines(m_rail, [px(P)], False, 1, 2)
    m_rail = cv2.dilate(m_rail, np.ones((int(600 / RES) + 1,) * 2, np.uint8))

    phong = []
    for k in np.unique(lab):
        if k == 0:
            continue
        m = (lab == k).astype(np.uint8)
        dt = float(m.sum()) * RES * RES / 1e6
        dist = cv2.distanceTransform(np.pad(m, 1), cv2.DIST_L2, cv2.DIST_MASK_PRECISE)
        d = float(dist.max()) * 2 * RES / 1000
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        c = max(cs, key=cv2.contourArea)
        c = cv2.approxPolyDP(c, 2.0, True)[:, 0, :]
        ranh = []
        for qx, qy in c:
            X, Y = doi((qx - pad) * RES + x0, (qy - pad) * RES + y0)
            ranh.append([int(round(X)), int(round(Y))])
        loai_tb = tb.get(int(k), set())
        phong.append({
            "_k": int(k), "_tb": loai_tb, "dt_m2": round(dt, 2), "d_min_m": round(d, 2),
            "ke_mat_ngoai": bool((m & mat_ngoai).any()), "_rail": bool((m & m_rail).any()), "ranh": ranh,
        })
    dat_ten(phong)
    if anh is not None:
        ve_anh(anh / f"{can['id']}.png", lab, vc_tuong, phong, trong_can)
    return [{k: v for k, v in p.items() if not k.startswith("_")} for p in phong], None, sai


def phan_loai(tb: set, rail: bool, co_pn_rieng: bool):
    if "wc" in tb:
        return "wc", "WC"
    if "giuong" in tb:
        if "bep" not in tb and "khach" not in tb:
            return "ngu", "Phòng ngủ"
        if not co_pn_rieng:  # studio: giường chung không gian khách + bếp
            return "khach", "Phòng ở chung"
        # căn đã có phòng ngủ riêng: giường ở đây là giường phụ / sofa giường → bỏ qua
    if "bep" in tb and "khach" in tb:
        return "khach", "Khách + bếp"
    if "khach" in tb:
        return "khach", "Phòng khách"
    if "bep" in tb:
        return "bep", "Bếp"
    if rail or "giat" in tb:
        return "khac", "Lô gia"
    return "khac", "Sảnh / hành lang"


def dat_ten(phong):
    co_pn = any("giuong" in p["_tb"] and not p["_tb"] & {"bep", "khach", "wc"} for p in phong)
    for p in phong:
        p["loai"], p["ten"] = phan_loai(p["_tb"], p["_rail"], co_pn)
        p["doan"] = True
    phong.sort(key=lambda p: (["khach", "bep", "ngu", "wc", "khac"].index(p["loai"]), -p["dt_m2"]))
    dem = {}
    for p in phong:
        dem[p["ten"]] = dem.get(p["ten"], 0) + 1
    so = {}
    for p in phong:
        if dem[p["ten"]] > 1 and p["loai"] in ("ngu", "wc", "khac"):
            so[p["ten"]] = so.get(p["ten"], 0) + 1
            p["ten"] = f"{p['ten']} {so[p['ten']]}"
    for p in phong:  # thứ tự khoá ổn định trong JSON
        r = p.pop("ranh")
        for key in ("dt_m2", "d_min_m", "ke_mat_ngoai"):
            p[key] = p.pop(key)
        p["ranh"] = r


def ve_anh(f: Path, lab, tuong, phong, trong_can):
    f.parent.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(1)
    mau = rng.integers(80, 255, (int(lab.max()) + 1, 3), dtype=np.uint8)
    mau[0] = 255
    img = mau[lab]
    img[trong_can == 0] = (230, 230, 230)
    img[tuong > 0] = (0, 0, 0)
    img = np.ascontiguousarray(img[::-1])
    for p in phong:
        ys, xs = np.nonzero(lab == p["_k"])
        if not len(xs):
            continue
        cx, cy = int(xs.mean()), lab.shape[0] - 1 - int(ys.mean())
        cv2.putText(img, f"{p['loai']} {p['dt_m2']:.1f} d{p['d_min_m']:.2f}{' N' if p['ke_mat_ngoai'] else ''}",
                    (cx - 120, cy), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 200), 2)
    cv2.imwrite(str(f), img)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dxf", type=Path, default=Path(tempfile.gettempdir()) / "unitmix_dxf_can")
    ap.add_argument("--anh", type=Path)
    ap.add_argument("--ghi", action="store_true")
    ap.add_argument("chi", nargs="*")
    a = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    ds = json.loads((LIB / "can.json").read_text(encoding="utf-8"))
    thieu = []
    print(f"{'mẫu căn':12s} {'số':>3s} {'ΣDT':>7s} {'DT TT':>7s} {'lệch':>6s} {'khớp':>5s}  phòng   (khớp = trung vị lệch nét tường CAD↔web, mm)")
    for c in ds:
        if a.chi and c["id"] not in a.chi:
            continue
        dwg = DWG_DIR / (c["ma_goc"] + ".dwg")
        dxf = doi_dxf(dwg, a.dxf) if dwg.exists() else None
        if not dxf:
            thieu.append((c["id"], "không đổi được DWG → DXF" if dwg.exists() else "thiếu DWG"))
            continue
        ve = json.loads((LIB / "can" / f"{c['id']}.json").read_text(encoding="utf-8"))["ve"]
        ph, loi, sai = boc_mot(dxf, c, ve, a.anh)
        if loi:
            thieu.append((c["id"], loi))
            continue
        c["phong"] = ph
        tong = sum(p["dt_m2"] for p in ph)
        lech = tong - c["dt_tt_m2"]
        canh = "  <-- lệch > 5%" if abs(lech) > 0.05 * c["dt_tt_m2"] else ""
        print(f"{c['id']:12s} {len(ph):3d} {tong:7.2f} {c['dt_tt_m2']:7.2f} {lech:+6.2f} {sai or -1:5.0f}  "
              + ", ".join(f"{p['ten']} {p['dt_m2']:.1f}" for p in ph) + canh)
    if thieu:
        print("\nTHIẾU:", *(f"{i}: {l}" for i, l in thieu), sep="\n  ")
    if a.ghi:
        ghi_can(ds, LIB / "can.json")
        print(f"\nđã ghi {LIB / 'can.json'}")


if __name__ == "__main__":
    main()
