import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { goiYVuaO } from './goiYVuaO';
import { taoThuVien, type CanMau, type ToaMau } from './kieu';
import { themBienThe } from './stretch';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(doc<ToaMau[]>('toa.json'), canDs));
// căn giữa 1PN rộng 5,8 m (ô kẹp như tm-i1 0:8): đổi tay sang 2PN bị chặn
const cu = canDs.find((c) => c.vi_tri === 'giua' && c.loai === '1pn' && c.rong_mm === 5800)!;

describe('gợi ý mẫu vừa ô khi chặn đổi căn', () => {
  it('ô 5,8 m chặn 2PN: gợi ý loại khác 2PN, cùng nhóm / vị trí / chiều sâu, rộng ≤ ô + 500 (STRETCH co), mỗi loại một mẫu rộng nhất', () => {
    expect(cu).toBeTruthy();
    const ds = goiYVuaO(tv, cu.id, '2pn', 5800);
    expect(ds.length).toBeGreaterThan(0);
    for (const x of ds) {
      expect(x.loai).not.toBe('2pn');
      expect(x.rong_mm).toBeLessThanOrEqual(6300);
      expect([x.nhom, x.vi_tri, x.sau_mm]).toEqual([cu.nhom, cu.vi_tri, cu.sau_mm]);
      expect(x.id).not.toContain('~');
      const rongNhat = canDs.filter((c) => c.loai === x.loai && c.nhom === cu.nhom && c.vi_tri === cu.vi_tri && c.sau_mm === cu.sau_mm && c.rong_mm <= 6300)
        .reduce((a, c) => Math.max(a, c.rong_mm), 0);
      expect(x.rong_mm).toBe(rongNhat);
    }
    expect(new Set(ds.map((x) => x.loai)).size).toBe(ds.length);
  });

  it('căn đang đặt là biến thể STRETCH vẫn tra theo mẫu gốc; mã lạ thì không gợi ý', () => {
    expect(goiYVuaO(tv, `${cu.id}~s-300`, '2pn', 5800)).toEqual(goiYVuaO(tv, cu.id, '2pn', 5800));
    expect(goiYVuaO(tv, 'khong-co', '2pn', 5800)).toEqual([]);
  });

  it('ô quá hẹp cho mọi mẫu thì không gợi ý', () => {
    expect(goiYVuaO(tv, cu.id, '2pn', 1000)).toEqual([]);
  });
});
