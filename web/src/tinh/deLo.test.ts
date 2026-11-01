import { describe, expect, it } from 'vitest';
import { dienTich, dtVung } from './hinhHoc';
import type { Diem, Lo } from './kieu';
import { taoLo } from './macDinh';
import { deTuHienCo, dtDeToiDaQH, khoiDeLo } from './deLo';

const hcn = (x: number, y: number, w: number, h: number): Diem[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
// lô 100 × 80 = 8000 m², chỉ giới lùi 6 m → vùng xây 88 × 68
const lo = (de?: Lo['de']): Lo => {
  const l = taoLo('l1', 'HH-1', 'tm', hcn(0, 0, 100, 80));
  l.chiGioi = hcn(6, 6, 88, 68);
  l.temDat = { ...l.temDat, chiTieu: { ...l.temDat.chiTieu, matDoMax: 45 } };
  return de ? { ...l, de } : l;
};
const chanTap = [hcn(30, 25, 40, 30)];   // chân tháp 1200 m²

describe('khối đế của lô', () => {
  it('mặc định tuDong = hợp chân nở deOffset như cũ', () => {
    const r = khoiDeLo(lo(), chanTap, [5]);
    expect(r.dt).toBeCloseTo(50 * 40, 0);       // 40×30 nở 5 m mỗi phía → 50×40
    expect(r.ghiChu).toBeNull();
  });
  it('theoDT: nở đều tới đúng DT yêu cầu (sai số < 0,3 m²)', () => {
    for (const mt of [1500, 2500, 4000]) {
      const r = khoiDeLo(lo({ che: 'theoDT', dtM2: mt }), chanTap, [0]);
      expect(Math.abs(r.dt - mt)).toBeLessThan(0.3);
      expect(r.ghiChu).toBeNull();
      expect(r.no!).toBeGreaterThan(0);
    }
  });
  it('theoDT nhỏ hơn chân tháp → đế = chân tháp, có ghi chú', () => {
    const r = khoiDeLo(lo({ che: 'theoDT', dtM2: 500 }), chanTap, [0]);
    expect(r.dt).toBeCloseTo(1200, 1);
    expect(r.ghiChu).toBe('nhoHonChanThap');
  });
  it('theoDT lớn hơn chỉ giới chứa được → cắt ở chỉ giới, có ghi chú', () => {
    const r = khoiDeLo(lo({ che: 'theoDT', dtM2: 20000 }), chanTap, [0]);
    expect(r.dt).toBeCloseTo(88 * 68, 0);
    expect(r.ghiChu).toBe('vuotChiGioi');
  });
  it('maxQH: DT = MĐXD đế tối đa × DT lô (45 % × 8000 = 3600 m²)', () => {
    const l = lo({ che: 'maxQH' });
    expect(dtDeToiDaQH(l)).toBeCloseTo(3600, 6);
    const r = khoiDeLo(l, chanTap, [0]);
    expect(Math.abs(r.dt - 3600)).toBeLessThan(0.3);
    expect(r.dtMucTieu).toBeCloseTo(3600, 6);
  });
  it('tay: giữ hình đã vẽ, luôn chứa chân tháp, cắt theo chỉ giới', () => {
    const de = hcn(10, 10, 60, 40);                // chân tháp (30..70 × 25..55) nhô ra ngoài đế tay → đế = hợp
    const r = khoiDeLo(lo({ che: 'tay', ranh: [de] }), chanTap, [0]);
    expect(r.dt).toBeGreaterThan(60 * 40);          // phải chứa phần chân tháp nhô ra
    expect(r.dt).toBeLessThanOrEqual(60 * 40 + 1200);
    const ngoai = khoiDeLo(lo({ che: 'tay', ranh: [hcn(-20, -20, 200, 200)] }), chanTap, [0]);
    expect(ngoai.dt).toBeCloseTo(88 * 68, 0);      // cắt chỉ giới
  });
  it('tay chưa có hình → rơi về đế tự động, ghi chú "trong"', () => {
    const r = khoiDeLo(lo({ che: 'tay' }), chanTap, [4]);
    expect(r.ghiChu).toBe('trong');
    expect(r.dt).toBeCloseTo(48 * 38, 0);
  });
  it('chuyển sang tay giữ nguyên hình', () => {
    const r = khoiDeLo(lo(), chanTap, [5]);
    const d = deTuHienCo(r.vung);
    expect(dtVung(d.ranh)).toBeCloseTo(r.dt, 2);
    expect(d.che).toBe('tay');
    expect(dienTich(d.ranh[0])).toBeGreaterThan(0);
  });
  it('không có tòa → không có đế, mọi chế độ', () => {
    for (const che of ['tuDong', 'theoDT', 'maxQH', 'tay'] as const) expect(khoiDeLo(lo({ che, dtM2: 1000 }), [], []).dt).toBe(0);
  });
});
