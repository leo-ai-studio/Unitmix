/** Hàm chuyển động dùng chung (chỉ toán + rAF, không thư viện). */

export const easeOutCubic = (p: number): number => 1 - (1 - p) ** 3;
export const easeInOut = (p: number): number => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
export const tron = (a: number, b: number, p: number): number => a + (b - a) * p;

/** Người dùng chọn giảm chuyển động thì bỏ hoạt ảnh JS (CSS đã tự tắt). */
export function giamChuyenDong(): boolean {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/**
 * Chạy `buoc(p)` với p từ 0 → 1 trong `ms` mili-giây (đã áp `ease`); trả hàm huỷ.
 * Giảm chuyển động: nhảy thẳng tới p = 1.
 */
export function chayRaf(ms: number, ease: (p: number) => number, buoc: (p: number) => void, xong?: () => void): () => void {
  if (giamChuyenDong() || typeof requestAnimationFrame !== 'function') { buoc(1); xong?.(); return () => {}; }
  let id = 0, t0 = -1, huy = false;
  const khung = (now: number) => {
    if (huy) return;
    if (t0 < 0) t0 = now;
    const p = Math.min(1, (now - t0) / ms);
    buoc(ease(p));
    if (p < 1) id = requestAnimationFrame(khung); else xong?.();
  };
  id = requestAnimationFrame(khung);
  return () => { huy = true; cancelAnimationFrame(id); };
}
