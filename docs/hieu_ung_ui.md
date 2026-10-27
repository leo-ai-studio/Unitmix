# Hiệu ứng UI/UX cho Unitmix (28/10/2026)

## Hiện trạng (đo trên app chạy local)

- `unitmix.css` không có `transition` hay `@keyframes` nào; `leo-ui.css` chỉ có hiệu ứng nút (`.16s`) và vòng O quay.
- Hiệu năng **không phải** nguyên nhân gây giật: màn Tầng · Căn (1 tòa Z3, 522 phần tử SVG) xử lý một nấc lăn chuột mất trung bình 6,9 ms (p95 9,3 ms), một lần kéo 5,8 ms. Cảm giác "cứng" đến từ chỗ **mọi thứ nhảy cụt**:
  - Lăn chuột zoom cố định ×1,15 mỗi sự kiện, không xét `deltaY` (`ve/BanVe.tsx:118`). Trackpad bắn nhiều sự kiện nhỏ nên phóng vọt.
  - Nút Phóng / Thu / Vừa khung và việc đổi lô / tòa (`khoa`) gọi `setV` thẳng, khung nhìn nhảy ngay (`BanVe.tsx:72, 85–87`).
  - Kéo bản vẽ thả tay là dừng ngay, không có quán tính.
  - Mục gập (`ui/MucGap.tsx`) render có / không, nội dung bật ra.
  - Hộp thoại (`.hop-thoai`) hiện và tắt tức thì.
  - Tab bước, nhóm nút đổi nền tức thì.
  - Số liệu panel đổi giá trị không có dấu hiệu gì, mắt không biết số nào vừa đổi.
  - 3D: `enableDamping = false` (`ve3d/Khung3D.tsx:105`), xoay dừng cụt.

## Nguyên tắc

- **Không thêm thư viện.** Preact + CSS + vài hàm `requestAnimationFrame` là đủ; framer-motion chỉ dành cho React, GSAP thì nặng.
- **Ngắn**: 120–240 ms cho giao diện, ≤ 300 ms cho camera và số. Dùng ease-out (vào nhanh, dừng êm), không nảy, không parallax.
- **Không làm chậm thao tác**: đang kéo / chụm thì bám tay 1:1, chỉ thêm hiệu ứng **sau khi thả** hoặc khi bấm nút.
- **Tôn trọng `prefers-reduced-motion`**: tắt hết chuyển động, giữ đổi màu (kit LEO đã có quy ước này).
- Màu và thời gian đặt thành biến trong `:root`, như quy tắc kit LEO.

## Nguyên tắc bất di bất dịch: khung làm việc giữa không bị bóp, không xô lệch (đã làm 28/10)

Mọi thao tác, mọi ô thông tin bật ra đều **không được đổi vị trí hay kích thước** khung giữa (TMB, MB tầng, 3D).

- Bản vẽ (`.ban-ve`) và 3D (`.khung-3d`) phủ kín `.panel-giua` bằng `position: absolute; inset: 0`.
- Thanh công cụ, chú giải loại đất, dòng gợi ý, thanh 3D, ô tham số 3D **nổi đè** trong `.noi-tren` / `.noi-duoi`; chỉ chính các nút nhận chuột, phần trống vẫn thao tác được bản vẽ.
- Thông báo (chỉ xem, có nháp) nổi ở giữa mép trên khung vẽ (`.lop-thong-bao`), không chèn hàng mới đẩy cả màn xuống.
- Thanh trên cao cố định 52 px, một dòng; chữ trong nút không xuống dòng, chỉ đường dẫn co lại và cắt bằng "…".
- Panel hai bên giữ chỗ thanh cuộn (`scrollbar-gutter: stable`).
- Ô mới về sau (menu, bảng nổi, tooltip, hộp thoại) phải là lớp phủ (`absolute` / `fixed`), không được nằm trong luồng của panel giữa.

