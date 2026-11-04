import { describe, expect, it } from 'vitest';
import type { Diem } from './kieu';
import { batDiemDo, CAU_HINH_BAT, canhDaGiac, chanVuong, chuanHoaKichThuoc, giaoDoan, hinhKichThuoc, lechTuDiem, nguonBatDaGiac, soDoHaiDiem, type CauHinhBat, type KichThuoc } from './kichThuoc';

const vuong: Diem[] = [[0, 0], [10, 0], [10, 6], [0, 6]];
const nguon = nguonBatDaGiac(vuong);
const cfg = (p: Partial<CauHinhBat> = {}): CauHinhBat => ({ ...CAU_HINH_BAT, ...p });

describe('hình học cơ bản', () => {
  it('giao hai đoạn: cắt, chạm đầu mút, song song / không cắt', () => {
    expect(giaoDoan([[0, 0], [10, 10]], [[0, 10], [10, 0]])).toEqual([5, 5]);
    expect(giaoDoan([[0, 0], [10, 0]], [[10, 0], [10, 5]])).toEqual([10, 0]);
    expect(giaoDoan([[0, 0], [10, 0]], [[0, 1], [10, 1]])).toBeNull();
    expect(giaoDoan([[0, 0], [1, 0]], [[5, -1], [5, 1]])).toBeNull();
  });
  it('chân vuông góc kẹp trong đoạn', () => {
    expect(chanVuong([3, 4], [[0, 0], [10, 0]])).toEqual({ q: [3, 0], t: 0.3 });
    expect(chanVuong([-5, 4], [[0, 0], [10, 0]]).q).toEqual([0, 0]);
  });
  it('cạnh đa giác kín', () => { expect(canhDaGiac(vuong).length).toBe(4); });
});

describe('bắt điểm kiểu CAD', () => {
  it('đỉnh thắng mọi loại khác trong ngưỡng', () => {
    const r = batDiemDo([9.9, 0.1], nguon, cfg(), 0.3);
    expect(r).toEqual({ p: [10, 0], loai: 'dinh' });
  });
  it('trung điểm cạnh; giao điểm hai cạnh kéo cắt nhau (hai đoạn cắt giữa)', () => {
    expect(batDiemDo([5.05, 0.05], nguon, cfg(), 0.3)).toEqual({ p: [5, 0], loai: 'trung' });
    const n = { dinh: [], canh: [[[0, 0], [10, 10]], [[0, 10], [10, 0]]] as [Diem, Diem][] };
    expect(batDiemDo([5.1, 4.9], n, cfg(), 0.3)).toEqual({ p: [5, 5], loai: 'giao' });
  });
  it('vuông góc từ điểm trước xuống cạnh; gần nhất khi tắt vuông góc', () => {
    // điểm trước (3, 3); con trỏ gần chân vuông góc xuống cạnh đáy tại (3, 0) — không gần đỉnh / trung điểm
    expect(batDiemDo([3.1, 0.1], nguon, cfg(), 0.3, [3, 3])).toEqual({ p: [3, 0], loai: 'vuong' });
    const r = batDiemDo([3.1, 0.1], nguon, cfg({ vuong: false }), 0.3, [3, 3]);
    expect(r.loai).toBe('gan');
    expect(r.p[0]).toBeCloseTo(3.1, 9);
    expect(r.p[1]).toBeCloseTo(0, 9);
  });
  it('tắt từng loại bắt; ngoài ngưỡng giữ nguyên điểm bấm', () => {
    expect(batDiemDo([9.9, 0.1], nguon, cfg({ dinh: false, trung: false, giao: false, vuong: false, gan: false }), 0.3)).toEqual({ p: [9.9, 0.1], loai: null });
    expect(batDiemDo([4, 3], nguon, cfg(), 0.3)).toEqual({ p: [4, 3], loai: null });
  });
  it('lưới làm tròn theo bước; thấp hơn ưu tiên đỉnh', () => {
    expect(batDiemDo([4.4, 2.2], { dinh: [], canh: [] }, cfg({ luoi: true, luoiBuoc: 0.5 }), 0.3)).toEqual({ p: [4.5, 2], loai: 'luoi' });
    expect(batDiemDo([0.1, 0.1], nguon, cfg({ luoi: true }), 0.3).loai).toBe('dinh');
  });
  it('ortho (Shift): không bắt được gì thì khoá ngang / đứng so với điểm trước', () => {
    expect(batDiemDo([6, 3.4], { dinh: [], canh: [] }, cfg({ ortho: true }), 0.3, [2, 3])).toEqual({ p: [6, 3], loai: null });
    expect(batDiemDo([2.4, 7], { dinh: [], canh: [] }, cfg({ ortho: true }), 0.3, [2, 3])).toEqual({ p: [2, 7], loai: null });
    // có bắt được thì bắt thắng ortho
    expect(batDiemDo([10, 0.1], nguon, cfg({ ortho: true }), 0.3, [2, 3]).loai).toBe('dinh');
  });
});

