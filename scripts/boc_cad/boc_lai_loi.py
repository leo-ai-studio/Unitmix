"""
Boc HINH HOC RUOT LOI tu data/source/dwg/x-thang/*.dwg
-> data/master/core_geometry.json

Day la manh ghep cuoi cung con thieu cua thu vien. Truoc ngay 1/9 thu muc
`x-thang` khong co tren may (XREF tro sang o mang M: chua mount), nen app chi
do duoc KICH THUOC BAO cua loi con ruot loi phai TINH theo QCVN. Gio co ban ve
that thi doc thang tu do:

    so gieng thang may   dem block `x_loithangmay`
    ten phong            chu tren layer A-TEXT: P.RAC, KTD, KTN, PCCC, P.DEM
    thang bo             x_tb_n3_8500x2610.dwg - co ca P.DEM 3,2 m2

QUAN TRONG - vi sao phai giu toa do MILIMET, khong chuan hoa ve [0,1] nhu can ho:
    Buong thang bo PHAI KEO DI CHUYEN DUOC tren mat bang. Neu chuan hoa theo o
    chua thi moi lan keo phai tinh lai ty le; giu mm cuc bo theo goc chen cua
    block thi chi can tinh tien - dung y het nhu cach ban ve goc lam viec.

    Goc (0,0) cua moi block la DIEM CHEN cua no trong ban ve toa, nen toa do o
    day khop truc tiep voi `offset_mm` da do duoc trong towers.json.

Chay:
    1) autocad_execute_python: xuat DXF (xem IRONPYTHON ben duoi) - can AutoCAD
       vi phai ResolveXrefs; ezdxf khong doc duoc DWG.
    2) python scripts/boc_loi_dwg.py
"""
from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

import ezdxf
from ezdxf import path as ezpath

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "data" / "master" / "core_geometry.json"


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
            ung.append(Path(a))
    ung.append(ROOT / "data" / "master" / ten_thu_muc)
    # PHẢI có dấu "/" sau tên ổ: Path("D:") là đường dẫn TƯƠNG ĐỐI THEO Ổ
    # (ra "D:OneDrive\…"), không phải gốc ổ đĩa.
    for o in ("D:/", "E:/", "C:/", "F:/"):
        ung.append(Path(o) / "OneDrive/_SETUP/AI_Tool/MDI_Unitmix/data/master" / ten_thu_muc)
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


DXF_DIR = tim_dxf("loi_dxf")

# Phan loai layer -> nhom net ve. Dung chung bang mau voi can ho.
CATEGORY = {
    "A-WALL": "wall", "A-CONC": "wall", "A-HEVY": "wall", "A-GLAZ": "wall",
    "A-DOOR": "door",
    "A-FURN": "furn", "A-HIDD": "hidd", "A-EQPM": "equip", "A-ThietBiVS": "equip",
    "A-Thietbi-NT": "furn",
    "A-LITE": "detail", "A-FNSH": "detail", "A-FINE": "detail",
    "A-RAIL": "rail", "A-AREA-SPACE": "space",
    "A-Text V": "nhan", "A-TEXT": "nhan",
}
SUPPORTED = {"LINE", "LWPOLYLINE", "POLYLINE", "ARC", "CIRCLE", "ELLIPSE", "SPLINE"}
NO_RA = {"MLINE"}

# Block dung de DEM, khong phai de ve.
BLOCK_GIENG = "x_loithangmay"          # moi insert = mot gieng thang may
BLOCK_RAC = "s1_thungrac"
BLOCK_CUA_THOAT = "s1_cuathoathiem"

# Ten phong doc duoc tren layer chu. Bo dau de so khop.
PHONG = {
    "P.RAC": "rac", "PRAC": "rac",
    "KTD": "dien", "KTN": "nuoc",
    "PCCC": "pccc",
    "P.DEM": "khoang_dem", "PDEM": "khoang_dem",
    "KT": "ky_thuat",
    "THANG": "thang", "HANG": "thang_hang",
}
DT_RE = re.compile(r"^\s*(\d+[,.]?\d*)\s*m2\s*$", re.IGNORECASE)


