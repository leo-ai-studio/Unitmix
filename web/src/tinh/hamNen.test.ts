import { describe, expect, it } from 'vitest';
import { paGonChoHam, raiHam, raiHamTinh } from './ham';
import { DieuPhoiHam, type ThuRai, type ThuXong, type WorkerGiong } from './hamNen';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Lo, type ThuVien, type ToaDat, type ToaMau, type TrangThaiPA } from './kieu';
import { chuanHoaPA } from './macDinh';

// Lớp điều phối rải hầm bằng Web Worker (tinh/hamNen.ts): worker giả lập, hàm thuần raiHamTinh vẫn chạy đồng bộ.
const can: CanMau[] = [
  { id: 'tm-2pn-m1', ma_goc: 'a', nhom: 'tm', loai: '2pn', vi_tri: 'giua', vi_tri_ma: 'm1', sau_mm: 8500, rong_mm: 7500, ten_vi: '', ten_en: '', dt_tt_m2: 60, dt_tim_m2: 64 },
];
const mau: ToaMau = {
  id: 'tm-i9', ma_goc: 'x', nhom: 'tm', hinh: 'i', so: 9, ten_vi: '', ten_en: '', so_can_tang: 4, dtxd_m2: 400,
  hanh_lang_mm: 1800, sau_can_mm: 8500, duong_bao: [[0, 0], [20000, 0], [20000, 20000], [0, 20000]], co_cau: { 'tm-2pn-m1': 4 }, loi: [],
};
const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 3.5, tangCaoMax: 25, tangDe: null, tangCanHo: null, tangHam: null, danSoMax: 1600, soCanMax: null, nguoiMoiCan: 3.5, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo = (id: string, x0: number): Lo => ({ id, ranh: [[x0, 0], [x0 + 60, 0], [x0 + 60, 40], [x0, 40]], chiGioi: null, xungQuanh: [], temDat: { kyHieu: id, chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 0, '1pn': 0, '2pn': 100, '2pnp': 0, '3pn': 0 } } });
const toa = (o: Partial<ToaDat>): ToaDat => ({ id: 't1', loId: 'A', mauId: 'tm-i9', x: 30, y: 20, gocDo: 0, soTangDH: 10, soTangDe: 2, caoDe: 4.5, caoDH: 3.3, coApMai: true, deOffset: 0, canTheo: {}, ...o });
const pa: TrangThaiPA = chuanHoaPA({
  phienBan: 1, lo: [lo('A', 0), lo('B', 100)], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH,
  toa: [toa({}), toa({ id: 't2', loId: 'B', x: 130 })],
  ham: { soTang: 1, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 },
});
const A = pa.lo[0], B = pa.lo[1];
const soTang = (n: number): TrangThaiPA => ({ ...pa, ham: { ...pa.ham!, soTang: n } });

