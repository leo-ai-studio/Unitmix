"""Bóc lại hình học 12 mẫu căn từ DXF — sửa hai lỗi phân loại layer của bản v1.

Lỗi 1: `phan_loai()` khớp TÊN LAYER CHÍNH XÁC nên mọi layer con bị loại sạch
        (`A-WALL-INT`, `A-EQPM-2`, …). Nay khớp theo TIỀN TỐ.
Lỗi 2: layer `A-HIDD` (nét đứt / hidden) không có trong bảng nên bị bỏ —
        đây là một phần nét tường và nội thất bị mất trên mặt bằng.

Giữ nguyên mọi quy ước còn lại của v1 (đọc docs/HUONG-DAN_boc-CAD-sang-web.md):
  · entity cờ `invisible` thì bỏ cả cây con
  · MLINE phải nổ ra LINE
  · layer tắt / đóng băng thì không vẽ
  · entity trên layer `0` bên trong block thì kế thừa layer của block
  · chuẩn hoá x theo MODULE, y theo MÉP TƯỜNG  ->  [0,1]

Xuất: data/master/unit_geometry.json   (ghi đè sau khi đã so số lượng nét)
"""
import collections
import json
import pathlib
import sys

import ezdxf
from ezdxf import path as ezpath

ROOT = pathlib.Path(__file__).resolve().parents[2]
UNITS = ROOT / "data" / "master" / "units.json"
OUT = ROOT / "data" / "master" / "unit_geometry.json"


def tim_dxf(ten_thu_muc):
    """Tìm thư mục DXF nguồn — KHÔNG trỏ cứng ổ đĩa.

    Đã cắn: đường dẫn ghi cứng `E:/…` trong khi dự án nằm ở `D:` → script chết
    ngay dòng đầu và không ai biết việc bóc lại đã không chạy. Thứ tự tìm:
      1. tham số dòng lệnh (nếu có)
      2. ngay trong chính v4 — `data/master/<ten_thu_muc>`, để v4 tự đứng một mình
      3. dự án v1 trên bất kỳ ổ nào
    """
    ung = []
    for a in sys.argv[1:]:
        if not a.startswith("--"):
            ung.append(pathlib.Path(a))
    ung.append(ROOT / "data" / "master" / ten_thu_muc)
    # PHẢI có dấu "/" sau tên ổ: Path("D:") là đường dẫn TƯƠNG ĐỐI THEO Ổ
    # (ra "D:OneDrive\…"), không phải gốc ổ đĩa.
    for o in ("D:/", "E:/", "C:/", "F:/"):
        ung.append(pathlib.Path(o) / "OneDrive/_SETUP/AI_Tool/MDI_Unitmix/data/master" / ten_thu_muc)
    for p in ung:
        if p.is_dir() and any(p.glob("*.dxf")):
            print(f"nguồn DXF: {p}")
            return p
    sys.exit(
        f"KHÔNG tìm thấy thư mục DXF `{ten_thu_muc}`. Đã tìm:\n  "
        + "\n  ".join(str(x) for x in ung)
        + "\nChép DXF vào `data/master/{0}` hoặc truyền đường dẫn: "
          "python scripts/{1} <thu_muc_dxf>".format(ten_thu_muc, "boc_lai_*.py")
    )


DXF_DIR = tim_dxf("unit_dxf")

# Khớp theo TIỀN TỐ, xếp dài trước ngắn để `A-AREA-SPACE` không bị `A-AREA` cướp.
CATEGORY = [
    ("a-area-space", "space"),
    ("a-area-wall-center", "tim"),   # đường bao TIM TƯỜNG — ranh để tô màu căn
    ("a-thietbivs", "equip"),
    ("a-thietbi-nt", "furn"),
    ("a-wall", "wall"),
    ("a-conc", "wall"),
    ("a-glaz", "wall"),
    ("a-door", "door"),
    ("a-rail", "rail"),
    ("a-eqpm", "equip"),
    ("a-furn", "furn"),
    ("a-hidd", "hidd"),      # MỚI — nét đứt (hidden), trước đây bị bỏ
    ("a-fine", "detail"),
    ("a-fnsh", "detail"),
]
SUPPORTED = {"LINE", "LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE", "ELLIPSE", "SPLINE"}
NO_RA = {"MLINE"}
LE_MM = 400.0


def ten_layer(l):
    return l.rsplit("$0$", 1)[-1].strip() if "$0$" in l else l


