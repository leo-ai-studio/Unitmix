/**
 * Làm tròn DT căn khi tính dân + danh sách "Căn sát mốc" (chủ nhiệm 29/10/2026: "Diện tích căn mà lẻ lại tăng dân mà đúng ra không
 * tăng"). Mọi kỳ vọng tính tay từ bảng QĐ trong `quyTacDanSo.ts`.
 */
import { describe, expect, it } from 'vitest';
import { tinhChiTieu } from './chiTieu';
import { danSoLo, DUNG_SAI_MAC_DINH, lamTronKhai, mocDT, satMoc } from './danSo';
import {
  HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien,
  type CanMau, type ChiTieuQH, type KhaiDanSo, type Lo, type ToaDat, type ToaMau, type TrangThaiPA,
} from './kieu';
import { FALLBACK_QG, timQuyTac } from './quyTacDanSo';

const hn = timQuyTac('hn')!.phuongPhap!.cp;
const hcm = timQuyTac('hcm')!.phuongPhap!.cp;
const hcm83 = timQuyTac('hcm83')!.phuongPhap!.cp;
const dnCp = timQuyTac('dnai')!.phuongPhap!.cp;
const dnQh = timQuyTac('dnai')!.phuongPhap!.qh;

describe('mốc dải của từng phương pháp', () => {
  it('Hà Nội NOTM: 25 · 45 · 70 · 100 · 125; NOXH: 25 · 40 · 55 · 70 · 77', () => {
    expect(mocDT(hn, 'notm')).toEqual([25, 45, 70, 100, 125]);
    expect(mocDT(hn, 'noxh')).toEqual([25, 40, 55, 70, 77]);
  });
  it('Đồng Nai gộp mốc mọi cột số phòng ở; QĐ 83 mốc 45 / 160; S ÷ S_tb không có mốc', () => {
    expect(mocDT(dnCp, 'notm')).toEqual([25, 45, 70, 100, 125]);
    expect(mocDT(hcm83, 'notm')).toEqual([45, 160]);
    expect(mocDT(dnQh, 'notm')).toEqual([]);
    expect(mocDT(FALLBACK_QG, 'notm')).toEqual([]);
  });
});

describe('căn sát mốc — Hà Nội QĐ 34/2024 (mốc "≤", gợi ý đúng mốc)', () => {
  const ds = (dt: number, lh: 'notm' | 'noxh' = 'notm', tol = DUNG_SAI_MAC_DINH) => satMoc(dt, lh, hn, undefined, tol);
  it('70,18 m² (3 người) → 70,00 m² (2 người), giảm 1', () => {
    expect(ds(70.18)).toEqual({ moc: 70, dtGoiY: 70, nguoiHien: 3, nguoiGoiY: 2, giam: 1 });
  });
  it('45,3 → 45 (2 → 1) · 100,4 → 100 (4 → 3) · 125,2 → 125 (5 → 4)', () => {
    expect(ds(45.3)).toMatchObject({ dtGoiY: 45, nguoiHien: 2, nguoiGoiY: 1 });
    expect(ds(100.4)).toMatchObject({ dtGoiY: 100, nguoiHien: 4, nguoiGoiY: 3 });
    expect(ds(125.2)).toMatchObject({ dtGoiY: 125, nguoiHien: 5, nguoiGoiY: 4 });
  });
  it('đúng mốc / dưới mốc / quá dung sai → không gợi ý', () => {
    expect(ds(70)).toBeNull();
    expect(ds(69.99)).toBeNull();
    expect(ds(70.6)).toBeNull(); // 0,6 > 0,5
    expect(ds(70.25, 'notm', 0.2)).toBeNull();
    expect(ds(70.18, 'notm', 0.2)).toMatchObject({ dtGoiY: 70 });
    expect(ds(70.18, 'notm', 0)).toBeNull();
  });
  it('NOXH 55,3 → 55 (3 → 2) · 77,1 ngoài bảng (4) không giảm được', () => {
    expect(ds(55.3, 'noxh')).toMatchObject({ dtGoiY: 55, nguoiHien: 3, nguoiGoiY: 2 });
    expect(ds(77.1, 'noxh')).toBeNull();
  });
});

