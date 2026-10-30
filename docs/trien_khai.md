# Triển khai Cloudflare (Task 12)

Hiện trạng: MỘT Worker `unitmix` phục vụ cả giao diện (`web/dist`, chế độ SPA) lẫn API (`/api/*`), dữ liệu ở D1 `unitmix`
(id trong `worker/wrangler.toml`). Khác kế hoạch ban đầu (Pages riêng + Worker riêng): không cần Pages project.

## Việc cần chủ nhiệm (tài khoản Cloudflare — thao tác ra ngoài, chưa chạy)

1. Đăng nhập: `npx wrangler login` (hoặc đặt `CLOUDFLARE_API_TOKEN`).
2. Migration remote: `cd worker && npx wrangler d1 migrations apply unitmix --remote` (0001_init, 0002_ai_luot).
3. Dựng web rồi deploy: `npm run build` ở gốc, sau đó `cd worker && npx wrangler deploy` → `https://unitmix.<tài-khoản>.workers.dev`.
4. Tên miền riêng (khi zone `leo-ai.dev` đã có trong tài khoản): bỏ chú thích dòng `routes = [{ pattern = "unitmix.leo-ai.dev", custom_domain = true }]`
   trong `worker/wrangler.toml`, deploy lại.
5. Trợ lý AI (nếu bật): đặt bí mật bằng `npx wrangler secret put ANTHROPIC_API_KEY` — bí mật cần: `ANTHROPIC_API_KEY`.

## Kiểm sau deploy

- Tạo dự án, sửa, mở link xem ở trình duyệt khác → chỉ xem.
- `PUT /api/du-an/.../pa/...` không kèm mã sửa → 403.
- Tải lại trang con (SPA) không ra 404.

## CI

`.github/workflows/kiem_tra.yml`: tsc (web) · vitest worker · pytest · vite build. Test web nặng (quét tệp CAD trên đĩa) chạy ở máy bằng `npm run kiem`.
Chưa có bước deploy tự động — thêm khi chủ nhiệm cấp token.

## Chưa làm / chờ

- Repo GitHub `leo-ai-studio/Unitmix` đã là remote; push chỉ khi người dùng bảo.
