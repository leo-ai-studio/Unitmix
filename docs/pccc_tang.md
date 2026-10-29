# PCCC và thang máy trên mặt bằng tầng

Màn Tầng có năm lớp PCCC trong nút **Lớp** ở góc bản vẽ, đặt tên và bật / tắt như menu "⚑ PCCC" của app cũ: **Tủ PCCC** (bật sẵn), **Cửa ngăn cháy HL** (bật sẵn), **Đo HL**, **Vòi CC** (R 18 m) và **Thoát nạn**. Bật lớp nào thì nút **Chú giải** hiện ký hiệu của lớp đó. Panel phải có khối **PCCC · thang máy** ngay dưới KPI. TMB có bảng **Thang máy theo tòa**. Mọi mục chỉ là cảnh báo, không chặn thao tác.

Người dùng 30/10/2026: "Cả phần cửa phòng cháy chữa cháy, cửa thang máy chữa cháy bỏ đi, quá xấu" → đã bỏ khỏi mặt bằng lớp đánh dấu cửa ngăn cháy EI (cửa thang / căn / sảnh / phòng rác) và lớp thang máy / thang máy chữa cháy (giếng, vòng 60 / 45 m). App cũ cũng không vẽ hai thứ này. Số thang máy, yêu cầu thang máy chữa cháy và kiểm bán kính 60 / 45 m vẫn còn, nhưng chỉ là dòng chữ ở khối PCCC và bảng thang máy TMB.

Phân tích (hai lần giải cửa hành lang + bài phủ tủ chính xác, 100–300 ms ở mẫu lớn) chạy trong Web Worker (`tinh/pcccNen.ts`, dùng chung `thaoTay.worker.ts`). Luồng chính nhớ kết quả theo mặt bằng. Khi đang chờ thì vẽ kết quả gần nhất của tòa. Đo khi mở tầng Z3 / T1 / V1 / L1: không có tác vụ dài nào trên 50 ms.

Các số được tính trên đúng mặt bằng mà KPI dùng: `mauCuaToa` hiệu dụng cộng `matDaDon`. Kết quả được nhớ theo mặt bằng, nên sửa xong là số cập nhật ngay. Mã nằm ở:

- `web/src/tinh/thangMay.ts`
- `web/src/tinh/cuaNganChay.ts` (bộ giải cửa hành lang chép app cũ) + `web/src/tinh/sanhHL.json` (đoạn sảnh thang máy theo khối lõi)
- `web/src/tinh/tuHongNuoc.ts` (bộ đặt tủ chép app cũ) + `web/src/tinh/khoiTuPCCC.json` (thư viện block tủ, bản của `web/public/lib/pccc.json`)
- `web/src/tinh/pcccTang.ts`, `web/src/tinh/pcccNen.ts` (chạy nền)
- `web/src/ve/LopPCCC.tsx`
- `web/src/ui/KpiPCCC.tsx`
- `web/src/ui/ThangMayLo.tsx`

Test ở `web/src/tinh/pcccTang.test.ts`, `web/src/tinh/cuaNganChay.test.ts` và `web/src/tinh/tuHongNuoc.test.ts`. Ảnh so sánh cũ / mới ở `docs/anh/pccc/cu-moi-*.png`, chụp bằng `scripts/chup_pccc.mjs`. Ảnh cũ trước đợt này: `z3-*.png`.

Văn bản tra trong kho `E:\OneDrive\_QCVN-TCVN`, trích chữ bằng PyMuPDF:

- `QCVN-04-2021-BXD.pdf`
- `31_2026_TT-BXD_Sua doi QC 04_Nha CC.pdf`. Văn bản này không sửa mục 2.4 và 2.5.3.
- `QCVN-06_2022-SUA-DOI-1_2023_BXD.pdf`, bản hợp nhất có Sửa đổi 1:2023.

Kho "QCVN TCVN" có `_DANH-MUC.md` không có trên máy. TCVN 4451, TCVN 7628 và TCVN 6396-72/73 cũng không có trong kho, nên chưa đối chiếu được.

## 1. Số thang máy

