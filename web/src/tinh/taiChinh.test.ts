import { describe, expect, it } from 'vitest';
import { tinhDuToan, tinhKhoiLuong } from './duToan';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiPhiPA, type Lo, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { CHI_PHI_MAC_DINH, chuanHoaPA, taoLo } from './macDinh';
import { heSoTang, tinhTaiChinh } from './taiChinh';

// Tòa giả 20 × 20 m, mỗi tầng 1 căn 2PN 100 m² thông thủy.
const tv = taoThuVien(
  [{ id: 'm', ma_goc: 'x', nhom: 'tm', hinh: 'i', so: 1, ten_vi: '', ten_en: '', so_can_tang: 1, dtxd_m2: 400, hanh_lang_mm: 1800, sau_can_mm: 8500,
    duong_bao: [[0, 0], [20000, 0], [20000, 20000], [0, 20000]], co_cau: { c: 1 }, loi: [] } as ToaMau],
  [{ id: 'c', ma_goc: 'c', nhom: 'tm', loai: '2pn', vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 7500, ten_vi: '', ten_en: '', dt_tt_m2: 100, dt_tim_m2: 105 } as CanMau],
);
const lo: Lo = taoLo('A', 'CC-01', 'tm', [[0, 0], [100, 0], [100, 50], [0, 50]]);
const toa: ToaDat = { id: 't', loId: 'A', mauId: 'm', x: 50, y: 25, gocDo: 0, soTangDH: 4, soTangDe: 0, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} };
function paGia(ban: Partial<ChiPhiPA['ban']> = {}): TrangThaiPA {
  const pa = chuanHoaPA({ phienBan: 1, lo: [lo], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: [toa], ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 } });
  return { ...pa, chiPhi: { ...CHI_PHI_MAC_DINH, ban: { ...CHI_PHI_MAC_DINH.ban, ...ban } } };
}
const phang = { tangMoiTang: 0, soTangThap: 0, tangThap: 0, tangTren: 0, oTo: 0, xeMay: 0, thuongMai: 0, banHang: 0, chiPhiDat: 0, phatLech: 0 };

function chay(pa: TrangThaiPA, lech: number | null = null) {
  const kl = tinhKhoiLuong(pa, tv, false);
  const dt = tinhDuToan(kl, pa.chiPhi);
  return { kl, dt, tc: tinhTaiChinh(pa, tv, kl, dt, lech) };
}

describe('tài chính', () => {
  it('hệ số tầng: tăng mỗi tầng, riêng tầng thấp và tầng trên cùng', () => {
    const b = { tangMoiTang: 1, soTangThap: 1, tangThap: -10, tangTren: 20 };
    expect(heSoTang(1, 4, b)).toBeCloseTo(0.9);
    expect(heSoTang(2, 4, b)).toBeCloseTo(1.01);
    expect(heSoTang(4, 4, b)).toBeCloseTo(1.03 * 1.2);
  });

  it('doanh thu căn = Σ DT TT × giá × hệ số tầng; lợi nhuận, biên, hoà vốn khớp', () => {
    const { dt, tc } = chay(paGia({ ...phang, can: { ...CHI_PHI_MAC_DINH.ban.can, '2pn': 50e6 } }));
    expect(tc.theoLoai['2pn'].soCan).toBe(4);
    expect(tc.doanhThuCan).toBeCloseTo(4 * 100 * 50e6);
    expect(tc.doanhThu).toBeCloseTo(tc.doanhThuCan);
    expect(tc.tongChiPhi).toBeCloseTo(dt.tongMuc);
    expect(tc.loiNhuan).toBeCloseTo(tc.doanhThu - dt.tongMuc);
    expect(tc.bienLN).toBeCloseTo((tc.loiNhuan / tc.doanhThu) * 100);
    expect(tc.giaBQ).toBeCloseTo(50e6);
    // Bán đúng giá hoà vốn thì lợi nhuận = 0.
    expect(tc.giaHoaVon! * 400).toBeCloseTo(dt.tongMuc, -2);
  });

  it('phạt lệch cơ cấu và chi phí bán hàng, đất', () => {
    const { tc } = chay(paGia({ ...phang, phatLech: 0.5, banHang: 2, chiPhiDat: 1e9 }), 10);
    expect(tc.tyLePhat).toBeCloseTo(0.05);
    expect(tc.doanhThu).toBeCloseTo(tc.doanhThuGop * 0.95);
    expect(tc.chiPhiBan).toBeCloseTo(tc.doanhThu * 0.02);
    expect(tc.tongChiPhi).toBeCloseTo(tc.tongMuc + 1e9 + tc.chiPhiBan);
    // Giá hoà vốn vẫn cho lợi nhuận 0 khi có phạt và bán hàng.
    const f = tc.giaHoaVon! / tc.giaBQ!;
    const r = f * tc.doanhThuCan * 0.95;
    expect(r - r * 0.02 - tc.tongMuc - 1e9).toBeCloseTo(0, -2);
  });

  it('chưa có căn: không NaN, biên và hoà vốn null', () => {
    const pa = { ...paGia(), toa: [] };
    const { tc } = chay(pa);
    expect(tc.doanhThu).toBe(0);
    expect(tc.bienLN).toBeNull();
    expect(tc.giaHoaVon).toBeNull();
    expect(Number.isNaN(tc.loiNhuan)).toBe(false);
  });
});
