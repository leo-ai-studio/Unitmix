# Quy tắc xếp căn và kiểm tra QCVN / PCCC

Sinh bằng `python scripts/chep_quy_tac.py --nguon <MDI_Unitmix_v4>` từ `rules/*.yaml` (luật đang chạy ở panel Tuân thủ app cũ)
và `docs/QUY_TAC_XEP_CAN.md` (QT-xx). Dữ liệu máy đọc: `web/public/lib/quy_tac.json`; mã nạp: `web/src/tinh/quyTac.ts`.
Ngưỡng, điều khoản và cách tính giữ nguyên app cũ; biểu thức JS trong yaml không chép, thay bằng ngưỡng số + `ma_kiem`.

**Thống kê:** 21 luật yaml + 132 mã QT gốc → **51 luật** ở app mới. QT giữ (gộp vào luật) 90, bỏ 42: bị QT sau thay 8, chỉ dành cho giao diện / cách vẽ app cũ 19, xuất / bóc CAD-BIM, không phải luật xếp 6, tính năng trợ lý AI 3, tính năng thao tác, không phải luật 5, đã thử và bỏ 1.

Thứ tự theo bước làm của app mới; trong mỗi bước luật **bắt buộc** (QCVN / QĐ / chỉ tiêu QH) trước, luật nội bộ MDI sau.
Cột *Hàm app mới*: ✔ = đã có hàm (ghi tên), — = chưa làm.

## LO · Lô / quy hoạch

| Mã | Luật | Bắt buộc | Ngưỡng | Nguồn | Mã cũ | Hàm app mới |
|---|---|---|---|---|---|---|
| LO-01 | Khoảng lùi công trình theo lộ giới × chiều cao | có | 0 m (H < 19 m); 3 m (đường < 19 m · H 19–22 m); 4 m (đường < 19 m · H 22–28 m); 6 m (H ≥ 28 m (mọi bề rộng đường)); 3 m (đường 19–22 m · H 22–28 m) | QCVN 01:2021/BXD §2.6.2 · Bảng 2.7 | QT-82, QT-118 | — |
| LO-02 | Khoảng cách giữa các tòa (cả nhà hiện hữu) | có | >= max(H/2, 7) m (H < 46 m · cạnh dài); >= max(H/3, 4) m (H < 46 m · đầu hồi); >= 25 m (H ≥ 46 m · cạnh dài); >= 15 m (H ≥ 46 m · đầu hồi) | QCVN 01:2021/BXD §2.6.1 | QT-82, QT-89 | — |
| LO-03 | Loại đất theo ký hiệu lô · chỉ lô ở mới đặt chung cư | MDI | — | MDI · QT-82 | QT-82 | ✔ sucChua.ts · sucChua (lô không phải đất ở → không ước số căn) |
| LO-04 | Chỉ tiêu một nguồn: dự án + lô | MDI | — | MDI · QT-107 | QT-107 | — |
| LO-05 | Tòa không ra khỏi chỉ giới xây dựng khi dời / xoay | MDI | — | MDI · QT-118 R3 | QT-118 | ✔ hopLo.ts · hopLo / vungDat (chân tòa nằm trong chỉ giới) |
| LO-06 | Bóng đổ lên lô bên cạnh / nhà hiện hữu | MDI | 8–16 giờ (ngày đông chí) | MDI · QT-84 · QT-89 | QT-84, QT-89 | — |

## MT · Chọn mẫu tòa

