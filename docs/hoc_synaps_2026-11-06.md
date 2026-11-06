# Học Synaps → chọn lọc cho Unitmix (06/11/2026)

Synaps (Vienna, https://synaps.app) là không gian vẽ kiến trúc chạy trên trình duyệt, nhắm vai "Figma cho kiến trúc sư". Ra khỏi Beta ngày 28/10/2026.

## 1. Đã xem gì, chưa xem gì

- **Đã đọc:** trang chủ, bảng giá, changelog, manifesto, trang Floor plan generation, tài liệu docs.synaps.app (brief-to-plan, scan-to-drawing, generate, AI tools, credits, collaborate, visualize), 5 bài bên thứ ba.
- **Đã soi:** gói JS công khai mà trang đăng nhập tải về (`my.synaps.app/assets/index-vu15gx8U.js`, 6,2 MB): tên chunk, route, từ khoá.
- **Đã vào trang chủ tài khoản của người dùng (gói Free, 300 credit), chưa vào được trình vẽ.** Mở bản vẽ thì `api.synaps.app/trpc/resources.getById` trả 402 và app đẩy về trang chủ, hiện hộp dùng thử 7 ngày đòi thẻ. Sau đó xem được trình vẽ qua Chrome, xem mục 7. Chất lượng plan AI và độ chính xác trace vẫn chưa kiểm chứng.
- **Trang chủ thấy được:** 3 lối bắt đầu (Start from scratch, Trace a floor plan, Describe your building), Space "Residential Projects", mẫu sẵn "Urban Townhouse" và "Synaps guide". Ảnh thu nhỏ của Urban Townhouse có 4 mặt bằng, mặt cắt và các mặt đứng trên cùng một canvas.

## 2. Sản phẩm

Luồng họ quảng cáo: nhập đề bài hoặc tải ảnh/PDF → chọn lô trên bản đồ → sinh mặt bằng, mặt cắt, mặt đứng, 3D nối với nhau → sửa → xuất PDF, IFC, DWG, DXF.

| Mảng | Có gì |
|---|---|
| Sinh mặt bằng | Đề bài chữ + ranh kín > 20 m². Mô hình riêng Vecy |
| Trace | Ảnh/PDF ≤ 50 MB → chọn vùng → xác nhận → bản vẽ sửa được; tùy chọn "Keep as image" |
| Vẽ | Tường nhiều lớp, cửa, cửa sổ, thang, cột, hatch, đo trực tiếp khi kéo, ghi kích thước tự động (04/11) |
| Trình bày | Papers (tờ bản vẽ, đánh số tự động, gộp PDF), walkthrough, nghiên cứu nắng 3D (04/11) |
| AI ảnh | Render nội thất, đổi sơn, sàn, giấy dán tường, vật liệu, mở rộng ảnh, tăng độ phân giải |
| Cộng tác | Nhiều người vẽ cùng lúc, thấy con trỏ, comment nhảy tới vị trí, người xem không tính tiền |
| Giá chính thức | Pro $99, Studio $199 / editor / tháng; năm giảm 20% |

Tài liệu của họ tách rạch ròi hai loại kết quả: sinh và trace ra **bản vẽ sửa được, phải kiểm**; render ra **ảnh, không cập nhật bản vẽ**. Sinh xong thì plan không còn bám ranh nữa.

## 3. Kỹ thuật (suy ra từ gói JS)

| Thấy trong gói | Suy ra |
|---|---|
| `realtime_store_bg` (đuôi kiểu wasm-bindgen), `wasmInit` | Kho dữ liệu cộng tác viết bằng ngôn ngữ biên dịch ra WASM, khả năng là Rust |
| `clipper2z` | Dùng Clipper2 bản WASM cho phép toán đa giác |
| `bim.worker`, `pdf.worker`, `shapeMapImport.worker`, `magneticLassoWorker` | Việc nặng đẩy sang Worker; có công cụ khoanh vùng từ tính |
| `/outbox/upload-url`, `/outbox/commit` | Có vẻ xếp hàng thay đổi rồi đẩy lên sau |
| `/trpc`, `__TSR_ROUTER__`, từ khoá supabase, stripe | tRPC, TanStack Router, khả năng Supabase, Stripe |
| Sentry, PostHog có `surveys`, `dead-clicks-autocapture` | Bắt lỗi và đo cú bấm chết |

Đây là suy luận từ tên tệp và từ khoá, không phải đọc mã.

## 4. Unitmix hơn ở đâu

Không tài liệu nào của Synaps nói tới kiểm quy chuẩn hay cơ cấu căn. Trang Floor plan generation ghi rõ chỉ xét vừa không gian, không kiểm kết cấu. Unitmix có sẵn: nhiều tòa trên một lô, cơ cấu căn, kiểm QCVN, hầm và chỗ đỗ, chi phí, nắng gió, 10 PA có chấm điểm. Không nên đua sinh mặt bằng từ chữ; bộ xếp theo luật và thư viện mẫu đã duyệt là thế mạnh, đừng đổi.

## 5. Đề xuất lấy về

Đối chiếu bằng tìm từ khoá trong `web/src` ngày 06/11, "chưa thấy" nghĩa là tìm không ra, chưa khẳng định chắc.

| # | Việc | Hiện trạng Unitmix | Lợi ích | Công | Tệp chính |
|---|---|---|---|---|---|
| 1 | **Ảnh/PDF quy hoạch làm nền, căn tỉ lệ bằng 2 điểm, đồ ranh lô** | `dxf/napDxf.ts` nhận DXF; chưa thấy nền ảnh | Cao: nhiều hồ sơ đầu vào chỉ có PDF/ảnh. Synaps cũng chưa có căn tỉ lệ | Vừa | `man/ManLo.tsx`, `ve/`, thêm `nhap/anhNen.ts` |
| 2 | **Bình luận ghim trên bản vẽ**, bấm là nhảy tới chỗ đó | Chưa thấy; chia sẻ mới có link xem / sửa | Cao: chủ nhiệm góp ý ngay trên TMB, tầng | Vừa | `worker/src`, migration D1, lớp phủ trên `ve/BanVe.tsx` |
| 3 | **Ghim / loại PA** trong bộ 10 PA, so sánh chỉ PA đã ghim | Chưa thấy ghim PA; đã có bảng so sánh v0.8.1 | Vừa: chốt PA nhanh | Nhỏ | `man/BangPhuongAn.tsx` |
| 4 | **Hộp lệnh Ctrl+K** tìm chức năng, tòa, luật | Chưa thấy | Vừa: app nhiều chức năng, đỡ tìm menu | Nhỏ | `ui/`, `main.tsx`, i18n |
| 5 | **Ghi kích thước tự động** trên MB tầng và đo trực tiếp khi kéo | Chưa thấy ở `ve/`, `man/` | Vừa: bản vẽ ra đọc được ngay | Vừa | `ve/`, `xuat/pdf` |
| 6 | **Tờ bản vẽ**: tự xếp TMB, tầng, 3D lên khổ giấy, đánh số, gộp nhiều PA một PDF | Đã có PDF nhiều tuỳ chọn, chưa rõ gộp PA | Vừa | Vừa | `xuat/pdf` |
| 7 | **Đo cú bấm chết** để biết nút nào người dùng bấm mà không ra gì | Chưa thấy | Nhỏ, nhưng rẻ | Nhỏ | `main.tsx` |

Mục 1 khi làm nên học luôn cách họ làm trace: chọn vùng, xác nhận rồi mới chạy, có đường lui "chỉ giữ làm ảnh". Phải có so sánh với nguồn ở bước cuối.

**Không nên lấy:** cộng tác thời gian thực (họ phải dựng kho WASM riêng, mà dự án Unitmix thường một người sửa), AI đổi vật liệu trên ảnh (ngoài trọng tâm), thu tiền theo credit.

## 6. Thông tin mâu thuẫn, đừng dùng làm căn cứ

- **Giá:** trang chính thức $99/$199; bên thứ ba ghi €59/€119. Bảng giá không có gói Free nhưng tài khoản thật có nhãn Free với 300 credit, và chính tài khoản đó không mở được bản vẽ (402). Hộp dùng thử ghi Pro $99, gạch giá $179, 7 ngày, đòi thẻ.
- **Số PA mỗi lần sinh:** trang giải pháp nói 3–12; tài liệu chỉ mô tả 1 plan.
- **Tên mô hình:** Vecy-1 ở bài bên ngoài, Vecy-2 ở trang chủ. "Đứng đầu benchmark" là lời họ tự nói.
- **Node canvas nhánh PA:** chỉ một bài ArchiGen nhắc, không có trong tài liệu hay changelog.
- **Mặt cắt, mặt đứng tự nối:** trang chủ và manifesto có nói; mục Visualize trong tài liệu không có. IFC, DWG đang ghi beta.
- **Tốc độ 50 lần, render nhanh 100–1.000 lần:** số của hãng, chưa ai kiểm độc lập.

## 7. Xem thật trình vẽ (07/11/2026, Chrome của người dùng)

Tài khoản Free vào được bản vẽ mẫu Corner Building trong lúc chạy tour hướng dẫn. Ảnh ở [anh/synaps/](anh/synaps/).

| Thấy gì | Chi tiết | Ảnh |
|---|---|---|
| **Khung tòa (Building frame)** | Một đối tượng giữ tất cả: cao 27,07 m, dài 31,57 m, liệt kê sẵn Section A-A và 4 mặt đứng | `2_khung_toa.jpg` |
| **Nút trên khung** | Generate Sections, Generate Elevations, Generate 3D nổi ngay trên khung đang chọn | `2_khung_toa.jpg` |
| **Đổi tầng** | Thanh chấm nổi trên canvas: tầng 0–3, bấm chấm là đổi, nút + chọn Add above / Add below | `3_doi_tang.jpg` |
| **Tường** | Chọn tường ra dài 2,85 m, cao 4 m, lệch đứng, căn lề; từng lớp có tên, dày 0,13 m, màu, nét; có ống hút kiểu | `4_tuong_nhieu_lop.jpg` |
| **Hộp lệnh Find anything** | Hiện công cụ gần đây kèm phím tắt, gõ không ra thì chuyển thành Ask Odin AI | `5_hop_lenh_credit.jpg` |
| **Giá trước khi bấm** | Generate a building hiện ngay huy hiệu 75 credit | `5_hop_lenh_credit.jpg` |
| **Chọn lô** | Bản đồ MapTiler + OpenStreetMap, có Draw boundary. Ở Hà Nội báo "No parcel data", không có sẵn thửa đất | `8_chon_lo_ban_do.png` |
| **Thư viện** | Asset 2D theo nhóm, có ô tìm | `6_thu_vien.jpg` |

**Chưa kiểm được:** sửa tường có cập nhật mặt cắt không, chất lượng Generate a building, Generate 3D, trace, nắng. Lúc thử thêm tầng, hộp dùng thử bật lên. Sau đó `resources.touch`, `resources.setThumbnail` trả 402 và mở lại bản vẽ bị chặn. Chưa rõ do kết thúc tour hay do thao tác sửa. Bảng so sánh gói trong app chỉ có Pro và Studio.

**Bổ sung đề xuất:**
- Mục 4 (hộp lệnh): thêm hàng công cụ gần đây kèm phím tắt; lệnh tốn tiền AI hiện chi phí ngay trên dòng lệnh.
- Mới: hiện nút hành động ngay trên tòa đang chọn ở TMB (tạo 3D, tạo mặt đứng), đỡ phải tìm ở panel.
- Mới: thanh chấm đổi tầng nổi trên bản vẽ. Phải là lớp phủ, không bóp khung giữa.
- Cẩn thận: thửa đất Việt Nam không có sẵn trên bản đồ của họ. Mục 1 (đồ ranh từ ảnh/PDF) vì thế càng có giá trị.

## 8. Chấm UI/UX: Synaps và Unitmix (07/11/2026)

Unitmix chụp trên bản mạng v0.8.3, dự án M7, cửa sổ 1920 px, chế độ Chỉ xem. Synaps chỉ xem được vài phút trên bản mẫu, nên điểm Synaps là ước lượng. Ảnh Unitmix ở [anh/synaps/so_sanh/](anh/synaps/so_sanh/).

| Tiêu chí | Synaps | Unitmix | Lý do chính |
|---|---:|---:|---|
| Thị giác | 9 | 7 | Synaps tiết chế. Unitmix có bản sắc nhưng nhiều khung, nhiều thẻ |
| Tập trung bản vẽ | 9 | 7,5 | Unitmix: khung giữa rộng 1350/1920 px, hai panel luôn mở |
| Phân cấp số liệu | 6 | 8,5 | Thẻ số to kèm Vượt, Đạt, Sát của Unitmix đọc rất nhanh |
| Công cụ theo ngữ cảnh | 9 | 6,5 | Unitmix: màn Chi phí vẫn hiện danh sách tòa, Áp dụng sửa cho |
| Dễ đọc | 6,5 | 6,5 | Unitmix: 274/469 đoạn chữ dưới 12 px; nhãn căn 5–9 px |
| Dễ tìm chức năng | 7 | 7 | Unitmix: nút có chữ, tooltip tốt, nhưng trang Dự án là 7 icon trần |
| Người mới | 9 | 5,5 | Synaps có tour 9 bước, Unitmix vào thẳng 124 ô điều khiển |
| Trạng thái, độ tin | 6 | 8,5 | Unitmix ghi rõ SỐ TẠM, căn cứ, đạt hay vượt |
| Không làm gián đoạn | 4 | 8,5 | Synaps chặn giữa lúc làm, không nói lý do |
| Hợp công việc | 7 | 9 | Unitmix đúng việc lập cơ cấu căn hộ |
| **Trung bình** | **7,25** | **7,4** | Gần bằng nhau, mạnh ở hai phía khác nhau |

Số đo khác: 41/124 ô điều khiển cao dưới 24 px, thấp nhất 13 px.

**Sửa cho Unitmix, xếp theo lợi ích trên công sức:**
1. Panel trái đổi theo màn: ở Chi phí ẩn danh sách tòa, Áp dụng sửa cho, Cơ cấu mục tiêu.
2. Trang Dự án: giữ Mở, gom phần còn lại vào menu ⋯, đưa Xoá vào đó, giãn hết bề ngang.
3. Nhãn căn trên MB tầng: ở mức vừa khung chỉ hiện tên và loại căn, phóng to mới hiện đủ số.
4. Nâng ô điều khiển dưới 24 px lên tối thiểu 24 px, không đổi bố cục khung giữa.
5. Tour 5 bước khi vào lần đầu, dùng dự án mẫu.

## 9. Nguồn

- https://synaps.app/ · https://synaps.app/pricing/ · https://synaps.app/news/changelog/ · https://synaps.app/news/blog/manifesto/ · https://synaps.app/solutions/floor-plan-generation/
- https://docs.synaps.app/
- https://www.trendingtopics.eu/viennas-synaps-raises-3-6m-pre-seed-to-build-ai-canvas-for-architects/
- https://www.aecplustech.com/tools/synaps · https://bimtoolshub.com/synaps
- https://archigenai.com/synaps-ai-floor-plan-render-canvas-first-look-2026.html · https://www.scalablepod.it/en/startup/synaps/