describe('kích thước (DIM)', () => {
  const k = (loai: KichThuoc['loai'], p: Diem[], lech: number): KichThuoc => ({ id: 'k', loai, p, lech });
  it('thẳng: dài đúng, đường kích thước song song cách lech theo pháp tuyến, nhãn không lộn ngược', () => {
    const h = hinhKichThuoc(k('thang', [[0, 0], [3, 4]], 1));
    expect(h.gia).toBeCloseTo(5, 9);
    const [da, db] = h.duong!;
    expect(Math.hypot(db[0] - da[0], db[1] - da[1])).toBeCloseTo(5, 9);
    // song song với đoạn gốc, cách 1 m
    const cross = (db[0] - da[0]) * (0 - da[1]) - (db[1] - da[1]) * (0 - da[0]);
    expect(Math.abs(cross) / 5).toBeCloseTo(1, 9);
    expect(h.nhan.chu).toBe('5,00 m');
    expect(h.nhan.goc).toBeGreaterThan(-90);
    expect(h.nhan.goc).toBeLessThanOrEqual(90);
    const nguoc = hinhKichThuoc(k('thang', [[3, 4], [0, 0]], 1));
    expect(nguoc.nhan.goc).toBeGreaterThan(-90);
    expect(nguoc.nhan.goc).toBeLessThanOrEqual(90);
  });
  it('ngang / đứng: chỉ lấy Δx / Δy, đường kích thước đúng phương, vị trí theo lech', () => {
    const n = hinhKichThuoc(k('ngang', [[1, 1], [6, 4]], 2));
    expect(n.gia).toBeCloseTo(5, 9);
    expect(n.duong![0][1]).toBeCloseTo(2.5 + 2, 9);
    expect(n.duong![0][1]).toBe(n.duong![1][1]);
    const d = hinhKichThuoc(k('dung', [[1, 1], [6, 4]], -1));
    expect(d.gia).toBeCloseTo(3, 9);
    expect(d.duong![0][0]).toBeCloseTo(3.5 - 1, 9);
    expect(d.nhan.chu).toBe('3,00 m');
  });
  it('chân kích thước nối từ điểm đo tới đường kích thước, vượt thêm một đoạn', () => {
    const h = hinhKichThuoc(k('ngang', [[0, 0], [4, 0]], 2));
    expect(h.chan.length).toBe(2);
    for (const [a, b] of h.chan) { expect(a[1]).toBeGreaterThanOrEqual(0); expect(b[1]).toBeGreaterThan(2); }
    expect(h.mui.length).toBe(2);
  });
  it('góc: 90° giữa hai cạnh vuông; 45° ; bán kính cung theo lech hoặc tự chọn', () => {
    const g = hinhKichThuoc(k('goc', [[4, 0], [0, 0], [0, 4]], 1.5));
    expect(g.gia).toBeCloseTo(90, 9);
    expect(g.nhan.chu).toBe('90,0°');
    for (const q of g.cung) expect(Math.hypot(q[0], q[1])).toBeCloseTo(1.5, 9);
    expect(hinhKichThuoc(k('goc', [[4, 0], [0, 0], [4, 4]], 0)).gia).toBeCloseTo(45, 9);
    const tu = hinhKichThuoc(k('goc', [[4, 0], [0, 0], [0, 4]], 0));
    expect(Math.hypot(tu.cung[0][0], tu.cung[0][1])).toBeGreaterThan(0.29);
    // góc phản đối xứng: đọc theo góc nhỏ (≤ 180°)
    expect(hinhKichThuoc(k('goc', [[4, 0], [0, 0], [0, -4]], 1)).gia).toBeCloseTo(90, 9);
  });
  it('lech từ điểm thứ ba: thẳng (pháp tuyến), ngang, đứng, góc', () => {
    expect(lechTuDiem('ngang', [[0, 0], [4, 2]], [2, 5])).toBeCloseTo(4, 9);
    expect(lechTuDiem('dung', [[0, 0], [4, 2]], [5, 1])).toBeCloseTo(3, 9);
    const l = lechTuDiem('thang', [[0, 0], [4, 0]], [2, -3]);
    const h = hinhKichThuoc({ id: 'x', loai: 'thang', p: [[0, 0], [4, 0]], lech: l });
    expect(h.duong![0][1]).toBeCloseTo(-3, 9);
    expect(lechTuDiem('goc', [[4, 0], [0, 0], [0, 4]], [3, 4])).toBeCloseTo(5, 9);
  });
  it('số đo hai điểm: dài, Δx, Δy, góc 0–180', () => {
    const s = soDoHaiDiem([0, 0], [3, -4]);
    expect(s.dai).toBeCloseTo(5, 9);
    expect(s.dx).toBe(3); expect(s.dy).toBe(4);
    expect(s.goc).toBeGreaterThanOrEqual(0); expect(s.goc).toBeLessThanOrEqual(180);
  });
});

describe('làm sạch dữ liệu đọc từ PA', () => {
  it('giữ bản ghi hợp lệ, bỏ bản ghi hỏng', () => {
    const tot = { id: 'a', loai: 'thang', p: [[0, 0], [1, 1]], lech: 0.5 };
    const r = chuanHoaKichThuoc({ tmb: [tot, { id: 'b', loai: 'lạ', p: [[0, 0], [1, 1]], lech: 0 }, { id: 'c', loai: 'goc', p: [[0, 0], [1, 1]], lech: 0 }, { id: 'd', loai: 'ngang', p: [[0, 0], [NaN, 1]], lech: 0 }, null], ham: 'rác', tang: [] });
    expect(r).toEqual({ tmb: [tot] });
    expect(chuanHoaKichThuoc(null)).toBeUndefined();
    expect(chuanHoaKichThuoc([1])).toBeUndefined();
  });
});
