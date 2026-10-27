"""Bóc định mức DỰ TOÁN từ hồ sơ suất đầu tư NOXH cao tầng chuẩn hoá → data/master/dinh_muc_du_toan.json.

Nguồn (KHÔNG nằm trong Git, lấy từ OneDrive/data/cost):
    data/cost/240508_SĐT NOXH cao tầng_TH_tong hop dinh muc.xlsx   — 4 mẫu tòa I8 · I15 · Z8 · Z15, đơn giá Q2/2024 Hà Nội

Bóc gì:
  mau        — quy mô 4 mẫu (sàn XD, sàn tầng ĐH, tum, số căn, số tầng)           ← 'Diện tích', 'ĐM_04 Căn hộ'
  goi        — suất đầu tư từng gói thầu, đ/m² sàn XD, trước VAT (ĐÃ gồm DP KL 10 %) ← 'ĐM_01 SĐT' (+ nhóm trượt giá 'ĐM_06')
  chi_tiet   — các gói tách được thành KHỐI LƯỢNG × ĐƠN GIÁ (BOQ gốc):
               kc (Kết cấu) · thep (CƯ thép) · nhom_kinh (NK) · cua_go (Cửa gỗ) · cua_thep (Cửa CC)
               mỗi dòng: định mức KL / m² sàn của từng mẫu (= KL BOQ ÷ sàn XD) + đơn giá (= thành tiền ÷ KL)
               `khac_m2` = phần còn lại của gói (khu công cộng, phụ kiện, tiện ích…) quy về đ/m² sàn, sao cho
               Σ dòng × (1+tỷ lệ) + khac_m2 × sàn = SĐT gói × sàn  — đúng từng đồng với hồ sơ.
  truot_gia  — hệ số trượt Q2/2024 → 2026 theo nhóm A–E, vùng, VAT                  ← 'ĐM_05 Giả định 2026'
  qlda_tt38  — định mức chi phí QLDA Bảng 1.1 TT 38/2026 (dân dụng)                 ← tệp đối chiếu TT 38 (số chép tay, tệp có sheet hỏng)

Chạy:  PYTHONIOENCODING=utf-8 python scripts/boc_dinh_muc_du_toan.py [--xlsx <đường dẫn>] [--kiem]
       --kiem : chỉ bóc + đối chiếu, không ghi tệp.
Mã thoát: 0 = khớp · 1 = có gói lệch hồ sơ > 1 đồng/m² · 2 = không đọc được nguồn.
"""
import datetime
import hashlib
import json
import pathlib
import re
import sys
import unicodedata

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "master" / "dinh_muc_du_toan.json"
MAU = ["I8", "I15", "Z8", "Z15"]


def arg(ten, mac):
    return sys.argv[sys.argv.index(ten) + 1] if ten in sys.argv else mac


def tim_xlsx():
    p = arg("--xlsx", None)
    if p:
        return pathlib.Path(p)
    for goc in (ROOT, ROOT.parent / "MDI_Unitmix_v4"):   # worktree: tệp nguồn nằm ở bản checkout chính
        ds = sorted((goc / "data" / "cost").glob("240508*dinh muc*.xlsx"))
        if ds:
            return ds[0]
    return None


def slug(s):
    s = unicodedata.normalize("NFD", str(s).replace("đ", "d").replace("Đ", "D"))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def so(v):
    if isinstance(v, (int, float)):
        return float(v)
    return None


