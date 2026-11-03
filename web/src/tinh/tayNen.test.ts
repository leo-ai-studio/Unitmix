import { describe, expect, it } from 'vitest';
import { napThuVien, toaThu } from '../thu/thuVienThat';
import { matBangCua, tuChinhToa, type ToaMB } from './loiThang';
import { chayPhep, chayTay, datTam, DieuPhoiTay, goTam, hinhNhanh, layTam, phepTay, type PhepTay, type ThuTay, type ThuTayXong, type WorkerTay } from './tayNen';
import { hatCua, phepNgauNhien, rng } from './phaHoaiChay';
import { congNangTai, viTriCan } from './matBang';
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

// Đường chạy thao tác tay (CongCuTang `useChay`) qua worker: mọi phép, kết quả cuối phải y hệt bản đồng bộ (bài phá hoại chạy
// `chayPhep` — cùng bảng phép — là chuẩn); lượt mới huỷ lượt cũ; mặt bằng tạm chỉ lượt đặt nó gỡ được.
describe('điều phối mọi phép tay qua worker', () => {
  const qua = async (ph: PhepTay) => {
    const { ds, dp } = taoBo();
    const h = dp.chayPhep(ph, c);
    ds[0].chay();
    return h;
  };
  const kyDu = (r: unknown) => JSON.stringify(r);

  it.each(['xh-z4', 'tm-t2', 'tm-v4'])('%s: chuỗi phép ngẫu nhiên (như phá hoại) qua worker y hệt đồng bộ', async (id) => {
    const r = rng(hatCua(id) + 909);
    let toa = tuChinhToa(toaThu(id), tv.toa.get(id) as unknown as ToaMB, tv, dl);
    let soPhep = 0;
    for (let b = 0; b < 8; b++) {
      const p = phepNgauNhien(toa, r);
      if (!p || p.ph === 'donKhit') continue;
      const dongBo = chayPhep(p.ph, c), nen = await qua(p.ph);
      expect(kyDu(nen), `${id} #${b} ${p.op}`).toBe(kyDu(dongBo));
      soPhep++;
      if (dongBo.ok) toa = dongBo.toa;
    }
    expect(soPhep).toBeGreaterThan(3);
  }, 120_000);

  it('PA mới chưa có mặt bằng lưu: xoá căn / thêm thang qua worker y hệt đồng bộ', async () => {
    for (const id of ['xh-z4', 'tm-t2']) {
      const toa = toaThu(id), mau = tv.toa.get(id) as unknown as ToaMB;
      const vt = viTriCan(mau, tv).filter((v) => congNangTai(v.khoa, toa) === 'can');
      for (const ph of [phepTay('xoaCanTay', toa, null, [vt[vt.length - 1].khoa]), phepTay('themThangTay', toa, vt[2].matIdx, vt[2].khoa), phepTay('latTay', toa, null, [vt[1].khoa])]) {
        expect(kyDu(await qua(ph)), `${id} ${ph.ten}`).toBe(kyDu(chayPhep(ph, c)));
      }
    }
  }, 120_000);

  it('lượt mới (phép khác) huỷ lượt cũ: lượt cũ trả null, lượt mới đúng kết quả', async () => {
    const toa = tuChinhToa(toaThu('tm-u1'), tv.toa.get('tm-u1') as unknown as ToaMB, tv, dl);
    const mau = tv.toa.get('tm-u1') as unknown as ToaMB;
    const vt = viTriCan(mau, tv).filter((v) => congNangTai(v.khoa, toa) === 'can');
    const { ds, dp } = taoBo();
    const a = phepTay('xoaCanTay', toa, null, [vt[0].khoa]), b = phepTay('latTay', toa, null, [vt[1].khoa]);
    const ha = dp.chayPhep(a, c);
    expect(dp.tenDangChay).toBe('xoaCanTay');
    const hb = dp.chayPhep(b, c);
    expect(await ha).toBeNull();
    expect(ds[0].daHuy).toBe(true);
    ds[1].chay();
    expect(kyDu(await hb)).toBe(kyDu(chayPhep(b, c)));
    expect(dp.dangChay).toBe(false);
  });

  it('hình học nhanh: xoá / lật / đổi chỗ đổi ô ngay (chưa tự chỉnh), phép thang giữ mặt bằng cũ', () => {
    const toa = tuChinhToa(toaThu('tm-u1'), tv.toa.get('tm-u1') as unknown as ToaMB, tv, dl);
    const vt = viTriCan(tv.toa.get('tm-u1') as unknown as ToaMB, tv).filter((v) => congNangTai(v.khoa, toa) === 'can');
    const xoa = hinhNhanh(phepTay('xoaCanTay', toa, null, [vt[0].khoa]))!;
    expect(congNangTai(vt[0].khoa, xoa)).toBe('bo');
    expect(xoa.matBang).toBe(toa.matBang);
    expect(JSON.stringify(hinhNhanh(phepTay('latTay', toa, null, [vt[0].khoa])))).not.toBe(JSON.stringify(toa));
    expect(hinhNhanh(phepTay('doiChoTay', toa, null, vt[0], vt[1]))).not.toBeNull();
    expect(hinhNhanh(phepTay('xoaThangTay', toa, 'x'))).toBeNull();
    expect(hinhNhanh(phepTay('thangTuDongLai', toa))).toBeNull();
  });

  it('khởi động sẵn worker: chuyển thư viện một lần, không tính gì; lượt thật sau đó không chép lại', async () => {
    const toa = tuChinhToa(toaThu('tm-u1'), tv.toa.get('tm-u1') as unknown as ToaMB, tv, dl);
    const { ds, dp } = taoBo();
    dp.khoiDong(c);
    expect(ds.length).toBe(1);
    expect(ds[0].thu[0].tv).toBeDefined();
    expect(dp.dangChay).toBe(false); // khởi động không phải lượt chạy
    ds[0].chay(); // worker trả id 0: bỏ qua, không treo
    dp.khoiDong(c); // đã có đủ: không gửi lại
    expect(ds[0].thu.length).toBe(0);
    const ph = phepTay('hanhLangTuDong', { ...toa, hanhLangTay: { '0': [1000, 0] } });
    const h = dp.chayPhep(ph, c);
    expect(ds.length).toBe(1); // dùng lại worker nóng
    expect(ds[0].thu[0].tv).toBeUndefined();
    ds[0].chay();
    expect(kyDu(await h)).toBe(kyDu(chayPhep(ph, c)));
  });

  it('mặt bằng tạm: chỉ lượt đặt nó gỡ được; tòa trong PA đổi thì không hiện', () => {
    const goc = toaThu('tm-u1'), t1 = { ...goc, x: 1 }, t2 = { ...goc, x: 2 };
    const a = datTam(goc, t1);
    expect(layTam(goc)).toBe(t1);
    const b = datTam(goc, t2); // lượt mới
    goTam(a); // lượt cũ (bị huỷ) gỡ: không đụng tạm của lượt mới
    expect(layTam(goc)).toBe(t2);
    expect(layTam({ ...goc })).toBeNull();
    goTam(b);
    expect(layTam(goc)).toBeNull();
  });
});
