import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tinhChiTieu } from './chiTieu';
import { diemLechCoCau, demCan, doiMauCungBeNgang } from './coCau';
import { chanToa, dienTich, dtVung, hopDienTich, khoiDe, soKhoi } from './hinhHoc';
import {
  HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien,
  type CanMau, type Diem, type Lo, type ToaDat, type ToaMau, type TrangThaiPA,
} from './kieu';

const vuong = (x: number, y: number, a: number): Diem[] => [[x, y], [x + a, y], [x + a, y + a], [x, y + a]];
const hcn = (w: number, h: number): Diem[] => [[0, 0], [w, 0], [w, h], [0, h]];

// Thư viện giả: 1 tòa 20 m x 20 m (mm), mỗi tầng 2 căn 2PN + 1 căn 1PN.
const canGia: CanMau[] = [
  { id: 'tm-2pn-m1', ma_goc: 'a', nhom: 'tm', loai: '2pn', vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 7500, ten_vi: '', ten_en: '', dt_tt_m2: 55.88, dt_tim_m2: 59.51 },
  { id: 'tm-1pn-m1', ma_goc: 'b', nhom: 'tm', loai: '1pn', vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 5800, ten_vi: '', ten_en: '', dt_tt_m2: 41, dt_tim_m2: 44 },
];
const toaGia: ToaMau = {
  id: 'tm-i9', ma_goc: 'x', nhom: 'tm', hinh: 'i', so: 9, ten_vi: '', ten_en: '', so_can_tang: 3, dtxd_m2: 400,
  hanh_lang_mm: 1800, sau_can_mm: 8500, duong_bao: [[1000, 1000], [21000, 1000], [21000, 21000], [1000, 21000]],
  co_cau: { 'tm-2pn-m1': 2, 'tm-1pn-m1': 1 }, loi: [],
};
const tvGia = taoThuVien([toaGia], canGia);

const chiTieu = { matDoMax: 40, hssddMax: 3.5, tangCaoMax: 25, danSoMax: 1600, nguoiMoiCan: 3.5, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo = (ranh: Diem[]): Lo => ({
  id: 'A', ranh, chiGioi: null, xungQuanh: [],
  temDat: { kyHieu: 'CC-02', chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 5, '1pn': 20, '2pn': 45, '2pnp': 15, '3pn': 15 } },
});
const toa = (id: string, x: number, y: number, soTangDH: number, deOffset = 0): ToaDat => ({
  id, loId: 'A', mauId: 'tm-i9', x, y, gocDo: 0, soTangDH, soTangDe: 0, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset, canTheo: {},
});
const pa = (l: Lo, ts: ToaDat[]): TrangThaiPA => ({
  phienBan: 1, lo: [l], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: ts,
  ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 },
});

describe('hình học', () => {
  it('diện tích đa giác', () => expect(dienTich(hcn(10, 4))).toBeCloseTo(40));
  it('hợp hai hình chồng nửa không cộng trùng', () => {
    expect(hopDienTich([vuong(0, 0, 10), vuong(5, 0, 10)])).toBeCloseTo(150);
  });
  it('đế: hai tòa cách 4 m gộp liền một khối, không để khe', () => {
    const de = khoiDe([vuong(0, 0, 20), vuong(24, 0, 20)], [0, 0], 6);
    expect(soKhoi(de)).toBe(1);
    expect(dtVung(de)).toBeCloseTo(880, 0);
  });
  it('đế: tòa đơn offset 0 giữ đúng diện tích chân tháp', () => {
    expect(dtVung(khoiDe([vuong(0, 0, 20)], [0], 6))).toBeCloseTo(400, 0);
  });
  it('đế: hai tòa cách 20 m vẫn là hai khối', () => {
    expect(soKhoi(khoiDe([vuong(0, 0, 20), vuong(40, 0, 20)], [0, 0], 6))).toBe(2);
  });
});