/** Worker giả: giữ thư, `chay()` rải bằng raiHamTinh như worker thật (cả khi đã bị terminate — kết quả đó phải bị bỏ). */
class WorkerGia implements WorkerGiong {
  onmessage: ((e: { data: ThuXong }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  thu: ThuRai[] = [];
  daHuy = false;
  private tv: ThuVien | null = null;
  postMessage(m: ThuRai) { this.thu.push(structuredClone(m)); }
  terminate() { this.daHuy = true; }
  chay(loi = false) {
    const m = this.thu.shift()!;
    if (m.tv !== undefined) this.tv = m.tv;
    this.onmessage?.({ data: loi ? { id: m.id, loi: 'hỏng' } : { id: m.id, kq: raiHamTinh(m.pa, this.tv, m.lo) } });
  }
}
const taoBo = () => {
  const ds: WorkerGia[] = [];
  const dp = new DieuPhoiHam(() => { const w = new WorkerGia(); ds.push(w); return w; });
  return { ds, dp };
};
const doc = (dp: DieuPhoiHam, kenh: string, p: TrangThaiPA, tv: ThuVien, l: Lo) => {
  const ph = dp.phien(kenh);
  const kq = ph.lay(p, tv, l);
  ph.xong();
  return { kq, dangCho: ph.dangCho };
};

describe('điều phối rải hầm (Web Worker)', () => {
  it('trúng cache thì trả ngay, không gửi worker', () => {
    const tv = taoThuVien([mau], can);
    const san = raiHam(pa, tv, A);
    const { ds, dp } = taoBo();
    const r = doc(dp, 'ham', { ...pa }, tv, A);
    expect(r.kq).toBe(san);
    expect(r.dangCho).toBe(false);
    expect(ds.reduce((a, w) => a + w.thu.length, 0)).toBe(0);
  });

  it('chưa có: chờ worker, xong thì vào cache, báo người nghe, khớp bản đồng bộ', () => {
    const tv = taoThuVien([mau], can);
    const { ds, dp } = taoBo();
    let bao = 0;
    dp.nghe(() => bao++);
    const r = doc(dp, 'ham', pa, tv, A);
    expect(r.kq).toBeUndefined();
    expect(r.dangCho).toBe(true);
    expect(dp.dangChoKenh('ham')).toBe(true);
    expect(ds).toHaveLength(1);
    expect(ds[0].thu[0].tv).toBeDefined(); // thư viện gửi kèm lần đầu
    expect(ds[0].thu[0].pa.toa.every((x) => x.loId === 'A')).toBe(true); // PA thu gọn
    const v = dp.phienBan;
    ds[0].chay();
    expect(dp.phienBan).toBe(v + 1);
    expect(bao).toBeGreaterThanOrEqual(1);
    expect(dp.dangChoKenh('ham')).toBe(false);
    const sau = doc(dp, 'ham', pa, tv, A);
    expect(sau.dangCho).toBe(false);
    expect(JSON.stringify(sau.kq)).toBe(JSON.stringify(raiHamTinh(pa, tv, A)));
    expect(raiHam(pa, tv, A)).toBe(sau.kq); // dùng chung cache với raiHam đồng bộ
  });

  it('đổi đầu vào khi đang rải: huỷ lượt cũ, chỉ giữ lượt mới nhất; trong lúc chờ giữ kết quả cũ', () => {
    const tv = taoThuVien([mau], can);
    const { ds, dp } = taoBo();
    doc(dp, 'ham', soTang(1), tv, A);
    ds[0].chay();
    const kq1 = doc(dp, 'ham', soTang(1), tv, A).kq;
    expect(kq1?.tang).toHaveLength(1);

    const r2 = doc(dp, 'ham', soTang(2), tv, A); // đang rải 2 tầng
    expect(r2.kq).toBe(kq1); // giữ kết quả cũ
    expect(r2.dangCho).toBe(true);
    const r3 = doc(dp, 'ham', soTang(3), tv, A); // đổi tiếp trước khi xong
    expect(r3.kq).toBe(kq1);
    expect(dp.soLanHuy).toBe(1);
    expect(ds[0].daHuy).toBe(true);
    expect(ds).toHaveLength(2); // worker mới cho lượt mới nhất
    expect(ds[1].thu).toHaveLength(1);
    expect(ds[1].thu[0].tv).toBeDefined(); // worker mới phải nhận lại thư viện
    expect(ds[1].thu[0].pa.ham?.soTang).toBe(3);

    ds[0].chay(); // kết quả muộn của lượt đã huỷ (2 tầng): bỏ
    expect(doc(dp, 'ham', soTang(2), tv, A).kq).toBe(kq1); // vẫn chưa có trong cache → lại thành lượt mới, huỷ lượt 3
    const r = doc(dp, 'ham', soTang(3), tv, A);
    expect(r.dangCho).toBe(true);
    const w = ds[ds.length - 1];
    expect(w.thu[w.thu.length - 1].pa.ham?.soTang).toBe(3);
    w.thu = w.thu.slice(-1);
    w.chay();
    const kq3 = doc(dp, 'ham', soTang(3), tv, A);
    expect(kq3.dangCho).toBe(false);
    expect(kq3.kq?.tang).toHaveLength(3);
    expect(dp.ban).toBe(false);
  });

  it('kết quả cũ chỉ giữ cho đúng lô; kênh khác còn cần thì không huỷ', () => {
    const tv = taoThuVien([mau], can);
    const { ds, dp } = taoBo();
    doc(dp, 'ham', pa, tv, A);
    ds[0].chay();
    expect(doc(dp, 'ham', pa, tv, B).kq).toBeUndefined(); // lô B chưa có gì: không lấy kết quả lô A
    doc(dp, 'chiPhi', pa, tv, B); // Chi phí cũng cần B
    doc(dp, 'ham', pa, tv, A); // màn Hầm quay về A (trúng cache) → B vẫn còn Chi phí cần
    expect(dp.soLanHuy).toBe(0);
    expect(dp.dangChoKenh('chiPhi')).toBe(true);
    dp.bo('chiPhi');
    expect(dp.soLanHuy).toBe(1);
    expect(dp.ban).toBe(false);
  });

  it('nhiều lô một lượt (Chi phí): xếp hàng, rải lần lượt', () => {
    const tv = taoThuVien([mau], can);
    const { ds, dp } = taoBo();
    const ph = dp.phien('chiPhi');
    expect(ph.lay(pa, tv, A)).toBeUndefined();
    expect(ph.lay(pa, tv, B)).toBeUndefined();
    ph.xong();
    expect(ds[0].thu).toHaveLength(1);
    ds[0].chay();
    expect(ds[0].thu).toHaveLength(1); // lô B gửi sau khi A xong
    expect(ds[0].thu[0].tv).toBeUndefined(); // cùng thư viện: không gửi lại
    ds[0].chay();
    const ph2 = dp.phien('chiPhi');
    expect(ph2.lay(pa, tv, A)).not.toBeUndefined();
    expect(ph2.lay(pa, tv, B)).not.toBeUndefined();
    ph2.xong();
    expect(ph2.dangCho).toBe(false);
  });

  it('worker lỗi: rải đồng bộ việc đó cho đúng số; không có Worker: rải đồng bộ', () => {
    const tv = taoThuVien([mau], can);
    const { ds, dp } = taoBo();
    const loi = console.error;
    console.error = () => {};
    doc(dp, 'ham', pa, tv, A);
    ds[0].chay(true);
    console.error = loi;
    expect(JSON.stringify(doc(dp, 'ham', pa, tv, A).kq)).toBe(JSON.stringify(raiHamTinh(pa, tv, A)));

    const tv2 = taoThuVien([mau], can);
    const khong = new DieuPhoiHam(() => null);
    const r = doc(khong, 'ham', pa, tv2, A);
    expect(r.dangCho).toBe(false);
    expect(r.kq).toBe(raiHam(pa, tv2, A));
  });

  it('PA thu gọn gửi worker cho cùng kết quả như PA đầy đủ', () => {
    const tv = taoThuVien([mau], can);
    for (const l of [A, B]) expect(JSON.stringify(raiHamTinh(paGonChoHam(pa, l), tv, l))).toBe(JSON.stringify(raiHamTinh(pa, tv, l)));
  });

  it('cho(): xuất XLS chờ worker rải xong mọi lô, không rải đồng bộ; trúng cache thì xong ngay', async () => {
    const tv = taoThuVien([mau], can);
    const { ds, dp } = taoBo();
    let xong = false;
    const hua = dp.cho('xls', pa, tv, [A, B]).then(() => { xong = true; });
    await Promise.resolve();
    expect(xong).toBe(false);
    expect(ds[0].thu).toHaveLength(1);
    ds[0].chay();
    await Promise.resolve();
    expect(xong).toBe(false);
    ds[0].chay();
    await hua;
    expect(raiHam(pa, tv, A)).toEqual(raiHamTinh(pa, tv, A));
    expect(dp.ban).toBe(false);
    // lần hai: cache đủ, không gửi worker nữa
    await dp.cho('xls', pa, tv, [A, B]);
    expect(ds.reduce((a, w) => a + w.thu.length, 0)).toBe(0);
  });

  it('cho(): dự án nhiều lô hơn sức chứa cache vẫn xong (không rải lại vô hạn)', async () => {
    const tv = taoThuVien([mau], can);
    const n = 70; // > NHO_HAM_TOI_DA
    const nhieu: TrangThaiPA = chuanHoaPA({
      ...pa, lo: Array.from({ length: n }, (_, i) => lo(`L${i}`, i * 100)),
      toa: Array.from({ length: n }, (_, i) => toa({ id: `t${i}`, loId: `L${i}`, x: i * 100 + 30 })),
    });
    const { ds, dp } = taoBo();
    let xong = false;
    const hua = dp.cho('xls', nhieu, tv, nhieu.lo).then(() => { xong = true; });
    let vong = 0;
    while (!xong && vong++ < n * 3) {
      await Promise.resolve();
      const w = ds.find((x) => x.thu.length);
      if (w) w.chay();
    }
    await hua;
    expect(xong).toBe(true);
    expect(vong).toBeLessThanOrEqual(n + 2); // mỗi lô rải đúng một lần
  });
});
