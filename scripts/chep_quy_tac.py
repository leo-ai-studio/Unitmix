"""Sinh web/public/lib/quy_tac.json — bộ quy tắc xếp căn + kiểm tra QCVN/PCCC lấy từ app cũ MDI_Unitmix_v4.

Nguồn (chỉ ĐỌC): rules/*.yaml (luật đang chạy trong panel Tuân thủ) và docs/QUY_TAC_XEP_CAN.md (QT-xx).
Biểu thức JS trong yaml KHÔNG chép: mỗi luật thành ngưỡng số + mã kiểm tra có tên (`ma_kiem`), cách tính ghi ở `cach_tinh`.
Ngưỡng, điều khoản giữ nguyên app cũ. QT đã bị thay / trùng / chỉ dành cho giao diện app cũ được ghi vào `qt_goc` kèm lý do.

    python scripts/chep_quy_tac.py --nguon E:\\Projects\\MDI_Unitmix_v4
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import yaml

GOC = Path(__file__).resolve().parents[1]
LIB = GOC / "web" / "public" / "lib"

BUOC = [
    {"ma": "lo_qh", "tien_to": "LO", "ten_vi": "Lô / quy hoạch", "ten_en": "Lot / zoning"},
    {"ma": "chon_mau_toa", "tien_to": "MT", "ten_vi": "Chọn mẫu tòa", "ten_en": "Tower template"},
    {"ma": "xep_day_can", "tien_to": "XC", "ten_vi": "Xếp dãy căn", "ten_en": "Unit rows"},
    {"ma": "doi_mau_can", "tien_to": "DC", "ten_vi": "Đổi mẫu căn", "ten_en": "Unit swap"},
    {"ma": "pccc", "tien_to": "PC", "ten_vi": "PCCC / thoát nạn", "ten_en": "Fire safety / egress"},
    {"ma": "ham", "tien_to": "HA", "ten_vi": "Hầm", "ten_en": "Basement"},
    {"ma": "chi_tieu", "tien_to": "CT", "ten_vi": "Chỉ tiêu", "ten_en": "Planning indicators"},
]

# Bảng QCVN 01:2021 chép từ app cũ (shell.src.html: QC01, luiBang27, kcToa261) — số chép từ văn bản (QT-82).
BANG_29_212 = {
    "dt_lo_m2": [3000, 10000, 18000, 35000],
    "cao_m": [16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46, ">46"],
}
BANG_29 = [[75, 65, 63, 60], [75, 60, 58, 55], [75, 57, 55, 52], [75, 53, 51, 48], [75, 50, 48, 45], [75, 48, 46, 43],
           [75, 46, 44, 41], [75, 44, 42, 39], [75, 43, 41, 38], [75, 42, 40, 37], [75, 41, 39, 36], [75, 40, 38, 35]]
BANG_212 = [[4, 3.5, 3.4, 3.25], [4.8, 3.9, 3.78, 3.6], [5.6, 4.34, 4.2, 3.99], [6.4, 4.64, 4.48, 4.24], [7.2, 4.95, 4.77, 4.5],
            [8, 5.3, 5.1, 4.8], [8.8, 5.61, 5.39, 5.06], [9.6, 5.88, 5.64, 5.28], [10.4, 6.24, 5.98, 5.59],
            [11.2, 6.58, 6.3, 5.88], [12, 6.9, 6.6, 6.15], [12.8, 7.2, 6.88, 6.4]]


def N(gia_tri, don_vi, dieu_kien=None, chieu="<="):
    d = {"gia_tri": gia_tri, "don_vi": don_vi, "chieu": chieu}
    if dieu_kien:
        d["dieu_kien"] = dieu_kien
    return d


# ---------------------------------------------------------------------------------------------------------------------------
# Luật giữ lại. Thứ tự trong mỗi bước: bắt buộc (QCVN / QĐ) trước, nội bộ MDI sau. `yaml` = id luật trong rules/*.yaml (nếu có).
# `ham` = hàm app mới đã làm (null = chưa có).
# ---------------------------------------------------------------------------------------------------------------------------
LUAT = [
    # ---------------- Lô / QH ----------------
    dict(id="qcvn01_lui_bang27", buoc="lo_qh", nhom="qcvn01", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Khoảng lùi công trình theo lộ giới × chiều cao", ten_en="Setback by road width × height",
         nguon="QCVN 01:2021/BXD §2.6.2 · Bảng 2.7",
         nguong=[N(0, "m", "H < 19 m"), N(3, "m", "đường < 19 m · H 19–22 m"), N(4, "m", "đường < 19 m · H 22–28 m"),
                 N(6, "m", "H ≥ 28 m (mọi bề rộng đường)"), N(3, "m", "đường 19–22 m · H 22–28 m")],
         bang={"ten": "Bảng 2.7 (m)", "cot_cao_m": ["<19", "19–22", "22–28", "≥28"],
               "hang_duong_m": {"<19": [0, 3, 4, 6], "19–22": [0, 0, 3, 6], "≥22": [0, 0, 0, 6]}},
         ma_kiem="lui_canh_lo", cach_tinh="cạnh giáp đường lùi max(Bảng 2.7 theo lộ giới, khoảng lùi QH của lô); cạnh giáp lô khác lùi theo lô (mặc định 0); thiếu dữ liệu cạnh thì áp mọi cạnh",
         ma_cu=["QT-82", "QT-118"], ham=None),
    dict(id="qcvn01_khoang_cach_261", buoc="lo_qh", nhom="qcvn01", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Khoảng cách giữa các tòa (cả nhà hiện hữu)", ten_en="Distance between buildings",
         nguon="QCVN 01:2021/BXD §2.6.1",
         nguong=[N("max(H/2, 7)", "m", "H < 46 m · cạnh dài", ">="), N("max(H/3, 4)", "m", "H < 46 m · đầu hồi", ">="),
                 N(25, "m", "H ≥ 46 m · cạnh dài", ">="), N(15, "m", "H ≥ 46 m · đầu hồi", ">=")],
         ma_kiem="kc_toa_261", cach_tinh="lấy theo công trình cao hơn; dưới mức đầu hồi = vượt, giữa hai mức = cảnh báo; nhà hiện hữu xét trong 60 m, nhà trong lô xây chung cư (sẽ giải toả) không tính",
         ma_cu=["QT-82", "QT-89"], ham=None),
    dict(id="mdi_loai_dat", buoc="lo_qh", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Loại đất theo ký hiệu lô · chỉ lô ở mới đặt chung cư", ten_en="Land use from lot code",
         nguon="MDI · QT-82", nguong=[],
         ma_kiem="loai_dat_lo", cach_tinh="NXH/NOXH → nhà ở xã hội, CT → chung cư, HH → hỗn hợp (xây căn hộ); GD, CC, CX, LK, BT, DMKT… không đặt chung cư. Ranh lô = polyline kín có DT khớp số ghi ±3 %, không khớp thì không đoán",
         ma_cu=["QT-82"], ham="sucChua.ts · sucChua (lô không phải đất ở → không ước số căn)"),
    dict(id="mdi_chi_tieu_mot_nguon", buoc="lo_qh", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Chỉ tiêu một nguồn: dự án + lô", ten_en="Single source of indicators",
         nguon="MDI · QT-107", nguong=[],
         ma_kiem="chi_tieu_hai_cap", cach_tinh="hai cấp: DỰ ÁN (cơ cấu KD, tỉnh, trần dân số / số căn cả dự án) và LÔ (DT, MĐXD, tầng, tuỳ chọn HSSDĐ, dân số, số căn); lô ghi đè dự án",
         ma_cu=["QT-107"], ham=None),
    dict(id="mdi_khoa_cgxd", buoc="lo_qh", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Tòa không ra khỏi chỉ giới xây dựng khi dời / xoay", ten_en="Tower kept inside building line",
         nguon="MDI · QT-118 R3", nguong=[],
         ma_kiem="trong_cgxd", cach_tinh="mọi thao tác dời / xoay / lật bị trả lại nếu tòa ra khỏi CGXD, trừ khi tòa vốn đã thiếu lùi và thao tác không làm tệ hơn",
         ma_cu=["QT-118"], ham="hopLo.ts · hopLo / vungDat (chân tòa nằm trong chỉ giới)"),
    dict(id="mdi_bong_do", buoc="lo_qh", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Bóng đổ lên lô bên cạnh / nhà hiện hữu", ten_en="Shadow on neighbours",
         nguon="MDI · QT-84 · QT-89", nguong=[N("8–16", "giờ", "ngày đông chí")],
         ma_kiem="bong_do", cach_tinh="giao bóng từng giờ với chân nhà: DT bóng lớn nhất, % chân nhà, số giờ bị che (chỉ đánh giá, không chặn)",
         ma_cu=["QT-84", "QT-89"], ham=None),

    # ---------------- Chọn mẫu tòa ----------------
    dict(id="mdi_dong_san_pham", buoc="chon_mau_toa", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Mẫu tòa đúng dòng sản phẩm của lô", ten_en="Template matches product line",
         nguon="MDI · QT-82 (tối ưu lô) · QT-86", nguong=[],
         ma_kiem="dong_san_pham", cach_tinh="lô NOXH chỉ dùng mẫu xh, lô thương mại chỉ mẫu tm; số tầng = trần tầng của lô",
         ma_cu=["QT-82", "QT-86"], ham=None),
    dict(id="mdi_hanh_lang", buoc="chon_mau_toa", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Bề rộng hành lang mặc định theo loại hình", ten_en="Default corridor width",
         nguon="MDI · QT-16 · QT-5", nguong=[N(1800, "mm", "tm", "="), N(1600, "mm", "xh / tái định cư", "=")],
         ma_kiem="hanh_lang_mac_dinh", cach_tinh="đổi được; đổi bề rộng thì DTXD đổi (bề rộng mới − bản vẽ) × tổng chiều dài trục; chiều sâu dãy căn luôn 8.500 mm tính từ mép hành lang",
         ma_cu=["QT-16", "QT-5"], ham=None),
    dict(id="mdi_eff", buoc="chon_mau_toa", nhom="mdi", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Hiệu suất mặt bằng", ten_en="Plan efficiency",
         nguon="MDI target ≥75 % · 7 yếu tố slide 3 PPTX", nguong=[N(0.75, "tỉ lệ", None, ">=")],
         ma_kiem="hieu_suat", cach_tinh="Σ DT thông thủy căn một tầng / DTXD (nét bao); dưới 75 % = cảnh báo",
         ma_cu=["mdi_eff"], yaml="mdi_eff", ham=None),
    dict(id="mdi_thay_loi", buoc="chon_mau_toa", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Thay lõi thang đúng loại hình, đúng mẫu", ten_en="Core swap rules",
         nguon="MDI · QT-71 · QT-72 · QT-74 · QT-90", nguong=[N(2800, "mm", "bề rộng sảnh phân loại: ≥ 2.800 NOTM (3,0 m), < 2.800 NOXH (2,6 m)", ">=")],
         ma_kiem="thay_loi", cach_tinh="tòa I · Z · L: lõi cùng dạng + cùng loại hình; T · U · V · Y: chỉ lõi cùng mẫu; ô chừa lõi co/giãn theo dấu chân mới, căn dồn khít; lắp không vừa thì từ chối",
         ma_cu=["QT-71", "QT-72", "QT-72b", "QT-74", "QT-74b", "QT-90"], ham=None),
    dict(id="mdi_lap_pa", buoc="chon_mau_toa", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Lập PA: vét mẫu tòa × cách xếp, chấm bằng chính bộ kiểm tra", ten_en="Generate options by exhaustive search",
         nguon="MDI · QT-67 · QT-68 · QT-96", nguong=[],
         ma_kiem="lap_pa", cach_tinh="giữ số tầng theo QH, không thêm thang bộ; xếp hạng theo số lỗi QCVN trước, rồi hiệu suất / cơ cấu",
         ma_cu=["QT-67", "QT-68", "QT-96"], ham=None),
    dict(id="mdi_huong_can", buoc="chon_mau_toa", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Chấm hướng căn, căn góc, điểm view", ten_en="Orientation and view score",
         nguon="MDI · QT-88 · QT-111", nguong=[N(40, "%", "trọng số hướng", "="), N(30, "%", "thoáng", "="), N(20, "%", "cảnh quan", "="), N(10, "%", "nắng", "=")],
         ma_kiem="huong_view", cach_tinh="góc lệch Bắc = −góc xoay tòa; điểm 0–100 = Σ wᵢ·thành phầnᵢ / Σ wᵢ",
         ma_cu=["QT-88", "QT-88b", "QT-111"], ham=None),

    # ---------------- Xếp dãy căn ----------------
    dict(id="mdi_diem_chen", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Vị trí căn / lõi / thang = điểm chèn XREF của bản vẽ", ten_en="Positions follow drawing inserts",
         nguon="MDI · QT-1 · QT-6 · QT-7", nguong=[N(2, "mm", "dung sai vị trí căn")],
         ma_kiem="diem_chen", cach_tinh="bước đặt lấy rong_mm của bản vẽ (không lấy bề rộng thư viện); sx = −1 là lật gương (điểm chèn ở a1); lõi / thang neo điểm chèn, không neo góc ô; chồng ≤ 20 mm gộp vào ô trước, chồng > 20 mm trừ vào chính ô (QT-60)",
         ma_cu=["QT-1", "QT-6", "QT-7", "QT-60"], ham="pccc.ts · cuaTrenMat (đọc a0/a1/sx của phan_tu)"),
    dict(id="mdi_khe", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Phân loại khe trên dãy căn", ten_en="Gap classification",
         nguon="MDI · QT-2 · QT-9 · QT-21 · QT-32",
         nguong=[N(20, "mm", "khe giữ lại khi > 20 mm", ">"), N(400, "mm", "khe ≤ 400 = tường"), N(600, "mm", "400–600 = khe kỹ thuật"),
                 N("căn rộng nhất + 500", "mm", "khe rộng hơn = hành lang chạy qua", ">")],
         ma_kiem="loai_khe", cach_tinh="khe cách trục hành lang > 1 bay = khoảng trống giữa hai cánh (void); khe trong dấu chân lõi / thang / căn mặt khác = không phải chỗ trống; khe người dùng tạo luôn là “Còn trống”",
         ma_cu=["QT-2", "QT-9", "QT-21", "QT-32"], ham=None),
    dict(id="mdi_o_thang_bo", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Ô thang bộ rộng 3.000 mm, căn xếp khít vào", ten_en="Stair slot 3,000 mm",
         nguon="MDI · QT-10 · QT-60", nguong=[N(3000, "mm", None, "="), N(600, "mm", "khe hai bên được hút vào ô thang")],
         ma_kiem="o_thang_3000", cach_tinh="ô thang hút khe ≤ 600 mm hai bên; bản vẽ chừa thiếu thì nới đủ 3.000, các ô phía sau dồn theo, mặt dài ra (DTXD theo)",
         ma_cu=["QT-10", "QT-60"], ham=None),
    dict(id="mdi_don_khit", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Sửa căn thì dồn khít về lõi thang máy và mốc góc", ten_en="Compaction toward core and corners",
         nguon="MDI · QT-30 · QT-49 · QT-69", nguong=[],
         ma_kiem="don_khit", cach_tinh="xoá / thêm / thay / kéo–thả / đổi chỗ đều dồn khít; mốc cứng = lõi thang máy + góc cánh (đầu mặt cách điểm nối trục hành lang ≤ 6.000 mm); thang bộ dồn như căn hộ (không còn là mốc); dồn theo từng cụm cục bộ; chỉ đầu TỰ DO được co/giãn, đầu kẹt (1,5 m ngoài đầu dãy rơi vào ô dãy khác) không bao giờ co/giãn; kéo đi kéo về phải về đúng chỗ cũ",
         ma_cu=["QT-30", "QT-8", "QT-46", "QT-46b", "QT-48", "QT-49", "QT-49b", "QT-49c", "QT-56b", "QT-57c", "QT-62", "QT-69"], ham=None),
    dict(id="mdi_khit_loi", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Căn quanh lõi khít nét bao lõi MDI-BAO-TM như CAD", ten_en="Units fit the core outline",
         nguon="MDI · QT-22 · QT-22b · QT-47 · QT-56", nguong=[],
         ma_kiem="khit_loi", cach_tinh="dấu chân lõi lấy từ bản vẽ tòa (XREF có thể bị cắt) và khung MDI-BAO-TM là chuẩn; không tự dời căn chừa lõi; căn đè lõi thì báo, không tự xoá; lõi hub T/Y không chừa khe riêng",
         ma_cu=["QT-22", "QT-22b", "QT-47", "QT-56", "QT-36"], ham=None),
    dict(id="mdi_sanh_tm", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Sảnh thang máy: NOTM 3,0 m · NOXH 2,6 m, căn dồn khít, hành lang qua tim sảnh", ten_en="Lift lobby width",
         nguon="MDI · QT-72 (thay QT-23)", nguong=[N(3000, "mm", "tm", "="), N(2600, "mm", "xh / tái định cư", "=")],
         ma_kiem="sanh_tm", cach_tinh="sảnh = dải trống xuyên hết chiều sâu khối lõi, rộng ≥ 1.000 mm rộng nhất; nét hành lang chạy qua tim sảnh, đổi lõi thì dời theo",
         ma_cu=["QT-72", "QT-23"], ham=None),
    dict(id="mdi_noi_hanh_lang", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Hành lang nối liền các thanh, đi qua góc, vuông góc", ten_en="Corridor network through corners",
         nguon="MDI · QT-19 · QT-25 · QT-51 · QT-54", nguong=[N(400, "mm", "gộp nút đồ thị"), N(16000, "mm", "giao hai trục kéo dài tối đa")],
         ma_kiem="do_thi_hanh_lang", cach_tinh="đồ thị = trục `truc` + nét vẽ tay MDI-HANHLANG (ưu tiên tuyệt đối); không có nét tay thì nối bằng giao hai trục kéo dài (mọi góc) hoặc đoạn vuông góc giữa hai trục song song cách một bay; cửa gán vào trục gần nhất song song với mặt; đầu hành lang mặc định = Circle CAD",
         ma_cu=["QT-19", "QT-19b", "QT-25", "QT-51", "QT-54", "QT-55"], ham="pccc.ts · dungDoThi"),
    dict(id="mdi_danh_so", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Đánh số căn CH-xx liên tục theo chu vi, một chiều", ten_en="Unit numbering around perimeter",
         nguon="MDI · QT-20", nguong=[], ma_kiem="danh_so_chu_vi", cach_tinh="mọi căn mang CH-xx, chạy liên tục quanh chu vi tòa theo một chiều duy nhất",
         ma_cu=["QT-20"], ham=None),
    dict(id="mdi_net_bao_dtxd", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="DTXD = diện tích nét bao (nét bao co / giãn theo căn, cả hốc logia)", ten_en="Footprint = outline area",
         nguon="MDI · QT-65 · QT-31 · QT-33 · QT-59", nguong=[],
         ma_kiem="net_bao_dtxd", cach_tinh="nét bao = nét bao CAD − sàn mất ∪ sàn mọc thêm (hợp/trừ đa giác); mặc định khớp tuyệt đối nét bao CAD; hốc logia đi theo vị trí hiện tại của căn ở mọi thao tác; nét bao tự cắt thì về mô hình cũ",
         ma_cu=["QT-65", "QT-31", "QT-33", "QT-59", "QT-59b", "QT-54"], ham=None),
    dict(id="mdi_leftover", buoc="xep_day_can", nhom="mdi", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Khe còn trống trên dãy căn", ten_en="Unfilled slots in unit rows",
         nguon="MDI · tổng bề rộng ô Còn trống, ≤ 0,2 m là khít", nguong=[N(200, "mm")],
         ma_kiem="khe_con_trong", cach_tinh="Σ bề rộng ô “Còn trống” thật (đã loại void / hành lang / khe trong lõi); > 200 mm = cảnh báo",
         ma_cu=["mdi_leftover"], yaml="mdi_leftover", ham=None),
    dict(id="mdi_tu_sinh", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Tự sinh: xếp căn theo luật, không theo lượt chèn", ten_en="Rule-based auto layout",
         nguon="MDI · QT-40…43 · QT-70", nguong=[],
         ma_kiem="tu_sinh", cach_tinh="căn góc g1/g2 ở hai mút mặt, y1 sát lõi hub (theo bản vẽ); không bỏ trống chỗ căn góc; lối hành lang không bị bịt",
         ma_cu=["QT-40", "QT-41", "QT-42", "QT-43", "QT-70"], ham=None),
    dict(id="mdi_khung_can_v", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Căn góc tòa V: ranh căn = khung CAD (polyline kín DefPoints)", ten_en="V-corner unit boundary",
         nguon="MDI · QT-58", nguong=[], ma_kiem="khung_can_v", cach_tinh="căn V không có khung mô-đun chữ nhật; ranh lấy polyline kín DefPoints",
         ma_cu=["QT-58"], ham=None),
    dict(id="mdi_xref_du", buoc="xep_day_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Mọi lượt chèn căn / lõi / thang phải có trong thư viện", ten_en="Every insert exists in library",
         nguon="MDI · QT-61", nguong=[], ma_kiem="xref_du", cach_tinh="thiếu tệp thư viện thì dừng và báo tên, không bỏ qua im lặng",
         ma_cu=["QT-61"], ham="scripts/chep_thu_vien.py (_loi khi thiếu căn / lõi)"),

    # ---------------- Đổi mẫu căn ----------------
    dict(id="qcvn04_min_area", buoc="doi_mau_can", nhom="qcvn04", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Diện tích căn tối thiểu", ten_en="Minimum unit area",
         nguon="QCVN 04:2021 · DT căn hộ ≥ 25 m²", nguong=[N(25, "m²", "DT thông thủy mỗi căn", ">=")],
         ma_kiem="so_can_duoi_25", cach_tinh="số căn có DT thông thủy < 25 m² phải bằng 0",
         ma_cu=["qcvn04_min_area"], yaml="qcvn04_min_area", ham=None),
    dict(id="qcvn04_small_ratio", buoc="doi_mau_can", nhom="qcvn04", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Tỷ lệ căn ≤ 45 m²", ten_en="Share of units ≤ 45 m²",
         nguon="MDI · QCVN 04:2021 (đề xuất MDI)", nguong=[N(25, "%", "số căn có DT thông thủy ≤ 45 m²")],
         ma_kiem="ti_le_can_nho", cach_tinh="vượt 25 % = cảnh báo (không phải lỗi)",
         ma_cu=["qcvn04_small_ratio"], yaml="qcvn04_small_ratio", ham=None),
    dict(id="mdi_cung_dong_can", buoc="doi_mau_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Tòa NOTM chỉ dùng căn NOTM (và ngược lại)", ten_en="Unit line matches tower line",
         nguon="MDI · QT-66", nguong=[], ma_kiem="cung_dong_can", cach_tinh="căn khác dòng chèn nhầm thì đổi sang mẫu cùng mã của dòng đúng",
         ma_cu=["QT-66"], ham=None),
    dict(id="mdi_stretch", buoc="doi_mau_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="STRETCH mẫu căn qua phòng khách", ten_en="Stretch unit through living room",
         nguon="MDI · QT-81", nguong=[N(100, "mm", "bước", "="), N(500, "mm", "co / giãn tối đa ±")],
         ma_kiem="stretch_can", cach_tinh="như lệnh STRETCH của CAD, chỉ ở ô có phòng khách",
         ma_cu=["QT-81", "QT-81b"], ham=None),
    dict(id="mdi_toi_uu_mot_toa", buoc="doi_mau_can", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Tối ưu trong một mẫu tòa: đổi mẫu căn từng ô + lõi + thang bộ", ten_en="Optimise within one template",
         nguon="MDI · QT-79 · QT-96", nguong=[N(3, "PA", "giữ top", "=")],
         ma_kiem="toi_uu_mot_toa", cach_tinh="không đổi số tầng (theo QH), không STRETCH, không thêm thang bộ; xếp theo số lỗi QCVN rồi mục tiêu Ưu tiên",
         ma_cu=["QT-79", "QT-96"], ham=None),

    # ---------------- PCCC / thoát nạn ----------------
    dict(id="qcvn06_travel_max", buoc="pccc", nhom="qcvn06", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Căn xa lối thoát nhất", ten_en="Worst travel to exit",
         nguon="QCVN 06:2022 3.3.2 · Bảng G.1 / A.2.19",
         nguong=[N(25, "m", "H ≤ 75 m · căn ở hành lang cụt"), N(40, "m", "H ≤ 75 m · căn giữa hai buồng thang"),
                 N(15, "m", "H > 75 m · cụt"), N(20, "m", "H > 75 m · giữa hai buồng thang")],
         ma_kiem="cu_ly_thoat_nan", cach_tinh="từ TIM CỬA CĂN tới TIM CỬA BUỒNG ĐỆM thang bộ gần nhất, đo dọc tim hành lang trên đồ thị (đi qua góc), KHÔNG cộng bề rộng hành lang; mỗi căn chịu ngưỡng riêng (cụt hay đôi)",
         ma_cu=["qcvn06_travel_max", "QT-45", "QT-15", "QT-25"], yaml="qcvn06_travel_max", ham="pccc.ts · thoatNan / kiemTraPCCC"),
    dict(id="qcvn06_deadend", buoc="pccc", nhom="qcvn06", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Hành lang cụt tới lối thoát", ten_en="Dead-end travel",
         nguon="QCVN 06:2022 Bảng G.1 (H ≤ 75 m) / A.3.1.7 → A.2.19 (H > 75 m)",
         nguong=[N(25, "m", "H ≤ 75 m"), N(15, "m", "75 < H ≤ 150 m")],
         ma_kiem="hanh_lang_cut", cach_tinh="căn chỉ thoát được về MỘT hướng (Dijkstra bỏ đoạn của chính cửa); lấy cự ly lớn nhất trong các căn đó, không lấy chiều dài đoạn trục",
         ma_cu=["qcvn06_deadend", "QT-24"], yaml="qcvn06_deadend", ham="pccc.ts · thoatNan / kiemTraPCCC"),
    dict(id="qcvn06_two_stairs_travel", buoc="pccc", nhom="qcvn06", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Cự ly căn giữa hai buồng thang", ten_en="Travel from units between stairs",
         nguon="QCVN 06:2022 Bảng G.1 (H ≤ 75 m) / A.3.1.7 → A.2.19 (H > 75 m)",
         nguong=[N(40, "m", "H ≤ 75 m"), N(20, "m", "75 < H ≤ 150 m")],
         ma_kiem="cu_ly_hai_thang", cach_tinh="căn thoát được cả hai hướng, mỗi hướng tới một buồng thang; lấy cự ly ngắn hơn của từng căn, báo căn lớn nhất",
         ma_cu=["qcvn06_two_stairs_travel", "QT-24"], yaml="qcvn06_two_stairs_travel", ham="pccc.ts · thoatNan / kiemTraPCCC"),
    dict(id="qcvn06_compartment", buoc="pccc", nhom="qcvn06", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Diện tích khoang cháy (F1.3)", ten_en="Fire compartment area (F1.3)",
         nguon="QCVN 06:2022 Bảng H.1 / A.3.1.3 → A.2.3",
         nguong=[N(2500, "m²", "H ≤ 75 m (nhà ở kiểu căn hộ, bậc I, S0)"), N(2000, "m²", "H > 75 m")],
         ma_kiem="khoang_chay", cach_tinh="DTXD một tầng ≤ ngưỡng; chung cư KHÔNG nhân đôi khi có chữa cháy tự động (H.2.12.2 chỉ áp Bảng H.2–H.4)",
         ma_cu=["qcvn06_compartment", "QT-24"], yaml="qcvn06_compartment", ham=None),
    dict(id="qcvn06_A214_corridor", buoc="pccc", nhom="qcvn06", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Khoang hành lang căn hộ (nhà > 75 m)", ten_en="Corridor compartment",
         nguon="QCVN 06:2022 A.2.14 (qua A.3.1.7)", nguong=[N(30, "m", "chỉ áp khi H > 75 m")],
         ma_kiem="khoang_hanh_lang_30", cach_tinh="khoang = phần hành lang LIỀN NHAU giữa hai cửa / vách ngăn cháy (nhánh L/T nối nhau cộng dồn, sảnh thang máy tính chung khoang); vách ngăn cháy loại 1 + cửa loại 2 tự đóng, hoặc vách / màn ngăn khói mép dưới ≤ 2,5 m",
         ma_cu=["qcvn06_A214_corridor", "QT-95", "QT-98", "QT-100", "QT-104", "QT-104c"], yaml="qcvn06_A214_corridor", ham="chiaHanhLang.ts · chiaHanhLang / doKhoang (pcccTang.ts)"),
    dict(id="qcvn06_335_corridor", buoc="pccc", nhom="qcvn06", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Chia hành lang dài > 60 m", ten_en="Corridor division > 60 m",
         nguon="QCVN 06:2022 3.3.5", nguong=[N(60, "m", "mọi chiều cao")],
         ma_kiem="khoang_hanh_lang_60", cach_tinh="hành lang dài hơn 60 m phải chia bằng vách ngăn cháy loại 2 / vách, màn ngăn khói thành đoạn ≤ 60 m; đo tổng các đoạn liền nhau giữa hai vách",
         ma_cu=["qcvn06_335_corridor", "QT-98"], yaml="qcvn06_335_corridor", ham="chiaHanhLang.ts · chiaHanhLang (tự đặt cửa) · pccc.ts kiemTraPCCC"),
    dict(id="qcvn06_613_firelift", buoc="pccc", nhom="qcvn06", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Thang máy chữa cháy", ten_en="Firefighting lift",
         nguon="QCVN 06:2022 (SĐ1:2023) 6.13 · QCVN 04:2021 2.4.3", nguong=[N(1, "thang", "khi H PCCC > 50 m (nhóm F1.3) hoặc hầm sâu > 9 m", ">=")],
         ma_kiem="thang_chua_chay", cach_tinh="H PCCC ≤ 50 m thì không đòi; trên 50 m mỗi khoang cháy ≥ 1 thang chữa cháy. App cũ chỉ có ô số; app mới chỉ định giếng theo luật (phủ nhiều điểm nhất trong bán kính, hoà thì gần thang N3)",
         ma_cu=["qcvn06_613_firelift"], yaml="qcvn06_613_firelift", ham="thangMay.ts · canTMCC / chonThangChuaChay"),
    dict(id="qcvn06_52_hong_nuoc", buoc="pccc", nhom="qcvn06", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Họng nước chữa cháy trong nhà (tủ âm tường)", ten_en="Indoor fire hose cabinets",
         nguon="QCVN 06:2022 5.2 · Bảng 11 · 5.2.4 · 5.2.7 · 5.2.11 · 5.2.14 · thẩm duyệt PC07 (R 18 m)",
         nguong=[N(18, "m", "bán kính phục vụ ĐO THẲNG từ tủ tới mọi điểm phải bảo vệ"), N(2, "tia", "mỗi điểm khi số tia tính toán ≥ 2", "="),
                 N(3, "m", "hai vị trí tủ cách nhau tối thiểu", ">="), N(800, "mm", "tủ đôi / cụm 2 hộp × 200", "="), N(500, "mm", "tủ đơn × 200", "=")],
         ma_kiem="phu_tu_pccc", cach_tinh="điểm phải phủ: cửa căn, 4 góc trong căn (lùi 150 / 150 / 300 mm), hành lang mỗi 3 m; KHÔNG cộng tầm tia (tia đặc 6 m H ≤ 50 m / 8 m H > 50 m chỉ là yêu cầu áp lực); Bảng 11: ≤ 16 tầng HL ≤ 10 m 1 tia, > 10 m 2 tia; 17–25 tầng 2 / 3 tia; > 25 tầng chủ nhiệm chốt 2 tia; ưu tiên tường HL trước phòng KT trong lõi, rồi hộp KT căn, cuối cùng giữa tường căn; không đặt ở cửa buồng thang không nhiễm khói; ít vị trí nhất",
         ma_cu=["qcvn06_52_hong_nuoc", "QT-77", "QT-77b", "QT-77c", "QT-77d", "QT-77e", "QT-77f"], yaml="qcvn06_52_hong_nuoc", ham="pccc.ts · tuPCCC (phủ tham lam, chưa ưu tiên lõi / HKT) · lớp kéo tay ve/LopPCCC.tsx"),
    dict(id="mdi_hpccc", buoc="pccc", nhom="mdi", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Chiều cao PCCC trong phạm vi QCVN 06", ten_en="Firefighting height",
         nguon="QCVN 06:2022 1.4.9 · nhà F1.3 75–150 m thuộc sheet 4", nguong=[N(150, "m")],
         ma_kiem="chieu_cao_pccc", cach_tinh="H PCCC = H đế × số tầng đế + H tầng × (số tầng − 1) + 1,4 m bậu cửa",
         ma_cu=["mdi_hpccc"], yaml="mdi_hpccc", ham="pccc.ts · chieuCaoPCCC"),
    dict(id="qcvn06_escape_stairs", buoc="pccc", nhom="mdi", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Số thang thoát nạn", ten_en="Escape stairs",
         nguon="MDI slide 40 · chủ nhiệm 12/9/2026 · QT-57", nguong=[N(2, "thang", "đạt", "="), N(3, "thang", "tối đa (3 = cảnh báo)")],
         ma_kiem="so_thang_bo", cach_tinh="2 = đạt, 3 = cảnh báo, khác = lỗi; đạt số lượng không thay kiểm tra cự ly",
         ma_cu=["qcvn06_escape_stairs", "QT-57"], yaml="qcvn06_escape_stairs", ham="pccc.ts · kiemTraPCCC"),
    dict(id="mdi_thang_bo_tu_dong", buoc="pccc", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Thang bộ tự động: thêm cạnh căn tệ nhất, cắt bớt giữ ≥ 2", ten_en="Automatic stair placement",
         nguon="MDI · QT-44 · QT-63", nguong=[N(2, "thang", "tối thiểu sau khi cắt bớt", ">=")],
         ma_kiem="thang_bo_tu_dong", cach_tinh="xuất phát từ chỗ bản vẽ đặt; mỗi lượt đo cự ly, thêm một thang cạnh căn vượt tệ nhất; rồi bỏ từng thang theo thứ tự cố định chừng nào vẫn phủ hết; loại thang N3 ↔ N2 thay được",
         ma_cu=["QT-44", "QT-63"], ham=None),
    dict(id="mdi_cua_ngan_chay", buoc="pccc", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Quy tắc đặt cửa ngăn cháy hành lang", ten_en="Corridor fire-door placement",
         nguon="MDI · QT-105 (R1–R7)", nguong=[N(1800, "mm", "cửa tm = bề rộng HL", "="), N(1600, "mm", "cửa xh", "="), N(150, "mm", "bù tường", "="),
                                               N(600, "mm", "mép cửa căn / thang / lõi / tủ cách tim cửa ngăn", ">="), N(5, "m", "khoang tối thiểu", ">="), N(5, "°", "lệch vuông góc tối đa")],
         ma_kiem="dat_cua_ngan", cach_tinh="hai cánh mở hai chiều; không trong sảnh thang máy (cách mép sảnh ≥ một cánh + 1 m); không đứng trên ô cửa; không trong lõi trừ lối xuyên lõi; vuông góc hành lang; ít cửa nhất, không khoang vụn",
         ma_cu=["QT-105", "QT-103", "QT-99", "QT-100", "QT-104", "QT-104c"], ham=None),
    dict(id="mdi_cnc_quet", buoc="pccc", nhom="mdi", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Cánh cửa ngăn cháy HL che cửa căn / thang", ten_en="Corridor fire-door swing blocks doors",
         nguon="MDI · chủ nhiệm 19/10/2026 · QT-105 R4b", nguong=[N(0, "cửa", "cửa có cánh quét qua cửa căn / buồng đệm / lõi / tủ", "=")],
         ma_kiem="canh_cua_ngan_quet", cach_tinh="cánh (mỗi cánh ½ HL) khi mở áp tường không chồng cửa khác; không có chỗ sạch thì gắn cờ, chủ nhiệm quyết (dời cửa căn, hoặc dùng vách / màn ngăn khói)",
         ma_cu=["mdi_cnc_quet", "QT-99"], yaml="mdi_cnc_quet", ham=None),
    dict(id="mdi_tu_tru_dt", buoc="pccc", nhom="qt", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Tủ PCCC ở tường căn: trừ DT thông thủy, căn thành mẫu đặc biệt", ten_en="Cabinet in unit wall reduces net area",
         nguon="MDI · QT-77g", nguong=[N(295, "mm", "sâu tủ + tường xây sau + hoàn thiện", "="), N(95, "mm", "chữ L thêm một bên", "="), N(190, "mm", "chữ U thêm hai bên", "=")],
         ma_kiem="tru_dt_tu", cach_tinh="TH1 hộp KT căn / lõi: không trừ; TH3 sát tường ngăn: chữ L, trừ (tủ + 95) × (295 − tường HL − 15); TH2 giữa tường căn: chữ U, trừ (tủ + 190) × (295 − tường HL − 15)",
         ma_cu=["QT-77g"], ham=None),

    # ---------------- Hầm: app cũ chưa có luật ----------------

    # ---------------- Chỉ tiêu ----------------
    dict(id="qcvn01_mdxd", buoc="chi_tieu", nhom="qcvn01", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Mật độ xây dựng", ten_en="Site coverage",
         nguon="QCVN 01:2021 · Bảng 2.9 · MĐXD tối đa theo QH", nguong=[N("MĐXD lô (QH)", "%"), N("Bảng 2.9 (nội suy theo DT lô × chiều cao)", "%")],
         bang={"ten": "Bảng 2.9 (%) nhà chung cư", **BANG_29_212, "gia_tri": BANG_29},
         ma_kiem="mat_do_xd", cach_tinh="Σ DTXD / DT lô ≤ chỉ tiêu lô và ≤ Bảng 2.9 (nội suy hai chiều, ngoài biên lấy biên); lô DT 0 → 0",
         ma_cu=["qcvn01_mdxd", "QT-82"], yaml="qcvn01_mdxd", ham="chiTieu.ts · tinhChiTieu (matDo, chưa có Bảng 2.9)"),
    dict(id="qcvn01_far", buoc="chi_tieu", nhom="qcvn01", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Hệ số sử dụng đất", ten_en="Floor area ratio",
         nguon="QCVN 01:2021 · Bảng 2.12 · HSSDĐ tối đa", nguong=[N("HSSDĐ lô (QH)", "lần"), N("Bảng 2.12 (nội suy) — chỉ báo", "lần")],
         bang={"ten": "Bảng 2.12 (lần)", **BANG_29_212, "gia_tri": BANG_212},
         ma_kiem="he_so_sdd", cach_tinh="GFA / DT lô ≤ chỉ tiêu lô; vượt Bảng 2.12 chỉ báo vàng (QH lô không ghi HSSDĐ thì không có trần riêng)",
         ma_cu=["qcvn01_far", "QT-82"], yaml="qcvn01_far", ham="chiTieu.ts · tinhChiTieu (dtSan ≤ HSSDĐ × DT lô)"),
    dict(id="qh_tang_cao", buoc="chi_tieu", nhom="qcvn01", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Tầng cao ≤ chỉ tiêu lô", ten_en="Storeys within lot limit",
         nguon="Chỉ tiêu QH lô · QT-82", nguong=[N("tầng cao lô (QH)", "tầng")],
         ma_kiem="tang_cao", cach_tinh="tầng cao = tầng đế + tầng căn hộ (+ tum); chiều cao xây dựng H = tầng đế × cao đế + số tầng × cao tầng",
         ma_cu=["QT-82"], ham="chiTieu.ts · tinhChiTieu (tangCao)"),
    dict(id="qd34_pop", buoc="chi_tieu", nhom="qd34", bat_buoc=True, ap_dung="ca_hai",
         ten_vi="Dân số công trình", ten_en="Building population",
         nguon="QĐ 34/2024/QĐ-UBND (Hà Nội) · TP.HCM QĐ 83/2026 hoặc QĐ 32/2025 chuyển tiếp (QT-134)", nguong=[N("dân số tối đa lô (QH)", "người")],
         ma_kiem="dan_so", cach_tinh="quy đổi người theo bậc DT sử dụng (bảng NOTM / NOXH) hoặc bình quân 3,6 người/căn (TP.HCM QĐ 83: 3,5); chọn theo cài đặt; T0 đang dùng bậc DT chờ chốt",
         ma_cu=["qd34_pop", "QT-134"], yaml="qd34_pop", ham="chiTieu.ts · tinhChiTieu (danSo = số căn × người/căn)"),
    dict(id="mdi_lift_provided", buoc="chi_tieu", nhom="mdi", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Số thang máy bố trí", ten_en="Lifts provided",
         nguon="QCVN 04:2021/BXD 2.4.2 · QT-76 · QT-94", nguong=[N("min(⌈căn / 70⌉, ⌈dân / 200⌉)", "thang", None, ">=")],
         ma_kiem="so_thang_may", cach_tinh="tổng thang = khách + chữa cháy + hàng (= số giếng lõi, đếm theo hình vẽ QT-64) ≥ số cần; số cần lấy cách cho ÍT thang hơn",
         ma_cu=["mdi_lift_provided", "QT-76", "QT-94", "QT-64", "QT-75", "QT-75b"], yaml="mdi_lift_provided", ham="thangMay.ts · giengThangMay / kiemThangMay"),
    dict(id="mdi_lift_unit", buoc="chi_tieu", nhom="mdi", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Thang máy theo số căn", ten_en="Lifts by unit count",
         nguon="QCVN 04:2021/BXD 2.4.2 (app cũ ghi bảng chuẩn Viện)", nguong=[N(70, "căn/thang")],
         ma_kiem="can_moi_thang", cach_tinh="tổng căn / tổng thang; chỉ cảnh báo khi cả hai cách đều thiếu (một cách đạt là đủ)",
         ma_cu=["mdi_lift_unit"], yaml="mdi_lift_unit", ham=None),
    dict(id="mdi_lift_pop", buoc="chi_tieu", nhom="mdi", bat_buoc=False, ap_dung="ca_hai",
         ten_vi="Thang máy theo dân số", ten_en="Lifts by population",
         nguon="QCVN 04:2021/BXD 2.4.2 (app cũ ghi bảng chuẩn Viện)", nguong=[N(200, "người/thang")],
         ma_kiem="dan_moi_thang", cach_tinh="tổng dân / tổng thang; chỉ cảnh báo khi cả hai cách đều thiếu",
         ma_cu=["mdi_lift_pop"], yaml="mdi_lift_pop", ham=None),
]

# ---------------------------------------------------------------------------------------------------------------------------
# QT bỏ (không thành luật ở app mới). loai: thay_the | trung | giao_dien | xuat | ai | tinh_nang | thu_bo
# ---------------------------------------------------------------------------------------------------------------------------
BO = {
    "QT-3": ("giao_dien", None, "cắt nét vẽ căn về mô-đun ±125 mm (clipPath) — cách vẽ SVG"),
    "QT-4": ("giao_dien", None, "vành tường 125 mm do app vẽ — cách vẽ"),
    "QT-8": ("thay_the", "QT-30", "đoạn xoá căn để lại khe bỏ từ 04/9/2026; phần dồn khít gộp vào mdi_don_khit"),
    "QT-11": ("giao_dien", None, "bảng thông tin căn đặt ngoài căn"),
    "QT-12": ("giao_dien", None, "nét theo layer"),
    "QT-13": ("giao_dien", None, "nhãn dẹt trong bảng"),
    "QT-14": ("giao_dien", None, "khe ≤ 400 mm không tô màu"),
    "QT-15": ("thay_the", "QT-45", "công thức cũ cộng bề rộng hành lang; QT-45 bỏ phần cộng"),
    "QT-17": ("giao_dien", None, "tô màu căn theo đường bao tim tường"),
    "QT-18": ("giao_dien", None, "tô hành lang không vượt nét bao"),
    "QT-23": ("thay_the", "QT-72", "sảnh NOXH 3.000 mm; QT-72 chốt NOTM 3,0 m · NOXH 2,6 m"),
    "QT-26": ("giao_dien", None, "định dạng tệp lưu PA của app cũ"),
    "QT-27": ("giao_dien", None, "bố cục dải KPI"),
    "QT-28": ("xuat", None, "phiếu .scr AutoCAD"),
    "QT-29": ("xuat", None, "XCLIP khi xuất CAD"),
    "QT-39": ("thay_the", "QT-54", "lọc góc trong cho điểm kéo hành lang; thay bằng Circle CAD"),
    "QT-46c": ("thay_the", "QT-49", "mốc góc so đầu mặt với đầu mặt — sai, thay bằng điểm nối trục"),
    "QT-48": ("thay_the", "QT-57", "thang neo tại chỗ thả; QT-57 cho thang dồn như căn"),
    "QT-50": ("giao_dien", None, "viền tô lõi hub răng cưa"),
    "QT-52": ("thu_bo", "QT-54", "ghi đè a0/a1 trục bằng toạ độ MDI-HANHLANG — thử và bỏ, thay bằng Circle CAD (QT-54)"),
    "QT-53": ("giao_dien", None, "vá góc chéo hành lang hub khi tô"),
    "QT-68": ("ai", None, "trợ lý AI đọc đầu bài (phần tối ưu số tầng gộp vào mdi_lap_pa)"),
    "QT-73": ("giao_dien", None, "giữ lõi đã thay qua regenerate() — trạng thái app cũ"),
    "QT-78": ("ai", None, "cầu Claude Code"),
    "QT-80": ("ai", None, "AI soát số thuyết minh"),
    "QT-83": ("giao_dien", None, "nút Lưu + Cài đặt"),
    "QT-85": ("giao_dien", None, "không gian làm việc ② ③"),
    "QT-87": ("tinh_nang", None, "nạp dự án tự điền ① ② ③"),
    "QT-91": ("tinh_nang", None, "nạp .dxf trong app"),
    "QT-92": ("tinh_nang", None, "tự đặt cho mọi lô đã tick"),
    "QT-93": ("tinh_nang", None, "chạy nền có tiến độ"),
    "QT-95": ("thay_the", "QT-98", "đo khoang theo từng trục riêng; QT-98 đo trên đồ thị"),
    "QT-97": ("giao_dien", None, "chọn nhiều căn"),
    "QT-101": ("giao_dien", None, "kéo tay cửa ngăn cháy (ràng buộc vị trí = mdi_cua_ngan_chay)"),
    "QT-102": ("giao_dien", None, "xoá / lật hàng loạt"),
    "QT-104b": ("thay_the", "QT-104c", "cửa miệng sảnh TM — QT-104c bỏ hẳn"),
    "QT-106": ("tinh_nang", None, "kho mẫu dự án + hàng chờ"),
    "QT-108": ("giao_dien", None, "LOD hiển thị căn ở ③"),
    "QT-109": ("xuat", None, "khối 3D glTF"),
    "QT-112": ("xuat", None, "IFC4"),
    "QT-113": ("xuat", None, "phiếu lắp ghép Revit"),
    "QT-118b": ("xuat", None, "script bóc CGXD từ CAD (đầu vào, không phải luật)"),
}

LOAI_BO = {"thay_the": "bị QT sau thay", "trung": "trùng luật khác", "giao_dien": "chỉ dành cho giao diện / cách vẽ app cũ",
           "xuat": "xuất / bóc CAD-BIM, không phải luật xếp", "ai": "tính năng trợ lý AI", "tinh_nang": "tính năng thao tác, không phải luật",
           "thu_bo": "đã thử và bỏ"}


def _sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


# Luật QCVN 04:2021/BXD bổ sung thủ công (không có trong yaml app cũ). Mã DC-06… nối tiếp sau các luật đã đánh mã để không đổi mã cũ.
# bo_sung: luật mới không có ở app cũ nên ma_cu rỗng
_BS = dict(buoc="doi_mau_can", nhom="qcvn04", ap_dung="ca_hai", thay_the_boi=None, thay_cho=[], ham="qcvn04.ts", bo_sung=True)
LUAT_BO_SUNG = [
    dict(id="qcvn04_phong_ngu_9", bat_buoc=True, ten_vi="Phòng ngủ tối thiểu 9 m²", ten_en="Minimum bedroom area",
         nguon="QCVN 04:2021/BXD 2.2.4.4", nguong=[N(9, "m²", "DT mỗi phòng ngủ", ">=")], ma_kiem="phong_ngu_9",
         cach_tinh="mọi phòng loại ngủ của mẫu căn ≥ 9 m²; mẫu căn chưa có trường phong[] thì báo chưa đủ dữ liệu (không tính là đạt)", ma_cu=[], **_BS),
    dict(id="qcvn04_phong_ngu_sang", bat_buoc=True, ten_vi="Phòng ngủ thông thoáng, chiếu sáng tự nhiên", ten_en="Bedroom natural ventilation and daylight",
         nguon="QCVN 04:2021/BXD 2.2.4.4", nguong=[], ma_kiem="phong_ngu_sang",
         cach_tinh="mọi phòng ngủ có ke_mat_ngoai = true; thiếu trường thì chưa đủ dữ liệu", ma_cu=[], **_BS),
    dict(id="qcvn04_thong_thuy", bat_buoc=True, ten_vi="Chiều cao thông thủy tối thiểu", ten_en="Minimum clear height",
         nguon="QCVN 04:2021/BXD 2.2.10",
         nguong=[N(2.6, "m", "phòng ở", ">="), N(2.3, "m", "bếp, WC", ">="), N(2.0, "m", "hầm, kỹ thuật", ">=")], ma_kiem="thong_thuy",
         cach_tinh="thông thủy = cao tầng (caoDH / caoDe) − dày sàn + trần (cauTao.daySanTranM, mặc định 0,30 m là giá trị tạm chờ chủ nhiệm chốt); tầng căn hộ ≥ 2,6 m; tầng đế < 2,6 m cảnh báo, < 2,0 m vượt; hầm chưa có chiều cao nên chưa kiểm", ma_cu=[], **_BS),
    dict(id="qcvn04_cua_cuu_nan", bat_buoc=True, ten_vi="Cửa sổ cứu nạn cho căn không có ban công / lô gia", ten_en="Rescue window for units without balcony / loggia",
         nguon="QCVN 04:2021/BXD 2.2.11", nguong=[N(600, "mm", "lỗ thông thủy 600 × 600", ">=")], ma_kiem="cua_cuu_nan",
         cach_tinh="căn không có logia_lui phải có cửa sổ tường ngoài ≥ 600 × 600 mm (cua_cuu_nan); chưa khai thì cảnh báo cần kiểm", ma_cu=[], **_BS),
    dict(id="qcvn04_thang_bang_ca", bat_buoc=True, ten_vi="Thang máy chở được băng ca", ten_en="Stretcher-capable lift",
         nguon="QCVN 04:2021/BXD chú thích 2.4.1", nguong=[N(1, "thang", "tối thiểu mỗi nhà có thang máy", ">=")], ma_kiem="thang_bang_ca",
         cach_tinh="tòa khai thangBangCa = true là đạt, false là vượt, chưa khai thì cảnh báo", ma_cu=[], **_BS),
    dict(id="qcvn04_nhan_vien", bat_buoc=False, ten_vi="Không gian nhân viên quản lý, trông xe, bảo vệ, kỹ thuật", ten_en="Staff space",
         nguon="QCVN 04:2021/BXD 2.2.18", nguong=[N(5, "m²/người", None, ">=")], ma_kiem="nhan_vien",
         cach_tinh="DT khai / số nhân viên khai ≥ 5 m²/người; chưa khai thì bỏ qua", ma_cu=[], **_BS),
]

# Luật PCCC tầng bổ sung (2026-10-29, tra QCVN 04:2021 + QCVN 06:2022 SĐ1:2023 trong kho E:\\OneDrive\\_QCVN-TCVN) — app cũ không có.
_PC = dict(ap_dung="ca_hai", thay_the_boi=None, thay_cho=[], bo_sung=True, ma_cu=[])
LUAT_BO_SUNG += [
    dict(id="qcvn04_241_thang_toi_thieu", buoc="chi_tieu", nhom="qcvn04", bat_buoc=True, ten_vi="Số thang máy tối thiểu theo số tầng", ten_en="Minimum lifts by storeys",
         nguon="QCVN 04:2021/BXD 2.4.1", nguong=[N(1, "thang", "nhà từ 5 tầng", ">="), N(2, "thang", "nhà từ 10 tầng", ">=")], ma_kiem="thang_toi_thieu",
         cach_tinh="số tầng = tầng đế + tầng căn hộ; số cần = max(2.4.1, min(⌈căn / 70⌉, ⌈người / 200⌉) theo 2.4.2); số có = giếng trong lõi (QT-64)", ham="thangMay.ts · thangMayCan", **_PC),
    dict(id="qcvn06_613_ban_kinh_tmcc", buoc="pccc", nhom="qcvn06", bat_buoc=True, ten_vi="Bán kính phục vụ thang máy chữa cháy", ten_en="Firefighting lift service radius",
         nguon="QCVN 06:2022 (SĐ1:2023) 6.13 · A.2.12 (nhà > 75 m)", nguong=[N(60, "m", "H PCCC ≤ 75 m"), N(45, "m", "H PCCC > 75 m")], ma_kiem="ban_kinh_tmcc",
         cach_tinh="từ tâm giếng thang chữa cháy tới cửa căn + 4 góc trong căn, ĐO THẲNG (6.13 không ghi theo đường đi — cách đo chờ chủ nhiệm chốt); điểm ngoài bán kính báo cảnh báo", ham="thangMay.ts · chonThangChuaChay", **_PC),
    dict(id="qcvn04_253_hong_cho_45", buoc="pccc", nhom="qcvn04", bat_buoc=True, ten_vi="Họng chờ chữa cháy tới cửa căn xa nhất", ten_en="Landing valve to farthest unit door",
         nguon="QCVN 04:2021/BXD 2.5.3", nguong=[N(45, "m", "nhà có chiều cao PCCC > 50 m, tính theo đường di chuyển")], ma_kiem="hong_cho_45",
         cach_tinh="nguồn = cửa buồng thang N3 (khoang đệm) + giếng thang chữa cháy; đo dọc tim hành lang tới cửa căn", ham="pcccTang.ts · phanTichPCCCTang", **_PC),
    dict(id="qcvn06_cua_ngan_chay", buoc="pccc", nhom="qcvn06", bat_buoc=True, ten_vi="Cửa ngăn cháy trên tầng căn hộ", ten_en="Fire-rated doors on apartment floors",
         nguon="QCVN 06:2022 3.2.11 · 3.3.5 · 6.13 · Bảng 2 · Bảng 3 · 4.24 · A.3.1.12 · A.2.30.2",
         nguong=[N("EI 60", "", "cửa buồng thang bộ — cửa ngăn cháy loại 1 (bậc chịu lửa I, II)", "="), N("EI 30", "", "cửa căn hộ mở ra hành lang (≥ vách hành lang EI 30)", "="),
                 N("EI 30", "", "cửa sảnh thang máy chữa cháy (khoang đệm loại 1 → chèn bịt loại 2)", "="), N("EI 60", "", "phòng ống đổ rác, nhà > 75 m (A.2.30.2)", "=")],
         ma_kiem="cua_ngan_chay", cach_tinh="đánh dấu trên lớp Cửa ngăn cháy; nhà > 75 m: cửa khoang đệm → buồng thang N, sảnh thang máy, phòng rác loại 2 (A.3.1.12 b), cửa giếng thang máy kín khói (A.3.1.12 c)", ham="pcccTang.ts · cuaNC", **_PC),
    dict(id="qcvn06_D2_hut_khoi_hl", buoc="pccc", nhom="qcvn06", bat_buoc=True, ten_vi="Hút khói hành lang nhà > 28 m", ten_en="Corridor smoke extraction > 28 m",
         nguon="QCVN 06:2022 Phụ lục D.2 a) · D.4 a)", nguong=[N(28, "m", "chiều cao PCCC từ đó phải hút khói hành lang (trừ hành lang bên)", ">"), N(60, "m", "mỗi đoạn hành lang tính lưu lượng")],
         ma_kiem="hut_khoi_hl", cach_tinh="chỉ ghi chú ở khối PCCC (chưa thiết kế hệ thống)", ham=None, **_PC),
]


def qt_trong_doc(md: str) -> list[str]:
    ids = sorted(set(re.findall(r"QT-\d+[a-z]?", md)), key=lambda s: (int(re.search(r"\d+", s)[0]), s))
    return ids


def chep(nguon: Path) -> dict:
    rules_dir = nguon / "rules"
    yaml_tep = sorted(rules_dir.glob("*.yaml"))
    yaml_luat = {}
    for f in yaml_tep:
        for r in yaml.safe_load(f.read_text(encoding="utf-8")) or []:
            yaml_luat[r["id"]] = {**r, "_tep": f.name}
    doc = nguon / "docs" / "QUY_TAC_XEP_CAN.md"
    md = doc.read_text(encoding="utf-8")
    qt_ids = qt_trong_doc(md)

    # mỗi luật yaml phải có mặt đúng một lần, ten khớp yaml
    da = {x.get("yaml") for x in LUAT if x.get("yaml")}
    thieu = set(yaml_luat) - da
    if thieu:
        sys.exit(f"LỖI QUY TẮC: luật yaml chưa chuyển: {sorted(thieu)}")
    # mỗi QT trong tài liệu: hoặc vào một luật (ma_cu), hoặc trong BO
    dung = {}
    for x in LUAT:
        for m in x["ma_cu"]:
            if m.startswith("QT-"):
                dung.setdefault(m, []).append(x["id"])
    chua = [q for q in qt_ids if q not in dung and q not in BO]
    if chua:
        sys.exit(f"LỖI QUY TẮC: QT chưa phân loại: {chua}")

    # đánh mã mới theo bước, bắt buộc trước
    tt = {b["ma"]: i for i, b in enumerate(BUOC)}
    tien_to = {b["ma"]: b["tien_to"] for b in BUOC}
    luat = sorted(LUAT, key=lambda x: (tt[x["buoc"]], not x["bat_buoc"]))
    dem = {}
    ra = []
    for x in luat:
        dem[x["buoc"]] = dem.get(x["buoc"], 0) + 1
        y = yaml_luat.get(x.get("yaml") or "")
        d = {
            "ma": f"{tien_to[x['buoc']]}-{dem[x['buoc']]:02d}", "id": x["id"], "buoc": x["buoc"], "nhom": x["nhom"],
            "bat_buoc": x["bat_buoc"], "ten_vi": x["ten_vi"], "ten_en": x["ten_en"],
            "nguon": x["nguon"], "nguong": x["nguong"], "ap_dung": x["ap_dung"], "ma_kiem": x["ma_kiem"],
            "cach_tinh": x["cach_tinh"], "ma_cu": x["ma_cu"], "thay_the_boi": None, "ham": x.get("ham"),
        }
        if "bang" in x:
            d["bang"] = x["bang"]
        if y:
            # tên lấy đúng yaml; ghi nguồn yaml để tra ngược
            d["ten_vi"], d["ten_en"] = y["title"]["vi"], y["title"]["en"]
            d["yaml"] = {"tep": "rules/" + y["_tep"], "nhom": y["group"], "nguon": y.get("source"), "trich": y.get("cite")}
        ra.append(d)

    # luật bổ sung: mã nối tiếp theo bước, không đổi mã luật cũ
    for x in LUAT_BO_SUNG:
        dem[x["buoc"]] = dem.get(x["buoc"], 0) + 1
        ra.append({"ma": f"{tien_to[x['buoc']]}-{dem[x['buoc']]:02d}", **x})
    # giữ quy ước: trong mỗi bước luật bắt buộc đứng trước luật nội bộ (sắp ổn định)
    thu_tu = [b["ma"] for b in BUOC]
    ra.sort(key=lambda x: (thu_tu.index(x["buoc"]), not x["bat_buoc"]))

    ma_moi = {x["id"]: x["ma"] for x in ra}
    qt_goc = []
    for q in qt_ids:
        if q in BO:
            loai, boi, ly_do = BO[q]
            boi_moi = ma_moi.get(boi) if boi and boi in ma_moi else None
            if boi and boi.startswith("QT-") and boi in dung:
                boi_moi = ma_moi[dung[boi][0]]
            qt_goc.append({"ma_cu": q, "giu": False, "loai_bo": loai, "thay_the_boi": boi, "luat_moi": boi_moi, "ly_do": ly_do})
        else:
            qt_goc.append({"ma_cu": q, "giu": True, "luat_moi": [ma_moi[i] for i in dung[q]]})
    # luật hiện hành ghi lại các QT nó thay
    for d in ra:
        d["thay_cho"] = [x["ma_cu"] for x in qt_goc if not x["giu"] and x["luat_moi"] == d["ma"]]

    ket_qua = {
        "phien_ban": 1, "buoc": BUOC, "luat": ra, "qt_goc": qt_goc,
        "thong_ke": {
            "luat_yaml": len(yaml_luat), "qt_goc": len(qt_ids), "qt_giu": sum(x["giu"] for x in qt_goc),
            "qt_bo": sum(not x["giu"] for x in qt_goc), "luat_moi": len(ra),
            "bo_theo_loai": {k: sum(1 for x in qt_goc if not x["giu"] and x["loai_bo"] == k) for k in LOAI_BO},
        },
        "loai_bo": LOAI_BO,
    }
    LIB.mkdir(parents=True, exist_ok=True)
    (LIB / "quy_tac.json").write_text(json.dumps(ket_qua, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")

    # sha256 nguồn → nguon.json (gộp vào khoá "tep" cùng các tệp thư viện)
    pn = LIB / "nguon.json"
    n = json.loads(pn.read_text(encoding="utf-8")) if pn.exists() else {"tep": {}}
    tep = {k: v for k, v in n.get("tep", {}).items() if not (k.startswith("rules/") or k.startswith("docs/"))}
    for f in yaml_tep:
        tep["rules/" + f.name] = _sha(f)
    tep["docs/QUY_TAC_XEP_CAN.md"] = _sha(doc)
    n["tep"] = tep
    pn.write_text(json.dumps(n, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    t = ket_qua["thong_ke"]
    print(f"Quy tắc: {t['luat_moi']} luật ({t['luat_yaml']} yaml) · QT gốc {t['qt_goc']} → giữ {t['qt_giu']} · bỏ {t['qt_bo']}")
    return ket_qua


DOI_CHIEU = """## Đối chiếu kết quả PCCC với app cũ

