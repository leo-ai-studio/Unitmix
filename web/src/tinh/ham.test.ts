import { describe, expect, it } from 'vitest';
import { coVao, ranhHam, tinhHamSo, yeuCauDoXe } from './ham';
import { dienTich } from './hinhHoc';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Diem, type Lo, type ThongSoHam, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';

const hcn = (x0: number, y0: number, x1: number, y1: number): Diem[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 3.5, tangCaoMax: 25, tangDe: null, tangCanHo: null, tangHam: null, danSoMax: 1600, soCanMax: null, nguoiMoiCan: 3.5, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo = (ranh: Diem[], chucNang: 'tm' | 'xh' = 'tm'): Lo => ({
  id: 'A', ranh, chiGioi: null, xungQuanh: [],
  temDat: { kyHieu: 'CC-01', chucNang, chiTieu, coCauMucTieu: { stu: 5, '1pn': 20, '2pn': 45, '2pnp': 15, '3pn': 15 } },
});
const canGia: CanMau[] = [
  { id: 'c2', ma_goc: 'a', nhom: 'tm', loai: '2pn', vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 7500, ten_vi: '', ten_en: '', dt_tt_m2: 70, dt_tim_m2: 75 },
];
const toaGia: ToaMau = {
  id: 'T', ma_goc: 'x', nhom: 'tm', hinh: 'i', so: 1, ten_vi: '', ten_en: '', so_can_tang: 10, dtxd_m2: 400,
  hanh_lang_mm: 1800, sau_can_mm: 8500, duong_bao: [[0, 0], [40000, 0], [40000, 20000], [0, 20000]], co_cau: { c2: 10 }, loi: [],
};
const tv = taoThuVien([toaGia], canGia);
const toa: ToaDat = { id: 't1', loId: 'A', mauId: 'T', x: 50, y: 40, gocDo: 0, soTangDH: 20, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} };
const ham: ThongSoHam = { soTang: 2, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 };
const pa = (h: Partial<ThongSoHam> = {}, l = lo(hcn(0, 0, 100, 80))): TrangThaiPA =>
  ({ phienBan: 1, lo: [l], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: [toa], ham: { ...ham, ...h } });

describe('DT chỗ để xe yêu cầu (QCVN 04:2021 2.2.17.1)', () => {
  it('nhà ở thương mại: lấy max(25 m²/4 căn, 20 m²/100 m² DT sử dụng), trong đó ≥ 6 m² xe máy/căn', () => {
    // 200 căn × 70 m²: 25/4 × 200 = 1 250; 20% × 14 000 = 2 800 → 2 800
    const y = yeuCauDoXe(200, 14000, false, false);
    expect(y.theoCan).toBeCloseTo(1250);
    expect(y.theoDT).toBeCloseTo(2800);
    expect(y.tong).toBeCloseTo(2800);
    expect(y.xeMay).toBeCloseTo(1200);
  });
  it('căn nhỏ: 25 m²/4 căn thắng', () => {
    // 100 căn × 25 m²: 625 vs 500
    expect(yeuCauDoXe(100, 2500, false, false).tong).toBeCloseTo(625);
  });
  it('NOXH lấy 60% nhưng vẫn ≥ 6 m² xe máy mỗi căn', () => {
    const y = yeuCauDoXe(200, 14000, true, false);
    expect(y.heSo).toBe(0.6);
    expect(y.tong).toBeCloseTo(1680);
    // căn rất nhỏ: 60% định mức < 6 m²/căn → phần xe máy quyết định
    expect(yeuCauDoXe(100, 1000, true, false).tong).toBeCloseTo(600);
  });
  it('gara cơ khí: 12 m²/100 m² DT sử dụng (+ xe máy)', () => {
    expect(yeuCauDoXe(200, 14000, false, true).tong).toBeCloseTo(1680 + 1200);
  });
});

describe('ranh hầm', () => {
  it('ranh hầm = ranh lô co vào khoảng lùi; ranh cố định thì giữ nguyên', () => {
    expect(dienTich(coVao(hcn(0, 0, 100, 80), 3))).toBeCloseTo(94 * 74, 0);
    expect(dienTich(ranhHam(lo(hcn(0, 0, 100, 80)), { ranh: null, lui: 0 }))).toBeCloseTo(8000, 0);
    const coDinh = hcn(5, 5, 50, 40);
    expect(ranhHam(lo(hcn(0, 0, 100, 80)), { ranh: coDinh, lui: 3 })).toBe(coDinh);
  });
});

describe('tinhHamSo: DTXD hầm + số chỗ đỗ (không bố trí mặt bằng)', () => {
  it('DTXD hầm = DT ranh × số tầng', () => {
    const p = pa({ lui: 0, soTang: 3 });
    const k = tinhHamSo(p, tv, p.lo[0])!;
    expect(k.dtSanTang).toBeCloseTo(8000, 0);
    expect(k.dtXdHam).toBeCloseTo(24000, 0);
    expect(k.soTang).toBe(3);
  });
  it('số chỗ theo hệ số = số căn × chỗ/căn của lô; theo QCVN tính từ DT yêu cầu', () => {
    const p = pa({ lui: 0 });
    const k = tinhHamSo(p, tv, p.lo[0])!;
    expect(k.soCan).toBe(200); // 20 tầng × 10 căn
    expect(k.theoHeSo).toMatchObject({ oto: 200, xeMay: 400, hsOto: 1, hsXeMay: 2 });
    expect(k.theoQcvn.dtTong).toBeCloseTo(yeuCauDoXe(200, k.dtsd, false, false).tong, 6);
    expect(k.theoQcvn.dtXeMay).toBeCloseTo(1200, 6);
    expect(k.theoQcvn.oto).toBe(Math.ceil((k.theoQcvn.dtTong - 1200) / 30));
  });
  it('khả năng theo DT sàn × tỷ lệ đỗ xe; đổi tỷ lệ thì đổi số chỗ', () => {
    const p = pa({ lui: 0, soTang: 2 });
    const a = tinhHamSo(p, tv, p.lo[0])!;
    const b = tinhHamSo({ ...p, phanHam: { doXe: 0.5, kyThuat: 0.1 } }, tv, p.lo[0])!;
    expect(a.khaNang.dtDoXe).toBeCloseTo(16000 * 0.75, 0);
    expect(b.khaNang.oto).toBeLessThan(a.khaNang.oto);
  });
  it('lô chưa có tòa: số chỗ yêu cầu = 0, không lỗi; ranh quá nhỏ → null', () => {
    const p = { ...pa({ lui: 0 }), toa: [] };
    const k = tinhHamSo(p, tv, p.lo[0])!;
    expect(k.soCan).toBe(0);
    expect(k.theoHeSo.oto).toBe(0);
    expect(tinhHamSo({ ...p, ham: { ...p.ham, lui: 60 } }, tv, p.lo[0])).toBeNull();
  });
});
