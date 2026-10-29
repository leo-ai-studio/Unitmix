/**
 * GIỜ NẮNG TRỰC TIẾP (direct sun hours) trên lưới mặt đất / mái đế và trên mặt đứng các khối — như phân tích "Sun hours" của Forma,
 * tính trên CPU trong Web Worker (`gioNang.worker.ts`), không chặn luồng chính. Hàm thuần, toạ độ bản vẽ (m), z lên.
 *
 * Mô hình: mỗi khối là lăng trụ đứng (chân đa giác, đáy z0, đỉnh z1) — thân tháp + khối đế như 3D Toàn dự án. Bỏ qua cây, địa hình,
 * công trình ngoài PA, phản xạ, mây (nắng trực tiếp trời quang) — ghi rõ trên giao diện.
 * - Mặt bằng (mặt đất z = 0 và mái các khối): mỗi bước thời gian, bóng của lăng trụ trên mặt phẳng cao độ h là tổng Minkowski chân khối
 *   với đoạn [−u·L0, −u·L1] (u = hướng ngang tới mặt trời, L = (z − h) / tan độ cao) = hai nắp + các hình bình hành quét từ từng cạnh →
 *   tô quét dòng lên lưới (đánh dấu theo bước, không đếm hai lần). O(số cạnh × số dòng) mỗi bước, không phụ thuộc số ô.
 * - Mặt đứng: điểm mẫu trên từng cạnh × tầng, pháp tuyến ra ngoài; nắng khi pháp tuyến quay về mặt trời và tia tới mặt trời không cắt
 *   khối nào (cắt đoạn 2D trong khoảng cao độ của khối, loại trước bằng khung bao).
 */
import type { Diem } from '../kieu';
import type { BuocNang } from '../matTroi';

export type KhoiLang = { chan: Diem[]; z0: number; z1: number };
export type LuoiNang = { x0: number; y0: number; buoc: number; nx: number; ny: number };
export type DauVaoNang = {
  khoi: KhoiLang[];
  luoi: LuoiNang;
  buoc: BuocNang[];
  /** Mẫu mặt đứng: bước ngang / đứng (m); 0 = không tính mặt đứng. */
  matDung: { ngang: number; dung: number };
};
export type KetQuaNang = {
  luoi: LuoiNang;
  /** Giờ nắng mỗi ô (hàng y từ y0 lên, cột x); NaN = ô nằm trong chân tháp (không phải mặt bằng tính). */
  gio: Float32Array;
  /** Cao độ mặt tính của ô (0 = mặt đất, > 0 = mái khối). */
  cao: Float32Array;
  /** Mặt đứng: mỗi mẫu 9 số x, y, z, nx, ny, rộng, cao, giờ, chỉ số khối. */
  mat: Float32Array;
  /** Tổng giờ có mặt trời (trên ngưỡng độ cao) của ngày = thang tối đa. */
  tongGio: number;
  daXong: number;
  tong: number;
};

const dtCoHuong = (p: Diem[]) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; };
export function trongDaGiac(x: number, y: number, p: Diem[]): boolean {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/**
 * Tô quét dòng đa giác (chẵn lẻ) lên lưới: gọi `o(chiSo)` cho mọi ô có TÂM nằm trong đa giác. Đa giác ngoài lưới bị cắt theo dòng / cột.
 */
export function toDaGiac(p: Diem[], L: LuoiNang, o: (i: number) => void): void {
  let ymin = Infinity, ymax = -Infinity;
  for (const q of p) { if (q[1] < ymin) ymin = q[1]; if (q[1] > ymax) ymax = q[1]; }
  const r0 = Math.max(0, Math.ceil((ymin - L.y0) / L.buoc - 0.5)), r1 = Math.min(L.ny - 1, Math.floor((ymax - L.y0) / L.buoc - 0.5));
  const xs: number[] = [];
  for (let r = r0; r <= r1; r++) {
    const y = L.y0 + (r + 0.5) * L.buoc;
    xs.length = 0;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const a = p[i], b = p[j];
      if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    if (xs.length < 2) continue;
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k] - L.x0) / L.buoc - 0.5)), c1 = Math.min(L.nx - 1, Math.floor((xs[k + 1] - L.x0) / L.buoc - 0.5));
      for (let c = c0; c <= c1; c++) o(r * L.nx + c);
    }
  }
}

