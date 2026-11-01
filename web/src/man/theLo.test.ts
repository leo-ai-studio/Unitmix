import { describe, expect, it } from 'vitest';
import type { Lo } from '../tinh/kieu';
import { taoLo } from '../tinh/macDinh';
import { moTaLo } from './theLo';

describe('thẻ thông số lô', () => {
  it('diện tích theo ranh và chỉ tiêu tối đa của lô', () => {
    const lo: Lo = taoLo('hh1', 'HH-1', 'tm', [[0, 0], [100, 0], [100, 50], [0, 50]]);
    lo.temDat = { ...lo.temDat, kyHieu: 'HH-1', chiTieu: { ...lo.temDat.chiTieu, matDoMax: 40, hssddMax: 6, tangCaoMax: 28, danSoMax: 1600 } };
    expect(moTaLo(lo)).toMatchObject({ kyHieu: 'HH-1', dtM2: 5000, mdxdMax: 40, hssddMax: 6, tangCaoMax: 28, danSoMax: 1600 });
  });
  it('ranh chưa đủ 3 điểm → diện tích 0', () => {
    expect(moTaLo(taoLo('x', 'X', 'tm', [[0, 0], [1, 1]])).dtM2).toBe(0);
  });
});
