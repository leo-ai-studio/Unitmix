import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { taoThuVien, type CanMau, type ToaMau } from './kieu';
import { apMatBang, dauHanhLangNgoai, matBangMacDinh, type DuLieuMB, type HinhLoiMB, type ToaMB } from './loiThang';
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

/** Đầu hành lang kéo được (tay nắm co kéo) của mặt bằng mặc định, mỗi đoạn một mảng. */
const tayNam = (id: string) => {
  const m = tv.toa.get(id) as unknown as ToaMB, hd = apMatBang(m, matBangMacDinh(m, dl), dl), hl = hd.hanh_lang ?? [];
  return hl.map((_, i) => dauHanhLangNgoai(hl, i, hd.duong_bao));
};

describe('Co kéo đầu hành lang · đoạn nối trùm trục (mẫu L / T)', () => {
  // đoạn nối (noi) chạy chồng lên trục hành lang không được chặn đầu mút tự do của trục (L2 mất tay nắm / không kéo dài tới cửa xa nhất)
  it.each([
    ['tm-l1', 3], ['tm-l2', 3], ['tm-l3', 3], ['xh-l1', 3], ['xh-l2', 3], ['tm-t1', 4], ['tm-t2', 4],
  ])('%s: có %i đầu hành lang kéo được (mọi cánh đều có đầu tự do)', (id, n) => {
    expect(tayNam(id).flat().length).toBe(n);
  });

  it('L2: cả hai cánh có tay nắm ở đầu tự do (cánh dọc + cánh ngang)', () => {
    const a = tayNam('tm-l2'), x = tayNam('xh-l2');
    expect(a[0]).toEqual([1]); expect(a[1]).toEqual([0, 1]);
    expect(x[0]).toEqual([0, 1]); expect(x[1]).toEqual([1]);
  });
});