| | |
|---|---|
| Căn cứ | QCVN 04:2021 2.4.1: "từ 10 tầng trở lên phải có tối thiểu 2 thang máy" (từ 5 tầng thì ≥ 1). 2.4.2: "1 thang máy cho 200 người cư trú", hoặc nếu tính theo số căn thì "1 thang máy cho 70 căn hộ". |
| App cũ | QT-94 (chủ nhiệm chốt 19/10/2026): số cần = min(⌈căn / 70⌉, ⌈dân / 200⌉). QT-76: tính cả thang chữa cháy và thang hàng. QT-64: đếm giếng theo hình vẽ lõi (`so_gieng`). App cũ ghi nguồn là "bảng chuẩn Viện", nhưng thực ra đó chính là QCVN 04 2.4.2. |
| App mới | **Đã chốt (29/10/2026):** số cần = max(số theo 2.4.1, min của hai cách tính 2.4.2), như QT-94 cộng tối thiểu theo số tầng. Số có = số giếng trong lõi, lấy `vi_tri_gieng` của `loi/*.json`; khi lõi chưa tải thì đếm theo tên `_tm_NN`. |
| Ví dụ | Z3 có 576 căn, 2.016 người. Theo căn cần 9 thang, theo người cần 11, nên cần 9. Lõi vẽ 5 giếng → vượt. Tên khối ghi 06, nhưng hình chỉ có 5 giếng (QT-64 đã ghi lệch này). |

Ghi chú: "không kể số người ở tầng 1" chưa trừ, vì tầng 1 là khối đế và dân chỉ tính ở tầng căn hộ.

## 2. Thang máy chữa cháy và bán kính 60 m

| | |
|---|---|
| Căn cứ | QCVN 06 6.13: "chiều cao PCCC lớn hơn 28 m (lớn hơn 50 m đối với nhà nhóm F1.3)" thì mỗi khoang cháy phải có ≥ 1 thang. Bán kính phục vụ "không vượt quá 60 m". Nhà > 75 m theo A.2.12: "(bán kính phục vụ) không vượt quá 45 m". QCVN 04 2.4.3 cũng dùng ngưỡng 50 m. |
| App cũ | Chỉ có ô số `fireLifts`, mặc định 1, và luật `qcvn06_613_firelift` (H > 50 m). Không chỉ định giếng nào là thang chữa cháy, không kiểm bán kính. |
| App mới | **Đã chốt (29/10/2026): bán kính đo THẲNG** từ tâm giếng. Chọn giếng theo luật: giếng phủ nhiều điểm nhất trong bán kính (cửa căn và 4 góc trong căn). Nếu hoà thì lấy giếng gần cửa thang N3, vì 6.13 cho gộp sảnh với khoang đệm thang N (≥ 6 m²). Chọn thêm giếng cho đến khi phủ hết. Từ 30/10/2026 không vẽ trên mặt bằng nữa, chỉ còn dòng "Thang máy chữa cháy" (số giếng · xa nhất / R) ở khối PCCC. |
| Ví dụ | Z3: H = 81,8 m, R = 45 m, chọn 1 giếng ở lõi giữa, điểm xa nhất 42,6 m → đạt. |

## 3. Họng chờ cách cửa căn ≤ 45 m

Đây là luật bổ sung, app cũ không có. QCVN 04 2.5.3: nhà cao hơn 50 m thì "cửa căn hộ xa nhất của tầng phải nằm trong phạm vi 45 m tính từ họng nước chữa cháy (có tính toán đến đường di chuyển)". Họng chờ đặt trong khoang đệm của thang N hoặc của thang máy chữa cháy.

App mới đo dọc tim hành lang, từ cửa thang N3 và từ giếng thang chữa cháy tới cửa căn. Z3 xa nhất 32,1 m.

## 4. Tủ họng nước

| | |
|---|---|
| Căn cứ | QCVN 06 5.2.1 và Bảng 11 (số tia), 5.2.4, 5.2.11 (hai tia từ hai tủ cạnh nhau khi hành lang > 10 m), 5.2.14 (đặt ở lối vào hành lang, sảnh). Bán kính 18 m đo thẳng là quyết định của chủ nhiệm ngày 20/10/2026, theo thẩm duyệt PC07 Đồng Quan, không phải điều khoản. |
| App cũ | QT-77 / 77e / 77f / 77g: phủ chính xác bằng nhánh cận, ưu tiên tường lõi trước phòng KT, rồi hộp KT căn, tường chung, giữa tường. |
| App mới (30/10/2026) | **Chép đủ bộ đặt tủ app cũ** `tuCC0` + `tccToiUu` → `tinh/tuHongNuoc.ts` `datTuPCCC`, cùng thứ tự và ưu tiên (xem bảng dưới). Thứ tự giải như app cũ: cửa ngăn cháy lý tưởng (chưa có tủ) → tủ né chỗ cửa đó → cửa thật tránh tủ. |

