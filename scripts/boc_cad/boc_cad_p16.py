# -*- coding: utf-8 -*-
"""Bóc lại TOÀN BỘ thư viện CAD sang dữ liệu app — phiên 16.

Chạy HAI BƯỚC (ezdxf không đọc được `.dwg`, xem docs/HUONG-DAN_boc-CAD-sang-web.md):

  1. `scripts/boc_cad_p16_autocad.py` — IronPython, chạy TRONG AutoCAD qua MCP.
     Đọc `.dwg` bằng side database + `ResolveXrefs`, ghi dump thô ra `<raw>/`:
        toa_<file>.json      lượt chèn + polyline `MDI-BAO` + chữ của mẫu tòa
        toa_loi_bb.json      GeometricExtents của lượt chèn lõi / thang bộ
        can2_<file>.json     nét vẽ căn hộ (mm, hệ toạ độ cục bộ)
        loi2_<file>.json     nét vẽ lõi thang (mm, hệ toạ độ cục bộ)
        meta_text_block.json chữ + tên block trong tệp căn / lõi
  2. `python scripts/boc_cad_p16.py <raw>` — tệp này. Không cần AutoCAD.

Xuất: data/master/{units,unit_geometry,core_geometry,toa_dwg,towers}.json

BỐN QUY TẮC ĐO (đều đã nghiệm thu bằng số, đừng đổi khi chưa đo lại):

  · **Nét bao DTXD = polyline lớp `MDI-BAO`.** Mỗi mẫu tòa có ĐÚNG MỘT polyline
    trên lớp này. Diện tích shoelace của nó khớp *tuyệt đối* con số DIỆN TÍCH
    người vẽ ghi trên bản vẽ ở 16/17 tòa (tòa còn lại ghi bằng field `####`).
    → không xấp xỉ, không suy diễn.
  · **Mặt (`mat`) gộp theo (góc xoay, khoảng cách pháp tuyến).** Góc phải LÀM
    TRÒN về bội 0,5° trước khi gộp: bản vẽ có lượt chèn 89,9° / 180,1° / 270,1°,
    để nguyên thì một mặt vỡ thành 3-4 mảnh (đã cắn: tòa T1 ra 11 mặt thay vì 7).
    Dung sai pháp tuyến 250 mm — hai mặt thật gần nhau nhất cách 10.250 mm, còn
    mảnh vỡ do sai số chỉ cách 2-174 mm.
  · **Trục hành lang = cặp mặt đối đầu** (góc lệch 180°) cách nhau 1.500-2.600 mm
    và có đoạn chồng nhau theo phương trục. Trục chạy hết PHẦN HỢP của hai mặt —
    để đầu trục (điểm kéo hành lang) nằm đúng mút căn ngoài cùng, nét bao mới
    khít vào được (`baoTheoTay` trong app dịch cạnh khe tới đầu trục).
  · **Hình học căn hộ chuẩn hoá x/dai_mm, y/8500.** Gốc (0,0) của tệp thư viện
    chính là điểm chèn XREF. Không cắt theo lề: đã đo, 17/18 tệp không có một
    nét nào ngoài lề 400 mm (tệp thư viện chỉ chứa đúng căn hộ), tệp thứ 18
    (`chtm_hn_2pn_y1_8500x6000`) là căn NÊM của tòa Y, phần nhô ra là hình thật.
"""
from __future__ import annotations

import collections
import json
import math
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
MASTER = ROOT / "data" / "master"

DEF_RAW = pathlib.Path(
    r"C:/Users/NC/AppData/Local/Temp/claude/E--OneDrive--SETUP-AI-Tool-MDI-Unitmix-v4"
    r"/2b5fa6f1-2fb8-45d2-a9af-15ed431bc917/scratchpad/raw")
RAW = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEF_RAW
if not RAW.is_dir():
    sys.exit("Khong thay thu muc dump tho: %s" % RAW)

SAU = 8500.0                      # chieu sau can - hang so o moi mau
# `--tinh-lai-gieng`: tính lại giếng/phòng của cả lõi ĐÃ CÓ trong
# core_geometry.json (bỏ đóng băng). Chỉ bật khi raw vừa dump MỚI bằng
# boc_cad_p16_autocad.py đã sửa meta() — dump cũ làm giếng sạch thành toạ độ
# rác (đo thật 2026-09-16: i1 8→0, z1 7→0, t1 9→0). Xem comment trong boc_loi().
TINH_LAI_GIENG = "--tinh-lai-gieng" in sys.argv
canh_bao_chung = []


def jload(p):
    return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))


def jdump(p, o):
    pathlib.Path(p).write_text(
        json.dumps(o, ensure_ascii=False, indent=1), encoding="utf-8")


def dt(poly):
    """Dien tich m2 cua da giac (mm) - shoelace, luon duong."""
    a = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0 / 1e6


# ---- LOGIA TỤT VÀO TRONG (phiên 21) ---------------------------------------
# Chủ nhiệm (23/9/2026, ảnh CH-18 hn_xh_z4): "fix lỗi DTXD ko tự dịch theo căn
# đối với các căn có logia tụt vào trong khi sắp xếp/xoá/thêm/thay căn". Đo
# trong AutoCAD: đúng 3 mã có logia LÙI VÀO SO VỚI KHUNG MÔ-ĐUN (mở rộng nét
# `khung` ở trên sang một dạng khác - đây là NGÀM VÀO, không phải BAO RA):
# `chtm_hn_2pn_m1_8500x7500` · `chxh_hn_2pn_m1_8500x7500` · `chxh_hn_2pn_m2_8500x7500`.
# Ba mã này ghép cặp lật gương (m1+m1 hoặc m1+m2) tạo một hốc logia CHUNG ở
# giữa hai căn kề nhau.
#
# Mốc x0 LẤY TỪ LỚP A-RAIL (lan can mép hốc), KHÔNG lấy từ `tim tường` (thử
# đầu tiên dùng tim ra x0=0,8233 — sai ~100 mm, đã bị `kiem-tra-mdi` bắt ở
# QT-55: đối chứng độc lập với `duong_bao` THẬT của hn_xh_z2/z3/z4 — cả hai
# lượt chèn cạnh nhau (m2 lật + m1 thường) đều cho x0 = 0,8333 khớp tới 5 mm,
# còn `tim` tụt sớm hơn vì đó là tường ngăn phòng/logia bên trong, sâu hơn,
# không phải ranh DTXD). `rail` cũng cho x0 = 0,8333/0,834 đúng khớp — dùng
# lớp này. x1 CHỐT VỀ MÉP CĂN (1,0): rail chỉ vẽ tới 0,9907 (chừa ~70 mm cho
# tường chung), còn DTXD tính tới TIM tường như quy ước toàn dự án.
# Ghi `logia_lui` (x0,x1: phần nghìn bề rộng · y: phần nghìn sâu) vào units.json;
# app tự đặt lại hốc này đúng VỊ TRÍ HIỆN TẠI của từng căn (xem QT-59).
def logia_lui(rail_frac, dai_mm):
    """Tìm hốc logia tụt vào trong từ lớp A-RAIL (đã chuẩn hoá 0..1) - xem chú thích trên."""
    cand = [p for p in rail_frac if 0.45 <= p[1] <= 0.93]
    if not cand:
        return None
    xs = [p[0] for p in cand]
    lo, hi, y = min(xs), max(xs), max(p[1] for p in cand)
    if (hi - lo) * dai_mm < 500:          # lan can vụn (tay vịn nhỏ...) - không phải hốc logia
        return None
    if lo <= 1.0 - hi:                     # cụm gần mép TRÁI hơn -> hốc chạm mép trái (x=0)
        x0, x1 = 0.0, round(hi, 4)
    else:                                 # cụm gần mép PHẢI hơn -> hốc chạm mép phải (x=1)
        x0, x1 = round(lo, 4), 1.0
    return [(x0, x1, round(y, 4))]


def r(v, k=1):
    return round(float(v), k)


