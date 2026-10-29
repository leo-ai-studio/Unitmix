import { describe, expect, it } from 'vitest';
import { batDiemRanh, coVao, diemTheoDoDai, dongKiem, dongRanhVe, khoiHam, hinhRam, kiemRam, kiemXeDien, raiHam, ranhHam, yeuCauDoXe } from './ham';
import { dienTich } from './hinhHoc';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Diem, type Lo, type ThongSoHam, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { chuanHoaPA, RAM_MAC_DINH, XE_DIEN_MAC_DINH } from './macDinh';
import { raiChoDo } from './raiCho';

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

describe('ram (QCVN 13:2018 2.2.1.28)', () => {
  it('ram thẳng có mái: 3,3 m / 22 m = 15% ≤ 18% đạt; 3,3 / 15 = 22% vượt', () => {
    const d = kiemRam({ ...RAM_MAC_DINH, dai: 22, doanChuyen: 0 }, 3.3).find((k) => k.khoa === 'ramDoc')!;
    expect(d.dat).toBeCloseTo(15);
    expect(d.mucTieu).toBe(18);
    expect(d.muc).toBe('ok');
    expect(kiemRam({ ...RAM_MAC_DINH, dai: 15 }, 3.3).find((k) => k.khoa === 'ramDoc')!.muc).toBe('vuot');
  });
  it('ram cong ≤ 13%, ram hở ≤ 10%', () => {
    expect(kiemRam({ ...RAM_MAC_DINH, loai: 'cong', dai: 22, doanChuyen: 0 }, 3.3)[0].muc).toBe('vuot');
    expect(kiemRam({ ...RAM_MAC_DINH, loai: 'ho', dai: 33, doanChuyen: 0 }, 3.3)[0].dat).toBeCloseTo(10);
    expect(kiemRam({ ...RAM_MAC_DINH, loai: 'ho', dai: 30, doanChuyen: 0 }, 3.3)[0].muc).toBe('vuot');
  });
  it('đoạn chuyển dốc: dốc chính = cao / (dài − c); đổi dốc ở hai đầu = nửa dốc ≤ 12,5% (dự thảo QCVN 07-11 2.4.3.8.3)', () => {
    // 3,3 / (24 − 3,6) = 16,18%; đổi dốc 8,09% ≤ 12,5%
    const k = kiemRam({ ...RAM_MAC_DINH, dai: 24, doanChuyen: 3.6 }, 3.3);
    expect(k.find((x) => x.khoa === 'ramDoc')!.dat).toBeCloseTo(16.176, 2);
    expect(k.find((x) => x.khoa === 'ramDoiDoc')!.dat).toBeCloseTo(8.088, 2);
    expect(k.find((x) => x.khoa === 'ramDoiDoc')!.duThao).toBe(true);
    // không có đoạn chuyển: đổi dốc = cả dốc 15% > 12,5% → cảnh báo (dự thảo)
    expect(kiemRam({ ...RAM_MAC_DINH, dai: 22, doanChuyen: 0 }, 3.3).find((x) => x.khoa === 'ramDoiDoc')!.muc).toBe('canh_bao');
    // ram cong: bán kính ≥ 6 m (dự thảo 2.4.7.4.3)
    expect(kiemRam({ ...RAM_MAC_DINH, loai: 'cong', banKinh: 5 }, 3.3).find((x) => x.khoa === 'ramBanKinh')!.muc).toBe('canh_bao');
  });
  it('dốc ngang ≤ 6%; có người đi bộ thì vỉa hè ≥ 0,8 m', () => {
    expect(kiemRam({ ...RAM_MAC_DINH, docNgang: 7 }, 3.3).find((k) => k.khoa === 'ramNgang')!.muc).toBe('vuot');
    expect(kiemRam(RAM_MAC_DINH, 3.3).some((k) => k.khoa === 'ramViaHe')).toBe(false);
    expect(kiemRam({ ...RAM_MAC_DINH, coNguoiDi: true, viaHe: 0.6 }, 3.3).find((k) => k.khoa === 'ramViaHe')!.muc).toBe('vuot');
    expect(kiemRam({ ...RAM_MAC_DINH, coNguoiDi: true, viaHe: 1 }, 3.3).find((k) => k.khoa === 'ramViaHe')!.muc).toBe('ok');
  });
  it('ram tự đặt nằm trong ranh, dọc cạnh dài nhất', () => {
    const r = hinhRam(hcn(0, 0, 100, 80), RAM_MAC_DINH)!;
    expect(r.gocDo).toBe(0);
    for (const [x, y] of r.poly) {
      expect(x).toBeGreaterThanOrEqual(-1e-6);
      expect(y).toBeGreaterThanOrEqual(-1e-6);
      expect(y).toBeLessThanOrEqual(80);
    }
  });
});

