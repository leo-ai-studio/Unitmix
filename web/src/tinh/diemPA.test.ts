import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tinhChiTieu } from './chiTieu';
import { coCauRong } from './coCau';
import { chenhChiSo, chiSoPA, demLuatVuot, diemLechPA, sapXepPA, type ChiSoPA } from './diemPA';
import { taoToaTrenLo } from './hopLo';
import { taoThuVien, type CanMau, type ToaMau } from './kieu';
import { taoLo, taoPAMoi } from './macDinh';

const doc = <T,>(tep: string) => JSON.parse(readFileSync(new URL(`../../public/lib/${tep}`, import.meta.url), 'utf-8')) as T;
const tv = taoThuVien(doc<ToaMau[]>('toa.json'), doc<CanMau[]>('can.json'));

function paMau(tang: number, mucTieu?: Partial<ReturnType<typeof coCauRong>>) {
  const lo = taoLo('A', 'CT-1', 'tm', [[0, 0], [140, 0], [140, 60], [0, 60]]);
  if (mucTieu) lo.temDat = { ...lo.temDat, coCauMucTieu: { ...coCauRong(), ...mucTieu } };
  const toa = { ...taoToaTrenLo(tv.toa.get('tm-i1')!, lo, 't1'), soTangDH: tang };
  return { ...taoPAMoi(), lo: [lo], toa: [toa] };
}

describe('điểm PA', () => {
  it('lệch cơ cấu = 0 khi % đạt trùng mục tiêu; lớn hơn khi mục tiêu khác', () => {
    const pa = paMau(10);
    const kq = tinhChiTieu(pa, tv);
    const khop = { ...pa, lo: [{ ...pa.lo[0], temDat: { ...pa.lo[0].temDat, coCauMucTieu: kq.tong.coCauPct } }] };
    expect(diemLechPA(khop, kq)).toBeCloseTo(0, 9);
    const lech = diemLechPA(paMau(10, { stu: 100 }), kq);
    expect(lech).toBeGreaterThan(0);
    expect(Number.isFinite(lech!)).toBe(true);
  });

  it('PA chưa có tòa: lệch null, không NaN', () => {
    const pa = taoPAMoi();
    const c = chiSoPA(pa, tinhChiTieu(pa, tv));
    expect(c.lech).toBeNull();
    expect(c.soCan).toBe(0);
    expect(c.matDo).toBeNull();
    expect(c.tangCao).toBeNull();
    expect(Object.values(c.coCauPct).every(Number.isFinite)).toBe(true);
  });

  it('chỉ số PA: số căn, tầng cao và số luật vượt khớp kết quả chỉ tiêu', () => {
    const pa = paMau(60);
    const kq = tinhChiTieu(pa, tv);
    const c = chiSoPA(pa, kq);
    expect(c.soCan).toBe(kq.tong.soCan);
    expect(c.tangCao).toBeGreaterThanOrEqual(60);
    expect(c.soLuatVuot).toBe(demLuatVuot(kq));
    expect(c.soLuatVuot).toBeGreaterThan(0);
  });

  it('sắp xếp: tăng / giảm, ô trống xuống cuối, ổn định', () => {
    const goc = chiSoPA(taoPAMoi(), tinhChiTieu(taoPAMoi(), tv));
    const mk = (ten: string, lech: number | null): { ten: string; chiSo: ChiSoPA } => ({ ten, chiSo: { ...goc, lech } });
    const ds = [mk('a', 5), mk('b', null), mk('c', 1), mk('d', 5)];
    expect(sapXepPA(ds, 'lech').map((x) => x.ten)).toEqual(['c', 'a', 'd', 'b']);
    expect(sapXepPA(ds, 'lech', true).map((x) => x.ten)).toEqual(['a', 'd', 'c', 'b']);
    expect(sapXepPA(ds, 'ten', true).map((x) => x.ten)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('chênh chỉ số: số học, một bên trống thì null', () => {
    const a = chiSoPA(paMau(20), tinhChiTieu(paMau(20), tv)), b = chiSoPA(paMau(10), tinhChiTieu(paMau(10), tv));
    expect(chenhChiSo(a, b).soCan).toBe(a.soCan - b.soCan);
    expect(chenhChiSo(a, { ...b, lech: null }).lech).toBeNull();
  });
});