# --------------------------- 1 . CAN HO ------------------------------------
# Phan loai lop theo TIEN TO (QT-12). Lop khong co trong bang thi BO - do la
# lop truc, ky hieu, diem khong in (DefPoints), den, hatch nen.
LOP_CAN = [
    ("a-area-space", "space"), ("a-area-wall-center", "tim"),
    ("a-dien tich tt", "space"),
    ("a-thietbivs", "equip"), ("a-thietbi-nt", "furn"),
    ("a-wall", "wall"), ("a-conc", "wall"), ("a-glaz", "wall"), ("a-hevy", "wall"),
    ("a-door", "door"), ("a-rail", "rail"),
    ("a-eqpm", "equip"), ("a-tbi", "equip"),
    ("a-furn", "furn"), ("cdc-kt-noi that", "furn"),
    ("a-hidd", "hidd"), ("a-fine", "detail"), ("a-fnsh", "detail"),
]


def phan_loai(layer, bang):
    t = (layer or "").lower()
    for pre, cat in bang:
        if t.startswith(pre):
            return cat
    return None


RE_MA = re.compile(r"^(chtm|chxh)_(\w\w)_(stu|1pn|1pnp|2pn|2pnp|3pn|3pnp|pen)_"
                   r"([a-z]\d)_(\d+)x(\d+)$")


def doc_insbase():
    """INSBASE cua tung tep thu vien - GOC MA AutoCAD dung khi attach XREF.

    Da can: 14/18 tep can va 1 tep loi co INSBASE = (43,363 ; -168,887) chu khong
    phai (0,0). Boc thang toa do model space thi hinh hoc lech dung tung ay mm so
    voi diem chen trong ban ve toa - loi `x_tmdv_z2_tm_04` bao lech 169 mm.
    """
    try:
        return jload(RAW / "insbase.json")
    except Exception:
        canh_bao_chung.append("khong co insbase.json - coi nhu moi tep co INSBASE (0,0)")
        return {}


INSBASE = doc_insbase()


def goc_tep(ten_dwg):
    return INSBASE.get(ten_dwg, [0.0, 0.0])


def boc_can():
    geo, rows = {}, []
    for f in sorted(RAW.glob("can2_*.json")):
        d = jload(f)
        ma = d["file"][:-4]
        if ma in BO_QUA_CAN:                  # chủ nhiệm chốt bỏ, không bóc (19/9/2026)
            continue
        ox, oy = goc_tep(d["file"])
        m = RE_MA.match(ma)
        if not m:
            canh_bao_chung.append("ten tep can khong dung quy tac: " + ma)
            continue
        dai = float(m.group(6))
        paths, tim, space, khung, tuong_kin = [], [], [], [], []
        for s in d["strokes"]:
            # KHUNG CĂN (phiên 20): căn góc tòa V (`2pn_v1`, `3pn_v1`) KHÔNG vẽ theo
            # khung mô-đun chữ nhật rộng×8500 như mọi căn khác — người vẽ khoanh một
            # polyline KÍN trên DefPoints bao trọn căn. App dựng khung chữ nhật thì
            # khung lệch khỏi căn, chìa ra ngoài nét bao tòa tới 1,2 m. Căn thường chỉ
            # có lưới trục (nét hở) và ô ghi chú nhỏ trên DefPoints -> lọc theo diện tích.
            if (s["layer"] or "").lower() == "defpoints" and s.get("c"):
                khung.append([[p[0] - ox, p[1] - oy] for p in s["pts"]])
                continue
            cat = phan_loai(s["layer"], LOP_CAN)
            if not cat:
                continue
            pts = [[p[0] - ox, p[1] - oy] for p in s["pts"]]
            if s.get("c") and pts[0] != pts[-1]:
                pts = pts + [pts[0]]
            if cat == "tim":
                tim.append(pts)
            if cat == "space":
                space.append(pts)
            if cat == "wall" and s.get("c"):
                tuong_kin.append((s["layer"], pts))
            paths.append({"cat": cat,
                          "pts": [[round(p[0] / dai, 4), round(p[1] / SAU, 4)]
                                  for p in pts]})
        # RANH TIM TƯỜNG VẼ NHẦM LỚP (1/10/2026): `chtm_hn_2pn_y2_8500x6000` và
        # `chxh_hn_2pn_y1_8500x6000` không có A-AREA-WALL-CENTER; ranh nằm trên
        # A-WALL-PRTN (polyline kín 69,67 m², thông thuỷ 64,82 → tỉ số 1,075). Không có
        # con số ghi tay để đối chiếu như nét bao mẫu tòa, nên luật hẹp: chỉ nhận khi
        # có ĐÚNG MỘT polyline kín lớp tường mà tim/thông thuỷ nằm trong dải 1,03–1,12
        # (dải của 27 mẫu có ranh đúng lớp: 1,05–1,09). Gắn nhãn `chua_doi_chieu`.
        tim_nham = None
        dt_sp = max([dt(p) for p in space] + [0.0])
        if not tim and dt_sp:
            uv = [(l, p) for l, p in tuong_kin if 1.03 <= dt(p) / dt_sp <= 1.12]
            if len(uv) == 1:
                tim_nham = uv[0][0]
                tim.append(uv[0][1])
                paths.append({"cat": "tim",
                              "pts": [[round(p[0] / dai, 4), round(p[1] / SAU, 4)]
                                      for p in uv[0][1]]})
                canh_bao_chung.append("can %s: ranh tim tuong ve nham lop '%s' (%.2f m2, "
                                      "khong co A-AREA-WALL-CENTER) - CHUA DOI CHIEU"
                                      % (ma, tim_nham, dt(uv[0][1])))
        # chỉ nhận khung khi nó là ranh CẢ CĂN: diện tích ≥ 90 % diện tích tim tường
        # (đo: 2pn_v1 69,03/68,35 · 3pn_v1 93,86/93,46; ô ghi chú DefPoints ≤ 0,4 m²).
        dt_tim = max([dt(p) for p in tim] + [0.0])
        khung = [p for p in khung if dt_tim and dt(p) >= 0.9 * dt_tim]
        # CĂN GÓC V THIẾU KHUNG DefPoints (3/10/2026 — chủ nhiệm khoanh CH-06/07 tòa V4 "khoanh căn sai"):
        # `chtm_hn_2pn_v2_8500x6200` chỉ có ranh tim tường A-AREA-WALL-CENTER (75,60 m², 8 đỉnh, không chữ nhật).
        # Không khung thì app khoanh theo ô mô-đun chữ nhật, cắt chéo qua căn xiên. Mẫu `v*` không có khung →
        # lấy ranh tim tường làm khung (cùng họ 2pn_v1: khung 69,07 / tim 68,33 — lệch < 1,1 %), CÓ cảnh báo.
        if not khung and m.group(4).startswith("v") and tim:
            t0 = max(tim, key=dt)
            khong_cn = len({(round(p[0]), round(p[1])) for p in t0}) > 4
            if khong_cn:
                khung = [t0]
                canh_bao_chung.append("can %s: KHONG co khung DefPoints - lay ranh tim tuong %.2f m2 "
                                      "lam khung can goc V (doi CAD bo sung DefPoints)" % (ma, dt(t0)))
        if khung:
            k0 = max(khung, key=dt)
            if k0[0] != k0[-1]:
                k0 = k0 + [k0[0]]
            paths.append({"cat": "khung",
                          "pts": [[round(p[0] / dai, 4), round(p[1] / SAU, 4)] for p in k0]})
            canh_bao_chung.append("can %s: khung can = polyline kin %.2f m2 "
                                  "(khong phai khung mo-dun chu nhat)" % (ma, dt(k0)))
        geo[ma] = paths
        rail_frac = [p for s in paths if s["cat"] == "rail" for p in s["pts"]]
        lui = logia_lui(rail_frac, dai)
        rows.append({"ma": ma, "dai_mm": dai,
                     "dt_tim_do_m2": round(max([dt(p) for p in tim] + [0.0]), 2),
                     "dt_tt_do_m2": round(max([dt(p) for p in space] + [0.0]), 2),
                     **({"tim_nham_lop": tim_nham} if tim_nham else {}),
                     **({"logia_lui": lui} if lui else {})})
        if lui:
            canh_bao_chung.append("can %s: logia tut vao trong %s (xem QT-59)" % (ma, lui))
        if not tim:
            canh_bao_chung.append("can %s: khong co polyline A-AREA-WALL-CENTER" % ma)
    return geo, {x["ma"]: x for x in rows}