App cũ chạy headless (`scripts/chay_selftest.js --jsfile`, MDI_Unitmix_v4 @ `7373a5a`, mặc định 26 tầng, H PCCC 90,5 m → ngưỡng
cụt 15 m / đôi 20 m), đọc `metrics(buildGeom())` và `tuCC()` của từng mẫu tòa; app mới chạy `web/src/tinh/pccc.ts` trên `toa.json`
cùng tham số. Cự ly tính bằng m. Dạng ô: **mới / cũ**.

| Tòa | Cụt xa nhất | Giữa hai thang xa nhất | Căn xa nhất | Số căn cụt / đôi | Căn vượt | Thang bộ | Vị trí tủ PCCC |
|---|---|---|---|---|---|---|---|
| tm-i1 | 17,48 / 17,48 | 19,64 / 19,64 | 19,64 / 19,64 | 13·15 / 13·15 | 2 / 2 | 2 / 2 | 5 / 4 |
| tm-u2 | 13,84 / 13,78 | 14,73 / 14,73 | 14,73 / 14,73 | 10·17 / 10·17 | 0 / 0 | 3 / 3 | 7 / 6 |
| tm-z1 | 19,37 / 19,37 | 9,93 / 9,93 | 19,37 / 19,37 | 18·6 / 18·6 | 6 / 6 | 2 / 2 | 5 / 4 |
| xh-y1 | 15,94 / 15,94 | 16,92 / 16,92 | 16,92 / 16,92 | 15·10 / 15·10 | 2 / 2 | 3 / 3 | 4 / 4 |
| tm-l1 | 19,29 / 19,29 | 16,27 / 18,81 | 19,29 / 19,29 | 16·9 / 8·17 | 4 / 2 | 2 / 2 | 5 / 4 |
| tm-t1 | 15,14 / 12,12 | 19,03 / 19,03 | 19,03 / 19,03 | 17·16 / 6·27 | 1 / 0 | 3 / 3 | 6 / 5 |

