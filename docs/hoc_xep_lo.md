# Học cách xếp tòa từ quy hoạch thật (2026-11-05)

Nguồn đọc: M34 `260127 - PA xếp tháp dự án MH34-CT duyệt/pa1.pdf`, `pa2.pdf`; M34 `251226.MH3-PA3.pdf`; M7 `M7.NOTM PA14`, `M7.NOXH PA15`, `M7- NOXH- PA1-Model.pdf`; Long Biên `260801-LB Phuong an SDD 296ha-full.pdf`, bảng mẫu tháp `261031-PA-QH`.

## Kiểu đọc được từ bản vẽ

| Kiểu trong app | Thấy ở đâu | Đặc điểm |
|---|---|---|
| `hai_day` Hai dãy | M34 vị trí 8, 10 | Hai dãy bám hai cạnh dài đối diện, mỗi dãy 3–4 tòa cùng mẫu, cách đều, sân giữa |
| `ket_hop` Dãy kết hợp | M34 PA1 | Mỗi dãy một mẫu: dãy T + dãy I / Z |
| `so_le` So le | M34 vị trí 8 | Dãy sau lệch so với dãy trước, mở tầm nhìn |
| `mot_day` Một dãy | M34 vị trí 9, lô dài Long Biên | Lô dẹt: một dãy, tòa thường đặt vuông góc trục dài |
| `vien` Quanh sân | M7 4 tòa L, M34 MH3 PA3 | Tòa bám các cạnh, góc lô dùng tòa L, sân giữa mở về hướng cây xanh / hồ |
| `tu_do` Tự do | bộ xếp cũ MT-05 | Tham lam từ tâm hoặc góc, nhiều tòa nhất |

Quy luật chung: tòa xoay đúng theo cạnh lô nó bám, kể cả lô hình thang (hai dãy lệch góc nhau, M34 vị trí 10); dãy dãn đều hết cạnh, đầu tòa sát chỉ giới; vát góc lô không tính là cạnh riêng.

## Trong mã

- `tinh/xepToa.ts`: `canhChinh` (gộp cạnh vát, sắp theo độ dài), `KieuBoCuc`, phần "bố cục theo dãy" trong `sinhGoiY`. Mọi ứng viên đi qua cùng `cham` (chỉ tiêu, PCCC, view) như bộ xếp cũ, cùng kiểm lùi LO-01 và khoảng cách LO-02.
- Mặc định trả 10 phương án, luôn giữ phương án tốt nhất của mỗi kiểu (trừ chế độ Theo mục tiêu, xếp thuần theo hạng).
- Tái định cư: thư viện chưa có nhóm mẫu riêng, dùng nhóm `xh` (Long Biên L-3 TĐC, Z-2 TĐC cùng dải diện tích NOXH). Đánh dấu ở `TemDat.taiDinhCu`, xem `tinh/loaiNha.ts`.

## Chưa làm

- Mở sân về phía cây xanh / hồ: chưa chấm theo lô bên cạnh.
- Tòa L đặt đúng góc lô: kiểu Quanh sân thử 4 góc xoay, chưa khoá theo chữ L ôm góc.
- Quy hoạch M34 chỉ đọc từ PDF: chưa dựng lại lô thật để so số căn với PA đã duyệt.

## Bộ xếp bố cục (`tinh/boCucLo.ts`, 2026-11-06)

Hai chế độ: **Xếp tòa đang có** giữ đúng tòa (mẫu, số tầng, căn đã sửa, id), tòa khoá đứng yên; **Tự tổ hợp** chọn mẫu × số tòa sát DTXD tối đa (MĐXD, mật độ tháp) và cơ cấu rồi xếp cùng quy tắc.

Vì sao lượt cũ chạy trên 5 phút ở lô TĐC-1.2: mỗi ứng viên lưới dò LO-02 với cả 80 tòa của dự án (thêm 60 cạnh lô, 37 đỉnh tòa), đã lọc tòa lô xa (`ngoaiGan`, còn 73 s). Bộ mới không dò lưới: sinh bố cục theo dãy, đọc bản đồ khoảng lùi tính sẵn, chỉ bố cục đạt mới kiểm chính xác.

