/**
 * Bố trí tầng hầm (hàm thuần, toạ độ mét), gọi từ `raiHamTinh` (chạy trong Web Worker):
 * - khoang cháy: chia sàn thành ô gần vuông (cắt u rồi v, đường cắt v theo lưng dãy chỗ) ≤ DT tối đa (QCVN 13:2018/BXD 2.2.2 a, Bảng 4: bậc I, S0 ≤ 3 000 m²/tầng/khoang),
 *   tường ngăn cháy loại 1 REI 150, cửa / rèm EI 60 (QCVN 06:2022/BXD Bảng 1, 2) ở chỗ làn xe cắt tường;
 * - thang thoát nạn: thang lõi tòa xuống hầm + thang thêm, mỗi khoang ≥ 2 lối ra phân tán (QCVN 13 2.2.1.14), mọi điểm cách lối
 *   ra gần nhất ≤ 40 m (QCVN 13 Bảng 3, ngầm) — đo kiểu Manhattan theo trục dãy (gần đường đi giữa dãy xe hơn đo thẳng);
 *   thang đặt trên tường ngăn cháy phục vụ cả hai khoang (buồng thang không tính vào DT khoang, QCVN 06 H.6.2 — chờ chủ nhiệm chốt);
 * - cụm quạt + hộp gió mỗi khoang sát tường ngoài (khoang giữa sàn: trên dãy chỗ), hộp gió không dưới chân tháp (miệng gió lên tầng 1);
 * - phòng rác cạnh lõi tòa ở hầm 1; kiểm cụt đường / liên thông làn xe; chọn chỗ xe lăn gần lõi, chỗ sạc gần trạm điện.
 */
import { dtHop, dtTru, giao, hcnUv, type HeTruc, diemTrong } from './hamHinh';
import type { Diem } from './kieu';
import type { Hcn } from './raiCho';
import { trongTam } from './hinhHoc';

/* ---------- Hình học nhanh trong hệ trục (không Clipper) ---------- */

/** DT phần đa giác (hệ trục) nằm trong hình chữ nhật [u0,u1]×[v0,v1]: cắt Sutherland–Hodgman bốn nửa mặt phẳng (cửa sổ lồi → DT đúng). */
export function dtTrongHcn(p: Diem[], u0: number, u1: number, v0: number, v1: number): number {
  const cat = (ds: Diem[], trong: (q: Diem) => boolean, giaoD: (a: Diem, b: Diem) => Diem): Diem[] => {
    const kq: Diem[] = [];
    for (let i = 0; i < ds.length; i++) {
      const a = ds[i], b = ds[(i + 1) % ds.length], ta = trong(a), tb = trong(b);
      if (ta) kq.push(a);
      if (ta !== tb) kq.push(giaoD(a, b));
    }
    return kq;
  };
  const gU = (u: number) => (a: Diem, b: Diem): Diem => [u, a[1] + ((u - a[0]) * (b[1] - a[1])) / (b[0] - a[0])];
  const gV = (v: number) => (a: Diem, b: Diem): Diem => [a[0] + ((v - a[1]) * (b[0] - a[0])) / (b[1] - a[1]), v];
  let q = cat(p, (x) => x[0] >= u0, gU(u0));
  if (q.length) q = cat(q, (x) => x[0] <= u1, gU(u1));
  if (q.length) q = cat(q, (x) => x[1] >= v0, gV(v0));
  if (q.length) q = cat(q, (x) => x[1] <= v1, gV(v1));
  if (q.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}

/** Hình chữ nhật (hệ trục) nằm trọn trong đa giác (hệ trục): 4 góc trong và không cạnh nào cắt phần trong. */
export function hcnTrong(r: Hcn, p: Diem[]): boolean {
  const e = 1e-6;
  const s: Hcn = [r[0] + e, r[1] + e, r[2] - e, r[3] - e];
  for (const [u, v] of [[s[0], s[1]], [s[2], s[1]], [s[2], s[3]], [s[0], s[3]]] as Diem[]) if (!diemTrong(u, v, p)) return false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[j], b = p[i];
    // đoạn ab cắt phần trong s? (Liang–Barsky)
    let t0 = 0, t1 = 1;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const pp = [-dx, dx, -dy, dy], qq = [a[0] - s[0], s[2] - a[0], a[1] - s[1], s[3] - a[1]];
    let cat = true;
    for (let k = 0; k < 4 && cat; k++) {
      if (pp[k] === 0) { if (qq[k] < 0) cat = false; } else {
        const t = qq[k] / pp[k];
        if (pp[k] < 0) { if (t > t1) cat = false; else if (t > t0) t0 = t; } else { if (t < t0) cat = false; else if (t < t1) t1 = t; }
      }
    }
    if (cat && t0 < t1) return false;
  }
  return true;
}