Luật đặt tủ (app cũ, dòng ~4530–4950 `prototype/shell.src.html`):

| Bước | Luật | Hàm app cũ |
|---|---|---|
| Điểm phải phủ | cửa căn + góc trong căn (lùi 150 mép bên / 150 tường HL / 300 tường ngoài; căn góc V lấy đỉnh khung) + tim mỗi trục hành lang mỗi 3 m | `tccDiemCan`, `tuCC0` |
| Số tia | Bảng 11: ≤ 16 tầng HL > 10 m 2 tia; 17–25 tầng 2 / 3; > 25 tầng 2 (chủ nhiệm). Mỗi điểm cần `can` = 1 hoặc 2 tia | `tccSoTia` |
| Loại tủ | tủ đôi 800 × 200 ở lõi; cụm 2 hộp 800 × 200 khi cần 2 tia; tủ đơn 500 × 200 (1 tia) | `TCC_LOAI`, `tccLoaiUu` |
| (1) lõi | cạnh BAO-TM gần phòng KT / KTĐ / KTN (≤ 3 m), cạnh ≥ 1.400, mặt tường cách tim HL ½ HL ± 150, cách cửa lõi ≥ 700, cách giếng thang máy ≥ 1,6 m | `tuCC0` (1) |
| (2) hộp KT căn | ô gạch chéo lớp hidd sát tường HL (≤ 600), bề rộng tới mép ngoài tường xây HKT; đủ 800 → cụm, đủ 500 → tủ đơn; không trừ DT | `tuCC0` (2) |
| (3) tường ngăn | sát tường ngăn hai căn: chữ L, trừ DT (tủ + 95) × (295 − tường HL − 15) | `tuCC0` (3), `tccTruM2` |
| (4) giữa tường căn | bước 250, cách ranh căn ≥ 350: chữ U, trừ DT (tủ + 190) × (…) | `tuCC0` (4) |
| Loại trừ | cách cửa căn / thang ≥ ½ tủ + 600; cách nét cửa CAD sâu ≤ 1,5 m ≥ ½ tủ + 500; không trên vách BT (tường HL dày > 200); không lấn tường ngăn căn; mặt căn cách tim HL ½ HL ± 100; đoạn tủ → tim HL không xuyên căn / thang / lõi; đầu cột ranh căn ≥ ½ tủ + 350 | `xaCua`, `doanTrong`, `vachBT` |
| Trùng chỗ | cùng loại, cách < rộng tủ + 430: giữ chỗ ít trừ DT, rồi ưu tiên trục KT | `them` |
| Chọn | tham lam theo lợi / ưu tiên (lõi 1 · HKT 1,15 · tường căn 2,2), dàn tủ ≥ 3 m → cận trên; nhánh–cận chính xác, chi phí 100.000 × số hộp + 10.000 × cửa lý tưởng bị chắn + 5.000 × m² DT trừ + 10 × ưu tiên, ngân sách 500.000 nút | `tccToiUu`, `tccChanCua` |
| Đánh số | TCC-01… theo đoạn hành lang rồi vị trí dọc đoạn | `tuCC0` |
| Kéo tay (QT-77e) | bám tường HL gần nhất (xa tim > ½ HL + 3 m thì không bám); sát đường bao lõi ≤ 300 là tủ đôi; chỉ tính phủ; nút "Tủ PCCC tự đặt lại" | `tccBam`, `tccDoi` |
| Kích đúp (QT-77f) | cụm / tủ đôi → tách 2 tủ đơn cách 3 m; tủ đơn → gộp với tủ đơn gần nhất ở điểm giữa | `tccTachGop` |

Lưu ở `ToaDat.tuPCCCTay` = `[x, y]` hoặc `[x, y, "don" | "gop"]`. Đối chiếu app cũ chạy headless trên 33 mẫu gốc, 25 tầng (`scripts/tcc_cu.js` → `web/src/thu/tcc_cu.json`):

- số vị trí 139 / 139 và số hộp bằng nhau ở mọi tòa;
- 136 / 139 tủ khớp ≤ 0,3 m và cùng loại;
- lệch duy nhất ở tm-v3 (3 tủ): ứng viên trùng hệt, nhưng cửa ngăn cháy lý tưởng ở tòa V khác app cũ (xem mục 6), nên số cửa bị chắn khác.

