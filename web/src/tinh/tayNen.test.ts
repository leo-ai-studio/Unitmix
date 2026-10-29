import { describe, expect, it } from 'vitest';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import { matBangCua, tuChinhToa, type ToaMB } from './loiThang';
import { chayTay, DieuPhoiTay, type ThuTay, type ThuTayXong, type WorkerTay } from './tayNen';
import { thangTuDongLai, xoaThangTay } from './thaoTacTay';
import type { ThuVien, ToaDat } from './kieu';
import type { DuLieuMB } from './loiThang';

// Điều phối thao tác tay chạy nền (tinh/tayNen.ts): worker giả chạy đúng hàm thuần trên bản chép (structuredClone) như worker thật.
const { tv, dl } = napThuVien();
const c = { tv, dl };

class WorkerGia implements WorkerTay {
  onmessage: ((e: { data: ThuTayXong }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  thu: ThuTay[] = [];
  daHuy = false;
  private tv: ThuVien | null = null;
  private dl: DuLieuMB | null = null;
  postMessage(m: ThuTay) { this.thu.push(structuredClone(m)); }
  terminate() { this.daHuy = true; }
  chay(loi = false) {
    const m = this.thu.shift()!;
    if (m.tv !== undefined) this.tv = m.tv;
    if (m.dl !== undefined) this.dl = m.dl;
    this.onmessage?.({ data: loi ? { id: m.id, loi: 'hỏng' } : { id: m.id, kq: chayTay(m.ten, { tv: this.tv!, dl: this.dl }, m.args) } });
  }
}
const taoBo = () => {
  const ds: WorkerGia[] = [];
  const dp = new DieuPhoiTay(() => { const w = new WorkerGia(); ds.push(w); return w; });
  return { ds, dp };
};

/** Tòa có thang đặt tay (xoá một thang của PC-11) — ⟲ thang về tự động mới có việc. */
function toaTay(id: string): ToaDat {
  const mau = tv.toa.get(id) as unknown as ToaMB;
  const t0 = tuChinhToa(toaThu(id), mau, tv, dl);
  const ds = matBangCua(t0, mau, dl).thangBo;
  for (const t of ds) { const r = xoaThangTay(t0, t.khoa, c); if (r.ok) return r.toa; }
  throw new Error('không xoá được thang nào');
}
const ky = (r: Awaited<ReturnType<DieuPhoiTay['chay']>>) => (r && r.ok ? JSON.stringify([r.toa.matBang, r.toa.congNang ?? null, r.toa.dtxdM2]) : JSON.stringify(r));

describe('điều phối thao tác tay chạy nền (Web Worker)', () => {
  it('kết quả qua worker y hệt chạy đồng bộ; thư viện chỉ gửi một lần', async () => {
    const toa = toaTay('tm-u1');
    const { ds, dp } = taoBo();
    const hua = dp.chay('thangTuDongLai', c, toa);
    expect(dp.dangChay).toBe(true);
    expect(ds[0].thu[0].tv).toBeDefined();
    ds[0].chay();
    const r = await hua;
    expect(dp.dangChay).toBe(false);
    expect(ky(r)).toBe(ky(thangTuDongLai(toa, c)));
    const hua2 = dp.chay('thangTuDongLai', c, toa);
    expect(ds[0].thu[0].tv).toBeUndefined();
    expect(ds[0].thu[0].dl).toBeUndefined();
    ds[0].chay();
    expect(ky(await hua2)).toBe(ky(r));
  });

  it('lượt mới huỷ lượt cũ: lượt cũ trả null, worker cũ bị terminate, kết quả muộn của nó bị bỏ', async () => {
    const toa = toaTay('tm-u1');
    const { ds, dp } = taoBo();
    const cu = dp.chay('thangTuDongLai', c, toa);
    const moi = dp.chay('thangTuDongLai', c, toa);
    expect(await cu).toBeNull();
    expect(ds[0].daHuy).toBe(true);
    expect(dp.soLanHuy).toBe(1);
    expect(ds[1].thu[0].tv).toBeDefined(); // worker mới: gửi lại thư viện
    ds[0].chay(); // kết quả muộn của worker đã huỷ: không ảnh hưởng
    expect(dp.dangChay).toBe(true);
    ds[1].chay();
    expect(ky(await moi)).toBe(ky(thangTuDongLai(toa, c)));
  });

  it('huy() khi thao tác khác bắt đầu: promise trả null, không còn chạy', async () => {
    const { dp } = taoBo();
    const h = dp.chay('thangTuDongLai', c, toaTay('tm-u1'));
    dp.huy();
    expect(await h).toBeNull();
    expect(dp.dangChay).toBe(false);
  });

  it('worker lỗi thì chạy đồng bộ cho đúng kết quả', async () => {
    const toa = toaTay('tm-u1');
    const { ds, dp } = taoBo();
    const h = dp.chay('thangTuDongLai', c, toa);
    ds[0].chay(true);
    expect(ky(await h)).toBe(ky(thangTuDongLai(toa, c)));
  });

  it('không có Worker (node) thì chạy đồng bộ, trả ngay', async () => {
    const dp = new DieuPhoiTay(() => null);
    const toa = toaTay('tm-u1');
    const h = dp.chay('thangTuDongLai', c, toa);
    expect(dp.dangChay).toBe(false);
    expect(ky(await h)).toBe(ky(thangTuDongLai(toa, c)));
  });
});
