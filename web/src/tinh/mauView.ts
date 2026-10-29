/**
 * Thang màu + thống kê cho phân tích VIEW (hàm thuần, không DOM). Dùng chung cho 3D (màu đỉnh), TMB (dải mặt ngoài), màn Tầng (chip),
 * chú giải và panel số.
 *
 * Thang "LEO san hô → cát → xô thơm → mòng két" (tự thiết kế, không chép thang của phần mềm khác): nội suy trong OKLab giữa 5 mốc
 * OKLCH, ĐỘ SÁNG GIẢM ĐƠN ĐIỆU từ điểm 0 (san hô nhạt) tới 100 (mòng két đậm của brand, #174f52 họ hàng). Thứ tự điểm nằm ở độ sáng
 * nên vẫn đọc được khi in đen trắng hoặc với người mù màu đỏ–lục (sắc độ chạy theo trục vàng–lam: san hô / cát ↔ mòng két, không dựa
 * cặp đỏ–lục). Căn view tốt nổi lên bằng màu đậm của brand; căn kém là sắc ấm nhạt — panel "Vấn đề" chỉ ra chúng.
 */

/** Mốc thang: [vị trí 0..1, L, C, h°] trong OKLCH. */
export const MOC_THANG: readonly [number, number, number, number][] = [
  [0.0, 0.78, 0.11, 36],   // san hô
  [0.25, 0.765, 0.1, 74],  // cát
  [0.5, 0.69, 0.085, 126], // xô thơm
  [0.75, 0.565, 0.075, 178], // mòng két
  [1.0, 0.42, 0.065, 200], // mòng két đậm
];

type Lab = [number, number, number];
const lchLab = (L: number, C: number, h: number): Lab => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
const MOC_LAB = MOC_THANG.map(([p, L, C, h]) => [p, ...lchLab(L, C, h)] as [number, number, number, number]);

/** OKLab → sRGB 0..1 (có thể ngoài gam; xem `trongGam`). */
export function oklabRgb([L, a, b]: Lab): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const g = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055);
  return [g(lin[0]), g(lin[1]), g(lin[2])];
}

/** Màu OKLab tại điểm v (0..100). */
export function labView(v: number): Lab {
  const p = Math.min(1, Math.max(0, (Number.isFinite(v) ? v : 0) / 100));
  let i = 0;
  while (i < MOC_LAB.length - 2 && p > MOC_LAB[i + 1][0]) i++;
  const a = MOC_LAB[i], b = MOC_LAB[i + 1], k = (p - a[0]) / (b[0] - a[0]);
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
}

const BANG = 256;
const lut: Uint8Array = (() => {
  const o = new Uint8Array(BANG * 3);
  for (let i = 0; i < BANG; i++) {
    const c = oklabRgb(labView((i / (BANG - 1)) * 100));
    for (let j = 0; j < 3; j++) o[i * 3 + j] = Math.round(Math.min(1, Math.max(0, c[j])) * 255);
  }
  return o;
})();

/** Màu sRGB 0..255 của điểm view v (0..100) — bảng tra 256 mức. */
export function mauView(v: number): [number, number, number] {
  const i = Math.round((Math.min(100, Math.max(0, Number.isFinite(v) ? v : 0)) / 100) * (BANG - 1)) * 3;
  return [lut[i], lut[i + 1], lut[i + 2]];
}
const hex2 = (n: number) => n.toString(16).padStart(2, '0');
/** Màu CSS (#rrggbb) của điểm v. */
export const mauViewCss = (v: number) => { const [r, g, b] = mauView(v); return `#${hex2(r)}${hex2(g)}${hex2(b)}`; };
/** Chữ trên nền màu điểm v: mực gần đen hoặc trắng — bên nào tương phản WCAG cao hơn (chữ chip in đậm; giữa thang ≥ 4,2). */
export const chuTrenView = (v: number) => (doTuongPhan(mauView(v), [255, 255, 255]) >= doTuongPhan(mauView(v), MUC) ? '#ffffff' : '#141818');
const MUC: [number, number, number] = [20, 24, 24];

/** Độ tương phản WCAG giữa hai màu sRGB 0..255. */
export function doTuongPhan(a: [number, number, number], b: [number, number, number]): number {
  const Y = (c: [number, number, number]) => {
    const f = (x: number) => { const s = x / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const y1 = Y(a), y2 = Y(b);
  return (Math.max(y1, y2) + 0.05) / (Math.min(y1, y2) + 0.05);
}

/** Các điểm dừng cho `linearGradient` / CSS gradient (n mốc đều). */
export function dungThang(n = 11): { p: number; mau: string }[] {
  return Array.from({ length: n }, (_, i) => { const p = i / (n - 1); return { p, mau: mauViewCss(p * 100) }; });
}
/** CSS `linear-gradient` của thang (trái → phải = 0 → 100). */
export const gradientCss = (huong = 'to right') => `linear-gradient(${huong}, ${dungThang(11).map((d) => `${d.mau} ${(d.p * 100).toFixed(0)}%`).join(', ')})`;

// ---------- thống kê ----------
/**
 * Biểu đồ tần suất điểm (0..100) thành `n` ô đều; mỗi mục đếm theo trọng số `so` (số tầng). Điểm 100 rơi vào ô cuối.
 */
export function bieuDoView(ds: { tong: number; so: number }[], n = 20): number[] {
  const o = new Array<number>(n).fill(0);
  for (const d of ds) {
    if (!Number.isFinite(d.tong)) continue;
    const i = Math.min(n - 1, Math.max(0, Math.floor((d.tong / 100) * n)));
    o[i] += d.so;
  }
  return o;
}
