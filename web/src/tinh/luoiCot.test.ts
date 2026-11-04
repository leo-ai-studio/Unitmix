import { describe, expect, it } from 'vitest';
import type { Diem } from './kieu';
import { doanTruc, luoiCotHam, phuongChinh } from './luoiCot';

const hcn = (x: number, y: number, w: number, h: number): Diem[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const ranh = hcn(0, 0, 60, 40);

describe('phương chính', () => {
  it('cột lệch 20° → 20°; ranh chữ nhật → 0', () => {
    const g = (20 * Math.PI) / 180, c = Math.cos(g), s = Math.sin(g);
    const xoay = (P: Diem[]): Diem[] => P.map(([x, y]) => [x * c - y * s, x * s + y * c]);
    expect((phuongChinh([xoay(hcn(10, 10, 0.6, 0.6)), xoay(hcn(20, 10, 0.6, 0.6))]) ?? 0) * (180 / Math.PI)).toBeCloseTo(20, 0);
    expect(phuongChinh([ranh])).toBe(0);
    expect(phuongChinh([])).toBeNull();
  });
});

describe('lưới cột hầm', () => {
  it('cột trên lưới 8,4 × 8,4 → trục đúng toạ độ, đánh số 1.. / A.., nhịp 8,4', () => {
    const cot: Diem[][] = [];
    for (const x of [8.4, 16.8, 25.2]) for (const y of [8.4, 16.8]) cot.push(hcn(x - 0.3, y - 0.3, 0.6, 0.6));
    const l = luoiCotHam(cot, ranh, 8.4)!;
    expect(l.goc).toBeCloseTo(0, 9);
    expect(l.u.slice(0, 3).map((t) => [t.ten, Math.round(t.gia * 10) / 10])).toEqual([['1', 0], ['2', 8.4], ['3', 16.8]]);
    expect(l.u.map((t) => t.gia)).toContain(25.2);
    expect(l.v.map((t) => t.gia)).toContain(16.8);
    expect(l.nhip.u![0]).toBeCloseTo(8.4, 1);
    expect(l.nhip.u![1]).toBeCloseTo(8.4, 1);
    // phủ ra hết ranh: trục cuối không cách mép quá một nhịp
    expect(60 - l.u[l.u.length - 1].gia).toBeLessThan(8.4 + 1e-6);
    expect(l.v[0].ten).toBe('A');
  });
  it('không có cột: lưới đều theo nhịp từ giữa ranh, ít nhất hai trục mỗi phương', () => {
    const l = luoiCotHam([], ranh, 8.4)!;
    expect(l.u.length).toBeGreaterThanOrEqual(2);
    expect(l.v.length).toBeGreaterThanOrEqual(2);
    for (const t of [...l.u.slice(1).map((x, i) => x.gia - l.u[i].gia), ...l.v.slice(1).map((x, i) => x.gia - l.v[i].gia)]) expect(t).toBeCloseTo(8.4, 1);
  });
  it('trục kéo dài qua hộp bao; ranh sai → null; chặn số trục', () => {
    const l = luoiCotHam([], ranh, 8.4)!;
    const [a, b] = doanTruc(l, 'u', l.u[0].gia);
    expect(a[0]).toBeCloseTo(b[0], 9);
    expect(Math.abs(b[1] - a[1])).toBeGreaterThanOrEqual(40 - 1e-6);
    expect(luoiCotHam([], [[0, 0], [1, 1]], 8.4)).toBeNull();
    expect(luoiCotHam([], hcn(0, 0, 5000, 5000), 1, 20)!.u.length).toBeLessThanOrEqual(20);
  });
  it('cột sát nhau (≤ 0,5 m) gom một trục', () => {
    const cot = [hcn(8.1, 10, 0.6, 0.6), hcn(8.2, 20, 0.6, 0.6), hcn(8.3, 30, 0.6, 0.6)];
    const l = luoiCotHam(cot, ranh, 30)!;
    expect(l.u.filter((t) => Math.abs(t.gia - 8.5) < 0.3).length).toBe(1);
  });
});
