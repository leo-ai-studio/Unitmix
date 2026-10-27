# Nhật ký làm việc (mới nhất ở trên)

Mỗi đợt một mục: ngày, ai làm, đã làm gì (kèm commit), kiểm thế nào, còn dở gì. Ngắn, đủ để phiên sau làm tiếp không phải dò lại.

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
