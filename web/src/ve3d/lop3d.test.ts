import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Diem } from '../tinh/kieu';
import { cayDocDuong, daiDuong, diemCayTrong, dungCay, dungTrucThang, gopHinh, hinhDun, kcBien, trongDG } from './lop3d';

const vuong = (a: number): Diem[] => [[0, 0], [a, 0], [a, a], [0, a]];

describe('lớp 3D: đường, cây (tất định)', () => {
  it('dải đường nằm NGOÀI lô, rộng đúng lộ giới, theo cả hai chiều vòng của ranh', () => {
    for (const ranh of [vuong(50), [...vuong(50)].reverse()]) {
      const i = ranh.findIndex((p, k) => p[1] === 0 && ranh[(k + 1) % 4][1] === 0); // cạnh y = 0
      const cd = ranh.map((_, k) => (k === i ? 12 : null));
      const d = daiDuong(ranh, cd);
      expect(d).toHaveLength(1);
      const ys = d[0].poly.map((p) => p[1]);
      expect(Math.min(...ys)).toBeCloseTo(-12, 9); expect(Math.max(...ys)).toBeCloseTo(0, 9);
    }
    expect(daiDuong(vuong(50), undefined)).toEqual([]);
  });
  it('cây dọc đường trên vỉa hè (1,8 m ngoài mép lô), chừa 6 m hai đầu', () => {
    const c = cayDocDuong(daiDuong(vuong(50), [12, null, null, null]), 9);
    expect(c.length).toBe(5);
    c.forEach((p) => { expect(p[1]).toBeCloseTo(-1.8, 9); expect(p[0]).toBeGreaterThanOrEqual(6); expect(p[0]).toBeLessThanOrEqual(44); });
  });
  it('cây sân: trong lô, cách biên ≥ lề, không trong / sát vật cản; chạy lại ra cùng kết quả', () => {
    const can: Diem[][] = [[[20, 20], [30, 20], [30, 30], [20, 30]]];
    const a = diemCayTrong(vuong(60), 8, 500, 3, can, 4), b = diemCayTrong(vuong(60), 8, 500, 3, can, 4);
    expect(a.length).toBeGreaterThan(10);
    expect(a).toEqual(b);
    a.forEach((p) => { expect(trongDG(p, vuong(60))).toBe(true); expect(kcBien(p, vuong(60))).toBeGreaterThanOrEqual(3); expect(trongDG(p, can[0])).toBe(false); expect(kcBien(p, can[0])).toBeGreaterThanOrEqual(4); });
  });
});

describe('lớp 3D: hình gộp ít draw call', () => {
  it('gộp nhiều khối đùn thành một hình; cây 4 draw call; trục thang gắn lớp "thang"', () => {
    const g = gopHinh(THREE, [hinhDun(THREE, vuong(5), 0, 3), hinhDun(THREE, vuong(4), 10, 3)])!;
    expect(g.getAttribute('position').count).toBeGreaterThan(0);
    const goc = new THREE.Group();
    dungCay(THREE, goc, Array.from({ length: 300 }, (_, i) => [i * 3.1, (i % 17) * 2.7] as Diem), 'vatlieu', true);
    expect(goc.children.length).toBeLessThanOrEqual(4);
    expect(goc.children.every((o) => o.userData.lop === 'cay')).toBe(true);
    const g2 = new THREE.Group();
    dungTrucThang(THREE, g2, [{ pts: vuong(3), thang: true, y0: 0, y1: 40 }, { pts: vuong(6), thang: false, y0: 0, y1: 43 }]);
    expect(g2.children.length).toBe(3);
    expect(g2.children.every((o) => o.userData.lop === 'thang')).toBe(true);
  });
});