| Mã | Luật | Bắt buộc | Ngưỡng | Nguồn | Mã cũ | Hàm app mới |
|---|---|---|---|---|---|---|
| MT-01 | Mẫu tòa đúng dòng sản phẩm của lô | MDI | — | MDI · QT-82 (tối ưu lô) · QT-86 | QT-82, QT-86 | — |
| MT-02 | Bề rộng hành lang mặc định theo loại hình | MDI | 1800 mm (tm); 1600 mm (xh / tái định cư) | MDI · QT-16 · QT-5 | QT-16, QT-5 | — |
| MT-03 | Hiệu suất mặt bằng | MDI | >= 0.75 tỉ lệ | MDI target ≥75 % · 7 yếu tố slide 3 PPTX | mdi_eff | — |
| MT-04 | Thay lõi thang đúng loại hình, đúng mẫu | MDI | >= 2800 mm (bề rộng sảnh phân loại: ≥ 2.800 NOTM (3,0 m), < 2.800 NOXH (2,6 m)) | MDI · QT-71 · QT-72 · QT-74 · QT-90 | QT-71, QT-72, QT-72b, QT-74, QT-74b, QT-90 | — |
| MT-05 | Lập PA: vét mẫu tòa × cách xếp, chấm bằng chính bộ kiểm tra | MDI | — | MDI · QT-67 · QT-68 · QT-96 | QT-67, QT-68, QT-96 | — |
| MT-06 | Chấm hướng căn, căn góc, điểm view | MDI | 40 % (trọng số hướng); 30 % (thoáng); 20 % (cảnh quan); 10 % (nắng) | MDI · QT-88 · QT-111 | QT-88, QT-88b, QT-111 | — |

## XC · Xếp dãy căn

| Mã | Luật | Bắt buộc | Ngưỡng | Nguồn | Mã cũ | Hàm app mới |
|---|---|---|---|---|---|---|
| XC-01 | Vị trí căn / lõi / thang = điểm chèn XREF của bản vẽ | MDI | 2 mm (dung sai vị trí căn) | MDI · QT-1 · QT-6 · QT-7 | QT-1, QT-6, QT-7, QT-60 | ✔ pccc.ts · cuaTrenMat (đọc a0/a1/sx của phan_tu) |
| XC-02 | Phân loại khe trên dãy căn | MDI | > 20 mm (khe giữ lại khi > 20 mm); 400 mm (khe ≤ 400 = tường); 600 mm (400–600 = khe kỹ thuật); > căn rộng nhất + 500 mm (khe rộng hơn = hành lang chạy qua) | MDI · QT-2 · QT-9 · QT-21 · QT-32 | QT-2, QT-9, QT-21, QT-32 | — |
| XC-03 | Ô thang bộ rộng 3.000 mm, căn xếp khít vào | MDI | 3000 mm; 600 mm (khe hai bên được hút vào ô thang) | MDI · QT-10 · QT-60 | QT-10, QT-60 | — |
| XC-04 | Sửa căn thì dồn khít về lõi thang máy và mốc góc | MDI | — | MDI · QT-30 · QT-49 · QT-69 | QT-30, QT-8, QT-46, QT-46b, QT-48, QT-49, QT-49b, QT-49c, QT-56b, QT-57c, QT-62, QT-69 | — |
| XC-05 | Căn quanh lõi khít nét bao lõi MDI-BAO-TM như CAD | MDI | — | MDI · QT-22 · QT-22b · QT-47 · QT-56 | QT-22, QT-22b, QT-47, QT-56, QT-36 | — |
| XC-06 | Sảnh thang máy: NOTM 3,0 m · NOXH 2,6 m, căn dồn khít, hành lang qua tim sảnh | MDI | 3000 mm (tm); 2600 mm (xh / tái định cư) | MDI · QT-72 (thay QT-23) | QT-72, QT-23 | — |
| XC-07 | Hành lang nối liền các thanh, đi qua góc, vuông góc | MDI | 400 mm (gộp nút đồ thị); 16000 mm (giao hai trục kéo dài tối đa) | MDI · QT-19 · QT-25 · QT-51 · QT-54 | QT-19, QT-19b, QT-25, QT-51, QT-54, QT-55 | ✔ pccc.ts · dungDoThi |
| XC-08 | Đánh số căn CH-xx liên tục theo chu vi, một chiều | MDI | — | MDI · QT-20 | QT-20 | — |
| XC-09 | DTXD = diện tích nét bao (nét bao co / giãn theo căn, cả hốc logia) | MDI | — | MDI · QT-65 · QT-31 · QT-33 · QT-59 | QT-65, QT-31, QT-33, QT-59, QT-59b, QT-54 | — |
| XC-10 | Khe còn trống trên dãy căn | MDI | 200 mm | MDI · tổng bề rộng ô Còn trống, ≤ 0,2 m là khít | mdi_leftover | — |
| XC-11 | Tự sinh: xếp căn theo luật, không theo lượt chèn | MDI | — | MDI · QT-40…43 · QT-70 | QT-40, QT-41, QT-42, QT-43, QT-70 | — |
| XC-12 | Căn góc tòa V: ranh căn = khung CAD (polyline kín DefPoints) | MDI | — | MDI · QT-58 | QT-58 | — |
| XC-13 | Mọi lượt chèn căn / lõi / thang phải có trong thư viện | MDI | — | MDI · QT-61 | QT-61 | ✔ scripts/chep_thu_vien.py (_loi khi thiếu căn / lõi) |

