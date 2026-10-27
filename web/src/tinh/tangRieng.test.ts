import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tinhChiTieu } from './chiTieu';
import { demCan, dtTbTheoLoai } from './coCau';
import { dtCongNangToa, kiemShcd } from './congNang';
import { apDoiViTriTang, boTangRieng, datCoCauTang, doiCanTheoTang, doiCongNang, thongTinLoi, datLoi, veMauGoc } from './doiCan';
import { taoThuVien, type CanMau, type Diem, type TrangThaiPA, type ToaDat } from './kieu';
import { chuanHoaPA, taoLo } from './macDinh';
import { boCucTang, canCaToa, canCuaToa, coCauRiengTang, nhomTang, tangCoRieng, viTriCan, type ToaCoMat } from './matBang';
import { toiUuCoCau } from './toiUu';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<(ToaCoMat & { duong_bao: Diem[] })[]>('toa.json');
const tv = taoThuVien(toaDs, doc<CanMau[]>('can.json'));
const mau = toaDs.find((t) => t.id === 'tm-u2')!;
const vts = viTriCan(mau, tv);
const dat = (kh: Partial<ToaDat> = {}): ToaDat => ({ id: 'T', loId: 'L', mauId: mau.id, x: 0, y: 0, gocDo: 0, soTangDH: 10, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {}, ...kh });
const lo = { ...taoLo('L', 'CC-01', 'tm', [[-100, -100], [100, -100], [100, 100], [-100, 100]]) };
const pa = (...ts: ToaDat[]): TrangThaiPA => ({ phienBan: 1, lo: [lo], heSo: { can: 1, chung: 1, thuongMai: 1, ham: 0 }, nguong: { dtCanM2: 2, kichThuocM: 0.2, coCauDiem: 5 }, toa: ts, ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 } });
const tong = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + b, 0);
const n = mau.so_can_tang;

describe('PA cũ tương thích', () => {
  it('thiếu congNang / tangRieng: đếm như trước (co_cau × số tầng)', () => {
    const t = dat();
    expect(nhomTang(t)).toEqual([{ tang: null, so: 10 }]);
    expect(tong(demCan(pa(t), tv).T)).toBe(n * 10);
    expect(Object.fromEntries(canCaToa(mau, t, tv))).toEqual(Object.fromEntries(Object.entries(mau.co_cau).map(([k, v]) => [k, v * 10])));
  });
  it('chuanHoaPA giữ PA cũ, bỏ khoá tầng hỏng', () => {
    const cu = pa(dat());
    expect(chuanHoaPA(cu).toa[0]).toEqual(cu.toa[0]);
    const hong = chuanHoaPA(pa(dat({ tangRieng: { 0: { congNang: { '0:0': 'shcd' } }, 3: { congNang: { '0:0': 'shcd' } } } as ToaDat['tangRieng'] })));
    expect(Object.keys(hong.toa[0].tangRieng!)).toEqual(['3']);
  });
});

describe('đổi công năng ô (L8)', () => {
  const k0 = vts[0].khoa, k1 = vts[1].khoa;
  it('ô chung đổi SHCĐ: bớt 1 căn mỗi tầng, DT SHCĐ cộng theo số tầng', () => {
    const t = doiCongNang(dat(), null, [k0], 'shcd');
    expect(tong(demCan(pa(t), tv).T)).toBe((n - 1) * 10);
    expect(tong(Object.fromEntries(canCuaToa(mau, t, tv)))).toBe(n - 1);
    expect(dtCongNangToa(t, tv).shcd).toBeCloseTo(tv.can.get(vts[0].canGocId)!.dt_tt_m2 * 10);
    // đổi về căn hộ thì xoá hẳn trường
    expect(doiCongNang(t, null, [k0], 'can').congNang).toBeUndefined();
  });
  it('chọn nhiều ô, đổi một lần; mỗi hạng mục cộng riêng; ô trống không vào hạng mục nào có DT', () => {
    let t = doiCongNang(dat(), null, [k0, k1], 'ky_thuat');
    expect(tong(demCan(pa(t), tv).T)).toBe((n - 2) * 10);
    t = doiCongNang(t, null, [k1], 'trong');
    const dt = dtCongNangToa(t, tv);
    expect(dt.ky_thuat).toBeGreaterThan(0);
    expect(dt.shcd).toBe(0);
    expect(dt.thuong_mai).toBe(0);
  });
  it('chỉ tiêu: số căn và dân số trừ ô đổi công năng', () => {
    const t = doiCongNang(dat(), [2, 3], [k0], 'shcd');
    const kq = tinhChiTieu(pa(t), tv);
    expect(kq.tong.soCan).toBe(n * 10 - 2);
    expect(kq.tong.danSo).toBeCloseTo((n * 10 - 2) * lo.temDat.chiTieu.nguoiMoiCan);
  });
});

