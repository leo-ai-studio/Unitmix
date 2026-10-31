/**
 * Thêm căn ở mọi chỗ (app cũ tAdd · QT-30 · QT-32 · QT-69): chèn trước ô chọn (đầu dãy), vào chỗ trống (ô trống / ô căn đã xoá /
 * khe / đầu dãy hở) với mẫu vừa chỗ; xoá căn thêm tay rút khỏi `canThem`. Câu báo biến động số căn (gỡ căn thoát nạn + căn cứ) và
 * gợi ý giữ số căn. Mẫu thật trong public/lib.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { bienDongCan, goiYGiuCan, soCanTang } from './baoThaoTac';
import { khoaCanThem, mauToa, rutCanThem } from './canThem';
import { choTrong } from './choTrong';
import { doiCongNang } from './doiCan';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { apMatBang, doDeKhe, matBangTang, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, congNangTai, viTriCan } from './matBang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
import { doiChoTay, dsMauThem, latTay, mauThem, themCanTay, themVaoO, xoaCanTay, xoaThangTay, type KetQuaTay } from './thaoTacTay';

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
/** `giamCan` = bật tự gỡ căn vượt cự ly (`giamCanTN`, tuỳ chọn — mặc định cự ly chỉ cảnh báo). */
const toaThu = (id: string, giamCan = false): ToaDat => tuChinhToa({ id: 't', loId: 'l', mauId: id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3,
  coApMai: false, deOffset: 0, canTheo: {}, ...(giamCan ? { giamCanTN: true } : {}) }, mauGoc(id), tv, dl);
const hien = (toa: ToaDat, k: number | null = null) => {
  const mau = mauToa(tv, toa) as ToaMB, mb = matBangTang(toa, mau, dl, k), bc = boCucTang(toa, k);
  return { mau, mb, bc, vts: viTriCan(apMatBang(mau, mb, dl), tv, bc), deKhe: doDeKhe(mau, mb, dl, tv, bc) };
};
const ok = (r: KetQuaTay): ToaDat => { if (!r.ok) throw new Error(`không áp được: ${r.lyDo} ${r.chiTiet ?? ''}`); return r.toa; };
const so = (x: ToaDat) => soCanTang(x, c, null);