Trên mặt bằng, tủ vẽ như app cũ:

- thân tủ màu #f08080, viền #b00000;
- block CAD `pccc-800x200` / `pccc-500x200` (thân từng hộp, nét chéo, cánh mở ra hành lang), lấy từ thư viện `tu-pccc.dwg` → `pccc.json`;
- tường xây sau lưng tủ (chữ U / L) màu cam #e07b39;
- mã "TCC-01 CỤM 2 / ĐÔI / ĐƠN", chữ 300 mm;
- viền vàng khi tủ đặt tay sát cửa.

Lớp **Vòi CC** vẽ:

- vòng R 18 m màu #1e7a3c, nét đứt 6 4;
- đường thẳng tới điểm xa nhất, ghi "TCC-01→CH-17: L=17,3 / 18,0 m";
- điểm thiếu tia khoanh đỏ.

Khối PCCC: "N vị trí · M hộp" (rê chuột xem loại tủ, tia / điểm, Bảng 11, danh sách thiếu), dòng "Căn trừ DT (tường sau tủ)".

## 5. Cửa ngăn cháy

| Cửa | Giới hạn | Căn cứ |
|---|---|---|
| Buồng thang bộ (hành lang → buồng đệm hoặc buồng thang) | Loại 1, EI 60, tự đóng, chèn kín khe | QCVN 06 3.2.11: "cửa ngăn cháy loại 1 đối với nhà có bậc chịu lửa I, II". EI 60 lấy từ Bảng 2. |
| Khoang đệm → buồng thang N, sảnh thang máy, phòng rác (nhà > 75 m) | Loại 2, EI 30 | A.3.1.12 b |
| Cửa căn hộ mở ra hành lang | EI 30 | 3.3.5: "Các cửa mở vào hành lang phải là cửa ngăn cháy", không thấp hơn vách hành lang (EI 30 với bậc I). Định mức app cũ cũng dùng cửa căn EI30. |
| Sảnh thang máy chữa cháy | Vách ngăn cháy loại 1; cửa loại 2, EI 30 | 6.13; Bảng 3 (khoang đệm loại 1 có chèn bịt loại 2); Bảng 2 |
| Phòng rác | Cửa ngăn cháy tự đóng kín; nhà > 75 m: EI 60 | 4.24; A.2.30.2 |
| Cửa giếng thang máy vào sảnh (nhà > 75 m) | Kín khói | A.3.1.12 c, A.2.24.3. Chỉ ghi chú, không vẽ. |

App cũ không đánh dấu loại cửa nào: các cửa trên chỉ là vật cản khi đặt cửa hành lang và tủ. Từ 30/10/2026 app mới cũng không vẽ (người dùng bỏ lớp này). Bảng trên chỉ còn là yêu cầu cấu tạo, ghi ở luật `qcvn06_cua_ngan_chay`.

## 6. Chia khoang hành lang (cửa ngăn khói)

**Đã chốt (29/10/2026): chép đủ bộ giải app cũ** (QT-95 / 98 / 100 / 103 / 104 / 104c / 105), giữ giới hạn 60 m (≤ 75 m) / 30 m (> 75 m).

