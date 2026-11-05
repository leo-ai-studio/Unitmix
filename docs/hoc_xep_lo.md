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
