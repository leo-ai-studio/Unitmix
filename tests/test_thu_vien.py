"""Kiểm thư viện mẫu tòa, mẫu căn sau khi chép và chuẩn hoá tên (Việc 1)."""
import json
import re
from pathlib import Path

GOC = Path(__file__).resolve().parents[1]
LIB = GOC / "web" / "public" / "lib"


def _doc(ten):
    return json.loads((LIB / ten).read_text(encoding="utf-8"))


def test_id_dung_quy_tac():
    toa = _doc("toa.json")
    can = _doc("can.json")
    assert all(re.fullmatch(r"(tm|xh)-[iltuvyz][0-9]+", t["id"]) for t in toa)
    assert all(re.fullmatch(r"(tm|xh)-(stu|1pn|2pn|2pnp|3pn)-[a-z][0-9]", c["id"]) for c in can)
    assert len({t["id"] for t in toa}) == len(toa)
    assert len({c["id"] for c in can}) == len(can)


def test_ten_co_dau_va_khong_trung_ma():
    toa = {t["id"]: t for t in _doc("toa.json")}
    can = {c["id"]: c for c in _doc("can.json")}
    for x in list(toa.values()) + list(can.values()):
        assert x["ten_vi"] and x["ten_vi"] not in (x["id"], x["ma_goc"])
        assert x["ten_en"] and x["ten_en"] not in (x["id"], x["ma_goc"])
    assert toa["tm-u2"]["ten_vi"] == "U2 · Chữ U, biến thể 2"
    assert toa["tm-u1"]["ten_vi"] == "U1 · Chữ U"
    assert toa["tm-i1"]["ten_vi"] == "i1 · Thanh đơn"
    assert toa["tm-u2"]["ten_en"] == "U2 · U-shape, variant 2"
    assert can["tm-2pn-m1"]["ten_vi"] == "2PN M1 · giữa · 7,5 m"
    assert can["tm-2pn-m1"]["ten_en"] == "2BR M1 · mid · 7.5 m"
    assert can["xh-stu-m1"]["ten_vi"] == "Studio M1 · giữa · 4,0 m"


def test_so_luong():
    toa = _doc("toa.json")
    assert len(toa) == 33
    assert sum(t["nhom"] == "tm" for t in toa) == 21
    assert sum(t["nhom"] == "xh" for t in toa) == 12
    assert len(_doc("can.json")) == 34


def test_co_cau_tham_chieu_ton_tai():
    ids = {c["id"] for c in _doc("can.json")}
    for t in _doc("toa.json"):
        assert t["co_cau"], t["id"]
        for k in t["co_cau"]:
            assert k in ids, (t["id"], k)


def test_dt_can_giu_nguyen():
    nguon = _doc("nguon.json")
    tep = Path(nguon["duong_dan"]) / "data" / "master" / "units.json"
    if not tep.exists():
        import pytest
        pytest.skip("không có bản checkout app cũ MDI_Unitmix_v4 (chỉ đối chiếu được trên máy có app cũ)")
    goc = json.loads(tep.read_text(encoding="utf-8"))
    goc = {u["ma"]: u for u in goc}
    for c in _doc("can.json"):
        u = goc[c["ma_goc"]]
        assert c["dt_tt_m2"] == u["dt_tt_m2"]
        assert c["dt_tim_m2"] == u["dt_tim_m2"]


def test_hinh_hoc_tach_tep():
    for c in _doc("can.json"):
        p = LIB / "can" / f"{c['id']}.json"
        assert p.exists(), c["id"]
        assert p.stat().st_size < 1_000_000, c["id"]
        assert "ve" in json.loads(p.read_text(encoding="utf-8"))
    for t in _doc("toa.json"):
        for loi in t["loi"]:
            assert (LIB / "loi" / f"{loi}.json").exists(), (t["id"], loi)


def test_nguon_ghi_commit():
    n = _doc("nguon.json")
    assert re.fullmatch(r"[0-9a-f]{7,40}", n["commit"])
    thu_vien = [k for k in n["tep"] if not k.startswith(("rules/", "docs/"))]
    assert len(thu_vien) == 7
    assert (LIB / "pccc.json").exists()
    assert all(re.fullmatch(r"[0-9a-f]{64}", v) for v in n["tep"].values())