| | |
|---|---|
| Căn cứ | H ≤ 75 m: QCVN 06 3.3.5 (SĐ1): "Các hành lang dài hơn 60 m phải được phân chia bằng các vách ngăn cháy loại 2", hoặc vách / màn ngăn khói, thành đoạn ≤ 60 m; cửa theo 3.2.11. H > 75 m: A.3.1.7 dẫn A.2.14: "Đối với khối căn hộ: không quá 30 m", vách ngăn cháy loại 1 + cửa loại 2 có cơ cấu tự đóng. 30 m người dùng nói chỉ áp cho nhà > 75 m. Nhà > 28 m còn phải hút khói hành lang (D.2 a), mỗi đoạn tính ≤ 60 m (D.4 a) — chỉ ghi chú. |
| Đồ thị | `hlDoThi`: trục thẳng hàng (lệch ≤ 400 mm, khe ≤ 2,5 m) gộp thành tuyến; nút = đầu tuyến + giao điểm (cách đầu ≤ 2,5 m); cầu (Tarjan) + cây khung nhỏ nhất (Kruskal): vòng kín chỉ tính cây khung, cửa chỉ đặt trên cầu. **Sảnh thang máy tính chung khoang** (QT-100 / QT-104): đoạn sảnh app cũ `hlSanhTruc` chép theo toạ độ KHỐI LÕI vào `web/src/tinh/sanhHL.json` (12 khối, 13 bộ đoạn; lõi v1 có hai bộ cho tm / xh) — tự chỉnh dời lõi thì sảnh dời theo. |
| Luật cứng (QT-105) | R1 khoang ≤ giới hạn · R2 cửa rộng = HL mặc định (1800 / 1600), bám tường thật hai bên (≤ 350 mm, 9 điểm dò) — chế độ nới: bù tường 150 tới vách trong tầm ½ HL + 1,5 m · R3 không trong sảnh TM và sân trước miệng sảnh (≥ một cánh + 1 m) · R4a khuôn cửa không đứng trên ô cửa căn / buồng đệm / cửa lõi / tủ (≥ 500 + 100) · R5 không trong lõi trừ lối xuyên lõi (chế độ nới) · R6 vuông góc hành lang (vách hai bên song song tuyến ≤ 5°). |
| Ưu tiên (mềm) | R4b cánh mở không chồng cửa (chi phí 1000 / cửa; không còn chỗ sạch thì cờ `sach:false`, tô cam, luật `mdi_cnc_quet` báo) · không cửa lơ lửng · hai cửa ≥ 6 m (CNC_GAN — quy ước app cũ, QCVN không ghi) · ít khoang < 15 m · khoang ngắn nhất dài hơn · không sát miệng sảnh cụt · ở tường chung hai căn · khoang dài nhất ngắn hơn. R7 không khoang < 5 m. |
| Bộ giải | Như app cũ, cùng thứ tự: (a) tham lam lá → gốc (tường chung xa nhất) · (b) tinh chỉnh cục bộ (bỏ cửa thừa, dời cửa) · (b2) thêm cửa khi còn vượt · (b3) bớt một / dời một · bỏ cửa giữa lõi / lơ lửng · (c) thay cửa bẩn bằng hai cửa sạch · **quy hoạch động chính xác** trên cây cầu (bảng Pareto số cửa → đoạn hở, bản sạch / bản chồng cánh) rồi tinh chỉnh trong chỗ hợp lệ và sạch · còn xấu thì giải lại **chế độ nới**. |
| Vật cản | Nét cửa căn trên tường hành lang (sâu ≤ 300 mm) — trường mới `cua_hl` trong `can.json` (`scripts/sinh_phai_sinh_can.py`, biến thể STRETCH dời theo mức kéo) · tim cửa buồng đệm (½ ô 650) · nét `door` của lõi · tủ PCCC (½ rộng tủ). |
| Đối chiếu app cũ | App cũ chạy headless (`scripts/cnc_cu.js` qua `chay_selftest.js --jsfile`) trên bố cục gốc 33 mẫu tòa, không tính tủ ("cửa lý tưởng"): **số cửa 110 / 110 (≤ 30 m) và 49 / 49 (≤ 60 m)**, ≥ 90 % cửa app cũ có cửa app mới cách ≤ 0,3 m (đa số tòa khớp từng cửa; lệch chủ yếu ở V1–V4 và I1 — cùng số cửa, khoang ≤ giới hạn, vị trí khác vì nét bao căn / nét lõi dựng lại không y hệt), mọi khoang ≤ giới hạn, không khoang < 5 m. Z3 (tm-z3): 3 cửa, khoang 28,5 · 24,9 · 18,3 · 13,6 m (app cũ 28,5 · 25,0 · 18,2 · 13,6). |
| Khác app cũ | Nét bao căn = hình chữ nhật ô (app cũ `bienCan`, căn V có khung); căn thuộc tuyến = căn có mặt sát mép tuyến (app cũ theo tên trục). |
| Sửa tay (QT-101, 30/10/2026) | Như app cũ: kéo cửa dọc tim hành lang, bước 100 mm. Không kéo được vào lõi (trừ lối xuyên lõi), vào sảnh thang máy, hay chỗ không có vách mà cũng không bù tường được (`cncDatDuoc`, `keoCuaTay`). Bấm đúp cửa để xoá. Bấm đúp lên hành lang để thêm (`themCuaTay`). Lần sửa đầu chép bộ tự đặt vào `ToaDat.cncTay` (tim cửa). Sau đó khoang tính lại trên đồ thị thật (`cuaNganChayTay`); cửa cách hành lang quá ½ HL + 600 thì bỏ. Cửa đặt sai không bị chặn mà hiện lỗi / cờ như cửa tự đặt: khoang vượt, cánh chồng cửa, trong lõi. Nút "Cửa NC tự đặt lại" ở khối PCCC. |
| Trình bày (như app cũ `cncKhoi`) | Cửa hai cánh mở hai chiều, màu #c0392b, nét 1,4 px không đổi theo zoom. Bù tường 150 khi vách xa hơn ½ cửa. Vùng quét cánh tô nhạt, đậm hơn khi cánh chồng cửa. Mã "CNC-01" chữ 260 mm. Lớp **Đo HL** vẽ tim từng khoang nét đứt màu #1f5fbf (đỏ khi vượt), số từng khúc (340 mm) và "K1 Σ 28,5 / 30 m" (420 mm). Khối PCCC thêm dòng "Cánh cửa NC HL che cửa" (luật `mdi_cnc_quet`) và danh sách khoang trong tooltip. |
| Xuất `.dxf` | Các lớp `MDI-PCCC-TCC` / `-TCC-CT` / `-TUONG` / `-CNC` như app cũ. Tủ ra INSERT block `PCCC-800X200` / `PCCC-500X200`; app cũ nổ thành nét rời. Cửa ra nét + nhãn. Chỉ xuất lớp đang bật, ở bố cục chung. |
| Ảnh | Cũ / mới đặt cạnh nhau (`cu-moi-<tòa>.png` vừa khung đủ 4 lớp, `-mac-dinh` = Tủ + Cửa, `-zoom` = 1 : 100), cho Z3, T1, V1, L1 với 25 tầng. Dự án thử local `ha0wovcr` (mặt bằng đã tự chỉnh N2 + N3). Số tủ / cửa bằng app cũ: Z3 4 / 3, T1 5 / 4, V1 4 / 3, L1 4 / 3. Ảnh cũ hơn: `z3-cnc-*.png`. |

