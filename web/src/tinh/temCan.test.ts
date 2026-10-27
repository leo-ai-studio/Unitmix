import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { taoThuVien, type CanMau } from './kieu';
import { viTriCan, type ToaCoMat } from './matBang';
import { datTemCan, TEM_H, TEM_W } from './temCan';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const ds = doc<ToaCoMat[]>('toa.json');
const tv = taoThuVien(ds, doc<CanMau[]>('can.json'));

/** Số cặp tem chồng nhau và số tem đè lên căn khác (đè quá 150 mm) của một tòa. */
function loi(t: ToaCoMat) {
  const vts = viTriCan(t, tv), tem = datTemCan(vts);
  let chong = 0, daCan = 0;
  tem.forEach((a, i) => {
    tem.forEach((b, j) => { if (j > i && Math.abs(a.cx - b.cx) < TEM_W && Math.abs(a.cy - b.cy) < TEM_H) chong++; });
    vts.forEach((v, j) => {
      if (j === i) return;
      const xs = v.goc.map((p) => p[0]), ys = v.goc.map((p) => p[1]);
      if (a.cx + TEM_W / 2 > Math.min(...xs) + 150 && a.cx - TEM_W / 2 < Math.max(...xs) - 150 && a.cy + TEM_H / 2 > Math.min(...ys) + 150 && a.cy - TEM_H / 2 < Math.max(...ys) - 150) daCan++;
    });
  });
  return { chong, daCan, so: tem.length };
}

describe('đặt tem căn', () => {
  it('mỗi căn một tem, tem nằm ngoài mặt tiền (cách cạnh ngoài ≥ 900 mm)', () => {
    const t = ds.find((x) => x.id === 'tm-u2')!;
    const vts = viTriCan(t, tv), tem = datTemCan(vts);
    expect(tem).toHaveLength(vts.length);
    tem.forEach((m, i) => {
      const d = Math.hypot(m.cx - m.chan[0], m.cy - m.chan[1]);
      expect(d).toBeGreaterThanOrEqual(890);
      expect(m.khoa).toBe(vts[i].khoa);
    });
  });
  it('mọi mẫu tòa: tem không chồng nhau, không đè căn khác', () => {
    const xau = ds.map((t) => ({ id: t.id, ...loi(t) })).filter((k) => k.chong || k.daCan);
    expect(xau).toEqual([]);
  });
});
