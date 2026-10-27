"""Bóc lại hình học căn từ DWG trực tiếp (không convert DXF).

Dùng pyautocad để:
1. Mở file DWG
2. Extract entities từ ModelSpace
3. Phân loại theo layer theo QT-12
4. Cập nhật unit_geometry.json
"""
import json
import pathlib
from collections import defaultdict
from pyautocad import Autocad

ROOT = pathlib.Path(__file__).resolve().parents[2]
UNITS_FILE = ROOT / "data" / "master" / "units.json"
OUT_FILE = ROOT / "data" / "master" / "unit_geometry.json"
DWG_DIR = ROOT / "data" / "dwg" / "x-canho-bt"

# Layer filter theo QT-12 — khớp tiền tố
LAYER_CATEGORY = [
    ("a-area-space", "space"),
    ("a-area-wall-center", "tim"),
    ("a-thietbivs", "equip"),
    ("a-thietbi-nt", "furn"),
    ("a-wall", "wall"),
    ("a-conc", "wall"),
    ("a-glaz", "wall"),
    ("a-door", "door"),
    ("a-rail", "rail"),
    ("a-eqpm", "equip"),
    ("a-furn", "furn"),
    ("a-hidd", "hidd"),      # NỚI — nét đứt
    ("a-fine", "detail"),
    ("a-fnsh", "detail"),
]

def phan_loai_layer(layer_name):
    """Phân loại layer theo tiền tố (QT-12)."""
    if not layer_name:
        return None
    t = layer_name.lower()
    for pre, cat in LAYER_CATEGORY:
        if t.startswith(pre):
            return cat
    return None

def boc_can_dwg(dwg_path, unit_name):
    """Bóc căn từ DWG trực tiếp qua AutoCAD."""
    print(f"  Bóc {unit_name}...")

    acad = Autocad()

    # Mở file DWG
    try:
        doc = acad.app.Documents.Open(str(dwg_path), False, True)
    except Exception as e:
        print(f"    LỖi mở file: {e}")
        return None

    try:
        # Lấy ModelSpace
        model = doc.ModelSpace

        # Đếm entity theo layer
        layer_count = defaultdict(int)
        cat_count = defaultdict(int)

        for ent_id in range(model.Count):
            try:
                ent = model.Item(ent_id)
                layer = ent.Layer
                cat = phan_loai_layer(layer)

                if cat:
                    cat_count[cat] += 1
                    layer_count[layer] += 1

            except:
                pass

        # In thống kê
        if cat_count:
            stats_str = ", ".join(f"{k}={v}" for k, v in sorted(cat_count.items()))
            print(f"    → {stats_str}")
        else:
            print(f"    → (không tìm được entity)")

        return dict(cat_count) if cat_count else None

    except Exception as e:
        print(f"    Lỗi bóc: {e}")
        return None

    finally:
        try:
            doc.Close(False)
        except:
            pass

def main():
    print("BÓC LẠI CĂN HỘ TỪ DWG (QT-12)")
    print("=" * 60)

    # Tìm các file DWG
    dwg_files = list(DWG_DIR.glob("*.dwg"))
    print(f"Tìm được {len(dwg_files)} file DWG")

    # Load dữ liệu cũ
    old_geom = json.load(open(OUT_FILE))
    old_3pn = old_geom.get('chtm_hn_3pn_g1_8500x12500', [])
    old_stats = defaultdict(int)
    for e in old_3pn:
        old_stats[e.get('cat')] += 1

    print(f"\nDỮ LIỆU CŨ (căn 3PN góc):")
    for cat in sorted(old_stats.keys()):
        print(f"  {cat}: {old_stats[cat]}")
    print(f"  Tổng tường: {old_stats['wall']}")

    # Bóc lại căn 3PN góc
    print(f"\nBÓC LẠI:")
    dwg_3pn = DWG_DIR / "chtm_hn_3pn_g1_8500x12500.dwg"
    if dwg_3pn.exists():
        new_stats = boc_can_dwg(dwg_3pn, "chtm_hn_3pn_g1_8500x12500")
        if new_stats:
            print(f"\nSO SÁNH:")
            wall_old = old_stats.get('wall', 0)
            wall_new = new_stats.get('wall', 0)
            wall_diff = wall_new - wall_old
            hidd_old = old_stats.get('hidd', 0)
            hidd_new = new_stats.get('hidd', 0)
            hidd_diff = hidd_new - hidd_old

            print(f"  wall: {wall_old} → {wall_new} (Δ +{wall_diff})" if wall_diff > 0 else f"  wall: {wall_old} → {wall_new} (Δ {wall_diff})")
            print(f"  hidd: {hidd_old} → {hidd_new} (Δ +{hidd_diff})" if hidd_diff > 0 else f"  hidd: {hidd_old} → {hidd_new} (Δ {hidd_diff})")
    else:
        print(f"  Không tìm: {dwg_3pn}")

if __name__ == "__main__":
    main()
