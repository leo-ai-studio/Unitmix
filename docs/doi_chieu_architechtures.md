# Đối chiếu Architechtures → Unitmix (27/10/2026)

Nguồn: `MDI_Unitmix_v4/docs/nghien_cuu/hoc_architechtures_dao_sau_2026-10-26.md` (blog công khai + soi trình soạn ở gói VIEW) và thiết kế `docs/superpowers/specs/2026-10-27-unitmix-moi-design.md`.
Trạng thái tính theo bản chạy ở main `87e0396`. ✔ có · ◐ có một phần · ✘ chưa có · ⊘ chủ ý không làm.

## 1. Khung tổ chức

| Tính năng Architechtures | Unitmix | Ghi chú / việc còn lại |
|---|---|---|
| 3 tab PLANS · MODEL · COST | ◐ | Mặt bằng ✔; Mô hình (3D) ✘; Chi phí ✘ (tab hiện "đang làm") |
| Breadcrumb Khu đất › Tòa › Tầng › Căn; trên/dưới cốt 0 | ✔ | Thanh trên có đủ cấp |
| Panel trái Input · panel phải Data, đổi theo cấp | ✔ | 3 bước: Lô đất · Xếp tòa · Tầng/Căn |
| Chế độ AUTO · ASSISTED · MANUAL | ◐ | Có nút Tự động / Chỉnh tay / Chỉ xem; hai chế độ đầu chưa khác nhau về hành vi |
| Preset (lưu/nạp theo cấp) | ✘ | Chỉ tiêu + hệ số + thông số hầm lưu thành mẫu dùng lại cho dự án mới |
| Bong bóng giải thích khi rê chuột | ◐ | Mới ở vài mục (`MucGap` có `giaiThich`); bổ sung cho từng ô chỉ tiêu |

## 2. Chỉ tiêu và cơ cấu

| Tính năng | Unitmix | Ghi chú |
|---|---|---|
| Targets nhập một lần (số căn, DT đất, mật độ, tầng, dân số…) | ✔ | Nhập tay hoặc nạp Excel bảng chỉ tiêu QH, tự ghép với lô DXF |
| Mục tiêu / Đạt / Chênh có màu | ✔ | 3 mức ok · cảnh báo · vượt |
| Hệ số tính vào DT sàn theo từng hạng mục (~12 thanh trượt) | ◐ | Mới 4 hệ số (căn, chung, thương mại, hầm). Thiếu: logia, ban công có/không mái, vườn, sân thượng, hộp kỹ thuật, hiên/cột hành lang, SHCĐ, phòng kỹ thuật. **Cần chủ nhiệm chốt % theo quy định VN** |
| Bảng hai cột Xây dựng / Tính chỉ tiêu | ✔ | Ở màn Xếp tòa |
| "Areas excluded": trừ DT cố định mỗi căn theo loại tầng | ✘ | |
| Cơ cấu căn đặt ở cấp tầng; áp mái có cơ cấu riêng; tầng 1 vườn riêng | ◐ | Có mục tiêu theo lô và tối ưu tầng điển hình; áp mái / tầng 1 riêng ✘ |
| Biểu đồ tròn + bảng tòa × loại căn + hàng Mục tiêu + hàng Lệch | ✔ | Màn Xếp tòa và Tầng |
| Bảng loại căn trong tầng: số căn, %, thông thủy, xây dựng, + phần chung, tỷ lệ | ◐ | Có thông thủy, tim tường, phần chung; thiếu tỷ lệ thông thủy / (tim + chung) |
| Chỉ số NIA / GEA / hệ số phần chung toàn tòa | ◐ | Có phần chung theo tầng; chưa có tổng NIA, GEA, tỷ lệ |
| Lỗi hiển thị `undefined`, `NaN%` của họ | ✔ | Ô trống luôn ra "—" (đã có test) |

## 3. Kiểm tra khi vẽ

