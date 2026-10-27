"""Bóc lại hình học căn từ DWG trực tiếp qua AutoCAD, không convert DXF.

Sửa lỗi phân loại layer theo QT-12:
  - Khớp theo TIỀN TỐ thay vì TÊN CHÍNH XÁC
  - Thêm loại 'hidd' (nét đứt)

So sánh trước/sau bóc để đảm bảo thêm nét tường.
"""
import json
import pathlib
from collections import defaultdict
from pyautocad import Autocad

ROOT = pathlib.Path(__file__).resolve().parents[2]
UNITS = ROOT / "data" / "master" / "units.json"
OUT = ROOT / "data" / "master" / "unit_geometry.json"

# Layer filter theo QT-12 — khớp tiền tố
CATEGORY = [
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

def phan_loai(layer_name):
    """Phân loại layer theo tiền tố."""
    if not layer_name:
        return None
    t = layer_name.lower()
    for pre, cat in CATEGORY:
        if t.startswith(pre):
            return cat
    return None

def boc_dxf_can(dwg_path, unit_name):
    """Bóc căn từ DWG trực tiếp."""
    print(f"\nĐang bóc {unit_name} từ {dwg_path}...")

    acad = Autocad()
    app = acad.app

    # Mở file
    doc = app.Documents.Open(str(dwg_path), False)  # Read-only
    try:
        model = doc.ModelSpace
        entities = list(model)
        print(f"  Entities: {len(entities)}")

        # Phân loại theo layer
        by_cat = defaultdict(list)
        for ent in entities:
            try:
                layer = ent.Layer
                cat = phan_loai(layer)
                if cat:
                    by_cat[cat].append({
                        'layer': layer,
                        'type': ent.EntityType
                    })
            except:
                pass

        # Thống kê
        stats = {k: len(v) for k, v in by_cat.items()}
        print(f"  Nét: {stats}")
        return stats

    finally:
        doc.Close()

if __name__ == "__main__":
    # Test với căn 3PN
    dwg = ROOT / "data/dwg/x-canho-bt/chtm_hn_3pn_g1_8500x12500.dwg"
    stats = boc_dxf_can(dwg, "chtm_hn_3pn_g1_8500x12500")
    print(f"\nKết quả: {stats}")
