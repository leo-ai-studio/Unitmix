/**
 * Ca kiểm tay cho các luật PCCC màn Tầng: số thang máy (QCVN 04 2.4.1 · 2.4.2), ngưỡng thang máy chữa cháy (QCVN 06 6.13 /
 * QCVN 04 2.4.3), bán kính 60 / 45 m (6.13 / A.2.12), chia khoang hành lang 60 / 30 m (3.3.5 / A.2.14), tủ họng nước R 18 m (QT-77),
 * họng chờ 45 m (QCVN 04 2.5.3) — và một tòa thật (tm-z3) chạy đủ phân tích.
 */
import { describe, expect, it } from 'vitest';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import type { Diem } from './kieu';
import { mauHieuDung, type ToaMB } from './loiThang';
import { boCucTang } from './matBang';
import { chieuCaoPCCC } from './pccc';
import { phanTichPCCCTang } from './pcccTang';
import { banKinhTMCC, canTMCC, chonThangChuaChay, giengThangMay, kiemThangMay, soGiengTheoTen, thangMayCan } from './thangMay';
import { chiaHanhLang, doKhoang, gioiHanKhoangHL, type CanhHL } from './chiaHanhLang';

describe('số thang máy — QCVN 04:2021 2.4.1 · 2.4.2 (app cũ QT-94: lấy cách cho ít thang hơn)', () => {
  it('2.4.1: dưới 5 tầng 0, từ 5 tầng 1, từ 10 tầng 2', () => {
    expect(thangMayCan(4, 10, 30).theoTang).toBe(0);
    expect(thangMayCan(5, 10, 30).theoTang).toBe(1);
    expect(thangMayCan(9, 10, 30).theoTang).toBe(1);
    expect(thangMayCan(10, 10, 30).theoTang).toBe(2);
  });
  it('2.4.2: 70 căn / thang, 200 người / thang, làm tròn lên; số cần = max(2.4.1, min hai cách)', () => {
    // 25 tầng × 16 căn = 400 căn → ⌈400/70⌉ = 6; dân 400 × 3,0 = 1 200 → ⌈1200/200⌉ = 6
    expect(thangMayCan(26, 400, 1200)).toMatchObject({ theoCan: 6, theoDan: 6, can: 6 });
    // 420 căn → 6; dân 1 000 → 5 → lấy 5 (cách dân)
    expect(thangMayCan(26, 420, 1000)).toMatchObject({ theoCan: 6, theoDan: 5, can: 5, cachTinh: 'dan' });
    // 71 căn → 2; dân 250 → 2
    expect(thangMayCan(26, 71, 250).can).toBe(2);
    // tòa nhỏ 10 tầng 40 căn: 2.4.2 ra 1 nhưng 2.4.1 đòi 2
    expect(thangMayCan(10, 40, 120).can).toBe(2);
    // chưa tính được dân → chỉ theo căn
    expect(thangMayCan(26, 300, null)).toMatchObject({ theoDan: null, can: 5 });
  });
  it('kiểm: có ≥ cần là đạt, thiếu là vượt; tỷ lệ căn / thang', () => {
    expect(kiemThangMay(6, 26, 400, 1200)).toMatchObject({ muc: 'ok', canMoiThang: 400 / 6 });
    expect(kiemThangMay(5, 26, 400, 1200).muc).toBe('vuot');
    expect(kiemThangMay(0, 26, 400, 1200).canMoiThang).toBeNull();
  });
  it('đếm giếng theo tên khối lõi (QT-64) khi chưa có hình', () => {
    expect(soGiengTheoTen('x_tmdv_z3_tm_06')).toBe(6);
    expect(soGiengTheoTen('x_tb_n3')).toBeNull();
  });
});

