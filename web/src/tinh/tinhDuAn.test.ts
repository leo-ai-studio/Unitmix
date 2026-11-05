import { describe, expect, it } from 'vitest';
import { loTheoTinhDuAn, taoLo, taoPAMoi } from './macDinh';
import { ganViTri, docLienKet } from './viTri';

describe('tỉnh dự án', () => {
  const lo = taoLo('l1', 'A', 'tm', [[0, 0], [10, 0], [10, 10], [0, 10]]);
  it('lô mới thừa hưởng tỉnh; khai riêng thì giữ', () => {
    expect(loTheoTinhDuAn({ tinhDuAn: 'hn' }, lo).temDat.danSo).toEqual({ tinh: 'hn', giaiDoan: 'cp' });
    expect(loTheoTinhDuAn({}, lo).temDat.danSo).toBeUndefined();
    const rieng = { ...lo, temDat: { ...lo.temDat, danSo: { tinh: 'hcm', giaiDoan: 'qh' as const } } };
    expect(loTheoTinhDuAn({ tinhDuAn: 'hn' }, rieng).temDat.danSo?.tinh).toBe('hcm');
  });
  it('link Google Maps → vị trí PA', () => {
    const r = docLienKet('https://www.google.com/maps/@10.7769,106.7009,17z');
    expect('lat' in r).toBe(true);
    if ('lat' in r) {
      const pa = ganViTri(taoPAMoi(), { lat: r.lat, lng: r.lng, neo: [0, 0] });
      expect(pa.viTri?.lat).toBeCloseTo(10.7769, 4);
      expect(pa.huongView?.viDo).toBeCloseTo(10.7769, 3);
    }
  });
});
