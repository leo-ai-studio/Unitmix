/**
 * Thử ngẫu nhiên từng mẫu tòa (tinh/thuMauToa.ts): thêm / bớt, đảo, STRETCH, thang, co kéo hành lang, thay lõi — sau mỗi phép nhận
 * được phải 0 lỗi so với nền. Hạt cố định; mọi mẫu tòa thư viện (mẫu thêm sau cũng bị thử).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { layMau, NHANH } from '../thu/layMau';
import { tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
import { thuMauToa, type KetQuaThu } from './thuMauToa';

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
const toaThu = (id: string): ToaDat =>
  tuChinhToa({ id: 't', loId: 'l', mauId: id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} }, tv.toa.get(id) as unknown as ToaMB, tv, dl);

const tong: Record<string, { thu: number; nhan: number }> = {};
const gom = (k: KetQuaThu) => { for (const [n, v] of Object.entries(k.thongKe)) { const t = (tong[n] ??= { thu: 0, nhan: 0 }); t.thu += v!.thu; t.nhan += v!.nhan; } };

describe.each([101, 202])('thử ngẫu nhiên mọi mẫu tòa — hạt %i, 24 bước', (hat) => {
  it.each(layMau(toaDs.map((t) => t.id), 3))('%s', (id) => {
    const k = thuMauToa(toaThu(id), c, { hat, buoc: 24, hanMs: 60_000 });
    gom(k);
    expect(k.loi.map((b) => `${b.buoc} ${b.op}: ${b.vi.map((v) => `${v.ma} ${JSON.stringify(v.tham)}`).join(' · ')}`), id).toEqual([]);
    expect(k.soNhan, `${id}: ít nhất vài phép được nhận`).toBeGreaterThan(2);
  }, 120_000);
});

describe('phủ đủ nhóm phép', () => {
  it.skipIf(NHANH)('mọi nhóm phép đều được thử và có lúc được nhận (ngoài dồn khít)', () => {
    for (const n of ['xoa', 'them', 'doiCho', 'lat', 'stretch', 'themThang', 'xoaThang', 'doiThang', 'hanhLang', 'thayLoi']) {
      expect(tong[n]?.thu ?? 0, `${n} chưa được thử`).toBeGreaterThan(0);
    }
    for (const n of ['xoa', 'them', 'lat', 'stretch', 'thayLoi']) expect(tong[n]?.nhan ?? 0, `${n} chưa lần nào được nhận`).toBeGreaterThan(0);
  });
});