## DC · Đổi mẫu căn

| Mã | Luật | Bắt buộc | Ngưỡng | Nguồn | Mã cũ | Hàm app mới |
|---|---|---|---|---|---|---|
| DC-01 | Diện tích căn tối thiểu | có | >= 25 m² (DT thông thủy mỗi căn) | QCVN 04:2021 · DT căn hộ ≥ 25 m² | qcvn04_min_area | — |
| DC-02 | Tỷ lệ căn ≤45 m² | MDI | 25 % (số căn có DT thông thủy ≤ 45 m²) | MDI · QCVN 04:2021 (đề xuất MDI) | qcvn04_small_ratio | — |
| DC-03 | Tòa NOTM chỉ dùng căn NOTM (và ngược lại) | MDI | — | MDI · QT-66 | QT-66 | — |
| DC-04 | STRETCH mẫu căn qua phòng khách | MDI | 100 mm (bước); 500 mm (co / giãn tối đa ±) | MDI · QT-81 | QT-81, QT-81b | — |
| DC-05 | Tối ưu trong một mẫu tòa: đổi mẫu căn từng ô + lõi + thang bộ | MDI | 3 PA (giữ top) | MDI · QT-79 · QT-96 | QT-79, QT-96 | — |

## PC · PCCC / thoát nạn