**Cả 33 mẫu tòa:** “căn xa nhất” khớp 31/33 (lệch: tm-v4 17,76 / 15,13 · xh-z5 20,26 / 20,41); “cụt xa nhất” khớp ±0,1 m ở 31/33
(lệch: tm-t1, tm-t2); số căn vượt khớp 27/33 (lệch: tm-l1, tm-t1, tm-t2, tm-v2, tm-v3, xh-v1); số thang bộ khớp 33/33; tủ tự đặt phủ hết cửa căn ở 33/33, số vị trí lệch app cũ −1…+2.

Chỗ lệch và lý do:

- **Tòa L (tm-l1/l2/l3, xh-l1/l2) và T (tm-t1/t2): app mới xếp nhiều căn vào “cụt” hơn.** Ở app cũ, nét vẽ tay MDI-HANHLANG của
  cánh B chồng lên chính trục B nhưng được giữ làm một cạnh nối riêng (QT-51: hai đầu chạm hai trục khác nhau), đồ thị có HAI cạnh
  song song cùng nối hai nút → vòng giả, căn ở cánh cụt “đi được hai hướng” và hưởng ngưỡng 20 m thay vì 15 m. App mới gộp các đoạn
  thẳng hàng chồng nhau trước khi dựng đồ thị nên không có vòng giả. (Nguyên nhân suy từ mã `regenerate()` / QT-51, chưa soát từng
  cạnh trong app cũ.) Cự ly xa nhất không đổi; chỉ phân loại cụt / đôi khác. Cần chủ nhiệm xác nhận theo bản vẽ.
