import { describe, expect, it } from 'vitest';
import { taoLo } from './macDinh';
import { sucChua } from './sucChua';

describe('sức chứa của lô', () => {
  it('lô 12.400 m², MĐXD 40 %, HSSDĐ 3,5, dân số 1.600, 3,5 người/căn', () => {
    const lo = taoLo('A', 'CC-02', 'tm', [[0, 0], [124, 0], [124, 100], [0, 100]]);
    expect(sucChua(lo)).toEqual({ dtLo: 12400, dtxdMax: 4960, dtSanMax: 43400, soCanUoc: 457, choDoCan: 457, choXeMayCan: 914, cayXanhCan: 2480 });
  });
  it('lô không phải đất ở -> không ước số căn, chỗ đỗ, xe máy', () => {
    const sc = sucChua(taoLo('B', 'DV-1', 'khac', [[0, 0], [100, 0], [100, 60], [0, 60]]));
    expect(sc.dtxdMax).toBe(2400);
    expect([sc.soCanUoc, sc.choDoCan, sc.choXeMayCan]).toEqual([null, null, null]);
  });
  it('lô chưa có ranh -> mọi giá trị null', () => {
    expect(sucChua(taoLo('A', 'x', 'tm', []))).toEqual({ dtLo: null, dtxdMax: null, dtSanMax: null, soCanUoc: null, choDoCan: null, choXeMayCan: null, cayXanhCan: null });
  });
});