/* ---------- Khoang cháy ---------- */

export type KhoangChay = {
  so: number; // 0-based
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  /** Các mảnh sàn của khoang (thế giới). */
  manh: Diem[][];
  /** DT khoang (đã trừ buồng thang, QCVN 06 H.6.2). */
  dt: number;
  /** Chỉ số thang (trong `ThangThoat[]`) phục vụ khoang. */
  thang: number[];
  /** Cự ly lớn nhất từ điểm trong khoang tới lối ra gần nhất (m, Manhattan theo trục). */
  cuLyMax: number;
  /** Số điểm lưới (4 m) vượt cự ly. */
  diemVuot: number;
};

/** Khoảng v của đường u = uc nằm trong đa giác (hệ trục). */
export function doanCatU(ranhUv: Diem[], uc: number): [number, number][] {
  const vs: number[] = [];
  for (let i = 0, j = ranhUv.length - 1; i < ranhUv.length; j = i++) {
    const [ua, va] = ranhUv[j], [ub, vb] = ranhUv[i];
    if ((ua > uc) !== (ub > uc)) vs.push(va + ((uc - ua) * (vb - va)) / (ub - ua));
  }
  vs.sort((a, b) => a - b);
  const kq: [number, number][] = [];
  for (let k = 0; k + 1 < vs.length; k += 2) kq.push([vs[k], vs[k + 1]]);
  return kq;
}
/** Khoảng u của đường v = vc nằm trong đa giác (hệ trục). */
const doanCatV = (ranhUv: Diem[], vc: number): [number, number][] => doanCatU(ranhUv.map(([u, v]) => [v, u]), vc);

export type TuongKhoang = { a: Diem; b: Diem; /** u = const (cắt ngang làn) hay v = const (dọc lưng hai dãy chỗ). */ huong: 'u' | 'v'; c: number; t0: number; t1: number };

/**
 * Chia khoang (QCVN 13:2018 Bảng 4): n = ⌈DT / DT tối đa⌉ ô gần vuông — cắt theo u thành dải DT bằng nhau, mỗi dải cắt theo v;
 * đường cắt v bắt vào lưng hai dãy chỗ (v0Luoi + k·mod) để tường không chạy dọc làn. Ô nào vẫn > DT tối đa thì tăng số ô dải đó.
 */