- **tm-v4, xh-z5:** app cũ nới ô thang thiếu cho đủ 3.000 mm (QT-60) và kéo đầu hành lang theo Circle CAD (QT-54, dữ liệu
  `hanhlang_moc` chưa chép sang app mới) nên cửa buồng đệm dời vài trăm mm. App mới đọc đúng điểm chèn trong `toa.json`.
- **Tủ PCCC:** app mới mới làm phủ tham lam trên tường hai bên hành lang (bước 600 mm, cách cửa ≥ ½ tủ + 600 mm). App cũ có thêm
  ưu tiên lõi / hộp KT, ràng buộc đầu cột, né cửa ngăn cháy và lời giải phủ chính xác (QT-77e/f/g) — chưa chuyển.
- **Mạng hành lang liền (3.3.5):** app mới cộng cả đoạn nét vẽ tay thò ra ngoài trục; app cũ cộng đoạn sảnh thang máy. Hai số khác
  nhau 0–52 m, nhưng kết luận giống nhau: tm-i2 < 60 m ở cả hai app, 32 tòa còn lại > 60 m (phải chia).
"""


def ghi_doc(q: dict) -> None:
    bt = {b["ma"]: b for b in q["buoc"]}
    t = q["thong_ke"]
    d = ["# Quy tắc xếp căn và kiểm tra QCVN / PCCC", "",
         "Sinh bằng `python scripts/chep_quy_tac.py --nguon <MDI_Unitmix_v4>` từ `rules/*.yaml` (luật đang chạy ở panel Tuân thủ app cũ)",
         "và `docs/QUY_TAC_XEP_CAN.md` (QT-xx). Dữ liệu máy đọc: `web/public/lib/quy_tac.json`; mã nạp: `web/src/tinh/quyTac.ts`.",
         "Ngưỡng, điều khoản và cách tính giữ nguyên app cũ; biểu thức JS trong yaml không chép, thay bằng ngưỡng số + `ma_kiem`.", "",
         f"**Thống kê:** {t['luat_yaml']} luật yaml + {t['qt_goc']} mã QT gốc → **{t['luat_moi']} luật** ở app mới. "
         f"QT giữ (gộp vào luật) {t['qt_giu']}, bỏ {t['qt_bo']}: "
         + ", ".join(f"{q['loai_bo'][k]} {n}" for k, n in t["bo_theo_loai"].items() if n) + ".", "",
         "Thứ tự theo bước làm của app mới; trong mỗi bước luật **bắt buộc** (QCVN / QĐ / chỉ tiêu QH) trước, luật nội bộ MDI sau.",
         "Cột *Hàm app mới*: ✔ = đã có hàm (ghi tên), — = chưa làm.", ""]
    for b in q["buoc"]:
        ds = [x for x in q["luat"] if x["buoc"] == b["ma"]]
        d += [f"## {b['tien_to']} · {b['ten_vi']}", ""]
        if not ds:
            d += ["App cũ chưa có luật cho bước này (sức chứa hầm đang tính ở `raiCho.ts` theo thông số người dùng nhập).", ""]
            continue
        d += ["| Mã | Luật | Bắt buộc | Ngưỡng | Nguồn | Mã cũ | Hàm app mới |", "|---|---|---|---|---|---|---|"]
        for x in ds:
            ng = "; ".join(f"{'' if n['chieu'] in ('<=', '=') else n['chieu'] + ' '}{n['gia_tri']} {n['don_vi']}".strip()
                           + (f" ({n['dieu_kien']})" if n.get("dieu_kien") else "") for n in x["nguong"]) or "—"
            ham = f"✔ {x['ham']}" if x["ham"] else "—"
            d.append(f"| {x['ma']} | {x['ten_vi']} | {'có' if x['bat_buoc'] else 'MDI'} | {ng} | {x['nguon']} | {', '.join(x['ma_cu'])} | {ham} |")
        d.append("")
    d += ["## QT đã bỏ", "", "| Mã cũ | Loại | Thay bởi | Lý do |", "|---|---|---|---|"]
    for x in q["qt_goc"]:
        if not x["giu"]:
            boi = (x["thay_the_boi"] or "") + (f" → {x['luat_moi']}" if x["luat_moi"] else "")
            d.append(f"| {x['ma_cu']} | {q['loai_bo'][x['loai_bo']]} | {boi or '—'} | {x['ly_do']} |")
    d += ["", "## QT giữ → luật mới", "",
          ", ".join(f"{x['ma_cu']} → {'/'.join(x['luat_moi'])}" for x in q["qt_goc"] if x["giu"]), "", DOI_CHIEU]
    (GOC / "docs" / "quy_tac_xep_can.md").write_text("\n".join(d), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--nguon", required=True, type=Path)
    ghi_doc(chep(ap.parse_args().nguon))
