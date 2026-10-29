/**
 * Thử phá hoại xếp căn tòa Z / V / T / L (gồm Z3 — người dùng báo 29/10/2026: nét bao không bo căn, khe trắng, dời thang lỗi): hạt 404
 * × 30 bước — mọi phép tay + dời thang + co kéo đầu hành lang; mỗi lần đổi chỗ được nhận thì ĐỔI VỀ ngay và phải trả đúng mặt bằng
 * trước (app cũ QT-62 "kéo đi kéo về"). Bất biến như phaHoaiChay.ts (0 đè / khe mới, nét bao bo ô, DTXD = nét bao, 2–3 thang N2 + N3,
 * số căn khớp, tự chỉnh lại bất động). Kiểm nhanh lấy mẫu 1/4.
 */
import { moTaPhaHoai } from './phaHoaiChay';

moTaPhaHoai(404, 30, { mau: /^(tm|xh)-[zvtl]\d/, diVe: true });
