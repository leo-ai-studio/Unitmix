import { describe, expect, it } from 'vitest';
import { laCaoTang, loaiDat } from './loaiDat';
import type { ChucNang } from './kieu';

const lo = (kyHieu: string, chucNang: ChucNang = 'khac') => ({ temDat: { kyHieu, chucNang } }) as Parameters<typeof loaiDat>[0];

describe('loại đất', () => {
  it('lô nhà ở (thương mại / xã hội) là cao tầng, bất kể ký hiệu', () => {
    expect(loaiDat(lo('CT-1', 'xh'))).toBe('o_cao_tang');
    expect(loaiDat(lo('HH-1', 'tm'))).toBe('o_cao_tang');
    expect(laCaoTang(lo('CX-1'))).toBe(false);
  });
  it('theo tiền tố ký hiệu', () => {
    expect(loaiDat(lo('CX-4'))).toBe('cay_xanh');
    expect(loaiDat(lo('MN-2'))).toBe('mat_nuoc');
    expect(loaiDat(lo('GD-1'))).toBe('giao_duc');
    expect(loaiDat(lo('NT-1'))).toBe('giao_duc');
    expect(loaiDat(lo('HH-2'))).toBe('hon_hop');
    expect(loaiDat(lo('HT-1'))).toBe('ha_tang');
    expect(loaiDat(lo('VH-1'))).toBe('cong_cong');
    expect(loaiDat(lo('DV-1'))).toBe('cong_cong');
    expect(loaiDat(lo('Lô 7'))).toBe('khac');
  });
});