| Mã | Luật | Bắt buộc | Ngưỡng | Nguồn | Mã cũ | Hàm app mới |
|---|---|---|---|---|---|---|
| PC-01 | Căn xa lối thoát nhất | có | 25 m (H ≤ 75 m · căn ở hành lang cụt); 40 m (H ≤ 75 m · căn giữa hai buồng thang); 15 m (H > 75 m · cụt); 20 m (H > 75 m · giữa hai buồng thang) | QCVN 06:2022 3.3.2 · Bảng G.1 / A.2.19 | qcvn06_travel_max, QT-45, QT-15, QT-25 | ✔ pccc.ts · thoatNan / kiemTraPCCC |
| PC-02 | Hành lang cụt tới lối thoát | có | 25 m (H ≤ 75 m); 15 m (75 < H ≤ 150 m) | QCVN 06:2022 Bảng G.1 (H ≤ 75 m) / A.3.1.7 → A.2.19 (H > 75 m) | qcvn06_deadend, QT-24 | ✔ pccc.ts · thoatNan / kiemTraPCCC |
| PC-03 | Cự ly căn giữa hai buồng thang | có | 40 m (H ≤ 75 m); 20 m (75 < H ≤ 150 m) | QCVN 06:2022 Bảng G.1 (H ≤ 75 m) / A.3.1.7 → A.2.19 (H > 75 m) | qcvn06_two_stairs_travel, QT-24 | ✔ pccc.ts · thoatNan / kiemTraPCCC |
| PC-04 | Diện tích khoang cháy (F1.3) | có | 2500 m² (H ≤ 75 m (nhà ở kiểu căn hộ, bậc I, S0)); 2000 m² (H > 75 m) | QCVN 06:2022 Bảng H.1 / A.3.1.3 → A.2.3 | qcvn06_compartment, QT-24 | — |
| PC-05 | Khoang hành lang căn hộ | có | 30 m (chỉ áp khi H > 75 m) | QCVN 06:2022 A.2.14 (qua A.3.1.7) | qcvn06_A214_corridor, QT-95, QT-98, QT-100, QT-104, QT-104c | — |
| PC-06 | Chia hành lang dài > 60 m | có | 60 m (mọi chiều cao) | QCVN 06:2022 3.3.5 | qcvn06_335_corridor, QT-98 | ✔ pccc.ts · kiemTraPCCC (báo mạng hành lang liền chưa chia) |
| PC-07 | Thang máy chữa cháy | có | >= 1 thang (khi H PCCC > 50 m hoặc hầm sâu > 9 m) | QCVN 06:2022 §6.13 + 1.4.9 | qcvn06_613_firelift | — |
| PC-08 | Họng nước chữa cháy trong nhà (tủ âm tường) | có | 18 m (bán kính phục vụ ĐO THẲNG từ tủ tới mọi điểm phải bảo vệ); 2 tia (mỗi điểm khi số tia tính toán ≥ 2); >= 3 m (hai vị trí tủ cách nhau tối thiểu); 800 mm (tủ đôi / cụm 2 hộp × 200); 500 mm (tủ đơn × 200) | QCVN 06:2022 5.2 · Bảng 11 · 5.2.4 · 5.2.7 · 5.2.11 · 5.2.14 · thẩm duyệt PC07 (R 18 m) | qcvn06_52_hong_nuoc, QT-77, QT-77b, QT-77c, QT-77d, QT-77e, QT-77f | ✔ pccc.ts · tuPCCC (phủ tham lam, chưa ưu tiên lõi / HKT) |
| PC-09 | Chiều cao PCCC | có | 150 m | QCVN 06:2022 1.4.9 · nhà F1.3 75–150 m thuộc sheet 4 | mdi_hpccc | ✔ pccc.ts · chieuCaoPCCC |
| PC-10 | Số thang thoát nạn | MDI | 2 thang (đạt); 3 thang (tối đa (3 = cảnh báo)) | MDI slide 40 · chủ nhiệm 12/9/2026 · QT-57 | qcvn06_escape_stairs, QT-57 | ✔ pccc.ts · kiemTraPCCC |
| PC-11 | Thang bộ tự động: thêm cạnh căn tệ nhất, cắt bớt giữ ≥ 2 | MDI | >= 2 thang (tối thiểu sau khi cắt bớt) | MDI · QT-44 · QT-63 | QT-44, QT-63 | — |
| PC-12 | Quy tắc đặt cửa ngăn cháy hành lang | MDI | 1800 mm (cửa tm = bề rộng HL); 1600 mm (cửa xh); 150 mm (bù tường); >= 600 mm (mép cửa căn / thang / lõi / tủ cách tim cửa ngăn); >= 5 m (khoang tối thiểu); 5 ° (lệch vuông góc tối đa) | MDI · QT-105 (R1–R7) | QT-105, QT-103, QT-99, QT-100, QT-104, QT-104c | — |
| PC-13 | Cánh cửa ngăn cháy HL che cửa căn / thang | MDI | 0 cửa (cửa có cánh quét qua cửa căn / buồng đệm / lõi / tủ) | MDI · chủ nhiệm 19/10/2026 · QT-105 R4b | mdi_cnc_quet, QT-99 | — |
| PC-14 | Tủ PCCC ở tường căn: trừ DT thông thủy, căn thành mẫu đặc biệt | MDI | 295 mm (sâu tủ + tường xây sau + hoàn thiện); 95 mm (chữ L thêm một bên); 190 mm (chữ U thêm hai bên) | MDI · QT-77g | QT-77g | — |