/** Lưới phủ khung (m) nới `noi` m, bước chọn để số ô ≤ `oToiDa` (bước ≥ `buocMin`, làm tròn 0,5 m). */
export function taoLuoi(khung: [number, number, number, number], noi: number, oToiDa: number, buocMin = 1): LuoiNang {
  const w = khung[2] - khung[0] + 2 * noi, h = khung[3] - khung[1] + 2 * noi;
  const buoc = Math.max(buocMin, Math.ceil(Math.sqrt((w * h) / oToiDa) * 2) / 2);
  return { x0: khung[0] - noi, y0: khung[1] - noi, buoc, nx: Math.max(1, Math.ceil(w / buoc)), ny: Math.max(1, Math.ceil(h / buoc)) };
}

/** Khung bao các điểm. */
export const khungBao = (ds: Diem[]): [number, number, number, number] => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of ds) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
};

type KhoiChuan = KhoiLang & { hop: [number, number, number, number] };

/** Đoạn 2D AB có chạm đa giác không (A trong, hoặc cắt một cạnh). */
function doanCham(ax: number, ay: number, bx: number, by: number, p: Diem[]): boolean {
  if (trongDaGiac(ax, ay, p)) return true;
  const dx = bx - ax, dy = by - ay;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const cx = p[j][0], cy = p[j][1], ex = p[i][0] - cx, ey = p[i][1] - cy;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const qx = cx - ax, qy = cy - ay, t = (qx * ey - qy * ex) / den, s = (qx * dy - qy * dx) / den;
    if (t >= 0 && t <= 1 && s >= 0 && s <= 1) return true;
  }
  return false;
}

/** Tia từ (x, y, z) theo hướng mặt trời có bị khối nào che không. `tanA` = tan độ cao, (ux, uy) = hướng ngang đơn vị. */
export function biChe(x: number, y: number, z: number, ux: number, uy: number, tanA: number, khoi: KhoiChuan[], boQua = 1e-3): boolean {
  for (const k of khoi) {
    if (k.z1 <= z) continue; // khối thấp hơn điểm: tia đi lên không chạm
    const s0 = Math.max(boQua, (k.z0 - z) / tanA), s1 = (k.z1 - z) / tanA;
    if (s1 <= s0) continue;
    const ax = x + ux * s0, ay = y + uy * s0, bx = x + ux * s1, by = y + uy * s1;
    if (Math.max(ax, bx) < k.hop[0] || Math.min(ax, bx) > k.hop[2] || Math.max(ay, by) < k.hop[1] || Math.min(ay, by) > k.hop[3]) continue;
    if (doanCham(ax, ay, bx, by, k.chan)) return true;
  }
  return false;
}

/** Mẫu mặt đứng của các khối: [x, y, z, nx, ny, rộng, cao, 0, chỉ số khối] × n. Bỏ đoạn mặt nằm trong khối khác (mặt tiếp giáp). */
export function mauMatDung(khoi: KhoiLang[], ngang: number, dung: number): Float32Array {
  const ds: number[] = [];
  khoi.forEach((k, ki) => {
    const p = k.chan, ccw = dtCoHuong(p) > 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      if (L < 0.3) continue;
      const nx = (ccw ? dy : -dy) / L, ny = (ccw ? -dx : dx) / L;
      const m = Math.max(1, Math.round(L / ngang)), w = L / m;
      const h = k.z1 - k.z0, n = Math.max(1, Math.round(h / dung)), hh = h / n;
      for (let s = 0; s < m; s++) {
        const t = (s + 0.5) / m, x = a[0] + dx * t + nx * 0.05, y = a[1] + dy * t + ny * 0.05;
        for (let v = 0; v < n; v++) {
          const z = k.z0 + (v + 0.5) * hh;
          // mặt tiếp giáp khối khác (thân tháp trên đế, hai đế chạm nhau) không phải mặt ngoài
          if (khoi.some((q, qi) => qi !== ki && z > q.z0 && z < q.z1 && trongDaGiac(x, y, q.chan))) continue;
          ds.push(x, y, z, nx, ny, w, hh, 0, ki);
        }
      }
    }
  });
  return new Float32Array(ds);
}

/**
 * Giờ nắng — chạy từng bước, gọi `moiBuoc(kq)` sau mỗi bước (kết quả dở dang dùng để hiện dần). `dung()` = true thì dừng sớm.
 */
