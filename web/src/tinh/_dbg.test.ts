import { it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { mauToa } from './canThem';
import { taoThuVien, type CanMau, type ToaDat, type ToaMau } from './kieu';
import { apMatBang, daiLoi, doDeKhe, matBangTang, tuChinhToa, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
import { boCucTang, viTriCan } from './matBang';
import { tinhCuaCan } from './pccc';
import { themBienThe } from './stretch';
import { thayLoiTay } from './thaoTacTay';
import { ungVienLoiThay } from './thayLoi';
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
  const id = 'tm-i2', khoa = '0:2', moi = 'x_tmdv_z1_tm_08';
  const m = tv.toa.get(id) as unknown as ToaMB;
  const t0 = tuChinhToa({ id: 't', loId: 'l', mauId: id, x: 0, y: 0, gocDo: 0, soTangDH: 24, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {} } as ToaDat, m, tv, dl);
  const o: string[] = [];
  const mo = (t: ToaDat, ten: string) => {
    const mm = mauToa(tv, t) as unknown as ToaMB, mb = matBangTang(t, mm, dl, null), hd = apMatBang(mm, mb, dl);
    o.push(`== ${ten}  dải lõi ${JSON.stringify(daiLoi(mm, dl).map((d) => [d.matIdx, Math.round(d.t0), Math.round(d.t1)]))} mép ${JSON.stringify(mb.mep)} khe/đè ${JSON.stringify(doDeKhe(mm, mb, dl, tv, boCucTang(t, null)))}`);
    hd.mat.forEach((f, mi) => o.push(` mặt ${mi} [${Math.round(f.a_dau)}..${Math.round(f.a_cuoi)}]: ` + f.phan_tu.filter((q) => q.rong_mm > 0).sort((a, b) => a.a0 - b.a0).map((q) => `${q.loai[0]}${Math.round(q.a0)}-${Math.round(q.a1)}`).join(' ')));
  };
  mo(t0, 'GỐC');
  o.push('ứng viên ' + JSON.stringify(ungVienLoiThay(m, khoa, moi, dl)));
  const r = thayLoiTay(t0, khoa, moi, { tv, dl });
  o.push('kq ' + JSON.stringify(r.ok ? 'ok' : r));
  const uv = ungVienLoiThay(m, khoa, moi, dl)[0];
  mo(tuChinhToa({ ...t0, loiThay: { [khoa]: uv }, matBang: undefined } as ToaDat, mauToa(tv, { ...t0, loiThay: { [khoa]: uv } }) as unknown as ToaMB, tv, dl), 'SAU (ứng viên đầu)');
  void viTriCan;
  writeFileSync('E:/AI_Work/tmp/claude/66aeb36408232c84/9060d72e-deb7-4fd2-9dc4-8e730d7a4139/scratchpad/dbg.txt', o.join(String.fromCharCode(10)));
});
