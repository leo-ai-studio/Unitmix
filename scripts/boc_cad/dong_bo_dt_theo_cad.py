"""Đồng bộ DT căn hộ THEO CAD — cập nhật CẢ XREF_CanHo_BT_ChuanHoa.xlsx VÀ data/master/units.json (MDIUnitmix v4).

Chủ nhiệm 18/10/2026: "cập nhật cả excel và app theo CAD". Nguồn = CAD ĐÃ BÓC (không đo lại .dwg — cần AutoCAD):
  · DT TIM        = units.json `dt_tim_do_cad_m2`   (đo A-AREA-WALL-CENTER lúc bóc, chính xác tuyệt đối)
  · DT THÔNG THUỶ = diện tích nét kín lớn nhất lớp A-AREA-SPACE trong unit_geometry.json (toạ độ chuẩn hoá 4 chữ số → ±0,01 m²)
  Mẫu căn CAD KHÔNG có nét A-AREA-SPACE kín (2pn_v1, stu_m1/m2 — tim/thông thuỷ trước đây là ước lượng ×0,9214) thì
  CHỈ cập nhật DT TIM, giữ nguyên thông thuỷ ở cả hai nơi (không bịa số) và in ra danh sách để đội CAD vẽ bổ sung.

Việc ghi (--ghi):
  units.json : dt_tim_m2 · dt_tt_m2 · dtsd_m2 · he_so_tim_tt · hs_tim_tren_bao  (các trường khác không đụng)
  xlsx       : ô K (DT TIM) và L (DT THÔNG THỦY) của hàng khớp tên XREF — SỬA THẲNG XML trong gói zip. KHÔNG dùng openpyxl để
               lưu: tệp có 34 ảnh mặt bằng nhúng, openpyxl làm mất sạch ảnh. Mọi thứ khác (ảnh, định dạng, công thức) giữ nguyên.
  Mẫu căn chưa có hàng trong xlsx (vd chtm_hn_2pn_y2) thì KHÔNG thêm hàng — chỉ báo.
  Mẫu có `nguon_dt_tim = chua_doi_chieu` (ranh tim tường vẽ nhầm lớp: chtm_hn_2pn_y2, chxh_hn_2pn_y1) KHÔNG ghi vào xlsx.

Chạy: PYTHONIOENCODING=utf-8 python scripts/dong_bo_dt_theo_cad.py          (chỉ in thay đổi)
      PYTHONIOENCODING=utf-8 python scripts/dong_bo_dt_theo_cad.py --ghi     (ghi units.json + xlsx; Git là bản sao lưu)
Sau khi ghi: python scripts/build_shell.py · node scripts/chay_selftest.js · python scripts/kiem_dt_can.py
"""
import io
import json
import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
UNITS = ROOT / "data" / "master" / "units.json"
GEO = ROOT / "data" / "master" / "unit_geometry.json"
XLSX = ROOT / "data" / "dwg" / "x-canho-bt" / "XREF_CanHo_BT_ChuanHoa.xlsx"
SAU = 8500.0
SHEETS = {"CH THƯƠNG MẠI": "xl/worksheets/sheet1.xml", "CH NOXH-TDC": "xl/worksheets/sheet2.xml"}


def shoelace(p):
    a = 0.0
    for i in range(len(p)):
        x1, y1 = p[i]
        x2, y2 = p[(i + 1) % len(p)]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2


def dt_space(paths, dai_mm):
    best = 0.0
    for e in paths:
        if e.get("cat") == "space" and len(e["pts"]) >= 3:
            best = max(best, shoelace(e["pts"]) * dai_mm * SAU / 1e6)
    return round(best, 2) if best > 0 else None


def hang_xlsx():
    """{ma: (sheet, số_hàng, tim_cũ, tt_cũ)} — tên XREF lấy từ giá trị đã tính của cột I (công thức TEXTJOIN)."""
    import openpyxl
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    out = {}
    for sheet in SHEETS:
        ws = wb[sheet]
        for r in range(2, ws.max_row + 1):
            ten = ws.cell(r, 9).value
            if ws.cell(r, 1).value is None or not ten:
                continue
            num = lambda v: float(v) if isinstance(v, (int, float)) else None
            out[pathlib.Path(str(ten)).stem] = (sheet, r, num(ws.cell(r, 11).value), num(ws.cell(r, 12).value))
    return out


