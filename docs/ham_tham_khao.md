# Hầm: hồ sơ tham khảo và căn cứ (đợt 2, 2026-10-29)

Tài liệu này ghi lại hồ sơ bản vẽ hầm đã có trên máy, những gì học được từ đó, và điều khoản quy chuẩn dùng trong bộ rải hầm (`web/src/tinh/ham.ts`, `hamBoTri.ts`, `hamPhong.ts`). Quy chuẩn đọc từ kho PDF trên máy (trích chữ bằng PyMuPDF), không lấy từ trí nhớ. Mỗi số trong mã có ghi căn cứ. Số không có căn cứ quy chuẩn được ghi là **tạm** (hiện nhãn "tạm" trên màn Hầm) và chờ chủ nhiệm chốt.

App cũ `E:\Projects\MDI_Unitmix_v4` không có phần hầm. Tệp `docs\de_xuat_du_toan.md:36` của app cũ ghi rõ mẫu chuẩn không có hầm.

## 1. Hồ sơ bản vẽ đã đọc

| # | Hồ sơ | Tệp | Đã học |
|---|---|---|---|
| 1 | Đan Phượng M1, hầm đế B1 + B2 (TADT concept, 02/2026) | `E:\OneDrive\2025-Tan A\5.TADT-Dan Phuong-M1-2-5\M1\02_CONCEPT\CT-PVT\260115.LO T1-Ham sua\260204.M1-HAM.pdf` (tr.1 = B2, tr.2 = B1) | Hầm liền dưới 5 tháp, khoảng 13 vùng cháy. B1 chủ yếu xe máy. Ram thẳng đặt thành cặp dọc tường ngoài ("LỐI XUỐNG HẦM B2" chồng lên "LỐI LÊN HẦM B1"). B2: bể SH 836 m³ + 1 133 m³ sâu 2,7 m, P. bơm SH 40–73 m², bể XLNT sâu 3 m 286–403 m², P. vận hành 33,6–47 m². B1: mỗi tháp một TBA (trung thế + MBA + hạ thế) với MFĐ 1 250 kVA, khoảng 49–83 m². Có an ninh 42,5 m², kích sóng 21,2 m², rác ướt / khô, mỗi lõi một phòng rác, một hộp hút khói hành lang và hai hộp tăng áp. Có 26 louver bù gió 3 000 × 800. |
| 2 | Đông Quan, hỗn hợp, VNCC TKKT, B3 + B2 | `E:\OneDrive\2025-Tan A\1.TADT-Dong Quan\09_CHUNGCHI_XANH\...\PDF\DQ-HH-BVTC.rvt - Sheet_ AA3-02-002 - MẶT BẰNG TẦNG HẦM B3.pdf` | Mỗi tầng 9 514 m², chia 2 khoang cháy khoảng 4 750 m², có sprinkler. Mỗi tầng 183 ô tô + 318–339 xe máy + 4 chỗ xe lăn. Hai lõi chung cư, khoảng 6 thang mỗi tầng. Một ram thẳng kín có phòng đệm, dài khoảng 21–22 m, rộng khoảng 6,5 m. Phòng quạt cấp / thải ở 4 góc sát tường ngoài. Bố trí chỗ đỗ: một dãy dọc tường ngoài, giữa sàn là các dãy đôi nằm trong một vòng làn. Bể SH 580 m³. |
| 3 | KDAS / Dream City B1, Vinhomes INNO (03/2023) | `G:\Work\@Vinhomes\0.VTK_2023\17.Dan Phuong\ZONE CHAY\230301_DCHY.KDAS Concept dieu chinh ham KDAS 2.pdf` | 11 khoang, mỗi khoang 1 729–2 989 m² (≤ 3 000). Mỗi khoang ≥ 2 lối ra rộng 1,2 m, khoang đông xe máy có 3 lối. Mỗi khoang có phòng quạt riêng 27–63 m². Giữa các khoang có rèm ngăn cháy. Thang cách nhau khoảng 40 m. Bảng phòng: hạ thế 74, MBA khô 41, trung thế 23, bể PCCC 111, bơm PCCC 51, bơm SH 36, trực PCCC 31, an ninh 22, điện nhẹ 22, kho vật tư 25 m². Khoảng 25 m²/ô tô, 3 m²/xe máy. Xe điện khoảng 10% ô tô, xe máy điện khoảng 21% xe máy. |
| 4 | Vinhomes chuẩn hoá đỗ xe (2022) và bổ sung xe điện (2023) | `E:\OneDrive\1.VINHOMES\#TieuChuan\220714_XD_VTK_TCTK_CHUAN HOA DO XE.pdf`, `230505_VTK_VH_TKDH_DOXE_Ver1 (bo xe dien).pdf` | Chỗ đỗ 2,4 × 5,0. Làn hai chiều 6,95–10,7. Mô-đun 15,5–20,1 m. Xe lăn 3,5 × 5. Sạc 2,5 × 5. Xe máy 0,8 × 1,8, lối chính ≥ 1,8, lối phụ ≥ 1,5. |
| 5 | Đại An, nguyên lý M&E hầm đỗ xe | `E:\OneDrive\1.VINHOMES\#ThamKhao\221024_230106_DAHY_Nguyen ly va PA he thong ME ham de xe va cac lo canh quan.pdf` | Quạt thải kiêm hút khói chạy 6 lần/h, khi cháy 9 lần/h. Cấp gió tươi khoảng 80% gió thải. Quạt đặt trong phòng quạt ở hầm, chịu 300 °C trong 2 h. Bể SH dự trữ 1,5 ngày, chia 2 ngăn, đặt ở tầng hầm dưới. |

