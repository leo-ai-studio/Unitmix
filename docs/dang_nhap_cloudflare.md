# Đăng nhập bằng mail công ty (Cloudflare Access)

Mục tiêu: **chỉ mail `@meygroup.vn` đăng nhập được thì mới tạo / nhân bản dự án**. Ai có link vẫn xem được; ai có link sửa vẫn sửa
được phương án đó. Người đã đăng nhập thì cột "Sửa lúc" ghi **mail thật** (không giả được), chưa đăng nhập thì ghi tên tự khai.

## Cách chạy
1. Nút **Tạo dự án** / **Nhân bản dự án** hỏi `GET /api/toi`. Máy chủ bật yêu cầu (có `MIEN_TAO_DA`) mà chưa đăng nhập →
   chuyển sang `/api/dang-nhap?quay=<trang hiện tại>`. Đường này do **Cloudflare Access chặn**: chưa đăng nhập thì Access bắt
   nhập mail và gửi mã một lần; qua được thì Access đặt cookie `CF_Authorization` cho cả tên miền, Worker chuyển về trang cũ.
2. Worker kiểm JWT trong cookie (`worker/src/danhTinh.ts`: chữ ký RS256 theo khoá công khai của team, hạn, audience, nơi cấp)
   rồi so đuôi mail với `MIEN_TAO_DA`. Sai miền → 403, chưa đăng nhập → 401.
3. Chưa đặt 3 biến dưới đây thì mọi thứ như cũ (ai cũng tạo được).

## Việc cần làm trên Cloudflare (chủ tài khoản)
1. **Zero Trust → Settings → Authentication**: bật phương thức đăng nhập (One-time PIN qua mail là đủ; hoặc Google Workspace nếu
   công ty dùng). Ghi lại **team domain**, dạng `tenteam.cloudflareaccess.com` → `CF_ACCESS_TEAM = tenteam`.
2. **Zero Trust → Access → Applications → Add → Self-hosted**:
   - Destination: tên miền của app + đường **`/api/dang-nhap`** (chỉ đường này, để link xem / sửa vẫn mở tự do).
   - Policy **Allow**, Include → *Emails ending in* `@meygroup.vn`. (Muốn theo nhóm mail: *Email list* / *Google group*.)
   - Lưu, mở application → copy **Application Audience (AUD) Tag** → `CF_ACCESS_AUD`.
3. Đặt biến cho Worker (`worker/wrangler.toml` mục `[vars]`, hoặc Dashboard → Workers → unitmix → Settings → Variables):
   ```toml
   [vars]
   CF_ACCESS_TEAM = "tenteam"
   CF_ACCESS_AUD  = "<AUD tag>"
   MIEN_TAO_DA    = "meygroup.vn"
   ```
4. Deploy lại (có migration `0003_sua_boi.sql`).

Lưu ý: Access theo đường chỉ dùng được khi app chạy trên **tên miền thuộc tài khoản Cloudflare** (custom domain). Với địa chỉ
`*.workers.dev`, nút Access của Worker bảo vệ cả site; nếu không chọn được đường riêng thì gắn tên miền riêng
(xem ghi chú `routes` trong `wrangler.toml`).