Năm tiêu chí 0–100 (`DiemBoCuc`), chọn Ưu tiên thì tiêu chí đó nặng 60 %:

| Tiêu chí | Cách đo | Căn cứ, giới hạn |
|---|---|---|
| Nắng | Hướng mặt căn + giờ nắng, trừ nắng Tây (`viewXoayMau`) | Chưa tính tòa che nhau |
| Gió | % bề ngang lô gió mùa hè xuyên thẳng không vướng tòa, 50 % = 100 | Hướng Đông Nam là hằng số quy ước miền Bắc, chưa đọc hoa gió Open-Meteo; ước lượng hình học, không thay mô phỏng gió |
| View | Điểm view TB các căn (`BoDemView`), có tòa lô bên cạnh trong 300 m | Như màn View |
| Mặt phố | Tòa song song cạnh lô gần nhất (50 %), nhịp đều (25 %), ít họ góc (25 %) | Quy ước tự đặt, chờ chủ nhiệm chốt trọng số |
| Sân | Mảnh sân liền cách tòa ≥ 12 m, cách ranh ≥ 3 m + vòng tròn trống lớn nhất | Chưa trừ đường nội bộ, chỗ đỗ, khối đế |

Tài liệu tham khảo: nghiên cứu Vũ Hán (khí hậu nóng ẩm, ENVI-met) cho thấy dãy song song tạo hành lang gió, tăng tốc gió khoảng 0,3 m/s, và dãy so le theo hướng gió chủ đạo tăng thêm: [MDPI Sustainability 12(3) 1046](https://www.mdpi.com/2071-1050/12/3/1046/html). Tìm kiếm chưa ra số liệu chính thức cho hướng gió Hà Nội; dùng kinh nghiệm miền Bắc, cần đối chiếu QCVN 02 hoặc hoa gió dự án trước khi coi là căn cứ.

## Cập nhật 2026-11-06

- **Xếp hàng loạt** chạy đúng bộ `sinhBoCuc` của panel, từng lô trong worker, dùng chung chế độ và ưu tiên. Bộ cũ `sinhGoiY` chỉ còn cho trợ lý.
- **Gió:** ba hướng mạnh nhất cả năm tại vị trí dự án (Open-Meteo, `huongGioDuAn`), chưa tách mùa. Chưa đặt vị trí thì Đông Nam quy ước, panel có ghi.
- **Nắng:** trừ phần bị tòa khác che 8–16 h ngày Đông chí (`cheNangPct`, tính ở nhóm chung kết).
- **Sân:** thêm độ mở về cây xanh, mặt nước trong 120 m; vòng tròn trống đổi thang 45 → 60 m vì lô lớn bị bão hoà ở 100.
- **§2.6.1 trong lô:** hai tòa dưới mức cạnh dài vẫn đặt được nếu đủ mức đầu hồi và chỉ nhìn nhau bằng đầu (`doiDauHoi`: phần sát nhau chồng dưới 24 m). Mốc 24 m là quy ước của app, chờ chủ nhiệm chốt.
- **Trục tòa:** lấy hướng có tổng chiều dài cạnh lớn nhất; thành phần chính ra đường chéo với tòa L, V.
- **Ngân sách:** đếm theo số phép thử, không theo đồng hồ, để cùng đầu vào ra cùng kết quả.

Đối chiếu bố cục đã duyệt M7 (dự án `hi97j5wp`, đích: tâm lệch TB ≤ 5 m, góc lệch ≤ 3°):

| Lô | Kết quả | Tình trạng |
|---|---|---|
| HH-1, HH-2 (2 L3) | lệch 2,2 m và 1,9 m, góc 0° | Đạt, hạng 1 |
| CT-2 (4 Z4) | lệch TB chừng 30–65 m | Chưa đạt |
| CT-1 (6 Z4) | từng đạt 14,2 m nhưng cần 10–28 giây; giữ tốc độ dưới 2 giây thì chưa đạt | Chưa đạt |