Hồ sơ có nhưng chưa đọc, vì chỉ có DWG hoặc tệp quá lớn:

- Đông Quan: `04_TKKT_PCCC\2.MẶT BẰNG TẦNG HẦM-06.dwg`, `251209.MB DO XE\` B1–B4, `SS4-10-DUONG DOC.dwg`.
- Đầm Liêng: B3 bản phát hành.
- M1: `260106.M1 - Mat bang Layout Hầm + Đế.pdf` (14 MB).
- TDC Quang Trung.
- Nam Trang Cát: tính đỗ xe.

Không có tệp DXF hầm nào trên máy.

### Mẫu hình đưa vào bộ rải

| Mẫu hình | Lấy từ hồ sơ | Cách làm trong mã |
|---|---|---|
| Khoang cháy ≤ 3 000 m², mỗi khoang có phòng quạt và louver / hộp gió riêng | KDAS, M1 | `chiaKhoang`, cụm quạt mỗi khoang (`timChoSatTuong`) |
| Mỗi khoang ≥ 2 lối ra, thang cách nhau khoảng 40 m | KDAS | `datThang` |
| Ram thẳng chồng tầng dọc tường ngoài, rộng khoảng 6,5 m, dài 21–25 m | M1, Đông Quan | `datRamTuDong`: ram rộng 6,5, dài 24 (gồm hai đoạn chuyển dốc 3,6 m), có đoạn thẳng 6 m ở hai đầu (tạm) |
| Vòng làn quanh các dãy đôi, một dãy dọc tường | Đông Quan | đường ngang ở hai đầu, dải chỗ quay đầu hầm, đoạn nối làn quanh lõi |
| TBA khô, máy phát, an ninh ở B1; bể nước, bơm, XLNT ở tầng dưới | M1, KDAS, DAHY | `chuongTrinhPhong` |

## 2. Điều khoản quy chuẩn đã dùng (kho `E:\OneDrive\_QCVN-TCVN`, `E:\OneDrive\1.VINHOMES\#QCVN-TCVN`)

