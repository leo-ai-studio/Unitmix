import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { demCan } from './coCau';
import { taoThuVien, type CanMau, type Diem, type ToaDat } from './kieu';
import { canCuaToa, canDangDung, soCanChuVi, ungVienDoi, veLoiTaiViTri, viTriCan, type NetVe, type ToaCoMat } from './matBang';
import { dtHanhLangTang, phanChungPhanBo } from './phanChung';
import { toiUuCoCau } from './toiUu';

const lib = new URL('../../public/lib/', import.meta.url);
const doc = <T>(p: string) => JSON.parse(readFileSync(new URL(p, lib), 'utf8')) as T;
const toaDs = doc<(ToaCoMat & { duong_bao: Diem[]; hanhlang_ve: Diem[][]; truc: { goc_deg: number; a_dau: number; a_cuoi: number; b_mm: number }[] })[]>('toa.json');
const tv = taoThuVien(toaDs, doc<CanMau[]>('can.json'));
const toa = (id: string) => toaDs.find((t) => t.id === id)!;
const dat = (mauId: string, kh: Partial<ToaDat> = {}): ToaDat => ({ id: 'T', loId: 'L', mauId, x: 0, y: 0, gocDo: 0, soTangDH: 10, soTangDe: 1, caoDe: 4.5, caoDH: 3.3, coApMai: false, deOffset: 0, canTheo: {}, ...kh });
const muc = (o: Partial<Record<'stu' | '1pn' | '2pn' | '2pnp' | '3pn', number>>) => ({ stu: 0, '1pn': 0, '2pn': 0, '2pnp': 0, '3pn': 0, ...o });

describe('vị trí căn trên tầng', () => {
  it('mọi mẫu tòa: số vị trí = số căn/tầng và khớp co_cau', () => {
    for (const t of toaDs) {
      const vts = viTriCan(t, tv);
      expect(vts.length, t.id).toBe(t.so_can_tang);
      const dem: Record<string, number> = {};
      vts.forEach((v) => (dem[v.canGocId] = (dem[v.canGocId] ?? 0) + 1));
      expect(dem, t.id).toEqual(t.co_cau);
    }
  });
  it('đổi theo vị trí thắng đổi theo mẫu, rồi tới căn gốc', () => {
    const vt = viTriCan(toa('tm-u2'), tv)[0];
    expect(canDangDung(vt, { canTheo: {} })).toBe(vt.canGocId);
    expect(canDangDung(vt, { canTheo: { [vt.canGocId]: 'A' } })).toBe('A');
    expect(canDangDung(vt, { canTheo: { [vt.canGocId]: 'A' }, canViTri: { [vt.khoa]: 'B' } })).toBe('B');
  });
  it('không đổi theo vị trí thì canCuaToa = co_cau; có đổi thì đếm theo vị trí', () => {
    const t = toa('tm-u2'), vts = viTriCan(t, tv);
    expect(Object.fromEntries(canCuaToa(t, { canTheo: {} }, tv))).toEqual(t.co_cau);
    const goc = vts.find((v) => v.canGocId === 'tm-2pn-m2')!;
    const kq = Object.fromEntries(canCuaToa(t, { canTheo: {}, canViTri: { [goc.khoa]: 'tm-2pn-m1' } }, tv));
    expect(kq['tm-2pn-m1']).toBe((t.co_cau['tm-2pn-m1'] ?? 0) + 1);
    expect(kq['tm-2pn-m2']).toBe(t.co_cau['tm-2pn-m2'] - 1);
    expect(Object.values(kq).reduce((a, b) => a + b, 0)).toBe(t.so_can_tang);
  });
  it('demCan dùng đổi theo vị trí', () => {
    // tm-z1 có căn góc 2PN 9000 (tm-2pn-g1) đổi được sang 2PN+ (tm-2pnp-g1)
    const t = toaDs.find((x) => viTriCan(x, tv).some((v) => v.canGocId === 'tm-2pn-g1'))!;
    const vt = viTriCan(t, tv).find((v) => v.canGocId === 'tm-2pn-g1')!;
    const pa = (td: ToaDat) => ({ phienBan: 1 as const, lo: [], heSo: { can: 1, chung: 1, thuongMai: 1, ham: 0 }, nguong: { dtCanM2: 2, kichThuocM: 0.2, coCauDiem: 5 }, toa: [td], ham: { soTang: 0, ranh: null, nhip: 8.4, rongLan: 6, choDai: 5, choRong: 2.5, dtKho: 6 } });
    const truoc = demCan(pa(dat(t.id)), tv).T, sau = demCan(pa(dat(t.id, { canViTri: { [vt.khoa]: 'tm-2pnp-g1' } })), tv).T;
    expect(sau['2pn']).toBe(truoc['2pn'] - 10);
    expect(sau['2pnp']).toBe(truoc['2pnp'] + 10);
  });
  it('ứng viên đổi: cùng nhóm, bề ngang, chiều sâu, đúng giữa/góc (quy tắc vị trí căn); V / Y không đổi', () => {
    expect(ungVienDoi('tm-2pn-g1', tv).map((c) => c.id).sort()).toEqual(['tm-2pnp-g1', 'tm-2pnp-g2']);
    expect(ungVienDoi('tm-2pn-g1', tv, true).map((c) => c.id).sort()).toEqual(['tm-2pnp-g1', 'tm-2pnp-g2']);
    expect(ungVienDoi('tm-2pn-y1', tv)).toEqual([]);
    expect(ungVienDoi('tm-2pn-v1', tv)).toEqual([]);
    expect(ungVienDoi('tm-3pn-g1', tv)).toEqual([]);
  });
});