Đo lại sau khi sửa (bấm mọi mục gập, đổi chế độ, Tem căn / Nội thất, đổi màn TMB ↔ Tầng · Căn, 2D ↔ 3D, mọi nút góc nhìn 3D): **0 lần lệch** ở cả 1440×900 và 1200×800. Trước khi sửa: TMB thấp hơn MB tầng 71 px; 3D bị đẩy xuống 110 px (thêm 28 px khi chọn "Công trình"); thanh trên cao 52 hoặc 62 px tùy màn.

Còn lại: ở bề ngang ≤ 1200 px, đường dẫn trên thanh trên bị cắt ngắn. Hướng xử lý: rê chuột hiện đủ (title), hoặc gộp nhóm XLS / CAD và VI / EN vào một menu "⋯".

## Biến dùng chung (thêm đầu `unitmix.css`)

```css
:root {
  --dur-1: 120ms; --dur-2: 200ms; --dur-3: 280ms;
  --ease-out: cubic-bezier(.2, .8, .2, 1);
  --ease-io: cubic-bezier(.4, 0, .2, 1);
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 1ms !important; animation-duration: 1ms !important; }
}
```

## Danh sách hiệu ứng, xếp theo ưu tiên

### Ưu tiên 1 — cảm thấy ngay, công ít

| # | Chỗ | Hiệu ứng | Cách làm |
|---|---|---|---|
| H1 | Bản vẽ: lăn chuột | Zoom theo độ lớn cuộn, trackpad êm | `BanVe.tsx:118`: `k = Math.exp(e.deltaY * 0.0015)` thay cho `1.15` cố định; kẹp `deltaY` khi `deltaMode = 1` (chuột cuộn theo dòng) |
| H2 | Bản vẽ: Phóng / Thu / Vừa khung, đổi lô / tòa | Khung nhìn **bay** 240 ms tới đích thay vì nhảy | Thêm hàm `bayToi(dich)`: rAF nội suy `cx, cy, w` với ease-out cubic; gọi ở `phong`, `thu`, `vuaKhung` và effect `[khoa]`. Đang kéo / chụm thì huỷ rAF |
| H3 | Mục gập | Mở / gập trượt mềm, mũi tên xoay | `MucGap`: luôn render thân, bọc trong `.muc-than-boc { display:grid; grid-template-rows:0fr; transition: grid-template-rows var(--dur-3) var(--ease-out) }`, mở thì `1fr`; con `overflow:hidden`. Mũi tên dùng một ký tự `▸` + `transform: rotate(90deg)` |
| H4 | Hộp thoại (`.hop-thoai`, `.hop-3d`, Xuất CAD) | Nền mờ dần, thẻ phóng nhẹ 0,96 → 1 và trồi 6 px | `@starting-style` (Chrome / Edge mới) hoặc thêm class `.vao` sau một frame; đóng thì chạy ngược 160 ms rồi mới gỡ DOM. Thêm Esc để đóng |
| H5 | Tab bước, tab 2D / 3D / Chi phí | Nền xanh **trượt** sang tab mới | Một `<b>` nền đặt tuyệt đối, `left` / `width` lấy từ nút đang chọn, `transition: left, width var(--dur-2) var(--ease-out)` |
| H6 | Nút, ô nhập | Rê chuột đổi nền 120 ms; bấm thu 0,97; focus có vòng | `unitmix.css`: thêm `transition: background var(--dur-1), border-color var(--dur-1)` cho `.nhom-nut button, .tab-xem button, .thanh-hien-thi button, .nut-nho, .muc-lo, .the-mau`; `:active { transform: scale(.97) }`; `:focus-visible { outline: 2px solid var(--green); outline-offset: 1px }` |

### Ưu tiên 2 — làm số liệu "biết nói"