## HA · Hầm

App cũ chưa có luật cho bước này (sức chứa hầm đang tính ở `raiCho.ts` theo thông số người dùng nhập).

## CT · Chỉ tiêu

| Mã | Luật | Bắt buộc | Ngưỡng | Nguồn | Mã cũ | Hàm app mới |
|---|---|---|---|---|---|---|
| CT-01 | Mật độ xây dựng | có | MĐXD lô (QH) %; Bảng 2.9 (nội suy theo DT lô × chiều cao) % | QCVN 01:2021 · Bảng 2.9 · MĐXD tối đa theo QH | qcvn01_mdxd, QT-82 | ✔ chiTieu.ts · tinhChiTieu (matDo, chưa có Bảng 2.9) |
| CT-02 | Hệ số sử dụng đất | có | HSSDĐ lô (QH) lần; Bảng 2.12 (nội suy) — chỉ báo lần | QCVN 01:2021 · Bảng 2.12 · HSSDĐ tối đa | qcvn01_far, QT-82 | ✔ chiTieu.ts · tinhChiTieu (dtSan ≤ HSSDĐ × DT lô) |
| CT-03 | Tầng cao ≤ chỉ tiêu lô | có | tầng cao lô (QH) tầng | Chỉ tiêu QH lô · QT-82 | QT-82 | ✔ chiTieu.ts · tinhChiTieu (tangCao) |
| CT-04 | Dân số công trình | có | dân số tối đa lô (QH) người | QĐ 34/2024/QĐ-UBND (Hà Nội) · TP.HCM QĐ 83/2026 hoặc QĐ 32/2025 chuyển tiếp (QT-134) | qd34_pop, QT-134 | ✔ chiTieu.ts · tinhChiTieu (danSo = số căn × người/căn) |
| CT-05 | Số thang máy bố trí | MDI | >= min(⌈căn / 70⌉, ⌈dân / 200⌉) thang | QCVN 04:2021 · bảng chuẩn Viện · QT-76 · QT-94 | mdi_lift_provided, QT-76, QT-94, QT-64, QT-75, QT-75b | — |
| CT-06 | Thang máy theo số căn | MDI | 70 căn/thang | Bảng chuẩn Viện Thiết Kế | mdi_lift_unit | — |
| CT-07 | Thang máy theo dân số | MDI | 200 người/thang | Bảng chuẩn Viện Thiết Kế | mdi_lift_pop | — |

## QT đã bỏ

