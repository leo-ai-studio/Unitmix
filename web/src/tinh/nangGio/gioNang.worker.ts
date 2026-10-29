/* Worker giờ nắng (nangGio/chayNang.ts điều phối): nhận đầu vào, gửi kết quả dở dang ~ mỗi 1/8 số bước, rồi kết quả cuối. Huỷ = terminate. */
import { tinhGioNang, type DauVaoNang, type KetQuaNang } from './gioNang';

type Thu = { id: number; dv: DauVaoNang };
const ctx = self as unknown as { onmessage: ((e: MessageEvent<Thu>) => void) | null; postMessage: (m: unknown) => void };

const gui = (id: number, kq: KetQuaNang, xong: boolean) =>
  ctx.postMessage({ id, xong, kq: { ...kq, gio: kq.gio.slice(), cao: xong ? kq.cao : kq.cao.slice(), mat: xong ? kq.mat : kq.mat.slice() } });

ctx.onmessage = (e) => {
  const { id, dv } = e.data;
  try {
    const moi = Math.max(1, Math.ceil(dv.buoc.length / 8));
    let t0 = performance.now();
    const kq = tinhGioNang(dv, (k) => {
      // hiện dần: gửi khi đủ 1/8 số bước hoặc đã quá 250 ms kể từ lần gửi trước
      if (k.daXong < k.tong && (k.daXong % moi === 0 || performance.now() - t0 > 250)) { gui(id, k, false); t0 = performance.now(); }
    });
    gui(id, kq, true);
  } catch (err) {
    ctx.postMessage({ id, loi: String((err as Error)?.message ?? err) });
  }
};
