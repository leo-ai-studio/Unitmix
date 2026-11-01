import { describe, expect, it } from 'vitest';
import type { ToaDat, TrangThaiPA } from './kieu';
import { lanTruyenBoCuc, toaNhanSua } from './lanTruyenBoCuc';

const toa = (id: string, loId: string, mauId: string, them: Partial<ToaDat> = {}): ToaDat =>
  ({ id, loId, mauId, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {}, ...them });
const pa = (ds: ToaDat[]) => ({ toa: ds } as unknown as TrangThaiPA);
const A = toa('a', 'l1', 'm1'), B = toa('b', 'l1', 'm1'), C = toa('c', 'l2', 'm1'), D = toa('d', 'l1', 'm2');
const sua = (p: TrangThaiPA, id: string, ghi: Partial<ToaDat>): TrangThaiPA => ({ ...p, toa: p.toa.map((x) => (x.id === id ? { ...x, ...ghi } : x)) } as TrangThaiPA);

describe('lan truyen bo cuc sang toa cung mau', () => {
  const p0 = pa([A, B, C, D]);
  it('toa: giu nguyen', () => {
    const p1 = sua(p0, 'a', { canViTri: { '0:1': 'x' } });
    expect(lanTruyenBoCuc(p0, p1, 'toa')).toEqual({ pa: p1, them: 0 });
  });
  it('lo: chi toa cung mau + cung lo', () => {
    const p1 = sua(p0, 'a', { canViTri: { '0:1': 'x' }, latO: { '0:2': true } });
    const r = lanTruyenBoCuc(p0, p1, 'lo');
    expect(r.them).toBe(1);
    expect(r.pa.toa.find((x) => x.id === 'b')!.canViTri).toEqual({ '0:1': 'x' });
    expect(r.pa.toa.find((x) => x.id === 'b')!.latO).toEqual({ '0:2': true });
    expect(r.pa.toa.find((x) => x.id === 'c')!.canViTri).toBeUndefined();
    expect(r.pa.toa.find((x) => x.id === 'd')!.canViTri).toBeUndefined();
  });
  it('duAn: moi toa cung mau, ke ca lo khac; bo trong toa khoa', () => {
    const p1 = sua(sua(p0, 'c', { khoa: true }), 'a', { congNang: { '0:3': 'phong_kt' as never } });
    const r = lanTruyenBoCuc(sua(p0, 'c', { khoa: true }), p1, 'duAn');
    expect(r.them).toBe(1); // b; c bi khoa
    expect(toaNhanSua(p1, p1.toa[0], 'duAn').map((x) => x.id)).toEqual(['b']);
  });
  it('xoa bo cuc: sua ve mac dinh cung duoc chep; tang rieng chi lay tang co o toa nhan', () => {
    const goc = pa([toa('a', 'l1', 'm1', { canViTri: { k: 'x' } }), toa('b', 'l1', 'm1', { soTangDH: 5, canViTri: { k: 'x' } })]);
    const p1 = sua(goc, 'a', { canViTri: undefined, tangRieng: { 3: { canViTri: { k: 'y' } } as never, 10: { canViTri: { k: 'z' } } as never } });
    const r = lanTruyenBoCuc(goc, p1, 'lo').pa.toa[1];
    expect(r.canViTri).toBeUndefined();
    expect(Object.keys(r.tangRieng ?? {})).toEqual(['3']);
  });
  it('sua nhieu toa cung luc hoac khong doi: giu nguyen', () => {
    const p1 = sua(sua(p0, 'a', { canViTri: { k: 'x' } }), 'b', { canViTri: { k: 'y' } });
    expect(lanTruyenBoCuc(p0, p1, 'lo').them).toBe(0);
    expect(lanTruyenBoCuc(p0, sua(p0, 'a', { x: 5 }), 'lo').them).toBe(0);
  });
});