def phan_loai(l):
    t = ten_layer(l).lower()
    for pre, cat in CATEGORY:
        if t.startswith(pre):
            return cat
    return None


def diem(e):
    try:
        p = ezpath.make_path(e)
        pts = list(p.flattening(distance=80, segments=8))
        if len(pts) > 240:
            step = max(1, len(pts) // 200)
            pts = pts[::step] + [pts[-1]]
        return [(float(q.x), float(q.y)) for q in pts]
    except Exception:
        return []


def an(e):
    return bool(getattr(e.dxf, "invisible", 0))


def walk(e, inherited="0", tat=frozenset()):
    layer = getattr(e.dxf, "layer", "0")
    if layer == "0":
        layer = inherited
    if an(e) or layer in tat:
        return
    t = e.dxftype()
    if t == "INSERT" or t in NO_RA:
        try:
            for c in e.virtual_entities():
                yield from walk(c, layer, tat)
        except Exception:
            return
    elif t in SUPPORTED and phan_loai(layer):
        yield layer, e


def layer_tat(doc):
    ra = set()
    for l in doc.layers:
        try:
            if l.is_off() or l.is_frozen():
                ra.add(l.dxf.name)
        except Exception:
            continue
    return frozenset(ra)


def trong(p, x0, x1, y0, y1):
    return x0 - LE_MM <= p[0] <= x1 + LE_MM and y0 - LE_MM <= p[1] <= y1 + LE_MM


def giua(raw):
    xs = [p[0] for p in raw]
    ys = [p[1] for p in raw]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def boc(unit):
    f = DXF_DIR / (pathlib.Path(unit["file_dwg"]).stem + ".dxf")
    if not f.exists():
        return None, f"thiếu {f.name}"
    doc = ezdxf.readfile(f)
    tat = layer_tat(doc)
    tho = []
    for e in doc.modelspace():
        for layer, ent in walk(e, "0", tat):
            pts = diem(ent)
            if len(pts) >= 2:
                tho.append((layer, pts))
    if not tho:
        return None, "không có nét"

    front = float(unit["dai_mm"])
    # y chuẩn hoá theo MÉP TƯỜNG (bẫy 2.7), x theo MODULE
    yw = [y for layer, raw in tho if phan_loai(layer) == "wall" for _, y in raw]
    if yw:
        y0, y1 = min(yw), max(yw)
    else:
        y0, y1 = 0.0, float(unit["rong_mm"])
    if y1 - y0 < 1000:
        y0, y1 = 0.0, float(unit["rong_mm"])

    out, seen = [], set()
    for layer, raw in tho:
        # đường NGẮN xét điểm giữa (bẫy 2.5), đường dài xét tỷ lệ điểm
        if len(raw) <= 4:
            if not trong(giua(raw), 0, front, y0, y1):
                continue
        else:
            n = sum(1 for p in raw if trong(p, 0, front, y0, y1))
            if n < len(raw) * 0.65:
                continue
        pts = [[round(p[0] / front, 4), round((p[1] - y0) / (y1 - y0), 4)] for p in raw]
        key = (phan_loai(layer), tuple(map(tuple, pts)))
        if key in seen:
            continue
        seen.add(key)
        out.append({"cat": phan_loai(layer), "pts": pts})
    return out, None


def main():
    um = json.loads(UNITS.read_text(encoding="utf-8"))
    cu = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    moi, loi = {}, []
    for u in um:
        paths, err = boc(u)
        if err:
            loi.append(f"{u['ma']}: {err}")
            if u["ma"] in cu:
                moi[u["ma"]] = cu[u["ma"]]
            continue
        moi[u["ma"]] = paths

    print(f"{'mã căn':30s} {'cũ':>6s} {'mới':>6s}   thay đổi theo lớp")
    for ma, ps in moi.items():
        a = collections.Counter(p["cat"] for p in (cu.get(ma) or []))
        b = collections.Counter(p["cat"] for p in ps)
        delta = {k: b[k] - a.get(k, 0) for k in set(a) | set(b) if b[k] != a.get(k, 0)}
        print(f"{ma:30s} {sum(a.values()):6d} {sum(b.values()):6d}   {delta or '—'}")
    if loi:
        print("\nLỖI:", *loi, sep="\n  ")

    if "--ghi" in sys.argv:
        OUT.write_text(json.dumps(moi, ensure_ascii=False), encoding="utf-8")
        print(f"\nđã ghi {OUT}")
    else:
        print("\n(chạy lại với --ghi để ghi đè)")


if __name__ == "__main__":
    main()