describe('căn sát mốc — TP.HCM (mốc "đến dưới" gợi ý mốc − 0,01)', () => {
  it('QĐ 32 NOXH 45,2 (2 người) → 44,99 (1,5 người); 32,3 (1,5) → 32 (1)', () => {
    expect(satMoc(45.2, 'noxh', hcm, undefined, 0.5)).toEqual({ moc: 45, dtGoiY: 44.99, nguoiHien: 2, nguoiGoiY: 1.5, giam: 0.5 });
    expect(satMoc(32.3, 'noxh', hcm, undefined, 0.5)).toMatchObject({ dtGoiY: 32, nguoiHien: 1.5, nguoiGoiY: 1 });
  });
  it('QĐ 32 NOTM 56,4 → không giảm (56 và 64 cùng 2 người); 64,3 (3) → 64 (2)', () => {
    expect(satMoc(56.4, 'notm', hcm, undefined, 0.5)).toBeNull();
    expect(satMoc(64.3, 'notm', hcm, undefined, 0.5)).toMatchObject({ dtGoiY: 64, nguoiHien: 3, nguoiGoiY: 2 });
  });
  it('QĐ 83/2026: 45,3 m² = 45,3 ÷ 32 = 1,415625 người → 45 m² = 1 người', () => {
    const r = satMoc(45.3, 'notm', hcm83, undefined, 0.5)!;
    expect(r.dtGoiY).toBe(45);
    expect(r.nguoiHien).toBeCloseTo(1.415625, 9);
    expect(r.giam).toBeCloseTo(0.415625, 9);
  });
});

describe('căn sát mốc — Đồng Nai QĐ 09/2025 (số phòng ở + DT, khoản 4)', () => {
  it('2PN 45,3 (cột 02 phòng: 2,5) → 45 ngoài cột 02 → khoản 4 cột 01: 1,5', () => {
    expect(satMoc(45.3, 'notm', dnCp, '2pn', 0.5)).toMatchObject({ moc: 45, dtGoiY: 45, nguoiHien: 2.5, nguoiGoiY: 1.5, giam: 1 });
  });
  it('2PN 70,4 (3) → 70 (2,5) · 3PN 100,2 (4) → 100 (3,5)', () => {
    expect(satMoc(70.4, 'notm', dnCp, '2pn', 0.5)).toMatchObject({ dtGoiY: 70, nguoiHien: 3, nguoiGoiY: 2.5 });
    expect(satMoc(100.2, 'notm', dnCp, '3pn', 0.5)).toMatchObject({ dtGoiY: 100, nguoiHien: 4, nguoiGoiY: 3.5 });
  });
  it('3PN 70,3 (cột 03: 3,5) → 70 ngoài cột 03 → khoản 4 cột gần nhất chứa 70 = 02 phòng: 2,5', () => {
    expect(satMoc(70.3, 'notm', dnCp, '3pn', 0.5)).toMatchObject({ dtGoiY: 70, nguoiHien: 3.5, nguoiGoiY: 2.5, giam: 1 });
  });
  it('giai đoạn quy hoạch S ÷ 31 (liên tục) → không có căn sát mốc', () => {
    expect(satMoc(70.18, 'notm', dnQh, '2pn', 0.5)).toBeNull();
  });
});

describe('tỉnh tính S ÷ 32 (mặc định quốc gia) — làm tròn không có tác dụng', () => {
  it('70,18 / 45,3 / 100,4 → null', () => {
    for (const dt of [70.18, 45.3, 100.4]) expect(satMoc(dt, 'notm', FALLBACK_QG, '2pn', 0.5)).toBeNull();
  });
});

// ---- cả lô: 10 tầng × (2 căn 2PN 70,18 m² + 1 căn 1PN 45,3 m² + 1 căn 3PN 101 m²) ----
const can = (id: string, loai: CanMau['loai'], dt: number): CanMau =>
  ({ id, ma_goc: id, nhom: 'tm', loai, vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 7000, ten_vi: id, ten_en: id, dt_tt_m2: dt, dt_tim_m2: dt + 4 });
