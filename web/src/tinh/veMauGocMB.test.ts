import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { mauToa } from './canThem';
import { demCan } from './coCau';
import { veMauGocMB } from './doiCan';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { apMatBang, matBangTang, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, viTriCan } from './matBang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
import { mauThem, themCanTay, xoaCanTay } from './thaoTacTay';

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

describe('Reset mặt bằng tòa về mẫu gốc', () => {
  it.each(['xh-l2', 'tm-l2', 'tm-i1'])('%s: sau nhiều sửa tay, reset cho đúng mặt bằng mẫu gốc (căn, thang, hành lang, nét bao)', (id) => {
    const t0 = toaThu(id), h0 = hien(t0);
    let t = t0;
    for (const v of h0.vts) { const r = themCanTay(t, null, v, mauThem(tv, h0.bc.canViTri?.[v.khoa] ?? v.canGocId), c); if (r.ok) { t = r.toa; break; } }
    const x = xoaCanTay(t, null, [hien(t).vts[1].khoa], c); if (x.ok) t = x.toa;
    t = tuChinhToa({ ...t, hanhLangTay: { '0': [0, 3000] }, congNang: { [h0.vts[0].khoa]: 'ky_thuat' } as ToaDat['congNang'] }, mauGoc(id), tv, dl);
    expect(JSON.stringify(t.matBang)).not.toBe(JSON.stringify(t0.matBang));
    const r = tuChinhToa(veMauGocMB(t), mauGoc(id), tv, dl);
    expect(JSON.stringify(r.matBang)).toBe(JSON.stringify(t0.matBang));
    expect(r.canViTri).toBeUndefined(); expect(r.hanhLangTay).toBeUndefined(); expect(r.congNang).toBeUndefined(); expect(r.canThem).toBeUndefined();
    expect(soCan(r)).toBe(soCan(t0));
    expect({ x: r.x, y: r.y, gocDo: r.gocDo, soTangDH: r.soTangDH }).toEqual({ x: t0.x, y: t0.y, gocDo: t0.gocDo, soTangDH: t0.soTangDH });
  });
});