export function chiaKhoang(ranh: Diem[], ht: HeTruc, bb: [number, number, number, number], dtMax: number, luoi: { v0: number; mod: number } | null = null): { khoang: KhoangChay[]; tuong: TuongKhoang[]; catU: number[] } {
  const ranhUv = ranh.map(ht.uv);
  const dt = dtTrongHcn(ranhUv, -Infinity, Infinity, -Infinity, Infinity);
  const max = Math.max(100, dtMax);
  const n = Math.max(1, Math.ceil(dt / max - 1e-9));
  const W = bb[2] - bb[0], H = bb[3] - bb[1];
  const nu = Math.max(1, Math.min(n, Math.round(Math.sqrt((n * W) / Math.max(1, H)))));
  const dtU = (u0: number, u1: number) => dtTrongHcn(ranhUv, u0, u1, -Infinity, Infinity);
  const catU: number[] = [];
  for (let i = 1; i < nu; i++) {
    const muc = (dt * i) / nu;
    let lo = catU[catU.length - 1] ?? bb[0], hi = bb[2];
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (dtU(bb[0], m) < muc) lo = m; else hi = m; }
    catU.push(Math.round(hi * 100) / 100);
  }
  const bienU = [bb[0] - 1, ...catU, bb[2] + 1];
  const khoang: KhoangChay[] = [];
  const tuong: TuongKhoang[] = [];
  const bat = (v: number) => (luoi ? luoi.v0 + Math.round((v - luoi.v0) / luoi.mod) * luoi.mod : v);
  for (let i = 0; i < nu; i++) {
    const u0 = bienU[i], u1 = bienU[i + 1];
    const dtDai = dtU(u0, u1);
    let nv = Math.max(1, Math.ceil(dtDai / max - 1e-9));
    let catV: number[] = [];
    for (let lanThu = 0; lanThu < 6; lanThu++) {
      catV = [];
      for (let j = 1; j < nv; j++) {
        const muc = (dtDai * j) / nv;
        let lo = catV[catV.length - 1] ?? bb[1], hi = bb[3];
        for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (dtTrongHcn(ranhUv, u0, u1, -Infinity, m) < muc) lo = m; else hi = m; }
        const v = bat(hi);
        if (v > (catV[catV.length - 1] ?? bb[1]) + 1 && v < bb[3] - 1) catV.push(Math.round(v * 100) / 100);
      }
      const bienV = [bb[1] - 1, ...catV, bb[3] + 1];
      let vuot = false;
      for (let j = 0; j + 1 < bienV.length; j++) if (dtTrongHcn(ranhUv, u0, u1, bienV[j], bienV[j + 1]) > max) vuot = true;
      if (!vuot) break;
      nv++;
    }
    const bienV = [bb[1] - 1, ...catV, bb[3] + 1];
    for (let j = 0; j + 1 < bienV.length; j++) {
      const v0 = bienV[j], v1 = bienV[j + 1];
      if (dtTrongHcn(ranhUv, u0, u1, v0, v1) < 1) continue;
      const manh = giao([ranh], [hcnUv(ht, u0, v0, u1, v1)]);
      khoang.push({ so: khoang.length, u0: Math.max(u0, bb[0]), u1: Math.min(u1, bb[2]), v0: Math.max(v0, bb[1]), v1: Math.min(v1, bb[3]), manh, dt: dtHop(manh), thang: [], cuLyMax: 0, diemVuot: 0 });
    }
    for (const vc of catV) {
      for (const [a, b] of doanCatV(ranhUv, vc)) {
        const t0 = Math.max(a, u0), t1 = Math.min(b, u1);
        if (t1 - t0 > 0.5) tuong.push({ a: ht.ve(t0, vc), b: ht.ve(t1, vc), huong: 'v', c: vc, t0, t1 });
      }
    }
  }
  for (const uc of catU) for (const [v0, v1] of doanCatU(ranhUv, uc)) tuong.push({ a: ht.ve(uc, v0), b: ht.ve(uc, v1), huong: 'u', c: uc, t0: v0, t1: v1 });
  return { khoang, tuong, catU };
}

/* ---------- Thang thoát nạn ---------- */

export type ThangThoat = {
  poly: Diem[];
  tam: Diem;
  /** `loi` = thang bộ trong lõi tòa xuống hầm; `them` = thang thoát nạn hầm đặt thêm (ra thẳng tầng 1). */
  nguon: 'loi' | 'them';
  /** Đặt trên tường ngăn cháy, phục vụ hai khoang. */
  chung: boolean;
  khoang: number[];
};

