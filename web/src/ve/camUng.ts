/**
 * Cảm ứng bản vẽ 2D (thuần, không DOM): phân biệt chạm / kéo / chụm / giữ, chạm hai lần, phóng quanh một điểm,
 * và phép biến đổi CSS (`transform`) để bám tay 1:1 trong rAF mà không vẽ lại SVG.
 * Dùng ở `ve/BanVe.tsx`; số ngưỡng theo cỡ ngón tay (chuột thì nhỏ hơn).
 */

/** Khung nhìn: tâm (m, y đã lật) và bề rộng nhìn thấy (m); bề cao suy từ ô chứa. */
export type NhinThay = { cx: number; cy: number; w: number };
/** Một điểm chạm theo thời gian (px trong ô chứa, ms). */
export type DiemCham = { x: number; y: number; t: number };
export type KieuTro = 'mouse' | 'touch' | 'pen' | string;

export const W_TOI_THIEU = 2, W_TOI_DA = 100000;
export const kepW = (w: number) => Math.min(W_TOI_DA, Math.max(W_TOI_THIEU, w));

/** Quãng run tay tối đa (px) vẫn tính là chạm: ngón tay rung nhiều hơn chuột. */
export const nguongRun = (kieu: KieuTro) => (kieu === 'touch' ? 10 : kieu === 'pen' ? 6 : 4);
/** Giữ yên quá chừng này (ms) = nhấn giữ (mở menu ngữ cảnh). */
export const MS_GIU = 520;
/** Hai lần chạm cách nhau tối đa (ms, px) = chạm hai lần. */
export const MS_DUP = 320, PX_DUP = 28;

export type CuChiCham = 'cham' | 'keo' | 'chum' | 'giu';

/**
 * Phân loại một lượt chạm khi nhấc tay: `soNgon` = số ngón nhiều nhất cùng lúc trong lượt, `xa` = quãng đi xa nhất từ điểm đặt (px).
 * Hai ngón trở lên luôn là chụm; đi quá ngưỡng run là kéo; đứng yên lâu là giữ; còn lại là chạm.
 */
export function phanLoai(dau: DiemCham, cuoi: DiemCham, xa: number, soNgon: number, kieu: KieuTro): CuChiCham {
  if (soNgon >= 2) return 'chum';
  const run = Math.max(xa, Math.hypot(cuoi.x - dau.x, cuoi.y - dau.y));
  if (run > nguongRun(kieu)) return 'keo';
  if (cuoi.t - dau.t >= MS_GIU) return 'giu';
  return 'cham';
}

/** Chạm này nối với lần chạm trước thành chạm hai lần? (cả hai đều là chạm, gần nhau về thời gian và chỗ). */
export function laChamDup(truoc: DiemCham | null, nay: DiemCham): boolean {
  return !!truoc && nay.t - truoc.t <= MS_DUP && nay.t >= truoc.t && Math.hypot(nay.x - truoc.x, nay.y - truoc.y) <= PX_DUP;
}

/** Phóng / thu hệ số k (bề rộng mới = w·k) quanh điểm (px, py) trong ô r × c: điểm thế giới dưới (px, py) đứng yên trên màn hình. */
export function zoomTu(o: NhinThay, r: number, c: number, k: number, px: number, py: number): NhinThay {
  const m0 = o.w / r, wx = o.cx + (px - r / 2) * m0, wy = o.cy + (py - c / 2) * m0;
  const w = kepW(o.w * k), m1 = w / r;
  return { w, cx: wx - (px - r / 2) * m1, cy: wy - (py - c / 2) * m1 };
}

/** Lúc bắt đầu chụm: khung nhìn, khoảng cách và trung điểm hai ngón (px). */
export type GocChum = { v: NhinThay; d0: number; mx: number; my: number };
type Px = { x: number; y: number };

export function batDauChum(v: NhinThay, a: Px, b: Px): GocChum {
  return { v, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}

/**
 * Khung nhìn khi hai ngón đang ở a, b: điểm thế giới nằm dưới trung điểm lúc bắt đầu đi theo trung điểm mới (dời),
 * tỷ lệ theo khoảng cách hai ngón (phóng quanh điểm giữa hai ngón). Bám tay 1:1, không quán tính.
 */
export function nhinKhiChum(g: GocChum, a: Px, b: Px, r: number, c: number): NhinThay {
  const d = Math.hypot(a.x - b.x, a.y - b.y) || 1, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const m0 = g.v.w / r, wx = g.v.cx + (g.mx - r / 2) * m0, wy = g.v.cy + (g.my - c / 2) * m0;
  const w = kepW((g.v.w * g.d0) / d), m1 = w / r;
  return { w, cx: wx - (mx - r / 2) * m1, cy: wy - (my - c / 2) * m1 };
}

/** Kéo một ngón: dời tâm ngược chiều ngón (bản vẽ đi theo ngón). */
export function nhinKhiKeo(v0: NhinThay, dx: number, dy: number, r: number): NhinThay {
  const m = v0.w / r;
  return { ...v0, cx: v0.cx - dx * m, cy: v0.cy - dy * m };
}

/**
 * Phép biến đổi CSS đưa ảnh đã vẽ theo khung `daVe` thành khung `nay` (gốc biến đổi ở tâm ô chứa r × c):
 * `transform: translate(tx px, ty px) scale(s)`. Đang kéo / chụm chỉ đổi transform (lớp ghép của trình duyệt), thả tay mới vẽ lại SVG.
 */
export function bienDoi(daVe: NhinThay, nay: NhinThay, r: number): { tx: number; ty: number; s: number } {
  const s = daVe.w / nay.w, k = r / nay.w;
  return { s, tx: (daVe.cx - nay.cx) * k, ty: (daVe.cy - nay.cy) * k };
}

/** Điểm px trên màn hình của điểm thế giới (x, y đã lật) theo khung nhìn v. */
export function raPx(v: NhinThay, r: number, c: number, x: number, y: number): Px {
  const k = r / v.w;
  return { x: (x - v.cx) * k + r / 2, y: (y - v.cy) * k + c / 2 };
}