describe('bố cục theo tầng (L10)', () => {
  const vt = vts.find((v) => v.canGocId === 'tm-2pn-m2')!;
  it('đổi căn chỉ tầng 2 và 5: các tầng khác giữ bố cục chung', () => {
    const t = doiCanTheoTang(dat(), [2, 5], vt, 'tm-2pn-m1', vts, false);
    expect(tangCoRieng(t)).toEqual([2, 5]);
    expect(nhomTang(t)).toEqual([{ tang: null, so: 8 }, { tang: 2, so: 1 }, { tang: 5, so: 1 }]);
    const ca = Object.fromEntries(canCaToa(mau, t, tv));
    expect(ca['tm-2pn-m2']).toBe(mau.co_cau['tm-2pn-m2'] * 10 - 2);
    expect(ca['tm-2pn-m1']).toBe((mau.co_cau['tm-2pn-m1'] ?? 0) * 10 + 2);
    expect(tong(demCan(pa(t), tv).T)).toBe(n * 10);
    expect(boCucTang(t, 3).canViTri).toBeUndefined();
    expect(boCucTang(t, 2).canViTri).toEqual({ [vt.khoa]: 'tm-2pn-m1' });
  });
  it('đổi tầng về đúng bố cục chung thì bỏ ghi đè; bỏ bố cục riêng xoá trường', () => {
    const t = doiCanTheoTang(dat(), [2], vt, 'tm-2pn-m1', vts, false);
    expect(doiCanTheoTang(t, [2], vt, vt.canGocId, vts, false).tangRieng).toBeUndefined();
    expect(boTangRieng(t, [2]).tangRieng).toBeUndefined();
  });
  it('ghi đè tầng thắng bố cục chung; công năng tầng riêng đè công năng chung', () => {
    let t = doiCongNang(dat(), null, [vts[0].khoa], 'shcd');
    t = doiCongNang(t, [4], [vts[0].khoa], 'can'); // tầng 4 trả lại căn
    expect(tong(demCan(pa(t), tv).T)).toBe((n - 1) * 9 + n);
    expect(dtCongNangToa(t, tv).shcd).toBeCloseTo(tv.can.get(vts[0].canGocId)!.dt_tt_m2 * 9);
  });
  it('tầng ghi đè nằm ngoài số tầng điển hình thì bỏ qua', () => {
    const t = doiCongNang(dat({ soTangDH: 3 }), [7], [vts[0].khoa], 'shcd');
    expect(tong(demCan(pa(t), tv).T)).toBe(n * 3);
  });
  it('DT TB theo loại và về mẫu gốc tính theo tầng', () => {
    const t = doiCanTheoTang(dat(), [1], vt, 'tm-2pn-m1', vts, true);
    expect(dtTbTheoLoai(pa(t), tv, 'L')['2pn']).not.toBeNull();
    expect(veMauGoc(t).tangRieng).toBeUndefined();
  });
  it('tối ưu cho tầng: lưu phần khác bố cục chung; ô đổi công năng không bị đổi', () => {
    const t0 = doiCongNang(dat(), null, [vts[0].khoa], 'thuong_mai');
    const muc = { stu: 0, '1pn': 0, '2pn': 0, '2pnp': 100, '3pn': 0 };
    const kq = toiUuCoCau(mau, boCucTang(t0, 3), tv, muc);
    expect(kq.canViTri[vts[0].khoa]).toBeUndefined();
    const t = apDoiViTriTang(t0, [3], kq.canViTri, vts);
    expect(Object.keys(boCucTang(t, 3).canViTri ?? {}).length).toBe(Object.keys(kq.canViTri).length);
    expect(boCucTang(t, 1).canViTri).toBeUndefined();
  });
});

describe('cơ cấu riêng tầng (S12), SHCĐ, lõi', () => {
  it('lưu và đọc mục tiêu cơ cấu riêng; không làm tầng thành bố cục riêng', () => {
    const muc = { stu: 0, '1pn': 50, '2pn': 50, '2pnp': 0, '3pn': 0 };
    const t = datCoCauTang(dat(), [10], muc);
    expect(coCauRiengTang(t, 10)).toEqual(muc);
    expect(coCauRiengTang(t, 9)).toBeNull();
    expect(tangCoRieng(t)).toEqual([]);
    expect(datCoCauTang(t, [10], null).tangRieng).toBeUndefined();
  });
  it('SHCĐ ≥ 0,8 m²/căn: chưa có thì vượt, đủ thì đạt', () => {
    expect(kiemShcd(pa(dat()), tv, () => true).muc).toBe('vuot');
    const t = doiCongNang(dat(), [1], [vts[0].khoa], 'shcd');
    const k = kiemShcd(pa(t), tv, () => true);
    expect(k.soCan).toBe(n * 10 - 1);
    expect(k.m2MoiCan).toBeCloseTo(tv.can.get(vts[0].canGocId)!.dt_tt_m2 / (n * 10 - 1));
    expect(k.canCu).toBe('QCVN 04:2021/BXD 2.2.7');
    expect(k.muc).toBe(k.m2MoiCan! >= 0.8 ? (k.m2MoiCan! <= 0.824 ? 'canh_bao' : 'ok') : 'vuot');
  });
  it('lõi: mặc định + ghi đè', () => {
    const t = datLoi(dat(), '0:3', { ...thongTinLoi(dat(), '0:3'), cua: 'phai', thangMay: { ham: false, mai: true } });
    expect(thongTinLoi(t, '0:3').cua).toBe('phai');
    expect(thongTinLoi(t, '0:3').thangMay).toEqual({ ham: false, mai: true });
    expect(thongTinLoi(t, '1:0').cua).toBe('trai');
  });
});
