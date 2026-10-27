/** Rải chỗ đỗ ô tô cho một tầng hầm: kiểu dãy đôi (chỗ – làn – chỗ), hàm thuần. Toạ độ mét. */
import type { Diem, ThongSoHam } from './kieu';

/** `cho` = chỗ thường; `xeLan` = chỗ người khuyết tật (gộp hai ô liền nhau); soCho = cho + xeLan. */
export type KetQuaRaiCho = { cho: Diem[][]; lan: Diem[][]; kho: Diem[][]; soCho: number; soKho: number; xeLan: Diem[][] };
/** Tuỳ chọn: số chỗ xe lăn cần tạo, bề rộng tối thiểu chỗ xe lăn (QCVN 13:2018 2.2.1.25: 3,5 m), góc dãy cố định (rad). */
export type TuyChonRai = { soXeLan?: number; rongXeLan?: number; goc?: number };

const EPS = 1e-6;

/** Hình chữ nhật trục song song trong hệ đã xoay: [u0, v0, u1, v1]. */
type Hcn = [number, number, number, number];

/** Điểm nằm trong đa giác (even-odd). */
function diemTrong(x: number, y: number, poly: Diem[]): boolean {
  let vao = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) vao = !vao;
  }
  return vao;
}

/** Đoạn thẳng có cắt phần trong của hình chữ nhật không (Liang–Barsky). */
function doanCatHcn(a: Diem, b: Diem, r: Hcn): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy];
  const q = [a[0] - r[0], r[2] - a[0], a[1] - r[1], r[3] - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

/** Hình chữ nhật có giao phần trong của đa giác không (chạm biên không tính). */
function hcnGiaoDaGiac(r: Hcn, poly: Diem[]): boolean {
  const s: Hcn = [r[0] + EPS, r[1] + EPS, r[2] - EPS, r[3] - EPS];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (doanCatHcn(poly[j], poly[i], s)) return true;
  }
  return diemTrong((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, poly);
}

/** Hình chữ nhật nằm trọn trong đa giác. */
function hcnTrongDaGiac(r: Hcn, poly: Diem[]): boolean {
  if (!diemTrong((r[0] + r[2]) / 2, (r[1] + r[3]) / 2, poly)) return false;
  const s: Hcn = [r[0] + EPS, r[1] + EPS, r[2] - EPS, r[3] - EPS];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (doanCatHcn(poly[j], poly[i], s)) return false;
  }
  return true;
}

