import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { chanToa, namTrong } from './hinhHoc';
import { hopLo, taoToaTrenLo } from './hopLo';
import type { Diem, ToaMau } from './kieu';
import { taoLo } from './macDinh';

const thuVien = JSON.parse(readFileSync(new URL('../../public/lib/toa.json', import.meta.url), 'utf-8')) as ToaMau[];
const mau = (id: string) => thuVien.find((t) => t.id === id)!;
const hcn = (w: number, h: number, x0 = 0, y0 = 0): Diem[] => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h]];

describe('hợp lô', () => {
  it('nằm trong: hình nhỏ trong hình lớn; chờm ra ngoài thì không', () => {
    expect(namTrong(hcn(10, 10, 5, 5), hcn(30, 30))).toBe(true);
    expect(namTrong(hcn(10, 10, 25, 5), hcn(30, 30))).toBe(false);
  });

  it('tm-i1 (102 × 19 m) hợp chỉ giới 120 × 40 m, không hợp 50 × 50 m', () => {
    expect(hopLo(mau('tm-i1'), hcn(120, 40))).toEqual({ hop: true, gocHop: 0 });
    expect(hopLo(mau('tm-i1'), hcn(50, 50))).toEqual({ hop: false, gocHop: null });
  });

  it('chỉ giới dựng đứng 40 × 120 m → hợp ở góc 90°', () => {
    expect(hopLo(mau('tm-i1'), hcn(40, 120))).toEqual({ hop: true, gocHop: 90 });
  });

  it('đặt tòa mới lên lô: tâm chỉ giới, góc hợp, tầng theo chỉ tiêu, nằm trọn trong chỉ giới', () => {
    const lo = taoLo('A', 'CT-1', 'tm', hcn(140, 60));
    lo.chiGioi = hcn(120, 40, 10, 10);
    lo.temDat.chiTieu.tangCaoMax = 28;
    const t = taoToaTrenLo(mau('tm-i1'), lo, 'toa-1');
    expect([t.x, t.y, t.gocDo]).toEqual([70, 30, 0]);
    expect(t.soTangDe + t.soTangDH).toBe(28);
    expect(t.loId).toBe('A');
    expect(namTrong(chanToa(mau('tm-i1'), t), lo.chiGioi)).toBe(true);
  });

  it('lô không có chỉ giới thì dùng ranh lô', () => {
    const lo = taoLo('A', 'CT-1', 'tm', hcn(140, 60));
    expect(hopLo(mau('tm-i1'), lo.chiGioi ?? lo.ranh).hop).toBe(true);
  });
});