| Mã cũ | Loại | Thay bởi | Lý do |
|---|---|---|---|
| QT-3 | chỉ dành cho giao diện / cách vẽ app cũ | — | cắt nét vẽ căn về mô-đun ±125 mm (clipPath) — cách vẽ SVG |
| QT-4 | chỉ dành cho giao diện / cách vẽ app cũ | — | vành tường 125 mm do app vẽ — cách vẽ |
| QT-8 | bị QT sau thay | QT-30 → XC-04 | đoạn xoá căn để lại khe bỏ từ 04/9/2026; phần dồn khít gộp vào mdi_don_khit |
| QT-11 | chỉ dành cho giao diện / cách vẽ app cũ | — | bảng thông tin căn đặt ngoài căn |
| QT-12 | chỉ dành cho giao diện / cách vẽ app cũ | — | nét theo layer |
| QT-13 | chỉ dành cho giao diện / cách vẽ app cũ | — | nhãn dẹt trong bảng |
| QT-14 | chỉ dành cho giao diện / cách vẽ app cũ | — | khe ≤ 400 mm không tô màu |
| QT-15 | bị QT sau thay | QT-45 → PC-01 | công thức cũ cộng bề rộng hành lang; QT-45 bỏ phần cộng |
| QT-17 | chỉ dành cho giao diện / cách vẽ app cũ | — | tô màu căn theo đường bao tim tường |
| QT-18 | chỉ dành cho giao diện / cách vẽ app cũ | — | tô hành lang không vượt nét bao |
| QT-23 | bị QT sau thay | QT-72 → MT-04 | sảnh NOXH 3.000 mm; QT-72 chốt NOTM 3,0 m · NOXH 2,6 m |
| QT-26 | chỉ dành cho giao diện / cách vẽ app cũ | — | định dạng tệp lưu PA của app cũ |
| QT-27 | chỉ dành cho giao diện / cách vẽ app cũ | — | bố cục dải KPI |
| QT-28 | xuất / bóc CAD-BIM, không phải luật xếp | — | phiếu .scr AutoCAD |
| QT-29 | xuất / bóc CAD-BIM, không phải luật xếp | — | XCLIP khi xuất CAD |
| QT-39 | bị QT sau thay | QT-54 → XC-07 | lọc góc trong cho điểm kéo hành lang; thay bằng Circle CAD |
| QT-46c | bị QT sau thay | QT-49 → XC-04 | mốc góc so đầu mặt với đầu mặt — sai, thay bằng điểm nối trục |
| QT-48 | bị QT sau thay | QT-57 → PC-10 | thang neo tại chỗ thả; QT-57 cho thang dồn như căn |
| QT-50 | chỉ dành cho giao diện / cách vẽ app cũ | — | viền tô lõi hub răng cưa |
| QT-52 | đã thử và bỏ | QT-54 → XC-07 | ghi đè a0/a1 trục bằng toạ độ MDI-HANHLANG — thử và bỏ, thay bằng Circle CAD (QT-54) |
| QT-53 | chỉ dành cho giao diện / cách vẽ app cũ | — | vá góc chéo hành lang hub khi tô |
| QT-68 | tính năng trợ lý AI | — | trợ lý AI đọc đầu bài (phần tối ưu số tầng gộp vào mdi_lap_pa) |
| QT-73 | chỉ dành cho giao diện / cách vẽ app cũ | — | giữ lõi đã thay qua regenerate() — trạng thái app cũ |
| QT-78 | tính năng trợ lý AI | — | cầu Claude Code |
| QT-80 | tính năng trợ lý AI | — | AI soát số thuyết minh |
| QT-83 | chỉ dành cho giao diện / cách vẽ app cũ | — | nút Lưu + Cài đặt |
| QT-85 | chỉ dành cho giao diện / cách vẽ app cũ | — | không gian làm việc ② ③ |
| QT-87 | tính năng thao tác, không phải luật | — | nạp dự án tự điền ① ② ③ |
| QT-91 | tính năng thao tác, không phải luật | — | nạp .dxf trong app |
| QT-92 | tính năng thao tác, không phải luật | — | tự đặt cho mọi lô đã tick |
| QT-93 | tính năng thao tác, không phải luật | — | chạy nền có tiến độ |
| QT-95 | bị QT sau thay | QT-98 → PC-05 | đo khoang theo từng trục riêng; QT-98 đo trên đồ thị |
| QT-97 | chỉ dành cho giao diện / cách vẽ app cũ | — | chọn nhiều căn |
| QT-101 | chỉ dành cho giao diện / cách vẽ app cũ | — | kéo tay cửa ngăn cháy (ràng buộc vị trí = mdi_cua_ngan_chay) |
| QT-102 | chỉ dành cho giao diện / cách vẽ app cũ | — | xoá / lật hàng loạt |
| QT-104b | bị QT sau thay | QT-104c → PC-05 | cửa miệng sảnh TM — QT-104c bỏ hẳn |
| QT-106 | tính năng thao tác, không phải luật | — | kho mẫu dự án + hàng chờ |
| QT-108 | chỉ dành cho giao diện / cách vẽ app cũ | — | LOD hiển thị căn ở ③ |
| QT-109 | xuất / bóc CAD-BIM, không phải luật xếp | — | khối 3D glTF |
| QT-112 | xuất / bóc CAD-BIM, không phải luật xếp | — | IFC4 |
| QT-113 | xuất / bóc CAD-BIM, không phải luật xếp | — | phiếu lắp ghép Revit |
| QT-118b | xuất / bóc CAD-BIM, không phải luật xếp | — | script bóc CGXD từ CAD (đầu vào, không phải luật) |