def dat_o(xml, ref, giatri):
    """Đặt giá trị số cho ô `ref` trong XML sheet, giữ nguyên style `s`. Trả (xml_mới, đã_đổi)."""
    m = re.search(r'<c r="%s"([^>]*?)(/>|>(.*?)</c>)' % ref, xml, re.S)
    if not m:
        raise RuntimeError(f"không thấy ô {ref}")
    attrs = re.sub(r'\s+t="[^"]*"', "", m.group(1))          # ô số: bỏ kiểu chuỗi/công thức nếu có
    moi = f'<c r="{ref}"{attrs}><v>{giatri:.2f}</v></c>'
    return xml[:m.start()] + moi + xml[m.end():], moi != m.group(0)


def main():
    ghi = "--ghi" in sys.argv
    units = json.loads(UNITS.read_text(encoding="utf-8"))
    geo = json.loads(GEO.read_text(encoding="utf-8"))
    xl = hang_xlsx()
    doi_u, doi_x, khong_tt, thieu_hang, chua_doi = [], [], [], [], []
    sua_xml = {s: None for s in SHEETS.values()}

    zin = zipfile.ZipFile(XLSX)
    for p in sua_xml:
        sua_xml[p] = zin.read(p).decode("utf-8")

    for u in units:
        ma = u["ma"]
        tim = u.get("dt_tim_do_cad_m2")
        tt_cad = dt_space(geo.get(ma) or [], u["dai_mm"])
        if tim is None:
            print("BỎ QUA (không có số đo CAD):", ma)
            continue
        if tt_cad is None:
            khong_tt.append(ma)
        tt_moi = tt_cad if tt_cad is not None else u["dt_tt_m2"]
        # ---- units.json ----
        moi = {"dt_tim_m2": round(tim, 2), "dt_tt_m2": round(tt_moi, 2), "dtsd_m2": round(tt_moi, 2),
               "he_so_tim_tt": round(tim / tt_moi, 4) if tt_moi else None}
        if u.get("dt_bao_m2"):
            moi["hs_tim_tren_bao"] = round(tim / u["dt_bao_m2"], 4)
        d = {k: (u.get(k), v) for k, v in moi.items() if u.get(k) != v}
        if d:
            doi_u.append((ma, d))
            if ghi:
                u.update(moi)
        # ---- xlsx ----
        if str(u.get("nguon_dt_tim", "")).startswith("chua_doi_chieu"):
            chua_doi.append(ma)          # ranh tim vẽ nhầm lớp — chưa đối chiếu, KHÔNG ghi vào bảng Viện
            continue
        if ma not in xl:
            thieu_hang.append(ma)
            continue
        sheet, r, tim_x, tt_x = xl[ma]
        dx = []
        if tim_x is None or abs(tim_x - tim) > 0.004:
            dx.append(("K", "DT TIM", tim_x, round(tim, 2)))
        if tt_cad is not None and (tt_x is None or abs(tt_x - tt_cad) > 0.004):
            dx.append(("L", "DT THÔNG THỦY", tt_x, tt_cad))
        for col, ten, cu, gt in dx:
            doi_x.append((ma, sheet, f"{col}{r}", ten, cu, gt))
            if ghi:
                p = SHEETS[sheet]
                sua_xml[p], _ = dat_o(sua_xml[p], f"{col}{r}", gt)

    print(f"== units.json: {len(doi_u)} mẫu đổi ==")
    for ma, d in doi_u:
        print(f"  {ma}: " + " · ".join(f"{k} {a} → {b}" for k, (a, b) in d.items()))
    print(f"\n== xlsx: {len(doi_x)} ô đổi ==")
    for ma, sheet, ref, ten, cu, gt in doi_x:
        print(f"  [{sheet}] {ref} {ma} · {ten}: {cu} → {gt}")
    if khong_tt:
        print("\n== CAD không có nét A-AREA-SPACE kín → chỉ cập nhật TIM, GIỮ thông thuỷ (cần đội CAD vẽ bổ sung) ==")
        for ma in khong_tt:
            print("  ", ma)
    if thieu_hang:
        print("\n== chưa có hàng trong xlsx (KHÔNG tự thêm) ==")
        for ma in thieu_hang:
            print("  ", ma)

    if not ghi:
        print("\n(dry-run — thêm --ghi để ghi units.json và xlsx)")
        return 0

    UNITS.write_text(json.dumps(units, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = sua_xml[info.filename].encode("utf-8") if info.filename in sua_xml else zin.read(info.filename)
            zi = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = info.external_attr
            zout.writestr(zi, data)
    zin.close()
    XLSX.write_bytes(buf.getvalue())
    print(f"\nĐÃ GHI: {UNITS.name} ({len(doi_u)} mẫu) · {XLSX.name} ({len(doi_x)} ô).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
