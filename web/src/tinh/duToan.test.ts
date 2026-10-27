import { describe, expect, it } from 'vitest';
import { CAN_MOI_THANG, chuVi, DONG_DU_TOAN, soThangTheoCan, tinhDuToan, tinhKhoiLuong, tyLeQldaTT38 } from './duToan';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Diem, type Lo, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { CHI_PHI_MAC_DINH, chuanHoaChiPhi, chuanHoaPA } from './macDinh';

// Thư viện giả: tòa 20 × 20 m, mỗi tầng 2 căn 2PN + 1 căn 1PN (như chiTieu.test.ts).
const canGia: CanMau[] = [
  { id: 'tm-2pn-m1', ma_goc: 'a', nhom: 'tm', loai: '2pn', vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 7500, ten_vi: '', ten_en: '', dt_tt_m2: 60, dt_tim_m2: 64 },
  { id: 'tm-1pn-m1', ma_goc: 'b', nhom: 'tm', loai: '1pn', vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 5800, ten_vi: '', ten_en: '', dt_tt_m2: 40, dt_tim_m2: 44 },
];
const toaGia: ToaMau = {
  id: 'tm-i9', ma_goc: 'x', nhom: 'tm', hinh: 'i', so: 9, ten_vi: '', ten_en: '', so_can_tang: 3, dtxd_m2: 400,
  hanh_lang_mm: 1800, sau_can_mm: 8500, duong_bao: [[0, 0], [20000, 0], [20000, 20000], [0, 20000]],
  co_cau: { 'tm-2pn-m1': 2, 'tm-1pn-m1': 1 }, loi: [],
};
const tvGia = taoThuVien([toaGia], canGia);
const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 3.5, tangCaoMax: 25, tangDe: null, tangCanHo: null, tangHam: null, danSoMax: 1600, soCanMax: null, nguoiMoiCan: 3.5, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const ranh: Diem[] = [[0, 0], [100, 0], [100, 50], [0, 50]];
const lo: Lo = { id: 'A', ranh, chiGioi: null, xungQuanh: [], temDat: { kyHieu: 'CC-01', chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 0, '1pn': 34, '2pn': 66, '2pnp': 0, '3pn': 0 } } };
const toa = (o: Partial<ToaDat> = {}): ToaDat => ({
  id: 't1', loId: 'A', mauId: 'tm-i9', x: 50, y: 25, gocDo: 0, soTangDH: 10, soTangDe: 2, caoDe: 4.5, caoDH: 3.3, coApMai: true, deOffset: 0, canTheo: {}, ...o,
});
const paGia = (ts: ToaDat[], soTangHam = 0): TrangThaiPA => chuanHoaPA({
  phienBan: 1, lo: [lo], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: ts,
  ham: { soTang: soTangHam, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 },
});

describe('khối lượng từ mô hình', () => {
  it('chu vi hình chữ nhật', () => expect(chuVi([[0, 0], [10, 0], [10, 4], [0, 4]])).toBeCloseTo(28));

  it('tháp, đế, áp mái, căn, mặt ngoài, sân', () => {
    const kl = tinhKhoiLuong(paGia([toa()]), tvGia, false);
    const l = kl.lo[0], t = l.toa[0];
    expect(t.dtSanDH).toBeCloseTo(400);
    expect(t.dtThap).toBeCloseTo(4000);
    expect(t.dtDe).toBeCloseTo(800); // 2 tầng đế × 400 m² chân (đế bằng chân tháp)
    expect(t.dtApMai).toBeCloseTo(400);
    expect(t.soCan).toEqual({ stu: 0, '1pn': 10, '2pn': 20, '2pnp': 0, '3pn': 0 });
    expect(t.dtTT).toBeCloseTo(10 * (2 * 60 + 40));
    expect(t.dtMatNgoai).toBeCloseTo(80 * 3.3 * 11);
    expect(l.dtMatNgoaiDe).toBeCloseTo(80 * 9);
    expect(l.dtSan).toBeCloseTo(5000 - 400);
    expect(kl.tong.dtSanVuon).toBeCloseTo(4600);
    expect(kl.tong.dtTrenCot0).toBeCloseTo(5200);
    expect(l.nguonHam).toBe('khong');
    expect(t.soThang).toBe(1);
  });

  it('thang máy theo QCVN 04 2.4.2: 1 thang / 70 căn', () => {
    expect(soThangTheoCan(0)).toBe(0);
    expect(soThangTheoCan(CAN_MOI_THANG)).toBe(1);
    expect(soThangTheoCan(CAN_MOI_THANG + 1)).toBe(2);
    expect(tinhKhoiLuong(paGia([toa({ soTangDH: 30 })]), tvGia, false).tong.soThang).toBe(2); // 90 căn
  });

  it('hầm chưa rải thì ước theo DT lô', () => {
    const kl = tinhKhoiLuong(paGia([toa()], 2), tvGia, false);
    const l = kl.lo[0];
    expect(l.nguonHam).toBe('uoc');
    expect(l.dtHam).toBeCloseTo(2 * 5000);
    expect(l.dtXeMay).toBe(6 * 30);
    expect(l.soChoOto).toBeGreaterThan(0);
  });

  it('hầm rải được thì lấy số chỗ từ raiHam', () => {
    const kl = tinhKhoiLuong(paGia([toa()], 1), tvGia, true);
    expect(kl.lo[0].nguonHam).toBe('rai');
    expect(kl.tong.soChoOto).toBeGreaterThan(0);
    expect(kl.tong.dtHam).toBeGreaterThan(0);
  });

  it('PA rỗng: mọi số là 0, không NaN', () => {
    const kl = tinhKhoiLuong(paGia([]), tvGia);
    for (const v of Object.values(kl.tong)) if (typeof v === 'number') expect(v).toBe(0);
    const dt = tinhDuToan(kl);
    expect(dt.tongMuc).toBe(0);
    expect(dt.suatM2).toBeNull();
    expect(dt.suatCan).toBeNull();
  });
});

