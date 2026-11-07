import { describe, expect, it } from 'vitest';
import type { Diem } from '../tinh/kieu';
import { damBien, gopTuong, khungGieng, trucVong, veThang } from './xuatBim';

const dai = (a: Diem, b: Diem) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('tách tim tường từ đa giác', () => {
  it('hình chữ nhật mảnh ra một đoạn tim đúng bề dày', () => {
    const r = trucVong([[0, 0], [3000, 0], [3000, 200], [0, 200]]);
    expect(r).toHaveLength(1);
    expect(r[0].day).toBeCloseTo(200);
    expect(dai(r[0].a, r[0].b)).toBeCloseTo(3000);
    expect(r[0].a[1]).toBeCloseTo(100);
  });
  it('tường xiên giữ đúng góc và bề dày', () => {
    const c = Math.SQRT1_2, L = 2000, t = 100;
    const r = trucVong([[0, 0], [L * c, L * c], [L * c - t * c, L * c + t * c], [-t * c, t * c]]);
    expect(r).toHaveLength(1);
    expect(r[0].day).toBeCloseTo(100);
    expect(dai(r[0].a, r[0].b)).toBeCloseTo(2000);
  });
  it('chữ L ra hai đoạn', () => {
    const r = trucVong([[0, 0], [3000, 0], [3000, 200], [200, 200], [200, 2000], [0, 2000]]);
    expect(r).toHaveLength(2);
    expect(r.every((d) => Math.abs(d.day - 200) < 1)).toBe(true);
  });
  it('khối đặc dày vẫn ra một đoạn theo cạnh dài', () => {
    const r = trucVong([[0, 0], [600, 0], [600, 1000], [0, 1000]]);
    expect(r).toHaveLength(1);
    expect(r[0].day).toBeCloseTo(600);
    expect(dai(r[0].a, r[0].b)).toBeCloseTo(1000);
  });
});

describe('dầm biên', () => {
  it('dọc các cạnh mặt tiền, tim lùi nửa bề rộng', () => {
    const ds = damBien({ sides: 'TL', bb: [0, 0, 7000, 8000] });
    expect(ds).toHaveLength(2);
    expect(ds[0]).toEqual({ a: [0, 7890], b: [7000, 7890], day: 220 });
    expect(ds[1]).toEqual({ a: [110, 0], b: [110, 8000], day: 220 });
  });
  it('có damS thì lấy theo đa giác dầm', () => {
    const ds = damBien({ sides: 'T', bb: [0, 0, 7000, 8000], damS: [[[0, 0], [5000, 0], [5000, 220], [0, 220]]] });
    expect(ds).toHaveLength(1);
    expect(ds[0].day).toBe(220);
  });
});

describe('lõi thang', () => {
  const vong = (x0: number, y0: number, x1: number, y1: number): [Diem, Diem][] => {
    const p: Diem[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    return p.map((a, i) => [a, p[(i + 1) % 4]]);
  };
  const kich = (v: Diem[]) => [Math.hypot(v[1][0] - v[0][0], v[1][1] - v[0][1]), Math.hypot(v[2][0] - v[1][0], v[2][1] - v[1][1])].sort((a, b) => a - b);
  it('giếng kín: lấy đúng khung tường', () => {
    expect(kich(khungGieng([1000, 1100], vong(0, 0, 2300, 2400))).map(Math.round)).toEqual([2300, 2400]);
  });
  it('giếng hở một phía (cửa thang): lấy đối xứng phía còn lại', () => {
    const canh = vong(0, 0, 2300, 2400).slice(0, 3);
    expect(kich(khungGieng([1150, 1200], canh)).map(Math.round)).toEqual([2300, 2400]);
  });
  it('dò nhầm gờ tường nhỏ: về giếng chuẩn', () => {
    expect(kich(khungGieng([100, 100], vong(0, 0, 300, 300))).map(Math.round)).toEqual([2300, 2400]);
  });
  it('nét bậc ra hai vế thang, nét lẻ bỏ qua', () => {
    const bac = (x: number) => Array.from({ length: 9 }, (_, i) => ({ cat: 'detail', pts: [[x - 650, 4000 + i * 280], [x + 650, 4000 + i * 280]] as Diem[] }));
    const ve = veThang([...bac(750), ...bac(2100), { cat: 'detail', pts: [[0, 0], [1000, 0]] }, { cat: 'wall', pts: [[0, 100], [1300, 100]] }]);
    expect(ve).toHaveLength(2);
    expect(ve[0].rong).toBe(1300);
    expect(ve[0].sauBac).toBe(280);
    expect(Math.abs(ve[0].b[1] - ve[0].a[1])).toBe(2520);
    expect(ve[0].a[0]).toBe(750);
    expect(ve[1].a[0]).toBe(2100);
  });
});

describe('nối tường qua ô cửa', () => {
  it('hai đoạn và đoạn lấp ô cửa nối thành một, đoạn trùng bỏ', () => {
    const r = gopTuong([
      { a: [0, 0], b: [1000, 0], day: 200 },
      { a: [1000, 0], b: [1900, 0], day: 200 },
      { a: [1900, 0], b: [3000, 0], day: 200 },
      { a: [3000, 0], b: [0, 0], day: 200 },
    ]);
    expect(r).toHaveLength(1);
    expect(dai(r[0].a, r[0].b)).toBeCloseTo(3000);
  });
  it('khác bề dày nhiều hoặc lệch tim thì giữ riêng', () => {
    expect(gopTuong([{ a: [0, 0], b: [1000, 0], day: 100 }, { a: [1000, 0], b: [2000, 0], day: 300 }])).toHaveLength(2);
    expect(gopTuong([{ a: [0, 0], b: [1000, 0], day: 200 }, { a: [1000, 300], b: [2000, 300], day: 200 }])).toHaveLength(2);
  });
});