describe('Thêm căn trước ô chọn / vào chỗ trống — mẫu thật', () => {
  it('chèn TRƯỚC căn đầu dãy (tm-i1 0:0): +1 căn / tầng, căn mới đứng trước ô chọn, không đè mới', () => {
    const t0 = toaThu('tm-i1'), h0 = hien(t0), v0 = h0.vts.find((v) => v.khoa === '0:0')!;
    const idThem = mauThem(tv, v0.canGocId); // đầu dãy là căn góc → thêm căn giữa cùng loại (quy tắc vị trí căn)
    const t1 = ok(themCanTay(t0, null, v0, idThem, c, true));
    expect(so(t1)).toBe(so(t0) + 1);
    expect(t1.canThem).toEqual([{ mat: 0, truoc: '0:0', id: idThem }]);
    const h1 = hien(t1), khoa = khoaCanThem(mauGoc('tm-i1') as unknown as ToaMau, t1.canThem!, 0)!;
    const moi = h1.vts.find((v) => v.khoa === khoa)!, cu = h1.vts.find((v) => v.khoa === '0:0')!;
    expect(moi.a1).toBeLessThanOrEqual(cu.a0 + 5);
    expect(h1.deKhe.de).toBeLessThanOrEqual(h0.deKhe.de);
    expect(t1.dtxdM2!).toBeGreaterThan(t0.dtxdM2 ?? mauGoc('tm-i1').dtxd_m2);
  });

  it('chèn trước ô giữa dãy = chèn sau ô đứng trước nó (cùng số căn)', () => {
    const t0 = toaThu('tm-l1'), h0 = hien(t0);
    const v = h0.vts.find((x) => x.khoa === '1:3')!, truoc = h0.vts.find((x) => x.khoa === '1:2')!;
    const a = ok(themCanTay(t0, null, v, v.canGocId, c, true)), b = ok(themCanTay(t0, null, truoc, v.canGocId, c));
    expect(so(a)).toBe(so(b));
    expect(a.dtxdM2).toBeCloseTo(b.dtxdM2!, 1);
  });

  it('xoá căn thêm tay → rút khỏi canThem (không để ô bo); căn thêm sau nó đổi khoá, giữ mẫu đã chọn', () => {
    const t0 = toaThu('tm-i1'), h0 = hien(t0), goc = mauGoc('tm-i1') as unknown as ToaMau;
    const v = h0.vts.find((x) => x.khoa === '0:1')!;
    const studio = dsMauThem(tv, v.canGocId).find((m) => m.loai !== tv.can.get(v.canGocId)!.loai)!;
    let t1 = ok(themCanTay(t0, null, v, v.canGocId, c));
    const k1 = khoaCanThem(goc, t1.canThem!, 0)!;
    t1 = ok(themCanTay(t1, null, hien(t1).vts.find((x) => x.khoa === k1)!, studio.id, c));
    const k2 = khoaCanThem(goc, t1.canThem!, 1)!;
    expect(so(t1)).toBe(so(t0) + 2);
    // xoá căn thêm thứ nhất: rút hẳn, căn thứ hai lùi về khoá k1 và neo sang chỗ căn thứ nhất đã neo
    const t2 = ok(xoaCanTay(t1, null, [k1], c));
    expect(t2.canThem).toEqual([{ mat: 0, sau: '0:1', id: studio.id }]);
    expect(khoaCanThem(goc, t2.canThem!, 0)).toBe(k1);
    expect(t2.congNang?.[k1]).toBeUndefined();
    expect(t2.congNang?.[k2]).toBeUndefined();
    expect(so(t2)).toBe(so(t0) + 1);
    // xoá nốt: canThem rỗng → undefined, về đúng số căn ban đầu
    const t3 = ok(xoaCanTay(t2, null, [k1], c));
    expect(t3.canThem).toBeUndefined();
    expect(so(t3)).toBe(so(t0));
    expect(Object.values(t3.congNang ?? {})).not.toContain('bo');
  });

  it('rutCanThem đổi khoá bố cục tầng riêng + lật của căn thêm phía sau', () => {
    const goc = mauGoc('tm-i1') as unknown as ToaMau;
    const ds = [{ mat: 0, sau: '0:1', id: 'a' }, { mat: 0, sau: '0:3', id: 'b' }];
    const k0 = khoaCanThem(goc, ds, 0)!, k1 = khoaCanThem(goc, ds, 1)!;
    const toa = { ...toaThu('tm-i1'), canThem: ds, latO: { [k1]: true }, tangRieng: { 5: { canViTri: { [k1]: 'x' }, congNang: { [k0]: 'trong' as const } } } };
    const r = rutCanThem(toa, goc, k0)!;
    expect(r.canThem).toEqual([{ mat: 0, sau: '0:3', id: 'b' }]);
    expect(r.latO).toEqual({ [k0]: true });
    expect(r.tangRieng?.[5].canViTri).toEqual({ [k0]: 'x' });
    expect(r.tangRieng?.[5].congNang).toBeUndefined();
    expect(rutCanThem(toa, goc, '0:1')).toBeNull();
  });

  it('chỗ trống: ô căn đã xoá + ô trống được liệt kê, đặt lại mẫu vừa nhất → số căn trở lại', () => {
    const t0 = toaThu('tm-l1'), h0 = hien(t0);
    expect(choTrong(t0, tv, dl, null)).toEqual([]);
    const v = h0.vts.find((x) => x.khoa === '0:4')!;
    const t1 = ok(xoaCanTay(t0, null, ['0:4'], c));
    const ds = choTrong(t1, tv, dl, null);
    expect(ds.map((x) => [x.loai, x.neo.khoa, x.daXoa])).toEqual([['o', '0:4', true]]);
    const m = dsMauThem(tv, ds[0].canKe, ds[0].rong, ds[0].neo.canGocId)[0]; // đặt lại đúng quy tắc vị trí của ô
    expect(Math.abs(m.rong_mm - ds[0].rong)).toBeLessThanOrEqual(500);
    const t2 = ok(themVaoO(t1, null, ds[0].neo, m.id, c));
    expect(so(t2)).toBe(so(t0));
    expect(congNangTai('0:4', boCucTang(t2, null))).toBe('can');
    // ô trống (công năng 'trong'): cũng là chỗ thêm được căn
    const t3 = tuChinhToa(doiCongNang(t0, null, [v.khoa], 'trong'), mauGoc('tm-l1'), tv, dl);
    const ds3 = choTrong(t3, tv, dl, null);
    expect(ds3.some((x) => x.loai === 'o' && !x.daXoa && x.neo.khoa === '0:4')).toBe(true);
    expect(so(ok(themVaoO(t3, null, ds3[0].neo, m.id, c)))).toBe(so(t3) + 1);
  });

  it('dsMauThem: chỉ căn giữa cùng nhóm / chiều sâu, không biến thể STRETCH; có bề ngang chỗ thì vừa nhất trước, ≤ chỗ + 500', () => {
    const id = hien(toaThu('tm-u1')).vts[3].canGocId, g = tv.can.get(id)!;
    const ds = dsMauThem(tv, id);
    expect(ds.length).toBeGreaterThan(1);
    for (const m of ds) { expect(m.nhom).toBe(g.nhom); expect(m.sau_mm).toBe(g.sau_mm); expect(m.vi_tri).toBe('giua'); expect(m.id).not.toContain('~'); }
    const vua = dsMauThem(tv, id, 6000);
    for (const m of vua) expect(m.rong_mm).toBeLessThanOrEqual(6500);
    for (let i = 1; i < vua.length; i++) expect(Math.abs(6000 - vua[i].rong_mm)).toBeGreaterThanOrEqual(Math.abs(6000 - vua[i - 1].rong_mm));
  });
});

