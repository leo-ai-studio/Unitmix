# PCCC và thang máy trên mặt bằng tầng

Màn Tầng có năm lớp PCCC trong nút **Lớp** ở góc bản vẽ: thoát nạn, thang máy và thang chữa cháy, tủ họng nước, cửa ngăn cháy, chia khoang hành lang. Bật lớp nào thì nút **Chú giải** hiện ký hiệu của lớp đó. Panel phải có khối **PCCC · thang máy** ngay dưới KPI. TMB có bảng **Thang máy theo tòa**. Mọi mục chỉ là cảnh báo, không chặn thao tác.

Các số được tính trên đúng mặt bằng mà KPI dùng: `mauCuaToa` hiệu dụng cộng `matDaDon`. Kết quả được nhớ theo mặt bằng, nên sửa xong là số cập nhật ngay. Mã nằm ở:

- `web/src/tinh/thangMay.ts`
- `web/src/tinh/cuaNganChay.ts` (bộ giải cửa hành lang chép app cũ) + `web/src/tinh/sanhHL.json` (đoạn sảnh thang máy theo khối lõi)
- `web/src/tinh/pcccTang.ts`
- `web/src/ve/LopPCCC.tsx`
- `web/src/ui/KpiPCCC.tsx`
- `web/src/ui/ThangMayLo.tsx`

Test ở `web/src/tinh/pcccTang.test.ts` và `web/src/tinh/cuaNganChay.test.ts`. Ảnh chụp tòa Z3 điển hình 24 tầng (H = 81,8 m) ở `docs/anh/pccc/`.

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
| App mới | **Đã chốt (29/10/2026): bán kính đo THẲNG** từ tâm giếng. Chọn giếng theo luật: giếng phủ nhiều điểm nhất trong bán kính (cửa căn và 4 góc trong căn). Nếu hoà thì lấy giếng gần cửa thang N3, vì 6.13 cho gộp sảnh với khoang đệm thang N (≥ 6 m²). Chọn thêm giếng cho đến khi phủ hết. Trên bản vẽ: giếng tô đỏ ghi "TMCC", vòng bán kính nét đứt, điểm ngoài bán kính đánh ✕. |
| Ví dụ | Z3: H = 81,8 m, R = 45 m, chọn 1 giếng ở lõi giữa, điểm xa nhất 42,6 m → đạt. |

## 3. Họng chờ cách cửa căn ≤ 45 m

Đây là luật bổ sung, app cũ không có. QCVN 04 2.5.3: nhà cao hơn 50 m thì "cửa căn hộ xa nhất của tầng phải nằm trong phạm vi 45 m tính từ họng nước chữa cháy (có tính toán đến đường di chuyển)". Họng chờ đặt trong khoang đệm của thang N hoặc của thang máy chữa cháy.

App mới đo dọc tim hành lang, từ cửa thang N3 và từ giếng thang chữa cháy tới cửa căn. Z3 xa nhất 32,1 m.

## 4. Tủ họng nước

| | |
|---|---|
| Căn cứ | QCVN 06 5.2.1 và Bảng 11 (số tia), 5.2.4, 5.2.11 (hai tia từ hai tủ cạnh nhau khi hành lang > 10 m), 5.2.14 (đặt ở lối vào hành lang, sảnh). Bán kính 18 m đo thẳng là quyết định của chủ nhiệm ngày 20/10/2026, theo thẩm duyệt PC07 Đồng Quan, không phải điều khoản. |
| App cũ | QT-77 / 77e / 77f / 77g: phủ chính xác bằng nhánh cận, ưu tiên tường lõi trước phòng KT, rồi hộp KT căn, tường chung, giữa tường. |
| App mới | Giữ `tuPCCC` (phủ tham lam) như trước. Thêm: vẽ tủ "TCC-xx" và vòng 18 m, khoanh đỏ cửa căn chưa phủ. Tủ kéo được, thả xuống thì bám tường hành lang gần nhất; vị trí lưu ở `ToaDat.tuPCCCTay`. Nút "Tủ PCCC về tự đặt" ở panel phải. |

## 5. Cửa ngăn cháy