# --------------------------- 2 . LOI / THANG -------------------------------
# LOP_CAN bo qua "a-lite" vi trong tep CAN do la den tran. Nhung trong thu vien
# LOI/THANG cua Vien, hoa vien dat TOAN BO net trong loi len "A-LITE": bac thang
# bo, vanh tay vin, khung cabin, canh cua thang may, ray dan huong, thang leo
# ho. Vd x_tb_n3 co 22/53 net o A-LITE (16 bac thang + duong chay), x_tmkt_i1 co
# 244/449, x_tmkt_t2 co 760/1147. Bo "a-lite" o day thi loi/thang chi con vanh
# tuong + cua -> mat sach ruot ("thieu net boc CAD cua tat ca loi thang").
# "AS3_HIDDEN" = net khuat (vach ngang bac / o thong tang) — cung dua vao.
LOP_LOI = LOP_CAN + [("a-stair", "detail"), ("a-flor", "detail"),
                     ("a-lite", "detail"), ("as3_hidden", "detail")]
# MDI-BAO-TM (phiên 17): nét bao CHẶN LÕI THANG MÁY - do doi CAD tu ve rieng cho
# tung loi, thay the cho khung bao suy tu net tuong (bao_tuong_mm). Tach rieng
# khoi LOP_LOI vi day la du lieu MOC cho thuat toan don khit, khong phai net ve
# de hien thi - khong dua vao "paths" (xem boc_loi() ben duoi).
LOP_BAO_TM = [("mdi-bao-tm", "bao_tm")]
RE_LIFT = re.compile(r"x_loithangmay|thang\s*t\w*ng|thang\s*m\w*y", re.I)
# Tệp thư viện CHỦ NHIỆM CHỐT BỎ (19/9/2026): không bóc, không cảnh báo. KHÔNG xoá tệp .dwg.
BO_QUA_CAN = {"chtm_hn_2pn_y2"}          # tên không theo quy tắc `_<sâu>x<rộng>`; chưa dùng
BO_QUA_LOI = {"x-kt-vtk-a1"}             # khung tên A1, không phải lõi
RE_BAO_S = re.compile(r"^s\d+_", re.I)      # block bao chua cac gieng, khong phai gieng

# QUY TẮC ĐẾM GIẾNG THANG MÁY (QT-64 · chủ nhiệm 3/10/2026 "tạo quy tắc bóc, đếm số thang máy cad cho chuẩn").
# Đo trên CAD 24 lõi: mỗi giếng có ĐÚNG MỘT block ký hiệu thang ở cấp ngoài cùng của nó, thuộc một trong ba
# dạng: `x_loithangmay` (block Viện) · block thang của hãng `THANG TÀNG DH_dwg_tm<R>x<S>mb…` · block máy
# `…thang maycuon…` đứng RIÊNG (x_xh_z5_tm_07: giếng PCCC số 8 chỉ có block này). Không phải giếng:
#   · block bao `s<N>_*` (khối chứa các giếng, đặt ở gốc);
#   · block nằm LỒNG trong một giếng đã đếm — cấp lồng sâu hơn và cách tâm giếng đó < 1.500 mm
#     (mọi block hãng `tm1400x2100` chứa sẵn một `thang maycuon` cách 1,21 m: bộ cũ đếm thành 2 → V1/V2 ra 7/6);
#   · block CHỒNG KHÍT cùng cấp (< 300 mm) — vẽ trùng (x_tmdv_y1_tm_11 có hai `x_loithangmay` tại (1250;−2690));
#   · block ngoài khung nét lõi ±3.000 mm (chi tiết hãng chèn ở toạ độ rác −149 triệu mm: L3, T2).
# Bộ cũ lọc theo "tên không có dấu cách" → bỏ sót block hãng, đúng 6/24 lõi so với số trong tên tệp; quy tắc này
# đúng 21/24, ba lõi lệch là bản vẽ lệch tên (cảnh báo, không sửa số).
RE_GIENG = re.compile(r"x_loithangmay|thang\s*t\S*ng|thang\s*m\S*y|maycuon", re.I)


def chon_gieng(blocks, khung):
    """blocks: [{n,x,y,d}] trong toa do tep loi; khung: (x0,y0,x1,y1) da noi 3.000 mm."""
    x0, y0, x1, y1 = khung
    ung = [b for b in blocks if RE_GIENG.search(b["n"]) and not RE_BAO_S.match(ten_block(b["n"]))
           and x0 <= b["x"] <= x1 and y0 <= b["y"] <= y1]
    ung.sort(key=lambda b: b.get("d", 0))
    giu = []
    for b in ung:
        db = b.get("d", 0)
        if any(k.get("d", 0) < db and math.hypot(k["x"] - b["x"], k["y"] - b["y"]) < 1500 for k in giu):
            continue
        if any(k.get("d", 0) == db and math.hypot(k["x"] - b["x"], k["y"] - b["y"]) < 300 for k in giu):
            continue
        giu.append(b)
    return giu

# ĐỔI TÊN THƯ VIỆN LÕI 1/10/2026 (data/dwg/x-thang/_QUY_TAC_TEN_FILE.md · sheet MAP_TEN
# của XREF_Thang_ChuanHoa.xlsx): x_<tmdv|xh>_<mẫu tòa>_tm_<số thang máy> · x_tb_<loại>.
# Dùng ở HAI chỗ: (1) chuyển KEY của core_geometry.json cũ sang tên mới TRƯỚC khi bóc,
# để giữ số hiệu chỉnh tay (`phong[].ma`, `so_cua_thoat_hiem` của x_tb_n3 = 2) — không
# chuyển thì mọi lõi thành "lõi mới" và mất sạch; (2) tòa còn XREF tên cũ
# (mttm_hn_u1_2200_25t_bt.dwg vẫn trỏ M:\…\Cao tang\block\x_tmkt_u1.dwg) quy về
# đúng khối thư viện hiện hành. Thêm cặp mới ở đây, KHÔNG sửa tay JSON.
TEN_CU_MOI = {
    "x_tmkt_i1": "x_tmdv_i1_tm_09", "x_tmkt_xh_i1": "x_tmdv_i1_tm_09",
    "x_tmkt_i2": "x_tmdv_i2_tm_04", "x_tmkt_l1": "x_tmdv_l1_tm_07",
    "x_tmkt_l2": "x_tmdv_l2_tm_07", "x_tmkt_l3": "x_tmdv_l3_tm_07",
    "x_tmkt_t1": "x_tmdv_t1_tm_10", "x_tmkt_t2": "x_tmdv_t2_tm_13",
    "x_tmkt_u1": "x_tmdv_u1_tm_05", "x_tmkt_v1": "x_tmdv_v1_tm_06",
    "x_tmkt_v2": "x_tmdv_v2_tm_06", "x_tmkt_y1": "x_tmdv_y1_tm_11",
    "x_tmkt_y2": "x_tmdv_y2_tm_07", "x_tmkt_z1": "x_tmdv_z1_tm_08",
    "x_tmkt_i1_noxh": "x_xh_i1_tm_03", "x_tmkt_l1.noxh": "x_xh_l1_tm_08",
    "x_tmkt_y1_noxh": "x_xh_y1_tm_07", "x_tmkt_Z1_noxh": "x_xh_z1_tm_03",
    "x_tmkt_z2_noxh": "x_xh_z2_tm_04", "x_tmkt_z3_noxh": "x_xh_z3_tm_04",
    "x_tmkt_z4_noxh": "x_xh_z4_tm_03", "x_tmkt_z5_noxh": "x_xh_z5_tm_07",
    "x_tb_n3_8500x2610": "x_tb_n3", "x_tb_n1_": "x_tb_n2",
    "x_tb_n1": "x_tb_n2",          # 1/10/2026 tối: đội CAD đổi tên, vẽ lại khung bao giống N3
}
TIEN_TO_LOI = ("x_tmkt", "x_tmdv", "x_xh_")
# Bề rộng Ô thang bộ trên dãy (mm). Tên cũ mã hoá nó (`x_tb_n3_8500x2610`), tên mới
# bỏ kích thước — giữ ĐÚNG số cũ, không lấy bao tường 3.130 (QT-1/QT-10 neo theo nó).
RONG_TB = {"x_tb_n3": 2610.0, "x_tb_n2": 2610.0}   # N2 vẽ lại bao trùng N3 (1/10/2026)