def bo_dau(s: str) -> str:
    b = ("aàảãáạăằẳẵắặâầẩẫấậdđeèẻẽéẹêềểễếệiìỉĩíịoòỏõóọôồổỗốộơờởỡớợ"
         "uùủũúụưừửữứựyỳỷỹýỵ")
    t = ("a" * 18 + "d" * 2 + "e" * 12 + "i" * 6 + "o" * 18 + "u" * 12 + "y" * 6)
    s = s.lower()
    ra = []
    for c in s:
        k = b.find(c)
        ra.append(t[k] if k >= 0 else c)
    return "".join(ra).upper()


def diem(entity):
    try:
        p = ezpath.make_path(entity)
        pts = list(p.flattening(distance=60, segments=8))
        if len(pts) > 200:
            step = max(1, len(pts) // 160)
            pts = pts[::step] + [pts[-1]]
        return [(float(q.x), float(q.y)) for q in pts]
    except Exception:                                       # noqa: BLE001
        return []


def ten_layer(l: str) -> str:
    """Bo tien to cua XREF da bind: `<xref>$0$<layer goc>`, long nhieu lop."""
    return l.rsplit("$0$", 1)[-1].strip() if "$0$" in l else l


def phan_loai(l: str) -> str | None:
    ten = ten_layer(l).lower()
    for k, v in CATEGORY.items():
        if ten.startswith(k.lower()):   # khop TIEN TO: A-WALL-INT, A-EQPM-2 ...
            return v
    return None


def _an(e) -> bool:
    return bool(getattr(e.dxf, "invisible", 0))


def duyet(e, layer_cha="0", tat=frozenset(), sau=0, dem=None, nhan=None):
    """Duyet de quy, vua sinh net ve vua DEM block va GOM NHAN phong."""
    l = getattr(e.dxf, "layer", "0")
    if l == "0":
        l = layer_cha
    if _an(e) or ten_layer(l) in tat:
        return
    t = e.dxftype()

    if t == "INSERT":
        ten = e.dxf.name
        goc = ten.rsplit("$0$", 1)[-1]
        if dem is not None and goc.lower().startswith(BLOCK_GIENG.lower()):
            p = e.dxf.insert
            dem.setdefault("gieng", []).append([round(p.x, 1), round(p.y, 1)])
        if dem is not None and goc.lower().startswith(BLOCK_RAC.lower()):
            dem["rac"] = dem.get("rac", 0) + 1
        if dem is not None and goc.lower().startswith(BLOCK_CUA_THOAT.lower()):
            dem["cua_thoat_hiem"] = dem.get("cua_thoat_hiem", 0) + 1
        if sau < 5:
            try:
                for c in e.virtual_entities():
                    yield from duyet(c, l, tat, sau + 1, dem, nhan)
            except Exception:                               # noqa: BLE001
                return
        return

    if t in NO_RA:
        try:
            for c in e.virtual_entities():
                yield from duyet(c, l, tat, sau + 1, dem, nhan)
        except Exception:                                   # noqa: BLE001
            return
        return

    if t in ("TEXT", "MTEXT") and nhan is not None:
        try:
            s = e.dxf.text if t == "TEXT" else e.text
            p = e.dxf.insert if t == "TEXT" else e.dxf.insert
        except Exception:                                   # noqa: BLE001
            return
        # MTEXT co the boc format \pt1016,...; -> chi lay phan sau dau ;
        s = (s or "").split(";")[-1].strip()
        if s:
            nhan.append({"text": s, "x": round(p.x, 1), "y": round(p.y, 1)})
        return

    if t in SUPPORTED and phan_loai(l):
        yield l, e


def layer_tat(doc) -> frozenset:
    ra = set()
    for l in doc.layers:
        try:
            if l.is_off() or l.is_frozen():
                ra.add(ten_layer(l.dxf.name))
        except Exception:                                   # noqa: BLE001
            continue
    return frozenset(ra)


def doc_phong(nhan: list[dict]) -> list[dict]:
    """Ghep nhan ten phong voi nhan dien tich dung ngay duoi no.

    Nguoi ve ghi hai dong roi: "KTD" o tren, "4,0m2" o duoi cach ~400 mm.
    """
    ten, dt = [], []
    for n in nhan:
        m = DT_RE.match(n["text"])
        if m:
            dt.append({**n, "m2": float(m.group(1).replace(",", "."))})
        else:
            k = bo_dau(n["text"]).replace(" ", "")
            if k in PHONG:
                ten.append({**n, "ma": PHONG[k]})
    ra = []
    for t in ten:
        gan = None
        for a in dt:
            d = math.hypot(a["x"] - t["x"], a["y"] - t["y"])
            if d < 1500 and (gan is None or d < gan[0]):
                gan = (d, a)
        ra.append({
            "ma": t["ma"], "ten": t["text"],
            "x": t["x"], "y": t["y"],
            "dt_m2": gan[1]["m2"] if gan else None,
        })
    return ra


def boc(p: Path) -> dict:
    doc = ezdxf.readfile(p)
    tat = layer_tat(doc)
    dem: dict = {}
    nhan: list[dict] = []
    tho = []
    for e in doc.modelspace():
        for l, ent in duyet(e, tat=tat, dem=dem, nhan=nhan):
            pts = diem(ent)
            if len(pts) >= 2:
                tho.append((l, pts))

    xs = [x for _, pts in tho for x, _ in pts]
    ys = [y for _, pts in tho for _, y in pts]
    if not xs:
        return {"paths": [], "phong": [], "so_gieng": 0}

    da_co = set()
    paths = []
    for l, pts in tho:
        cat = phan_loai(l)
        if cat == "nhan":
            continue
        pt = [[round(x, 1), round(y, 1)] for x, y in pts]
        khoa = (cat, tuple(map(tuple, pt)))
        if khoa in da_co:
            continue
        da_co.add(khoa)
        paths.append({"cat": cat, "pts": pt})

    # BBOX theo MEP TUONG, khong phai toan hinh: canh cua mo ra ngoai va net
    # gach cham lam bbox tong rong hon module that (thang bo 3 160 so voi 2 610).
    xw = [x for l, pts in tho if phan_loai(l) == "wall" for x, _ in pts]
    yw = [y for l, pts in tho if phan_loai(l) == "wall" for _, y in pts]
    bao_tuong = (
        [round(min(xw), 1), round(min(yw), 1), round(max(xw), 1), round(max(yw), 1)]
        if xw else None
    )

    gieng = dem.get("gieng", [])
    return {
        "bao_tuong_mm": bao_tuong,
        "rong_tuong_mm": round(max(xw) - min(xw), 1) if xw else None,
        "sau_tuong_mm": round(max(yw) - min(yw), 1) if yw else None,
        "paths": paths,
        "phong": doc_phong(nhan),
        "so_gieng": len(gieng),
        "vi_tri_gieng": gieng,
        "so_thung_rac": dem.get("rac", 0),
        "so_cua_thoat_hiem": dem.get("cua_thoat_hiem", 0),
        "bao_mm": [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)],
        "rong_mm": round(max(xs) - min(xs), 1),
        "sau_mm": round(max(ys) - min(ys), 1),
    }


def main() -> int:
    data = {}
    print(f"{'block':22s} {'path':>5s} {'giếng':>6s} {'rác':>4s} {'rộng':>7s} {'sâu':>7s}  phòng")
    for p in sorted(DXF_DIR.glob("*.dxf")):
        d = boc(p)
        data[p.stem] = d
        ph = ", ".join(
            x["ma"] if x["dt_m2"] is None else "{}({:g})".format(x["ma"], x["dt_m2"])
            for x in d["phong"]
        )
        print(f"{p.stem:22s} {len(d['paths']):5d} {d['so_gieng']:6d} "
              f"{d.get('so_thung_rac', 0):4d} {d.get('rong_mm', 0):7.0f} "
              f"{d.get('sau_mm', 0):7.0f}  {ph}")
    OUTPUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\nWrote {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
