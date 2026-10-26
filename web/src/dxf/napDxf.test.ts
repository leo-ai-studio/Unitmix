import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dienTich } from '../tinh/hinhHoc';
import { napDxf, taoLoTuDxf } from './napDxf';

const mau = readFileSync(new URL('./__fixtures__/lo_mau.dxf', import.meta.url), 'utf-8');

describe('đọc DXF', () => {
  it('liệt kê lớp và tự đổi mm sang m theo $INSUNITS', () => {
    const d = napDxf(mau);
    expect(d.lop).toEqual(['HT-NHA', 'QH-CGXD', 'QH-RANH-LO', 'QH-TEM']);
    expect(d.donVi).toBe('mm');
    const ranh = d.polyKin('QH-RANH-LO');
    expect(ranh).toHaveLength(2);
    expect(dienTich(ranh[0])).toBeCloseTo(12400, 0);
  });

  it('đường hở không được coi là ranh; báo lỗi ranh_khong_kin khi lớp chỉ có đường hở', () => {
    const d = napDxf(mau);
    expect(d.polyKin('HT-NHA')).toEqual([]);
    expect(d.loiLop('HT-NHA')).toBe('ranh_khong_kin');
    expect(d.loiLop('QH-RANH-LO')).toBeNull();
  });

  it('đọc chữ tem đất (TEXT và MTEXT) kèm vị trí', () => {
    const chu = napDxf(mau).chu('QH-TEM').map((c) => c.noiDung).sort();
    expect(chu).toEqual(['CC-02', 'NOXH-01']);
  });

  it('mỗi đa giác kín là một lô; tem đất và chỉ giới gán vào lô chứa nó', () => {
    const lo = taoLoTuDxf(napDxf(mau), { ranh: 'QH-RANH-LO', chiGioi: 'QH-CGXD', tem: 'QH-TEM', xungQuanh: 'HT-NHA' });
    expect(lo.map((l) => l.temDat.kyHieu)).toEqual(['CC-02', 'NOXH-01']);
    expect(lo.map((l) => l.temDat.chucNang)).toEqual(['tm', 'xh']);
    expect(dienTich(lo[1].chiGioi!)).toBeCloseTo(48 * 48, 0);
    expect(lo[0].xungQuanh).toHaveLength(1);
  });

  it('tệp không phải DXF -> ném lỗi dễ hiểu', () => {
    expect(() => napDxf('xin chao')).toThrow(/DXF/);
  });
});