def ten_moi(n):
    return TEN_CU_MOI.get(n, n)


def ten_block(n):
    """Cat tien to XREF khoi ten block: `x_tmkt_l2$0$s1_thangmay_l2` -> `s1_thangmay_l2`.

    Bay 13 (AI_START) o dang khac: XREF da bind mang tien to `<ten>$0$`, chua bind
    thi `<ten>|`. RE_BAO_S neo dau chuoi nen khong cat tien to la TRUOT: block BAO
    `s1_thangmay_l2` cua `x_tmkt_l1.noxh` bi dem thanh mot gieng o (0 ; 0,4) -> khoang
    cach gieng toi mep khoi dL = 0 -> `coreSanh()` tuong khoi THIEU SANH -> cong oan
    3.000 mm -> QT-22 `hn_xh_l1` lech dung 3.000 mm. Do that 22/9/2026.
    """
    if "|" in n:
        n = n.rsplit("|", 1)[-1]
    if "$0$" in n:
        n = n.rsplit("$0$", 1)[-1]
    return n.strip()
RE_RAC = re.compile(r"thungrac|thung_rac", re.I)
RE_PHONG = re.compile(r"KT[\u0110DN]?$|P\.?\s*R\w*C|PCCC|P\.?\s*\u0110EM", re.I)


def boc_loi(cu):
    meta = jload(RAW / "meta_text_block.json")
    out = {}
    for f in sorted(RAW.glob("loi2_*.json")):
        d = jload(f)
        ma = d["file"][:-4]
        if ma in BO_QUA_LOI:               # khung ten / tep chu nhiem chot bo
            continue
        ox, oy = goc_tep(d["file"])
        paths, wxs, wys, axs, ays = [], [], [], [], []
        bao_tm = []
        for s in d["strokes"]:
            # MDI-BAO-TM tach rieng TRUOC: day la moc chan long thang may do doi
            # CAD tu ve (phien 17), khong phai net kien truc de hien thi - khong
            # gop vao LOP_LOI keo theo khong tinh vao bbox tuong/paths.
            if phan_loai(s["layer"], LOP_BAO_TM):
                pts = [[p[0] - ox, p[1] - oy] for p in s["pts"]]
                if s.get("c") and pts[0] != pts[-1]:
                    pts = pts + [pts[0]]
                bao_tm.append([[r(p[0]), r(p[1])] for p in pts])
                continue
            cat = phan_loai(s["layer"], LOP_LOI)
            if not cat:
                continue
            pts = [[p[0] - ox, p[1] - oy] for p in s["pts"]]
            if s.get("c") and pts[0] != pts[-1]:
                pts = pts + [pts[0]]
            paths.append({"cat": cat, "pts": [[r(p[0]), r(p[1])] for p in pts]})
            for p in pts:
                axs.append(p[0]); ays.append(p[1])
                if cat == "wall":
                    wxs.append(p[0]); wys.append(p[1])
        if not paths:
            canh_bao_chung.append("loi %s: khong boc duoc net nao" % ma)
            continue
        if not wxs:
            wxs, wys = axs, ays
        o = dict(cu.get(ma, {}))
        o["bao_tuong_mm"] = [r(min(wxs)), r(min(wys)), r(max(wxs)), r(max(wys))]
        o["rong_tuong_mm"] = r(max(wxs) - min(wxs))
        o["sau_tuong_mm"] = r(max(wys) - min(wys))
        o["paths"] = paths
        # MDI-BAO-TM (phien 17): moc chan long thang may do CAD ve rieng, thay
        # cho khung bao suy tu tuong khi co. Lay da giac LON NHAT neu nhieu net
        # (mot vai loi co ca net kep). Loi chua co layer nay thi khong ghi field,
        # app tu fallback ve bao_tuong_mm nhu truoc.
        if bao_tm:
            o["bao_tm"] = max(bao_tm, key=lambda pl: dt(pl))
        elif "bao_tm" in o:
            del o["bao_tm"]
        o["bao_mm"] = [r(min(axs)), r(min(ays)), r(max(axs)), r(max(ays))]
        o["rong_mm"] = r(max(axs) - min(axs))
        o["sau_mm"] = r(max(ays) - min(ays))
        mk = meta.get("loi|" + ma + ".dwg", {})
        blocks = [b["n"] for b in mk.get("blocks", [])]
        # TÍNH LẠI GIẾNG/PHÒNG: mặc định CHỈ lõi mới; `--tinh-lai-gieng` thì tính
        # lại CẢ lõi cũ (bỏ đóng băng). KHÔNG bật vô điều kiện — bẫy đã đo thật
        # (2026-09-16): chạy bộ bóc với dump thô CŨ (trước khi meta() cộng dồn
        # ma trận) làm giếng sạch bị nuốt hết: x_tmkt_i1 8→0, x_tmkt_z1 7→0,
        # x_tmkt_t1 9→0, PCCC thành (90.281, −56.421) — toạ độ rác họ hàng với
        # "83 triệu mm". Chỉ bật cờ này khi raw vừa được dump MỚI bằng
        # boc_cad_p16_autocad.py ĐÃ SỬA. Bẫy gốc (QT-23b): `if ma not in cu`
        # đóng băng giếng/phòng lõi cũ → x_tmkt_l3 mang 7/8 giếng toạ độ rác
        # vĩnh viễn, coreSanh() cộng oan sảnh 3.000 mm (QT-22 lệch 2.985 mm).
        if ma not in cu or TINH_LAI_GIENG:
            # `phong` cua loi CU co the da duoc HIEU CHINH TAY (ma = ky_thuat / pccc /
            # khoang_dem / thang / thang_hang..., P.DEM, KT, THANG, HANG - dump chu
            # tho khong sinh lai duoc: do that 2026-09-19 y1 5->2 phong, i1 7->6).
            # Chi tinh lai khi loi MOI hoac phong vón do may sinh (moi `ma` la None).
            phong_may = all(p.get("ma") is None for p in o.get("phong", []))
            if ma not in cu or phong_may:
                o["phong"] = [{"ma": None, "ten": t["s"].strip(),
                               "x": r(t["x"] - ox), "y": r(t["y"] - oy), "dt_m2": None}
                              for t in mk.get("texts", []) if RE_PHONG.search(t["s"].strip())]
            # meta() (da sua o boc_cad_p16_autocad.py) nay cong don ma tran
            # bien doi qua tung cap long dung - nhung van giu bien an toan
            # phong khi loi khac co truong hop tuong tu chua phat hien.
            o["so_thung_rac"] = sum(1 for b in blocks if RE_RAC.search(b))
            # giu gia tri da co (x_tb_n3 = 2 la so hieu chinh tay, khong do duoc tu CAD)
            o.setdefault("so_cua_thoat_hiem", 0)
        # QT-64 · giếng thang LUÔN đếm lại theo quy tắc hình học (không đóng băng theo lõi cũ — số cũ sai 18/24)
        if axs:
            khung = (min(axs) + ox - 3000, min(ays) + oy - 3000, max(axs) + ox + 3000, max(ays) + oy + 3000)
            gieng = chon_gieng(mk.get("blocks", []), khung)
            o["so_gieng"] = len(gieng)
            o["vi_tri_gieng"] = [[r(g["x"] - ox), r(g["y"] - oy)] for g in gieng]
            m_tm = re.search(r"_tm_(\d+)$", ma)
            if m_tm and int(m_tm.group(1)) != len(gieng):
                canh_bao_chung.append("loi %s: ve %d gieng thang may, ten tep ghi %s - doi CAD doi chieu"
                                      % (ma, len(gieng), m_tm.group(1)))
        out[ma] = o
    return out


