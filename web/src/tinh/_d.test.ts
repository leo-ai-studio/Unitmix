import { it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
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
it('d', () => {
  const m = tv.toa.get('tm-l1') as unknown as ToaMB;
  const toa: ToaDat = { id: 't', loId: 'l', mauId: m.id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} };
  const mb = tuChinhToa(toa, m, tv, dl).matBang!;
  writeFileSync('E:/AI_Work/tmp/claude/E--Projects-Unitmix/9060d72e-deb7-4fd2-9dc4-8e730d7a4139/scratchpad/d.txt', JSON.stringify({ thang: mb.thangBo.map((t) => [t.matIdx, Math.round(t.a0), t.nguon]), mep: mb.mep, bao: mb.baoCao }, null, 1).slice(0, 3000) + '\nMAT ' + m.mat.map((x, i) => `${i}:${Math.round(x.a_dau)}..${Math.round(x.a_cuoi)}`).join(' ') + '\nTHANG_MAU ' + JSON.stringify(m.mat.map((x, i) => x.phan_tu.filter((q) => q.loai !== 'can').map((q) => `${i}:${q.loai}${Math.round(q.a0)}`))));
});
