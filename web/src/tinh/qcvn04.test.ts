import { describe, expect, it } from 'vitest';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau, type Phong } from './kieu';
import { kiemCuaCuuNan, kiemDtCanToiThieu, kiemNhanVien, kiemPhongNgu9, kiemPhongNguSang, kiemQCVN04, kiemThangBangCa, kiemThongThuy, kiemTyLeCanNho } from './qcvn04';

const can = (id: string, dt: number, kh: Partial<CanMau> = {}): CanMau => ({
  id, ma_goc: id, nhom: 'tm', loai: '2pn', vi_tri: 'giua', vi_tri_ma: 'm', sau_mm: 8000, rong_mm: 6000, ten_vi: id, ten_en: id, dt_tt_m2: dt, dt_tim_m2: dt + 5, ...kh,
});
const cs = (...x: [CanMau, number?][]) => x.map(([c, n]) => ({ can: c, n: n ?? 1 }));
const toa: ToaDat = { id: 'T', loId: 'L', mauId: 'M', x: 0, y: 0, gocDo: 0, soTangDH: 10, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} };

// Phòng giả: thêm ranh / Ø để khớp kiểu Phong; thiếu ke_mat_ngoai = dữ liệu cũ chưa biết.
const ph = (o: Pick<Phong, 'ten' | 'loai' | 'dt_m2'> & Partial<Phong>): Phong => ({ ranh: [], d_min_m: 3, ...o }) as Phong;

describe('DT căn tối thiểu / tỷ lệ căn nhỏ', () => {
  it('căn < 25 m² là vượt', () => {
    expect(kiemDtCanToiThieu(cs([can('a', 30)], [can('b', 24.9)])).trangThai).toBe('vuot');
    expect(kiemDtCanToiThieu(cs([can('a', 25)])).trangThai).toBe('dat');
  });
  it('tỷ lệ căn ≤ 45 m² chỉ xét NOTM, vượt 25 % là cảnh báo', () => {
    expect(kiemTyLeCanNho(cs([can('a', 40), 3], [can('b', 60), 7]), 'tm').trangThai).toBe('canh_bao');
    expect(kiemTyLeCanNho(cs([can('a', 40), 2], [can('b', 60), 8]), 'tm').trangThai).toBe('dat');
    expect(kiemTyLeCanNho(cs([can('a', 40), 9]), 'xh').trangThai).toBe('bo_qua');
  });
});

describe('phòng ngủ ≥ 9 m²', () => {
  it('thiếu dữ liệu phòng: chưa đủ dữ liệu, không phải đạt', () => {
    expect(kiemPhongNgu9(cs([can('a', 50)])).trangThai).toBe('chua_du_du_lieu');
  });
  it('phòng ngủ 8,5 m² là vượt; đủ cả thì đạt', () => {
    const sai = can('a', 50, { phong: [ph({ ten: 'PN2', loai: 'ngu', dt_m2: 8.5 }), ph({ ten: 'PK', loai: 'khach', dt_m2: 5 })] });
    const dung = can('b', 50, { phong: [ph({ ten: 'PN', loai: 'ngu', dt_m2: 9 })] });
    expect(kiemPhongNgu9(cs([sai], [dung])).trangThai).toBe('vuot');
    expect(kiemPhongNgu9(cs([dung])).trangThai).toBe('dat');
  });
  it('một số căn thiếu phòng thì không được đạt', () => {
    const dung = can('b', 50, { phong: [ph({ ten: 'PN', loai: 'ngu', dt_m2: 12 })] });
    expect(kiemPhongNgu9(cs([dung], [can('c', 40)])).trangThai).toBe('chua_du_du_lieu');
  });
});

describe('phòng ngủ thông thoáng, chiếu sáng', () => {
  it('thiếu ke_mat_ngoai thì chưa đủ dữ liệu', () => {
    const c = can('a', 50, { phong: [ph({ ten: 'PN', loai: 'ngu', dt_m2: 12 })] });
    expect(kiemPhongNguSang(cs([c])).trangThai).toBe('chua_du_du_lieu');
  });
  it('false là vượt, true hết là đạt', () => {
    const k = can('a', 50, { phong: [ph({ ten: 'PN', loai: 'ngu', dt_m2: 12, ke_mat_ngoai: false })] });
    const d = can('b', 50, { phong: [ph({ ten: 'PN', loai: 'ngu', dt_m2: 12, ke_mat_ngoai: true })] });
    expect(kiemPhongNguSang(cs([k], [d])).trangThai).toBe('vuot');
    expect(kiemPhongNguSang(cs([d])).trangThai).toBe('dat');
  });
});