export function tinhGioNang(dv: DauVaoNang, moiBuoc?: (kq: KetQuaNang) => void, dung?: () => boolean): KetQuaNang {
  const L = dv.luoi, n = L.nx * L.ny;
  const khoi: KhoiChuan[] = dv.khoi.filter((k) => k.chan.length >= 3 && k.z1 > k.z0).map((k) => {
    const [a, b, c, d] = khungBao(k.chan);
    return { ...k, hop: [a, b, c, d] };
  });
  // cao độ mặt tính của từng ô = đỉnh khối cao nhất chứa tâm ô (0 = đất)
  const cao = new Float32Array(n);
  for (const k of khoi) toDaGiac(k.chan, L, (i) => { if (k.z1 > cao[i]) cao[i] = k.z1; });
  const mucs = [...new Set(Array.from(cao))].sort((a, b) => a - b);
  const gio = new Float32Array(n);
  // mặt đứng
  const mat = dv.matDung.ngang > 0 ? mauMatDung(dv.khoi, dv.matDung.ngang, dv.matDung.dung) : new Float32Array(0);
  const soMat = mat.length / 9;
  const dau = new Int32Array(n).fill(-1);
  const tongGio = dv.buoc.reduce((s, b) => s + b.dh, 0);
  const kq: KetQuaNang = { luoi: L, gio, cao, mat, tongGio, daXong: 0, tong: dv.buoc.length };
  dv.buoc.forEach((b, bi) => {
    if (dung?.()) return;
    const [hx, hy, hz] = b.huong, ngang = Math.hypot(hx, hy);
    if (hz <= 0 || ngang < 1e-9) { kq.daXong = bi + 1; return; }
    const ux = hx / ngang, uy = hy / ngang, tanA = hz / ngang;
    // --- mặt bằng: mỗi mức cao độ tô bóng các khối cao hơn mức đó ---
    for (const h of mucs) {
      const tem = bi * mucs.length + mucs.indexOf(h); // dấu riêng từng (bước, mức)
      for (const k of khoi) {
        if (k.z1 <= h + 1e-6) continue;
        const L0 = Math.max(0, k.z0 - h) / tanA, L1 = (k.z1 - h) / tanA;
        const v0x = -ux * L0, v0y = -uy * L0, v1x = -ux * L1, v1y = -uy * L1;
        const danh = (i: number) => { if (cao[i] === h) dau[i] = tem; };
        const p = k.chan;
        toDaGiac(p.map(([x, y]) => [x + v0x, y + v0y]), L, danh);
        toDaGiac(p.map(([x, y]) => [x + v1x, y + v1y]), L, danh);
        for (let i = 0; i < p.length; i++) {
          const a = p[i], c = p[(i + 1) % p.length];
          toDaGiac([[a[0] + v0x, a[1] + v0y], [c[0] + v0x, c[1] + v0y], [c[0] + v1x, c[1] + v1y], [a[0] + v1x, a[1] + v1y]], L, danh);
        }
      }
      for (let i = 0; i < n; i++) if (cao[i] === h && dau[i] !== tem) gio[i] += b.dh;
    }
    // --- mặt đứng ---
    for (let j = 0; j < soMat; j++) {
      const o = j * 9;
      if (mat[o + 3] * ux + mat[o + 4] * uy <= 0.01) continue; // quay lưng / song song với mặt trời
      if (!biChe(mat[o], mat[o + 1], mat[o + 2], ux, uy, tanA, khoi)) mat[o + 7] += b.dh;
    }
    kq.daXong = bi + 1;
    moiBuoc?.(kq);
  });
  // ô nằm trong chân tháp mà mái là của chính tháp vẫn tính (mái); không ô nào NaN ở mô hình này — giữ NaN cho ô ngoài vùng tính sau này
  return kq;
}

/** Thống kê cho chú giải: tỷ lệ diện tích theo khoảng giờ (mặc định mỗi giờ), TB, % ô ≥ `nguong` giờ. */
export function thongKeGio(gio: ArrayLike<number>, tongGio: number, nguong = 2, chon?: (i: number) => boolean): { tb: number; datNguong: number; cot: number[]; dem: number } {
  const soCot = Math.max(1, Math.ceil(tongGio)), cot = new Array(soCot).fill(0);
  let s = 0, d = 0, dat = 0;
  for (let i = 0; i < gio.length; i++) {
    const v = gio[i];
    if (!Number.isFinite(v) || (chon && !chon(i))) continue;
    s += v; d++; if (v >= nguong - 1e-6) dat++;
    cot[Math.min(soCot - 1, Math.floor(v))]++;
  }
  return { tb: d ? s / d : 0, datNguong: d ? dat / d : 0, cot: cot.map((c) => (d ? c / d : 0)), dem: d };
}
