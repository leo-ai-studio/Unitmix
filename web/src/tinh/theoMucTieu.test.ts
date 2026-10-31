import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Diem, type Lo, type ToaMau, type TrangThaiPA } from './kieu';
import { traLuat, type BoQuyTac } from './quyTac';
import { themBienThe } from './stretch';
import { goiYXepToa, type LuatXep } from './xepToa';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const tv = themBienThe(taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json')));
const bo = doc<BoQuyTac>('quy_tac.json');
const luat: LuatXep = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };

const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: null, tangHam: null, danSoMax: 3000, soCanMax: null, nguoiMoiCan: 3.6, choDoOtoMoiCan: 0.5, choXeMayMoiCan: 2 } as unknown as ChiTieuQH;
const hcn = (w: number, h: number): Diem[] => [[0, 0], [w, 0], [w, h], [0, h]];
const lo: Lo = { id: 'A', ranh: hcn(160, 120), chiGioi: null, xungQuanh: [], canhDuong: [12, 12, 12, 12], temDat: { kyHieu: 'A', chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 0, '3pn': 25 } } };
const pa: TrangThaiPA = { phienBan: 1, lo: [lo], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: [], ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 } } as unknown as TrangThaiPA;

describe('xếp tòa THEO MỤC TIÊU (DTXD + cơ cấu căn)', () => {
  const base = { pa, lo, tv, luat, soGoiY: 5 };
  const thuong = goiYXepToa(base);
  const mt = goiYXepToa({ ...base, theoMucTieu: true });
  if (process.env.IN_TT) for (const [n, ds] of [['thuong', thuong], ['mt', mt]] as const) for (const g of ds) console.log(n, g.khoa, 'tòa', g.toa.length, 'tầng', g.soTangDH, 'căn', g.soCan, 'lech', g.lech.toFixed(1), 'matDo', g.matDo.toFixed(1), JSON.stringify(g.theoMucTieu ?? null));

  it('trả phương án đạt chỉ tiêu QH, có ghi tổ hợp mẫu dự kiến', () => {
    expect(mt.length).toBeGreaterThan(0);
    expect(mt[0].loiQH).toBe(0);
    expect(mt.some((g) => g.theoMucTieu)).toBe(true);
  });

  it('DTXD nằm trong [85 % MĐXD tối đa, MĐXD tối đa] và không lệch cơ cấu hơn cách xếp thường', () => {
    const g = mt[0];
    expect(g.matDo).toBeLessThanOrEqual(chiTieu.matDoMax + 1e-6);
    if (g.theoMucTieu) expect(g.theoMucTieu.thieuDtxd).toBeGreaterThanOrEqual(0);
    expect(g.lech).toBeLessThanOrEqual(thuong[0].lech + 1e-6);
  });

  it('không bật thì không sinh phương án theo mục tiêu', () => {
    expect(thuong.some((g) => g.theoMucTieu)).toBe(false);
  });
});
