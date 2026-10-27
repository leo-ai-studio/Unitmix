# Nhật ký làm việc (mới nhất ở trên)

Mỗi đợt một mục: ngày, ai làm, đã làm gì (kèm commit), kiểm thế nào, còn dở gì. Ngắn, đủ để phiên sau làm tiếp không phải dò lại.

## 2026-10-28 · đơn giá app cũ + tự xếp / STRETCH / dồn khít · Claude Code + agent Opus

**Đã làm** (`nang-cap/architechtures`: `03a9fef` đơn giá, `e0bb3be` gộp tự xếp):
- Đơn giá dự toán lấy từ định mức app cũ `MDI_Unitmix_v4/data/master/dinh_muc_du_toan.json` (hồ sơ SĐT NOXH cao tầng Q2/2024 HN, quy 2026 theo trượt giá nhóm A–E, bình quân I15/Z15): dòng dự toán đổi sang nhóm gói thầu (cọc, kết cấu, hoàn thiện, cửa, thang máy, PCCC, M&E) tính trên m² sàn nổi = 9,12 tr/m²; hầm 6,31 tr/m² (đối chứng Saphire); dự phòng KL mặc định 0 (SĐT đã gồm 10 %). PA lưu đơn giá kiểu cũ → tự về mặc định mới. Dự án thử: 740 tr/căn (hồ sơ 736–758).
- Gợi ý xếp tòa MT-05 (`tinh/xepToa.ts`, `ui/GoiYXepToa.tsx`): tham lam trên lưới 3 m, kiểm LO-01/02/05, CT-01..04, thoát nạn; top 5; tự chạy khi lô có chỉ tiêu mà chưa có tòa.
- Tối ưu MB tầng đổi khác bề ngang + STRETCH QT-81 (`tinh/stretch.ts`, `tinh/toiUu.ts`), bật mặc định; dồn khít XC-04 (`viTriCan`); khe XC-02/10 chỉ kiểm (`tinh/khe.ts`); số CH liên tục XC-08. Đường cắt STRETCH 27/34 mẫu trong `can.json`.

**Kiểm:** tsc 0, web 256/256, worker 9/9, pytest 12/12, build qua; trên app: gợi ý ra 3 PA trong 0,4 s, khung giữa không đổi; tab Chi phí không NaN.

**Còn dở:** XC-03 ô thang 3.000, XC-05 khít nét bao lõi, XC-06 sảnh 3,0/2,6 m, XC-07 nối hành lang, PC-11 thang bộ tự động — cần đổi mô hình dữ liệu tầng (lõi / hành lang đang cố định theo mẫu tòa). Nút STRETCH tay từng căn; CAD / 3D căn kéo; Bảng 2.9 / 2.12 QCVN 01 khi gợi ý; bề rộng đường từng cạnh lô; QLDA lũy thoái TT 38/2026 (app cũ có bảng).

## 2026-10-28 · tab Chi phí · agent Opus + Claude Code gộp

**Đã làm** (`885b125` trên `nang-cap/architechtures`, chưa vào `main`):
- `tinh/duToan.ts`: khối lượng theo lô / tòa (DT sàn tháp / đế / áp mái / hầm, DT thông thủy, mặt ngoài, chỗ đỗ từ `raiHam`, thang 1/70 căn) → dự toán nhóm xây dựng + thiết bị, QLDA, tư vấn, khác, dự phòng → tổng mức, suất đ/m², đ/căn.
- `tinh/taiChinh.ts`: doanh thu căn theo tầng (hệ số tầng), chỗ đỗ, thương mại đế, trừ lệch cơ cấu → lợi nhuận, biên, giá hoà vốn.
- `TrangThaiPA.chiPhi`, `CHI_PHI_MAC_DINH` (mọi số là số tạm), preset nhóm `chiPhi`, XLS sheet Dự toán + Tài chính.
- `man/ManChiPhi.tsx` (giữa + phải; nhớ kết quả bằng WeakMap theo PA, hàm `ketQua` đã export). So sánh PA: thêm hàng tổng mức / lợi nhuận (màn hình + XLS).

**Kiểm:** tsc 0, web 235/235, worker 9/9, pytest 12/12, build qua; trên app: khung giữa không đổi kích thước khi sang Chi phí, không NaN.

**Còn dở:** số thang chưa đếm từ lõi; toàn bộ đơn giá / giá bán / tỷ lệ chờ QS chốt; mức trừ lệch cơ cấu (0,1%/điểm) cần chốt.

## 2026-10-28 · v0.2.0 · Claude Code (Opus 5.5) + 9 agent

**Yêu cầu:** học Architechtures (sổ tay, blog, 21 video, bấm thử app thật) → chọn lọc cái hợp app + QCVN → làm hết, chia nhánh / agent, chọn model tối ưu.

**Đã làm** (nhánh `nang-cap/architechtures`, gộp `main` ở `6b9436c`, đã push; sau đó `562b0fb` phiên bản):
- DT sàn HSSDĐ theo QCVN 01:2021 1.4.21: cộng hầm (trừ đỗ xe / kỹ thuật theo `pa.phanHam`), áp mái, căn theo từng tầng, trừ ô đổi sang phòng kỹ thuật. Dự án thử: chỉ tiêu trước đây tính thiếu (bỏ hẳn hầm).
- Luật QCVN 04 DC-06…DC-11 + panel Tuân thủ; SHCĐ ≥ 0,8 m²/căn.
- Ô căn: đổi công năng, chọn nhiều, menu lõi; bố cục riêng từng tầng (`ToaDat.tangRieng`).
- Màn Hầm: QCVN 13 + QCVN 04 2.2.17, xe điện theo dự thảo SĐ 01:2026 (chỉ cảnh báo), vẽ tay ranh, 3D khối hầm.
- Dữ liệu phòng 34/34 mẫu căn bóc từ DWG (loại phòng đoán theo thiết bị), nhãn A / Ø.
- So sánh PA ≤ 6, nhân bản PA, xuất XLS, xuất CAD theo tầng + công năng ô.
- Tooltip kèm căn cứ QCVN, preset hai tầng, hiệu ứng H1–H19, khung giữa cố định (0 lần lệch).
- Phiên bản app hiện trên giao diện.

**Cách làm:** 7 agent đợt 1 (Opus: ô căn + nhiều tầng, hầm, bóc phòng; Sonnet: hiệu ứng, tooltip + preset, so sánh + XLS, luật QCVN 04), 2 agent đợt 2 (Sonnet: xuất CAD theo tầng, 3D hầm + vẽ ranh). Mỗi agent một worktree, gộp từng nhánh vào nhánh tích hợp, chạy lại test sau mỗi lần gộp.

**Kiểm:** web vitest 219/219, worker 9/9, pytest 12/12, `tsc` 0, `vite build` qua; xem trên app 1440×900 và 1200×800.

**Còn dở:** tab Chi phí (dự toán + tài chính, agent Opus); tự xếp tòa TMB + STRETCH MB tầng như app cũ (agent Opus); các điểm chờ chủ nhiệm chốt (mục 6 tài liệu học Architechtures).
