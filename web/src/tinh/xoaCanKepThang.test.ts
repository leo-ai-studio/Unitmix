/**
 * Căn kẹp giữa lõi và thang bộ (V2 mặt 2: lõi | 1PN | thang | …): xóa / đổi / thêm căn được — thang và các căn phía đầu tự do dời
 * theo, đầu tự do ngắn lại / dài ra (trước đây "để lại khe 6000 mm" và không đổi được).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { mauToa } from './canThem';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { apMatBang, doDeKhe, matBangTang, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, viTriCan } from './matBang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
import { themCanTay, xoaCanTay, type KetQuaTay } from './thaoTacTay';
import { tuChinhSauSua } from './loiThang';
import { doiCanTaiViTri } from './doiCan';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const idLoi = (b: string) => 'loi-' + b.replace(/^x_/, '').replace(/_/g, '-');
const dl: DuLieuMB = { loi: new Map(), cuaCan: {} };
for (const t of toaDs) for (const m of (t as unknown as ToaMB).mat) for (const q of m.phan_tu)
  if (q.loai !== 'can' && !dl.loi.has(q.block) && existsSync(new URL(`loi/${idLoi(q.block)}.json`, lib))) dl.loi.set(q.block, doc<HinhLoiMB>(`loi/${idLoi(q.block)}.json`));
dl.loi.set('x_tb_n2', doc<HinhLoiMB>('loi/loi-tb-n2.json'));
for (const c of canDs) dl.cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);
const c = { tv, dl };
const toaThu = (id: string): ToaDat => tuChinhToa({ id: 't', loId: 'l', mauId: id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} }, tv.toa.get(id) as unknown as ToaMB, tv, dl);
const viTri = (toa: ToaDat, kh: string) => {
  const mau = mauToa(tv, toa) as ToaMB, mb = matBangTang(toa, mau, dl, null);
  return { vt: viTriCan(apMatBang(mau, mb, dl), tv, boCucTang(toa, null)).find((v) => v.khoa === kh), thang: mb.thangBo.map((t) => `${t.khoa}@${Math.round(t.a0)}`), de: doDeKhe(mau, mb, dl, tv, boCucTang(toa, null)) };
};
const ok = (r: KetQuaTay): ToaDat => { if (!r.ok) throw new Error(`không áp được: ${r.lyDo} ${r.chiTiet ?? ''}`); return r.toa; };

describe('căn kẹp giữa lõi và thang bộ (tm-v2, mặt 2)', () => {
  const toa = toaThu('tm-v2');
  it('mẫu gốc: mặt 2 có căn 2:0 cạnh lõi, thang 2:1 liền sau', () => {
    const a = viTri(toa, '2:0');
    expect(a.vt).toBeDefined();
    expect(a.thang.some((t) => t.startsWith('2:1@'))).toBe(true);
  });
  it('xóa căn 2:0: được, thang dời về phía lõi, không để khe', () => {
    const truoc = viTri(toa, '2:0'), t0 = Number(truoc.thang.find((t) => t.startsWith('2:1@'))!.split('@')[1]);
    const r = xoaCanTay(toa, null, ['2:0'], c);
    expect(r.ok, r.ok ? '' : `${r.lyDo} ${r.chiTiet ?? ''}`).toBe(true);
    const sau = viTri(ok(r), '2:3');
    const t1 = Number(sau.thang.find((t) => t.startsWith('2:1@'))!.split('@')[1]);
    expect(t1).toBeLessThan(t0); // thang dời về phía lõi
    expect(sau.de.mm ?? 0).toBeLessThan(250);
  });
});

describe('thêm / đổi căn kẹp giữa lõi và thang', () => {
  const toa = toaThu('tm-v2');
  const vt0 = () => { const mau = mauToa(tv, toa) as ToaMB, mb = matBangTang(toa, mau, dl, null); return viTriCan(apMatBang(mau, mb, dl), tv, boCucTang(toa, null)).find((v) => v.khoa === '2:0')!; };
  it('thêm căn cạnh căn kẹp: được', () => {
    const r = themCanTay(toa, null, vt0(), 'tm-1pn-m2', c, false);
    expect(r.ok).toBe(true);
  });
  it('trạng thái PA thật (đã xóa 2:2): xóa / đổi / thêm căn 2:0', () => {
    const t1 = ok(xoaCanTay(toa, null, ['2:2'], c));
    const mau = mauToa(tv, t1) as ToaMB, mb = matBangTang(t1, mau, dl, null), vts = viTriCan(apMatBang(mau, mb, dl), tv, boCucTang(t1, null));
    const v0 = vts.find((v) => v.khoa === '2:0')!;
    const rx = xoaCanTay(t1, null, ['2:0'], c);
    const rt = themCanTay(t1, null, v0, 'tm-1pn-m2', c, false);
    expect(rt.ok).toBe(true);
    // đổi căn kẹp sang mẫu khác bề ngang (hẹp hơn / rộng hơn): tự chỉnh không chặn, thang + cụm phía đầu tự do trượt theo
    for (const moi of ['tm-stu-m1', 'tm-2pn-m2']) {
      const r = tuChinhSauSua(t1, doiCanTaiViTri(t1, v0, moi, vts, false), mau, tv, dl);
      expect(r.chan, moi).toEqual([]);
      expect((r.toa as ToaDat).canViTri?.['2:0'], moi).toBe(moi);
    }
    expect(rx.ok).toBe(true);
  });
});