## QT giữ → luật mới

QT-1 → XC-01, QT-2 → XC-02, QT-5 → MT-02, QT-6 → XC-01, QT-7 → XC-01, QT-9 → XC-02, QT-10 → XC-03, QT-16 → MT-02, QT-19 → XC-07, QT-19b → XC-07, QT-20 → XC-08, QT-21 → XC-02, QT-22 → XC-05, QT-22b → XC-05, QT-24 → PC-02/PC-03/PC-04, QT-25 → XC-07/PC-01, QT-30 → XC-04, QT-31 → XC-09, QT-32 → XC-02, QT-33 → XC-09, QT-36 → XC-05, QT-40 → XC-11, QT-41 → XC-11, QT-42 → XC-11, QT-43 → XC-11, QT-44 → PC-11, QT-45 → PC-01, QT-46 → XC-04, QT-46b → XC-04, QT-47 → XC-05, QT-49 → XC-04, QT-49b → XC-04, QT-49c → XC-04, QT-51 → XC-07, QT-54 → XC-07/XC-09, QT-55 → XC-07, QT-56 → XC-05, QT-56b → XC-04, QT-57 → PC-10, QT-57c → XC-04, QT-58 → XC-12, QT-59 → XC-09, QT-59b → XC-09, QT-60 → XC-01/XC-03, QT-61 → XC-13, QT-62 → XC-04, QT-63 → PC-11, QT-64 → CT-05, QT-65 → XC-09, QT-66 → DC-03, QT-67 → MT-05, QT-69 → XC-04, QT-70 → XC-11, QT-71 → MT-04, QT-72 → MT-04/XC-06, QT-72b → MT-04, QT-74 → MT-04, QT-74b → MT-04, QT-75 → CT-05, QT-75b → CT-05, QT-76 → CT-05, QT-77 → PC-08, QT-77b → PC-08, QT-77c → PC-08, QT-77d → PC-08, QT-77e → PC-08, QT-77f → PC-08, QT-77g → PC-14, QT-79 → DC-05, QT-81 → DC-04, QT-81b → DC-04, QT-82 → LO-01/LO-02/LO-03/MT-01/CT-01/CT-02/CT-03, QT-84 → LO-06, QT-86 → MT-01, QT-88 → MT-06, QT-88b → MT-06, QT-89 → LO-02/LO-06, QT-90 → MT-04, QT-94 → CT-05, QT-96 → MT-05/DC-05, QT-98 → PC-05/PC-06, QT-99 → PC-12/PC-13, QT-100 → PC-05/PC-12, QT-103 → PC-12, QT-104 → PC-05/PC-12, QT-104c → PC-05/PC-12, QT-105 → PC-12, QT-107 → LO-04, QT-111 → MT-06, QT-118 → LO-01/LO-05

## Đối chiếu kết quả PCCC với app cũ

App cũ chạy headless (`scripts/chay_selftest.js --jsfile`, MDI_Unitmix_v4 @ `7373a5a`, mặc định 26 tầng, H PCCC 90,5 m → ngưỡng
cụt 15 m / đôi 20 m), đọc `metrics(buildGeom())` và `tuCC()` của từng mẫu tòa; app mới chạy `web/src/tinh/pccc.ts` trên `toa.json`
cùng tham số. Cự ly tính bằng m. Dạng ô: **mới / cũ**.

