/**
 * Công cụ tay màn Tầng (app cũ tMove · tAdd · tAddStair · tDel · mirrorSel · nhXoa; QT-8 · QT-10 · QT-30 · QT-69 · QT-102) trên mẫu
 * thật: mỗi thao tác chạy lại tự chỉnh, không đè / khe mới (tinh/khe.ts), số căn / DTXD tính lại; chỗ không hợp lệ thì trả lý do.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { layMau } from '../thu/layMau';
import { mauToa } from './canThem';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { apMatBang, chupThangTay, cungThang, doDeKhe, matBangCua, matBangTang, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, matDaDon, viTriCan } from './matBang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
import { dsMauDoiCan, nhanMauCan } from './doiCan';
import { doiChoTay, doiThangTay, latTay, latThangTay, mauThem, themCanTay, themThangTay, xoaCanTay, xoaThangTay, type KetQuaTay } from './thaoTacTay';
import { demCan } from './coCau';
import { duocDatVaoO } from './quyTacViTriCan';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const idLoi = (b: string) => 'loi-' + b.replace(/^x_/, '').replace(/_/g, '-');
const dl: DuLieuMB = { loi: new Map(), cuaCan: {} };
for (const t of toaDs) for (const m of (t as unknown as ToaMB).mat) for (const q of m.phan_tu)
  if (q.loai !== 'can' && !dl.loi.has(q.block) && existsSync(new URL(`loi/${idLoi(q.block)}.json`, lib))) dl.loi.set(q.block, doc<HinhLoiMB>(`loi/${idLoi(q.block)}.json`));
dl.loi.set('x_tb_n2', doc<HinhLoiMB>('loi/loi-tb-n2.json')); // thang N2 (QT-63) — mẫu chỉ chèn N3
for (const c of canDs) dl.cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);
const c = { tv, dl };

const mauGoc = (id: string) => tv.toa.get(id) as unknown as ToaMB;
const toaThu = (id: string, them: Partial<ToaDat> = {}): ToaDat => {
  const t: ToaDat = { id: 't', loId: 'l', mauId: id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {}, ...them };
  return tuChinhToa(t, mauGoc(id), tv, dl);
};
/** Mẫu hiệu dụng + vị trí căn (có bố cục) của tầng `k`. */
const hien = (toa: ToaDat, k: number | null = null) => {
  const mau = mauToa(tv, toa) as ToaMB, mb = matBangTang(toa, mau, dl, k), bc = boCucTang(toa, k);
  const vts = viTriCan(applied(mau, mb), tv, bc);
  return { mau, mb, bc, vts, deKhe: doDeKhe(mau, mb, dl, tv, bc) };
};
const applied = (mau: ToaMB, mb: NonNullable<ToaDat['matBang']>) => apMatBang(mau, mb, dl);
const soCan = (toa: ToaDat) => Object.values(demCan({ toa: [toa] } as never, tv)[toa.id] ?? {}).reduce((a, b) => a + b, 0);
const ok = (r: KetQuaTay): ToaDat => { if (!r.ok) throw new Error(`không áp được: ${r.lyDo} ${r.chiTiet ?? ''}`); return r.toa; };