## 7. Thoát nạn (đã có từ trước)

Bảng G.1 (cụt 25 m, hai thang 40 m), hoặc A.3.1.7 dẫn A.2.19 (15 / 20 m) với nhà > 75 m. Đo từ cửa căn tới cửa buồng đệm dọc tim hành lang (QT-45). Lớp thoát nạn ghi cự ly ngay tại cửa căn và tô đỏ khi vượt, cùng kiểu ký hiệu với các lớp mới. Chỉ là cảnh báo.

## 8. Chờ chủ nhiệm chốt

Đã chốt 29/10/2026: (1) đo thẳng; (2) giữ min(căn / 70, người / 200) + 2.4.1; (6) chép đủ bộ giải app cũ. 30/10/2026: tủ và cửa hành lang làm như app cũ; bỏ lớp cửa ngăn cháy EI và thang máy chữa cháy khỏi mặt bằng. Còn mở: 3, 4, 5, 7.


1. ~~Bán kính 60 / 45 m đo thẳng hay theo đường đi?~~ Đã chốt: đo thẳng.
2. ~~Giữ min hay max?~~ Đã chốt: giữ min như QT-94, cộng tối thiểu 2.4.1. (Trừ người ở tầng 1 khi tầng 1 có căn hộ: chưa cần — tầng 1 là khối đế.)
3. Giếng thứ 5 của lõi z3 tm 06 (gần phòng "PCCC", 10850 / 803) có phải thang máy không? Hình lõi đếm 5, tên khối ghi 06.
4. Cửa phòng kỹ thuật (KT, KTĐ, KTN) ở nhà ≤ 75 m: chưa tìm được điều khoản ghi giới hạn chịu lửa riêng, nên chưa đánh dấu.
5. Thang N2 không có buồng đệm có được coi là nơi đặt họng chờ không? App đang chỉ lấy N3 và thang chữa cháy làm nguồn.
6. ~~Cửa chia khoang như app cũ?~~ Đã chốt: có — xem mục 6.
7. TCVN 4451 / TCVN 7628 (lưu lượng thang máy) và TCVN 6396-72/73 (thang chữa cháy) không có trong kho. Cần bổ sung nếu muốn kiểm tải trọng hoặc tốc độ (QCVN 04 2.4.2 ≥ 450 kg; QCVN 06 6.13 ≥ 630 kg, tốc độ ≥ H/60).