type ODiem = { u: number; v: number };
const khungUvP = (ht: HeTruc, p: Diem[]): Hcn => {
  let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
  for (const q of p) { const [u, v] = ht.uv(q); u0 = Math.min(u0, u); v0 = Math.min(v0, v); u1 = Math.max(u1, u); v1 = Math.max(v1, v); }
  return [u0, v0, u1, v1];
};
/** Cự ly Manhattan từ điểm tới hình chữ nhật (hệ trục). */
const kcHcn = (p: ODiem, r: Hcn) => Math.max(0, r[0] - p.u, p.u - r[2]) + Math.max(0, r[1] - p.v, p.v - r[3]);
const chongHcn = (a: Hcn, b: Hcn, d = 0) => a[0] < b[2] + d && b[0] < a[2] + d && a[1] < b[3] + d && b[1] < a[3] + d;

/** Lưới điểm 4 m trong khoang (hệ trục). */
function luoiDiem(ranhUv: Diem[], k: KhoangChay, buoc = 4): ODiem[] {
  const ds: ODiem[] = [];
  for (let u = k.u0 + buoc / 2; u < k.u1; u += buoc) for (let v = k.v0 + buoc / 2; v < k.v1; v += buoc) if (diemTrong(u, v, ranhUv)) ds.push({ u, v });
  return ds;
}

export type TuyChonThang = { rong: number; dai: number; cuLy: number };

/**
 * Đặt thang thoát nạn: bắt đầu từ thang lõi tòa; với từng khoang còn < 2 lối ra hoặc còn điểm vượt cự ly, chọn tham lam một vị trí
 * ứng viên (dọc tường ngoài, trên tường ngăn cháy — phục vụ hai khoang, cuối cùng là trong sàn) phủ thêm nhiều điểm nhất; khi còn
 * thiếu lối ra thì ưu tiên vị trí xa lối ra sẵn có (phân tán).
 */