| Tính năng | Unitmix | Ghi chú |
|---|---|---|
| Vòng tròn kích thước tối thiểu mỗi phòng | ✘ | Cần ranh phòng + loại phòng; mẫu căn CAD chỉ có nét `space` chưa gắn tên phòng |
| Chấm màu DT so với mục tiêu | ◐ | Có theo căn (so đề bài KD); chưa theo từng phòng |
| Ngưỡng màu chỉnh được | ◐ | Có ô ngưỡng trong PA (DT căn, kích thước, lệch cơ cấu); chỉ DT căn và lệch cơ cấu đang dùng |
| Nhãn "A: 13,92 m² (+0,42) · Ø: 2,92 m" | ✘ | Phụ thuộc ranh phòng |
| Data panel theo dõi vi phạm khi sửa tay | ◐ | Có chỉ tiêu lô; chưa có bảng Tuân thủ 51 luật (phần tính đã có) |

## 4. Tòa, tầng, căn

| Tính năng | Unitmix | Ghi chú |
|---|---|---|
| Vẽ tòa bằng trục + bề rộng | ⊘ | Dùng thư viện 33 mẫu tòa đã duyệt (đúng hướng đã chốt) |
| Thông số công trình: tường, cột, nhịp tối đa, lưới kết cấu | ✘ | Chỉ cần khi làm hầm (lưới cột kế thừa) |
| Multi-storey (sửa một tầng áp nhiều tầng) | ✘ | Mô hình lưu một bố cục cho mọi tầng điển hình |
| Multi-unit (sửa một căn áp mọi căn cùng mẫu) | ✔ | "Sửa nhiều căn" |
| Đổi công năng ô: căn → kỹ thuật / SHCĐ / thương mại / ô trống | ✘ | Đụng nhóm hàm xếp căn |
| Menu lõi: phía cửa vào, thang đi xuống hầm / lên mái | ✘ | |
| Cấp căn: số PN, WC, bếp, vị trí phòng ngủ chính | ⊘ | Không vẽ lại căn; chọn mẫu CAD cùng bề ngang |
| Tùy chọn không khả thi thì nút xám | ✔ | Mẫu đổi không hợp bị ẩn, báo "không có mẫu cùng bề ngang" |
| Đổi mẫu căn cùng module + cảnh báo khác vị trí giữa/góc | ✔ | |
| Tối ưu cơ cấu bám mục tiêu | ◐ | Chỉ đổi 2PN ↔ 2PN+ (cùng bề ngang). Muốn đổi loại rộng hơn cần nới bề ngang như QT-81 app cũ |

## 5. Hầm

| Tính năng | Unitmix | Ghi chú |
|---|---|---|
| Ranh hầm DXF hoặc vẽ tay, công cụ Khoét | ✘ | |
| Rải làn + chỗ đỗ, kho, ram tự vẽ | ◐ | Hàm rải chỗ đỗ có (`raiCho`), chưa có màn |
| Lõi + cột kế thừa từ tòa, bật/tắt từng thành phần | ✘ | |
| Panel: chỗ đỗ/căn, m²/chỗ, kho/căn, m²/kho + ô Target | ✘ | Mặc định M7 đang 1 ô tô + 2 xe máy mỗi căn, chờ số thật |

## 6. So sánh PA, xuất, 3D

| Tính năng | Unitmix | Ghi chú |
|---|---|---|
| So sánh tối đa 6 PA: dải thẻ, sắp xếp, thẻ "PA chọn so với PA gốc", bảng | ✘ | Danh sách dự án đã có tóm tắt từng PA |
| Giá bán theo tầng, phạt lệch mix, biên lợi nhuận | ⊘ | Chờ đơn giá thật; có thể chấm điểm PA bằng điểm lệch cơ cấu |
| Xuất XLS / CAD / BIM từng PA | ✘ | Nút XLS, CAD có trên thanh trên nhưng chưa nối |
| 3D: khối tòa, camera lưu, nắng, bóng đổ, mặt cắt | ✘ | Có hàm vị trí mặt trời và khối đế |
| Gợi ý xếp tòa tự động | ✘ | |

