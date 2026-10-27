import { describe, expect, it } from 'vitest';
import { easeInOut, easeOutCubic, tron } from './chuyenDong';
import { noiSuyNhin } from '../ve/BanVe';
import { chuSo } from './SoDong';

describe('chuyenDong', () => {
  it('ease đi từ 0 tới 1', () => {
    for (const f of [easeOutCubic, easeInOut]) {
      expect(f(0)).toBe(0);
      expect(f(1)).toBe(1);
    }
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5); // vào nhanh
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
  });
  it('tron nội suy tuyến tính', () => {
    expect(tron(10, 20, 0.25)).toBe(12.5);
  });
});

describe('noiSuyNhin', () => {
  const a = { cx: 0, cy: 0, w: 100 }, b = { cx: 40, cy: -20, w: 400 };
  it('đầu và cuối đúng đích', () => {
    expect(noiSuyNhin(a, b, 0)).toEqual(a);
    const c = noiSuyNhin(a, b, 1);
    expect(c.cx).toBe(40); expect(c.cy).toBe(-20); expect(c.w).toBeCloseTo(400);
  });
  it('bề rộng nội suy theo tỷ lệ (giữa = trung bình nhân)', () => {
    expect(noiSuyNhin(a, b, 0.5).w).toBeCloseTo(200);
  });
});

describe('chuSo', () => {
  it('ô trống luôn là "—"', () => {
    expect(chuSo(null, {}, 'vi')).toBe('—');
    expect(chuSo(undefined, {}, 'vi')).toBe('—');
    expect(chuSo(NaN, {}, 'vi')).toBe('—');
  });
  it('định dạng qua fmtSo', () => {
    expect(chuSo(41280, {}, 'vi')).toBe('41.280');
    expect(chuSo(38.6, { thapPhan: 1, donVi: '%' }, 'vi')).toBe('38,6 %');
  });
});
