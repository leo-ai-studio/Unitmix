import { describe, expect, it } from 'vitest';
import { dtCoDau, dtVung } from './hinhHoc';
import type { Diem } from './kieu';
import { cacCanhDe, keoCanh } from './keoMatDe';

const hcn = (x: number, y: number, w: number, h: number): Diem[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];   // ngược chiều kim đồng hồ (y lên)

describe('cạnh kéo được', () => {
  it('hình chữ nhật có 4 cạnh, pháp tuyến hướng ra ngoài', () => {
    const cs = cacCanhDe([hcn(0, 0, 10, 6)]);
    expect(cs).toHaveLength(4);
    const day = cs.find((c) => c.a[1] === 0 && c.b[1] === 0)!;       // cạnh dưới → ra phía −y
    expect(day.ra[1]).toBeCloseTo(-1, 9);
    const phai = cs.find((c) => c.a[0] === 10 && c.b[0] === 10)!;     // cạnh phải → ra phía +x
    expect(phai.ra[0]).toBeCloseTo(1, 9);
  });
  it('bỏ vòng lỗ (thuận chiều kim đồng hồ) và cạnh quá ngắn', () => {
    const lo = hcn(2, 2, 4, 4).reverse();
    expect(cacCanhDe([hcn(0, 0, 10, 10), lo]).every((c) => c.vong === 0)).toBe(true);
    expect(cacCanhDe([[[0, 0], [10, 0], [10, 0.2], [0, 10]]]).some((c) => c.dai < 0.5)).toBe(false);
  });
});

describe('kéo / đẩy một mặt', () => {
  it('đẩy cạnh trên hình chữ nhật 10×6 ra 4 m → 10×10, DT +40', () => {
    const v = [hcn(0, 0, 10, 6)];
    const tren = cacCanhDe(v).find((c) => c.a[1] === 6 && c.b[1] === 6)!;
    const r = keoCanh(v, tren.vong, tren.i, 4);
    expect(dtVung(r)).toBeCloseTo(100, 6);
    expect(Math.max(...r[0].map((p) => p[1]))).toBeCloseTo(10, 6);
  });
  it('kéo vào 2 m → DT giảm; kéo quá sâu không cho hình ngược', () => {
    const v = [hcn(0, 0, 10, 6)];
    const phai = cacCanhDe(v).find((c) => c.a[0] === 10 && c.b[0] === 10)!;
    expect(dtVung(keoCanh(v, phai.vong, phai.i, -2))).toBeCloseTo(8 * 6, 6);
    const qua = keoCanh(v, phai.vong, phai.i, -30);
    expect(dtVung(qua)).toBeGreaterThanOrEqual(0);
    expect(qua.every((r) => dtCoDau(r) >= 0)).toBe(true);
  });
  it('hình chữ L: đẩy cạnh có đỉnh lõm, hai đỉnh kề theo giao điểm đúng', () => {
    const L: Diem[] = [[0, 0], [20, 0], [20, 8], [8, 8], [8, 20], [0, 20]];
    const dtGoc = dtVung([L]);
    const canh = cacCanhDe([L]).find((c) => c.a[0] === 20 && c.a[1] === 0 && c.b[1] === 8)!;     // cạnh dọc bên phải chân L
    const r = keoCanh([L], canh.vong, canh.i, 5);
    expect(dtVung(r)).toBeCloseTo(dtGoc + 5 * 8, 6);
  });
  it('cạnh kề song song (đỉnh thẳng hàng): thêm bậc, DT đúng', () => {
    const v: Diem[] = [[0, 0], [5, 0], [10, 0], [10, 6], [0, 6]];       // cạnh dưới có đỉnh giữa thẳng hàng
    const canh = cacCanhDe([v]).find((c) => c.a[0] === 0 && c.a[1] === 0)!;     // nửa trái cạnh dưới
    const r = keoCanh([v], canh.vong, canh.i, 3);
    expect(dtVung(r)).toBeCloseTo(60 + 5 * 3, 6);
  });
  it('không đổi: δ = 0 hoặc vòng lỗ', () => {
    const v = [hcn(0, 0, 10, 6)];
    expect(keoCanh(v, 0, 0, 0)).toBe(v);
    expect(keoCanh([hcn(0, 0, 10, 10), hcn(2, 2, 4, 4).reverse()], 1, 0, 3)).toEqual([hcn(0, 0, 10, 10), hcn(2, 2, 4, 4).reverse()]);
  });
  it('đẩy rồi kéo lại cùng đoạn → về DT ban đầu', () => {
    const v = [hcn(0, 0, 10, 6)];
    const c = cacCanhDe(v).find((x) => x.a[1] === 6 && x.b[1] === 6)!;
    const ra = keoCanh(v, c.vong, c.i, 3);
    const c2 = cacCanhDe(ra).find((x) => Math.abs(x.a[1] - 9) < 1e-6 && Math.abs(x.b[1] - 9) < 1e-6)!;
    expect(dtVung(keoCanh(ra, c2.vong, c2.i, -3))).toBeCloseTo(60, 6);
  });
});
