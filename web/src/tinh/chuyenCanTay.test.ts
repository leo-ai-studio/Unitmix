import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { mauToa } from './canThem';
import { demCan } from './coCau';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { apMatBang, matBangTang, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, viTriCan } from './matBang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
import { chuyenCanTay } from './thaoTacTay';

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

const mauGoc = (id: string) => tv.toa.get(id) as unknown as ToaMB;
const toaThu = (id: string): ToaDat => tuChinhToa({ id: 't', loId: 'l', mauId: id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} }, mauGoc(id), tv, dl);
const hien = (toa: ToaDat) => {
  const mau = mauToa(tv, toa) as ToaMB, mb = matBangTang(toa, mau, dl, null), bc = boCucTang(toa, null);
  return { bc, vts: viTriCan(apMatBang(mau, mb, dl), tv, bc) };
};
const soCan = (toa: ToaDat) => Object.values(demCan({ toa: [toa] } as never, tv)[toa.id] ?? {}).reduce((a, b) => a + b, 0);

describe('Chuyển căn sang dãy khác (kéo thả căn lên căn ở mặt khác)', () => {
  it.each(['xh-l2', 'tm-z1', 'tm-i1'])('%s: số căn tổng giữ nguyên, dãy đích +1 / dãy gốc -1, mặt cùng dãy không chuyển', (id) => {
    const t0 = toaThu(id), h0 = hien(t0);
    const theoMat = (vts: ReturnType<typeof hien>['vts'], toa: ToaDat) => {
      const bc = boCucTang(toa, null);
      const d: Record<number, number> = {};
      for (const v of vts) if ((bc.congNang?.[v.khoa] ?? 'can') === 'can') d[v.matIdx] = (d[v.matIdx] ?? 0) + 1;
      return d;
    };
    const a = h0.vts.find((v) => h0.vts.some((u) => u.matIdx !== v.matIdx))!;
    const cungMat = h0.vts.find((v) => v.matIdx === a.matIdx && v.khoa !== a.khoa)!;
    expect(chuyenCanTay(t0, null, a, cungMat, false, c).ok).toBe(false);
    let thanhCong = 0;
    for (const b of h0.vts.filter((v) => v.matIdx !== a.matIdx)) for (const truoc of [false, true]) {
      const r = chuyenCanTay(t0, null, a, b, truoc, c);
      if (!r.ok) continue;
      thanhCong++;
      expect(soCan(r.toa)).toBe(soCan(t0));
      const d1 = theoMat(hien(r.toa).vts, r.toa), d0 = theoMat(h0.vts, t0);
      expect((d1[b.matIdx] ?? 0)).toBe((d0[b.matIdx] ?? 0) + 1);
      expect((d1[a.matIdx] ?? 0)).toBe((d0[a.matIdx] ?? 0) - 1);
    }
    expect(thanhCong).toBeGreaterThan(0);
  });
});