describe('Công cụ tay màn Tầng — mẫu thật', () => {
  it('chụp thang đặt tay tái lập đúng tập thang PC-11 (lần sửa thang đầu không làm mất thang)', () => {
    for (const id of ['tm-t2', 'tm-i1', 'tm-l1']) {
      const t0 = toaThu(id), m = mauGoc(id), mb0 = matBangCua(t0, m, dl);
      const t1 = tuChinhToa({ ...t0, thangTay: chupThangTay(m, mb0, dl) }, m, tv, dl);
      const mb1 = matBangCua(t1, m, dl);
      expect(mb1.thangBo.length, id).toBe(mb0.thangBo.length);
      for (const t of mb0.thangBo) expect(mb1.thangBo.some((u) => cungThang(u, t)), `${id} ${t.khoa}`).toBe(true);
      expect(mb1.baoCao!.quyTac.find((q) => q.ma === 'PC-11')!.ghiChu).toMatch(/thang đặt tay/);
    }
  });

  it('Thêm thang bộ sau căn đang chọn (QT-10 · ô 3.000 mm): +1 thang, dãy dài ra, 0 đè mới; PC-11 không dời thang tay', () => {
    // tm-l1 sau PC-11 còn 2 thang (mặc định 2 — thang thứ 3 chỉ khi cần); tòa đã 3 thang thì chặn (test thangBo.test.ts)
    const t0 = toaThu('tm-l1'), h0 = hien(t0);
    expect(h0.mb.thangBo.length).toBe(2);
    // căn đầu tiên có thêm được (đoạn có đầu tự do)
    let r: KetQuaTay | null = null;
    for (const v of h0.vts) { r = themThangTay(t0, v.matIdx, v.khoa, c); if (r.ok) break; }
    const t1 = ok(r!), h1 = hien(t1);
    expect(h1.mb.thangBo.length).toBe(h0.mb.thangBo.length + 1);
    expect(h1.mb.thangBo.some((t) => t.khoa === 'tay1' && t.rong === 3000)).toBe(true);
    expect(h1.deKhe.de).toBeLessThanOrEqual(h0.deKhe.de);
    expect(t1.thangTay?.them.some((e) => e.khoa === 'tay1')).toBe(true);
    // chạy lại tự chỉnh (vd sau đổi căn khác) vẫn giữ thang tay đúng chỗ
    const t2 = tuChinhToa(t1, mauGoc('tm-l1'), tv, dl);
    for (const t of h1.mb.thangBo) expect(matBangCua(t2, mauGoc('tm-l1'), dl).thangBo.some((u) => cungThang(u, t))).toBe(true);
  });

  it('Lật gương thang bộ: sx đảo, số thang / vị trí ô giữ nguyên; lật lại về như cũ', () => {
    for (const id of ['tm-i1', 'tm-l1']) {
      const t0 = toaThu(id), th = hien(t0).mb.thangBo[0];
      const t1 = ok(latThangTay(t0, th.khoa, c)), h1 = hien(t1), s1 = h1.mb.thangBo.find((x) => x.khoa === th.khoa)!;
      expect(s1.sx, id).toBe(-th.sx);
      expect(h1.mb.thangBo.length, id).toBe(hien(t0).mb.thangBo.length);
      expect(Math.abs(s1.a0 - th.a0), id).toBeLessThan(1);
      const s2 = hien(ok(latThangTay(t1, th.khoa, c))).mb.thangBo.find((x) => x.khoa === th.khoa)!;
      expect(s2.sx, id).toBe(th.sx);
    }
    expect(latThangTay(toaThu('tm-i1'), 'khong-co', c).ok).toBe(false);
  });

  it('Đổi căn: mẫu cùng nhóm / vị trí / chiều sâu, nhãn ngắn loại-mã-sâuxrộng', () => {
    const m2 = tv.can.get('tm-1pn-m2')!;
    expect(nhanMauCan(m2)).toBe('1pn-m2-8500x6000');
    const ds = dsMauDoiCan(tv, 'tm-1pn-m2');
    expect(ds.length).toBeGreaterThan(2);
    expect(ds.some((x) => x.id === 'tm-2pn-m2')).toBe(true);
    for (const x of ds) { expect(x.nhom).toBe('tm'); expect(x.vi_tri).toBe('giua'); expect(x.sau_mm).toBe(m2.sau_mm); expect(x.id.includes('~')).toBe(false); }
    expect(ds.some((x) => x.id.startsWith('xh-') || x.vi_tri === 'goc')).toBe(false);
    expect(dsMauDoiCan(tv, 'khong-co')).toEqual([]);
  });

  it('Xoá thang bộ: giữ ≥ 2 thang như app cũ — còn 2 thì chặn', () => {
    let t = toaThu('tm-t2');
    const n0 = hien(t).mb.thangBo.length, de0 = hien(t).deKhe.de;
    expect(n0).toBe(3);
    let xoa = false;
    for (const th of hien(t).mb.thangBo) { const r = xoaThangTay(t, th.khoa, c); if (r.ok) { t = r.toa; xoa = true; break; } }
    expect(xoa).toBe(true);
    const h = hien(t);
    expect(h.mb.thangBo.length).toBe(2);
    // không thêm đè (tm-t2 tự chỉnh sẵn có 1 chỗ căn chồng lõi 215 mm khi không bật tự gỡ căn vượt cự ly)
    expect(h.deKhe.de).toBeLessThanOrEqual(de0);
    const r2 = xoaThangTay(t, h.mb.thangBo[0].khoa, c);
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.lyDo).toBe('it_thang');
  });

  it('Dời thang bộ (kéo thang thả sau căn khác): thang đổi chỗ, số thang giữ nguyên', () => {
    const t0 = toaThu('tm-i1'), h0 = hien(t0), th = h0.mb.thangBo[0];
    let r: KetQuaTay | null = null;
    for (const v of h0.vts.filter((x) => x.matIdx === th.matIdx)) { r = doiThangTay(t0, th.khoa, v.matIdx, v.khoa, c); if (r.ok) break; }
    const t1 = ok(r!), h1 = hien(t1);
    expect(h1.mb.thangBo.length).toBe(h0.mb.thangBo.length);
    const sau = h1.mb.thangBo.find((x) => x.khoa === th.khoa)!;
    expect(Math.abs(sau.a0 - th.a0)).toBeGreaterThan(1);
    expect(h1.deKhe.de).toBeLessThanOrEqual(h0.deKhe.de);
  });

  it('Xoá căn (QT-69 · QT-30): −1 căn mỗi tầng, ô bỏ, dãy co lại, 0 đè; tầng riêng chỉ áp tầng đó', () => {
    const t0 = toaThu('tm-i1'), h0 = hien(t0), n0 = soCan(t0);
    let r: KetQuaTay | null = null, khoa = '';
    for (const v of h0.vts) { r = xoaCanTay(t0, null, [v.khoa], c); if (r.ok) { khoa = v.khoa; break; } }
    const t1 = ok(r!), h1 = hien(t1);
    expect(h1.mb.boCan).toContain(khoa);
    expect(h1.vts.length).toBe(h0.vts.length - 1);
    expect(soCan(t1)).toBe(n0 - 24);
    expect(h1.deKhe.de).toBe(0);
    // tầng 5 riêng
    const r5 = xoaCanTay(t0, [5], [khoa], c);
    const t5 = ok(r5);
    expect(soCan(t5)).toBe(n0 - 1);
    expect(hien(t5, 5).mb.boCan).toContain(khoa);
    expect(hien(t5, null).mb.boCan ?? []).not.toContain(khoa);
  });

  it('Kéo đổi chỗ hai căn khác loại trong dãy (QT-8): mẫu căn đổi cho nhau, dồn khít, 0 đè / khe mới', () => {
    const t0 = toaThu('tm-i1'), h0 = hien(t0);
    const ids = new Map(h0.vts.map((v) => [v.khoa, h0.bc.canViTri?.[v.khoa] ?? v.canGocId]));
    // hai căn liền nhau cùng mặt, khác mẫu
    let cap: [typeof h0.vts[0], typeof h0.vts[0]] | null = null;
    for (const a of h0.vts) for (const b of h0.vts) if (!cap && a.matIdx === b.matIdx && a.khoa < b.khoa && ids.get(a.khoa) !== ids.get(b.khoa) && duocDatVaoO(b.canGocId, ids.get(a.khoa)!) && duocDatVaoO(a.canGocId, ids.get(b.khoa)!)) cap = [a, b];
    expect(cap).not.toBeNull();
    const [a, b] = cap!;
    const r = doiChoTay(t0, null, a, b, c);
    const t1 = ok(r), bc1 = boCucTang(t1, null);
    expect(bc1.canViTri?.[a.khoa] ?? a.canGocId).toBe(ids.get(b.khoa));
    expect(bc1.canViTri?.[b.khoa] ?? b.canGocId).toBe(ids.get(a.khoa));
    expect(hien(t1).deKhe.de).toBeLessThanOrEqual(h0.deKhe.de);
    expect(soCan(t1)).toBe(soCan(t0));
  });

  it('Lật gương một căn (⇄): hướng căn + phía cửa (pccc) đảo; lật lại về như cũ', () => {
    const t0 = toaThu('tm-t2'), h0 = hien(t0), v = h0.vts[0];
    const t1 = ok(latTay(t0, null, [v.khoa], c)), h1 = hien(t1);
    expect(h1.vts.find((x) => x.khoa === v.khoa)!.guong).toBe(!v.guong);
    const q = (h: typeof h0) => matDaDon(applied(h.mau, h.mb), h.bc, tv).flatMap((m) => m.phan_tu).find((x) => x.khoa === v.khoa)!;
    expect(Math.sign(q(h1).sx)).toBe(-Math.sign(q(h0).sx));
    const t2 = ok(latTay(t1, null, [v.khoa], c));
    expect(t2.latO).toBeUndefined();
  });

  it('Hàng loạt (QT-102): lật 3 căn và xoá 2 căn trong một lần gọi', () => {
    const t0 = toaThu('tm-i1'), h0 = hien(t0);
    const ks = h0.vts.slice(0, 3).map((v) => v.khoa);
    const t1 = ok(latTay(t0, null, ks, c));
    expect(Object.keys(t1.latO ?? {}).sort()).toEqual([...ks].sort());
    // xoá 2 căn ở đầu dãy tự do
    const n0 = soCan(t0);
    let done = false;
    for (let i = 0; i + 1 < h0.vts.length && !done; i++) {
      const a = h0.vts[i], b = h0.vts[i + 1];
      if (a.matIdx !== b.matIdx) continue;
      const r = xoaCanTay(t0, null, [a.khoa, b.khoa], c);
      if (r.ok) { expect(soCan(r.toa)).toBe(n0 - 48); done = true; }
    }
    expect(done).toBe(true);
  });

  it('Thêm căn sau căn đang chọn: +1 căn mỗi tầng, dãy dài ra ở đầu tự do, DTXD tăng; tầng riêng chỉ tầng đó', () => {
    const t0 = toaThu('tm-i1'), h0 = hien(t0), n0 = soCan(t0);
    let r: KetQuaTay | null = null, v0 = h0.vts[0];
    for (const v of h0.vts) { r = themCanTay(t0, null, v, mauThem(tv, h0.bc.canViTri?.[v.khoa] ?? v.canGocId), c); if (r.ok) { v0 = v; break; } }
    const t1 = ok(r!), h1 = hien(t1);
    expect(h1.vts.length).toBe(h0.vts.length + 1);
    expect(soCan(t1)).toBe(n0 + 24);
    expect(t1.dtxdM2 ?? 0).toBeGreaterThan(t0.dtxdM2 ?? h0.mau.dtxd_m2);
    expect(h1.deKhe.de).toBe(0);
    const t5 = ok(themCanTay(t0, [5], v0, mauThem(tv, h0.bc.canViTri?.[v0.khoa] ?? v0.canGocId), c));
    expect(soCan(t5)).toBe(n0 + 1);
  });

  it('Thêm căn ở cánh chữ U hở ra sân trong (tm-u1): chỉ dãy đó dài ra, cánh bên kia sân đứng yên, 0 đè / khe mới', () => {
    const t0 = toaThu('tm-u1'), h0 = hien(t0), v = h0.vts.find((x) => x.khoa === '2:3')!;
    const r = themCanTay(t0, null, v, h0.bc.canViTri?.[v.khoa] ?? v.canGocId, c);
    const t1 = ok(r), h1 = hien(t1);
    expect(h1.deKhe.de).toBeLessThanOrEqual(h0.deKhe.de);
    expect(h1.deKhe.mm).toBeLessThanOrEqual(h0.deKhe.mm + 200);
    // căn mặt 2 ở xa ô chọn (cánh kia của sân) không dời
    const mat2 = h0.vts.filter((x) => x.matIdx === 2).sort((a, b) => a.a0 - b.a0);
    // dãy liền chứa ô chọn (khe ≤ 600 mm) — ngoài dãy đó là cánh bên kia sân
    let i0 = mat2.indexOf(v), i1 = i0;
    while (i0 > 0 && mat2[i0].a0 - mat2[i0 - 1].a1 <= 600) i0--;
    while (i1 + 1 < mat2.length && mat2[i1 + 1].a0 - mat2[i1].a1 <= 600) i1++;
    const xa = [...mat2.slice(0, i0), ...mat2.slice(i1 + 1)];
    expect(xa.length).toBeGreaterThan(0);
    for (const x of xa) expect(Math.abs(h1.vts.find((y) => y.khoa === x.khoa)!.a0 - x.a0), x.khoa).toBeLessThan(1);
  });

  it('Quét mẫu: thêm thang / xoá căn / lật — nhận thì không đè mới, không nhận thì có lý do', () => {
    const ds = layMau([...tv.toa.values()].filter((m) => Array.isArray((m as unknown as ToaMB).mat)).map((m) => m.id), 6);
    for (const id of ds.slice(0, 6)) {
      const t0 = toaThu(id), h0 = hien(t0), v = h0.vts[0];
      if (!v) continue;
      for (const r of [themThangTay(t0, v.matIdx, v.khoa, c), xoaCanTay(t0, null, [v.khoa], c), latTay(t0, null, [v.khoa], c)]) {
        if (r.ok) expect(hien(r.toa).deKhe.de, id).toBeLessThanOrEqual(h0.deKhe.de);
        else expect(r.lyDo, id).toBeTruthy();
      }
    }
  }, 120000);
});