describe('dự toán', () => {
  const kl = tinhKhoiLuong(paGia([toa()]), tvGia, false);

  it('thành tiền = KL × đơn giá; tổng mức cộng đủ các lớp', () => {
    const dt = tinhDuToan(kl);
    expect(dt.dong).toHaveLength(DONG_DU_TOAN.length);
    const kc = dt.dong.find((d) => d.khoa === 'ketCau')!;
    expect(kc.thanhTien).toBeCloseTo(kl.tong.dtTrenCot0 * CHI_PHI_MAC_DINH.donGia.ketCau);
    const coSo = dt.xd + dt.tb;
    const tl = CHI_PHI_MAC_DINH.tyLe;
    expect(dt.tlQlda).toBeCloseTo(tyLeQldaTT38(coSo / 1e9, dt.tb / coSo));
    const truoc = coSo * (1 + (dt.tlQlda + tl.tuVan + tl.khac) / 100);
    expect(dt.truocDuPhong).toBeCloseTo(truoc);
    expect(dt.tongMuc).toBeCloseTo(truoc * (1 + (tl.duPhongKL + tl.duPhongTruotGia) / 100));
    expect(dt.suatM2).toBeCloseTo(dt.tongMuc / kl.tong.dtSanTong);
    expect(dt.suatCan).toBeCloseTo(dt.tongMuc / 30);
  });

  it('QLDA theo TT 38/2026 Bảng 1.1: nội suy, mốc biên, ×0,8 khi thiết bị ≥ 50 %; tắt thì dùng % nhập tay', () => {
    expect(tyLeQldaTT38(5)).toBeCloseTo(3.446);
    expect(tyLeQldaTT38(10)).toBeCloseTo(3.446);
    expect(tyLeQldaTT38(15)).toBeCloseTo((3.446 + 2.923) / 2);
    expect(tyLeQldaTT38(1000)).toBeCloseTo(1.239);
    expect(tyLeQldaTT38(40000)).toBeCloseTo(0.305);
    expect(tyLeQldaTT38(1000, 0.6)).toBeCloseTo(1.239 * 0.8);
    const tay = tinhDuToan(kl, { ...CHI_PHI_MAC_DINH, qldaTT38: false });
    expect(tay.tlQlda).toBe(CHI_PHI_MAC_DINH.tyLe.qlda);
    expect(tay.qlda).toBeCloseTo(((tay.xd + tay.tb) * CHI_PHI_MAC_DINH.tyLe.qlda) / 100);
  });

  it('% điều chỉnh giá nhóm và dòng Khác', () => {
    const goc = tinhDuToan(kl);
    const cp = chuanHoaChiPhi({ ...CHI_PHI_MAC_DINH, dieuChinh: { xd: 10, tb: 0 }, khac: { xd: 1e9, tb: 0 } });
    const moi = tinhDuToan(kl, cp);
    expect(moi.nhom.xd.congDong).toBeCloseTo(goc.nhom.xd.congDong * 1.1);
    expect(moi.xd).toBeCloseTo(goc.nhom.xd.congDong * 1.1 + 1e9);
    expect(moi.tb).toBeCloseTo(goc.tb);
  });

  it('chuẩn hoá: PA cũ thiếu chi phí lấy mặc định; điều chỉnh kẹp −75…+200; số hỏng bỏ', () => {
    expect(chuanHoaChiPhi(undefined)).toEqual(CHI_PHI_MAC_DINH);
    const cp = chuanHoaChiPhi({ dieuChinh: { xd: 500, tb: -90 }, donGia: { ngam: 'x', ketCau: 1, me: 5 }, ban: { can: { '2pn': 1 } } });
    expect(cp.dieuChinh).toEqual({ xd: 200, tb: -75 });
    expect(cp.donGia.ngam).toBe(CHI_PHI_MAC_DINH.donGia.ngam);
    expect(cp.donGia.me).toBe(5);
    // Đơn giá kiểu cũ (dòng tháp / đế, chưa có 'ketCau') bỏ hẳn, lấy định mức app cũ.
    expect(chuanHoaChiPhi({ donGia: { ngam: 11e6, thanThap: 6.5e6, me: 1.2e6 } }).donGia).toEqual(CHI_PHI_MAC_DINH.donGia);
    expect(cp.ban.can['2pn']).toBe(1);
    expect(cp.ban.can['3pn']).toBe(CHI_PHI_MAC_DINH.ban.can['3pn']);
    expect(paGia([]).chiPhi).toEqual(CHI_PHI_MAC_DINH);
  });
});
