import { describe, expect, it } from 'vitest';
import { dtTbTheoLoai } from './coCau';
import { taoThuVien } from './kieu';
describe('DT thông thủy trung bình theo loại', () => {
  it('trung bình theo số căn, loại không có căn là null', () => {
    const can = (id: string, loai: 'stu' | '1pn' | '2pn', dt: number) => ({ id, ma_goc: id, nhom: 'tm' as const, loai, vi_tri: 'giua' as const, vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 7000, ten_vi: id, ten_en: id, dt_tt_m2: dt, dt_tim_m2: dt + 5 });
    const tv = taoThuVien([{ id: 'T', ma_goc: 'T', nhom: 'tm', hinh: 'i', so: 1, ten_vi: '', ten_en: '', so_can_tang: 3, dtxd_m2: 0, hanh_lang_mm: 0, sau_can_mm: 0, duong_bao: [], co_cau: { a: 2, b: 1 }, loi: [] }],
      [can('a', '2pn', 60), can('b', '2pn', 75), can('c', '1pn', 45)]);
    const toa = { id: 't1', loId: 'L', mauId: 'T', x: 0, y: 0, gocDo: 0, soTangDH: 10, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} };
    const pa = { phienBan: 1 as const, lo: [], heSo: { can: 1, chung: 1, thuongMai: 1, ham: 0 }, nguong: { dtCanM2: 2, kichThuocM: 0.2, coCauDiem: 5 }, toa: [toa, { ...toa, id: 't2', canTheo: { b: 'c' } }, { ...toa, id: 'x', loId: 'K' }], ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 } };
    const kq = dtTbTheoLoai(pa, tv, 'L');
    expect(kq['2pn']).toBeCloseTo((40 * 60 + 10 * 75) / 50);
    expect(kq['1pn']).toBe(45);
    expect(kq.stu).toBeNull();
  });
});