| Luật trong mã | Trị số | Căn cứ | Trích ngắn |
|---|---|---|---|
| Khoang cháy hầm gara | ≤ 3 000 m² mỗi tầng mỗi khoang (bậc I, S0) | QCVN 13:2018/BXD 2.2.2 a), Bảng 4 | "I S0 5 3.000" |
| DT khoang không tính buồng thang | — | QCVN 06:2022/BXD H.6.2 | — |
| Số lối ra mỗi khoang | ≥ 2, phân tán | QCVN 13:2018 2.2.1.14; QCVN 06:2022 3.2.6.1 e) | "không ít hơn hai lối thoát nạn phân tán" |
| Cự ly thoát nạn trong hầm | 40 m (giữa hai lối ra), 20 m (cụt) | QCVN 13:2018 Bảng 3 | "Ngầm 40 20" |
| Lối ra sang khoang kề | ≤ 50% số lối ra, trừ khi khoang kề là F5 | QCVN 06:2022 3.2.4 | "không quá 50 % lối ra thoát nạn dẫn vào khoang cháy lân cận" |
| Thang hầm ra thẳng ngoài nhà | — | QCVN 06:2022 3.2.2 a) | — |
| Tường ngăn cháy loại 1 / cửa ngăn cháy loại 1 | REI 150 / EI 60 | QCVN 06:2022 Bảng 1, 2 | "REI 150" |
| Hút khói gara kín | bắt buộc | QCVN 06:2022 D.2 h); QCVN 13:2018 2.3.3.4 | "Các gara giữ xe kín, ngầm hoặc nổi" |
| Thông gió tách riêng từng tầng | — | QCVN 13:2018 2.3.3.1 | "hệ thống thông gió cần được tách riêng cho từng tầng" |
| Số lần trao đổi không khí | ≥ 6 lần/h, khi hút khói 9 lần/h | QCVN 04:2021/BXD 2.6.5 | "không nhỏ hơn 6 lần/h… và 9 lần/h" |
| Lỗ mở thoát khói tự nhiên (chỉ để tham chiếu) | ≥ 0,2% DT sàn; không áp cho gara trong nhà có công năng khác | QCVN 13:2018 2.3.3.5 | "không được nhỏ hơn 0,2% diện tích phòng" |
| Số làn ram theo số xe | ≤ 100 xe: 1 làn; ≤ 1 000: một ram đôi hoặc hai ram đơn; > 1 000: hai ram đôi | QCVN 13:2018 2.2.1.11 | "Đến 1.000 xe: một đường dốc đôi hoặc hai đường dốc đơn" |
| Dốc ram | thẳng có mái ≤ 18%, cong ≤ 13%, hở ≤ 10%; dốc ngang ≤ 6% | QCVN 13:2018 2.2.1.28 | — |
| Đổi dốc ở đỉnh / chân ram | ≤ 12,5% (vồng), ≤ 15% (lõm) | QCVN 07-11:2025/BXD **dự thảo** 2.4.3.8.3 | "12,5 % (tỉ lệ 1/8)" |
| Bán kính quay trong hầm | ≥ 6 m | QCVN 07-11:2025 **dự thảo** 2.4.7.4.3 | "không nhỏ hơn 6 m" |
| Đường xe chạy | hai chiều thẳng ≥ 6 m, cong ≥ 7 m, một chiều ≥ 4 m | QCVN 07-11:2025 **dự thảo** 2.4.3.4 | "Đường hai chiều cong: không nhỏ hơn 7 m" |
| Chỗ đỗ | 2,3 × 5,0 m; xe lăn rộng 3,5 m | QCVN 13:2018 2.2.1.25 | "Chiều dài: 5 m… Chiều rộng: 2,3 m" |
| Chỗ xe máy | ≥ 0,75 × 2,0 m; lối một chiều ≥ 1,5 m; khu xe máy tách khỏi ô tô | QCVN 07-11:2025 **dự thảo** 2.4.2.2, 2.4.3.4, 2.3.2.4 | "bố trí riêng khu vực đỗ xe ô-tô với khu vực để xe mô tô" |
| Số chỗ xe lăn | 6–50: 1; 51–100: 2; 101–150: 3; 151–200: 4; > 200: 5 + 1 cho mỗi 100 xe thêm (lấy tròn lên) | QCVN 10:2024/BXD 2.1.1, Bảng 1 | "5 + 1 chỗ cho mỗi lần thêm 100 xe" |
| Chỗ xe lăn đặt gần lối vào | — | QCVN 10:2024 2.1.2 | "gần đường vào, lối vào công trình" |
| Chỗ sạc ô tô | ≥ 10% số chỗ (phương án 3) | QCVN 07-11:2025 **dự thảo** 2.3.5 | — |
| Phân vùng sạc | ≤ 25 chỗ ô tô; khoang cháy khu sạc ≤ 1 200 m² | Dự thảo SĐ 01:2026 QCVN 04 2.10.2.1 b), f) | — |
| DT đỗ xe | ≥ 25 m²/4 căn và ≥ 20 m²/100 m² DT căn; trong đó ≥ 6 m² xe máy mỗi căn | QCVN 04:2021 2.2.17.1 b) | "tối thiểu là 25 m2 cho 4 căn hộ" |
| Thông thủy hầm | ≥ 2,0 m | QCVN 04:2021 2.2.10 | — |
| Phòng rác | ở tầng 1, nửa hầm hoặc hầm 1; thông thủy ≥ 2,5 m | QCVN 04:2021 2.7.3 | "chiều cao thông thủy không dưới 2,5 m" |
| Biến thế | chỉ loại khô, chỉ ở hầm 1 | QCVN 13:2018 2.2.2 b) | "trạm biến thế (chỉ với biến thế khô)" |
| Máy phát | không đặt sâu hơn hầm 1 | QCVN 06:2022 A.2.10 | — |
| Nước sinh hoạt | ≥ 80 L/người/ngày đêm | QCVN 01:2021/BXD 2.10.2 | "tối thiểu là 80 lít/người/ngày đêm" |
| Nước chữa cháy ngoài nhà | Bảng 8 (F1.3 theo số tầng, khối tích) và Bảng 9 (F5, hạng C, theo khối tích); trữ 3 giờ | QCVN 06:2022 Bảng 8, Bảng 9, 5.1.3.3; QCVN 13:2018 2.3.1.1 (gara xếp như kho hạng C) | "Thời gian chữa cháy phải lấy là 3 giờ" |
| Họng nước trong nhà | 1–3 tia × 2,5 L/s theo số tầng / dài hành lang | QCVN 06:2022 Bảng 11 (`soTiaBang11` ở `tinh/pccc.ts`) | — |

