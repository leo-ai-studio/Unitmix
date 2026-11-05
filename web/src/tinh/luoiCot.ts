/**
 * LƯỚI CỘT hầm (trục kết cấu): các trục song song hai phương, đánh số ① ② ③ (theo u) và A B C (theo v), khoảng cách giữa hai trục kề
 * (nhịp, m). Phương lưới = phương chiếm đa số của cột đã có (cột chân tòa) — không có cột thì theo cạnh dài nhất của ranh hầm. Trục lấy
 * theo cột có sẵn (gom cụm 0,5 m) rồi kéo đều theo nhịp `nhip` ra hết ranh: hai cột cách xa nhau mà không có trục giữa thì chèn thêm cho
 * nhịp không vượt `nhip` + 20 %. Hàm thuần (mét).
 */
import type { Diem } from './kieu';

export type TrucLuoi = { ten: string; /** toạ độ dọc phương vuông góc với trục (m) trong hệ lưới */ gia: number };
export type LuoiCot = {
  /** góc phương u (radian) so với trục x */
  goc: number;
  u: TrucLuoi[];
  v: TrucLuoi[];
  /** hộp bao ranh trong hệ lưới [u0, v0, u1, v1] */
  hop: [number, number, number, number];
  /** nhịp nhỏ nhất / lớn nhất giữa hai trục kề (m): u, v */
  nhip: { u: [number, number] | null; v: [number, number] | null };
};

const tam = (P: readonly Diem[]): Diem => [P.reduce((a, p) => a + p[0], 0) / P.length, P.reduce((a, p) => a + p[1], 0) / P.length];
const chuA = (i: number) => { let s = '', n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; };

/** Phương chiếm đa số của các cạnh (mod 90°) có trọng số độ dài; radian trong [0, π/2). */
export function phuongChinh(P: readonly (readonly Diem[])[]): number | null {
  const bin = new Map<number, number>();
  for (const poly of P) for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    let g = Math.atan2(b[1] - a[1], b[0] - a[0]) % (Math.PI / 2);
    if (g < 0) g += Math.PI / 2;
    const k = Math.round((g * 180) / Math.PI * 2) / 2; // bước 0,5°
    bin.set(k, (bin.get(k) ?? 0) + L);
  }
  let tot: number | null = null, m = 0;
  for (const [k, w] of bin) if (w > m) { m = w; tot = k; }
  return tot === null ? null : ((tot % 90) * Math.PI) / 180;
}

/** Gom các giá trị gần nhau (≤ tol) thành trục (trung bình có trọng số số lần). */
function gomTruc(xs: number[], tol: number): number[] {
  const s = [...xs].sort((a, b) => a - b), kq: { t: number; n: number }[] = [];
  for (const x of s) {
    const c = kq[kq.length - 1];
    if (c && x - c.t / c.n <= tol) { c.t += x; c.n++; } else kq.push({ t: x, n: 1 });
  }
  // chỉ giữ trục có nhiều cột đỡ (cột lẻ của riêng một tòa không thành trục lưới chính)
  const nMax = Math.max(0, ...kq.map((c) => c.n)), nguong = Math.max(2, nMax * 0.25);
  const giu = kq.filter((c) => c.n >= nguong);
  return (giu.length ? giu : kq).map((c) => c.t / c.n);
}

/** Phủ đều trục theo nhịp: từ các trục có sẵn, thêm trục để mọi nhịp ≤ nhip·1,2 và kéo ra tới mép [lo, hi]. */
function phuTruc(co: number[], lo: number, hi: number, nhip: number): number[] {
  const kq = new Set<number>(co.map((x) => Math.round(x * 100) / 100));
  const neo = co.length ? co[0] : (lo + hi) / 2;
  if (nhip > 0.5) {
    for (let x = neo; x <= hi + 1e-6; x += nhip) kq.add(Math.round(x * 100) / 100);
    for (let x = neo - nhip; x >= lo - 1e-6; x -= nhip) kq.add(Math.round(x * 100) / 100);
  }
  let ds = [...kq].filter((x) => x >= lo - 1e-6 && x <= hi + 1e-6).sort((a, b) => a - b);
  // trục dày hơn nửa nhịp (cột có sẵn lệch lưới đều) → bỏ trục sinh thêm gần trục có sẵn
  const gan = (x: number) => co.some((c) => Math.abs(c - x) < nhip * 0.35 && Math.abs(c - x) > 1e-6);
  ds = ds.filter((x) => co.some((c) => Math.abs(c - x) < 0.011) || !gan(x));
  return ds;
}

/**
 * Lưới cột của hầm: `cot` cột (đa giác m), `ranh` ranh hầm, `nhip` nhịp (m). Trả null khi không có ranh. `luoiBo` (số trục tối đa
 * mỗi phương) chặn lưới quá dày khi nhịp nhỏ.
 */
export function luoiCotHam(cot: readonly (readonly Diem[])[], ranh: readonly Diem[], nhip: number, luoiBo = 60): LuoiCot | null {
  if (ranh.length < 3) return null;
  const goc = phuongChinh(cot.length >= 2 ? cot : [ranh]) ?? phuongChinh([ranh]) ?? 0;
  const c = Math.cos(goc), s = Math.sin(goc);
  const uv = (p: Diem): Diem => [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
  const R = ranh.map(uv);
  const hop: [number, number, number, number] = [Math.min(...R.map((p) => p[0])), Math.min(...R.map((p) => p[1])), Math.max(...R.map((p) => p[0])), Math.max(...R.map((p) => p[1]))];
  const tamCot = cot.filter((p) => p.length >= 3).map((p) => uv(tam(p)));
  const u0 = gomTruc(tamCot.map((p) => p[0]), 0.5), v0 = gomTruc(tamCot.map((p) => p[1]), 0.5);
  const tr = (co: number[], lo: number, hi: number) => {
    const ds = phuTruc(co, lo, hi, nhip);
    return ds.length > luoiBo ? ds.filter((_, i) => i % Math.ceil(ds.length / luoiBo) === 0) : ds;
  };
  const u = tr(u0, hop[0], hop[2]).map((g, i) => ({ ten: String(i + 1), gia: g }));
  const v = tr(v0, hop[1], hop[3]).map((g, i) => ({ ten: chuA(i), gia: g }));
  const nh = (ds: TrucLuoi[]): [number, number] | null => {
    if (ds.length < 2) return null;
    const d = ds.slice(1).map((x, i) => x.gia - ds[i].gia);
    return [Math.min(...d), Math.max(...d)];
  };
  return { goc, u, v, hop, nhip: { u: nh(u), v: nh(v) } };
}

/** Đoạn thẳng của một trục (m, hệ thế giới) kéo qua hộp bao ranh. */
export function doanTruc(l: LuoiCot, phuong: 'u' | 'v', gia: number, lui = 0): [Diem, Diem] {
  const c = Math.cos(l.goc), s = Math.sin(l.goc), ve = (u: number, v: number): Diem => [u * c - v * s, u * s + v * c];
  return phuong === 'u' ? [ve(gia, l.hop[1] - lui), ve(gia, l.hop[3] + lui)] : [ve(l.hop[0] - lui, gia), ve(l.hop[2] + lui, gia)];
}
