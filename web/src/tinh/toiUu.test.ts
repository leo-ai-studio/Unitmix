import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { demCan, phanTram } from './coCau';
import { kheTrenMat, kiemKhit } from './khe';
import { taoThuVien, type CanMau, type LoaiCan, type ToaMau } from './kieu';
import { canDangDung, canCuaToa, donKhit, soCanChuVi, viTriCan, type ToaCoMat } from './matBang';
import { chieuCaoPCCC, thoatNan, tinhCuaCan, type ToaPCCC } from './pccc';
import { bienThe, maBienThe, tachMa, themBienThe, veBienThe } from './stretch';
import { toiUuCoCau } from './toiUu';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<ToaMau[]>('toa.json'), canDs = doc<CanMau[]>('can.json');
const tv = themBienThe(taoThuVien(toaDs, canDs));
const mau = (id: string) => tv.toa.get(id) as ToaCoMat;
const cuaCan: Record<string, number> = {};
for (const c of canDs) cuaCan[c.ma_goc] = tinhCuaCan(doc<{ ve: { cat: string; pts: [number, number][] }[] }>(`can/${c.id}.json`).ve, c.rong_mm);
const H = chieuCaoPCCC(1, 4.5, 25, 3.3);

describe('STRETCH (DC-04 · QT-81)', () => {
  it('27 mẫu có đường cắt, mỗi mẫu 10 biến thể ±100…±500', () => {
    const coCat = canDs.filter((c) => c.stretch);
    expect(coCat).toHaveLength(27);
    expect([...tv.can.values()].filter((c) => c.stretchGoc)).toHaveLength(270);
    expect(tachMa('tm-2pn-m2~s-300')).toEqual({ goc: 'tm-2pn-m2', st: -300 });
    expect(maBienThe('tm-2pn-m2', 300)).toBe('tm-2pn-m2~s+300');
  });
  it('DT tính lại theo chiều sâu cắt; sai luật bị từ chối', () => {
    const g = tv.can.get('tm-2pn-m2')!, b = bienThe(g, 300)!;
    expect(b.rong_mm).toBe(7800);
    expect(b.dt_tt_m2).toBeCloseTo(g.dt_tt_m2 + (300 * g.stretch!.sau_tt_mm) / 1e6, 2);
    expect(b.dt_tim_m2).toBeCloseTo(g.dt_tim_m2 + (300 * g.stretch!.sau_tim_mm) / 1e6, 2);
    expect(bienThe(g, 600)).toBeNull();
    expect(bienThe(g, 150)).toBeNull();
    expect(bienThe(tv.can.get('tm-stu-m1')!, 100)).toBeNull(); // STU không có F-PK
  });
  it('hình: đỉnh bên phải đường cắt dời st, bên trái đứng yên (theo mm)', () => {
    const g = tv.can.get('tm-1pn-m1')!;
    const ve = doc<{ ve: { cat: string; pts: [number, number][] }[] }>('can/tm-1pn-m1.json').ve;
    const v2 = veBienThe(ve, g, 500);
    const xc = g.stretch!.x_mm, cung = new Set(g.stretch!.cung.map(([i]) => i));
    ve.forEach((n, i) => {
      if (cung.has(i)) return;
      n.pts.forEach(([x], k) => {
        const X = x * g.rong_mm, X2 = v2[i].pts[k][0] * (g.rong_mm + 500);
        expect(X2).toBeCloseTo(X > xc ? X + 500 : X, 3);
      });
    });
  });
});

describe('dồn khít (XC-04) và khe (XC-02 / XC-10)', () => {
  const i1 = mau('tm-i1');
  it('mặt bằng gốc tm-i1: không đè; khe quanh ô thang là khe tường / kỹ thuật', () => {
    const { khe, de } = kheTrenMat(i1, tv);
    expect(de).toHaveLength(0);
    expect(khe.every((k) => k.loai === 'tuong' || k.loai === 'ky_thuat' || k.loai === 'hanh_lang')).toBe(true);
  });
  it('đổi hai căn giữa cùng đoạn, tổng bề ngang giữ nguyên: dồn khít, hai đầu đoạn đứng yên', () => {
    const vts = viTriCan(i1, tv);
    // mặt A, đoạn trước lõi: …, 2PN 7.500 (0:7), 1PN 5.800 (0:8) — 2PN +300, 1PN −300
    const a = vts.find((v) => v.canGocId === 'tm-2pn-m2' && v.matIdx === 0)!;
    const b = vts.find((v) => v.matIdx === 0 && Math.abs(v.a0 - a.a1) < 2)!;
    const bc = { canTheo: {}, canViTri: { [a.khoa]: 'tm-2pn-m2~s+300', [b.khoa]: maBienThe(b.canGocId, -300) } };
    const r = donKhit(i1, vts, bc, tv);
    expect(r.lech).toHaveLength(0);
    const a2 = r.vts.find((v) => v.khoa === a.khoa)!, b2 = r.vts.find((v) => v.khoa === b.khoa)!;
    expect(a2.a1 - a2.a0).toBeCloseTo(7800);
    expect(b2.a0).toBeCloseTo(a2.a1);
    expect(b2.a1).toBeCloseTo(b.a1);
    expect(kiemKhit(i1, tv, bc)).toEqual({ kheMoi: [], de: 0 });
    // số căn không đổi, loại căn đúng
    expect(canCuaToa(i1, bc, tv).reduce((s, [, n]) => s + n, 0)).toBe(28);
  });
  it('tổng bề ngang đổi: báo lệch (đầu tự do dài ra)', () => {
    const vts = viTriCan(i1, tv);
    const a = vts.find((v) => v.canGocId === 'tm-2pn-m2')!;
    const r = donKhit(i1, vts, { canTheo: {}, canViTri: { [a.khoa]: 'tm-2pn-m2~s+500' } }, tv);
    expect(r.lech).toEqual([{ matIdx: a.matIdx, mm: 500 }]);
  });
});

