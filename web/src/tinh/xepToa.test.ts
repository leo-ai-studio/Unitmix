import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tinhChiTieu } from './chiTieu';
import { chanToa, namTrong } from './hinhHoc';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Diem, type Lo, type ToaMau, type TrangThaiPA } from './kieu';
import type { BoQuyTac } from './quyTac';
import { traLuat } from './quyTac';
import { themBienThe } from './stretch';
import { goiYXepToa, kcDaGiac, kcToa261, luiBang27, type LuatXep } from './xepToa';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const tv = themBienThe(taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json')));
const bo = doc<BoQuyTac>('quy_tac.json');
const luat: LuatXep = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };

const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: null, tangHam: null, danSoMax: 3000, soCanMax: null, nguoiMoiCan: 3.6, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const lo = (ranh: Diem[], chucNang: 'tm' | 'xh' = 'tm', ct: Partial<ChiTieuQH> = {}): Lo => ({
  id: 'L1', ranh, chiGioi: null, xungQuanh: [],
  temDat: { kyHieu: 'CT-01', chucNang, chiTieu: { ...chiTieu, ...ct }, coCauMucTieu: { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 0, '3pn': 25 } },
});
const pa = (l: Lo): TrangThaiPA => ({
  phienBan: 1, lo: [l], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: [],
  ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 },
});
const hcn = (w: number, h: number): Diem[] => [[0, 0], [w, 0], [w, h], [0, h]];

describe('luật đọc từ quy_tac.json', () => {
  it('LO-01 Bảng 2.7', () => {
    expect(luiBang27(luat.lo01, 12, 18)).toBe(0);
    expect(luiBang27(luat.lo01, 12, 20)).toBe(3);
    expect(luiBang27(luat.lo01, 12, 25)).toBe(4);
    expect(luiBang27(luat.lo01, 12, 30)).toBe(6);
    expect(luiBang27(luat.lo01, 20, 25)).toBe(3);
    expect(luiBang27(luat.lo01, 30, 25)).toBe(0);
  });
  it('LO-02 §2.6.1 (như kcToa261 app cũ)', () => {
    expect(kcToa261(luat.lo02, 20)).toEqual({ dai: 10, hoi: 20 / 3 });
    expect(kcToa261(luat.lo02, 10)).toEqual({ dai: 7, hoi: 4 });
    expect(kcToa261(luat.lo02, 80)).toEqual({ dai: 25, hoi: 15 });
  });
  it('khoảng cách hai đa giác', () => {
    expect(kcDaGiac(hcn(10, 10), hcn(10, 10).map(([x, y]) => [x + 15, y] as Diem))).toBeCloseTo(5);
    expect(kcDaGiac(hcn(10, 10), hcn(4, 4))).toBe(0);
  });
});

describe('gợi ý xếp tòa (MT-05)', () => {
  const L = lo(hcn(160, 110));
  const t0 = performance.now();
  const ds = goiYXepToa({ pa: pa(L), lo: L, tv, luat });
  const ms = performance.now() - t0;
  it('ra phương án, đủ nhanh', () => {
    expect(ds.length).toBeGreaterThan(0);
    expect(ds.length).toBeLessThanOrEqual(10);
    expect(ms).toBeLessThan(15000);
  });
  it('mọi phương án: đúng dòng sản phẩm, trong lô, đủ lùi, đủ khoảng cách đầu hồi, không vượt chỉ tiêu', () => {
    for (const g of ds) {
      const H = 4.5 + g.soTangDH * 3.3, lui = luiBang27(luat.lo01, 12, H), kc = kcToa261(luat.lo02, H);
      const chan = g.toa.map((t) => chanToa(tv.toa.get(t.mauId)!, t));
      for (const t of g.toa) expect(tv.toa.get(t.mauId)!.nhom).toBe('tm');
      for (const F of chan) {
        expect(namTrong(F, L.ranh)).toBe(true);
        for (const p of F) expect(Math.min(p[0], p[1], 160 - p[0], 110 - p[1])).toBeGreaterThanOrEqual(lui - 1e-6);
      }
      for (let i = 0; i < chan.length; i++) for (let j = i + 1; j < chan.length; j++) expect(kcDaGiac(chan[i], chan[j])).toBeGreaterThanOrEqual(kc.hoi - 1e-6);
      const kq = tinhChiTieu({ ...pa(L), toa: g.toa }, tv).theoLo.L1;
      expect(kq.dong.filter((d) => d.muc === 'vuot' && d.khoa !== 'choDo' && d.khoa !== 'cayXanh')).toEqual([]);
      expect(g.soCan).toBe(kq.soCan);
      expect(g.soTangDH + 1).toBeLessThanOrEqual(25);
      expect(g.soCan * 3.6).toBeLessThanOrEqual(3000);
    }
  });
  it('xếp hạng: điểm giảm dần trong cùng mức PCCC', () => {
    for (let i = 1; i < ds.length; i++) if ((ds[i].pcccVuot ?? 99) === (ds[i - 1].pcccVuot ?? 99)) expect(ds[i].diem).toBeLessThanOrEqual(ds[i - 1].diem + 1e-9);
  });
  it('lô NOXH chỉ dùng mẫu xh; lô quá nhỏ thì không có phương án', () => {
    const X = lo(hcn(160, 110), 'xh');
    const dx = goiYXepToa({ pa: pa(X), lo: X, tv, luat });
    expect(dx.length).toBeGreaterThan(0);
    for (const g of dx) for (const t of g.toa) expect(tv.toa.get(t.mauId)!.nhom).toBe('xh');
    const N = lo(hcn(20, 20));
    expect(goiYXepToa({ pa: pa(N), lo: N, tv, luat })).toEqual([]);
  });
  it('dân số thấp: giảm số tầng để không vượt (CT-04)', () => {
    const D = lo(hcn(160, 110), 'tm', { danSoMax: 600 });
    const dd = goiYXepToa({ pa: pa(D), lo: D, tv, luat });
    expect(dd.length).toBeGreaterThan(0);
    for (const g of dd) expect(g.danSo).toBeLessThanOrEqual(600);
  });
});
