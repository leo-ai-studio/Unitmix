/**
 * Vỏ gói mở rộng 3D Vị trí · Nắng · Gió (nhẹ, không import three): phần thân `moRong3DImpl` nạp lười ở lần gắn đầu.
 * MỘT nguồn giờ: kho `luc` (liên tục, không làm tròn) — Khung3D đọc qua `gio()` mỗi lần đặt mặt trời, chỉ ghi qua `datGio` khi NGƯỜI DÙNG
 * đổi giờ từ khung (góc nhìn có giờ). Test `nangGio/dongBoGio.test.ts`.
 */
import type { TrangThaiPA } from '../tinh/kieu';
import type { CanhDung } from '../ve3d/Khung3D';
import type { GanMoRong, MoRong3D } from '../ve3d/moRong3D';
import { datNG, layNG } from './kho';

export function taoMoRongNangGio(layPA: () => TrangThaiPA): MoRong3D {
  return {
    gan(c) {
      let impl: GanMoRong | null = null, huy = false, canh: CanhDung | null = null;
      import('./moRong3DImpl').then((m) => {
        if (huy) return;
        impl = m.gan(c, layPA);
        if (canh) impl.canhMoi?.(canh);
        c.capNang();
      }).catch(() => {});
      return {
        canhMoi(cn) { canh = cn; impl?.canhMoi?.(cn); },
        nang: (g) => impl?.nang?.(g) ?? null,
        gio: () => layNG().luc,
        datGio: (g) => { if (Number.isFinite(g) && g !== layNG().luc) datNG({ luc: g }); },
        huy() { huy = true; impl?.huy(); },
      };
    },
  };
}
