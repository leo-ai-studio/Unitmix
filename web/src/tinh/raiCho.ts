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

/*
 * Lưới chỉ mục khung bao (hệ đã xoay) để kiểm va chạm nhanh mà KHÔNG đổi kết quả: phần tử (đa giác vật cản / cạnh ranh)
 * có khung bao tách hẳn khỏi hình chữ nhật thu nhỏ `s` thì không cạnh nào của nó cắt `s` và tâm `s` không nằm trong nó,
 * nên bỏ qua đúng như phép thử đầy đủ trả false. Chỉ phần tử có khung bao chạm `s` mới thử đầy đủ.
 */
type ChiMuc = {
  kt: number; u0: number; v0: number; nu: number; nv: number;
  o: number[][]; // ô lưới → chỉ số phần tử
  bb: Float64Array; // 4 số / phần tử
  dau: Uint32Array; // đánh dấu đã thử trong lượt hỏi hiện tại
  luot: number;
};

function taoChiMuc(bbs: Hcn[], kt: number): ChiMuc {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const b of bbs) {
    if (b[0] < u0) u0 = b[0];
    if (b[1] < v0) v0 = b[1];
    if (b[2] > u1) u1 = b[2];
    if (b[3] > v1) v1 = b[3];
  }
  if (!bbs.length) { u0 = v0 = 0; u1 = v1 = 0; }
  const nu = Math.max(1, Math.min(512, Math.ceil((u1 - u0) / kt) + 1));
  const nv = Math.max(1, Math.min(512, Math.ceil((v1 - v0) / kt) + 1));
  const o: number[][] = Array.from({ length: nu * nv }, () => []);
  const bb = new Float64Array(bbs.length * 4);
  bbs.forEach((b, i) => {
    bb.set(b, i * 4);
    const [a0, a1] = oLuoi(b[0], b[1], u0, v0, kt, nu, nv);
    const [b0, b1] = oLuoi(b[2], b[3], u0, v0, kt, nu, nv);
    for (let y = a1; y <= b1; y++) for (let x = a0; x <= b0; x++) o[y * nu + x].push(i);
  });
  return { kt, u0, v0, nu, nv, o, bb, dau: new Uint32Array(bbs.length), luot: 0 };
}

const oLuoi = (u: number, v: number, u0: number, v0: number, kt: number, nu: number, nv: number): [number, number] => [
  Math.max(0, Math.min(nu - 1, Math.floor((u - u0) / kt))),
  Math.max(0, Math.min(nv - 1, Math.floor((v - v0) / kt))),
];

/** Gọi `thu(i)` cho mỗi phần tử có khung bao không tách hẳn khỏi `s`; dừng và trả true khi `thu` trả true. */
function hoiChiMuc(cm: ChiMuc, s: Hcn, thu: (i: number) => boolean): boolean {
  if (++cm.luot === 0xffffffff) { cm.dau.fill(0); cm.luot = 1; }
  const [a0, a1] = oLuoi(s[0], s[1], cm.u0, cm.v0, cm.kt, cm.nu, cm.nv);
  const [b0, b1] = oLuoi(s[2], s[3], cm.u0, cm.v0, cm.kt, cm.nu, cm.nv);
  const bb = cm.bb;
  for (let y = a1; y <= b1; y++) {
    for (let x = a0; x <= b0; x++) {
      const ds = cm.o[y * cm.nu + x];
      for (let k = 0; k < ds.length; k++) {
        const i = ds[k];
        if (cm.dau[i] === cm.luot) continue;
        cm.dau[i] = cm.luot;
        const j = i * 4;
        if (bb[j + 2] < s[0] || bb[j] > s[2] || bb[j + 3] < s[1] || bb[j + 1] > s[3]) continue;
        if (thu(i)) return true;
      }
    }
  }
  return false;
}

const khungBao = (p: Diem[]): Hcn => {
  const b: Hcn = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [u, v] of p) {
    if (u < b[0]) b[0] = u;
    if (v < b[1]) b[1] = v;
    if (u > b[2]) b[2] = u;
    if (v > b[3]) b[3] = v;
  }
  return b;
};

/** Bộ kiểm hợp lệ một ô: nằm trọn trong ranh và không giao phần trong vật cản nào. Cùng kết quả với phép thử đầy đủ. */
function taoKiem(ranh: Diem[], vc: Diem[][], kt: number): (r: Hcn) => boolean {
  const n = ranh.length;
  const canh: Hcn[] = [];
  for (let i = 0, j = n - 1; i < n; j = i++) canh.push(khungBao([ranh[j], ranh[i]]));
  const cmRanh = taoChiMuc(canh, kt);
  const bbRanh = khungBao(ranh);
  const cmVc = taoChiMuc(vc.map(khungBao), kt);
  // diemTrong(·, ranh) theo hàng: các ô cùng hàng có cùng tung độ tâm → tính giao điểm tia một lần, sắp xếp, đếm bằng tìm nhị phân.
  const hang = new Map<number, Float64Array>();
  const trongRanh = (x: number, y: number): boolean => {
    let xs = hang.get(y);
    if (!xs) {
      const ds: number[] = [];
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const [xi, yi] = ranh[i];
        const [xj, yj] = ranh[j];
        if (yi > y !== yj > y) ds.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
      xs = Float64Array.from(ds).sort();
      hang.set(y, xs);
    }
    // Số giao điểm có x < giao (như diemTrong): đếm phần tử > x.
    let lo = 0, hi = xs.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] > x) hi = m; else lo = m + 1; }
    return ((xs.length - lo) & 1) === 1;
  };
  return (r: Hcn) => {
    const cu = (r[0] + r[2]) / 2, cv = (r[1] + r[3]) / 2;
    // Cắt sớm: tâm ngoài khung bao ranh thì chắc chắn không nằm trong ranh.
    if (cu < bbRanh[0] || cu > bbRanh[2] || cv < bbRanh[1] || cv > bbRanh[3]) return false;
    const s: Hcn = [r[0] + EPS, r[1] + EPS, r[2] - EPS, r[3] - EPS];
    // hcnTrongDaGiac: không cạnh ranh nào cắt s, và tâm nằm trong ranh.
    if (hoiChiMuc(cmRanh, s, (i) => doanCatHcn(ranh[(i + n - 1) % n], ranh[i], s))) return false;
    if (!trongRanh(cu, cv)) return false;
    // !vc.some(hcnGiaoDaGiac)
    return !hoiChiMuc(cmVc, s, (i) => hcnGiaoDaGiac(r, vc[i]));
  };
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
function raiMot(hopLe: (r: Hcn) => boolean, ts: KichThuocCho, offU: number, offV: number, bb: Hcn): Phuong {
  const { choRong: w, choDai: d, rongLan: lan } = ts;
  const mod = 2 * d + lan;
  const cho: Hcn[] = [];
  const lanOk: Hcn[] = [];
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
  const hopLe = taoKiem(r, vc, Math.max(4, 2 * Math.max(ts.choRong, ts.choDai)));
  let tot: Phuong | null = null;
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      const ph = raiMot(hopLe, ts, (a / 4) * ts.choRong, (b / 4) * mod, bb);
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