describe('khu xe điện (dự thảo SĐ 01:2026) — chỉ cảnh báo', () => {
  const xd = { ...XE_DIEN_MAC_DINH, bat: true, choOto: 40, choXeMay: 60 };
  it('phân vùng ô tô ≤ 25 chỗ, xe máy ≤ 50 chỗ: vượt thì cảnh báo, không chặn', () => {
    const k = kiemXeDien({ ...xd, vungOto: 30, vungXeMay: 60 }, 500);
    const vo = k.find((x) => x.khoa === 'xdVungOto')!;
    expect(vo.dat).toBe(30);
    expect(vo.muc).toBe('canh_bao');
    expect(vo.duThao).toBe(true);
    expect(k.find((x) => x.khoa === 'xdVungXeMay')!.muc).toBe('canh_bao');
    expect(kiemXeDien(xd, 500).find((x) => x.khoa === 'xdVungOto')!.muc).toBe('ok');
  });
  it('khoang cháy khu sạc ô tô ≤ 1 200 m², xe máy ≤ 300 m²', () => {
    expect(kiemXeDien(xd, 1300).find((x) => x.khoa === 'xdKhoangOto')!.muc).toBe('canh_bao');
    // 60 chỗ × 2,5 m² = 150 m² ≤ 300
    expect(kiemXeDien(xd, 900).find((x) => x.khoa === 'xdKhoangXeMay')!.muc).toBe('ok');
    expect(kiemXeDien({ ...xd, choXeMay: 150 }, 900).find((x) => x.khoa === 'xdKhoangXeMay')!.muc).toBe('canh_bao');
  });
  it('khoảng cách giữa các khu ≥ 2 m hoặc có tường ngăn; tủ đổi pin chỉ tới hầm 1', () => {
    expect(kiemXeDien({ ...xd, khoangCach: 1 }, 0).find((x) => x.khoa === 'xdKhoangCach')!.muc).toBe('canh_bao');
    expect(kiemXeDien({ ...xd, khoangCach: 1, tuongNgan: true }, 0).find((x) => x.khoa === 'xdKhoangCach')!.muc).toBe('ok');
    expect(kiemXeDien({ ...xd, tuDoiPinTang: 2 }, 0).find((x) => x.khoa === 'xdDoiPin')!.muc).toBe('canh_bao');
    expect(kiemXeDien({ ...xd, tuDoiPinTang: 1 }, 0).find((x) => x.khoa === 'xdDoiPin')!.muc).toBe('ok');
  });
});

