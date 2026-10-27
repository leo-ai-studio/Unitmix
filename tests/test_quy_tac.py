"""Kiểm quy_tac.json sinh từ rules/*.yaml + QUY_TAC_XEP_CAN.md của app cũ."""
import json
import re
from pathlib import Path

GOC = Path(__file__).resolve().parents[1]
LIB = GOC / "web" / "public" / "lib"


def _qt():
    return json.loads((LIB / "quy_tac.json").read_text(encoding="utf-8"))


def test_truong_bat_buoc():
    q = _qt()
    buoc = [b["ma"] for b in q["buoc"]]
    assert buoc == ["lo_qh", "chon_mau_toa", "xep_day_can", "doi_mau_can", "pccc", "ham", "chi_tieu"]
    for x in q["luat"]:
        for k in ("ma", "id", "nhom", "buoc", "bat_buoc", "ten_vi", "ten_en", "nguon", "nguong", "ap_dung", "ma_cu", "thay_the_boi", "ma_kiem"):
            assert k in x, (x.get("id"), k)
        assert x["nhom"] in ("qcvn01", "qd34", "qcvn04", "qcvn06", "mdi", "qt")
        assert x["ap_dung"] in ("tm", "xh", "ca_hai")
        assert x["buoc"] in buoc
        assert re.fullmatch(r"(LO|MT|XC|DC|PC|HA|CT)-\d{2}", x["ma"])
        # luật bổ sung (không có ở app cũ) được phép không có mã cũ, nhưng phải ghi rõ nguồn quy chuẩn
        assert x["ma_cu"] or (x.get("bo_sung") and x["nguon"])


def test_ma_duy_nhat_va_thu_tu():
    luat = _qt()["luat"]
    assert len({x["ma"] for x in luat}) == len(luat)
    assert len({x["id"] for x in luat}) == len(luat)
    thu_tu = [b["ma"] for b in _qt()["buoc"]]
    k = [(thu_tu.index(x["buoc"]), not x["bat_buoc"]) for x in luat]
    assert k == sorted(k), "trong mỗi bước: bắt buộc trước, nội bộ sau"


def test_khong_bieu_thuc_js():
    raw = (LIB / "quy_tac.json").read_text(encoding="utf-8")
    for mau in ("=>", "toFixed", "m.GH", "?'ok'"):
        assert mau not in raw


def test_du_luat_yaml_va_nguong_giu_nguyen():
    nguon = json.loads((LIB / "nguon.json").read_text(encoding="utf-8"))
    assert all(re.fullmatch(r"[0-9a-f]{64}", nguon["tep"][k]) for k in nguon["tep"] if k.startswith("rules/"))
    assert sum(k.startswith("rules/") for k in nguon["tep"]) == 5
    luat = {x["id"]: x for x in _qt()["luat"]}
    assert sum(1 for x in luat.values() if "yaml" in x) == 21
    gt = lambda i: [n["gia_tri"] for n in luat[i]["nguong"]]  # noqa: E731
    assert gt("qcvn06_deadend") == [25, 15]
    assert gt("qcvn06_two_stairs_travel") == [40, 20]
    assert gt("qcvn06_compartment") == [2500, 2000]
    assert gt("qcvn06_A214_corridor") == [30]
    assert gt("qcvn06_335_corridor") == [60]
    assert gt("mdi_leftover") == [200]
    assert gt("qcvn04_min_area") == [25]
    assert gt("mdi_lift_unit") == [70] and gt("mdi_lift_pop") == [200]
    assert luat["qcvn06_52_hong_nuoc"]["nguong"][0]["gia_tri"] == 18


def test_moi_qt_duoc_phan_loai():
    q = _qt()
    nguon = json.loads((LIB / "nguon.json").read_text(encoding="utf-8"))
    md = (Path(nguon["duong_dan"]) / "docs" / "QUY_TAC_XEP_CAN.md").read_text(encoding="utf-8")
    ids = set(re.findall(r"QT-\d+[a-z]?", md))
    assert {x["ma_cu"] for x in q["qt_goc"]} == ids
    ma = {x["ma"] for x in q["luat"]}
    for x in q["qt_goc"]:
        if x["giu"]:
            assert x["luat_moi"] and set(x["luat_moi"]) <= ma
        else:
            assert x["loai_bo"] in q["loai_bo"] and x["ly_do"]
            if x["loai_bo"] == "thay_the":
                assert x["thay_the_boi"]
    t = q["thong_ke"]
    assert t["qt_giu"] + t["qt_bo"] == t["qt_goc"] == len(ids)
