import { describe, expect, it } from 'vitest';
import type { DuAnApi } from '../api';
import { boDau, locDuAn, sapDuAn, type DongDuAn } from './locDuAn';

const da = (ma: string, ten: string, dia_diem: string, sua: string[]): DongDuAn => ({
  ma, loi: false,
  da: { ma, ten, dia_diem, phuong_an: sua.map((s, i) => ({ id: `pa-${i}`, ten: 'PA', tom_tat: {}, sua_luc: s })) } as DuAnApi,
});
const ds: DongDuAn[] = [
  da('aaaaaaaa', 'Khu nhà ở Hồ Tây', 'Hà Nội', ['2026-10-20T00:00:00Z']),
  da('bbbbbbbb', 'Đông Anh', 'Hà Nội', ['2026-10-28T00:00:00Z', '2026-10-01T00:00:00Z']),
  { ma: 'cccccccc', da: null, loi: false },
];

describe('lọc / sắp Dự án của tôi', () => {
  it('bỏ dấu tiếng Việt (cả đ)', () => {
    expect(boDau('Đông Anh Hồ Tây')).toBe('dong anh ho tay');
  });
  it('lọc theo tên, địa điểm, mã — không dấu, không phân biệt hoa thường', () => {
    expect(locDuAn(ds, 'ho tay').map((d) => d.ma)).toEqual(['aaaaaaaa']);
    expect(locDuAn(ds, 'HÀ NỘI').map((d) => d.ma)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
    expect(locDuAn(ds, 'cccc').map((d) => d.ma)).toEqual(['cccccccc']);
    expect(locDuAn(ds, '  ')).toBe(ds);
  });
  it('sắp: gần đây giữ thứ tự, tên A–Z, PA sửa mới nhất trước', () => {
    expect(sapDuAn(ds, 'gan')).toBe(ds);
    expect(sapDuAn(ds, 'ten').map((d) => d.ma)).toEqual(['cccccccc', 'bbbbbbbb', 'aaaaaaaa']);
    expect(sapDuAn(ds, 'sua').map((d) => d.ma)).toEqual(['bbbbbbbb', 'aaaaaaaa', 'cccccccc']);
  });
});