export function datThang(ranh: Diem[], ht: HeTruc, khoang: KhoangChay[], tuong: TuongKhoang[], thangLoi: Diem[][], vatCan: Diem[][], o: TuyChonThang): ThangThoat[] {
  const ds: ThangThoat[] = [];
  const hcnCua: Hcn[] = [];
  const ranhUv = ranh.map(ht.uv);
  const thuocKhoang = (r: Hcn): number[] => khoang.filter((k) => r[2] > k.u0 + 0.3 && r[0] < k.u1 - 0.3 && r[3] > k.v0 + 0.3 && r[1] < k.v1 - 0.3).map((k) => k.so);
  for (const p of thangLoi) {
    const r = khungUvP(ht, p);
    if (dtTrongHcn(ranhUv, r[0], r[2], r[1], r[3]) < 1) continue;
    const kh = thuocKhoang(r);
    ds.push({ poly: p, tam: trongTam(p), nguon: 'loi', chung: kh.length > 1, khoang: kh });
    hcnCua.push(r);
  }
  type UngVien = { r: Hcn; loai: 'tuong' | 'chung' | 'trong'; kh: number[] };
  const theoKhoang: UngVien[][] = khoang.map(() => []);
  const { rong, dai } = o;
  const vc = vatCan.map((p) => khungUvP(ht, p));
  const themUv = (r: Hcn, loai: UngVien['loai']) => {
    if (vc.some((x) => chongHcn(x, r, 0.2))) return;
    if (!hcnTrong(r, ranhUv)) return;
    const kh = thuocKhoang(r);
    const c: UngVien = { r, loai, kh };
    for (const k of kh) theoKhoang[k].push(c);
  };
  // dọc cạnh ranh song song trục u hoặc v (thang sát tường ngoài, ra thẳng tầng 1), lùi vào 0,05 m
  for (let i = 0; i < ranhUv.length; i++) {
    const a = ranhUv[i], b = ranhUv[(i + 1) % ranhUv.length];
    const du = b[0] - a[0], dv = b[1] - a[1], l = Math.hypot(du, dv);
    if (l < dai) continue;
    const ngang = Math.abs(dv) < 0.05 * l, doc = Math.abs(du) < 0.05 * l;
    if (!ngang && !doc) continue;
    for (let t = dai / 2; t <= l - dai / 2; t += 4) {
      const p: Diem = [a[0] + (du * t) / l, a[1] + (dv * t) / l];
      if (ngang) for (const s of [1, -1]) themUv([p[0] - dai / 2, s > 0 ? p[1] + 0.05 : p[1] - 0.05 - rong, p[0] + dai / 2, s > 0 ? p[1] + 0.05 + rong : p[1] - 0.05], 'tuong');
      else for (const s of [1, -1]) themUv([s > 0 ? p[0] + 0.05 : p[0] - 0.05 - rong, p[1] - dai / 2, s > 0 ? p[0] + 0.05 + rong : p[0] - 0.05, p[1] + dai / 2], 'tuong');
    }
  }
  // trên tường ngăn cháy: buồng thang vắt qua tường (vào được từ hai khoang)
  for (const w of tuong) {
    for (let t = w.t0 + rong / 2 + 0.05; t <= w.t1 - rong / 2 - 0.05; t += 4) {
      if (w.huong === 'u') themUv([w.c - dai / 2, t - rong / 2, w.c + dai / 2, t + rong / 2], 'chung');
      else themUv([t - rong / 2, w.c - dai / 2, t + rong / 2, w.c + dai / 2], 'chung');
    }
  }
  const diemK = khoang.map((k) => luoiDiem(ranhUv, k));
  const kcMin = (p: ODiem, k: KhoangChay) => {
    let m = Infinity;
    for (const i of k.thang) m = Math.min(m, kcHcn(p, hcnCua[i]));
    return m;
  };
  const ganThang = (i: number) => { for (const s of ds[i].khoang) khoang[s].thang.push(i); };
  for (const k of khoang) k.thang = [];
  ds.forEach((_, i) => ganThang(i));
  for (const k of khoang) {
    let daThemTrong = false;
    for (let lan = 0; lan < 12; lan++) {
      const loiRa = k.thang.length;
      const vuot = diemK[k.so].filter((p) => kcMin(p, k) > o.cuLy);
      if (loiRa >= 2 && !vuot.length) break;
      // hết ứng viên tường: thêm lưới trong sàn của khoang (một lần)
      if (!daThemTrong && !theoKhoang[k.so].some((c) => !hcnCua.some((x) => chongHcn(x, c.r, 1)))) {
        daThemTrong = true;
        for (let u = k.u0 + dai; u < k.u1 - dai; u += 6) for (let v = k.v0 + dai; v < k.v1 - dai; v += 6) themUv([u - dai / 2, v - rong / 2, u + dai / 2, v + rong / 2], 'trong');
      }
      let tot: UngVien | null = null, diemTot = -Infinity;
      for (const c of theoKhoang[k.so]) {
        if (hcnCua.some((x) => chongHcn(x, c.r, 1))) continue;
        let phu = 0;
        for (const p of vuot) if (kcHcn(p, c.r) <= o.cuLy) phu++;
        const xa = loiRa ? Math.min(...k.thang.map((i) => kcHcn({ u: (c.r[0] + c.r[2]) / 2, v: (c.r[1] + c.r[3]) / 2 }, hcnCua[i]))) : o.cuLy;
        const d = phu * 10 + (loiRa < 2 ? 500 + Math.min(xa, 2 * o.cuLy) * 5 : 0) + (c.loai === 'chung' ? 8 : 0) - (c.loai === 'trong' ? 60 : 0);
        if (d > diemTot) { diemTot = d; tot = c; }
      }
      if (!tot) {
        if (daThemTrong) break;
        daThemTrong = true;
        for (let u = k.u0 + dai; u < k.u1 - dai; u += 6) for (let v = k.v0 + dai; v < k.v1 - dai; v += 6) themUv([u - dai / 2, v - rong / 2, u + dai / 2, v + rong / 2], 'trong');
        continue;
      }
      if (loiRa >= 2 && diemTot <= 0) break;
      const poly = hcnUv(ht, tot.r[0], tot.r[1], tot.r[2], tot.r[3]);
      ds.push({ poly, tam: trongTam(poly), nguon: 'them', chung: tot.kh.length > 1, khoang: tot.kh });
      hcnCua.push(tot.r);
      ganThang(ds.length - 1);
    }
  }
  // Ghi lại số liệu khoang (DT trừ buồng thang, cự ly lớn nhất)
  for (const k of khoang) {
    const thangK = k.thang.map((i) => ds[i].poly);
    k.dt = thangK.length ? dtTru(k.manh, thangK) : k.dt;
    let m = 0, vuot = 0;
    for (const p of diemK[k.so]) { const d = kcMin(p, k); if (d > m) m = d; if (d > o.cuLy) vuot++; }
    k.cuLyMax = Number.isFinite(m) ? Math.round(m * 10) / 10 : Infinity;
    k.diemVuot = vuot;
  }
  return ds;
}

