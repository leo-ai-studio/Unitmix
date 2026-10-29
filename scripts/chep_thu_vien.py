"""Chép thư viện mẫu tòa, mẫu căn, lõi từ repo cũ sang web/public/lib và chuẩn hoá tên.

Chỉ ĐỌC repo nguồn. Thiếu dữ liệu bắt buộc thì dừng và in tên, không bỏ qua im lặng.

    python scripts/chep_thu_vien.py --nguon E:\\Projects\\MDI_Unitmix_v4 [--bang-ten]
"""
import argparse
import datetime
import hashlib
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import quy_tac_ten as q  # noqa: E402

GOC = Path(__file__).resolve().parents[1]
LIB = GOC / "web" / "public" / "lib"
TEP_NGUON = ["towers.json", "toa_dwg.json", "units.json", "unit_geometry.json", "can3d.json", "core_geometry.json", "tu_pccc.json"]


def _doc(p: Path):
    return json.loads(p.read_text(encoding="utf-8"))


def _ghi(p: Path, obj, gon=True):
    p.parent.mkdir(parents=True, exist_ok=True)
    kw = {"separators": (",", ":")} if gon else {"indent": 1}
    p.write_text(json.dumps(obj, ensure_ascii=False, **kw), encoding="utf-8", newline="\n")


def ghi_can(ds: list, f: Path) -> None:
    """can.json: indent=1 như _ghi(gon=False), riêng mỗi phòng (`phong`, do boc_cad/boc_phong.py bóc) đường cắt STRETCH
    (`stretch`) và hình bao căn góc (`khung`) nằm gọn MỘT dòng."""
    the, ban = {}, []
    for c in ds:
        c2 = dict(c)
        if c2.get("stretch"):
            key = f"@@STRETCH_{c['id']}@@"
            the[json.dumps(key)] = json.dumps(c2["stretch"], ensure_ascii=False, separators=(",", ":"))
            c2["stretch"] = key
        if c2.get("khung"):
            key = f"@@KHUNG_{c['id']}@@"
            the[json.dumps(key)] = json.dumps(c2["khung"], ensure_ascii=False, separators=(",", ":"))
            c2["khung"] = key
        if c2.get("phong"):
            ph = []
            for i, p in enumerate(c2["phong"]):
                key = f"@@PHONG_{c['id']}_{i}@@"
                the[json.dumps(key)] = json.dumps(p, ensure_ascii=False, separators=(",", ":"))
                ph.append(key)
            c2["phong"] = ph
        ban.append(c2)
    s = json.dumps(ban, ensure_ascii=False, indent=1)
    for k, v in the.items():
        s = s.replace(k, v)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(s, encoding="utf-8", newline="\n")


def _loi(msg):
    sys.exit(f"LỖI THƯ VIỆN: {msg}")