/** Góc (rad) của cạnh dài nhất. */
export function gocCanhDaiNhat(ranh: Diem[]): number {
  let dai = -1;
  let goc = 0;
  for (let i = 0; i < ranh.length; i++) {
    const a = ranh[i];
    const b = ranh[(i + 1) % ranh.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > dai) {
      dai = l;
      goc = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
  }
  return goc;
}

/** Kích thước ô (chỗ đỗ hoặc kho) và làn giữa hai dãy. */
export type KichThuocCho = Pick<ThongSoHam, 'choRong' | 'choDai' | 'rongLan'>;

type Phuong = { cho: Hcn[]; lan: Hcn[] };

/** Rải một phương án với độ lệch lưới (offU, offV) trong hệ xoay. */
function raiMot(ranh: Diem[], vc: Diem[][], ts: KichThuocCho, offU: number, offV: number, bb: Hcn): Phuong {
  const { choRong: w, choDai: d, rongLan: lan } = ts;
  const mod = 2 * d + lan;
  const cho: Hcn[] = [];
  const lanOk: Hcn[] = [];
  const hopLe = (r: Hcn) => hcnTrongDaGiac(r, ranh) && !vc.some((p) => hcnGiaoDaGiac(r, p));
  const u0 = bb[0] - w + offU;
  const v0 = bb[1] - mod + offV;
  const soCot = Math.ceil((bb[2] - u0) / w) + 1;
  const soMod = Math.ceil((bb[3] - v0) / mod) + 1;
  for (let k = 0; k < soMod; k++) {
    const vb = v0 + k * mod;
    for (let c = 0; c < soCot; c++) {
      const ua = u0 + c * w;
      const ub = ua + w;
      const duoi: Hcn = [ua, vb, ub, vb + d];
      const tren: Hcn = [ua, vb + d + lan, ub, vb + mod];
      if (hopLe(duoi)) cho.push(duoi);
      if (hopLe(tren)) cho.push(tren);
      const o: Hcn = [ua, vb + d, ub, vb + d + lan];
      if (hopLe(o)) lanOk.push(o);
    }
  }
  return { cho, lan: lanOk };
}

/** Gộp các ô làn liền nhau theo u thành dải. */
function gopLan(o: Hcn[]): Hcn[] {
  const nhom = new Map<string, Hcn[]>();
  for (const r of o) {
    const key = r[1].toFixed(4);
    const g = nhom.get(key);
    if (g) g.push(r);
    else nhom.set(key, [r]);
  }
  const kq: Hcn[] = [];
  for (const g of nhom.values()) {
    g.sort((a, b) => a[0] - b[0]);
    let cur: Hcn = [...g[0]] as Hcn;
    for (let i = 1; i < g.length; i++) {
      if (g[i][0] - cur[2] < 1e-6) cur[2] = g[i][2];
      else {
        kq.push(cur);
        cur = [...g[i]] as Hcn;
      }
    }
    kq.push(cur);
  }
  return kq;
}

/**
 * Rải chỗ đỗ ô tô trong ranh một tầng hầm. Dãy chạy song song cạnh dài nhất,
 * thử nhiều độ lệch lưới và giữ phương án nhiều chỗ nhất. Chưa có kho (kho = []).
 */
export function raiChoDo(ranh: Diem[], vatCan: Diem[][], ts: KichThuocCho, tuyChon: TuyChonRai = {}): KetQuaRaiCho {
  const rong: KetQuaRaiCho = { cho: [], lan: [], kho: [], soCho: 0, soKho: 0, xeLan: [] };
  if (!ranh || ranh.length < 3 || !(ts.choRong > 0) || !(ts.choDai > 0) || !(ts.rongLan >= 0)) return rong;

  const goc = tuyChon.goc ?? gocCanhDaiNhat(ranh);
  const c = Math.cos(goc);
  const s = Math.sin(goc);
  const xoay = (p: Diem): Diem => [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
  const xoayNguoc = (u: number, v: number): Diem => [u * c - v * s, u * s + v * c];

  const r = ranh.map(xoay);
  const vc = (vatCan ?? []).filter((p) => p && p.length >= 3).map((p) => p.map(xoay));
  const bb: Hcn = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [u, v] of r) {
    bb[0] = Math.min(bb[0], u);
    bb[1] = Math.min(bb[1], v);
    bb[2] = Math.max(bb[2], u);
    bb[3] = Math.max(bb[3], v);
  }

  const mod = 2 * ts.choDai + ts.rongLan;
  let tot: Phuong | null = null;
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      const ph = raiMot(r, vc, ts, (a / 4) * ts.choRong, (b / 4) * mod, bb);
      if (!tot || ph.cho.length > tot.cho.length) tot = ph;
    }
  }
  if (!tot) return rong;

  const ve = (h: Hcn): Diem[] => [xoayNguoc(h[0], h[1]), xoayNguoc(h[2], h[1]), xoayNguoc(h[2], h[3]), xoayNguoc(h[0], h[3])];
  const { thuong, xeLan } = tachXeLan(tot.cho, tuyChon.soXeLan ?? 0, tuyChon.rongXeLan ?? 3.5);
  const cho = thuong.map(ve);
  return { cho, lan: gopLan(tot.lan).map(ve), kho: [], soCho: cho.length + xeLan.length, soKho: 0, xeLan: xeLan.map(ve) };
}

/**
 * Gộp các ô liền nhau trong cùng dãy thành chỗ xe lăn (đủ bề rộng `rong`), lấy từ đầu dãy, tối đa `n` chỗ.
 * Ô hẹp hơn `rong` thì gộp 2 (hoặc nhiều hơn) ô liền nhau.
 */
function tachXeLan(cho: Hcn[], n: number, rong: number): { thuong: Hcn[]; xeLan: Hcn[] } {
  if (n <= 0 || !cho.length) return { thuong: cho, xeLan: [] };
  const nhom = new Map<string, Hcn[]>();
  for (const r of cho) {
    const k = `${r[1].toFixed(4)}`;
    const g = nhom.get(k);
    if (g) g.push(r);
    else nhom.set(k, [r]);
  }
  const dung = new Set<Hcn>();
  const xeLan: Hcn[] = [];
  for (const g of nhom.values()) {
    g.sort((a, b) => a[0] - b[0]);
    let i = 0;
    while (i < g.length && xeLan.length < n) {
      let j = i;
      while (g[j][2] - g[i][0] < rong - 1e-6 && j + 1 < g.length && g[j + 1][0] - g[j][2] < 1e-6) j++;
      if (g[j][2] - g[i][0] >= rong - 1e-6) {
        xeLan.push([g[i][0], g[i][1], g[j][2], g[i][3]]);
        for (let k = i; k <= j; k++) dung.add(g[k]);
        i = j + 1;
      } else i = j + 1;
    }
    if (xeLan.length >= n) break;
  }
  return { thuong: cho.filter((r) => !dung.has(r)), xeLan };
}