/* ---------- Cụm quạt + hộp gió sát tường ngoài, phòng cạnh lõi ---------- */

export type OngGio = { poly: Diem[]; loai: 'thai' | 'cap'; khoang: number; dt: number };

/**
 * Tìm chỗ cho một hình chữ nhật sâu `sau` (vuông góc tường), dài `dai` dọc tường ngoài, nằm trong ô khoang [u0,u1]×[v0,v1].
 * Thử các cạnh ranh song song trục u (tường dài), trượt 1 m, gần giữa khoang trước; không có tường ngoài (khoang giữa sàn) thì
 * đặt trong sàn lên dãy chỗ (`dayCho`: các v bắt đầu dãy). Hợp lệ khi nằm trong ranh, không chồng vật cản, không `loaiTru`.
 */
export function timChoSatTuong(ranh: Diem[], ht: HeTruc, o: { u0: number; u1: number; v0: number; v1: number }, dai: number, sau: number, vatCan: Hcn[], loaiTru: (r: Hcn) => boolean = () => false, dayCho: number[] = []): Hcn | null {
  const ranhUv = ranh.map(ht.uv);
  const ung: { r: Hcn; d: number }[] = [];
  const giuaU = (o.u0 + o.u1) / 2;
  for (let i = 0; i < ranhUv.length; i++) {
    const a = ranhUv[i], b = ranhUv[(i + 1) % ranhUv.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l < dai || Math.abs(b[1] - a[1]) > 0.05 * l) continue;
    const v = (a[1] + b[1]) / 2;
    if (v < o.v0 - 0.5 || v > o.v1 + 0.5) continue;
    const ua = Math.max(Math.min(a[0], b[0]), o.u0), ub = Math.min(Math.max(a[0], b[0]), o.u1);
    for (let u = ua; u + dai <= ub + 1e-6; u += 1) {
      for (const s of [1, -1]) {
        const r: Hcn = s > 0 ? [u, v + 0.05, u + dai, v + 0.05 + sau] : [u, v - 0.05 - sau, u + dai, v - 0.05];
        ung.push({ r, d: Math.abs(u + dai / 2 - giuaU) });
      }
    }
  }
  ung.sort((x, y) => x.d - y.d);
  const giuaV = (o.v0 + o.v1) / 2;
  const trong = dayCho.filter((v) => v >= o.v0 && v + sau <= o.v1).sort((a, b) => Math.abs(a - giuaV) - Math.abs(b - giuaV))
    .flatMap((v) => { const ds: { r: Hcn; d: number }[] = []; for (let u = o.u0; u + dai <= o.u1; u += 2) ds.push({ r: [u, v, u + dai, v + sau], d: Math.abs(u + dai / 2 - giuaU) }); return ds.sort((x, y) => x.d - y.d); });
  for (const { r } of [...ung, ...trong]) {
    if (vatCan.some((x) => chongHcn(x, r, 0.1))) continue;
    if (!hcnTrong(r, ranhUv)) continue;
    if (loaiTru(r)) continue;
    return r;
  }
  return null;
}

