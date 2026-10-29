# PCCC và thang máy trên mặt bằng tầng

Màn Tầng có năm lớp PCCC trong nút **Lớp** ở góc bản vẽ: thoát nạn, thang máy và thang chữa cháy, tủ họng nước, cửa ngăn cháy, chia khoang hành lang. Bật lớp nào thì nút **Chú giải** hiện ký hiệu của lớp đó. Panel phải có khối **PCCC · thang máy** ngay dưới KPI. TMB có bảng **Thang máy theo tòa**. Mọi mục chỉ là cảnh báo, không chặn thao tác.

Các số được tính trên đúng mặt bằng mà KPI dùng: `mauCuaToa` hiệu dụng cộng `matDaDon`. Kết quả được nhớ theo mặt bằng, nên sửa xong là số cập nhật ngay. Mã nằm ở:

- `web/src/tinh/thangMay.ts`
- `web/src/tinh/chiaHanhLang.ts`
- `web/src/tinh/pcccTang.ts`
- `web/src/ve/LopPCCC.tsx`
- `web/src/ui/KpiPCCC.tsx`
- `web/src/ui/ThangMayLo.tsx`

Test ở `web/src/tinh/pcccTang.test.ts`. Ảnh chụp tòa Z3 điển hình 24 tầng (H = 81,8 m) ở `docs/anh/pccc/`.

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
| App mới | Số cần = max(số theo 2.4.1, min của hai cách tính 2.4.2). Số có = số giếng trong lõi, lấy `vi_tri_gieng` của `loi/*.json`; khi lõi chưa tải thì đếm theo tên `_tm_NN`. |
| Ví dụ | Z3 có 576 căn, 2.016 người. Theo căn cần 9 thang, theo người cần 11, nên cần 9. Lõi vẽ 5 giếng → vượt. Tên khối ghi 06, nhưng hình chỉ có 5 giếng (QT-64 đã ghi lệch này). |

Ghi chú: "không kể số người ở tầng 1" chưa trừ, vì tầng 1 là khối đế và dân chỉ tính ở tầng căn hộ.

## 2. Thang máy chữa cháy và bán kính 60 m

| | |
|---|---|
| Căn cứ | QCVN 06 6.13: "chiều cao PCCC lớn hơn 28 m (lớn hơn 50 m đối với nhà nhóm F1.3)" thì mỗi khoang cháy phải có ≥ 1 thang. Bán kính phục vụ "không vượt quá 60 m". Nhà > 75 m theo A.2.12: "(bán kính phục vụ) không vượt quá 45 m". QCVN 04 2.4.3 cũng dùng ngưỡng 50 m. |
| App cũ | Chỉ có ô số `fireLifts`, mặc định 1, và luật `qcvn06_613_firelift` (H > 50 m). Không chỉ định giếng nào là thang chữa cháy, không kiểm bán kính. |
| App mới | Chọn giếng theo luật: giếng phủ nhiều điểm nhất trong bán kính (cửa căn và 4 góc trong căn). Nếu hoà thì lấy giếng gần cửa thang N3, vì 6.13 cho gộp sảnh với khoang đệm thang N (≥ 6 m²). Chọn thêm giếng cho đến khi phủ hết. Trên bản vẽ: giếng tô đỏ ghi "TMCC", vòng bán kính nét đứt, điểm ngoài bán kính đánh ✕. |
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

| | |
|---|---|
| Căn cứ | H ≤ 75 m: QCVN 06 3.3.5 (SĐ1): "Các hành lang dài hơn 60 m phải được phân chia bằng các vách ngăn cháy loại 2", hoặc bằng vách hay màn ngăn khói, thành đoạn ≤ 60 m. Cửa theo 3.2.11. H > 75 m: A.3.1.7 dẫn A.2.14: "Đối với khối căn hộ: không quá 30 m", dùng vách ngăn cháy loại 1 và cửa loại 2 có cơ cấu tự đóng. Người dùng nói 30 m, nhưng 30 m chỉ áp cho nhà > 75 m; nhà ≤ 75 m là 60 m. Nhà > 28 m còn phải hút khói hành lang (D.2 a), mỗi đoạn tính ≤ 60 m (D.4 a); phần này chỉ ghi chú. |
| App cũ | QT-95 / 98 / 100–105, `cuaNganChay`: quy hoạch động chính xác trên cây cầu, cộng sảnh thang máy vào khoang, luật R1–R7 (tránh quét cửa, cửa cách nhau ≥ 6 m, khoang ≥ 5 m). |
| App mới | Đặt tham lam từ lá về gốc trên cây khung của đồ thị hành lang. Chừa 1,5 m để dời cửa, tránh cửa căn và cửa thang ±1,2 m. Cạnh vòng thì cắt ở giữa. `doKhoang` đo lại từng khoang. Chưa cộng sảnh thang máy, chưa có luật quét cửa R4. |
| Ví dụ | Z3: 2 cửa, khoang dài nhất 28,5 m / 30 m. |

## 7. Thoát nạn (đã có từ trước)

Bảng G.1 (cụt 25 m, hai thang 40 m), hoặc A.3.1.7 dẫn A.2.19 (15 / 20 m) với nhà > 75 m. Đo từ cửa căn tới cửa buồng đệm dọc tim hành lang (QT-45). Lớp thoát nạn ghi cự ly ngay tại cửa căn và tô đỏ khi vượt, cùng kiểu ký hiệu với các lớp mới. Chỉ là cảnh báo.

## 8. Chờ chủ nhiệm chốt

1. Bán kính 60 / 45 m của thang chữa cháy đo thẳng hay theo đường đi? QCVN 06 không ghi "đường di chuyển", trong khi QCVN 04 2.5.3 có ghi. App đang đo thẳng.
2. Số thang cần: giữ min(căn / 70, người / 200) theo QT-94, hay lấy max cho an toàn? Có trừ người ở tầng 1 khi tầng 1 có căn hộ không?
3. Giếng thứ 5 của lõi z3 tm 06 (gần phòng "PCCC", 10850 / 803) có phải thang máy không? Hình lõi đếm 5, tên khối ghi 06.
4. Cửa phòng kỹ thuật (KT, KTĐ, KTN) ở nhà ≤ 75 m: chưa tìm được điều khoản ghi giới hạn chịu lửa riêng, nên chưa đánh dấu.
5. Thang N2 không có buồng đệm có được coi là nơi đặt họng chờ không? App đang chỉ lấy N3 và thang chữa cháy làm nguồn.
6. Cửa chia khoang: có cần làm như app cũ (cộng sảnh thang máy vào khoang, cửa cách nhau ≥ 6 m, không quét cửa căn) không?
7. TCVN 4451 / TCVN 7628 (lưu lượng thang máy) và TCVN 6396-72/73 (thang chữa cháy) không có trong kho. Cần bổ sung nếu muốn kiểm tải trọng hoặc tốc độ (QCVN 04 2.4.2 ≥ 450 kg; QCVN 06 6.13 ≥ 630 kg, tốc độ ≥ H/60).
