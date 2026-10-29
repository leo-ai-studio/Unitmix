/**
 * Cấu hình bản đồ nền cho web (gói Vị trí · Nắng · Gió): trả khoá Google Maps TRÌNH DUYỆT nếu chủ app đã đặt biến / secret
 * `GOOGLE_MAPS_KEY` (`npx wrangler secret put GOOGLE_MAPS_KEY`). Khoá này lộ ra trình duyệt theo thiết kế của Map Tiles API —
 * BẮT BUỘC giới hạn theo HTTP referrer (tên miền app) + chỉ bật Map Tiles API trong Google Cloud Console. Chưa đặt → { google: null }.
 * Xem docs/vi_tri_nang_gio.md.
 */
import type { Context } from 'hono';

export type EnvBanDo = { GOOGLE_MAPS_KEY?: string };

export function cauHinhBanDo(c: Context<{ Bindings: EnvBanDo }>): Response {
  const k = c.env?.GOOGLE_MAPS_KEY;
  return c.json({ google: typeof k === 'string' && k.trim() ? k.trim() : null }, 200, { 'Cache-Control': 'private, max-age=300' });
}
