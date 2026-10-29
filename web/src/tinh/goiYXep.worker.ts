/* Worker gợi ý xếp tòa (tinh/xepToa.ts `goiYXepToaNen` điều phối): chạy `sinhGoiY`, báo tiến độ sau mỗi mẫu, trả danh sách gợi ý.
   Thư viện gửi một lần, giữ lại cho các lượt sau. Huỷ = luồng chính terminate worker. */
import type { ThuVien } from './kieu';
import { sinhGoiY, type ThuGoiY, type ThuGoiYVe } from './xepToa';

const ctx = self as unknown as { onmessage: ((e: MessageEvent<ThuGoiY>) => void) | null; postMessage: (m: ThuGoiYVe) => void };
let tv: ThuVien | null = null;

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.tv !== undefined) tv = m.tv;
  try {
    const g = sinhGoiY({ ...m.v, tv: tv! });
    for (;;) {
      const r = g.next();
      if (r.done) { ctx.postMessage({ id: m.id, ds: r.value }); return; }
      ctx.postMessage({ id: m.id, xong: r.value.xong, tong: r.value.tong });
    }
  } catch (err) {
    ctx.postMessage({ id: m.id, loi: String((err as Error)?.stack ?? err) });
  }
};