describe('chỉ tiêu lô', () => {
  it('458 căn x 3,5 người = 1.603 người, vượt dân số tối đa 3 người', () => {
    // 152 tầng x 3 căn = 456; thêm 1 tòa 1 tầng (3 căn) -> 459; dùng 2 tòa: 76 + 76 tầng = 456 căn, + canTheo không đổi số
    const t1 = toa('T1', 30, 30, 100);
    const t2 = toa('T2', 80, 30, 52);
    const lo1 = lo(hcn(124, 100));
    const kq = tinhChiTieu(pa(lo1, [t1, t2]), tvGia);
    expect(kq.tong.soCan).toBe(456);
    const kq2 = tinhChiTieu(pa(lo1, [t1, { ...t2, soTangDH: 52 }, { ...toa('T3', 30, 70, 1) }]), tvGia);
    expect(kq2.tong.soCan).toBe(459);
    const ds = kq2.theoLo.A.dong.find((d) => d.khoa === 'danSo')!;
    expect(ds.dat).toBeCloseTo(1606.5);
    expect(ds.muc).toBe('vuot');
    expect(ds.chenh).toBeCloseTo(6.5);
  });
  it('mật độ = DT đế hợp / DT lô', () => {
    const kq = tinhChiTieu(pa(lo(hcn(100, 100)), [toa('T1', 20, 20, 10)]), tvGia);
    const md = kq.theoLo.A.dong.find((d) => d.khoa === 'matDo')!;
    expect(md.dat).toBeCloseTo(4, 1); // 400 / 10000 = 4 %
    expect(md.muc).toBe('ok');
  });
  it('DT sàn chỉ tiêu theo hệ số; hệ số căn = 0 thì chỉ còn phần chung', () => {
    const p = pa(lo(hcn(100, 100)), [toa('T1', 20, 20, 10)]);
    const du = tinhChiTieu(p, tvGia).theoLo.A.dtSanTinhHSSDD;
    expect(du).toBeCloseTo(4000, 0); // 400 m2 x 10 tầng
    const chiChung = tinhChiTieu({ ...p, heSo: { ...p.heSo, can: 0 } }, tvGia).theoLo.A.dtSanTinhHSSDD;
    expect(chiChung).toBeCloseTo(4000 - 10 * (2 * 59.51 + 44), 0);
  });
  it('lô DT 0 hoặc chưa có tòa: mọi giá trị đạt là null, không ném lỗi', () => {
    const kq = tinhChiTieu(pa(lo([]), []), tvGia);
    for (const d of kq.theoLo.A.dong) expect(d.dat === null || d.dat === 0).toBe(true);
    expect(kq.theoLo.A.dong.find((d) => d.khoa === 'matDo')!.dat).toBeNull();
  });
});

describe('cơ cấu căn', () => {
  it('điểm lệch cơ cấu = tổng |đạt − mục tiêu|', () => {
    expect(diemLechCoCau({ stu: 3.9, '1pn': 21.0, '2pn': 50.7, '2pnp': 14.0, '3pn': 10.5 }, { stu: 5, '1pn': 20, '2pn': 45, '2pnp': 15, '3pn': 15 })).toBeCloseTo(13.3, 1);
  });
  it('đếm căn theo tòa, có tính căn thay', () => {
    const t = { ...toa('T1', 20, 20, 10), canTheo: { 'tm-1pn-m1': 'tm-2pn-m1' } };
    expect(demCan(pa(lo(hcn(100, 100)), [t]), tvGia).T1).toEqual({ stu: 0, '1pn': 0, '2pn': 30, '2pnp': 0, '3pn': 0 });
  });
  it('đổi mẫu cùng bề ngang trên thư viện thật', () => {
    const lib = (f: string) => JSON.parse(readFileSync(new URL(`../../public/lib/${f}`, import.meta.url), 'utf-8'));
    const tv = taoThuVien(lib('toa.json'), lib('can.json'));
    expect(['tm-2pn-y1', 'tm-2pn-y2']).toContain(doiMauCungBeNgang('tm-1pn-m2', '2pn', tv));
    expect(doiMauCungBeNgang('tm-stu-m1', '3pn', tv)).toBeNull();
    const t = tv.toa.get('tm-i1')!;
    expect(Object.values(t.co_cau).reduce((a, b) => a + b, 0)).toBe(t.so_can_tang);
  });
  it('đế offset 3 m chạy được trên cả 33 mẫu tòa thật, DT đế > DT chân tháp', () => {
    const lib = (f: string) => JSON.parse(readFileSync(new URL(`../../public/lib/${f}`, import.meta.url), 'utf-8'));
    const tv = taoThuVien(lib('toa.json'), lib('can.json'));
    for (const mau of tv.toa.values()) {
      const chan = chanToa(mau, { ...toa('T', 0, 0, 1), mauId: mau.id });
      expect(Math.abs(dienTich(chan) - mau.dtxd_m2)).toBeLessThan(1);
      expect(dtVung(khoiDe([chan], [3]))).toBeGreaterThan(mau.dtxd_m2);
    }
  });
});
