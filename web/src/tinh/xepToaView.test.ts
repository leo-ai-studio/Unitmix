/** Tiêu chí VIEW trong gợi ý xếp tòa (tinh/xepToa.ts + tinh/huongView.ts): trọng số đổi được, có điểm view từng phương án, đổi xếp hạng. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { danhGiaViewPA } from './huongView';
import { HE_SO_MAC_DINH, NGUONG_MAC_DINH, taoThuVien, type CanMau, type ChiTieuQH, type Diem, type Lo, type ToaMau, type TrangThaiPA } from './kieu';
import { traLuat, type BoQuyTac } from './quyTac';
import { themBienThe } from './stretch';
import { goiYXepToa, type GoiYXep, type LuatXep } from './xepToa';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const tv = themBienThe(taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json')));
const bo = doc<BoQuyTac>('quy_tac.json');
const luat: LuatXep = { lo01: traLuat(bo, 'LO-01')!, lo02: traLuat(bo, 'LO-02')! };
const chiTieu: ChiTieuQH = { matDoMax: 40, matDoThapMax: null, hssddMax: 8, tangCaoMax: 25, tangDe: 1, tangCanHo: null, tangHam: null, danSoMax: 3000, soCanMax: null, nguoiMoiCan: 3.6, choDoOtoMoiCan: 1, choXeMayMoiCan: 2, cayXanhMin: 20 };
const L: Lo = {
  id: 'L1', ranh: [[0, 0], [160, 0], [160, 110], [0, 110]] as Diem[], chiGioi: null, xungQuanh: [],
  temDat: { kyHieu: 'CT-01', chucNang: 'tm', chiTieu, coCauMucTieu: { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 0, '3pn': 25 } },
};
const pa: TrangThaiPA = { phienBan: 1, lo: [L], heSo: HE_SO_MAC_DINH, nguong: NGUONG_MAC_DINH, toa: [], ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 } };

describe('gợi ý xếp tòa · tiêu chí view', () => {
  const chay = (w: number) => goiYXepToa({ pa, lo: L, tv, luat, trongSoView: w });
  const d0 = chay(0), d20 = chay(20), d100 = chay(100);
  const tbView = (ds: GoiYXep[]) => ds.reduce((s, g) => s + (g.view ?? 0), 0) / ds.length;

  it('mọi phương án có điểm view 0–100 (tính đúng số tầng), kể cả khi trọng số 0', () => {
    for (const ds of [d0, d20, d100]) {
      expect(ds.length).toBeGreaterThan(0);
      for (const g of ds) {
        expect(g.view).not.toBeNull();
        expect(g.view!).toBeGreaterThanOrEqual(0);
        expect(g.view!).toBeLessThanOrEqual(100);
        expect(g.viewTot!).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it('điểm view của phương án = đánh giá cả PA sau khi áp (cùng hàm với panel TMB)', () => {
    const g = d20[0];
    const k = danhGiaViewPA({ ...pa, toa: g.toa }, tv);
    expect(k.tong.tb!).toBeCloseTo(g.view!, 6);
  });
  it('trọng số view cao kéo phương án có view tốt lên (TB view các phương án không giảm, điểm có cộng view)', () => {
    expect(tbView(d100)).toBeGreaterThanOrEqual(tbView(d0) - 1e-9);
    // phương án cùng khoá ở hai lượt: điểm lượt 100 % = điểm lượt 0 % + 0,5 × view ước (≥ 0)
    const g0 = new Map(d0.map((g) => [g.khoa, g]));
    const chung = d100.filter((g) => g0.has(g.khoa) && JSON.stringify(g.toa) === JSON.stringify(g0.get(g.khoa)!.toa));
    for (const g of chung) expect(g.diem).toBeGreaterThan(g0.get(g.khoa)!.diem);
  });
  it('trọng số mặc định lấy từ PA (huongView.trongSoXep)', () => {
    const a = goiYXepToa({ pa: { ...pa, huongView: { trongSoXep: 0 } }, lo: L, tv, luat });
    expect(a.map((g) => g.diem)).toEqual(d0.map((g) => g.diem));
  });
});