| # | Chỗ | Hiệu ứng | Cách làm |
|---|---|---|---|
| H7 | Panel phải: chỉ tiêu, cơ cấu | Số **chạy** từ giá trị cũ sang mới 300 ms, ô vừa đổi **nháy nền vàng nhạt** 600 ms | Component `<SoDong value>` dùng `useRef` nhớ giá trị cũ, rAF nội suy, định dạng qua `ui/so.ts` (giữ quy ước "—" cho ô trống). Nháy bằng class `.vua-doi` + `transition: background .6s` |
| H8 | Màu Đạt / Cảnh báo / Vượt | Đổi màu mềm thay vì bật | `.ok, .canh-bao, .vuot, .thua { transition: color var(--dur-2) }` |
| H9 | Mặt bằng tầng: đổi mẫu căn, tối ưu cơ cấu | Căn vừa thay **nháy viền** 1 lần để mắt thấy cái gì đổi | So danh sách căn trước / sau, căn khác thì thêm class `vua-doi` lên `<g>` căn: `@keyframes nhay { from { stroke-width: 3; stroke: var(--gold) } }`, 700 ms |
| H10 | Rê chuột lên tòa / căn | Tô sáng + nhãn nổi (học Architechtures) | `fill-opacity` / `stroke-width` có `transition: var(--dur-1)`; nhãn tên tòa hiện theo chuột |
| H11 | Trạng thái lưu (`.trang-thai-luu`) | "Đang lưu…" có chấm nhịp; "Đã lưu ✓" mờ dần sau 2 s | `@keyframes` opacity; dùng chung `leo-breathe` của kit |

### Ưu tiên 3 — đánh bóng

| # | Chỗ | Hiệu ứng | Cách làm |
|---|---|---|---|
| H12 | Bản vẽ: thả tay sau khi kéo | **Quán tính**: trôi tiếp rồi chậm dần (×0,92 mỗi frame) | Ghi vận tốc 2 sự kiện `pointermove` cuối; `pointerup` thì rAF trôi; chạm lại là dừng. Tắt khi giảm chuyển động |
| H13 | Kéo bản vẽ lớn (toàn khu nhiều tòa) | Gộp `setV` vào một lần mỗi frame | Trong `onPointerMove` chỉ ghi vị trí vào ref, một rAF gọi `setV`. Hiện chưa cần (6 ms), cần khi TMB có hàng chục tòa |
| H14 | Đổi màn (TMB ↔ Tầng · Căn, 2D ↔ 3D) | Mờ chéo 180 ms | `document.startViewTransition(() => doiMan())` (View Transitions API, Chrome / Edge); trình duyệt không hỗ trợ thì đổi thẳng |
| H15 | 3D: xoay, phóng | Có đà, dừng êm | `ctl.enableDamping = true; ctl.dampingFactor = 0.08`; vòng render chạy tiếp khi `ctl.update()` còn trả về `true`, xong thì quay lại render theo yêu cầu như hiện tại |
| H16 | 3D: bấm "Góc nhìn đề xuất", nạp góc đã lưu | Camera **bay** 500 ms tới góc mới | Nội suy `camera.position` và `ctl.target` với ease-in-out |
| H17 | 3D: dựng xong mô hình | Hiện dần từ mờ (300 ms) thay vì bật | `opacity` của canvas 0 → 1 khi xong lượt dựng đầu |
| H18 | Panel cuộn | Tiêu đề dính có bóng mảnh khi đã cuộn | Thêm class bằng `IntersectionObserver` |
| H19 | Đang tải thư viện | Giữ `img.spin-o` (bắt buộc theo kit), khi xong **mờ dần sang nội dung** 200 ms | `.giua-man` + nội dung mới có `@keyframes hien { from { opacity: 0 } }` |

## Không làm

- Hiệu ứng nảy (spring overshoot), parallax, chuyển trang trượt ngang dài: tốn thời gian người dùng, lệch tinh thần app kỹ thuật.
- Hoạt ảnh trong lúc đang kéo / chụm / vẽ: mọi thứ phải bám tay.
- Spinner tròn mặc định: kit LEO bắt buộc dùng lát chanh `spin-o`.
- Thư viện animation ngoài.

## Thứ tự làm đề xuất

1. Biến `:root` + H6 (CSS thuần, 1 file).
2. H1, H2 (bản vẽ) — hai chỗ người dùng đụng nhiều nhất.
3. H3, H4, H5.
4. H7, H8, H9.
5. Còn lại khi rảnh.

Kiểm tra sau mỗi bước: `prefers-reduced-motion` tắt chuyển động; kéo / chụm vẫn bám tay; `vitest` không đổi kết quả.
