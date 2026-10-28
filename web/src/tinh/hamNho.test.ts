import { describe, expect, it } from 'vitest';
import { raiHam, raiHamTinh } from './ham';
import { tinhKhoiLuong } from './duToan';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Lo, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { chuanHoaChiPhi, chuanHoaPA } from './macDinh';

// Cache raiHam theo đầu vào (de_xuat_hieu_nang P1): sửa đơn giá không rải lại, đổi thông số hầm / tòa trên lô thì rải lại.
const can: CanMau[] = [
  { id: 'tm-2pn-m1', ma_goc: 'a', nhom: 'tm', loai: '2pn', vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 7500, ten_vi: '', ten_en: '', dt_tt_m2: 60, dt_tim_m2: 64 },
];
const mau: ToaMau = {
  id: 'tm-i9', ma_goc: 'x', nhom: 'tm', hinh: 'i', so: 9, ten_vi: '', ten_en: '', so_can_tang: 4, dtxd_m2: 400,
  hanh_lang_mm: 1800, sau_can_mm: 8500, duong_bao: [[0, 0], [20000, 0], [20000, 20000], [0, 20000]], co_cau: { 'tm-2pn-m1': 4 }, loi: [],
};
const tv = taoThuVien([mau], can);
const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 3.5, tangCaoMax: 25, tangDe: null, tangCanHo: null, tangHam: null, danSoMax: 1600, soCanMax: null, nguoiMoiCan: 3.5, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo = (id: string, x0: number): Lo => ({ id, ranh: [[x0, 0], [x0 + 60, 0], [x0 + 60, 40], [x0, 40]], chiGioi: null, xungQuanh: [], temDat: { kyHieu: id, chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 0, '1pn': 0, '2pn': 100, '2pnp': 0, '3pn': 0 } } });
const toa = (o: Partial<ToaDat>): ToaDat => ({ id: 't1', loId: 'A', mauId: 'tm-i9', x: 30, y: 20, gocDo: 0, soTangDH: 10, soTangDe: 2, caoDe: 4.5, caoDH: 3.3, coApMai: true, deOffset: 0, canTheo: {}, ...o });
const pa: TrangThaiPA = chuanHoaPA({
  phienBan: 1, lo: [lo('A', 0), lo('B', 100)], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH,
  toa: [toa({}), toa({ id: 't2', loId: 'B', x: 130 })],
  ham: { soTang: 1, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 },
});
const A = pa.lo[0];

describe('raiHam nhớ theo đầu vào', () => {
  it('cùng đầu vào trả cùng kết quả, khớp bản không nhớ', () => {
    const a = raiHam(pa, tv, A);
    expect(a).not.toBeNull();
    expect(raiHam({ ...pa }, tv, { ...A })).toBe(a);
    expect(JSON.stringify(a)).toBe(JSON.stringify(raiHamTinh(pa, tv, A)));
  });

  it('sửa đơn giá / tòa ở lô khác: trúng cache', () => {
    const a = raiHam(pa, tv, A);
    const cp = chuanHoaChiPhi(pa.chiPhi);
    expect(raiHam({ ...pa, chiPhi: { ...cp, donGia: { ...cp.donGia, ketCau: cp.donGia.ketCau + 1 } } }, tv, A)).toBe(a);
    expect(raiHam({ ...pa, toa: pa.toa.map((t) => (t.loId === 'B' ? { ...t, x: 140 } : t)) }, tv, A)).toBe(a);
  });

  it('đổi thông số hầm, dời tòa trên lô, đổi thư viện: rải lại', () => {
    const a = raiHam(pa, tv, A);
    const b = raiHam({ ...pa, ham: { ...pa.ham, soTang: 2 } }, tv, A);
    expect(b).not.toBe(a);
    expect(b!.tang).toHaveLength(2);
    expect(raiHam({ ...pa, toa: pa.toa.map((t) => (t.loId === 'A' ? { ...t, soTangDH: 12 } : t)) }, tv, A)).not.toBe(a);
    expect(raiHam(pa, taoThuVien([mau], can), A)).not.toBe(a);
  });

  it('tinhKhoiLuong (tab Chi phí) dùng chung cache: sửa đơn giá không rải lại', () => {
    const a = raiHam(pa, tv, A)!;
    const cp = chuanHoaChiPhi(pa.chiPhi);
    const kl = tinhKhoiLuong({ ...pa, chiPhi: { ...cp, donGia: { ...cp.donGia, coc: cp.donGia.coc * 2 } } }, tv);
    expect(kl.lo.find((x) => x.loId === 'A')?.dtHam).toBe(a.tong.dtSan);
  });
});