/** Hình chữ nhật cạnh một lõi (thử 4 phía), không chồng vật cản, nằm trong ranh. */
export function timChoCanhLoi(ranh: Diem[], ht: HeTruc, loi: Diem[][], rong: number, sau: number, vatCan: Hcn[]): Hcn | null {
  const ranhUv = ranh.map(ht.uv);
  for (const p of loi) {
    const r = khungUvP(ht, p);
    const cu = (r[0] + r[2]) / 2, cv = (r[1] + r[3]) / 2;
    const ung: Hcn[] = [
      [r[2] + 0.05, cv - rong / 2, r[2] + 0.05 + sau, cv + rong / 2], [r[0] - 0.05 - sau, cv - rong / 2, r[0] - 0.05, cv + rong / 2],
      [cu - rong / 2, r[3] + 0.05, cu + rong / 2, r[3] + 0.05 + sau], [cu - rong / 2, r[1] - 0.05 - sau, cu + rong / 2, r[1] - 0.05],
    ];
    for (const c of ung) {
      if (vatCan.some((x) => chongHcn(x, c, 0.1))) continue;
      if (!hcnTrong(c, ranhUv)) continue;
      return c;
    }
  }
  return null;
}

export const khungHeTruc = khungUvP;

/* ---------- Cụt đường, liên thông ---------- */

/** Đường nối làn: hình chữ nhật hệ trục (đường ngang hai đầu cả bề cao, hoặc đoạn nối ngắn giữa hai làn); `mo(u, v)` = còn mở. */
export type DuongNoi = { r: Hcn; mo?: (u: number, v: number) => boolean };

/**
 * Đầu làn (hệ trục) "thông" khi chạm một đường nối: đường nối phủ cao độ v giữa làn và đầu làn nằm trong / cách mép đường nối
 * ≤ `dung` (khe < một ô chỗ đỗ). Trả số đầu cụt + vị trí (hệ trục) + phía (−1 đầu u nhỏ, 1 đầu u lớn).
 */
export function demCutDuong(lan: Hcn[], noi: DuongNoi[], dung: number): { so: number; diem: [number, number][]; dau: { u: number; v: number; phia: -1 | 1; lan: Hcn }[] } {
  const diem: [number, number][] = [];
  const dau: { u: number; v: number; phia: -1 | 1; lan: Hcn }[] = [];
  for (const r of lan) {
    if (r[2] - r[0] < 1) continue;
    const vm = (r[1] + r[3]) / 2;
    const thong = (u: number) => noi.some(({ r: n, mo }) =>
      vm >= n[1] - 0.01 && vm <= n[3] + 0.01 && u >= n[0] - dung && u <= n[2] + dung && (!mo || mo((n[0] + n[2]) / 2, vm)));
    if (!thong(r[0])) { diem.push([r[0], vm]); dau.push({ u: r[0], v: vm, phia: -1, lan: r }); }
    if (!thong(r[2])) { diem.push([r[2], vm]); dau.push({ u: r[2], v: vm, phia: 1, lan: r }); }
  }
  return { so: diem.length, diem, dau };
}

/* ---------- Chọn chỗ ---------- */