| Tòa | Cụt xa nhất | Giữa hai thang xa nhất | Căn xa nhất | Số căn cụt / đôi | Căn vượt | Thang bộ | Vị trí tủ PCCC |
|---|---|---|---|---|---|---|---|
| tm-i1 | 17,48 / 17,48 | 19,64 / 19,64 | 19,64 / 19,64 | 13·15 / 13·15 | 2 / 2 | 2 / 2 | 5 / 4 |
| tm-u2 | 13,84 / 13,78 | 14,73 / 14,73 | 14,73 / 14,73 | 10·17 / 10·17 | 0 / 0 | 3 / 3 | 7 / 6 |
| tm-z1 | 19,37 / 19,37 | 9,93 / 9,93 | 19,37 / 19,37 | 18·6 / 18·6 | 6 / 6 | 2 / 2 | 5 / 4 |
| xh-y1 | 15,94 / 15,94 | 16,92 / 16,92 | 16,92 / 16,92 | 15·10 / 15·10 | 2 / 2 | 3 / 3 | 4 / 4 |
| tm-l1 | 19,29 / 19,29 | 18,81 / 18,81 | 19,29 / 19,29 | 8·17 / 8·17 | 2 / 2 | 2 / 2 | 5 / 4 |
| tm-t1 | 12,12 / 12,12 | 19,03 / 19,03 | 19,03 / 19,03 | 6·27 / 6·27 | 0 / 0 | 3 / 3 | 6 / 5 |

**Sau khi chủ nhiệm chốt "như app cũ tính" (27/10/2026):** app mới dùng đúng đồ thị hành lang app cũ dựng cho bố cục gốc
(`toa.json → hanh_lang`, `cua_thang`, chép bằng `scripts/hanh_lang_cu.js` chạy headless trong repo cũ, lưu ở
`scripts/du_lieu/hanh_lang_cu.json`): đầu trục theo vòng tròn mốc CAD (QT-54) và mép ô đặc, trục tách theo mốc (xh-u1: B1/B2),
đoạn nối góc vẽ tay giữ làm cạnh riêng kể cả khi trùng trục (QT-51), cửa buồng thang sau khi nới ô thang thiếu (QT-60).
Cửa căn / cửa thang chỉ gán vào trục thật song song với mặt (như `axAt`/`viTri`).

Kết quả: **28/33 tòa khớp hoàn toàn** (số căn cụt / đôi, căn vượt, cụt xa nhất, đôi xa nhất). 5 tòa V (tm-v1…v4, xh-v1) chỉ
lệch đúng **2 căn góc trên mặt xiên** mỗi tòa: mặt này không song song trục nào, app cũ lấy toạ độ dọc mặt xiên đặt thẳng lên
trục A (tm-v1 CH-08 ra 1,3 m, xh-v1 CH-01 ra 0,4 m cho căn thực tế cách thang 11–21 m). App mới gán hai căn này vào đoạn nối
góc song song với mặt (đường đi thật, thoát hai hướng). Ngoài 10 căn đó, mọi căn của 33 tòa khớp app cũ.

Chỗ lệch còn lại:

- **Đổi bố cục:** đồ thị app cũ chép cho bố cục GỐC. Khi đổi / kéo căn cuối dãy, app cũ dời đầu hành lang theo mép ô đặc;
  app mới chưa làm phần này (dùng nguyên đồ thị gốc).
- **Tủ PCCC:** app mới mới làm phủ tham lam trên tường hai bên hành lang (bước 600 mm, cách cửa ≥ ½ tủ + 600 mm). App cũ có thêm
  ưu tiên lõi / hộp KT, ràng buộc đầu cột, né cửa ngăn cháy và lời giải phủ chính xác (QT-77e/f/g) — chưa chuyển.
- **Mạng hành lang liền (3.3.5):** số đo trước khi chuyển sang đồ thị app cũ: hai app khác nhau 0–52 m, nhưng kết luận giống nhau: tm-i2 < 60 m ở cả hai app, 32 tòa còn lại > 60 m (phải chia).
