import { describe, it, expect } from 'vitest';
import { raiChoDo } from './raiCho';
import type { Diem, ThongSoHam } from './kieu';

const ts: ThongSoHam = { soTang: 1, ranh: null, nhip: 8, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 0 };

const hcn = (x0: number, y0: number, x1: number, y1: number): Diem[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** Điểm nằm trong đa giác (bao gồm sát biên với sai số nhỏ). */
function trong(p: Diem, poly: Diem[]): boolean {
  let vao = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) vao = !vao;
  }
  return vao;
}

function giaoBBox(a: Diem[], b: Diem[]): boolean {
  const bb = (q: Diem[]) => [Math.min(...q.map((d) => d[0])), Math.min(...q.map((d) => d[1])), Math.max(...q.map((d) => d[0])), Math.max(...q.map((d) => d[1]))];
  const A = bb(a);
  const B = bb(b);
  return A[0] < B[2] && A[2] > B[0] && A[1] < B[3] && A[3] > B[1];
}

describe('raiChoDo', () => {
  it('ranh chữ nhật 60 x 40, không vật cản: 120–170 chỗ', () => {
    const r = raiChoDo(hcn(0, 0, 60, 40), [], ts);
    expect(r.soCho).toBeGreaterThanOrEqual(120);
    expect(r.soCho).toBeLessThanOrEqual(170);
    expect(r.cho.length).toBe(r.soCho);
    expect(r.soKho).toBe(0);
    expect(r.kho).toEqual([]);
    expect(r.lan.length).toBeGreaterThan(0);
    for (const c of r.cho) expect(c.length).toBe(4);
  });

  it('vật cản vuông 10 x 10 ở giữa: số chỗ giảm, không chỗ nào giao vật cản', () => {
    const ranh = hcn(0, 0, 60, 40);
    const vc = hcn(25, 15, 35, 25);
    const khong = raiChoDo(ranh, [], ts);
    const co = raiChoDo(ranh, [vc], ts);
    expect(co.soCho).toBeLessThan(khong.soCho);
    for (const c of co.cho) expect(giaoBBox(c, vc)).toBe(false);
  });

  it('mọi chỗ có cả 4 đỉnh trong ranh; ranh chữ L không chỗ nào lọt phần khuyết', () => {
    const L: Diem[] = [[0, 0], [60, 0], [60, 20], [30, 20], [30, 40], [0, 40]];
    const r = raiChoDo(L, [], ts);
    expect(r.soCho).toBeGreaterThan(0);
    const khuyet = hcn(30, 20, 60, 40);
    for (const c of r.cho) {
      for (const d of c) {
        // dịch nhẹ vào tâm chỗ để tránh sai số biên
        const tam: Diem = [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2];
        const p: Diem = [d[0] + (tam[0] - d[0]) * 1e-6, d[1] + (tam[1] - d[1]) * 1e-6];
        expect(trong(p, L)).toBe(true);
      }
      expect(giaoBBox(c, khuyet)).toBe(false);
    }
  });

  it('ranh rỗng / null / < 3 điểm: tất cả rỗng, soCho 0', () => {
    for (const ranh of [[], [[0, 0], [1, 1]] as Diem[], null as unknown as Diem[]]) {
      const r = raiChoDo(ranh, [], ts);
      expect(r.soCho).toBe(0);
      expect(r.cho).toEqual([]);
      expect(r.lan).toEqual([]);
      expect(r.kho).toEqual([]);
      expect(r.soKho).toBe(0);
    }
  });

  it('ranh 120 x 80 chạy dưới 200 ms', () => {
    const t0 = performance.now();
    const r = raiChoDo(hcn(0, 0, 120, 80), [], ts);
    const dt = performance.now() - t0;
    expect(r.soCho).toBeGreaterThan(400);
    expect(dt).toBeLessThan(200);
  });
});