## 3. Không tìm thấy trong kho (đang dùng số tạm)

- **QCVN 13:2023/BXD.** Kho chỉ có bản 2018, mã đang dùng bản 2018.
- **QCVN 10:2014.** Kho có QCVN 10:2024, mã dùng bản 2024.
- **Bề rộng làn theo góc đỗ 90° / 60° / 45°.** Không có văn bản nào.
- **Chiều dài đoạn thẳng ở đỉnh / chân ram.** Mặc định 6 m là số tạm. Dự thảo QCVN 07-11 chỉ có giới hạn đổi dốc, và yêu cầu làn chờ ≥ 10 m khi có trạm kiểm soát.
- **Lưu lượng sprinkler.** TCVN 7336 không có trong kho. Đang dùng tạm 30 L/s × 1 h.
- **Kích thước phòng TBA, máy phát và công suất kVA mỗi căn.** TCVN 9206 không có trong kho. Đang dùng tạm 3 kVA/căn, mỗi trạm 2 000 kVA, DT phòng lấy theo KDAS / M1.
- **Vận tốc gió trong hộp gió và qua louver.** TCVN 5687 không có trong kho. Đang dùng tạm 8 m/s và 5 m/s, tỷ lệ thông thoáng 60%.
- **DT phòng rác.** Không có văn bản nào. Đang dùng tạm 12 m² mỗi tòa.
- **Bể XLNT.** Đang dùng tạm: nước thải bằng 100% nước cấp, lưu 1 ngày, sâu 3 m.
- **Số ngày dự trữ bể SH.** Đang dùng 1,5 ngày theo tham khảo DAHY.
- **Văn bản dự thảo, chỉ dùng để cảnh báo:** QCVN 07-11:2025 và Sửa đổi 01:2026 QCVN 04.
