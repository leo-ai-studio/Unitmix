import { describe, expect, it } from 'vitest';
import { taoPAMoi } from '../tinh/macDinh';
import type { ThuVien, ToaDat, ToaMau, TrangThaiPA } from '../tinh/kieu';
import { ganViTri } from '../tinh/viTri';
import { taoKml } from './xuatKml';

const mau = { id: 'M1', duong_bao: [[0, 0], [20000, 0], [20000, 30000], [0, 30000]] } as unknown as ToaMau;
const tv = { toa: new Map([['M1', mau]]), can: new Map() } as unknown as ThuVien;
const toa = { id: 'A', loId: 'L1', mauId: 'M1', x: 50, y: 50, gocDo: 0, soTangDe: 2, soTangDH: 20, caoDe: 4, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} } as unknown as ToaDat;

function pa(coToaDo: boolean): TrangThaiPA {
  const p = { ...taoPAMoi(), lo: [{ id: 'L1', temDat: {}, ranh: [[0, 0], [100, 0], [100, 100], [0, 100]], chiGioi: [[5, 5], [95, 5], [95, 95], [5, 95]], xungQuanh: [] }], toa: [toa] } as unknown as TrangThaiPA;
  return coToaDo ? ganViTri(p, { lat: 21.0285, lng: 105.8542, neo: [0, 0] }, 0) : p;
}

describe('taoKml — xuất Google Earth', () => {
  it('PA chưa đặt toạ độ thật → null', () => {
    expect(taoKml(pa(false), tv, 'X')).toBeNull();
  });
  it('có ranh lô, chỉ giới, tòa đùn theo chiều cao, toạ độ quanh vị trí đặt', () => {
    const k = taoKml(pa(true), tv, 'Dự án <A> & B')!;
    expect(k).toContain('Dự án &lt;A&gt; &amp; B');
    expect(k.match(/<Placemark>/g)).toHaveLength(3);
    expect(k).toContain('<extrude>1</extrude>');
    expect(k).toContain(',74'); // 2×4 + 20×3,3
    const m = /<coordinates>([^<]+)<\/coordinates>/.exec(k)![1].split(' ')[0].split(',').map(Number);
    expect(Math.abs(m[0] - 105.8542)).toBeLessThan(0.002);
    expect(Math.abs(m[1] - 21.0285)).toBeLessThan(0.002);
  });
  it('vòng khép kín (đỉnh đầu = đỉnh cuối)', () => {
    const k = taoKml(pa(true), tv, 'X')!;
    for (const c of k.matchAll(/<coordinates>([^<]+)<\/coordinates>/g)) {
      const d = c[1].split(' ');
      expect(d[0]).toBe(d[d.length - 1]);
    }
  });
});
