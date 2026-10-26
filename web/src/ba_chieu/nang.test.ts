import { describe, it, expect } from 'vitest';
import { viTriMatTroi } from './nang';

const HN = { vd: 21.03, kd: 105.85 };
/** Thời điểm theo giờ Việt Nam (UTC+7). */
const gioVN = (nam: number, thang: number, ngay: number, gio: number) => new Date(Date.UTC(nam, thang - 1, ngay, gio - 7, 0, 0));

describe('viTriMatTroi', () => {
  it('Hà Nội 21/6/2026 12:00: góc cao 85–93°', () => {
    const { gocCao } = viTriMatTroi(HN.vd, HN.kd, gioVN(2026, 6, 21, 12));
    expect(gocCao).toBeGreaterThanOrEqual(85);
    expect(gocCao).toBeLessThanOrEqual(93);
  });

  it('Hà Nội 21/12/2026 12:00: góc cao 43–48°, phương vị 170–190°', () => {
    const { gocCao, phuongVi } = viTriMatTroi(HN.vd, HN.kd, gioVN(2026, 12, 21, 12));
    expect(gocCao).toBeGreaterThanOrEqual(43);
    expect(gocCao).toBeLessThanOrEqual(48);
    expect(phuongVi).toBeGreaterThanOrEqual(170);
    expect(phuongVi).toBeLessThanOrEqual(190);
  });

  it('Hà Nội 21/6/2026 06:00: phương vị 60–75°', () => {
    const { phuongVi } = viTriMatTroi(HN.vd, HN.kd, gioVN(2026, 6, 21, 6));
    expect(phuongVi).toBeGreaterThanOrEqual(60);
    expect(phuongVi).toBeLessThanOrEqual(75);
  });

  it('Hà Nội 23:00: mặt trời dưới chân trời', () => {
    expect(viTriMatTroi(HN.vd, HN.kd, gioVN(2026, 6, 21, 23)).gocCao).toBeLessThan(0);
  });
});