describe('thang máy chữa cháy — QCVN 06:2022 6.13 / A.2.12, QCVN 04 2.4.3', () => {
  it('chung cư (F1.3) bắt buộc khi H PCCC > 50 m', () => {
    expect(canTMCC(50)).toBe(false);
    expect(canTMCC(50.1)).toBe(true);
  });
  it('bán kính phục vụ 60 m (6.13), nhà > 75 m 45 m (A.2.12)', () => {
    expect(banKinhTMCC(75).r).toBe(60);
    expect(banKinhTMCC(75.1).r).toBe(45);
  });
  it('chọn giếng phủ nhiều điểm nhất; điểm ngoài bán kính báo ra', () => {
    const gieng: Diem[] = [[0, 0], [50000, 0]];
    const diem: Diem[] = [[10000, 0], [55000, 0], [100000, 0], [120000, 0]];
    const r = chonThangChuaChay(gieng, diem, 60000);
    // giếng 2 phủ 3 điểm (10, 55, 100 m) → chọn trước; điểm 120 m cách 70 m > 60 → giếng 1 không phủ thêm
    expect(r.chon).toEqual([1]);
    expect(r.ngoai).toEqual([3]);
    expect(r.xaNhat).toBe(70000);
  });
  it('hoà số điểm: chọn giếng gần cửa thang N3 (gộp khoang đệm)', () => {
    const r = chonThangChuaChay([[0, 0], [1000, 0]], [[5000, 0]], 60000, [[1200, 0]]);
    expect(r.chon).toEqual([1]);
  });
  it('giếng trên mặt bằng: lấy vi_tri_gieng theo điểm chèn / xoay / lật của lõi, bỏ lượt chèn lặp', () => {
    const q = { loai: 'loi', ma: '', block: 'x_a_tm_02', ma_thu_vien: null, a0: 0, a1: 0, rong_mm: 0, sau_mm: null, x: 1000, y: 2000, rot: 90, sx: -1, sy: 1 };
    const mat = [{ goc_deg: 0, truc_mm: 0, a_dau: 0, a_cuoi: 0, phan_tu: [q, { ...q }] }];
    const g = giengThangMay(mat, () => ({ vi_tri_gieng: [[100, 0], [0, 300]] }));
    expect(g.so).toBe(2);
    // (100,0) lật x → (-100,0), xoay 90° → (0,-100) → (1000, 1900)
    expect(g.gieng[0].p[0]).toBeCloseTo(1000);
    expect(g.gieng[0].p[1]).toBeCloseTo(1900);
    expect(giengThangMay(mat, () => undefined)).toMatchObject({ so: 2, thieuHinh: true });
  });
});

describe('chia khoang hành lang — QCVN 06 3.3.5 (≤ 60 m) / A.3.1.7 → A.2.14 (H > 75 m: ≤ 30 m)', () => {
  const thang = (L: number): CanhHL[] => [{ i: 0, j: 1, L, p0: [0, 0], p1: [L, 0], huong: [1, 0] }];
  it('ngưỡng theo chiều cao PCCC', () => {
    expect(gioiHanKhoangHL(75).m).toBe(60);
    expect(gioiHanKhoangHL(76).m).toBe(30);
  });
  it('hành lang thẳng 50 m: ≤ 60 không cửa; > 30 m (nhà > 75 m) một cửa, hai khoang ≤ 30', () => {
    expect(chiaHanhLang(thang(50000), 2, 60000)).toHaveLength(0);
    const c = chiaHanhLang(thang(50000), 2, 30000);
    expect(c).toHaveLength(1);
    expect(Math.max(...doKhoang(thang(50000), 2, c))).toBeLessThanOrEqual(30000);
  });
  it('hành lang thẳng 130 m, giới hạn 60 m: hai cửa, mọi khoang ≤ 60 m, tổng giữ nguyên', () => {
    const c = chiaHanhLang(thang(130000), 2, 60000);
    expect(c).toHaveLength(2);
    const k = doKhoang(thang(130000), 2, c);
    expect(Math.max(...k)).toBeLessThanOrEqual(60000);
    expect(k.reduce((a, b) => a + b, 0)).toBeCloseTo(130000);
  });
  it('chữ T ba nhánh 25 m: tổng 75 m > 60 → cắt một nhánh sát nút, khoang còn lại 50 + 25', () => {
    const T: CanhHL[] = [
      { i: 0, j: 1, L: 25000, p0: [0, 0], p1: [-25000, 0], huong: [-1, 0] },
      { i: 0, j: 2, L: 25000, p0: [0, 0], p1: [25000, 0], huong: [1, 0] },
      { i: 0, j: 3, L: 25000, p0: [0, 0], p1: [0, 25000], huong: [0, 1] },
    ];
    const c = chiaHanhLang(T, 4, 60000);
    expect(c).toHaveLength(1);
    const k = doKhoang(T, 4, c);
    expect(k).toHaveLength(2);
    expect(Math.max(...k)).toBeLessThanOrEqual(60000);
  });
  it('dời cửa tránh cửa căn trong phạm vi 1,5 m', () => {
    const c0 = chiaHanhLang(thang(50000), 2, 30000)[0];
    const c1 = chiaHanhLang(thang(50000), 2, 30000, [c0.p])[0];
    expect(Math.abs(c1.p[0] - c0.p[0])).toBeGreaterThanOrEqual(1200);
    expect(Math.max(...doKhoang(thang(50000), 2, [c1]))).toBeLessThanOrEqual(30000);
  });
});