def chep(nguon: Path, bang_ten: bool) -> None:
    master = nguon / "data" / "master"
    d = {t: _doc(master / t) for t in TEP_NGUON}
    commit = subprocess.run(["git", "-C", str(nguon), "rev-parse", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()

    # --- căn ---
    can, id_theo_ma = [], {}
    for u in d["units.json"]:
        ma = u["ma"]
        cid = q.id_can(ma)
        rong = q.rong_tu_ma(ma)
        for k in ("dt_tt_m2", "dt_tim_m2", "loai_can", "vi_tri", "vi_tri_ma"):
            if u.get(k) in (None, ""):
                _loi(f"căn {ma} thiếu {k}")
        if ma not in d["unit_geometry.json"]:
            _loi(f"căn {ma} thiếu hình học")
        id_theo_ma[ma] = cid
        can.append({
            "id": cid, "ma_goc": ma, "nhom": cid[:2], "loai": u["loai_can"],
            "vi_tri": u["vi_tri"], "vi_tri_ma": u["vi_tri_ma"],
            "sau_mm": u["rong_mm"], "rong_mm": rong,
            "ten_vi": q.ten_can(u["loai_can"], u["vi_tri"], u["vi_tri_ma"], rong, "vi"),
            "ten_en": q.ten_can(u["loai_can"], u["vi_tri"], u["vi_tri_ma"], rong, "en"),
            "dt_tt_m2": u["dt_tt_m2"], "dt_tim_m2": u["dt_tim_m2"], "dt_bao_m2": u.get("dt_bao_m2"),
            "so_wc": u.get("so_wc"), "so_phong_ngu": u.get("so_phong_ngu"), "logia_lui": u.get("logia_lui"),
            # QT-81 · đường cắt STRETCH qua phòng khách (scripts/boc_stretch.py của app cũ); không có = căn không kéo được
            **({"stretch": {k: u["stretch"][k] for k in ("x_mm", "sau_tt_mm", "sau_tim_mm", "cung")}} if u.get("stretch") else {}),
        })
        _ghi(LIB / "can" / f"{cid}.json", {"ve": d["unit_geometry.json"][ma], "khoi3d": d["can3d.json"].get(ma)})

    # --- lõi ---
    for ma, geo in d["core_geometry.json"].items():
        _ghi(LIB / "loi" / f"{q.id_loi(ma)}.json", geo)

    # --- tòa ---
    dwg = {x["ma"]: x for x in d["toa_dwg.json"]}
    # Đồ thị hành lang + cửa buồng thang app cũ dựng cho bố cục gốc (scripts/hanh_lang_cu.js chạy headless trong repo cũ).
    hl_tep = GOC / "scripts" / "du_lieu" / "hanh_lang_cu.json"
    hl = _doc(hl_tep)["toa"] if hl_tep.exists() else {}
    toa = []
    for t in d["towers.json"]:
        ma = t["ma"]
        if ma not in dwg:
            _loi(f"tòa {ma} không có trong toa_dwg.json")
        w = dwg[ma]
        tid = q.id_toa(ma)
        hinh, so = tid[3], int(tid[4:])
        co_cau = {}
        for k, n in w["co_cau_can"].items():
            ma_can = next((m for m in id_theo_ma if m.startswith(f"ch{tid[:2]}_hn_{k}_")), None)
            if not ma_can:
                _loi(f"tòa {ma}: cơ cấu tham chiếu căn {k} không có")
            co_cau[id_theo_ma[ma_can]] = n
        for b in w["ten_block_loi"]:
            if b not in d["core_geometry.json"]:
                _loi(f"tòa {ma}: lõi {b} không có hình học")
        toa.append({
            "id": tid, "ma_goc": ma, "nhom": tid[:2], "hinh": hinh, "so": so,
            "ten_vi": q.ten_toa(hinh, so, "vi"), "ten_en": q.ten_toa(hinh, so, "en"),
            "so_can_tang": w["so_can_tang"], "dtxd_m2": w["dt_duong_bao_m2"],
            "hanh_lang_mm": w["hanh_lang_mm"], "sau_can_mm": w["sau_can_pho_bien_mm"],
            "duong_bao": w["duong_bao"], "truc": w["truc"], "mat": w["mat"], "hanhlang_ve": w["hanhlang_ve"],
            "co_cau": co_cau, "loi": [q.id_loi(b) for b in w["ten_block_loi"]],
            "thang_bo": t.get("thang_bo_vi_tri"), "file_dwg": w["file"],
            **({"hanh_lang": hl[ma]["hanh_lang"], "cua_thang": hl[ma]["cua_thang"]} if ma in hl else {}),
        })

    _ghi(LIB / "pccc.json", d["tu_pccc.json"], gon=False)
    # giữ dữ liệu phòng đã bóc từ CAD (repo nguồn không có) — bóc lại bằng scripts/boc_cad/boc_phong.py
    cu = LIB / "can.json"
    phong = {x["id"]: x["phong"] for x in _doc(cu) if x.get("phong")} if cu.exists() else {}
    for x in can:
        if x["id"] in phong:
            x["phong"] = phong[x["id"]]
    ghi_can(can, cu)
    _ghi(LIB / "toa.json", toa)
    _ghi(LIB / "nguon.json", {
        "repo": "MDI_Unitmix_v4", "duong_dan": str(nguon), "commit": commit,
        "ngay_chep": datetime.date.today().isoformat(),
        "tep": {t: hashlib.sha256((master / t).read_bytes()).hexdigest() for t in TEP_NGUON},
    }, gon=False)

    if bang_ten:
        dong = ["# Bảng tên thư viện: mã cũ → mã mới", "", f"Nguồn: MDI_Unitmix_v4 @ `{commit[:7]}`", "",
                "## Mẫu tòa", "", "| Mã cũ | Mã mới | Tên (VI) | Tên (EN) | Căn/tầng |", "|---|---|---|---|---|"]
        dong += [f"| {x['ma_goc']} | {x['id']} | {x['ten_vi']} | {x['ten_en']} | {x['so_can_tang']} |" for x in toa]
        dong += ["", "## Mẫu căn", "", "| Mã cũ | Mã mới | Tên (VI) | Tên (EN) | DT thông thủy (m²) |", "|---|---|---|---|---|"]
        dong += [f"| {x['ma_goc']} | {x['id']} | {x['ten_vi']} | {x['ten_en']} | {x['dt_tt_m2']} |" for x in can]
        (GOC / "docs").mkdir(exist_ok=True)
        (GOC / "docs" / "thu_vien_ten.md").write_text("\n".join(dong) + "\n", encoding="utf-8", newline="\n")

    print(f"Đã chép {len(toa)} tòa, {len(can)} căn, {len(d['core_geometry.json'])} lõi từ {commit[:7]}")
    # quy tắc xếp căn + QCVN (rules/*.yaml, QUY_TAC_XEP_CAN.md) → quy_tac.json, sha256 gộp vào nguon.json vừa ghi
    import chep_quy_tac  # noqa: E402
    chep_quy_tac.chep(nguon)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--nguon", required=True, type=Path)
    ap.add_argument("--bang-ten", action="store_true")
    a = ap.parse_args()
    chep(a.nguon, a.bang_ten)
