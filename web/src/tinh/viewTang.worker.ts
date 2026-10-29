/* Worker điểm view theo dải tầng (tinh/viewNen.ts điều phối). Thư viện gửi một lần, giữ cho các lượt sau. */
import { danhGiaViewPA, type KcTheoH } from './huongView';
import type { ThuVien } from './kieu';
import { kcToa261 } from './xepToa';
import type { ThuViewNen, ThuViewNenVe } from './viewNen';

const ctx = self as unknown as { onmessage: ((e: MessageEvent<ThuViewNen>) => void) | null; postMessage: (m: ThuViewNenVe) => void };
let tv: ThuVien | null = null;

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.tv !== undefined) tv = m.tv;
  try {
    const t0 = performance.now();
    const kc: KcTheoH | undefined = m.lo02 ? (H) => kcToa261(m.lo02!, H).dai : undefined;
    const kq = danhGiaViewPA(m.pa, tv!, { kc, nhieuTang: m.nhieuTang });
    ctx.postMessage({ id: m.id, kq, ms: performance.now() - t0 });
  } catch (err) {
    ctx.postMessage({ id: m.id, loi: String((err as Error)?.stack ?? err) });
  }
};