# --------------------------- 3 . MAU TOA -----------------------------------
def ghep_hanhlang(d):
    """Phiên 17 · ghép Polyline MDI-HANHLANG (tim hành lang) với Circle đặt ĐÚNG
    tại đầu mút — mốc "kéo được" do đội CAD vẽ tay. Dung sai ghép 400 mm (circle
    bán kính danh nghĩa 200 mm + dư cho sai số vẽ tay); không khớp được circle
    nào thì đầu đó coi là KHÔNG kéo được (`keo=False`) — app giữ hành vi hiện có
    (không giới hạn theo circle) khi cả trục không ghép được, xem regenerate().
    Giữ NGUYÊN mọi đỉnh polyline (không chỉ 2 đầu) — tòa hub T/Y có đường tim
    hành lang GÃY KHÚC thật trước điểm chung, xem ghi chú trong
    boc_cad_p16_autocad.py::boc_toa(). Chỉ 2 đầu mút mới có cờ `keo`."""
    circ = d.get("hanhlang_circ", [])
    out = []
    for pl in d.get("hanhlang_ve", []):
        pts = pl.get("pts") or []
        if len(pts) < 2:
            continue
        keo = [any(math.hypot(c["x"] - p[0], c["y"] - p[1]) <= 400 for c in circ)
               for p in (pts[0], pts[-1])]
        out.append({"pts": [[r(q[0]), r(q[1])] for q in pts], "keo": keo})
    return out


