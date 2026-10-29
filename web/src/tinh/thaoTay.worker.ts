/* Worker thao tác tay nặng (tinh/tayNen.ts điều phối): nhận tên thao tác + đối số, trả KetQuaTay. Thư viện / dữ liệu lõi gửi một lần. */
import type { ThuVien } from './kieu';
import type { DuLieuMB } from './loiThang';
import { chayTay, type ThuTay, type ThuTayXong } from './tayNen';

const ctx = self as unknown as { onmessage: ((e: MessageEvent<ThuTay>) => void) | null; postMessage: (m: ThuTayXong) => void };
let tv: ThuVien | null = null;
let dl: DuLieuMB | null = null;

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.tv !== undefined) tv = m.tv;
  if (m.dl !== undefined) dl = m.dl;
  try {
    if (!tv) throw new Error('chưa có thư viện');
    ctx.postMessage({ id: m.id, kq: chayTay(m.ten, { tv, dl }, m.args) });
  } catch (err) {
    ctx.postMessage({ id: m.id, loi: String((err as Error)?.stack ?? err) });
  }
};