def ten(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


# ID cố định cho các gói app dùng tới (còn lại lấy slug tên)
ID_GOI = {
    "Cọc thí nghiệm, cọc đại trà": "coc",
    "Thí nghiệm cọc": "tn_coc",
    "Tổng thầu XD - Phần kết cấu": "kc",
    "Tổng thầu XD - Phần hoàn thiện": "ht",
    "Thi công trần vách thạch cao, sơn bả": "thach_cao",
    "Cửa thép, cửa chống cháy": "cua_thep",
    "Kết cấu thép, Inox": "kct",
    "Thi công ốp, lát đá trong nhà": "da",
    "Thi công nhôm kính": "nhom_kinh",
    "CCLĐ sàn gỗ": "san_go",
    "CCLĐ cửa gỗ và phụ kiện": "cua_go",
    "Cung cấp lắp đặt bảng biển": "bien",
    "Vệ sinh công nghiệp": "vscn",
    "Thi công chống mối": "chong_moi",
    "Cung ứng thép xây dựng": "thep",
    "CC gạch ốp lát": "gach",
    "CC Thiết bị vệ sinh": "tbvs",
    "CC khóa cửa & phụ kiện": "khoa",
    "Thi công các hệ M&E": "me",
    "Thi công điện nhẹ": "dien_nhe",
    "Thi công hệ thống kích sóng": "kich_song",
    "Phần thi công điện trung thế, MBA": "trung_the",
    "CC + LĐ thang máy": "thang_may",
}

# Gói tách chi tiết: (id gói, sheet, cột KL 4 mẫu, cột thành tiền 4 mẫu)
# + các dòng lấy: (id dòng, hàng Excel, đại lượng hình học app dùng thay KL định mức | None)
CHI_TIET = {
    "kc": ("Kết cấu", "GHIJ", "LMNO", None),          # None = lấy MỌI dòng lá (có ĐVT, KL, đơn giá) trong vùng I–II
    "thep": ("CƯ thép", "DEFG", "IJKL", [("thep_d10", 3, None), ("thep_d10p", 4, None)]),
    "nhom_kinh": ("NK", "EFGH", "KLMN", [("nk_truot", 5, "nk_truot_m2"), ("nk_cua_di", 6, "nk_cua_di_m2"),
                                          ("nk_so", 7, "nk_so_m2")]),
    "cua_go": ("Cửa gỗ", "JKLM", "PQRS", [("cg_phong", 7, "cua_phong_bo"), ("cg_wc", 8, "cua_wc_bo")]),
    "cua_thep": ("Cửa CC", "EFGH", "JKLM", [("ct_chinh", 5, "cua_chinh_m2")]),
}
# tỷ lệ cộng trên Σ dòng của gói (đọc từ dòng % cuối bảng BOQ)
TY_LE_KC = [("bptc", "Biện pháp thi công"), ("lan_trai", "Hỗ trợ lán trại, phúc lợi công nhân"),
            ("du_phong", "Dự phòng phát sinh")]

# Hoàn thiện / KCT: app đo được KL từ hình học nhưng hồ sơ KHÔNG có đơn giá → người dùng nhập
CHI_TIET_KHONG_GIA = {
    "ht": [("ht_tuong", "Xây tường gạch trong căn + tường bao căn (khối xây)", "m³", "tuong_m3"),
           ("ht_trat", "Trát tường hai mặt (ước theo chiều dài tường, đã trừ lỗ cửa)", "m²", "trat_m2"),
           ("ht_lat", "Lát nền căn hộ (DT thông thuỷ)", "m²", "lat_m2"),
           ("ht_ctham_mai", "Chống thấm + hoàn thiện mái", "m²", "mai_m2")],
    "kct": [("kct_lan_can", "Lan can lô gia", "md", "lan_can_md")],
    "thang_may": [("tm_bo", "Thang máy (bộ)", "bộ", "thang_bo")],
}

# TT 38/2026/TT-BXD Bảng 1.1 — định mức chi phí QLDA, công trình dân dụng (tỷ lệ trên CPXD + TB chưa VAT)
QLDA_TT38 = {"moc_ty": [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 30000],
             "dan_dung": [0.03446, 0.02923, 0.0261, 0.02017, 0.01886, 0.01514, 0.01239, 0.00958, 0.00711,
                          0.0051, 0.00381, 0.00305],
             "k_thiet_bi_50": 0.8,
             "nguon": "TT 38/2026/TT-BXD Bảng 1.1 + Phụ lục VIII (nội suy tuyến tính) — chép từ 260905_KBB_TL_Doi chieu TT 38-2026…xlsx tab 02_QLDA"}


def main():
    src = tim_xlsx()
    if not src or not src.exists():
        print("!! không thấy data/cost/240508*dinh muc*.xlsx — truyền --xlsx <đường dẫn>")
        return 2
    wb = openpyxl.load_workbook(src, data_only=True)
    loi = []

    # ---- quy mô 4 mẫu
    dt = wb["Diện tích"]
    m4 = wb["ĐM_04 Căn hộ"]
    mau = {}
    for i, k in enumerate(MAU):
        hang_dt = {"I8": 2, "Z8": 3, "I15": 4, "Z15": 5}[k]
        cot = "EFGH"[i]
        mau[k] = {"ten": ten(dt[f"B{hang_dt}"].value), "hinh": k[0], "tang": int(k[1:]),
                  "dt_tang_dh": so(dt[f"C{hang_dt}"].value), "dt_tum": so(dt[f"D{hang_dt}"].value),
                  "dt_san": so(dt[f"E{hang_dt}"].value),
                  "so_can_t2": int(m4[f"{cot}15"].value), "so_can_tang": int(m4[f"{cot}16"].value),
                  "so_tang_dh": int(m4[f"{cot}17"].value), "so_can": int(m4[f"{cot}18"].value),
                  "chi_phi": so(m4[f"{cot}21"].value)}
        if abs(mau[k]["dt_san"] - so(m4[f"{cot}19"].value)) > 0.01:
            loi.append(f"DT sàn {k}: 'Diện tích' ≠ ĐM_04")
    S = {k: mau[k]["dt_san"] for k in MAU}

    # ---- nhóm trượt giá theo tên gói (ĐM_06 cột C)
    m6 = wb["ĐM_06 SĐT 2026"]
    nhom = {}
    for r in range(7, m6.max_row + 1):
        if m6[f"C{r}"].value in tuple("ABCDE"):
            nhom[ten(m6[f"B{r}"].value)] = m6[f"C{r}"].value

    # ---- gói thầu (ĐM_01)
    m1 = wb["ĐM_01 SĐT"]
    goi, phan, loai = [], None, None
    for r in range(8, m1.max_row + 1):
        a, b = m1[f"A{r}"].value, ten(m1[f"B{r}"].value)
        if a == "I":
            phan = "XD"; continue
        if a == "II":
            phan = "ME"; continue
        if a == "*":
            loai = "thi_cong" if "thi công" in b else "cung_ung"; continue
        v = [so(m1[f"{c}{r}"].value) for c in "CDEF"]
        if not b or all(x is None for x in v):
            continue                                   # dòng chỉ Saphire có (đồ rời) — bỏ
        gid = ID_GOI.get(b) or slug(b)
        goi.append({"id": gid, "phan": phan, "loai": loai, "ten": b, "nhom": nhom.get(b, "B" if phan == "XD" else "E"),
                    "sdt": {k: (v[i] or 0.0) for i, k in enumerate(MAU)},
                    "doi_chung": {"NTC": so(m1[f"H{r}"].value), "Saphire": so(m1[f"I{r}"].value)}})
    ids = [g["id"] for g in goi]
    if len(set(ids)) != len(ids):
        loi.append("trùng id gói")
    tong = {k: so(m1[f"{'CDEF'[i]}7"].value) for i, k in enumerate(MAU)}
    for k in MAU:
        s = sum(g["sdt"][k] for g in goi)
        if abs(s - tong[k]) > 1:
            loi.append(f"Σ gói {k} = {s:.0f} ≠ TỔNG {tong[k]:.0f}")
    sdt = {g["id"]: g["sdt"] for g in goi}

    # ---- gói chi tiết
    chi_tiet = {}
    for gid, (sh, ckl, ctt, dong) in CHI_TIET.items():
        ws = wb[sh]
        items = []
        if dong is None:                                # Kết cấu: mọi dòng lá
            for r in range(6, ws.max_row + 1):
                dvt, gia = ten(ws[f"F{r}"].value), so(ws[f"K{r}"].value)
                if not dvt or dvt == "%" or gia is None:
                    continue
                items.append((f"kc_{len(items) + 1:02d}", r, None))
        else:
            items = dong
        rows = []
        for iid, r, hh in items:
            kl = [so(ws[f"{c}{r}"].value) or 0.0 for c in ckl]
            tt = [so(ws[f"{c}{r}"].value) or 0.0 for c in ctt]
            dg = next((tt[i] / kl[i] for i in range(4) if kl[i] > 0), None)
            if dg is None:
                continue
            for i in range(4):
                if kl[i] > 0 and abs(tt[i] - kl[i] * dg) > 1:
                    loi.append(f"{sh} hàng {r}: đơn giá khác nhau giữa các mẫu")
            dvt_col = {"Kết cấu": "F", "Cửa gỗ": "I"}.get(sh, "C" if sh == "CƯ thép" else "D")
            rows.append({"id": iid, "ten": ten(ws[f"B{r}"].value), "dvt": ten(ws[f"{dvt_col}{r}"].value),
                         "dg": round(dg, 2), "hinh_hoc": hh,
                         "dm": {k: kl[i] / S[k] for i, k in enumerate(MAU)}})
        # tỷ lệ cộng thêm
        ty_le = []
        if gid == "kc":
            for tid, nhan in TY_LE_KC:
                r = next(r for r in range(6, ws.max_row + 1) if ten(ws[f"B{r}"].value).startswith(nhan))
                ty_le.append({"id": tid, "ten": ten(ws[f"B{r}"].value), "ty_le": so(ws[f"K{r}"].value),
                              "tren": "tong" if tid == "du_phong" else "dong"})
        else:
            ty_le.append({"id": "du_phong", "ten": "Dự phòng phát sinh do tạm tính theo TKCS", "ty_le": 0.1, "tren": "tong"})
        # phần khác của gói → đ/m² sàn, để Σ = SĐT gói
        khac = {}
        for k in MAU:
            day = sum(x["dm"][k] * x["dg"] for x in rows) * S[k]
            day = gop_ty_le(day, ty_le)
            khac[k] = (sdt[gid][k] * S[k] - day) / S[k]
        chi_tiet[gid] = {"dong": rows, "ty_le": ty_le, "khac_m2": khac}
        print(f"  {gid:10s} {len(rows):2d} dòng · phần khác/m² sàn: " +
              " · ".join(f"{k} {khac[k]:,.0f}" for k in MAU))
    for gid, ds in CHI_TIET_KHONG_GIA.items():
        chi_tiet[gid] = {"dong": [{"id": i, "ten": t, "dvt": d, "dg": None, "hinh_hoc": h, "dm": None} for i, t, d, h in ds],
                         "ty_le": [], "khac_m2": None}

    # ---- trượt giá 2026
    m5 = wb["ĐM_05 Giả định 2026"]
    truot = {m5[f"A{r}"].value: {"ten": ten(m5[f"B{r}"].value), "ty_le": so(m5[f"C{r}"].value),
                                 "can_cu": ten(m5[f"E{r}"].value)} for r in range(7, 12)}
    he_so = {"vung": so(m5["C15"].value), "vat": so(m5["C17"].value), "du_phong_kl_da_gom": 0.1}

    out = {"_nguon": {"tep": src.name, "sha256": hashlib.sha256(src.read_bytes()).hexdigest(),
                      "mat_bang_gia": "Q2/2024 · TP. Hà Nội · trước VAT", "ngay_boc": datetime.date.today().isoformat(),
                      "script": "scripts/boc_dinh_muc_du_toan.py",
                      "canh_bao": ["SĐT đã gồm dự phòng KHỐI LƯỢNG 10 % (TKCS chưa chi tiết) + 5 % CPQL nhà thầu M&E",
                                   "CHƯA gồm trượt giá Q2/2024 → nay; trượt giá và dự phòng KL là hai khoản độc lập",
                                   "Chưa gồm: đất, GPMB, lãi vay, san lấp / xử lý nền, QLDA, tư vấn, máy phát, kích sóng",
                                   "Mẫu chuẩn không có hầm; định mức vật tư là bình quân toàn tòa (gồm sảnh, hành lang)"]},
           "mau": mau, "goi": goi, "chi_tiet": chi_tiet, "truot_gia": truot, "he_so": he_so, "qlda_tt38": QLDA_TT38}

    print(f"  {len(goi)} gói · tổng SĐT " + " · ".join(f"{k} {tong[k]:,.0f}" for k in MAU))
    for e in loi:
        print("  !!", e)
    if "--kiem" not in sys.argv:
        OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print("  → ghi", OUT.relative_to(ROOT))
    return 1 if loi else 0


def gop_ty_le(day, ty_le):
    """Σ dòng → Σ gói: tỷ lệ 'dong' cộng trên Σ dòng, rồi tỷ lệ 'tong' nhân trên tất cả (giống BOQ Kết cấu)."""
    them = sum(t["ty_le"] for t in ty_le if t["tren"] == "dong") * day
    tong = day + them
    for t in ty_le:
        if t["tren"] == "tong":
            tong *= 1 + t["ty_le"]
    return tong


if __name__ == "__main__":
    sys.exit(main())
