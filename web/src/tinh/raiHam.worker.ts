/* Worker rải hầm (tinh/hamNen.ts điều phối): nhận PA thu gọn + lô, trả KetQuaHam. Thư viện gửi một lần, giữ lại cho các lượt sau. */
import { raiHamTinh } from './ham';
import type { ThuVien } from './kieu';
import type { ThuRai, ThuXong } from './hamNen';

const ctx = self as unknown as { onmessage: ((e: MessageEvent<ThuRai>) => void) | null; postMessage: (m: ThuXong) => void };
let tv: ThuVien | null = null;

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.tv !== undefined) tv = m.tv;
  try {
    ctx.postMessage({ id: m.id, kq: raiHamTinh(m.pa, tv, m.lo) });
  } catch (err) {
    ctx.postMessage({ id: m.id, loi: String((err as Error)?.stack ?? err) });
  }
};
