/**
 * Chia nhỏ việc dựng 3D qua nhiều tác vụ (mở 3D không giật — scripts/do_mo_3d.mjs). Hàm dựng viết dạng generator, `yield` ở chỗ
 * dừng được (sau mỗi lô / tòa / mẫu căn); `chayHet` chạy liền (test, nơi gọi đồng bộ), `chayDan` chạy từng mẩu theo ngân sách thời gian
 * rồi nhường luồng chính.
 */
import { nhuong } from './dichShader';

export type Tung<R> = Generator<void, R, void>;

/** Chạy hết một lượt (đồng bộ). */
export function chayHet<R>(g: Tung<R>): R {
  let x = g.next();
  while (!x.done) x = g.next();
  return x.value;
}

export const laTung = <R>(x: unknown): x is Tung<R> =>
  !!x && typeof (x as Tung<R>).next === 'function' && typeof (x as Tung<R>)[Symbol.iterator] === 'function';

/** Chạy từng mẩu: mỗi tác vụ tới khi quá `ms` mili giây thì nhường; `huy()` đúng thì bỏ (trả `undefined`). */
export async function chayDan<R>(g: Tung<R>, ms: number, huy: () => boolean): Promise<{ xong: true; v: R } | undefined> {
  let t = performance.now();
  for (;;) {
    const x = g.next();
    if (x.done) return { xong: true, v: x.value };
    if (performance.now() - t > ms) {
      await nhuong();
      if (huy()) { g.return?.(undefined as R); return undefined; }
      t = performance.now();
    }
  }
}