| Cửa | Giới hạn | Căn cứ |
|---|---|---|
| Buồng thang bộ (hành lang → buồng đệm hoặc buồng thang) | Loại 1, EI 60, tự đóng, chèn kín khe | QCVN 06 3.2.11: "cửa ngăn cháy loại 1 đối với nhà có bậc chịu lửa I, II". EI 60 lấy từ Bảng 2. |
| Khoang đệm → buồng thang N, sảnh thang máy, phòng rác (nhà > 75 m) | Loại 2, EI 30 | A.3.1.12 b |
| Cửa căn hộ mở ra hành lang | EI 30 | 3.3.5: "Các cửa mở vào hành lang phải là cửa ngăn cháy", không thấp hơn vách hành lang (EI 30 với bậc I). Định mức app cũ cũng dùng cửa căn EI30. |
| Sảnh thang máy chữa cháy | Vách ngăn cháy loại 1; cửa loại 2, EI 30 | 6.13; Bảng 3 (khoang đệm loại 1 có chèn bịt loại 2); Bảng 2 |
| Phòng rác | Cửa ngăn cháy tự đóng kín; nhà > 75 m: EI 60 | 4.24; A.2.30.2 |
| Cửa giếng thang máy vào sảnh (nhà > 75 m) | Kín khói | A.3.1.12 c, A.2.24.3. Chỉ ghi chú, không vẽ. |

App cũ không đánh dấu loại cửa nào: các cửa trên chỉ là vật cản khi đặt cửa hành lang và tủ.

Vị trí trên bản vẽ:

- Cửa thang: tim cửa buồng đệm.
- Cửa căn: `cuaCan`.
- Sảnh thang máy chữa cháy: tâm giếng, vì chưa có hình sảnh riêng.
- Phòng rác: tâm nhãn phòng "P.RÁC" trong `loi/*.json`.

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
| Khác app cũ | Nét bao căn = hình chữ nhật ô (app cũ `bienCan`, căn V có khung); căn thuộc tuyến = căn có mặt sát mép tuyến (app cũ theo tên trục); chưa có kéo / thêm / xoá cửa tay (QT-101). |
| Ảnh | Trước (tham lam cũ, 2 cửa): `docs/anh/pccc/z3-cnc-truoc.png` · sau (bộ giải app cũ, 3 cửa, block hai cánh, cam = cánh chồng cửa): `z3-cnc-sau.png`, `z3-cnc-sau-phong-to.png`. Mặt bằng PA thử đã tự chỉnh (thang N2 + N3) nên khác bố cục gốc. |

## 7. Thoát nạn (đã có từ trước)

Bảng G.1 (cụt 25 m, hai thang 40 m), hoặc A.3.1.7 dẫn A.2.19 (15 / 20 m) với nhà > 75 m. Đo từ cửa căn tới cửa buồng đệm dọc tim hành lang (QT-45). Lớp thoát nạn ghi cự ly ngay tại cửa căn và tô đỏ khi vượt, cùng kiểu ký hiệu với các lớp mới. Chỉ là cảnh báo.

## 8. Chờ chủ nhiệm chốt

Đã chốt 29/10/2026: (1) đo thẳng; (2) giữ min(căn / 70, người / 200) + 2.4.1; (6) chép đủ bộ giải app cũ. Còn mở: 3, 4, 5, 7.


1. ~~Bán kính 60 / 45 m đo thẳng hay theo đường đi?~~ Đã chốt: đo thẳng.
2. ~~Giữ min hay max?~~ Đã chốt: giữ min như QT-94, cộng tối thiểu 2.4.1. (Trừ người ở tầng 1 khi tầng 1 có căn hộ: chưa cần — tầng 1 là khối đế.)
3. Giếng thứ 5 của lõi z3 tm 06 (gần phòng "PCCC", 10850 / 803) có phải thang máy không? Hình lõi đếm 5, tên khối ghi 06.
4. Cửa phòng kỹ thuật (KT, KTĐ, KTN) ở nhà ≤ 75 m: chưa tìm được điều khoản ghi giới hạn chịu lửa riêng, nên chưa đánh dấu.
5. Thang N2 không có buồng đệm có được coi là nơi đặt họng chờ không? App đang chỉ lấy N3 và thang chữa cháy làm nguồn.
6. ~~Cửa chia khoang như app cũ?~~ Đã chốt: có — xem mục 6.
7. TCVN 4451 / TCVN 7628 (lưu lượng thang máy) và TCVN 6396-72/73 (thang chữa cháy) không có trong kho. Cần bổ sung nếu muốn kiểm tải trọng hoặc tốc độ (QCVN 04 2.4.2 ≥ 450 kg; QCVN 06 6.13 ≥ 630 kg, tốc độ ≥ H/60).
