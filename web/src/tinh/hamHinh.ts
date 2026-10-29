/**
 * Hình học dùng chung cho hầm (Clipper, mm nguyên). Tách từ tinh/ham.ts để các phần bố trí (khoang cháy, thang, phòng,
 * thông gió, tầng 1) dùng mà không vòng import. Toạ độ mét.
 */
import ClipperLib from 'clipper-lib';
import { xoayTinhTien } from './hinhHoc';
import type { Diem } from './kieu';

type Path = ClipperLib.IntPoint[];
const TL = 1000;
const toPath = (p: Diem[]): Path => p.map(([x, y]) => ({ X: Math.round(x * TL), Y: Math.round(y * TL) }));
const toDiem = (p: Path): Diem[] => p.map((q) => [q.X / TL, q.Y / TL]);
const dtPaths = (ps: Path[]): number => ps.reduce((a, p) => a + ClipperLib.Clipper.Area(p), 0) / (TL * TL);

function chay(loai: number, a: Path[], b: Path[] = []): Path[] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(a, ClipperLib.PolyType.ptSubject, true);
  if (b.length) c.AddPaths(b, ClipperLib.PolyType.ptClip, true);
  const kq: Path[] = [];
  c.Execute(loai, kq, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return kq;
}
const sach = (ds: Diem[][]) => ds.filter((p) => p && p.length >= 3).map(toPath);
/** Phần giao của a với b (có thể nhiều mảnh; lỗ thủng có hướng ngược). */
export const giao = (a: Diem[][], b: Diem[][]): Diem[][] => chay(ClipperLib.ClipType.ctIntersection, sach(a), sach(b)).map(toDiem);
/** a trừ b (các mảnh; lỗ thủng có hướng ngược). */
export const hieu = (a: Diem[][], b: Diem[][]): Diem[][] => {
  const pa = sach(a);
  if (!pa.length) return [];
  const pb = sach(b);
  return (pb.length ? chay(ClipperLib.ClipType.ctDifference, pa, pb) : chay(ClipperLib.ClipType.ctUnion, pa)).map(toDiem);
};
/** Diện tích a trừ b (m²). */
export const dtTru = (a: Diem[][], b: Diem[][]): number => {
  const pa = sach(a);
  if (!pa.length) return 0;
  const pb = sach(b);
  return dtPaths(pb.length ? chay(ClipperLib.ClipType.ctDifference, pa, pb) : chay(ClipperLib.ClipType.ctUnion, pa));
};
/** Diện tích hợp (không cộng trùng). */
export const dtHop = (a: Diem[][]): number => {
  const pa = sach(a);
  return pa.length ? dtPaths(chay(ClipperLib.ClipType.ctUnion, pa)) : 0;
};

/** Co đa giác vào trong d mét (góc vuông); nhiều mảnh thì giữ mảnh lớn nhất. Co hết thì []. */
export function coVao(poly: Diem[], d: number): Diem[] {
  if (!poly || poly.length < 3) return [];
  if (!(d > 0)) return poly;
  const o = new ClipperLib.ClipperOffset(4, 0.25 * TL);
  o.AddPath(toPath(poly), ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
  const kq: Path[] = [];
  o.Execute(kq, -d * TL);
  const ngoai = kq.filter((p) => ClipperLib.Clipper.Area(p) > 0).sort((a, b) => ClipperLib.Clipper.Area(b) - ClipperLib.Clipper.Area(a));
  return ngoai.length ? toDiem(ngoai[0]) : [];
}

export const hcnXoay = (cx: number, cy: number, dai: number, rong: number, gocDo: number): Diem[] =>
  xoayTinhTien([[-dai / 2, -rong / 2], [dai / 2, -rong / 2], [dai / 2, rong / 2], [-dai / 2, rong / 2]], cx, cy, gocDo);

export const dtCoDau = (p: Diem[]) => p.reduce((a, q, i) => { const r = p[(i + 1) % p.length]; return a + q[0] * r[1] - r[0] * q[1]; }, 0) / 2;

/** Điểm nằm trong đa giác (even-odd). */
export function diemTrong(x: number, y: number, poly: Diem[]): boolean {
  let vao = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) vao = !vao;
  }
  return vao;
}

/**
 * Hệ trục hầm: u dọc trục dãy đỗ (góc `goc`, rad), v vuông góc. `ve(u, v)` → toạ độ thế giới; `uv(p)` ngược lại.
 */
export type HeTruc = { goc: number; c: number; s: number; ve: (u: number, v: number) => Diem; uv: (p: Diem) => Diem };
export function heTruc(goc: number): HeTruc {
  const c = Math.cos(goc), s = Math.sin(goc);
  return { goc, c, s, ve: (u, v) => [u * c - v * s, u * s + v * c], uv: ([x, y]) => [x * c + y * s, -x * s + y * c] };
}

/** Hình chữ nhật trong hệ trục (u0..u1 × v0..v1) → đa giác thế giới (ngược chiều kim đồng hồ). */
export const hcnUv = (ht: HeTruc, u0: number, v0: number, u1: number, v1: number): Diem[] => [ht.ve(u0, v0), ht.ve(u1, v0), ht.ve(u1, v1), ht.ve(u0, v1)];

/** Khung bao trong hệ trục: [u0, v0, u1, v1]. */
export function khungUv(ht: HeTruc, p: Diem[]): [number, number, number, number] {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const q of p) {
    const [u, v] = ht.uv(q);
    if (u < u0) u0 = u; if (v < v0) v0 = v; if (u > u1) u1 = u; if (v > v1) v1 = v;
  }
  return [u0, v0, u1, v1];
}

/** Phần ranh nằm trong dải u ∈ [u0, u1], v ∈ [v0, v1] của hệ trục xoay góc `goc`. */
export function dai(ranh: Diem[], goc: number, u0: number, u1: number, v0: number, v1: number): Diem[][] {
  const c = Math.cos(goc), s = Math.sin(goc);
  const ve = (u: number, v: number): Diem => [u * c - v * s, u * s + v * c];
  return giao([ranh], [[ve(u0, v0), ve(u1, v0), ve(u1, v1), ve(u0, v1)]]);
}

/** Cắt dải bắt đầu tại u0 có diện tích ≈ dtMuc (tìm nhị phân). */
export function catDai(ranh: Diem[], goc: number, u0: number, bb: [number, number, number, number], dtMuc: number): { u1: number; manh: Diem[][] } {
  if (!(dtMuc > 0) || u0 >= bb[2]) return { u1: u0, manh: [] };
  let lo = u0, hi = bb[2];
  if (dtHop(dai(ranh, goc, u0, hi, bb[1], bb[3])) <= dtMuc) return { u1: hi, manh: dai(ranh, goc, u0, hi, bb[1], bb[3]) };
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (dtHop(dai(ranh, goc, u0, m, bb[1], bb[3])) < dtMuc) lo = m;
    else hi = m;
  }
  return { u1: hi, manh: dai(ranh, goc, u0, hi, bb[1], bb[3]) };
}

/** Hai đa giác lồi / chữ nhật có phần trong giao nhau (theo diện tích giao > ngưỡng nhỏ). */
export const giaoNhau = (a: Diem[], b: Diem[], nguong = 0.01): boolean => dtHop(giao([a], [b])) > nguong;

/** Đa giác nằm trọn trong ranh (sai số diện tích 0,05 m²). */
export const namTrongRanh = (p: Diem[], ranh: Diem[]): boolean => dtTru([p], [ranh]) < 0.05;