/** QCVN 10:2024/BXD Bảng 1: số chỗ đỗ tối thiểu cho người gặp khó khăn khi tiếp cận theo tổng số chỗ. "> 200: 5 + 1 cho mỗi lần thêm 100" lấy tròn lên. */
export function soXeLanQCVN10(tong: number): number {
  if (tong <= 5) return 0;
  if (tong <= 50) return 1;
  if (tong <= 100) return 2;
  if (tong <= 150) return 3;
  if (tong <= 200) return 4;
  return 5 + Math.ceil((tong - 200) / 100);
}

/**
 * Gộp hai chỗ liền nhau (cùng dãy) thành chỗ xe lăn ≥ `rong` (QCVN 13:2018 2.2.1.25: 3,5 m), chọn các cặp gần `diem` nhất
 * (lõi thang máy). Trả chỗ còn lại + chỗ xe lăn (thế giới).
 */
export function chonXeLan(cho: Diem[][], ht: HeTruc, n: number, rong: number, diem: Diem[]): { thuong: Diem[][]; xeLan: Diem[][] } {
  if (n <= 0 || !cho.length) return { thuong: cho, xeLan: [] };
  const r = cho.map((p) => khungUvP(ht, p));
  const theoDay = new Map<string, number[]>();
  r.forEach((x, i) => { const k = `${x[1].toFixed(3)}|${x[3].toFixed(3)}`; (theoDay.get(k) ?? theoDay.set(k, []).get(k)!).push(i); });
  const cap: { a: number[]; d: number; hcn: Hcn }[] = [];
  const dUv = diem.map(ht.uv);
  for (const ds of theoDay.values()) {
    ds.sort((a, b) => r[a][0] - r[b][0]);
    for (let i = 0; i < ds.length; i++) {
      const nhom = [ds[i]];
      let j = i;
      while (r[nhom[nhom.length - 1]][2] - r[ds[i]][0] < rong - 1e-6 && j + 1 < ds.length && Math.abs(r[ds[j + 1]][0] - r[ds[j]][2]) < 1e-6) { j++; nhom.push(ds[j]); }
      const h: Hcn = [r[ds[i]][0], r[ds[i]][1], r[ds[j]][2], r[ds[i]][3]];
      if (h[2] - h[0] < rong - 1e-6) continue;
      const cu = (h[0] + h[2]) / 2, cv = (h[1] + h[3]) / 2;
      const d = dUv.length ? Math.min(...dUv.map(([u, v]) => Math.abs(u - cu) + Math.abs(v - cv))) : cu;
      cap.push({ a: nhom, d, hcn: h });
    }
  }
  cap.sort((x, y) => x.d - y.d);
  const dung = new Set<number>();
  const xeLan: Diem[][] = [];
  for (const c of cap) {
    if (xeLan.length >= n) break;
    if (c.a.some((i) => dung.has(i))) continue;
    c.a.forEach((i) => dung.add(i));
    xeLan.push(hcnUv(ht, c.hcn[0], c.hcn[1], c.hcn[2], c.hcn[3]));
  }
  return { thuong: cho.filter((_, i) => !dung.has(i)), xeLan };
}

/** Chọn `n` chỗ gần `goc` nhất (sạc gần trạm điện), chia phân vùng ≤ `moVung` chỗ theo thứ tự gần → xa. */
export function chonSac(cho: Diem[][], n: number, goc: Diem, moVung: number): Diem[][][] {
  if (n <= 0 || !cho.length) return [];
  const chon = cho.map((p) => ({ p, d: Math.hypot(trongTam(p)[0] - goc[0], trongTam(p)[1] - goc[1]) })).sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.p);
  const kq: Diem[][][] = [];
  const mo = Math.max(1, Math.round(moVung));
  for (let i = 0; i < chon.length; i += mo) kq.push(chon.slice(i, i + mo));
  return kq;
}

/** Điểm thế giới có nằm trong một trong các đa giác. */
export const trongMot = (p: Diem, ds: Diem[][]) => ds.some((q) => q.length >= 3 && diemTrong(p[0], p[1], q));