def khung(deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    return (c, s), (-s, c)


def cham(p, v):
    return p[0] * v[0] + p[1] * v[1]


def snap_goc(g):
    """Lam tron goc ve boi 0,5 do roi dua ve [0,360). Xem docstring dau tep."""
    return round(round(g % 360.0 * 2) / 2.0, 1) % 360.0


def don_dinh(pts, eps=1.0):
    """Bo dinh trung va dinh gai - y het duoi `duongBao0()` trong app."""
    q = []
    for p in pts:
        if not q or abs(p[0] - q[-1][0]) > eps or abs(p[1] - q[-1][1]) > eps:
            q.append([p[0], p[1]])
    while len(q) > 2 and abs(q[0][0] - q[-1][0]) <= eps and abs(q[0][1] - q[-1][1]) <= eps:
        q.pop()
    out = []
    n = len(q)
    for i in range(n):
        a, b, c = q[(i - 1) % n], q[i], q[(i + 1) % n]
        ux, uy = b[0] - a[0], b[1] - a[1]
        vx, vy = c[0] - b[0], c[1] - b[1]
        lu, lv = math.hypot(ux, uy), math.hypot(vx, vy)
        if lu < eps or lv < eps:
            continue
        if (ux * vx + uy * vy) / (lu * lv) < -0.99999:   # gap nguoc 180 do = gai
            continue
        out.append(b)
    return out if len(out) >= 3 else q


TEN_LOAI = {"mttm": "nha_o_thuong_mai", "mtxh": "nha_o_xa_hoi"}


def ma_toa(fn):
    """mttm_hn_i1_2000_25t_bt.dwg -> hn_tm_i1 (giu dung ma app dang dung)."""
    m = re.match(r"^(mttm|mtxh)_(\w\w)_([a-z]\d)_", fn)
    if not m:
        return None
    return "%s_%s_%s" % (m.group(2), "tm" if m.group(1) == "mttm" else "xh", m.group(3))


def khop_thu_vien(bb, block, rot, thuvien):
    """Doi chieu DAU CHAN THUC VE voi khung bao cua khoi thu vien.

    XREF loi trong ban ve toa CO THE BI CAT (`hn_xh_i1` chen `x_tmkt_i1` khoi kep
    11.900x18.800 nhung phan thuc ve chi 8.665x8.530 - dung mot day). Ve theo khoi
    thu vien thi loi de len 4 can. Tim khoi nao trong thu vien co dau chan khop
    voi phan thuc ve (le <= 60 mm) roi ghi vao `ma_ve_thuc`.
    """
    if not bb:
        return None
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    if round(rot) % 180 == 90:
        w, h = h, w
    lib = thuvien.get(block)
    if lib and max(abs(lib["rong_mm"] - w), abs(lib["sau_mm"] - h)) <= 60:
        return None                      # khoi thu vien dung nguyen, khong bi cat
    tot, le = None, 1e9
    for k, v in thuvien.items():
        e = max(abs(v["rong_mm"] - w), abs(v["sau_mm"] - h))
        if e < le:
            tot, le = k, e
    if tot and tot != block and le <= 60:
        return {"bi_cat": True, "ma_ve_thuc": tot, "lech_mm": round(le, 1)}
    return {"bi_cat": True, "ma_ve_thuc": None, "lech_mm": round(le, 1)}


def boc_toa(thuvien, ma_can=()):
    bbs = jload(RAW / "toa_loi_bb.json")
    ket = []
    for f in sorted(RAW.glob("toa_*.json")):
        if f.name == "toa_loi_bb.json":
            continue
        d = jload(f)
        fn = d["file"]
        ma = ma_toa(fn)
        if not ma:
            continue
        # Ghep bb voi luot chen theo VI TRI GAN NHAT roi tieu thu, khong ghep bang
        # khoa lam tron: dump toa lam tron 3 chu so, dump bb 2 chu so, mot luot chen
        # o -39683,649 / -39683,65 ra hai khoa khac nhau (da can: mat bb cua 1 loi).
        bbdanh = [dict(b, name=ten_moi(b["name"])) for b in bbs.get(fn, [])]
        ten_cu = sorted(set(i["name"] for i in d["inserts"] if i["name"] in TEN_CU_MOI))

        # 3a . luot chen -> phan tu co (a0,a1) theo he truc cua chinh mat no
        els = []
        cb_xref = []
        for ins in d["inserts"]:
            n = ten_moi(ins["name"])
            # 3/10/2026 · `name` = ten TEP XREF tro toi (buoc 1), `block` = ten block trong ban ve. Ten block
            # sai chuan (mttm_hn_y1: `chhn_2pn_y1 8500x6000`) -> dung ten tep; nhung ten block LA ma thu vien
            # hop le ma tep khac (mttm_hn_u1: block chtm_hn_stu_m1 tro tep chxh_hn_stu_m1) -> giu ten block,
            # canh bao cho doi CAD, khong tu doi loai hinh can cua toa.
            blk = ins.get("block")
            if blk and ten_moi(blk) != n and (RE_MA.match(ten_moi(blk)) or ten_moi(blk).startswith(("x_tb", ) + TIEN_TO_LOI)):
                cb_xref.append("luot chen %s tro tep XREF %s - giu ten block, doi CAD kiem tra" % (blk, n))
                n = ten_moi(blk)
            # 3/10/2026 · QT-66: toa NOTM (`mttm_*`) dung can NOXH (`chxh_*`) la nham tep CAD (i1, l1: stu_m1; z3: 2pnp_g1)
            # -> doi sang mau NOTM cung ma + cung kich thuoc neu thu vien co; khong co thi giu va canh bao.
            if "_tm_" in ma:
                if n.startswith("chxh_"):
                    tm = "chtm_" + n[5:]
                    if tm in ma_can:
                        cb_xref.append("luot chen %s la can NOXH trong toa NOTM - doi sang %s (QT-66), doi CAD sua ban ve" % (n, tm))
                        n = tm
                    else:
                        cb_xref.append("luot chen %s la can NOXH trong toa NOTM, thu vien khong co %s - giu nguyen" % (n, tm))
            if n.startswith(("chtm_", "chxh_")):
                loai, rong = "can", float(re.search(r"x(\d+)$", n).group(1))
            elif n.startswith("x_tb"):
                m_tb = re.search(r"x(\d+)$", n)
                if n in RONG_TB:
                    rong = RONG_TB[n]
                elif m_tb:
                    rong = float(m_tb.group(1))
                else:
                    canh_bao_chung.append("toa %s: thang bo %s khong ro be rong - bo qua"
                                          % (ma, n))
                    continue
                loai = "thang_bo"
            elif n.startswith(TIEN_TO_LOI):
                loai, rong = "loi", 0.0
            else:
                continue
            g = snap_goc(ins["rot"])
            u, nn = khung(g)
            p = (ins["x"], ins["y"])
            a, t = cham(p, u), cham(p, nn)
            sx = -1.0 if ins["sx"] < 0 else 1.0
            a0, a1 = (a - rong, a) if sx < 0 else (a, a + rong)
            mm = RE_MA.match(n)
            e = {"loai": loai,
                 "ma": ("%s_%s" % (mm.group(3), mm.group(4))) if (loai == "can" and mm) else n,
                 "block": n, "ma_thu_vien": n if loai == "can" else None,
                 "a0": r(a0), "a1": r(a1), "rong_mm": r(rong),
                 "sau_mm": None if loai == "loi" else int(SAU),
                 "x": r(ins["x"]), "y": r(ins["y"]), "rot": g,
                 "sx": sx, "sy": -1.0 if ins["sy"] < 0 else 1.0}
            bb, tot, td = None, None, 1e9
            for z in bbdanh:
                if z.get("_da") or z["name"] != n:
                    continue
                dd = abs(z["x"] - ins["x"]) + abs(z["y"] - ins["y"])
                if dd < td:
                    td, tot = dd, z
            if tot is not None and td <= 1.0:
                tot["_da"] = True
                bb = tot.get("bb")
            if loai in ("loi", "thang_bo") and bb:
                e["bb_ve_mm"] = bb
                if loai == "loi":
                    kq = khop_thu_vien(bb, n, g, thuvien)
                    if kq:
                        e.update(kq)
            e["_g"], e["_t"] = g, t
            els.append(e)

        # 3b . gop mat: cung goc (da snap) + phap tuyen cach nhau <= 250 mm
        theo_goc = collections.defaultdict(list)
        for e in els:
            theo_goc[e["_g"]].append(e)
        cum = []
        for g in theo_goc:
            gr = sorted(theo_goc[g], key=lambda e: e["_t"])
            cur = [gr[0]]
            for e in gr[1:]:
                if e["_t"] - cur[-1]["_t"] <= 250:
                    cur.append(e)
                else:
                    cum.append((g, cur)); cur = [e]
            cum.append((g, cur))
        cum.sort(key=lambda c: (c[0], sum(e["_t"] for e in c[1]) / len(c[1])))

        mat = []
        for i, (g, gr) in enumerate(cum):
            truc = sum(e["_t"] for e in gr) / len(gr)
            ps = sorted([e for e in gr if e["rong_mm"] > 0], key=lambda e: e["a0"])
            src = ps if ps else gr
            a_dau = min(e["a0"] for e in src)
            a_cuoi = max(e["a1"] for e in src)
            khe, cur = [], a_dau
            for e in ps:
                if e["a0"] - cur > 1:
                    khe.append({"a0": r(cur), "a1": r(e["a0"]),
                                "rong_mm": r(e["a0"] - cur)})
                cur = max(cur, e["a1"])
            pt = sorted(gr, key=lambda e: e["a0"])
            for e in pt:
                e.pop("_g", None); e.pop("_t", None)
            mat.append({"goc_deg": g, "truc_mm": r(truc), "a_dau": r(a_dau),
                        "a_cuoi": r(a_cuoi), "phan_tu": pt, "ten": chr(65 + i),
                        "khe_ho": khe})

        # 3c . truc hanh lang = cap mat doi dau, cach 1.500-2.600 mm, co chong lan
        truc, dung = [], set()
        for i, A in enumerate(mat):
            if A["ten"] in dung:
                continue
            for j, B in enumerate(mat):
                if i == j or B["ten"] in dung:
                    continue
                if abs((B["goc_deg"] - A["goc_deg"]) % 360 - 180) > 0.6:
                    continue
                w = A["truc_mm"] + B["truc_mm"]      # b_A = t_A ; b_B = -t_B
                if not (1500 <= w <= 2600):
                    continue
                b0, b1 = -B["a_cuoi"], -B["a_dau"]   # dua mat B ve he truc cua A
                if min(A["a_cuoi"], b1) - max(A["a_dau"], b0) < 3000:
                    continue                          # khong chong lan => khong phai cap
                a0, a1 = min(A["a_dau"], b0), max(A["a_cuoi"], b1)
                truc.append({"ten": chr(65 + len(truc)), "goc_deg": A["goc_deg"],
                             "hanh_lang_mm": r(w), "mat_trai": A["ten"],
                             "mat_phai": B["ten"], "a_dau": r(a0), "a_cuoi": r(a1),
                             "dai_mm": r(a1 - a0),
                             "b_mm": r((A["truc_mm"] - B["truc_mm"]) / 2.0)})
                dung.add(A["ten"]); dung.add(B["ten"])
                break
        le = [m["ten"] for m in mat if m["ten"] not in dung
              and any(e["loai"] == "can" for e in m["phan_tu"])]

        so_ghi = None
        for t in d["texts"]:
            if re.match(r"^[\d,]+\.\d+$", t["s"].strip()):
                so_ghi = float(t["s"].replace(",", ""))

        bao = don_dinh(d["bao"][0]["pts"]) if d.get("bao") else []
        # NÉT BAO VẼ NHẦM LỚP (22/9/2026, chủ nhiệm chốt). Năm mẫu tòa mới
        # (v3 · xh_l1 · xh_z4 · xh_z5 · xh_z6) không có lớp `MDI-BAO` nào; nét bao
        # nằm trên `A-WALL-INT`. Luật HẸP và TỰ NGHIỆM THU: chỉ nhận ứng viên khi
        # diện tích shoelace khớp con số DIỆN TÍCH người vẽ ghi trên bản vẽ
        # (nguồn chân lý số 1, AI_START §5) trong 0,1 m² — và chỉ khi ĐÚNG MỘT ứng
        # viên khớp. Đặt nhầm polyline khác không lọt được, vì chính con số ấy là
        # phép thử; cũng là ngưỡng của QT-54. Luôn ghi cảnh báo, không im lặng.
        nham_lop = None
        if not bao and so_ghi:
            kh = [(u, don_dinh(u["pts"])) for u in d.get("bao_ungvien", [])]
            kh = [(u, p) for u, p in kh if abs(dt(p) - so_ghi) <= 0.1]
            if len(kh) == 1:
                nham_lop = kh[0][0]["layer"]
                bao = kh[0][1]
        # CIRCLE ĐIỂM KÉO LẠC NGOÀI TÒA (1/10/2026): i1 · i2 · i3 cùng có một Circle
        # MDI-HANHLANG ở ĐÚNG (107.769,7 ; 1.896,8) — dấu vết chép bản vẽ — cách tòa
        # ~50 m; l1 có một ở (148.739,9 ; −39.451,6). Điểm kéo đầu hành lang nằm ngoài
        # khung bao nét bao là vô nghĩa về hình học, và làm QT-54 (số điểm kéo = số
        # Circle) lệch. Bỏ Circle ngoài khung bao nét bao + 3 m, CÓ cảnh báo.
        lac = []
        if bao:
            bx0, bx1 = min(p[0] for p in bao) - 3000, max(p[0] for p in bao) + 3000
            by0, by1 = min(p[1] for p in bao) - 3000, max(p[1] for p in bao) + 3000
            giu = []
            for c in d.get("hanhlang_circ", []):
                (giu if bx0 <= c["x"] <= bx1 and by0 <= c["y"] <= by1 else lac).append(c)
            d["hanhlang_circ"] = giu
        ten_bv = None
        for t in d["texts"]:
            if "MAT BANG" in t["s"].upper() or "\u1eb6T B\u1eb0NG" in t["s"].upper():
                ten_bv = t["s"]
        cans = [e for m in mat for e in m["phan_tu"] if e["loai"] == "can"]
        cbao = sorted(set(cb_xref))
        if nham_lop:
            cbao.append("net bao ve nham lop: lay tu '%s' (khong co MDI-BAO); "
                        "dien tich khop so ghi tren ban ve %.2f m2 - doi CAD nen "
                        "chuyen polyline sang lop MDI-BAO" % (nham_lop, so_ghi))
        if not bao:
            cbao.append("KHONG CO NET BAO: thieu polyline MDI-BAO va khong ung vien "
                        "nao khop so ghi tren ban ve - DTXD khong tin duoc")
        if ten_cu:
            cbao.append("XREF con ten CU (truoc 1/10/2026): %s - app da quy ve %s; doi CAD "
                        "nen repath ve ..\\x-thang\\<ten moi>.dwg"
                        % (", ".join(ten_cu), ", ".join(ten_moi(x) for x in ten_cu)))
        if d.get("xref_hong"):
            cbao.append("XREF khong giai duoc: " + ", ".join(d["xref_hong"]))
        if lac:
            cbao.append("bo %d Circle MDI-HANHLANG nam ngoai toa: %s - doi CAD nen xoa"
                        % (len(lac), ", ".join("(%.1f; %.1f)" % (c["x"], c["y"]) for c in lac)))
        if le:
            cbao.append("mat khong ghep duoc thanh truc hanh lang: " + ", ".join(le))
        # Sai so cua CHINH BAN VE - App khong nan duoc, phai sua o CAD.
        # QT-1 cho dung sai 2 mm giua o dat va diem chen; hai nguon lam vo nguong:
        #   · luot chen ve o 89,9 / 180,1 / 270,1 do thay vi boi so 90
        #   · cac luot chen tren CUNG mot mat nam tren nhung duong cach nhau vai mm
        xien = sorted(set(round(i["rot"] % 360, 2) for i in d["inserts"]
                          if i["name"].startswith(("chtm_", "chxh_", "x_tb") + TIEN_TO_LOI)
                          and abs((i["rot"] % 30) - 0) > 0.02
                          and abs((i["rot"] % 30) - 30) > 0.02))
        if xien:
            cbao.append("goc chen khong tron: " + ", ".join("%g deg" % v for v in xien))
        # Khe ho GIUA HAI CAN. Khe 340-370 mm canh thang bo la binh thuong (QT-10 hut
        # vao o thang). Khe khac the la hai can dat cach nhau - bo thu pha hoai bat.
        for m in mat:
            hep = sorted(set(round(k["rong_mm"]) for k in m["khe_ho"]
                             if 60 < k["rong_mm"] < 300))
            if hep:
                cbao.append("mat %s: khe ho giua hai can %s mm"
                            % (m["ten"], ", ".join(str(v) for v in hep)))
        for m in mat:
            u, nn = khung(m["goc_deg"])
            # chi xet CAN: thang bo / loi von chen lech vao trong theo thiet ke
            vs = [q["x"] * nn[0] + q["y"] * nn[1] for q in m["phan_tu"]
                  if q["loai"] == "can"]
            if vs and max(vs) - min(vs) > 2:
                cbao.append("mat %s: cac luot chen lech %.0f mm khoi mot duong"
                            % (m["ten"], max(vs) - min(vs)))
        if so_ghi and abs(so_ghi - dt(bao)) > 0.5:
            cbao.append("DTXD ghi tren ban ve %.2f lech net bao %.2f" % (so_ghi, dt(bao)))

        ket.append({
            "ma": ma, "file": fn, "loai_hinh": TEN_LOAI[fn[:4]], "ten_ban_ve": ten_bv,
            "dtxd_ghi_tren_ban_ve_m2": round(so_ghi if so_ghi else dt(bao), 2),
            "so_can_tang": len(cans),
            "dt_khoi_can_m2": round(sum(e["rong_mm"] for e in cans) * SAU / 1e6, 1),
            "sau_can_pho_bien_mm": int(SAU),
            "co_cau_can": dict(collections.Counter(e["ma"] for e in cans)),
            "so_loi_dwg": sum(1 for m in mat for e in m["phan_tu"] if e["loai"] == "loi"),
            "so_thang_bo_dwg": sum(1 for m in mat for e in m["phan_tu"]
                                   if e["loai"] == "thang_bo"),
            "ten_block_loi": sorted(set(e["block"] for m in mat for e in m["phan_tu"]
                                        if e["loai"] == "loi")),
            "hanh_lang_mm": r(sum(t["hanh_lang_mm"] for t in truc) / len(truc)) if truc else 1800.0,
            "spine_tong_mm": r(sum(t["dai_mm"] for t in truc)),
            "dt_duong_bao_m2": round(dt(bao), 1),
            "duong_bao": [[r(p[0]), r(p[1])] for p in bao],
            "truc": truc, "mat": mat, "canh_bao_boc": cbao,
            "hanhlang_ve": [[[r(p[0]), r(p[1])] for p in pl["pts"]]
                            for pl in d.get("hanhlang_ve", [])],
            "hanhlang_truc": ghep_hanhlang(d),
            # TOAN BO Circle "diem keo" cua lop MDI-HANHLANG, khong qua ghep polyline:
            # so Circle = so diem keo cua tung toa (do 2026-09-19, 17/17 toa khop
            # `keo`), va hn_xh_i1 chi co Circle, khong co polyline tim -> hanhlang_truc
            # rong, mat het thong tin. Day la NGUON CHAN LY so + vi tri diem keo.
            "hanhlang_moc": [[r(c["x"]), r(c["y"])] for c in d.get("hanhlang_circ", [])],
        })
    return ket


def giu_loi_cu(toa, cu_toa):
    """Tòa có bản vẽ MẤT XREF lõi/thang bộ (bị bind/nổ thành block thường) -> giữ
    phần tử lõi/thang của LẦN BÓC TRƯỚC, đổi sang tên thư viện mới, gắn cảnh báo.

    Gặp thật 1/10/2026: `mttm_hn_u3_2000_25t_bt.dwg` không còn lượt chèn `x_tmkt_u1`
    / `x_tb_n3*` nào — thay bằng block `regregrg444` ×2 (rộng 2,8 m, gốc ở x ≈ ±1,7
    triệu mm) và `thangbo` ×3. Đo khung bao thật trong AutoCAD: 3 `thangbo` trùng 3
    thang bộ cũ (≤ 25 mm), 2 `regregrg444` nằm ĐÚNG mút ngoài 2 lõi `x_tmkt_u1` cũ
    (37.427 / 90.607, lệch ≤ 1 mm); nét bao và trục y nguyên. Không có cách đọc lại
    lõi từ block đã nổ, nên giữ số cũ CÓ TUYÊN BỐ — đội CAD phải chèn lại XREF.
    Chỉ ghép khi mặt khớp (cùng tên, góc, trục ±1 mm) và tập a0 của căn không đổi.
    """
    cum = {t["ma"]: t for t in cu_toa}
    for t in toa:
        o = cum.get(t["ma"])
        if t["so_loi_dwg"] or not o or not o.get("so_loi_dwg"):
            continue
        om = {m["ten"]: m for m in o["mat"]}
        khop = all(m["ten"] in om and om[m["ten"]]["goc_deg"] == m["goc_deg"]
                   and abs(om[m["ten"]]["truc_mm"] - m["truc_mm"]) <= 1
                   and sorted(e["a0"] for e in m["phan_tu"] if e["loai"] == "can")
                   == sorted(e["a0"] for e in om[m["ten"]]["phan_tu"] if e["loai"] == "can")
                   for m in t["mat"])
        if not khop:
            t["canh_bao_boc"].append("MAT XREF loi/thang bo va bo cuc can da doi - KHONG "
                                     "giu duoc loi cu; toa nay khong co loi")
            continue
        for m in t["mat"]:
            cu = []
            for e in om[m["ten"]]["phan_tu"]:
                if e["loai"] in ("loi", "thang_bo"):
                    e = dict(e, block=ten_moi(e["block"]), ma=ten_moi(e["ma"]))
                    cu.append(e)
            m["phan_tu"] = sorted([e for e in m["phan_tu"] if e["loai"] == "can"] + cu,
                                  key=lambda e: e["a0"])
            m["khe_ho"] = om[m["ten"]]["khe_ho"]
            m["a_dau"], m["a_cuoi"] = om[m["ten"]]["a_dau"], om[m["ten"]]["a_cuoi"]
        pt = [e for m in t["mat"] for e in m["phan_tu"]]
        t["so_loi_dwg"] = sum(1 for e in pt if e["loai"] == "loi")
        t["so_thang_bo_dwg"] = sum(1 for e in pt if e["loai"] == "thang_bo")
        t["ten_block_loi"] = sorted(set(e["block"] for e in pt if e["loai"] == "loi"))
        t["canh_bao_boc"].append(
            "BAN VE MAT XREF loi/thang bo (da bind thanh block thuong) - GIU %d loi + %d "
            "thang bo cua lan boc truoc (%s); doi CAD can chen lai XREF ..\\x-thang\\"
            % (t["so_loi_dwg"], t["so_thang_bo_dwg"], ", ".join(t["ten_block_loi"])))


# --------------------------- 4 . towers.json -------------------------------
def dung_towers(toa, cu):
    cum = {x["ma"]: x for x in cu}
    out = []
    for t in toa:
        o = dict(cum.get(t["ma"], {}))
        o["ma"] = t["ma"]
        o.setdefault("ten", t["ma"])
        o["loai_hinh"] = t["loai_hinh"]
        o.setdefault("khu_vuc", "hn")
        o["sau_can_mm"] = int(SAU)
        o["hanh_lang_mm"] = t["hanh_lang_mm"]
        canh = []
        for a in t["truc"]:
            u, n = khung(a["goc_deg"])
            b = a["b_mm"]
            canh.append({"ten": a["ten"], "goc_deg": a["goc_deg"], "dai_mm": a["dai_mm"],
                         "goc_x": r(a["a_dau"] * u[0] + b * n[0]),
                         "goc_y": r(a["a_dau"] * u[1] + b * n[1])})
        o["canh"] = canh
        o["noi"] = o.get("noi", [])
        loi = []
        for m in t["mat"]:
            for e in m["phan_tu"]:
                if e["loai"] not in ("loi", "thang_bo"):
                    continue
                bb = e.get("bb_ve_mm")
                stt = 1 + sum(1 for z in loi if z["loai"] == e["loai"])
                loi.append({
                    "ten": ("TB-%d" if e["loai"] == "thang_bo" else "LOI-%d") % stt,
                    "loai": e["loai"], "canh": m["ten"], "mat": m["ten"],
                    "offset_mm": r(e["a0"] - m["a_dau"]),
                    "dai_mm": r((bb[2] - bb[0]) if bb else e["rong_mm"]),
                    "sau_mm": r((bb[3] - bb[1]) if bb else SAU),
                    "nguon": "dwg", "block_dwg": e["block"],
                    "chen_sx": e["sx"], "chen_sy": e["sy"], "chen_rot": e["rot"],
                    "bb_ve_mm": bb})
        o["loi"] = loi
        o["spine_tong_mm"] = t["spine_tong_mm"]
        o["nguon_dwg"] = t["file"]
        o["dtxd_do_duoc_m2"] = t["dt_duong_bao_m2"]
        o["dtxd_ghi_tren_ban_ve_m2"] = t["dtxd_ghi_tren_ban_ve_m2"]
        o["co_cau_can_dwg"] = t["co_cau_can"]
        o["canh_bao_boc"] = t["canh_bao_boc"]
        o["thang_bo_vi_tri"] = [
            {"ten": z["ten"], "canh": z["canh"], "offset_mm": z["offset_mm"],
             "rong_mm": z["dai_mm"], "sau_mm": z["sau_mm"], "ben": "trai",
             "loai_buong_thang_dwg": "N3"} for z in loi if z["loai"] == "thang_bo"]
        o["tham_chieu"] = {"so_can_tang_dien_hinh": t["so_can_tang"],
                           "dtxd_tang_dien_hinh_m2": t["dt_duong_bao_m2"],
                           "nguon": "boc tu %s bang scripts/boc_cad_p16.py" % t["file"],
                           "ngay_boc": "2026-09-10"}
        o["nguon_hinh_hoc"] = "dwg"
        out.append(o)
    return out


# --------------------------- chay ------------------------------------------
def main():
    geo_can, do_can = boc_can()
    jdump(MASTER / "unit_geometry.json", geo_can)
    ma_can = set(geo_can)

    units = jload(MASTER / "units.json")
    co = {u["ma"]: u for u in units}
    for ma in sorted(do_can):
        m = do_can[ma]
        if ma in co:                       # giu so dang ky (nguon chan ly #1)
            co[ma]["dt_tim_do_cad_m2"] = m["dt_tim_do_m2"]
            if m.get("logia_lui"):
                co[ma]["logia_lui"] = m["logia_lui"]
            else:
                co[ma].pop("logia_lui", None)
            continue
        g = RE_MA.match(ma)
        loai, vt = g.group(3), g.group(4)
        tt = m["dt_tt_do_m2"] or round(m["dt_tim_do_m2"] * 0.9214, 2)
        co[ma] = {
            "ma": ma, "file_dwg": ma + ".dwg",
            "loai_hinh": "nha_o_thuong_mai" if g.group(1) == "chtm" else "nha_o_xa_hoi",
            "khu_vuc": g.group(2), "loai_can": loai,
            "nhom": loai.upper().replace("PNP", "PN+"),
            "vi_tri": "giua" if vt[0] == "m" else "goc", "vi_tri_ma": vt,
            "rong_mm": int(float(g.group(5))), "dai_mm": int(m["dai_mm"]),
            "so_phong_ngu": 0 if loai == "stu" else int(loai[0]),
            "so_phong_o": 1 if loai == "stu" else int(loai[0]) + 1,
            "loaican_tag": ma, "loaican_tag_lech": False,
            "dt_tim_m2": m["dt_tim_do_m2"], "dt_tt_m2": tt, "dtsd_m2": tt,
            "he_so_tim_tt": round(m["dt_tim_do_m2"] / tt, 4) if tt else None,
            "registry_sheet": None,
            "registry_ghi_chu": "chua co trong XREF_CanHo_BT_ChuanHoa.xlsx - "
                                "dien tich do tu .dwg (lop A-AREA-WALL-CENTER)",
            "dt_bao_m2": round(m["dai_mm"] * SAU / 1e6, 1),
            "hs_tim_tren_bao": round(m["dt_tim_do_m2"] / (m["dai_mm"] * SAU / 1e6), 4),
            "so_wc": 1 if loai in ("stu", "1pn", "1pnp") else 2,
            "nguon_so_wc": "suy_dien_theo_loai_can",
            **({"nguon_dt_tim": "chua_doi_chieu: ranh tim tuong ve nham lop %s"
                % m["tim_nham_lop"]} if m.get("tim_nham_lop") else {}),
            **({"logia_lui": m["logia_lui"]} if m.get("logia_lui") else {}),
        }
    units = [co[k] for k in sorted(co)]
    jdump(MASTER / "units.json", units)

    # dau van tay cua tung tep .dwg da boc - de lan sau biet mau nao da doi
    import hashlib
    dwg = ROOT / "data" / "dwg" / "x-canho-bt"
    tt = {}
    for ma in sorted(do_can):
        p = dwg / (ma + ".dwg")
        if p.is_file():
            tt[ma] = hashlib.sha256(p.read_bytes()).hexdigest()
    jdump(MASTER / "trang_thai_boc_can.json", tt)

    cu_loi = {}
    for k, v in jload(MASTER / "core_geometry.json").items():
        k2 = ten_moi(k)
        if k2 in cu_loi:                   # x_tmkt_xh_i1 trùng x_tmkt_i1 -> giữ bản đã có
            continue
        cu_loi[k2] = v
    cores = boc_loi(cu_loi)
    mat_loi = sorted(set(cu_loi) - set(cores))
    if mat_loi:
        canh_bao_chung.append("loi CO trong core_geometry cu nhung KHONG con trong thu "
                              "vien x-thang: " + ", ".join(mat_loi))
    jdump(MASTER / "core_geometry.json", cores)

    cu_toa = jload(MASTER / "toa_dwg.json")
    toa = boc_toa(cores, ma_can)
    giu_loi_cu(toa, cu_toa)
    jdump(MASTER / "toa_dwg.json", toa)
    jdump(MASTER / "towers.json", dung_towers(toa, jload(MASTER / "towers.json")))

    print("can      : %d mau hinh hoc, %d dong dang ky" % (len(geo_can), len(units)))
    print("loi      : %d mau" % len(cores))
    print("mau toa  : %d" % len(toa))
    for t in toa:
        print("  %-12s can=%2d mat=%d truc=%d bao=%2d dinh  DTXD %8.2f  %s"
              % (t["ma"], t["so_can_tang"], len(t["mat"]), len(t["truc"]),
                 len(t["duong_bao"]), t["dtxd_ghi_tren_ban_ve_m2"],
                 "; ".join(t["canh_bao_boc"])))
    for c in canh_bao_chung:
        print("  ! " + c)


if __name__ == "__main__":
    main()
