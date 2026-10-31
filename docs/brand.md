# Brand LEO Unitmix — cách làm cho gọn

Nguồn thật nằm ở code; tài liệu này chỉ chỉ chỗ và ghi quy ước. Đổi brand thì sửa đúng các chỗ dưới đây, không sửa từng màn.

## Nhận diện

- **Tên app:** `UNITMIX` (chữ hoa, `t('app.ten')`). Tác giả: NghiaVT. Thương hiệu chung: LEO / MDI.
- **Logo:** gồm hai lớp ảnh chồng nhau trong `web/public/brand/`: `leo_ai_mark_base.png` (khung) và `leo_ai_o.png` (vòng O). Vòng O là lớp riêng để quay làm chỉ báo "đang chạy". Bộ khác: `leo_ai_mark.png` (logo gộp), `leo_ai_app_icon.png`, `favicon_32/64.png`, `pwa_180/192/512.png` và `pwa_512_maskable.png`.
- **Thành phần dùng logo:** `ThuongHieu` trong `web/src/ui/ThanhTren.tsx`. Tham số `dangXuLy` cho vòng O quay. Tham số `anBan` ẩn số phiên bản dưới tên khi trang đã có số phiên bản chỗ khác.
- **Chỉ báo tải:** ảnh `img.spin-o` (vòng O quay, 1,4 s). Không dùng vòng xoay mặc định. Khi người dùng bật giảm chuyển động thì thay bằng nhịp thở (`leo-breathe`), vòng O luôn được miễn trừ khỏi lệnh tắt chuyển động.

## Màu và chữ (`web/src/styles/leo-ui.css`, khối `:root`)

| Biến | Giá trị | Dùng cho |
|---|---|---|
| `--green` | `#174f52` | Primary: nút chính, nhấn, tiêu đề |
| `--secondary` | `#b8b0a3` | Secondary của brand |
| `--gold` | `#c7aa76` | điểm nhấn phụ |
| `--logo-ink` | `#022b1e` | màu nét logo |
| `--bg` / `--panel` | `#f1f0ea` / `#fffefa` | nền trang / thẻ, khung |
| `--ink` / `--muted` / `--line` | `#292d2d` / `#737d78` / `#dfe3dc` | chữ chính / chữ phụ / đường kẻ |
| `--soft`, `--hover`, `--selected` | xanh nhạt | nền nhấn, rê chuột, đang chọn |

Trạng thái (`web/src/styles/unitmix.css`): `--ok #0f6b45`, `--canh-bao #8a5300`, `--vuot #b42318`, `--thua #1559a8`. Chữ: `--font` = Segoe UI, Arial. Bán kính góc `--radius` 8 px. Màu luôn lấy từ biến, không ghi cứng trong thành phần.

## Biểu tượng

- Biểu tượng nét SVG tự vẽ, phong cách Forma: nét mảnh 1,5 trên khung 24, đầu nét tròn, `currentColor` lấy theo màu brand. Không chép biểu tượng của hãng khác.
- Thêm biểu tượng ở `web/src/ui/bieuTuongSvg.ts` (`SVG_BT`), khoá phải trùng `BIEU_TUONG` trong `web/src/ui/bieuTuong.ts`. Khoá chưa có hình thì nút dùng ký hiệu chữ.
- Nút biểu tượng dùng `NutBieuTuong` (`k="..."`, nhãn qua `nhan` khi cần); kiểu ở `web/src/styles/bieu-tuong.css`.

## Song ngữ VI / EN

- Mọi chữ hiển thị đi qua `t('khoá')`, khoá khai ở `web/src/i18n/vi.json` và `en.json`, luôn thêm CẢ HAI. Tiếng Việt là bản gốc. Công tắc VI / EN ở góc phải trang.
- Nội dung động có chỗ điền kiểu `{n}`, thay bằng `.replace`.

## Phiên bản và tác giả

- Hiện ở góc phải trang Dự án (`NghiaVT · vX.Y.Z · ngày`) và dưới logo ở màn soạn; bấm để xem lịch sử, mỗi bản thu gọn mặc định.
- Mỗi lần deploy nâng số và thêm mục ở `web/src/lichSuPhienBan.ts` (xem mục 8 trong `CLAUDE.md`).

## Giao diện chung

- Mục chính mặc định thu gọn, bấm mũi tên để xổ (danh sách dự án, lịch sử phiên bản, các khối panel).
- Ô tích / ô chọn nằm cùng dòng, bên trái chữ.
- Chuyển động ngắn (≤ 0,2 s), tắt khi người dùng chọn giảm chuyển động (`web/src/styles/chuyen-dong.css`).

## App mới của MDI

App mới tạo từ đầu thì dùng skill `mdi-app-branding`: logo cố định, tên có tiền tố MDI, tác giả NghiaVT, có công tắc VI / EN. Unitmix đã theo bộ quy ước trên.