## Phần Unitmix có mà Architechtures không có

Nạp DXF ô đất tô hatch + bảng chỉ tiêu Excel, tự ghép lô; mẫu tòa / căn từ thư viện CAD có kiểm diện tích; bộ luật QCVN 06 / QĐ34 / MDI (51 luật) và kiểm thoát nạn PCCC khớp app cũ; kiểu hiển thị Salekit (Galia, HH1, Rivea); lưu PA trực tuyến, mỗi dự án một đường link.

## Thứ tự làm theo (đề xuất)

Mỗi mục ghi **ai làm được**: *Repo* = cần sửa mã trong repo `E:\Projects\Unitmix` (Claude Code hoặc C2); *Chat* = viết tài liệu / phản biện, không cần repo.

| # | Việc | Nguồn mục | Cỡ | Làm được bởi | Xong khi |
|---|---|---|---|---|---|
| A1 | Lớp PCCC trên bản vẽ tầng (cửa ngăn cháy, tủ họng nước, cự ly thoát nạn, đỏ khi vượt) | §3 | M | Repo | Bật/tắt được lớp; số căn vượt khớp `pccc.ts` ở 33 mẫu tòa |
| A2 | Panel "Tuân thủ" 51 luật: đạt / cảnh báo / vượt, bấm luật thì tô đối tượng | §3 | M | Repo | Mỗi luật có mã QT cũ để tra ngược |
| A3 | Bảng hệ số tính vào DT sàn đủ ~12 hạng mục + preset | §2 | M | Repo, **cần chốt % mặc định** | Đổi hệ số thì DT tính HSSDĐ đổi đúng |
| A4 | Preset theo cấp (lô / tòa) cho chỉ tiêu, hệ số, thông số hầm | §1 | M | Repo | Dự án mới nạp lại được |
| A5 | So sánh PA (≤ 6) + xuất XLS | §6 | M | Repo | Bảng chỉ số + xuất Excel có dấu tiếng Việt |
| A6 | Màn Hầm: ranh, rải chỗ đỗ, kho, panel chỗ/căn | §5 | L | Repo, **cần số chỗ đỗ M7** | Chỗ đỗ ≥ yêu cầu, kho ≥ 1/căn |
| A7 | 3D: khối, camera, nắng, bóng đổ | §6 | L | Repo | Lưu được góc nhìn |
| A8 | Tự xếp dãy căn bám cơ cấu và DT đề bài, loại dãy vi phạm PCCC | §4 | L | Repo, **cần quyết nới bề ngang** | Điểm lệch cơ cấu giảm, 0 vi phạm mới |
| A9 | Sửa nhiều tầng, tầng áp mái có cơ cấu riêng | §2, §4 | L | Repo | Mô hình lưu bố cục theo tầng |
| A10 | Vòng tròn kích thước tối thiểu + chấm màu theo phòng | §3 | L | Repo, cần dữ liệu ranh phòng | |
| A11 | Bong bóng giải thích mọi ô chỉ tiêu, hệ số, ngưỡng (VI/EN) | §1 | S | Repo hoặc Chat (viết nội dung) | |
| B1 | Phản biện bảng đối chiếu này: còn tính năng nào của Architechtures bị bỏ sót? | tất cả | S | Chat | Danh sách bổ sung kèm nguồn |
| B2 | Soạn bảng % tính vào DT sàn theo quy định VN (logia, ban công, hành lang, tum, kỹ thuật, hầm) kèm căn cứ | §2 | S | Chat | Bảng có điều khoản; chủ nhiệm duyệt |
| B3 | Soạn nội dung bong bóng giải thích cho A11 (VI + EN) | §1 | S | Chat | |

Cần chủ nhiệm quyết: bảng % hệ số (A3), số chỗ đỗ M7 (A6), cách nới bề ngang để tối ưu cơ cấu (A8), có làm phần tài chính trong so sánh PA không.