describe('thông thủy', () => {
  it('3,3 − 0,3 = 3,0 ≥ 2,6 đạt; đế 4,5 đạt', () => {
    const r = kiemThongThuy(toa, 0.3);
    expect(r.trangThai).toBe('dat');
    expect(r.tham.dh).toBe(3);
  });
  it('tầng căn hộ 2,8 − 0,3 = 2,5 < 2,6 vượt', () => {
    expect(kiemThongThuy({ ...toa, caoDH: 2.8 }, 0.3).trangThai).toBe('vuot');
  });
  it('đế thấp: < 2,6 cảnh báo, < 2,0 vượt', () => {
    expect(kiemThongThuy({ ...toa, caoDe: 2.8 }, 0.3).trangThai).toBe('canh_bao');
    expect(kiemThongThuy({ ...toa, caoDe: 2.2 }, 0.3).trangThai).toBe('vuot');
  });
  it('không có tầng đế thì không xét đế', () => {
    expect(kiemThongThuy({ ...toa, soTangDe: 0, caoDe: 1 }, 0.3).trangThai).toBe('dat');
  });
});

describe('cửa cứu nạn', () => {
  it('căn có lô gia thì đạt', () => {
    expect(kiemCuaCuuNan(cs([can('a', 50, { logia_lui: [[0.1, 0.4, 0.8]] })])).trangThai).toBe('dat');
  });
  it('căn không lô gia, chưa biết cửa: cảnh báo; khai có cửa: đạt; khai không: vượt', () => {
    expect(kiemCuaCuuNan(cs([can('a', 50)])).trangThai).toBe('canh_bao');
    expect(kiemCuaCuuNan(cs([can('a', 50, { cua_cuu_nan: true })])).trangThai).toBe('dat');
    expect(kiemCuaCuuNan(cs([can('a', 50, { cua_cuu_nan: false })])).trangThai).toBe('vuot');
  });
});

describe('thang băng ca, nhân viên', () => {
  it('chưa khai thang băng ca: cảnh báo', () => {
    expect(kiemThangBangCa({}).trangThai).toBe('canh_bao');
    expect(kiemThangBangCa({ thangBangCa: true }).trangThai).toBe('dat');
    expect(kiemThangBangCa({ thangBangCa: false }).trangThai).toBe('vuot');
  });
  it('nhân viên: chưa khai bỏ qua; 4 m²/người vượt; 5 đạt', () => {
    expect(kiemNhanVien({}).trangThai).toBe('bo_qua');
    expect(kiemNhanVien({ nhanVien: { so: 0, dtM2: 10 } }).trangThai).toBe('bo_qua');
    expect(kiemNhanVien({ nhanVien: { so: 5, dtM2: 20 } }).trangThai).toBe('vuot');
    expect(kiemNhanVien({ nhanVien: { so: 5, dtM2: 25 } }).trangThai).toBe('dat');
  });
});

describe('kiemQCVN04 một tòa', () => {
  it('trả đủ 8 kết quả theo thứ tự, mọi kết quả có căn cứ', () => {
    const mau = { id: 'M', nhom: 'tm', co_cau: { a: 6, b: 4 }, so_can_tang: 10 } as unknown as ToaMau;
    const tv = taoThuVien([mau], [can('a', 60), can('b', 70)]);
    const r = kiemQCVN04({}, toa, mau, tv);
    expect(r.map((x) => x.id)).toEqual(['qcvn04_min_area', 'qcvn04_small_ratio', 'qcvn04_phong_ngu_9', 'qcvn04_phong_ngu_sang', 'qcvn04_thong_thuy', 'qcvn04_cua_cuu_nan', 'qcvn04_thang_bang_ca', 'qcvn04_nhan_vien']);
    expect(r.every((x) => x.canCu.startsWith('QCVN 04:2021/BXD'))).toBe(true);
    expect(r[2].trangThai).toBe('chua_du_du_lieu');
    expect(r[7].trangThai).toBe('bo_qua');
  });
});
