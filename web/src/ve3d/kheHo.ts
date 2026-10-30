/**
 * Khe hở trên nét bao DTXD (app cũ QT-119 `c3dKheHo`, QT-128): đầu hành lang và sảnh thang máy tòa I / V không có căn hay tường lõi che.
 * Quét từng cạnh nét bao, mỗi 100 mm lấy điểm lùi vào trong 400 mm: không rơi vào căn nào, và điểm lùi 120 mm không rơi vào tường lõi nào
 * → hở. Đoạn hở liên tục rộng 1.000–2.200 mm là một khe:
 *  - gần đầu trục hành lang (≤ 2,5 m): đầu hành lang → tường dày 200 hai bên + cửa sổ rộng = bề rộng hành lang − 200;
 *  - còn lại (sảnh thang máy): MỘT cửa sổ ở giữa, rộng bằng khe nhưng không quá 1.800 (như cửa sổ căn hộ).
 * Hàm thuần, mm, toạ độ mặt tòa.
 */
import type { Diem } from '../tinh/kieu';

export type KheHo = {
  /** Điểm đầu khe trên nét bao. */
  o: Diem;
  /** Hướng dọc khe (đơn vị). */
  d: Diem;
  /** Hướng vào trong nhà (đơn vị, vuông góc `d`). */
  n: Diem;
  /** Bề rộng khe sau khi làm tròn (mm). */
  w: number;
  /** Bề rộng cửa sổ (mm). */
  cw: number;
  /** Khe ở đầu hành lang (true) hay sảnh thang máy (false). */
  hl: boolean;
};
/** Đầu trục hành lang: điểm cuối của đường tim và bề rộng hành lang tại đó. */
export type DauHanhLang = { p: Diem; c: number };

const trong = (pt: Diem, poly: Diem[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

export const KHE_MIN = 1000, KHE_MAX = 2200, KHE_CUA_TOI_DA = 1800, KHE_GAN_HL = 2500, KHE_LUI = 400, KHE_LUI_TUONG = 120;

/** `polys` = căn (và lõi chưa có nét tường); `tuong` = các vùng tường lõi. */
export function kheHoNetBao(bao: Diem[], polys: Diem[][], tuong: Diem[][], dau: DauHanhLang[]): KheHo[] {
  let sg = 0;
  for (let i = 0; i < bao.length; i++) { const p = bao[i], q = bao[(i + 1) % bao.length]; sg += p[0] * q[1] - q[0] * p[1]; }
  const ccw = sg > 0, kq: KheHo[] = [];
  for (let i = 0; i < bao.length; i++) {
    const p = bao[i], q = bao[(i + 1) % bao.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (L < 900) continue;
    const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L, nx = ccw ? -uy : uy, ny = ccw ? ux : -ux; // (nx, ny): vào trong
    let run: { s0: number; s1: number } | null = null;
    const xong = () => {
      if (!run) return;
      const w = run.s1 - run.s0 + 100, mid = (run.s0 + run.s1) / 2;
      run = null;
      if (w < KHE_MIN || w > KHE_MAX) return;
      const cx = p[0] + ux * mid, cy = p[1] + uy * mid;
      let hl: DauHanhLang | null = null, bd = KHE_GAN_HL;
      for (const e of dau) { const d = Math.hypot(e.p[0] - cx, e.p[1] - cy); if (d < bd) { bd = d; hl = e; } }
      const W = hl && Math.abs(w - hl.c) <= 300 ? hl.c : Math.round(w / 100) * 100, cw = hl ? W - 200 : Math.min(W, KHE_CUA_TOI_DA);
      // trục a chạy cùng chiều đa giác ngược chiều kim đồng hồ; đa giác thuận chiều thì đảo để n vẫn hướng vào trong
      const sx = ccw ? cx - (ux * W) / 2 : cx + (ux * W) / 2, sy = ccw ? cy - (uy * W) / 2 : cy + (uy * W) / 2;
      kq.push({ o: [sx, sy], d: ccw ? [ux, uy] : [-ux, -uy], n: [nx, ny], w: W, cw, hl: !!hl });
    };
    for (let t = 0; t <= L; t += 100) {
      const pt: Diem = [p[0] + ux * t + nx * KHE_LUI, p[1] + uy * t + ny * KHE_LUI];
      const pt2: Diem = [p[0] + ux * t + nx * KHE_LUI_TUONG, p[1] + uy * t + ny * KHE_LUI_TUONG];
      if (!polys.some((c) => trong(pt, c)) && !tuong.some((c) => trong(pt2, c))) { if (!run) run = { s0: t, s1: t }; else run.s1 = t; } else xong();
    }
    xong();
  }
  return kq;
}