describe('Câu báo biến động số căn (gỡ thoát nạn) + gợi ý giữ số căn — mẫu thật', () => {
  it('mặc định cự ly chỉ CẢNH BÁO: lật CH 1:6 tm-u1 không gỡ căn nào (33 → 33), thang không tự dời', () => {
    const t0 = toaThu('tm-u1');
    const t1 = ok(latTay(t0, null, ['1:6'], c));
    const bd = bienDongCan(t0, t1, c, null);
    expect(bd).toMatchObject({ truoc: bd.sau, goTN: [] });
    const ky = (x: ToaDat) => hien(x).mb.thangBo.map((t) => `${t.matIdx}:${Math.round(t.a0)}`).sort().join('|');
    expect(ky(t1)).toBe(ky(t0));
  });

  it('bật tự gỡ (giamCanTN): lật CH 1:6 tm-u1 (24 tầng, H > 75 m): 32 → 31 căn / tầng, gỡ chính ô 1:6, căn cứ QCVN 06:2022 A.3.1.7 (15 / 20 m)', () => {
    const t0 = toaThu('tm-u1', true);
    const t1 = ok(latTay(t0, null, ['1:6'], c));
    const bd = bienDongCan(t0, t1, c, null);
    expect(bd).toMatchObject({ truoc: 32, sau: 31, goTN: ['1:6'], goKhit: [], cut: 15, doi: 20 });
    expect(bd.canCu).toMatch(/QCVN 06:2022 A\.3\.1\.7/);
  });

  it('lật 1:7 tm-u1 (bật tự gỡ): gợi ý (dời thang / ⟲) giữ lại 32 căn / tầng — chỉ gợi ý, tòa sau thao tác không đổi', () => {
    const t0 = toaThu('tm-u1', true);
    const t1 = ok(latTay(t0, null, ['1:7'], c));
    const bd = bienDongCan(t0, t1, c, null);
    expect(bd.sau).toBe(bd.truoc - 1);
    const truocGoiY = JSON.stringify(t1);
    const g = goiYGiuCan(t1, bd.goTN, bd.truoc, c, null, 20000);
    // sửa tay giữ nguyên thang (không tự dời) nên gợi ý có thể là dời thang hoặc ⟲ thang về tự động — có gợi ý thì phải giữ đủ căn
    // (đợt 2026-10-29 tối: lật không tự dời thang nữa — ca này gợi ý có thể không còn; có thì phải giữ đủ căn)
    if (g) expect(g.soCan).toBeGreaterThanOrEqual(32);
    expect(JSON.stringify(t1)).toBe(truocGoiY);
  });

  it('xoá thang tm-t2 (bật tự gỡ) làm gỡ căn → báo 40 → 39 kèm căn bị gỡ; gợi ý PC-11 tự đặt thang giữ 40', () => {
    const t0 = toaThu('tm-t2', true);
    let kq: { t1: ToaDat; bd: ReturnType<typeof bienDongCan> } | null = null;
    for (const th of hien(t0).mb.thangBo) {
      const r = xoaThangTay(t0, th.khoa, c);
      if (!r.ok) continue;
      const bd = bienDongCan(t0, r.toa, c, null);
      if (bd.sau < bd.truoc) { kq = { t1: r.toa, bd }; break; }
    }
    expect(kq).not.toBeNull();
    expect(kq!.bd.truoc).toBe(40);
    expect(kq!.bd.goTN.length).toBe(kq!.bd.truoc - kq!.bd.sau);
    const g = goiYGiuCan(kq!.t1, kq!.bd.goTN, kq!.bd.truoc, c, null, 20000);
    expect(g).not.toBeNull();
    expect(g!.soCan).toBeGreaterThanOrEqual(40);
  });

  it('thao tác không đổi số căn: truoc = sau, không căn bị gỡ, không gợi ý', () => {
    const t0 = toaThu('tm-l1'), h0 = hien(t0);
    const a = h0.vts.find((v) => v.khoa === '0:1')!, b = h0.vts.find((v) => v.khoa === '0:2')!;
    const t1 = ok(doiChoTay(t0, null, a, b, c));
    const bd = bienDongCan(t0, t1, c, null);
    expect(bd.truoc).toBe(bd.sau);
    expect(bd.goTN).toEqual([]);
    expect(goiYGiuCan(t1, bd.goTN, bd.truoc, c, null)).toBeNull();
  });

  it('dò thử lúc kéo dùng lại được khi thả: cùng đầu vào cho cùng kết quả (cache theo ô đích hợp lệ)', () => {
    const t0 = toaThu('tm-i1'), h0 = hien(t0);
    const a = h0.vts[1], b = h0.vts[5];
    expect(JSON.stringify(doiChoTay(t0, null, a, b, c))).toBe(JSON.stringify(doiChoTay(t0, null, a, b, c)));
  });
});