describe('ranh hầm, rải tầng', () => {
  it('ranh hầm = ranh lô co vào khoảng lùi', () => {
    expect(dienTich(coVao(hcn(0, 0, 100, 80), 3))).toBeCloseTo(94 * 74, 0);
    expect(dienTich(ranhHam(lo(hcn(0, 0, 100, 80)), { ranh: null, lui: 0 }))).toBeCloseTo(8000, 0);
    const coDinh = hcn(10, 10, 20, 20);
    expect(ranhHam(lo(hcn(0, 0, 100, 80)), { ranh: coDinh, lui: 3 })).toBe(coDinh);
  });
  it('rải đủ tầng; xe máy chỉ ở tầng đã chọn và đủ 6 m²/căn; tỷ lệ đỗ xe + kỹ thuật ≤ 1', () => {
    const kq = raiHam(pa({ lui: 3, khoMoiTang: 10 }), tv, lo(hcn(0, 0, 100, 80)))!;
    expect(kq.tang.length).toBe(2);
    expect(kq.soCan).toBe(200);
    expect(kq.dtsd).toBeCloseTo(14000);
    expect(kq.tang[0].dtXeMay).toBeGreaterThan(0);
    expect(kq.tang[1].dtXeMay).toBe(0);
    expect(kq.tong.dtXeMay).toBeGreaterThan(1200 * 0.85); // trừ phần cột / lõi rơi vào dải
    expect(kq.tang[0].soKho).toBe(10);
    expect(kq.tang[0].soCho).toBeGreaterThan(50);
    // xe lăn: QCVN 10:2024 Bảng 1 trên tổng chỗ, ưu tiên tầng trên (B1)
    expect(kq.tong.soXeLan).toBe(kq.yeuCauCho.xeLan);
    expect(kq.tang[0].soXeLan).toBe(Math.min(kq.yeuCauCho.xeLan, kq.tang[0].soXeLan + kq.tang[1].soXeLan));
    expect(kq.tyLe.doXe).toBeGreaterThan(0.5);
    expect(kq.tyLe.doXe + kq.tyLe.kyThuat).toBeLessThanOrEqual(1);
    const dong = kq.kiem.find((k) => k.khoa === 'dtDoXe')!;
    expect(dong.mucTieu).toBeCloseTo(2800);
  });
  it('PA cũ thiếu trường hầm mới vẫn chuẩn hoá và rải được', () => {
    const cu = pa();
    const moi = chuanHoaPA(cu);
    expect(moi.ham.lui).toBe(3);
    expect(moi.ham.ram?.loai).toBe('thang_mai');
    expect(raiHam(cu, tv, cu.lo[0])).not.toBeNull();
  });
  it('chỗ xe lăn gộp ô liền nhau đủ 3,5 m, không chồng chỗ thường', () => {
    const r = raiChoDo(hcn(0, 0, 60, 40), [], ham, { soXeLan: 3 });
    expect(r.xeLan.length).toBe(3);
    expect(r.soCho).toBe(r.cho.length + 3);
    for (const p of r.xeLan) {
      const w = Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]);
      expect(w).toBeGreaterThanOrEqual(3.5);
    }
  });
  it('dongKiem: sát ngưỡng 3% thì cảnh báo', () => {
    expect(dongKiem('x', 101, 100, '>=', { canCu: '' }).muc).toBe('canh_bao');
    expect(dongKiem('x', 90, 100, '>=', { canCu: '' }).muc).toBe('vuot');
    expect(dongKiem('x', 90, 100, '>=', { canCu: '', duThao: true }).muc).toBe('canh_bao');
  });
});

describe('vẽ tay ranh hầm', () => {
  it('bắt điểm trong bán kính, chọn điểm gần nhất', () => {
    const ds: Diem[] = [[0, 0], [10, 0], [10.4, 0.2]];
    expect(batDiemRanh([10.3, 0.1], ds, 1)).toEqual([10.4, 0.2]);
    expect(batDiemRanh([5, 5], ds, 1)).toBeNull();
  });
  it('điểm theo độ dài cạnh', () => {
    expect(diemTheoDoDai([0, 0], [3, 4], 10)).toEqual([6, 8]);
    expect(diemTheoDoDai([1, 1], [1, 1], 5)).toBeNull();
    expect(diemTheoDoDai([0, 0], [1, 0], 0)).toBeNull();
  });
  it('đóng đa giác: bỏ đỉnh trùng, đưa về ngược chiều kim đồng hồ', () => {
    const cw: Diem[] = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]];
    const r = dongRanhVe(cw)!;
    expect(r).toHaveLength(4);
    expect(dienTich(r)).toBeCloseTo(100);
    expect(r[0]).toEqual([10, 0]);
  });
  it('từ chối < 3 đỉnh, diện tích quá nhỏ và đa giác tự cắt', () => {
    expect(dongRanhVe([[0, 0], [5, 0]])).toBeNull();
    expect(dongRanhVe([[0, 0], [0.5, 0], [0.5, 0.5]])).toBeNull();
    expect(dongRanhVe([[0, 0], [10, 10], [10, 0], [0, 10]])).toBeNull();
  });
  it('khối hầm: cốt đáy và cốt sàn các tầng', () => {
    const k = khoiHam(hcn(0, 0, 10, 10), 3, 3.3)!;
    expect(k.yDuoi).toBeCloseTo(-9.9);
    expect(k.yTang).toHaveLength(4);
    expect(k.yTang[0]).toBeCloseTo(0);
    expect(khoiHam([[0, 0], [1, 1]], 2, 3)).toBeNull();
    expect(khoiHam(hcn(0, 0, 10, 10), 0, 3)).toBeNull();
  });
});