describe('đánh số căn quanh chu vi', () => {
  it('mọi tòa: số 1..n không trùng', () => {
    for (const t of toaDs) {
      const vts = viTriCan(t, tv), so = soCanChuVi(t.duong_bao, vts);
      expect([...so.values()].sort((a, b) => a - b), t.id).toEqual(vts.map((_, i) => i + 1));
    }
  });
  it('U2: CH-01 ở hàng dưới cùng', () => {
    const t = toa('tm-u2'), vts = viTriCan(t, tv), so = soCanChuVi(t.duong_bao, vts);
    const dau = vts.find((v) => so.get(v.khoa) === 1)!;
    const yThap = Math.min(...t.duong_bao.map((p) => p[1]));
    expect(Math.min(...dau.goc.map((p) => p[1])) - yThap).toBeLessThan(800);
  });
});

describe('hình học lõi đặt theo điểm chèn', () => {
  it('bao tường sau khi đặt nằm trong khung bb_ve_mm của bản vẽ (±400 mm) ở mọi lõi', () => {
    let soLoi = 0;
    for (const t of toaDs) for (const m of t.mat) for (const q of m.phan_tu) {
      const bb = (q as { bb_ve_mm?: number[] }).bb_ve_mm;
      if (q.loai === 'can' || !bb) continue;
      const id = (q.block || '').replace(/^x_/, '').replace(/_/g, '-');
      let g: { bao_tuong_mm?: number[]; paths: NetVe[] };
      try { g = doc(`loi/loi-${id}.json`); } catch { continue; }
      if (!g.bao_tuong_mm) continue;
      const [a, b, c, d] = g.bao_tuong_mm;
      const p = veLoiTaiViTri([{ cat: 'x', pts: [[a, b], [c, d]] }], q)[0].pts;
      const xs = p.map((z) => z[0]), ys = p.map((z) => z[1]);
      soLoi++;
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(bb[0] - 400);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(bb[1] - 400);
      expect(Math.max(...xs)).toBeLessThanOrEqual(bb[2] + 400);
      expect(Math.max(...ys)).toBeLessThanOrEqual(bb[3] + 400);
    }
    expect(soLoi).toBeGreaterThan(50);
  });
});

describe('tối ưu cơ cấu', () => {
  it('mục tiêu toàn 2PN+: giảm điểm lệch, chỉ đổi căn cùng bề ngang, chiều sâu, giữa/góc', () => {
    const t = toaDs.find((x) => viTriCan(x, tv).some((v) => v.canGocId === 'tm-2pn-g1'))!;
    const kq = toiUuCoCau(t, { canTheo: {} }, tv, muc({ '2pnp': 100 }));
    expect(kq.diemSau).toBeLessThan(kq.diemTruoc);
    expect(kq.soDoi).toBeGreaterThan(0);
    const vts = viTriCan(t, tv);
    for (const [kh, id] of Object.entries(kq.canViTri)) {
      const vt = vts.find((v) => v.khoa === kh)!, a = tv.can.get(vt.canGocId)!, b = tv.can.get(id)!;
      expect([b.rong_mm, b.sau_mm, b.vi_tri, b.nhom]).toEqual([a.rong_mm, a.sau_mm, a.vi_tri, a.nhom]);
    }
  });
  it('mục tiêu đúng bằng hiện trạng: không đổi gì', () => {
    const t = toa('tm-u2'), dem: Record<string, number> = {};
    viTriCan(t, tv).forEach((v) => { const l = tv.can.get(v.canGocId)!.loai; dem[l] = (dem[l] ?? 0) + 1; });
    const kq = toiUuCoCau(t, { canTheo: {} }, tv, muc(Object.fromEntries(Object.entries(dem).map(([k, v]) => [k, (v / t.so_can_tang) * 100]))));
    expect(kq.soDoi).toBe(0);
    expect(kq.canViTri).toEqual({});
  });
  it('chạy lại trên kết quả cũ thì ổn định', () => {
    const t = toaDs.find((x) => viTriCan(x, tv).some((v) => v.canGocId === 'tm-2pn-g1'))!, m = muc({ '2pnp': 100 });
    const lan1 = toiUuCoCau(t, { canTheo: {} }, tv, m);
    const lan2 = toiUuCoCau(t, { canTheo: {}, canViTri: lan1.canViTri }, tv, m);
    expect(lan2.soDoi).toBe(0);
    expect(lan2.diemSau).toBeCloseTo(lan1.diemSau);
  });
});

describe('phần chung', () => {
  it('DT hành lang đo từ nét vẽ tay, không cộng trùng; thiếu nét thì ước tính theo trục', () => {
    const t = toa('tm-u2'), kq = dtHanhLangTang(t);
    expect(kq.uocTinh).toBe(false);
    expect(kq.m2).toBeGreaterThan(50);
    expect(kq.m2).toBeLessThan(t.dtxd_m2);
    const uoc = dtHanhLangTang({ hanh_lang_mm: t.hanh_lang_mm, truc: t.truc });
    expect(uoc.uocTinh).toBe(true);
    expect(uoc.m2).toBeGreaterThan(0);
    expect(dtHanhLangTang({ hanh_lang_mm: 1800, hanhlang_ve: [[[0, 0], [10000, 0]], [[0, 0], [10000, 0]]] }).m2).toBeCloseTo(18, 1);
  });
  it('tổng phần chung phân bổ = DT hành lang; căn lớn hơn gánh nhiều hơn', () => {
    const pb = phanChungPhanBo(120, { a: 10, b: 20 }, { a: 50, b: 100 });
    expect(10 * pb.a + 20 * pb.b).toBeCloseTo(120);
    expect(pb.b / pb.a).toBeCloseTo(2);
    expect(phanChungPhanBo(120, { a: 0 }, { a: 50 }).a).toBe(0);
  });
});