describe('tối ưu cơ cấu đổi bề ngang (A8 · DC-05)', () => {
  const muc: Record<LoaiCan, number> = { stu: 10, '1pn': 20, '2pn': 45, '2pnp': 0, '3pn': 25 };
  for (const id of ['tm-i1', 'tm-u2', 'xh-i1']) {
    it(`${id}: điểm lệch giảm, đổi bề ngang không khe / không đè, không thêm căn vượt PCCC`, () => {
      const m = mau(id), bc = { canTheo: {} };
      const cung = toiUuCoCau(m, bc, tv, muc, { doiBeNgang: false });
      const kq = toiUuCoCau(m, bc, tv, muc, { chieuCaoPCCC: H, cuaCan });
      expect(kq.diemSau).toBeLessThanOrEqual(cung.diemSau + 1e-9);
      expect(kq.diemSau).toBeLessThan(kq.diemTruoc);
      const bc2 = { canTheo: {}, canViTri: kq.canViTri };
      expect(kiemKhit(m, tv, bc2)).toEqual({ kheMoi: [], de: 0 });
      expect(donKhit(m, viTriCan(m, tv), bc2, tv).lech).toHaveLength(0);
      if (kq.pcccTruoc !== null) expect(kq.pcccSau!).toBeLessThanOrEqual(kq.pcccTruoc);
      // số căn mỗi tầng không đổi
      const n = (b: typeof bc2) => canCuaToa(m, b, tv).reduce((s, [, k]) => s + k, 0);
      expect(n(bc2)).toBe(n({ canTheo: {}, canViTri: {} }));
    });
  }
  it('tm-i1: đổi bề ngang giảm lệch nhiều hơn chỉ đổi cùng bề ngang', () => {
    const m = mau('tm-i1');
    const cung = toiUuCoCau(m, { canTheo: {} }, tv, muc, { doiBeNgang: false });
    const rong = toiUuCoCau(m, { canTheo: {} }, tv, muc);
    expect(rong.diemSau).toBeLessThan(cung.diemSau);
    expect(rong.soDoiRong).toBeGreaterThan(0);
  });
  it('XC-08: sau khi dồn, số CH-xx vẫn liên tục 1..N theo chu vi', () => {
    const m = mau('tm-i1');
    const kq = toiUuCoCau(m, { canTheo: {} }, tv, muc);
    const so = soCanChuVi(m.duong_bao, viTriCan(m, tv, { canTheo: {}, canViTri: kq.canViTri }));
    expect([...so.values()].sort((a, b) => a - b)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });
  it('PCCC: mặt đã dồn đọc được bởi thoatNan (cự ly thật theo cửa căn mới)', () => {
    const m = mau('tm-i1');
    const kq = toiUuCoCau(m, { canTheo: {} }, tv, muc, { chieuCaoPCCC: H, cuaCan });
    expect(kq.pcccTruoc).toBe(thoatNan(m as unknown as ToaPCCC, { cuaCan, chieuCaoPCCC: H }).soVuot);
  });
  it('dem căn qua PA vẫn đúng với biến thể (DT/loại lấy từ thư viện đã đăng ký)', () => {
    const m = mau('tm-i1');
    const kq = toiUuCoCau(m, { canTheo: {} }, tv, muc);
    const pa = { toa: [{ id: 't', loId: 'l', mauId: 'tm-i1', canTheo: {}, canViTri: kq.canViTri, soTangDH: 1 }] } as never;
    const pct = phanTram(demCan(pa, tv).t);
    expect(Object.values(pct).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
    for (const v of viTriCan(m, tv)) expect(tv.can.has(canDangDung(v, { canTheo: {}, canViTri: kq.canViTri }))).toBe(true);
  });
});