describe('tòa thật tm-z3 — phân tích đủ lớp', () => {
  const { tv, dl } = napThuVien();
  const chay = (soTangDH: number, tuTay?: Diem[]) => {
    const toa = toaThu('tm-z3', soTangDH);
    const mau = mauHieuDung(toa, tv.toa.get('tm-z3') as unknown as ToaMB, dl, null);
    const H = chieuCaoPCCC(toa.soTangDe, toa.caoDe, toa.soTangDH, toa.caoDH);
    return { H, kq: phanTichPCCCTang({ mau, bc: boCucTang(toa, null), tv, dl, H, soTangDH, soTangNoi: soTangDH + 1, soCanToa: 400, danToa: 1200, tuTay }) };
  };
  it('24 tầng (H = 4,5 + 3,3 × 23 + 1,4 = 81,8 m): TMCC bắt buộc R 45 m, khoang hành lang 30 m, đếm 5 giếng theo hình (QT-64: tên ghi 06)', () => {
    const { H, kq } = chay(24);
    expect(H).toBeCloseTo(81.8);
    expect(kq.thangMay.co).toBe(5);
    expect(kq.thangMay.can).toBe(6);
    expect(kq.thangMay.muc).toBe('vuot');
    expect(kq.tmcc).toMatchObject({ batBuoc: true, r: 45 });
    expect(kq.tmcc.chon.length).toBeGreaterThanOrEqual(1);
    expect(kq.hanhLang.gioiHan).toBe(30);
    expect(Math.max(...kq.hanhLang.khoang)).toBeLessThanOrEqual(30.01);
    expect(kq.hongCho.apDung).toBe(true);
    expect(kq.tu.viTri.length).toBeGreaterThan(0);
    expect(kq.tu.thieu).toEqual([]);
    expect(kq.cuaNC.filter((c) => c.loai === 'thang')).toHaveLength(kq.thangBo.length);
    expect(kq.thoatNan.can.length).toBeGreaterThan(10);
  });
  it('12 tầng (H ≤ 50 m): không đòi TMCC / họng chờ 45 m, khoang hành lang 60 m', () => {
    const { H, kq } = chay(12);
    expect(H).toBeLessThanOrEqual(50);
    expect(kq.tmcc.muc).toBe('khong_ap');
    expect(kq.hongCho.muc).toBe('khong_ap');
    expect(kq.hanhLang.gioiHan).toBe(60);
    expect(Math.max(...kq.hanhLang.khoang)).toBeLessThanOrEqual(60.01);
  });
  it('tủ đặt tay: dùng vị trí tay, tủ quá xa báo căn chưa phủ; kết quả nhớ theo đầu vào', () => {
    const { kq } = chay(24, [[0, 0]]);
    expect(kq.tu.tuDat).toBe(false);
    expect(kq.tu.thieu.length).toBeGreaterThan(0);
    expect(chay(24, [[0, 0]]).kq).toBe(kq);
  });
});
