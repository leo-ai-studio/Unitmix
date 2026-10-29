/* Worker so sánh mẫu tòa (tinh/soSanhMau.ts `soSanhMauNen` điều phối): đo từng mẫu × biến thể, báo tiến độ sau mỗi mẫu.
   Thư viện + dữ liệu lõi gửi một lần, giữ lại cho các lượt sau. Huỷ = luồng chính terminate worker. */
import type { ThuVien } from './kieu';
import type { DuLieuMB } from './loiThang';
import { soSanhMau, type ThuSoSanh, type ThuSoSanhVe } from './soSanhMau';

const ctx = self as unknown as { onmessage: ((e: MessageEvent<ThuSoSanh>) => void) | null; postMessage: (m: ThuSoSanhVe) => void };
let tv: ThuVien | null = null;
let dl: DuLieuMB | null = null;

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.tv !== undefined) tv = m.tv;
  if (m.dl !== undefined) dl = m.dl;
  try {
    const ds = soSanhMau(m.v, tv!, dl, (xong, tong) => ctx.postMessage({ id: m.id, xong, tong }));
    ctx.postMessage({ id: m.id, ds });
  } catch (err) {
    ctx.postMessage({ id: m.id, loi: String((err as Error)?.stack ?? err) });
  }
};