const tvGia = taoThuVien([{
  id: 'm', ma_goc: 'm', nhom: 'tm', hinh: 'i', so: 9, ten_vi: '', ten_en: '', so_can_tang: 4, dtxd_m2: 400,
  hanh_lang_mm: 1800, sau_can_mm: 8500, duong_bao: [[0, 0], [20000, 0], [20000, 20000], [0, 20000]], co_cau: { c2: 2, c1: 1, c3: 1 }, loi: [],
} as ToaMau], [can('c2', '2pn', 70.18), can('c1', '1pn', 45.3), can('c3', '3pn', 101)]);
const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 5, tangCaoMax: 40, tangDe: null, tangCanHo: null, tangHam: null, danSoMax: 1000, soCanMax: null, nguoiMoiCan: 3.5, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo = (danSo?: KhaiDanSo): Lo => ({
  id: 'A', ranh: [[0, 0], [100, 0], [100, 100], [0, 100]], chiGioi: null, xungQuanh: [],
  temDat: { kyHieu: 'CC', chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 0, '1pn': 25, '2pn': 50, '2pnp': 0, '3pn': 25 }, ...(danSo ? { danSo } : {}) },
});
const toa = (id: string): ToaDat => ({ id, loId: 'A', mauId: 'm', x: 50, y: 50, gocDo: 0, soTangDH: 10, soTangDe: 0, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} });
const pa = (l: Lo, ts = [toa('T1')]): TrangThaiPA => ({
  phienBan: 1, lo: [l], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: ts,
  ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 },
});

describe('dân số lô có làm tròn', () => {
  it('chưa bật: dân theo DT thật (20×3 + 10×2 + 10×4 = 120), danh sách sát mốc 2 mẫu, giảm được 20 + 10 = 30', () => {
    const k = danSoLo(pa(lo({ tinh: 'hn', giaiDoan: 'cp' })), lo({ tinh: 'hn', giaiDoan: 'cp' }), tvGia);
    expect(k.tong).toBe(120);
    expect(k.satMoc.bat).toBe(false);
    expect(k.satMoc.dong.map((d) => d.canId).sort()).toEqual(['c1', 'c2']);
    expect(k.satMoc.giam).toBe(30);
    expect(k.dong.find((d) => d.canId === 'c2')!.theoToa).toEqual({ T1: 20 });
  });
  it('bật (0,5 m²): 20×2 + 10×1 + 10×4 = 90 = 120 − 30; chỉ tiêu lô cùng số', () => {
    const l = lo({ tinh: 'hn', giaiDoan: 'cp', lamTron: { bat: true, dungSai: 0.5 } });
    const k = danSoLo(pa(l), l, tvGia);
    expect(k.tong).toBe(90);
    expect(k.satMoc.bat).toBe(true);
    const c2 = k.dong.find((d) => d.canId === 'c2')!;
    expect(c2).toMatchObject({ nguoiMoiCan: 2, lamTron: true, dt: 70.18 });
    expect(c2.dieu).toMatch(/làm tròn DT 70.18 → 70 m²/);
    expect(tinhChiTieu(pa(l), tvGia).theoLo.A.dong.find((d) => d.khoa === 'danSo')!.dat).toBe(90);
  });
  it('dung sai 1,0: thêm 3PN 101 (4 → 3), 2 tòa: (20×2 + 10×1 + 10×3) × 2 = 160', () => {
    const l = lo({ tinh: 'hn', giaiDoan: 'cp', lamTron: { bat: true, dungSai: 1 } });
    const k = danSoLo(pa(l, [toa('T1'), toa('T2')]), l, tvGia);
    expect(k.tong).toBe(160);
    expect(k.satMoc.dong).toHaveLength(3);
    expect(k.dong.find((d) => d.canId === 'c3')!.theoToa).toEqual({ T1: 10, T2: 10 });
  });
  it('cách bình quân 3,6 người/căn, tỉnh S ÷ 32, PA chưa khai → không có căn sát mốc', () => {
    for (const k0 of [{ tinh: 'hn', giaiDoan: 'cp', cach: 'bq' } as KhaiDanSo, { tinh: 'khac', giaiDoan: 'cp' } as KhaiDanSo, undefined]) {
      const l = lo(k0 && { ...k0, lamTron: { bat: true, dungSai: 0.5 } });
      const k = danSoLo(pa(l), l, tvGia);
      expect(k.satMoc.dong).toHaveLength(0);
      expect(k.satMoc.giam).toBe(0);
    }
  });
  it('khai cũ (không có lamTron) = tắt, dung sai mặc định 0,5', () => {
    expect(lamTronKhai(lo({ tinh: 'hn', giaiDoan: 'cp' }))).toEqual({ bat: false, dungSai: 0.5 });
  });
});
