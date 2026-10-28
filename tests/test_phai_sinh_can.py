"""Dữ liệu phái sinh mẫu căn (scripts/sinh_phai_sinh_can.py): cua_x trong can.json, nội thất tách riêng — phải khớp nguồn."""
import json
import sys
from pathlib import Path

GOC = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(GOC / "scripts"))
import sinh_phai_sinh_can as s  # noqa: E402

LIB = GOC / "web" / "public" / "lib"


def test_khop_khong_can_sinh_lai():
    assert s.chay(kiem=True) == 0


def test_tinh_cua_can_nhu_pccc_ts():
    # không có cửa → 0,5 (như tinhCuaCan([], 6000) trong pccc.test.ts)
    assert s.tinh_cua_can([], 6000) == 0.5
    # hai nét cửa chạm hành lang gần nhau gom một nhóm; nét xa > 1.500 mm thành nhóm khác ít nét hơn
    ve = [
        {"cat": "door", "pts": [[0.10, 0.0], [0.20, 0.01]]},
        {"cat": "door", "pts": [[0.21, 0.0], [0.30, 0.02]]},
        {"cat": "door", "pts": [[0.80, 0.0], [0.90, 0.0]]},
        {"cat": "door", "pts": [[0.40, 0.5], [0.50, 0.9]]},  # cửa trong căn (y lớn): bỏ
    ]
    assert abs(s.tinh_cua_can(ve, 6000) - 0.2) < 1e-12


def test_moi_can_co_cua_x_va_tep_noi_that():
    for c in json.loads((LIB / "can.json").read_text(encoding="utf-8")):
        assert 0 < c["cua_x"] < 1, c["id"]
        j = json.loads((LIB / "can" / f"{c['id']}.json").read_text(encoding="utf-8"))
        assert j.get("tach_noi_that") is True, c["id"]
        assert not any(n["cat"] in s.NET_NOI_THAT for n in j["ve"]), c["id"]
        assert (LIB / "can" / f"{c['id']}.noithat.json").exists(), c["id"]
